import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import (api, db, now, iso, online_cutoff, get_current_user, require_admin, public_user, add_feed, validate_fight, level_from_xp, settle_level_up,
                    WATER_BY_KEY, WATERS, GEAR_BY_ID, BEHAVIORS, BOSS_PEARLS)
from bosses_data import BOSSES, BOSS_BY_ID, BOSS_BY_WATER

BOSS_PERIOD = 8 * 3600
BOSS_WINDOW = 30 * 60
BOSS_HOOK_CHANCE = 0.25
CREW_SHARE = 0.10
MAX_BOSS_MOUNTS = 3


def boss_kill_out(k):
    b = BOSS_BY_ID[k["boss_id"]]
    return {"id": str(k["_id"]), "boss_id": b["id"], "name": b["name"], "title": b["title"], "weight": k["weight"], "water": k["water"],
            "water_name": WATER_BY_KEY[k["water"]]["name"], "at": k["at"], "mounted": k.get("mounted", False)}


def scheduled_boss(t):
    ts = t.timestamp()
    k = int(ts // BOSS_PERIOD)
    for kk in (k - 1, k):
        rnd = random.Random(f"boss:{kk}")
        start = kk * BOSS_PERIOD + rnd.uniform(600, BOSS_PERIOD - BOSS_WINDOW - 600)
        b = rnd.choice(BOSSES)
        if start <= ts < start + BOSS_WINDOW:
            s = datetime.fromtimestamp(start, tz=timezone.utc)
            return {"key": f"sched:{kk}", "boss_id": b["id"], "water": b["water"], "start": iso(s), "end": iso(s + timedelta(seconds=BOSS_WINDOW))}
    return None


async def current_boss():
    import halloween
    g = halloween.ghost_spawn()
    if g: return g
    t = iso(now())
    ov = await db.boss_spawns.find_one({"start": {"$lte": t}, "end": {"$gt": t}})
    if ov:
        return {"key": ov["key"], "boss_id": ov["boss_id"], "water": ov["water"], "start": ov["start"], "end": ov["end"]}
    s = scheduled_boss(now())
    if s and await db.boss_cancels.find_one({"key": s["key"]}):
        return None
    return s


def boss_public(spawn):
    if not spawn: return None
    b = BOSS_BY_ID[spawn["boss_id"]]
    return {**spawn, "name": b["name"], "water_name": WATER_BY_KEY[spawn["water"]]["name"], "hook_chance": int(BOSS_HOOK_CHANCE * 100), "gold": b["gold"], "xp": b["xp"], "title": b["title"]}


async def ensure_boss_alert():
    spawn = await current_boss()
    if not spawn: return
    key = f"boss:{spawn['key']}"
    if await db.alerts.find_one({"key": key}): return
    w = WATER_BY_KEY[spawn["water"]]
    b = BOSS_BY_ID[spawn["boss_id"]]
    try:
        await db.alerts.insert_one({"key": key, "username": "Harbourmaster", "water": w["key"], "water_name": w["name"], "status": "boss", "species": None,
                                    "weight": None, "variant": None, "at": spawn["start"], "end": spawn["end"], "cheers": [],
                                    "text": f"Something enormous is stirring at {w['name']}. Brave anglers, cast now, it will not stay long."})
        await add_feed("boss", "Harbourmaster", f"Something enormous is stirring at {w['name']}.", "legendary")
        # Fire-and-forget push to every subscriber, a boss window is short (~20 min).
        import asyncio as _asyncio
        from push_notifications import broadcast as _push_broadcast
        _asyncio.create_task(_push_broadcast(
            title=f"Boss at {w['name']}",
            body=f"{b['name']} is stirring the water. Cast now, it will not stay long.",
            url="/game/fish",
            tag=key,
        ))
        from discord_alerts import post_boss as _discord_boss
        _asyncio.create_task(_discord_boss(b, w["name"], spawn["end"], f"/art/bosses/{b['id']}.webp"))
    except Exception:
        pass


def boss_params(b, weight, user, water_key=None):
    beh = BEHAVIORS[b["behavior"]]
    rod, reel, line = GEAR_BY_ID[user["gear"]["rod"]], GEAR_BY_ID[user["gear"]["reel"]], GEAR_BY_ID[user["gear"]["line"]]
    tier = next(i for i, w in enumerate(WATERS) if w["key"] == (b["water"] or water_key))  # ghost boss has no home water: use the haunted one
    # A boss is a long fight for everyone: gear shortens it only modestly (cane ~40s in-zone, heirloom ~22s).
    stamina = (40 + tier * 3) / (0.55 + 0.45 * rod["power"])
    return {"strength": round(beh["strength"] * 1.4, 3), "erratic": round(beh["erratic"] * 1.15, 3), "stamina": round(stamina, 2),
            "zone_width": round(30 * rod["control"], 1), "recovery": reel["recovery"], "tolerance": line["tolerance"],
            "time_limit": round(stamina * 3.0 + 20, 1), "behavior": b["behavior"],
            "hint": f"THE WATER ERUPTS. {b['name']} has taken your bait! It {beh['desc']}.",
            "boss": True, "boss_id": b["id"], "boss_name": b["name"], "phase2_at": 50, "phase2_zone": 0.65, "phase2_strength": 1.35}


async def try_hook_boss(user, water_key):
    """Called from cast() after a bite. Returns a cast response if the boss took the bait, else None."""
    spawn = await current_boss()
    if not spawn or spawn["water"] != water_key or random.random() >= BOSS_HOOK_CHANCE: return None
    if await db.boss_kills.find_one({"user_id": str(user["_id"]), "spawn_key": spawn["key"]}): return None
    b = BOSS_BY_ID[spawn["boss_id"]]
    w = WATER_BY_KEY[water_key]
    if b.get("ghost"):
        from halloween_data import GHOST_HOOK_CANDLES
        if (await db.ghost_hooks.update_one({"user_id": str(user["_id"]), "spawn_key": spawn["key"]}, {"$setOnInsert": {"at": iso(now())}}, upsert=True)).upserted_id:
            await db.users.update_one({"_id": user["_id"]}, {"$inc": {"candles": GHOST_HOOK_CANDLES, "stats.candles_earned": GHOST_HOOK_CANDLES}})
    weight = round(random.uniform(b["min_kg"], b["max_kg"]), 1)
    params = boss_params(b, weight, user, water_key)
    a = await db.alerts.insert_one({"username": user["username"], "water": w["key"], "water_name": w["name"], "status": "boss_hooked", "species": b["name"],
                                    "weight": None, "variant": None, "at": iso(now()), "cheers": [], "text": f"{user['username']} has hooked {b['name']} at {w['name']}!"})
    enc = {"user_id": str(user["_id"]), "boss_id": b["id"], "spawn_key": spawn["key"], "weight": weight, "water": w["key"], "created_at": iso(now()),
           "params": params, "alert_id": str(a.inserted_id)}
    res = await db.pending.insert_one(enc)
    return {"result": "hooked", "encounter": {"id": str(res.inserted_id), **params}, "message": f"{b['name']} is on the line!", "user": public_user(user), "quests_done": []}


async def land_boss(enc, user, body):
    b = BOSS_BY_ID[enc["boss_id"]]
    w = WATER_BY_KEY[enc["water"]]
    age = (now() - datetime.fromisoformat(enc["created_at"])).total_seconds()
    ok = body.success and age <= enc["params"]["time_limit"] + 60
    fail_msg = f"{b['name']} tore free and sank back into the dark."
    if ok:
        ok, reasons = validate_fight(enc["params"], body.elapsed, body.holds, age, body.game_time)
        if not ok:
            fail_msg = "The line went slack, invalid fight recorded."
        if reasons:
            await db.cheat_log.insert_one({"user_id": str(user["_id"]), "username": user["username"], "species_id": b["id"], "reason": ",".join(reasons), "hard": not ok,
                                           "elapsed": body.elapsed, "game_time": body.game_time, "age": age, "holds": len(body.holds), "at": iso(now())})
    if not ok:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"stats.escaped": 1}})
        await db.alerts.update_one({"_id": ObjectId(enc["alert_id"])}, {"$set": {"status": "boss_lost", "at": iso(now()), "text": f"{user['username']} lost {b['name']} at {w['name']}. It is still out there."}})
        return {"success": False, "species": b["name"], "rarity": "legendary", "boss": True, "message": fail_msg}
    weight = enc["weight"]
    old_level, _ = level_from_xp(user["xp"])
    await db.boss_kills.insert_one({"user_id": str(user["_id"]), "username": user["username"], "boss_id": b["id"], "spawn_key": enc["spawn_key"], "weight": weight,
                                    "water": w["key"], "at": iso(now()), "gold": b["gold"]})
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"gold": b["gold"], "xp": b["xp"], "stats.gold_earned": b["gold"], "stats.boss_kills": 1,
                                                             "pearls": BOSS_PEARLS, "stats.pearls_earned": BOSS_PEARLS},
                                                    "$addToSet": {"titles": b["title"]}, "$max": {"stats.heaviest_boss_kg": weight}})
    if b.get("ghost"):
        from halloween_data import GHOST_CANDLES
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"candles": GHOST_CANDLES, "stats.candles_earned": GHOST_CANDLES}})
    shared = []
    crew = user.get("crew")
    if crew:
        cutoff = online_cutoff()
        mates = await db.users.find({"crew.id": crew["id"], "_id": {"$ne": user["_id"]}, "water": w["key"], "last_seen": {"$gte": cutoff}}, {"username": 1}).to_list(50)
        if mates:
            share = int(b["gold"] * CREW_SHARE)
            await db.users.update_many({"_id": {"$in": [m["_id"] for m in mates]}}, {"$inc": {"gold": share, "stats.gold_earned": share}})
            shared = [m["username"] for m in mates]
            await db.chat.insert_one({"channel": "crew", "crew_id": crew["id"], "username": "Harbourmaster", "level": 0, "at": iso(now()),
                                      "text": f"{user['username']} slew {b['name']}! {', '.join(shared)} each receive {share} gold for standing by at {w['name']}."})
    await add_feed("boss", user["username"], f"{user['username']} slew {b['name']} ({weight} kg) at {w['name']}!", "legendary")
    await db.alerts.update_one({"_id": ObjectId(enc["alert_id"])}, {"$set": {"status": "boss_landed", "weight": weight, "at": iso(now()),
                                                                             "text": f"{user['username']} slew {b['name']} ({weight} kg) at {w['name']}!"}})
    new_level = await settle_level_up(user["_id"], old_level) or old_level
    from crates import maybe_boss_drop, CRATES
    crate = await maybe_boss_drop(user, b["name"])
    u = await db.users.find_one({"_id": user["_id"]})
    return {"success": True, "crate_drop": {"id": crate, "name": CRATES[crate]["name"], "rarity": CRATES[crate]["rarity"]} if crate else None, "boss": {"id": b["id"], "name": b["name"], "weight": weight, "blurb": b["blurb"], "water": w["key"], "gold": b["gold"], "xp": b["xp"],
                                      "title": b["title"], "shared_with": shared},
            "xp": b["xp"], "level_up": new_level if new_level > old_level else None, "user": public_user(u), "quests_done": [], "new_achievements": []}


@api.get("/bosses")
async def bosses(user=Depends(get_current_user)):
    uid = str(user["_id"])
    agg = await db.boss_kills.aggregate([{"$group": {"_id": "$boss_id", "kills": {"$sum": 1}}}]).to_list(20)
    totals = {r["_id"]: r["kills"] for r in agg}
    mine = await db.boss_kills.aggregate([{"$match": {"user_id": uid}}, {"$group": {"_id": "$boss_id", "kills": {"$sum": 1}, "best": {"$max": "$weight"}}}]).to_list(20)
    mine = {r["_id"]: r for r in mine}
    mounted = {k["boss_id"] for k in await db.boss_kills.find({"user_id": uid, "mounted": True}, {"boss_id": 1}).to_list(20)}
    out = []
    for b in BOSSES:
        rec = await db.boss_kills.find_one({"boss_id": b["id"]}, sort=[("weight", -1)])
        me = mine.get(b["id"])
        out.append({"id": b["id"], "name": b["name"], "water": b["water"], "water_name": WATER_BY_KEY[b["water"]]["name"], "blurb": b["blurb"], "behavior": b["behavior"],
                    "min_kg": b["min_kg"], "max_kg": b["max_kg"], "gold": b["gold"], "xp": b["xp"], "title": b["title"], "kills": totals.get(b["id"], 0),
                    "record": {"username": rec["username"], "weight": rec["weight"]} if rec else None,
                    "you": {"kills": me["kills"], "best": me["best"], "mounted": b["id"] in mounted} if me else None})
    last = await db.alerts.find_one({"key": {"$regex": "^boss:"}}, sort=[("at", -1)])
    return {"bosses": out, "active": boss_public(await current_boss()), "window_min": BOSS_WINDOW // 60, "period_h": BOSS_PERIOD // 3600, "hook_chance": int(BOSS_HOOK_CHANCE * 100),
            "last_sighting": {"water_name": last["water_name"], "at": last["at"]} if last else None,
            "mounted": len(mounted), "max_mounts": MAX_BOSS_MOUNTS}


@api.post("/bosses/{boss_id}/mount")
async def mount_boss(boss_id: int, user=Depends(get_current_user)):
    uid = str(user["_id"])
    best = await db.boss_kills.find_one({"user_id": uid, "boss_id": boss_id}, sort=[("weight", -1)])
    if not best: raise HTTPException(404, "You have not slain that boss")
    if best.get("mounted"): raise HTTPException(400, "Already mounted")
    n = await db.boss_kills.count_documents({"user_id": uid, "mounted": True, "boss_id": {"$ne": boss_id}})
    if n >= MAX_BOSS_MOUNTS: raise HTTPException(400, f"Your wall only holds {MAX_BOSS_MOUNTS} boss plaques, take one down first")
    await db.boss_kills.update_many({"user_id": uid, "boss_id": boss_id}, {"$set": {"mounted": False}})
    await db.boss_kills.update_one({"_id": best["_id"]}, {"$set": {"mounted": True, "mounted_at": iso(now())}})
    b = BOSS_BY_ID[boss_id]
    await add_feed("trophy", user["username"], f"{user['username']} mounted {b['name']} ({best['weight']} kg) on a gold plaque.", "legendary")
    return {"ok": True, "trophy": boss_kill_out({**best, "mounted": True})}


@api.post("/bosses/{boss_id}/unmount")
async def unmount_boss(boss_id: int, user=Depends(get_current_user)):
    r = await db.boss_kills.update_many({"user_id": str(user["_id"]), "boss_id": boss_id, "mounted": True}, {"$set": {"mounted": False}})
    if r.modified_count == 0: raise HTTPException(404, "That boss is not on your wall")
    return {"ok": True}


class SpawnIn(BaseModel):
    water: str
    minutes: int = Field(default=20, ge=1, le=180)


@api.post("/admin/boss/spawn")
async def admin_spawn_boss(body: SpawnIn, admin=Depends(require_admin)):
    b = BOSS_BY_WATER.get(body.water)
    if not b: raise HTTPException(400, "Unknown water")
    t = now()
    key = f"admin:{int(t.timestamp())}"
    await db.boss_spawns.insert_one({"key": key, "boss_id": b["id"], "water": b["water"], "start": iso(t), "end": iso(t + timedelta(minutes=body.minutes)), "by": admin["username"]})
    await db.admin_log.insert_one({"admin": admin["username"], "target": b["name"], "changes": [f"spawned boss at {WATER_BY_KEY[b['water']]['name']} for {body.minutes} min"], "at": iso(t)})
    await ensure_boss_alert()
    return boss_public(await current_boss())


@api.post("/admin/boss/cancel")
async def admin_cancel_boss(admin=Depends(require_admin)):
    spawn = await current_boss()
    if not spawn: raise HTTPException(400, "No boss is currently active")
    t = now()
    # Only admin-created spawns can be ended by editing boss_spawns; scheduled spawns are ended via boss_cancels marker.
    if spawn["key"].startswith("admin:"):
        await db.boss_spawns.update_one({"key": spawn["key"]}, {"$set": {"end": iso(t)}})
    else:
        await db.boss_cancels.insert_one({"key": spawn["key"], "at": iso(t), "by": admin["username"]})
    # Close the linked alert so the harbour banner disappears.
    b = BOSS_BY_ID[spawn["boss_id"]]
    w = WATER_BY_KEY[spawn["water"]]
    await db.alerts.update_many({"key": f"boss:{spawn['key']}", "status": "boss"},
                                 {"$set": {"status": "boss_ended", "end": iso(t), "text": f"The stirring at {w['name']} has passed. {b['name']} slipped back into the deep."}})
    await db.admin_log.insert_one({"admin": admin["username"], "target": b["name"], "changes": [f"cancelled boss window at {w['name']}"], "at": iso(t), "action": "boss_cancel"})
    return {"ok": True}
