"""Leviathans: crew bosses. A giant sea creature surfaces for one crew at a time (each crew rolls its own), and the whole crew hauls it in
over 48 h against a shared distance meter. Every pull costs energy, is a 20-second tension fight, and has a 3 h cooldown per angler."""
import random
from datetime import timedelta

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import (api, db, now, iso, oid, get_current_user, public_user, add_feed, send_system_message, require_admin, validate_fight,
                    GEAR_BY_ID, level_from_xp, logger)

ENERGY = 20
COOLDOWN_H = 3
WINDOW_H = 48
FATHOMS_PER_MEMBER = 200  # ≈ 4–5 average pulls per member incl. drift (of 16 possible in 48 h); solo ≈ 9 pulls
MIN_MEMBERS_SCALE = 2
SPAWN_GAP_DAYS = (7, 7)  # once a week, on the dot
PULL_SECONDS = 20
DRIFT_PCT_PER_H = 0.005  # the leviathan pulls back 0.5% of the total distance every hour; the crew has to out-haul it
PASS_DROP = 0.0005  # 1 in 2,000
POTION_DROP = 0.25
SCRAP_PER_TIER = 3  # Tackle Scrap: 3 × boss tier (1–6) at full share, floored like the rest

LEVIATHANS = [
    {"id": 2001, "name": "The Harbour Kraken", "kind": "colossal kraken, barnacled crimson mantle, arms thick as masts wrapped around a fishing boat", "behavior": "thrasher",
     "min_kg": 4200, "max_kg": 6800, "gold": 15000, "xp": 3000, "pearls": 8, "title": "Krakenhauler",
     "blurb": "It has slept under the harbour mouth since the first quay was laid. When the bells ring at night, it is not the wind."},
    {"id": 2002, "name": "Old Nine-Fathoms", "kind": "gigantic scarred sperm whale bull, pale with age, jaw studded with broken harpoons", "behavior": "sluggish",
     "min_kg": 38000, "max_kg": 52000, "gold": 20000, "xp": 4200, "pearls": 10, "title": "Whalebreaker",
     "blurb": "Every harpoon in its hide has a widow's name. It comes up to breathe once a decade, and takes a boat down when it does."},
    {"id": 2003, "name": "The Maelstrom Serpent", "kind": "titanic sea serpent, storm-green scales, finned crest, coiling out of a whirlpool", "behavior": "runner",
     "min_kg": 9000, "max_kg": 14000, "gold": 27000, "xp": 5500, "pearls": 12, "title": "Serpentwarden",
     "blurb": "Where it turns, the sea turns with it. Ships that sail the ring of foam never sail out again."},
    {"id": 2004, "name": "The Barnacle Queen", "kind": "ancient leatherback turtle the size of an island, shell crusted with coral, kelp and shipwreck timbers", "behavior": "sluggish",
     "min_kg": 26000, "max_kg": 34000, "gold": 34000, "xp": 7000, "pearls": 14, "title": "Queen's Anchor",
     "blurb": "Charts mark her as a reef. Sailors have camped on her back and woken at sea."},
    {"id": 2005, "name": "The Drowned Cathedral", "kind": "abyssal giant squid, ghost-white and enormous, eyes like cathedral windows glowing in black water", "behavior": "diver",
     "min_kg": 6000, "max_kg": 9500, "gold": 45000, "xp": 9000, "pearls": 17, "title": "Bellringer of the Deep",
     "blurb": "Deep-water crews speak of a light below the light. Those who row toward it are not seen again."},
    {"id": 2006, "name": "The Storm Ray", "kind": "vast manta-like storm ray with lightning crawling across its wings, blotting out the sky above a fishing fleet", "behavior": "jumper",
     "min_kg": 12000, "max_kg": 18000, "gold": 60000, "xp": 12000, "pearls": 20, "title": "Stormrider",
     "blurb": "It does not swim in the sea. It swims in the storm, and drags the sea up to meet it."},
]
LEV_BY_ID = {b["id"]: b for b in LEVIATHANS}
BEHAVIORS = {"sluggish": 0.55, "thrasher": 0.9, "runner": 0.8, "diver": 0.75, "jumper": 1.0}


def _crew_id(user):
    c = user.get("crew")
    if not c: raise HTTPException(400, "You need a crew, leviathans are hauled in together")
    return c["id"]


def _distance(members):
    return max(MIN_MEMBERS_SCALE, members) * FATHOMS_PER_MEMBER


def _weight(b, rnd):
    return round(rnd.uniform(b["min_kg"], b["max_kg"]), 1)


async def spawn_for_crew(crew, rnd=None, force_id=None):
    rnd = rnd or random.Random()
    b = LEV_BY_ID.get(force_id) or rnd.choice(LEVIATHANS)
    members = await db.users.count_documents({"crew.id": str(crew["_id"])})
    if members == 0: return None
    t = now()
    doc = {"crew_id": str(crew["_id"]), "crew_name": crew["name"], "crew_tag": crew["tag"], "boss_id": b["id"], "spawned_at": iso(t), "ends_at": iso(t + timedelta(hours=WINDOW_H)), "last_drift_at": iso(t), "drift_total": 0,
           "members_at_spawn": members, "distance_total": _distance(members), "distance_left": _distance(members), "status": "active", "rebalanced_v2": True, "weight": _weight(b, rnd), "contributions": {}}
    await db.crew_bosses.insert_one(doc)
    members = await db.users.find({"crew.id": str(crew["_id"])}, {"_id": 1, "username": 1}).to_list(200)
    for m in members:
        await send_system_message(str(m["_id"]), m["username"], f"{b['name']} has surfaced off your crew's moorings! Your whole crew has {WINDOW_H} hours to haul it in, every pull counts. Open Crews → Crew Boss.")
    await crew_alert(str(crew["_id"]), [str(m["_id"]) for m in members], f"{b['name']} has surfaced!", f"{b['name']} ({doc['weight']:,.0f} kg) is off the moorings, {WINDOW_H} h to haul it in. Pull it in under Crews → Crew Boss.")
    await add_feed("boss", crew["tag"], f"{b['name']} surfaces for crew [{crew['tag']}] {crew['name']}. The haul begins.", "mythic")
    return doc


async def crew_alert(crew_id, user_ids, title, body):
    """Harbourmaster line in the crew chat + push to members who opted into boss alerts."""
    await db.chat.insert_one({"channel": "crew", "crew_id": crew_id, "username": "Harbourmaster", "level": 0, "at": iso(now()), "text": body})
    try:
        from push_notifications import broadcast
        await broadcast(title=title, body=body, url="/game/crews", tag="leviathan", kind="boss", user_ids=user_ids)
    except Exception:
        logger.exception("leviathan push failed")


async def ensure_events():
    """Weekly server-wide surfacing: when the timer runs out every crew gets its own random leviathan; escaped ones are settled.
    Also the one-hour warning: crew chat + push once per event."""
    t = iso(now())
    # one-time: rescale bosses spawned under the old, too-long distance (keeps the share already hauled)
    async for ev in db.crew_bosses.find({"status": "active", "rebalanced_v2": {"$ne": True}}):
        new_total = _distance(ev["members_at_spawn"])
        left = round(new_total * max(0, ev["distance_left"]) / ev["distance_total"])
        await db.crew_bosses.update_one({"_id": ev["_id"], "rebalanced_v2": {"$ne": True}}, {"$set": {"distance_total": new_total, "distance_left": left, "rebalanced_v2": True}})
    async for ev in db.crew_bosses.find({"status": "active", "ends_at": {"$lte": iso(now() + timedelta(hours=1))}, "hour_warned": {"$ne": True}}):
        if not (await db.crew_bosses.update_one({"_id": ev["_id"], "hour_warned": {"$ne": True}}, {"$set": {"hour_warned": True}})).modified_count: continue
        b = LEV_BY_ID[ev["boss_id"]]
        members = await db.users.find({"crew.id": ev["crew_id"]}, {"_id": 1}).to_list(200)
        await crew_alert(ev["crew_id"], [str(m["_id"]) for m in members], f"{b['name']}, one hour left!",
                         f"One hour before {b['name']} slips away, {max(0, round(ev['distance_left'])):,} fathoms still to haul. All hands!")
    # Hourly drift: it drags itself back out (never past the start line, never after it's landed)
    async for ev in db.crew_bosses.find({"status": "active", "distance_left": {"$gt": 0}, "$or": [{"last_drift_at": {"$exists": False}}, {"last_drift_at": {"$lte": iso(now() - timedelta(hours=1))}}]}):
        back = round(ev["distance_total"] * DRIFT_PCT_PER_H)
        gain = min(back, ev["distance_total"] - ev["distance_left"])
        if gain <= 0: await db.crew_bosses.update_one({"_id": ev["_id"]}, {"$set": {"last_drift_at": t}}); continue
        r = await db.crew_bosses.update_one({"_id": ev["_id"], "status": "active", "last_drift_at": ev.get("last_drift_at")}, {"$inc": {"distance_left": gain, "drift_total": gain}, "$set": {"last_drift_at": t}})
        if r.modified_count and gain >= 10:
            await db.chat.insert_one({"channel": "crew", "crew_id": ev["crew_id"], "username": "Harbourmaster", "level": 0, "at": t, "text": f"{LEV_BY_ID[ev['boss_id']]['name']} drags itself {gain} fathoms back out. Keep pulling!"})
    escaped = await db.crew_bosses.find({"status": "active", "ends_at": {"$lte": t}}).to_list(500)
    r = await db.crew_bosses.update_many({"status": "active", "ends_at": {"$lte": t}}, {"$set": {"status": "escaped", "ended_at": t}})
    if r.modified_count: logger.info("%d leviathans escaped", r.modified_count)
    for ev in escaped:
        b = LEV_BY_ID[ev["boss_id"]]
        await db.chat.insert_one({"channel": "crew", "crew_id": ev["crew_id"], "username": "Harbourmaster", "level": 0, "at": t, "text": f"{b['name']} has slipped back into the deep. {max(0, round(ev['distance_left'])):,} fathoms short. Next time, all hands."})
    meta = await db.meta.find_one({"key": "crew_boss_next_spawn"})
    if not meta:
        await db.meta.insert_one({"key": "crew_boss_next_spawn", "at": iso(now() + timedelta(days=random.uniform(*SPAWN_GAP_DAYS)))}); return
    if meta["at"] > t: return
    nxt = iso(now() + timedelta(days=random.uniform(*SPAWN_GAP_DAYS)))
    claim = await db.meta.update_one({"key": "crew_boss_next_spawn", "at": meta["at"]}, {"$set": {"at": nxt}})
    if not claim.modified_count: return
    async for crew in db.crews.find({}, {"name": 1, "tag": 1}):
        if not await db.crew_bosses.find_one({"crew_id": str(crew["_id"]), "status": "active"}): await spawn_for_crew(crew)


def rewards_preview(b):
    return {"gold": b["gold"], "xp": b["xp"], "pearls": b["pearls"], "scrap": _scrap(b), "crate": _crate(b), "title": b["title"], "potion_pct": round(POTION_DROP * 100), "pass_pct": PASS_DROP * 100, "bank_pct": 10}


def _crate(b):
    # every angler who pulled gets one: tiers 1-3 bronze, 4-5 silver, 6 gold
    t = LEVIATHANS.index(b) + 1
    return "crate_gold" if t >= 6 else "crate_silver" if t >= 4 else "crate_bronze"


def _scrap(b):
    return SCRAP_PER_TIER * (LEVIATHANS.index(b) + 1)


def _my(ev, user):
    c = (ev.get("contributions") or {}).get(str(user["_id"]))
    cd = None
    if c and c.get("last_pull_at"):
        from premium import datetime_from
        until = datetime_from(c["last_pull_at"]) + timedelta(hours=COOLDOWN_H)
        if until > now(): cd = iso(until)
    return {"fathoms": (c or {}).get("fathoms", 0), "pulls": (c or {}).get("pulls", 0), "cooldown_until": cd}


def event_out(ev, user=None):
    b = LEV_BY_ID[ev["boss_id"]]
    contribs = sorted(({"username": c["username"], "fathoms": c["fathoms"], "pulls": c["pulls"], "last_pull_at": c.get("last_pull_at")} for c in (ev.get("contributions") or {}).values()), key=lambda x: -x["fathoms"])
    out = {"id": str(ev["_id"]), "boss": {"id": b["id"], "name": b["name"], "blurb": b["blurb"], "behavior": b["behavior"], "title": b["title"], "image": f"/art/leviathans/{b['id']}.webp"},
           "status": ev["status"], "spawned_at": ev["spawned_at"], "ends_at": ev["ends_at"], "ended_at": ev.get("ended_at"), "weight": ev["weight"],
           "distance_total": ev["distance_total"], "distance_left": max(0, round(ev["distance_left"])), "members_at_spawn": ev["members_at_spawn"],
           "contributions": contribs, "rewards": rewards_preview(b), "energy": ENERGY, "cooldown_h": COOLDOWN_H, "pull_seconds": PULL_SECONDS,
           "drift_per_hour": round(ev["distance_total"] * DRIFT_PCT_PER_H), "drift_total": round(ev.get("drift_total", 0))}
    if user: out["me"] = _my(ev, user)
    return out


@api.get("/crew/boss")
async def crew_boss_state(user=Depends(get_current_user)):
    await ensure_events()
    cid = _crew_id(user)
    ev = await db.crew_bosses.find_one({"crew_id": cid, "status": "active"})
    history = await db.crew_bosses.find({"crew_id": cid, "status": {"$in": ["landed", "escaped"]}}, sort=[("ended_at", -1)]).to_list(6)
    return {"event": event_out(ev, user) if ev else None, "history": [event_out(h) for h in history],
            "leviathans": [{"id": b["id"], "name": b["name"], "blurb": b["blurb"], "image": f"/art/leviathans/{b['id']}.webp", "rewards": rewards_preview(b)} for b in LEVIATHANS],
            "energy": ENERGY, "cooldown_h": COOLDOWN_H, "window_h": WINDOW_H}


def pull_params(b, user):
    rod, reel, line = GEAR_BY_ID[user["gear"]["rod"]], GEAR_BY_ID[user["gear"]["reel"]], GEAR_BY_ID[user["gear"]["line"]]
    strength = BEHAVIORS[b["behavior"]]
    return {"strength": round(strength * 1.5, 3), "erratic": round(0.6 + strength * 0.5, 3), "stamina": PULL_SECONDS,
            "zone_width": round(26 * rod["control"], 1), "recovery": reel["recovery"], "tolerance": line["tolerance"],
            "time_limit": PULL_SECONDS, "behavior": b["behavior"], "boss": True, "pull": True, "boss_id": b["id"], "boss_name": b["name"],
            "phase2_at": 60, "phase2_zone": 0.7, "phase2_strength": 1.3,
            "hint": f"The whole crew heaves. {b['name']} fights every fathom, hold the tension for {PULL_SECONDS} seconds."}


@api.post("/crew/boss/pull")
async def start_pull(user=Depends(get_current_user)):
    cid = _crew_id(user)
    ev = await db.crew_bosses.find_one({"crew_id": cid, "status": "active"})
    if not ev: raise HTTPException(400, "No leviathan is surfaced for your crew right now")
    me = _my(ev, user)
    if me["cooldown_until"]: raise HTTPException(400, f"Your arms are spent, next pull at {me['cooldown_until'][11:16]} UTC")
    if user["energy"] < ENERGY: raise HTTPException(400, f"You need {ENERGY} energy to pull")
    key = f"contributions.{user['_id']}"
    # The cooldown starts the moment you take the rope, so a second grab before the first fight is settled is refused too.
    claim = await db.crew_bosses.update_one({"_id": ev["_id"], "status": "active", "$or": [{f"{key}.last_pull_at": {"$exists": False}}, {f"{key}.last_pull_at": {"$lte": iso(now() - timedelta(hours=COOLDOWN_H))}}]},
                                            {"$set": {f"{key}.last_pull_at": iso(now()), f"{key}.username": user["username"]}, "$inc": {f"{key}.fathoms": 0, f"{key}.pulls": 0}})
    if not claim.modified_count: raise HTTPException(400, "Your arms are spent, one pull per three hours")
    r = await db.users.update_one({"_id": user["_id"], "energy": {"$gte": ENERGY}}, {"$inc": {"energy": -ENERGY}})
    if not r.modified_count: raise HTTPException(400, f"You need {ENERGY} energy to pull")
    b = LEV_BY_ID[ev["boss_id"]]
    params = pull_params(b, user)
    pull = {"user_id": str(user["_id"]), "event_id": str(ev["_id"]), "params": params, "at": iso(now()), "status": "open"}
    pid = (await db.crew_boss_pulls.insert_one(pull)).inserted_id
    u = await db.users.find_one({"_id": user["_id"]})
    return {"pull_id": str(pid), "params": params, "user": public_user(u)}


class PullIn(BaseModel):
    pull_id: str
    progress: float = 0
    snapped: bool = False
    elapsed: float = 0
    game_time: float | None = None
    holds: list[list[float]] = []


@api.post("/crew/boss/pull/finish")
async def finish_pull(body: PullIn, user=Depends(get_current_user)):
    pull = await db.crew_boss_pulls.find_one_and_update({"_id": oid(body.pull_id), "user_id": str(user["_id"]), "status": "open"}, {"$set": {"status": "done", "done_at": iso(now())}})
    if not pull: raise HTTPException(404, "That pull is already settled")
    from premium import datetime_from
    age = (now() - datetime_from(pull["at"])).total_seconds()
    progress = max(0.0, min(100.0, body.progress))
    ok, reasons = validate_fight(pull["params"], body.elapsed, body.holds, age, body.game_time)
    if not ok or age > PULL_SECONDS + 90:
        progress = min(progress, 15.0)
        logger.info("leviathan pull flagged for %s: %s", user["username"], reasons)
    fathoms = 30 + 40 * progress / 100
    if body.snapped: fathoms *= 0.5
    fathoms = round(fathoms)
    ev = await db.crew_bosses.find_one({"_id": oid(pull["event_id"]), "status": "active"})
    if not ev: return {"fathoms": 0, "message": "The crew boss is gone.", "event": None}
    key = f"contributions.{user['_id']}"
    ev = await db.crew_bosses.find_one_and_update({"_id": ev["_id"], "status": "active"},
                                                  {"$inc": {"distance_left": -fathoms, f"{key}.fathoms": fathoms, f"{key}.pulls": 1},
                                                   "$set": {f"{key}.username": user["username"]}}, return_document=True)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"stats.leviathan_fathoms": fathoms, "stats.leviathan_pulls": 1}})
    landed = None
    if ev and ev["distance_left"] <= 0: landed = await land(ev)
    msg = f"You hauled {fathoms} fathoms" + (" before the line snapped." if body.snapped else ".") if not landed else f"You hauled the last {fathoms} fathoms. {LEV_BY_ID[ev['boss_id']]['name']} is on the quay!"
    ev = await db.crew_bosses.find_one({"_id": ev["_id"]})
    return {"fathoms": fathoms, "message": msg, "landed": landed, "event": event_out(ev, user)}


async def land(ev):
    r = await db.crew_bosses.update_one({"_id": ev["_id"], "status": "active"}, {"$set": {"status": "landed", "ended_at": iso(now()), "distance_left": 0}})
    if not r.modified_count: return None
    b = LEV_BY_ID[ev["boss_id"]]
    contribs = ev.get("contributions") or {}
    total = sum(c["fathoms"] for c in contribs.values()) or 1
    n = len(contribs)
    drops = []
    for uid, c in contribs.items():
        share = c["fathoms"] / total
        # floor of 35% of the per-angler base for anyone who pulled; the rest scales with contribution
        scale = 0.35 + 0.65 * share * n
        gold, xp, pearls, scrap = round(b["gold"] * scale), round(b["xp"] * scale), max(1, round(b["pearls"] * scale)), max(1, round(_scrap(b) * scale))
        inc = {"gold": gold, "xp": xp, "pearls": pearls, "scrap": scrap, "stats.gold_earned": gold, "stats.pearls_earned": pearls, "stats.leviathans": 1}
        extras = []
        if random.random() < POTION_DROP: inc["items.potion_energy"] = 1; extras.append("an Energy Potion")
        if random.random() < PASS_DROP: inc["items.pass_week"] = 1; extras.append("an Angler Pass · Week"); drops.append(c["username"])
        await db.users.update_one({"_id": oid(uid)}, {"$inc": inc, "$addToSet": {"titles": b["title"]}})
        from crates import maybe_boss_drop, grant_crate
        await grant_crate(uid, c["username"], _crate(b), f"your share of {b['name']}")
        await maybe_boss_drop({"_id": oid(uid), "username": c["username"]}, b["name"], leviathan=True)
        await db.crew_boss_journal.update_one({"user_id": uid, "boss_id": b["id"]}, {"$set": {"username": c["username"], "crew_name": ev["crew_name"], "crew_tag": ev["crew_tag"], "weight": ev["weight"], "at": iso(now()), "fathoms": c["fathoms"]}, "$inc": {"count": 1}}, upsert=True)
        await send_system_message(uid, c["username"], f"{b['name']} ({ev['weight']:,.0f} kg) is on the quay! Your share for {c['fathoms']} fathoms: {gold:,} gold, {xp:,} XP, {pearls} Pearls, {scrap} Tackle Scrap" + (f" and {' and '.join(extras)}!" if extras else ".") + f" Title earned: {b['title']}.")
    bank = round(b["gold"] * 0.10)
    await db.crews.update_one({"_id": oid(ev["crew_id"])}, {"$inc": {"bank": bank, "leviathans": 1}, "$push": {"hall_log": {"$each": [{"who": "The crew", "text": f"landed {b['name']} ({ev['weight']:,.0f} kg): {bank:,} gold to the bank", "at": iso(now())}], "$slice": -50}}})
    await add_feed("boss", ev["crew_tag"], f"Crew [{ev['crew_tag']}] {ev['crew_name']} hauled {b['name']} ({ev['weight']:,.0f} kg) onto the quay after {sum(c['pulls'] for c in contribs.values())} pulls!", "mythic")
    if drops: logger.info("Angler Pass dropped from leviathan for %s", drops)
    return {"name": b["name"], "weight": ev["weight"], "participants": n}


@api.get("/crew/boss/journal")
async def my_leviathan_journal(user=Depends(get_current_user)):
    rows = {r["boss_id"]: r for r in await db.crew_boss_journal.find({"user_id": str(user["_id"])}).to_list(50)}
    return [{"id": b["id"], "name": b["name"], "blurb": b["blurb"], "image": f"/art/leviathans/{b['id']}.webp", "title": b["title"], "min_kg": b["min_kg"], "max_kg": b["max_kg"],
             "caught": b["id"] in rows, **({"weight": rows[b["id"]]["weight"], "at": rows[b["id"]]["at"], "crew": f"[{rows[b['id']]['crew_tag']}] {rows[b['id']]['crew_name']}", "fathoms": rows[b["id"]]["fathoms"], "count": rows[b["id"]].get("count", 1)} if b["id"] in rows else {})}
            for b in LEVIATHANS]


class SpawnIn(BaseModel):
    crew_tag: str | None = None
    boss_id: int | None = None


@api.post("/admin/crew-boss/spawn")
async def admin_spawn(body: SpawnIn, admin=Depends(require_admin)):
    q = {"tag": body.crew_tag} if body.crew_tag else {}
    n = 0
    async for crew in db.crews.find(q, {"name": 1, "tag": 1}):
        if await db.crew_bosses.find_one({"crew_id": str(crew["_id"]), "status": "active"}): continue
        if await spawn_for_crew(crew, force_id=body.boss_id): n += 1
    return {"spawned": n}


@api.post("/admin/crew-boss/cancel")
async def admin_cancel(body: SpawnIn, admin=Depends(require_admin)):
    q = {"status": "active"}
    if body.crew_tag: q["crew_tag"] = body.crew_tag
    r = await db.crew_bosses.update_many(q, {"$set": {"status": "escaped", "ended_at": iso(now())}})
    return {"cancelled": r.modified_count}
