"""Weekly and monthly rankings. Catch-based boards read the catch log; counter boards diff against a snapshot taken at the period start."""
from datetime import timedelta

from bson import ObjectId

from fastapi import Depends

from server import look_of, api, db, now, iso, cached, level_from_xp, STARTER_AVATARS, _leaderboards, get_current_user

SNAP_FIELDS = {"xp": "xp", "gold_earned": "stats.gold_earned", "mastery": "stats.mastery_total", "duel_wins": "duel.wins", "tourney": "stats.tournament_wins"}
COUNTER_BOARDS = {"wealth": "gold_earned", "level": "xp", "mastery": "mastery", "duels": "duel_wins", "tournaments": "tourney"}


def period_bounds(period):
    t = now()
    if period == "week":
        start = (t - timedelta(days=t.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        return f"w{start.date().isoformat()}", start, start + timedelta(days=7)
    start = t.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start + timedelta(days=32)).replace(day=1)
    return f"m{start.strftime('%Y-%m')}", start, end


def dig(u, path):
    for k in path.split("."): u = (u or {}).get(k) if isinstance(u, dict) else None
    return u or 0


async def ensure_snapshot(key):
    r = await db.meta.update_one({"key": f"lbsnap:{key}"}, {"$setOnInsert": {"at": iso(now())}}, upsert=True)
    if not r.upserted_id: return
    proj = {p: 1 for p in SNAP_FIELDS.values()}
    docs = [{"period": key, "user_id": str(u["_id"]), **{k: dig(u, p) for k, p in SNAP_FIELDS.items()}} async for u in db.users.find({}, proj)]
    if docs: await db.lb_snap.insert_many(docs)
    await db.lb_snap.create_index("period")
    await db.lb_snap.delete_many({"period": {"$nin": [period_bounds("week")[0], period_bounds("month")[0]]}})


def row(u, value, **extra):
    return {"username": u["username"], "level": level_from_xp(u["xp"])[0], "value": value, "avatar": look_of(u.get("avatar")), "frame": u.get("frame"), **extra}


async def users_by_id(ids):
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    return {str(u["_id"]): u async for u in db.users.find({"_id": {"$in": oids}}, {"username": 1, "xp": 1, "avatar": 1, "frame": 1, "is_guest": 1})}


async def catch_full(start, end):
    m = {"$match": {"caught_at": {"$gte": iso(start), "$lt": iso(end)}}}
    counts = await db.catch_log.aggregate([m, {"$group": {"_id": "$user_id", "n": {"$sum": 1}, "sp": {"$addToSet": "$species_id"}}}]).to_list(None)
    heavy = await db.catch_log.aggregate([m, {"$sort": {"weight": -1}}, {"$group": {"_id": "$user_id", "w": {"$first": "$weight"}, "name": {"$first": "$name"}}}]).to_list(None)
    return {"catches": [(c["_id"], c["n"], {}) for c in counts], "collection": [(c["_id"], len(c["sp"]), {}) for c in counts],
            "heaviest": [(h["_id"], h["w"], {"name": h["name"]}) for h in heavy]}


async def counter_full(key):
    base = {s["user_id"]: s async for s in db.lb_snap.find({"period": key})}
    proj = {p: 1 for p in SNAP_FIELDS.values()}
    out = {b: [] for b in COUNTER_BOARDS}
    async for u in db.users.find({"is_guest": {"$ne": True}}, proj):
        b0 = base.get(str(u["_id"]), {})
        for board, f in COUNTER_BOARDS.items():
            g = dig(u, SNAP_FIELDS[f]) - b0.get(f, 0)
            if g > 0: out[board].append((str(u["_id"]), g, {}))
    return out


async def mentor_full(start, end):
    rows = await db.users.aggregate([
        {"$match": {"referred_at": {"$gte": iso(start), "$lt": iso(end)}, "is_guest": {"$ne": True}, "referral_flag": {"$ne": "same_network"}}},
        {"$group": {"_id": "$referred_by", "count": {"$sum": 1}}}]).to_list(None)
    return [(r["_id"], r["count"], {}) for r in rows if r["_id"]]


async def _period_full(period):
    key, start, end = period_bounds(period)
    await ensure_snapshot(key)
    full = {**await counter_full(key), **await catch_full(start, end), "mentors": await mentor_full(start, end)}
    return {b: sorted(v, key=lambda x: x[1], reverse=True) for b, v in full.items()}, start, end


def period_full(period):
    return cached(f"lbfull:{period}", 30, lambda: _period_full(period))


async def _period_boards(period):
    full, start, end = await period_full(period)
    us = await users_by_id({i for v in full.values() for i, _, _ in v[:15]})
    out = {b: [row(us[i], val, **ex) for i, val, ex in v if i in us][:15] for b, v in full.items()}
    out["period"] = {"key": period, "start": iso(start), "ends": iso(end)}
    return out


ALL_TIME = {"wealth": ("gold", {}), "level": ("xp", {}), "collection": ("stats.species", {}), "heaviest": ("stats.heaviest_kg", {"stats.heaviest_kg": {"$gt": 0}}),
            "catches": ("stats.catches", {}), "mastery": ("stats.mastery_total", {}), "duels": ("duel.wins", {"duel.wins": {"$gt": 0}}),
            "tournaments": ("stats.tournament_wins", {"stats.tournament_wins": {"$gt": 0}})}


async def my_all_time(user):
    out = {}
    for board, (field, flt) in ALL_TIME.items():
        v = dig(user, field)
        if v > 0: out[board] = {"rank": await db.users.count_documents({**flt, field: {"$gt": v}}) + 1, "value": v}
    uid = str(user["_id"])
    mine = await db.users.count_documents({"referred_by": uid, "is_guest": {"$ne": True}, "referral_flag": {"$ne": "same_network"}})
    if mine:
        ahead = await db.users.aggregate([{"$match": {"referred_by": {"$exists": True, "$ne": None}, "is_guest": {"$ne": True}, "referral_flag": {"$ne": "same_network"}}},
                                          {"$group": {"_id": "$referred_by", "c": {"$sum": 1}}}, {"$match": {"c": {"$gt": mine}}}, {"$count": "n"}]).to_list(1)
        out["mentors"] = {"rank": (ahead[0]["n"] if ahead else 0) + 1, "value": mine}
    if user["stats"].get("heaviest_name") and "heaviest" in out: out["heaviest"]["name"] = user["stats"]["heaviest_name"]
    return out


@api.get("/leaderboards/me")
async def leaderboards_me(period: str = "all", user=Depends(get_current_user)):
    if period not in ("week", "month"): return await my_all_time(user)
    full, _, _ = await period_full(period)
    uid, out = str(user["_id"]), {}
    for board, rows in full.items():
        for i, (rid, val, ex) in enumerate(rows):
            if rid == uid:
                out[board] = {"rank": sum(1 for r in rows if r[1] > val) + 1, "value": val, **ex}
                break
    return out


@api.get("/leaderboards/period")
async def leaderboards_period(period: str = "all"):
    if period not in ("week", "month"): return await cached("leaderboards", 30, _leaderboards)
    return await cached(f"leaderboards:{period}", 30, lambda: _period_boards(period))
