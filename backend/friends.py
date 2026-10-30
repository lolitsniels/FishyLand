from datetime import timedelta

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, oid, get_current_user, ONLINE_MINUTES as ONLINE_MIN, level_from_xp, WATER_BY_KEY

FRIEND_LUCK = 3
BASE_FRIEND_SLOTS = 10
FRIEND_SLOT_PACK = 5
FRIEND_SLOT_PACK_COST = 15  # Pearls per +5 slots
MAX_FRIEND_SLOTS = 100


def friend_slots(u):
    return BASE_FRIEND_SLOTS + int(u.get("extra_friend_slots") or 0)


async def friend_count(uid):
    return await db.friends.count_documents({"pair": uid, "status": "accepted"})


async def ensure_slot(u, who="Your"):
    """Existing friends over the cap are kept; only *new* friendships need a free slot."""
    uid = str(u["_id"])
    have, slots = await friend_count(uid), friend_slots(u)
    if have >= slots:
        raise HTTPException(400, f"{who} friend list is full ({have}/{slots})." + (" More slots are sold in the Pearl Shop." if who == "Your" else ""))


class NameIn(BaseModel):
    username: str = Field(min_length=1, max_length=24)


def _pair(a, b):
    return sorted([a, b])


async def friend_ids(uid):
    rows = await db.friends.find({"pair": uid, "status": "accepted"}, {"pair": 1}).to_list(500)
    return [p for r in rows for p in r["pair"] if p != uid]


async def friends_here(user):
    ids = await friend_ids(str(user["_id"]))
    if not ids: return []
    cutoff = iso(now() - timedelta(minutes=ONLINE_MIN))
    rows = await db.users.find({"_id": {"$in": [ObjectId(i) for i in ids]}, "water": user["water"], "last_seen": {"$gte": cutoff}}, {"username": 1}).to_list(50)
    return [r["username"] for r in rows]


async def friend_luck(user):
    return FRIEND_LUCK if await friends_here(user) else 0


@api.get("/friends")
async def friends(user=Depends(get_current_user)):
    uid = str(user["_id"])
    rows = await db.friends.find({"pair": uid}).to_list(500)
    acc_ids = [p for r in rows if r["status"] == "accepted" for p in r["pair"] if p != uid]
    cutoff = iso(now() - timedelta(minutes=ONLINE_MIN))
    users = await db.users.find({"_id": {"$in": [ObjectId(i) for i in acc_ids]}}, {"username": 1, "xp": 1, "water": 1, "last_seen": 1, "crew": 1}).to_list(500)
    fl = [{"username": u["username"], "level": level_from_xp(u["xp"])[0], "water": u["water"], "water_name": WATER_BY_KEY[u["water"]]["name"],
           "online": u["last_seen"] >= cutoff, "last_seen": u["last_seen"], "tag": (u.get("crew") or {}).get("tag")} for u in users]
    fl.sort(key=lambda f: (not f["online"], f["username"].lower()))
    found = {str(u["_id"]) for u in users}
    for r in rows:  # friends whose account was deleted or swept: keep them listed so they can be removed (they still use a slot)
        if r["status"] != "accepted": continue
        other = next(p for p in r["pair"] if p != uid)
        if other not in found:
            fl.append({"username": r["to_name"] if r["from_id"] == uid else r["from_name"], "level": 0, "water": None, "water_name": "account gone", "online": False, "last_seen": None, "tag": None, "ghost": True})
    incoming = [{"id": str(r["_id"]), "username": r["from_name"], "created_at": r["created_at"]} for r in rows if r["status"] == "pending" and r["from_id"] != uid]
    outgoing = [{"id": str(r["_id"]), "username": r["to_name"], "created_at": r["created_at"]} for r in rows if r["status"] == "pending" and r["from_id"] == uid]
    here = [f["username"] for f in fl if f["online"] and f["water"] == user["water"]]
    return {"friends": fl, "incoming": incoming, "outgoing": outgoing, "here": here, "luck_bonus": FRIEND_LUCK if here else 0, "luck_per": FRIEND_LUCK,
            "slots": friend_slots(user), "count": await friend_count(uid)}


@api.get("/friends/status/{username}")
async def friend_status(username: str, user=Depends(get_current_user)):
    other = await db.users.find_one({"username_lc": username.lower()}, {"_id": 1})
    if not other: raise HTTPException(404, "No such angler")
    uid, oth = str(user["_id"]), str(other["_id"])
    have, slots = await friend_count(uid), friend_slots(user)
    cap = {"count": have, "slots": slots, "full": have >= slots}
    r = await db.friends.find_one({"pair": _pair(uid, oth), "status": {"$in": ["pending", "accepted"]}})
    if not r: return {"state": "none", "id": None, **cap}
    if r["status"] == "accepted": return {"state": "friends", "id": str(r["_id"]), **cap}
    return {"state": "outgoing" if r["from_id"] == uid else "incoming", "id": str(r["_id"]), **cap}


@api.post("/friends/request")
async def friend_request(body: NameIn, user=Depends(get_current_user)):
    other = await db.users.find_one({"username_lc": body.username.strip().lower()})
    if not other: raise HTTPException(404, "No such angler")
    if other["_id"] == user["_id"]: raise HTTPException(400, "You are already your own best friend")
    uid, oth = str(user["_id"]), str(other["_id"])
    pair = _pair(uid, oth)
    existing = await db.friends.find_one({"pair": pair, "status": {"$in": ["pending", "accepted"]}})
    if existing and existing["status"] == "accepted": raise HTTPException(400, f"You and {other['username']} are already friends")
    await ensure_slot(user)
    if existing:
        if existing["from_id"] == uid: raise HTTPException(400, "Request already sent")
        await ensure_slot(other, f"{other['username']}'s")
        await db.friends.update_one({"_id": existing["_id"]}, {"$set": {"status": "accepted", "accepted_at": iso(now())}})
        return {"ok": True, "state": "friends"}
    await db.friends.delete_many({"pair": pair})
    doc = {"pair": pair, "from_id": uid, "from_name": user["username"], "to_id": oth, "to_name": other["username"], "status": "pending", "created_at": iso(now())}
    res = await db.friends.insert_one(doc)
    return {"ok": True, "state": "outgoing", "id": str(res.inserted_id)}


@api.post("/friends/{req_id}/accept")
async def friend_accept(req_id: str, user=Depends(get_current_user)):
    req = await db.friends.find_one({"_id": oid(req_id), "to_id": str(user["_id"]), "status": "pending"})
    if not req: raise HTTPException(404, "No such request")
    await ensure_slot(user)
    sender = await db.users.find_one({"_id": ObjectId(req["from_id"])}, {"extra_friend_slots": 1})
    if sender: await ensure_slot(sender, f"{req['from_name']}'s")
    r = await db.friends.update_one({"_id": req["_id"], "status": "pending"}, {"$set": {"status": "accepted", "accepted_at": iso(now())}})
    if r.matched_count == 0: raise HTTPException(404, "No such request")
    return {"ok": True}


@api.post("/friends/{req_id}/decline")
async def friend_decline(req_id: str, user=Depends(get_current_user)):
    r = await db.friends.delete_one({"_id": oid(req_id), "pair": str(user["_id"]), "status": "pending"})
    if r.deleted_count == 0: raise HTTPException(404, "No such request")
    return {"ok": True}


@api.post("/friends/buy-slots")
async def buy_friend_slots(user=Depends(get_current_user)):
    from server import charge, public_user
    cur = int(user.get("extra_friend_slots") or 0)
    if BASE_FRIEND_SLOTS + cur + FRIEND_SLOT_PACK > MAX_FRIEND_SLOTS: raise HTTPException(400, f"You already have the maximum of {MAX_FRIEND_SLOTS} friend slots")
    if user.get("pearls", 0) < FRIEND_SLOT_PACK_COST: raise HTTPException(400, f"You need {FRIEND_SLOT_PACK_COST} Pearls for {FRIEND_SLOT_PACK} more friend slots")
    await charge(user, {"$inc": {"extra_friend_slots": FRIEND_SLOT_PACK}}, pearls=FRIEND_SLOT_PACK_COST,
                 extra={"$or": [{"extra_friend_slots": {"$exists": False}}, {"extra_friend_slots": cur}]}, msg="Purchase failed, refresh and try again")
    fresh = await db.users.find_one({"_id": user["_id"]})
    return {"user": public_user(fresh), "slots": friend_slots(fresh)}


@api.post("/friends/remove")
async def friend_remove(body: NameIn, user=Depends(get_current_user)):
    uid = str(user["_id"])
    other = await db.users.find_one({"username_lc": body.username.strip().lower()}, {"_id": 1})
    if other: r = await db.friends.delete_many({"pair": _pair(uid, str(other["_id"]))})
    else: r = await db.friends.delete_many({"pair": uid, "$or": [{"from_name": body.username.strip()}, {"to_name": body.username.strip()}]})  # account deleted/swept
    if r.deleted_count == 0: raise HTTPException(404, "You are not friends")
    return {"ok": True}
