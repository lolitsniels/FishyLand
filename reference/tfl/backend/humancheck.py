"""Human check: a reCAPTCHA v2 checkbox shown only to anglers the bot detector has flagged.
Each new flag has a chance to arm it, the more suspicious the angler, the likelier, with a randomised quiet period after
each check so it never lands on a predictable schedule. Blocks casting until solved; goes quiet when the flags stop."""
import os
import random
import logging
from datetime import datetime, timedelta
import httpx
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field
from server import api, db, now, iso, get_current_user, public_user, flag_suspicious

V2_SECRET = os.environ.get("RECAPTCHA_V2_SECRET_KEY")
HUMANCHECK_MAX_WRONG = 3        # failed captchas before the failure is flagged and a fresh one dealt
QUIET_H = (24.0, 26.0)          # at most one check a day, even for suspicious anglers
SUSPECT_SCORE = 5               # weighted bot signals in the last 24 h before anyone is checked; normal play stays below this
logger = logging.getLogger("humancheck")


def make_challenge():
    return {"id": iso(now()), "kind": "captcha", "wrong": 0}


def public_challenge(c):
    return {"id": c["id"], "kind": "captcha"} if c else None


def pending(user):
    return (user.get("humancheck") or {}).get("pending")


async def arm(user):
    """Called on every suspicion flag. Rolls the dice: likelier for higher scores, never inside the quiet window."""
    if not V2_SECRET: return
    hc = user.get("humancheck") or {}
    if hc.get("pending"): return
    nxt = hc.get("next_ok_at")
    if nxt and now() < datetime.fromisoformat(nxt): return
    from server import SIGNALS
    row = await db.suspicious.find_one({"user_id": str(user["_id"])}, {"events": 1})
    since = iso(now() - timedelta(hours=24))
    recent = sum(SIGNALS.get(e["code"], ("", 1))[1] for e in (row or {}).get("events", []) if e.get("at", "") >= since)
    if recent < SUSPECT_SCORE: return
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"humancheck.pending": make_challenge(), "humancheck.armed_at": iso(now()), "humancheck.next_ok_at": _quiet_until()}})


def _quiet_until():
    return iso(now() + timedelta(hours=random.uniform(*QUIET_H)))


async def verify(token, ip=None):
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.post("https://www.google.com/recaptcha/api/siteverify", data={"secret": V2_SECRET, "response": token, **({"remoteip": ip} if ip else {})})
    res = r.json()
    if not res.get("success"): logger.info("humancheck captcha rejected: %s", res.get("error-codes"))
    return bool(res.get("success"))


@api.get("/humancheck")
async def get_check(user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": user["_id"]}, {"humancheck": 1})
    return {"challenge": public_challenge(pending(u or {}))}


class AnswerIn(BaseModel):
    id: str
    answer: str = Field(max_length=4096)


@api.post("/humancheck/answer")
async def answer(body: AnswerIn, user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": user["_id"]}, {"humancheck": 1, "username": 1, "water": 1})
    c = pending(u or {})
    if not c or c["id"] != body.id: raise HTTPException(409, "That check has expired")
    if not V2_SECRET: raise HTTPException(503, "Bot check is not configured")
    if await verify(body.answer):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"humancheck.last_at": iso(now()), "humancheck.next_ok_at": _quiet_until(), "humancheck.passed": (u.get("humancheck") or {}).get("passed", 0) + 1}, "$unset": {"humancheck.pending": ""}})
        await db.suspicious.update_one({"user_id": str(user["_id"])}, {"$inc": {"humancheck.passed": 1}, "$set": {"humancheck.last": "passed", "humancheck.at": iso(now())}})
        return {"ok": True, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}
    wrong = c.get("wrong", 0) + 1
    if wrong >= HUMANCHECK_MAX_WRONG:
        await flag_suspicious({**u, "_id": user["_id"]}, "humancheck", f"{wrong} failed captchas")
        await db.suspicious.update_one({"user_id": str(user["_id"])}, {"$inc": {"humancheck.failed": 1}, "$set": {"humancheck.last": "failed", "humancheck.at": iso(now())}})
        fresh = make_challenge()
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"humancheck.pending": fresh}})
        return {"ok": False, "challenge": public_challenge(fresh), "message": "The check didn't go through. Please try once more."}
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"humancheck.pending.wrong": wrong}})
    return {"ok": False, "challenge": public_challenge(c), "message": "The check didn't go through, tick the box again."}


@api.post("/admin/humancheck/{user_id}")
async def admin_deal(user_id: str, admin=Depends(get_current_user)):
    from botwatch import require_staff
    await require_staff(admin)
    """Deal a human check to an angler right now (ignores chance and quiet window), for admins investigating a suspicious row."""
    from bson import ObjectId
    r = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"humancheck.pending": make_challenge(), "humancheck.armed_at": iso(now())}})
    if not r.matched_count: raise HTTPException(404, "No such angler")
    return {"ok": True}
