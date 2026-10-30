"""Live 3-minute fishing duels on the Duel Pier: two anglers, heaviest total weight wins."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException

from server import api, db, get_current_user

DUEL_SECONDS = 180
START_DELAY = 6
QUEUE_TTL = 60
WIN_GOLD = 500


def _now():
    return datetime.now(timezone.utc)


def _iso(d):
    return d.isoformat()


async def _active(uid: str):
    return await db.live_duels.find_one({"players": {"$elemMatch": {"id": uid, "left": {"$ne": True}}}, "end": {"$gt": _iso(_now() - timedelta(seconds=300))}})


def _view(m, uid):
    now = _now()
    start, end = datetime.fromisoformat(m["start"]), datetime.fromisoformat(m["end"])
    phase = "countdown" if now < start else "live" if now < end else "done"
    me = next(p for p in m["players"] if p["id"] == uid)
    foe = next(p for p in m["players"] if p["id"] != uid)
    out = {"id": m["id"], "phase": phase, "side": 0 if m["players"][0]["id"] == uid else 1, "start": m["start"], "end": m["end"], "seconds_left": max(0, int((end - now).total_seconds())),
           "me": {k: me[k] for k in ("username", "kg", "catches", "best")}, "foe": {k: foe[k] for k in ("username", "kg", "catches", "best")}}
    if phase == "done":
        out["result"] = "draw" if round(me["kg"], 3) == round(foe["kg"], 3) else "win" if me["kg"] > foe["kg"] else "lose"
        out["reward"] = WIN_GOLD if out["result"] == "win" else 0
    return out


async def _settle(m):
    """Pay the winner once when the clock runs out."""
    if m.get("paid") or _now() < datetime.fromisoformat(m["end"]):
        return m
    r = await db.live_duels.find_one_and_update({"id": m["id"], "paid": {"$ne": True}}, {"$set": {"paid": True, "state": "done"}})
    if r:
        a, b = m["players"]
        if round(a["kg"], 3) != round(b["kg"], 3):
            w = a if a["kg"] > b["kg"] else b
            from bson import ObjectId
            await db.users.update_one({"_id": ObjectId(w["id"])}, {"$inc": {"gold": WIN_GOLD, "stats.live_duel_wins": 1}})
    return await db.live_duels.find_one({"id": m["id"]})


@api.post("/duel/live/queue")
async def live_queue(user=Depends(get_current_user)):
    uid, name = str(user["_id"]), user["username"]
    m = await _active(uid)
    if m:
        return {"state": "matched", "match": _view(await _settle(m), uid)}
    cutoff = _iso(_now() - timedelta(seconds=QUEUE_TTL))
    foe = await db.live_duel_queue.find_one_and_delete({"user_id": {"$ne": uid}, "at": {"$gt": cutoff}}, sort=[("at", 1)])
    if not foe:
        await db.live_duel_queue.update_one({"user_id": uid}, {"$set": {"user_id": uid, "username": name, "at": _iso(_now())}}, upsert=True)
        return {"state": "waiting"}
    await db.live_duel_queue.delete_one({"user_id": uid})
    start = _now() + timedelta(seconds=START_DELAY)
    p = lambda i, n: {"id": i, "username": n, "kg": 0.0, "catches": 0, "best": None}
    m = {"id": uuid.uuid4().hex, "state": "on", "start": _iso(start), "end": _iso(start + timedelta(seconds=DUEL_SECONDS)),
         "players": [p(foe["user_id"], foe["username"]), p(uid, name)], "created_at": _iso(_now())}
    await db.live_duels.insert_one(m)
    return {"state": "matched", "match": _view(m, uid)}


@api.get("/duel/live/state")
async def live_state(user=Depends(get_current_user)):
    uid = str(user["_id"])
    m = await _active(uid)
    if m:
        return {"state": "matched", "match": _view(await _settle(m), uid)}
    q = await db.live_duel_queue.find_one({"user_id": uid, "at": {"$gt": _iso(_now() - timedelta(seconds=QUEUE_TTL))}})
    if q:
        await db.live_duel_queue.update_one({"user_id": uid}, {"$set": {"at": _iso(_now())}})
    return {"state": "waiting" if q else "idle"}


@api.post("/duel/live/leave")
async def live_leave(user=Depends(get_current_user)):
    uid = str(user["_id"])
    await db.live_duel_queue.delete_one({"user_id": uid})
    m = await _active(uid)
    if m and _now() < datetime.fromisoformat(m["start"]):
        raise HTTPException(400, "The duel is about to start")
    if m and _now() >= datetime.fromisoformat(m["end"]):
        await _settle(m)
        await db.live_duels.update_one({"id": m["id"], "players.id": uid}, {"$set": {"players.$.left": True}})
    return {"ok": True}


async def record_catch(user, name: str, weight: float):
    """Called from /fish/land: adds a landed fish to the angler's live duel score."""
    uid, now = str(user["_id"]), _iso(_now())
    m = await db.live_duels.find_one({"players.id": uid, "start": {"$lte": now}, "end": {"$gt": now}})
    if not m:
        return
    await db.live_duels.update_one({"id": m["id"], "players.id": uid}, {"$inc": {"players.$.kg": round(weight, 3), "players.$.catches": 1}})
    me = next(p for p in m["players"] if p["id"] == uid)
    if not me["best"] or weight > me["best"]["kg"]:
        await db.live_duels.update_one({"id": m["id"], "players.id": uid}, {"$set": {"players.$.best": {"name": name, "kg": round(weight, 3)}}})
