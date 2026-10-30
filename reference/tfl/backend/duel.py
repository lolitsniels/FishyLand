"""Fishing Duel: a 2-minute head-to-head where two anglers fish the same water for points.
Each angler fights with their own rod, reel and line (snapshotted when the duel is made, never worn down), so better gear lands rarer fish and easier fights.
Species mastery adds a few points, no energy per cast, catches never enter the economy. Open to every angler from DUEL_LEVEL."""
import random
from datetime import timedelta
from typing import List, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import (api, db, now, iso, get_current_user, public_user, level_from_xp, pick_species, roll_weight, roll_variant, notify,
                    encounter_params, validate_fight, gear_tier, gear_bonuses, WATER_BY_KEY, MAX_ENERGY, max_energy, energy_cap, DUEL_LEVEL, POTION_ENERGY, POTION_COOLDOWN_H, potion_next_at, uncache)
from game_data import BAIT_BY_ID, GEAR_BY_ID
import duel_ladder
import mastery

DUEL_COST = 5
DUEL_SECONDS = 120
OVERTIME_MAX = 90  # a fish hooked before the buzzer may still be fought; hard cap so nobody stalls the result
ACCEPT_SECONDS = 45
REMATCH_SECONDS = 60
QUEUE_TIMEOUT = 90
CAST_GAP = 0.3
IDLE_FORFEIT = 45
BITE_PCT = 62
BASE_LUCK = 6
MASTERY_PTS = 0.015  # +1.5% duel points per mastery level of the species you land (max +15% at level 10)
POINTS = {"common": 10, "uncommon": 25, "rare": 60, "epic": 120, "legendary": 250, "mythic": 600}
DUEL_GEAR = {"rod": "rod_surf", "reel": "reel_drag", "line": "line_fluoro"}
def has_access(u):
    return level_from_xp(u["xp"])[0] >= DUEL_LEVEL


def duel_rec(u):
    d = u.get("duel") or {}
    return {"access": has_access(u), "wins": d.get("wins", 0), "losses": d.get("losses", 0), "draws": d.get("draws", 0),
            "streak": d.get("streak", 0), "best_streak": d.get("best_streak", 0), "played": d.get("played", 0)}


async def require_duel(user=Depends(get_current_user)):
    if not has_access(user): raise HTTPException(403, f"The duelling pier opens at level {DUEL_LEVEL}")
    return user


def _gear(u):
    enh = u.get("enhance") or {}
    return [{"slot": s, "id": gid, "name": GEAR_BY_ID[gid]["name"], "tier": GEAR_BY_ID[gid].get("tier", 1), "enh": int(enh.get(gid, 0)), "skin": u.get("rod_skin") if s == "rod" else None}
            for s in ("rod", "reel", "line") if (gid := (u.get("gear") or {}).get(s)) in GEAR_BY_ID]


def _kit(p, water):
    """Fight kit from the gear snapshot: full durability, so duels never wear gear and worn gear isn't penalised."""
    g = {x["slot"]: x["id"] for x in p.get("gear") or []}
    return {"gear": {**DUEL_GEAR, **g}, "water": water, "durability": {}, "enhance": {x["id"]: x["enh"] for x in p.get("gear") or []}}


def _player(u):
    return {"username": u["username"], "avatar": u.get("avatar"), "frame": u.get("frame"), "level": level_from_xp(u["xp"])[0], "name_colour_hex": public_user(u)["name_colour_hex"],
            "gear": _gear(u), "score": 0, "weight": 0.0, "landed": 0, "lost": 0, "casts": 0, "status": "idle", "status_text": "Getting ready…", "pending": None,
            "last_cast": None, "last_seen": iso(now())}


async def _refund(uid):
    u = await db.users.find_one({"_id": uid}, {"energy": 1, "premium_until": 1})
    if u: await db.users.update_one({"_id": uid}, {"$set": {"energy": min(energy_cap(u), u["energy"] + DUEL_COST)}})


async def _sweep_queue():
    cutoff = iso(now() - timedelta(seconds=QUEUE_TIMEOUT))
    stale = await db.duel_queue.find({"joined_at": {"$lt": cutoff}}).to_list(50)
    for q in stale:
        if (await db.duel_queue.delete_one({"_id": q["_id"]})).deleted_count:
            await _refund(q["user_id"])
            await _close_queue_alert(q.get("username"))
            await db.duel_notices.insert_one({"user_id": q["user_id"], "text": f"No opponent turned up, your {DUEL_COST} energy has been returned.", "at": iso(now())})


IP_FIELDS = {"last_ip_hash": 1, "reg_ip_hash": 1, "ip_log": 1}


def _ips(u):
    return ({(u or {}).get("last_ip_hash"), (u or {}).get("reg_ip_hash")} | {e.get("h") for e in (u or {}).get("ip_log") or []}) - {None, ""}


def _same_conn(a, b):
    """True if two anglers have shared any recent connection, so they can't farm duels against each other."""
    return bool(_ips(a) & _ips(b))


async def _try_match(user):
    me = await db.duel_queue.find_one({"user_id": user["_id"]})
    if not me: return None
    other, me_u = None, await db.users.find_one({"_id": user["_id"]}, IP_FIELDS)
    async for q in db.duel_queue.find({"user_id": {"$ne": user["_id"]}}).sort("joined_at", 1).limit(25):
        if not _same_conn(me_u, await db.users.find_one({"_id": q["user_id"]}, IP_FIELDS)): other = q; break
    if not other: return None
    # claim both rows atomically-ish: whoever deletes the opponent's row first builds the match
    if not (await db.duel_queue.delete_one({"_id": other["_id"]})).deleted_count: return None
    await db.duel_queue.delete_one({"_id": me["_id"]})
    opp = await db.users.find_one({"_id": other["user_id"]})
    await _close_queue_alert(user["username"]); await _close_queue_alert(opp["username"])
    return await _create_match(user, opp)


async def _create_match(user, opp, rematch=False):
    shared = [w for w in user.get("unlocked_waters", ["millbrook"]) if w in set(opp.get("unlocked_waters", ["millbrook"]))] or ["millbrook"]
    water = random.choice(shared)
    t = now()
    doc = {"status": "pending", "water": water, "water_name": WATER_BY_KEY[water]["name"], "matched_at": iso(t), "accept_by": iso(t + timedelta(seconds=ACCEPT_SECONDS)), "accepted": [],
           "started_at": None, "ends_at": None,
           "order": [str(user["_id"]), str(opp["_id"])], "players": {str(user["_id"]): _player(user), str(opp["_id"]): _player(opp)},
           "log": [{"at": iso(t), "uid": None, "text": (f"Rematch on! Fished at {WATER_BY_KEY[water]['name']}." if rematch else f"Opponent found. The duel will be fished at {WATER_BY_KEY[water]['name']}.")}], "winner": None, "reason": None, "dismissed": []}
    res = await db.duels.insert_one(doc)
    doc["_id"] = res.inserted_id
    if rematch: return await _go_live(doc)
    from push_notifications import broadcast
    await broadcast("Duel: opponent found!", f"{user['username']} vs {opp['username']} at {WATER_BY_KEY[water]['name']}: accept within {ACCEPT_SECONDS} s.", "/game/duel", tag="duel", kind="events", user_ids=[str(user["_id"]), str(opp["_id"])])
    return doc


async def _live_match(uid):
    return await db.duels.find_one({"status": {"$in": ["pending", "live"]}, f"players.{uid}": {"$exists": True}})


async def _cancel(m, blame=None):
    """Pending duel fell through. Whoever accepted goes straight back to the queue (energy already paid); whoever declined forfeits the fee;
    whoever simply missed the popup gets the energy back, a missed popup is not a crime."""
    r = await db.duels.find_one_and_update({"_id": m["_id"], "status": "pending"}, {"$set": {"status": "cancelled", "ended_at": iso(now()), "blame": blame}}, return_document=True)
    if not r: return
    for uid in m["order"]:
        p = m["players"][uid]
        if uid in m.get("accepted", []) and uid != blame:
            await db.duel_queue.insert_one({"user_id": _oid(uid), "username": p["username"], "joined_at": iso(now())})
            await db.duel_notices.insert_one({"user_id": _oid(uid), "text": "Your opponent didn't show, you're back at the front of the queue.", "at": iso(now())})
        elif uid == blame:
            await db.duel_notices.insert_one({"user_id": _oid(uid), "text": f"You declined the duel, the {DUEL_COST} energy entry is forfeit.", "at": iso(now())})
        else:
            await _refund(_oid(uid))
            await notify(uid, f"You missed the duel popup, the {DUEL_COST} energy is back in your pocket. Queue again when you're ready.", "/game/duel")


async def _go_live(m):
    t = now()
    return await db.duels.find_one_and_update({"_id": m["_id"], "status": "pending"}, {"$set": {"status": "live", "started_at": iso(t), "ends_at": iso(t + timedelta(seconds=DUEL_SECONDS))},
                                              "$push": {"log": {"at": iso(t), "uid": None, "text": f"Both anglers ready. The duel begins at {m['water_name']}. Two minutes on the clock."}}}, return_document=True)


async def _finalize(m, reason, forfeiter=None):
    if m["status"] != "live": return m
    a, b = m["order"]
    pa, pb = m["players"][a], m["players"][b]
    how = ""
    if forfeiter: winner = b if forfeiter == a else a
    elif pa["score"] == 0 and pb["score"] == 0: winner = None
    elif pa["score"] != pb["score"]: winner = a if pa["score"] > pb["score"] else b; how = " on points"
    elif pa["weight"] != pb["weight"]: winner = a if pa["weight"] > pb["weight"] else b; how = " on total weight"
    elif pa["lost"] != pb["lost"]: winner = a if pa["lost"] < pb["lost"] else b; how = " on fewer lost fish"
    else: winner = None
    outcomes = {uid: "draw" if winner is None else ("win" if uid == winner else "loss") for uid in (a, b)}
    text = "Time! " if reason == "time" else f"{m['players'][forfeiter]['username']} left the pier. "
    text += ("A draw, nobody landed a fish." if pa["score"] == 0 and pb["score"] == 0 and not forfeiter else "A draw.") if winner is None else f"{m['players'][winner]['username']} wins the duel{how}."
    upd = {"$set": {"status": "done", "winner": winner, "reason": reason, "ended_at": iso(now())}, "$push": {"log": {"at": iso(now()), "uid": None, "text": text}}}
    r = await db.duels.find_one_and_update({"_id": m["_id"], "status": "live"}, upd, return_document=True)
    if r:
        from server import quest_event, check_achievements
        for uid in (a, b):
            outcome = outcomes[uid]
            u = await db.users.find_one({"_id": _oid(uid)}, {"duel": 1})
            d = (u or {}).get("duel") or {}
            streak = d.get("streak", 0) + 1 if outcome == "win" else 0
            field = {"win": "wins", "loss": "losses", "draw": "draws"}[outcome]
            await db.users.update_one({"_id": _oid(uid)}, {"$inc": {"duel.played": 1, f"duel.{field}": 1},
                                                           "$set": {"duel.streak": streak, "duel.best_streak": max(streak, d.get("best_streak", 0))}})
        ladder = {}
        for uid in (a, b):
            ladder[uid] = {"delta": duel_ladder.POINTS_FOR[outcomes[uid]], "milestones": await duel_ladder.record(uid, outcomes[uid])}
            if uid != forfeiter: await quest_event(_oid(uid), "duel", {"n": 1, "won": uid == winner})
            await check_achievements(_oid(uid))
        r = await db.duels.find_one_and_update({"_id": m["_id"]}, {"$set": {"ladder": ladder}}, return_document=True)
    return r or await db.duels.find_one({"_id": m["_id"]})


def _oid(s):
    from bson import ObjectId
    return ObjectId(s)


async def _tick(user):
    """Advance the world for this player: sweep stale queue, matchmake, expire/forfeit matches, touch presence."""
    await _sweep_queue()
    uid = str(user["_id"])
    m = await _live_match(uid) or await _try_match(user)
    if m and m["status"] == "pending":
        if iso(now()) >= m["accept_by"]:
            await _cancel(m)
            return None
        return m
    if m and m["status"] == "live":
        t = now()
        if iso(t) >= m["ends_at"]:
            # Overtime: the buzzer has gone but a fish hooked in time is still being fought, the other angler waits.
            still = any(p.get("pending") for p in m["players"].values())
            if not still or t >= _dt(m["ends_at"]) + timedelta(seconds=OVERTIME_MAX): return await _finalize(m, "time")
        opp = next(k for k in m["order"] if k != uid)
        started = t - timedelta(seconds=IDLE_FORFEIT) > _dt(m["started_at"])
        if started and _dt(m["players"][opp]["last_seen"]) < t - timedelta(seconds=IDLE_FORFEIT): return await _finalize(m, "forfeit", forfeiter=opp)
        await db.duels.update_one({"_id": m["_id"]}, {"$set": {f"players.{uid}.last_seen": iso(t)}})
    return m


def _dt(s):
    from datetime import datetime
    return datetime.fromisoformat(s)


def match_out(m, uid):
    if not m: return None
    ps = {}
    for k, p in m["players"].items():
        q = {kk: v for kk, v in p.items() if kk not in ("pending", "last_seen", "last_cast")}
        q["fighting"] = bool(p.get("pending"))
        ps[k] = q
    mine = m["players"][uid]
    overtime = m["status"] == "live" and iso(now()) >= m["ends_at"]
    return {"id": str(m["_id"]), "status": m["status"], "water": m["water"], "overtime": overtime,
            "waiting_on": ([k for k, p in m["players"].items() if p.get("pending")] if overtime else []), "water_name": m["water_name"], "started_at": m.get("started_at"), "ends_at": m.get("ends_at"),
            "seconds_left": max(0, int((_dt(m["ends_at"]) - now()).total_seconds())) if m["status"] == "live" else 0,
            "accept_seconds": max(0, int((_dt(m["accept_by"]) - now()).total_seconds())) if m["status"] == "pending" else 0, "accepted": m.get("accepted", []),
            "me": uid, "opponent": next(k for k in m["order"] if k != uid), "order": m["order"], "players": ps, "log": m["log"][-30:],
            "winner": m.get("winner"), "reason": m.get("reason"), "ladder": m.get("ladder", {}),
            "rematch": ({**m["rematch"], "seconds": max(0, REMATCH_SECONDS - int((now() - _dt(m["rematch"]["at"])).total_seconds()))} if m.get("rematch") else None),
            "opponent_left": next(k for k in m["order"] if k != uid) in m.get("dismissed", []),
            "encounter": ({"id": str(m["_id"]), **mine["pending"]["params"]} if mine.get("pending") else None)}


@api.get("/duel/state")
async def duel_state(user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await _tick(user)
    if not m:
        m = await db.duels.find_one({"status": "done", f"players.{uid}": {"$exists": True}, "dismissed": {"$ne": uid}}, sort=[("ended_at", -1)])
        m = await _expire_rematch(m)
    q = await db.duel_queue.find_one({"user_id": user["_id"]})
    notices = await db.duel_notices.find({"user_id": user["_id"]}).to_list(5)
    if notices: await db.duel_notices.delete_many({"user_id": user["_id"]})
    u = await db.users.find_one({"_id": user["_id"]})
    return {"record": duel_rec(u), "cost": DUEL_COST, "seconds": DUEL_SECONDS, "queue_timeout": QUEUE_TIMEOUT, "accept_seconds": ACCEPT_SECONDS, "points": POINTS, "level": DUEL_LEVEL,
            "queue": {"waiting": int((now() - _dt(q["joined_at"])).total_seconds()), "others": await db.duel_queue.count_documents({"user_id": {"$ne": user["_id"]}})} if q else None,
            "match": match_out(m, uid), "notices": [n["text"] for n in notices], "ladder": await duel_ladder.ladder_view(u), "user": public_user(u)}


@api.post("/duel/queue")
async def join_queue(user=Depends(require_duel)):
    if await _live_match(str(user["_id"])): raise HTTPException(400, "You're already in a duel")
    if await db.duel_queue.find_one({"user_id": user["_id"]}): raise HTTPException(400, "You're already waiting for an opponent")
    uid = str(user["_id"])
    async for om in db.duels.find({"status": "done", "rematch.by": uid}):
        await _drop_rematch(om, "You joined the queue, so your rematch offer was withdrawn and its energy returned.")
    r = await db.users.update_one({"_id": user["_id"], "energy": {"$gte": DUEL_COST}}, {"$inc": {"energy": -DUEL_COST}})
    if not r.modified_count: raise HTTPException(400, f"A duel costs {DUEL_COST} energy to enter")
    await db.duel_queue.insert_one({"user_id": user["_id"], "username": user["username"], "ip_hash": user.get("last_ip_hash"), "joined_at": iso(now())})
    await _announce_queue(user)
    return await duel_state(user)


async def _announce_queue(user):
    # a quiet pop-up for everyone online, at most once per 10 minutes per angler
    if await db.alerts.find_one({"status": "duel", "username": user["username"], "at": {"$gte": iso(now() - timedelta(minutes=10))}}): return
    await db.alerts.insert_one({"status": "duel", "username": user["username"], "species": "", "weight": 0, "variant": "normal", "rarity": "epic", "water_name": "", "cheers": [],
                                "text": f"{user['username']} is looking for a duel.", "at": iso(now()), "end": iso(now() + timedelta(seconds=QUEUE_TIMEOUT))})
    uncache("alerts_live")


async def _close_queue_alert(username):
    if (await db.alerts.update_many({"status": "duel", "username": username, "end": {"$gt": iso(now())}}, {"$set": {"end": iso(now())}})).modified_count: uncache("alerts_live")


@api.delete("/duel/queue")
async def leave_queue(user=Depends(require_duel)):
    if (await db.duel_queue.delete_one({"user_id": user["_id"]})).deleted_count:
        await _refund(user["_id"]); await _close_queue_alert(user["username"])
    return await duel_state(user)


@api.post("/duel/accept")
async def duel_accept(user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await _tick(user)
    if not m or m["status"] != "pending": raise HTTPException(400, "Nothing to accept, the duel is no longer waiting")
    m = await db.duels.find_one_and_update({"_id": m["_id"], "status": "pending"}, {"$addToSet": {"accepted": uid}, "$set": {f"players.{uid}.last_seen": iso(now())}}, return_document=True)
    if m and len(m.get("accepted", [])) == 2: await _go_live(m)
    return await duel_state(user)


@api.post("/duel/decline")
async def duel_decline(user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await _live_match(uid)
    if not m or m["status"] != "pending": raise HTTPException(400, "Nothing to decline")
    await _cancel(m, blame=uid)
    return await duel_state(user)


@api.post("/duel/cast")
async def duel_cast(user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await _tick(user)
    if not m or m["status"] != "live": raise HTTPException(400, "No duel in progress")
    me = m["players"][uid]
    if me.get("pending"): raise HTTPException(400, "You already have a fish on")
    t = now()
    if iso(t) >= m["ends_at"]: raise HTTPException(400, "Time's up, no more casts")
    if me.get("last_cast") and (t - _dt(me["last_cast"])).total_seconds() < CAST_GAP: raise HTTPException(429, "Easy, let the line settle")
    inc = {f"players.{uid}.casts": 1}
    kit = _kit(me, m["water"])
    if random.randint(1, 100) > BITE_PCT + GEAR_BY_ID.get(kit["gear"]["rod"], {}).get("bite_bonus", 0):
        await db.duels.update_one({"_id": m["_id"]}, {"$inc": inc, "$set": {f"players.{uid}.last_cast": iso(t), f"players.{uid}.status": "missed", f"players.{uid}.status_text": "Cast… nothing bites."}})
        return {"result": "nothing", "message": random.choice(["The line drifts. Nothing bites.", "A nibble... then nothing.", "Your bait comes back untouched."]), "match": match_out(await db.duels.find_one({"_id": m["_id"]}), uid)}
    f = pick_species(m["water"], BASE_LUCK + gear_bonuses(kit)["luck"])
    weight = roll_weight(f)
    variant, _ = roll_variant()
    params = encounter_params(f, weight, kit, variant, m["water"])
    ratio = (weight - f["min_kg"]) / max(0.001, f["max_kg"] - f["min_kg"])
    mj = await db.journal.find_one({"user_id": uid, "species_id": f["id"]}, {"count": 1})
    mlvl = mastery.level_for(f["rarity"], mj["count"] if mj else 0)
    pts = int(round(POINTS[f["rarity"]] * (1 + 0.5 * ratio) * (1.25 if variant != "normal" else 1) * (1 + MASTERY_PTS * mlvl)))
    pending = {"species_id": f["id"], "name": f["name"], "rarity": f["rarity"], "weight": weight, "variant": variant, "points": pts, "mastery": mlvl, "params": params, "hooked_at": iso(t)}
    vtxt = f" {variant}" if variant != "normal" else ""
    await db.duels.update_one({"_id": m["_id"]}, {"$inc": inc, "$set": {f"players.{uid}.last_cast": iso(t), f"players.{uid}.pending": pending, f"players.{uid}.status": "fighting",
                                                                         f"players.{uid}.status_text": f"Fish on, fighting a{vtxt} {f['rarity']} {f['name']} ({weight} kg)"},
                                                  "$push": {"log": {"at": iso(t), "uid": uid, "text": f"{user['username']} hooked a{vtxt} {f['name']} ({weight} kg)", "rarity": f["rarity"]}}})
    return {"result": "hooked", "message": "Fish on!", "encounter": {"id": str(m["_id"]), **params, "name": f["name"], "rarity": f["rarity"], "weight": weight, "points": pts, "mastery": mlvl, "mastery_bonus_pct": round(MASTERY_PTS * mlvl * 100, 1), "species_id": f["id"], "variant": variant},
            "match": match_out(await db.duels.find_one({"_id": m["_id"]}), uid)}


class DuelLandIn(BaseModel):
    success: bool
    elapsed: float = 0
    game_time: Optional[float] = None
    holds: List[List[float]] = []


@api.post("/duel/land")
async def duel_land(body: DuelLandIn, user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await _live_match(uid)
    if not m or m["status"] != "live": raise HTTPException(400, "No duel in progress")
    me = m["players"][uid]
    p = me.get("pending")
    if not p: raise HTTPException(400, "Nothing on the line")
    t = now()
    age = (t - _dt(p["hooked_at"])).total_seconds()
    ok = body.success
    if ok:
        valid, reasons = validate_fight(p["params"], body.elapsed, body.holds, age, body.game_time)
        if not valid: ok = False
    upd = {"$set": {f"players.{uid}.pending": None}}
    if ok:
        upd["$inc"] = {f"players.{uid}.score": p["points"], f"players.{uid}.weight": p["weight"], f"players.{uid}.landed": 1}
        upd["$set"][f"players.{uid}.status"] = "landed"; upd["$set"][f"players.{uid}.status_text"] = f"Landed the {p['name']}: +{p['points']} pts"
        upd["$push"] = {"log": {"at": iso(t), "uid": uid, "text": f"{user['username']} landed the {p['name']} (+{p['points']})", "rarity": p["rarity"], "pts": p["points"]}}
    else:
        upd["$inc"] = {f"players.{uid}.lost": 1}
        upd["$set"][f"players.{uid}.status"] = "lost"; upd["$set"][f"players.{uid}.status_text"] = f"Lost the {p['name']}"
        upd["$push"] = {"log": {"at": iso(t), "uid": uid, "text": f"{user['username']} lost the {p['name']}", "rarity": p["rarity"]}}
    m2 = await db.duels.find_one_and_update({"_id": m["_id"], f"players.{uid}.pending.hooked_at": p["hooked_at"]}, upd, return_document=True)
    if not m2: raise HTTPException(409, "That fight was already settled")
    if iso(t) >= m2["ends_at"]: m2 = await _tick(user) or m2  # last fish of overtime landed → settle the duel right away
    return {"success": ok, "points": p["points"] if ok else 0, "fish": {"name": p["name"], "rarity": p["rarity"], "weight": p["weight"], "variant": p["variant"], "species_id": p["species_id"]}, "match": match_out(m2, uid)}


@api.post("/duel/forfeit")
async def duel_forfeit(user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await _live_match(uid)
    if not m: raise HTTPException(400, "No duel in progress")
    if m["status"] == "pending": await _cancel(m, blame=uid)
    else: await _finalize(m, "forfeit", forfeiter=uid)
    return await duel_state(user)


async def _drop_rematch(m, note_to_requester):
    """Withdraw an open rematch offer and give the requester their entry back."""
    r = await db.duels.find_one_and_update({"_id": m["_id"], "rematch": {"$ne": None}}, {"$set": {"rematch": None}})
    if r and r.get("rematch"):
        by = _oid(r["rematch"]["by"])
        await _refund(by)
        if note_to_requester: await db.duel_notices.insert_one({"user_id": by, "text": note_to_requester, "at": iso(now())})


async def _expire_rematch(m):
    if m and m.get("rematch") and (now() - _dt(m["rematch"]["at"])).total_seconds() > REMATCH_SECONDS:
        await _drop_rematch(m, f"No answer to your rematch, the {DUEL_COST} energy is back.")
        return await db.duels.find_one({"_id": m["_id"]})
    return m


@api.post("/duel/rematch")
async def duel_rematch(user=Depends(require_duel)):
    uid = str(user["_id"])
    m = await db.duels.find_one({"status": "done", f"players.{uid}": {"$exists": True}, "dismissed": {"$ne": uid}}, sort=[("ended_at", -1)])
    if not m: raise HTTPException(400, "There is no duel to rematch")
    m = await _expire_rematch(m)
    opp_id = next(k for k in m["order"] if k != uid)
    if opp_id in m.get("dismissed", []): raise HTTPException(400, "Your opponent has already left the pier")
    ou = await db.users.find_one({"_id": _oid(opp_id)}, IP_FIELDS)
    if _same_conn(user, ou): raise HTTPException(400, "Anglers on the same connection can't duel each other")
    if await _live_match(uid) or await db.duel_queue.find_one({"user_id": user["_id"]}): raise HTTPException(400, "You're already queued or duelling")
    rm = m.get("rematch")
    if rm and rm["by"] == uid: raise HTTPException(400, "Rematch already offered, waiting for your opponent")
    if not (await db.users.update_one({"_id": user["_id"], "energy": {"$gte": DUEL_COST}}, {"$inc": {"energy": -DUEL_COST}})).modified_count:
        raise HTTPException(400, f"A rematch costs {DUEL_COST} energy")
    if rm:  # opponent asked first: accepting starts the duel at once
        if not (await db.duels.update_one({"_id": m["_id"], "rematch.by": opp_id}, {"$set": {"rematch": None}, "$addToSet": {"dismissed": {"$each": [uid, opp_id]}}})).modified_count:
            await _refund(user["_id"]); raise HTTPException(409, "That rematch offer just expired")
        opp = await db.users.find_one({"_id": _oid(opp_id)})
        if _same_conn(user, opp):
            await _refund(user["_id"]); await _refund(opp["_id"]); raise HTTPException(400, "Anglers on the same connection can't duel each other")
        if (await db.duel_queue.delete_one({"user_id": opp["_id"]})).deleted_count: await _refund(opp["_id"])
        if await _live_match(opp_id):
            await _refund(user["_id"]); await _refund(opp["_id"]); raise HTTPException(409, "Your opponent is busy in another duel")
        await _create_match(user, opp, rematch=True)
        await notify(opp_id, f"{user['username']} accepted your rematch. The duel has started!", "/game/duel")
    else:
        r = await db.duels.update_one({"_id": m["_id"], "rematch": {"$in": [None]}}, {"$set": {"rematch": {"by": uid, "username": user["username"], "at": iso(now())}}})
        if not r.modified_count:
            await _refund(user["_id"]); raise HTTPException(409, "Try again")
        await notify(opp_id, f"{user['username']} wants a rematch! Accept within {REMATCH_SECONDS} s ({DUEL_COST} energy).", "/game/duel")
    return await duel_state(user)


@api.post("/duel/dismiss")
async def duel_dismiss(user=Depends(require_duel)):
    uid = str(user["_id"])
    async for m in db.duels.find({"status": "done", f"players.{uid}": {"$exists": True}, "rematch.by": {"$exists": True}}):
        mine = m["rematch"]["by"] == uid
        await _drop_rematch(m, None if mine else f"{user['username']} left the pier, your rematch {DUEL_COST} energy is back.")
    await db.duels.update_many({"status": "done", f"players.{uid}": {"$exists": True}}, {"$addToSet": {"dismissed": uid}})
    return await duel_state(user)


@api.post("/inventory/potion/use")
async def use_potion(user=Depends(get_current_user)):
    """Drink one Energy Potion: +POTION_ENERGY (capped), one per POTION_COOLDOWN_H hours. Guarded on stock and cooldown in the filter."""
    if (user.get("items") or {}).get("potion_energy", 0) < 1: raise HTTPException(400, "You have no Energy Potion")
    nxt = potion_next_at(user)
    if nxt: raise HTTPException(400, f"One potion per hour, the next one can be drunk in {_left(nxt)}")
    if user["energy"] >= energy_cap(user): raise HTTPException(400, f"You've banked the most energy you can ({energy_cap(user)}), save the potion")
    t = now()
    flt = {"_id": user["_id"], "items.potion_energy": {"$gte": 1}, "$or": [{"potion_used_at": {"$exists": False}}, {"potion_used_at": {"$lt": iso(t - timedelta(hours=POTION_COOLDOWN_H))}}]}
    upd = {"$inc": {"items.potion_energy": -1}, "$set": {"potion_used_at": iso(t), "energy": min(energy_cap(user), user["energy"] + POTION_ENERGY), "energy_at": iso(t)}}
    r = await db.users.update_one(flt, upd)
    if not r.modified_count: raise HTTPException(409, "That potion was already drunk")
    u = await db.users.find_one({"_id": user["_id"]})
    return {"user": public_user(u), "gained": u["energy"] - user["energy"]}


def _left(nxt):
    secs = max(0, int((_dt(nxt) - now()).total_seconds()))
    h, m = divmod(secs // 60, 60)
    return f"{h}h {m:02d}m" if h else f"{m} min"
