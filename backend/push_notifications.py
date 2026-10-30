"""Web push (VAPID): mobile/desktop notifications for boss spawns.
Players opt in after installing the PWA. Endpoint dies (410/404) → subscription is purged."""
import os
import json
import asyncio
import logging
from typing import Any

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from pywebpush import webpush, WebPushException

from server import api, db, get_current_user, iso, now

log = logging.getLogger("push")


def _configured() -> bool:
    return bool(os.environ.get("VAPID_PUBLIC_KEY") and os.environ.get("VAPID_PRIVATE_KEY") and os.environ.get("VAPID_SUBJECT"))


class SubIn(BaseModel):
    endpoint: str = Field(min_length=10)
    keys: dict[str, str]
    prefs: dict[str, bool] = {"boss": True, "expedition": False}


class PrefsIn(BaseModel):
    boss: bool = False
    expedition: bool = False
    energy: bool = False
    events: bool = True
    tournaments: bool = True
    random: bool = True


KINDS = ("boss", "expedition", "energy", "events", "tournaments", "random")  # events = tournaments you entered + duel opponent found; tournaments = buy-in opened (both on by default)
DEFAULT_ON = {"events", "tournaments", "random"}  # random = random events (goldfish, salvage, quick-draw)


def _prefs(sub):
    return {k: bool((sub.get("prefs") or {"boss": True}).get(k, k in DEFAULT_ON)) for k in KINDS}


def _kind_filter(kind: str):
    if kind == "boss": return {"$or": [{"prefs.boss": True}, {"prefs": {"$exists": False}}]}
    if kind in DEFAULT_ON: return {"$or": [{f"prefs.{kind}": True}, {f"prefs.{kind}": {"$exists": False}}]}
    return {f"prefs.{kind}": True}


@api.get("/push/config")
async def push_config():
    return {"enabled": _configured(), "public_key": os.environ.get("VAPID_PUBLIC_KEY", "")}


@api.get("/push/status")
async def push_status(user=Depends(get_current_user)):
    sub = await db.push_subscriptions.find_one({"user_id": str(user["_id"])})
    return {"subscribed": sub is not None, "prefs": _prefs(sub) if sub else {k: False for k in KINDS}}


@api.post("/push/prefs")
async def push_prefs(body: PrefsIn, user=Depends(get_current_user)):
    prefs = {k: getattr(body, k) for k in KINDS}
    await db.push_subscriptions.update_many({"user_id": str(user["_id"])}, {"$set": {"prefs": prefs}})
    return {"prefs": prefs}


@api.post("/push/subscribe")
async def push_subscribe(body: SubIn, user=Depends(get_current_user)):
    if not _configured(): raise HTTPException(503, "Push is not configured")
    if user.get("is_guest"): raise HTTPException(400, "Claim your account first to enable notifications")
    if not body.keys.get("p256dh") or not body.keys.get("auth"):
        raise HTTPException(400, "Missing subscription keys")
    doc = {"user_id": str(user["_id"]), "username": user["username"], "endpoint": body.endpoint,
           "keys": {"p256dh": body.keys["p256dh"], "auth": body.keys["auth"]}, "created_at": iso(now()),
           "prefs": {k: bool(body.prefs.get(k, k in DEFAULT_ON)) for k in KINDS}}
    await db.push_subscriptions.update_one({"endpoint": body.endpoint}, {"$set": doc}, upsert=True)
    return {"subscribed": True, "prefs": doc["prefs"]}


@api.post("/push/unsubscribe")
async def push_unsubscribe(body: dict, user=Depends(get_current_user)):
    ep = (body or {}).get("endpoint")
    if ep:
        await db.push_subscriptions.delete_one({"endpoint": ep, "user_id": str(user["_id"])})
    else:
        await db.push_subscriptions.delete_many({"user_id": str(user["_id"])})
    return {"subscribed": False}


def _send_one(sub: dict, payload: str) -> tuple[str, int]:
    """Sync helper: returns (endpoint, status). status 0 = ok, 410/404 = drop, other = keep."""
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
            data=payload,
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
            ttl=1800,
        )
        return sub["endpoint"], 0
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", 0) or 0
        return sub["endpoint"], code
    except Exception:
        return sub["endpoint"], -1


async def broadcast(title: str, body: str, url: str = "/game/fish", tag: str = "boss", kind: str = "boss", user_ids=None):
    """Fire push to every subscription that opted into `kind` (optionally only for `user_ids`). Dead subs (410/404) are removed."""
    if not _configured():
        return
    flt = _kind_filter(kind)
    if user_ids is not None: flt = {"$and": [flt, {"user_id": {"$in": list(user_ids)}}]}
    subs = await db.push_subscriptions.find(flt).to_list(5000)
    if not subs:
        return
    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})

    def _run():
        dead = []
        for s in subs:
            _, code = _send_one(s, payload)
            if code in (404, 410):
                dead.append(s["endpoint"])
        return dead

    try:
        dead = await asyncio.to_thread(_run)
        if dead:
            await db.push_subscriptions.delete_many({"endpoint": {"$in": dead}})
        log.info("push %s broadcast: sent=%d dropped=%d", kind, len(subs) - len(dead), len(dead))
    except Exception as e:
        log.error("push broadcast failed: %s", e)


async def notify_energy_full():
    """Once per refill: ping anglers who opted in when their energy has ticked back to full (works with the tab closed)."""
    if not _configured(): return
    uids = list({s["user_id"] async for s in db.push_subscriptions.find({"prefs.energy": True}, {"user_id": 1})})
    if not uids: return
    from server import apply_energy, max_energy, ObjectId
    ready = {}
    async for u in db.users.find({"_id": {"$in": [ObjectId(x) for x in uids]}, "energy_full_notified": {"$ne": True}}, {"energy": 1, "energy_at": 1, "crew": 1, "premium_until": 1}):
        cap = max_energy(u)
        if apply_energy(dict(u))["energy"] >= cap: ready.setdefault(cap, []).append(u["_id"])
    if not ready: return
    await db.users.update_many({"_id": {"$in": [x for ids in ready.values() for x in ids]}}, {"$set": {"energy_full_notified": True}})
    for cap, ids in ready.items():
        await broadcast(title="Your energy is full", body=f"All {cap} energy is back, the fish are waiting.", url="/game/fish", tag="energy-full", kind="energy", user_ids=[str(x) for x in ids])
