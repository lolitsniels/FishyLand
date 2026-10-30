"""Tournaments: scheduled, buy-in contests. One every 3 h, alternating gold and Pearls (1–2 h long, so there is always a breather between them); buy-in opens 1 h before the start.
The fee is a fee, every entrant is paid for their own score (rate per unit, scaled by the buy-in, hard-capped), plus podium bonuses for the top three."""
import hashlib
from datetime import timedelta

from bson import ObjectId
from fastapi import Depends, HTTPException

from server import api, db, now, iso, get_current_user, public_user, cached, send_system_message, add_feed, check_achievements, notify, _contest_pipe, STARTER_AVATARS

CATS = {"catches": {"label": "Most Catches", "unit": "catches", "desc": "Land the most fish, any size."},
        "heaviest": {"label": "Biggest Catch", "unit": "kg", "desc": "One fish, the heaviest on the board wins."},
        "smallest": {"label": "Smallest Catch", "unit": "kg", "desc": "One fish, the lightest on the board wins. Yes, really.", "retired": True},
        "species": {"label": "Most Species", "unit": "species", "desc": "Land the most different species."},
        "rarity": {"label": "Rarity Points", "unit": "pts", "desc": "Points per fish by rarity: common 1 · uncommon 3 · rare 8 · epic 20 · legendary 50 · mythic 120."},
        "weight": {"label": "Heaviest Total", "unit": "kg", "desc": "The combined weight of everything you land."},
        "variants": {"label": "Most Variants", "unit": "variants", "desc": "Land the most variant fish (albino, giant, golden…)."}}
CAT_KEYS = [k for k, v in CATS.items() if not v.get("retired")]
FEES = {"gold": [250, 500, 1000], "pearls": [2, 3, 5]}
DURATIONS_H = [1, 2]
SIGNUP_H = 1
REMIND_MIN = 10
MIN_ENTRANTS = 3
GOLD_HOURS = [0, 6, 12, 18]
PEARL_HOURS = [3, 9, 15, 21]
# Pay per unit at the top buy-in (1000 gold / 5 Pearls); lower buy-ins scale down linearly. Every angler is paid for their own score.
RATES = {"catches": {"gold": 60, "pearls": 0.2}, "weight": {"gold": 30, "pearls": 0.08}, "heaviest": {"gold": 300, "pearls": 0.8},
         "species": {"gold": 240, "pearls": 0.6}, "variants": {"gold": 400, "pearls": 1.0}, "rarity": {"gold": 40, "pearls": 0.1}, "smallest": {"gold": 0, "pearls": 0}}
CAP_MULT_GOLD = 10   # gold payout per angler is capped at 10× the buy-in
CAP_PEARLS = 10      # hard cap per angler in Pearl tournaments, meant to be hard to reach
PODIUM_BONUS = {"gold": ("pearls", [3, 2, 1]), "pearls": ("gold", [2000, 1000, 500])}  # the other currency for 1st/2nd/3rd
CHAMPION_TITLE = "Tournament Champion"


def _seed(start, salt):
    return int(hashlib.sha256(f"{iso(start)}:{salt}".encode()).hexdigest()[:8], 16)


def slot_spec(currency, start):
    """Everything about a scheduled tournament follows from its start time, so every server and every angler agree."""
    fee = FEES[currency][_seed(start, "fee") % 3]
    hours = DURATIONS_H[_seed(start, "dur") % 2]
    cat = CAT_KEYS[_seed(start, "cat") % len(CAT_KEYS)]
    return {"currency": currency, "fee": fee, "hours": hours, "category": cat, "start": iso(start), "end": iso(start + timedelta(hours=hours)), "signup_at": iso(start - timedelta(hours=SIGNUP_H))}


def slots(currency, t, back_h=12, ahead_h=30):
    hours = GOLD_HOURS if currency == "gold" else PEARL_HOURS
    day = t.replace(hour=0, minute=0, second=0, microsecond=0)
    out = []
    for d in (-1, 0, 1, 2):
        for h in hours:
            s = day + timedelta(days=d, hours=h)
            if t - timedelta(hours=back_h) <= s <= t + timedelta(hours=ahead_h): out.append(s)
    return out


def rate_for(sp):
    cur = sp["currency"]
    return round(RATES[sp["category"]][cur] * sp["fee"] / FEES[cur][-1], 3)


def cap_for(sp):
    return sp["fee"] * CAP_MULT_GOLD if sp["currency"] == "gold" else CAP_PEARLS


def payout(sp, value):
    if not value: return 0
    return int(min(cap_for(sp), rate_for(sp) * float(value)))


def spec_out(sp):
    c = CATS[sp["category"]]
    other, bonus = PODIUM_BONUS[sp["currency"]]
    return {**sp, "label": c["label"], "unit": c["unit"], "desc": c["desc"], "icon": f"/art/tournaments/{sp['category']}.webp",
            "rate": rate_for(sp), "cap": cap_for(sp), "podium_currency": other, "podium": bonus, "min_entrants": MIN_ENTRANTS, "title": CHAMPION_TITLE}


async def announce_signup(sp):
    """Buy-in just opened: toast everyone online (with a button to the board) and push to phones that opted in."""
    from push_notifications import broadcast
    label = CATS[sp["category"]]["label"]
    text = f"Buy-in is open for the {label} tournament: {sp['fee']} {sp['currency']}, {sp['hours']}h, starts {sp['start'][11:16]} UTC."
    online = await db.users.find({"last_seen": {"$gte": iso(now() - timedelta(minutes=30))}}, {"_id": 1}).to_list(3000)
    if online:
        await db.notices.insert_many([{"user_id": str(u["_id"]), "text": text, "url": "/game/tournaments", "label": "To the tournament", "at": iso(now())} for u in online])
    await broadcast("Tournament buy-in open", text, "/game/tournaments", tag="tournament-signup", kind="tournaments")


async def ensure_tournaments():
    t = now()
    for cur in ("gold", "pearls"):
        for s in slots(cur, t):
            sp = slot_spec(cur, s)
            if sp["signup_at"] <= iso(t) < sp["start"] and not await db.tournaments.find_one({"currency": cur, "start": sp["start"]}):
                await db.tournaments.insert_one({**sp, "status": "signup", "entrants": [], "results": [], "created_at": iso(t)})
                await announce_signup(sp)
    for tr in await db.tournaments.find({"status": "signup", "reminded": {"$ne": True}, "start": {"$lte": iso(t + timedelta(minutes=REMIND_MIN))}}).to_list(20):
        r = await db.tournaments.update_one({"_id": tr["_id"], "reminded": {"$ne": True}}, {"$set": {"reminded": True}})
        if r.modified_count:
            label = CATS[tr["category"]]["label"]
            for e in tr["entrants"]:
                await notify(e["user_id"], f"Your {label} tournament starts in {REMIND_MIN} minutes ({tr['start'][11:16]} UTC). Get to your water.", "/game/tournaments", "Tournament starting soon")
    for tr in await db.tournaments.find({"status": "signup", "start": {"$lte": iso(t)}}).to_list(20):
        await (start_tournament(tr) if len(tr["entrants"]) >= MIN_ENTRANTS else cancel_tournament(tr))
    for tr in await db.tournaments.find({"status": "live", "end": {"$lte": iso(t)}}).to_list(20):
        await close_tournament(tr)


async def start_tournament(tr):
    r = await db.tournaments.update_one({"_id": tr["_id"], "status": "signup"}, {"$set": {"status": "live"}})
    if not r.modified_count: return
    label = CATS[tr["category"]]["label"]
    for e in tr["entrants"]:
        await send_system_message(e["user_id"], e["username"], f"The {label} tournament has started: {len(tr['entrants'])} anglers, {tr['hours']} hours. Every fish you land from now until {tr['end'][11:16]} UTC counts. Tight lines!")
        await notify(e["user_id"], f"The {label} tournament is LIVE: {tr['hours']} hours, every fish counts until {tr['end'][11:16]} UTC.", "/game/tournaments", "Tournament live")
    await add_feed("tournament", "Harbourmaster", f"The {label} tournament is under way with {len(tr['entrants'])} anglers. {tr['hours']} hours on the clock.", "rare")


async def cancel_tournament(tr):
    r = await db.tournaments.update_one({"_id": tr["_id"], "status": "signup"}, {"$set": {"status": "cancelled"}})
    if not r.modified_count: return
    label = CATS[tr["category"]]["label"]
    for e in tr["entrants"]:
        await db.users.update_one({"_id": ObjectId(e["user_id"]), "tournament_ticket": str(tr["_id"])}, {"$inc": {tr["currency"]: tr["fee"]}, "$unset": {"tournament_ticket": ""}})
        await send_system_message(e["user_id"], e["username"], f"The {label} tournament was called off, fewer than {MIN_ENTRANTS} anglers bought in. Your {tr['fee']} {tr['currency']} are back in your pocket.")


def _pipe(tr):
    ids = [e["user_id"] for e in tr["entrants"]]
    if tr["category"] == "smallest":
        pipe = _contest_pipe("heaviest", tr["start"], tr["end"])
        pipe[2] = {"$sort": {"weight": 1}}
    else:
        pipe = _contest_pipe(tr["category"], tr["start"], tr["end"])
    pipe.insert(2, {"$match": {"who": {"$in": ids}}})
    return pipe


async def standings(tr):
    rows = await db.catch_log.aggregate(_pipe(tr) + [{"$sort": {"value": 1 if tr["category"] == "smallest" else -1, "username": 1}}, {"$limit": 50}]).to_list(50)
    looks = {str(u["_id"]): u async for u in db.users.find({"_id": {"$in": [ObjectId(r["_id"]) for r in rows if ObjectId.is_valid(r["_id"])]}}, {"avatar": 1, "frame": 1})}
    out = []
    for r in rows:
        v = r["value"]
        if isinstance(v, float): v = round(v, 3 if tr["category"] == "smallest" else 2)
        u = looks.get(r["_id"], {})
        out.append({"user_id": r["_id"], "username": r["username"], "value": v, "name": r.get("name"), "rarity": r.get("rarity"), "avatar": u.get("avatar") or STARTER_AVATARS[0], "frame": u.get("frame")})
    for s in out:
        s["reward"] = payout(tr, s["value"])
    return out


async def close_tournament(tr):
    r = await db.tournaments.update_one({"_id": tr["_id"], "status": "live"}, {"$set": {"status": "closing"}})
    if not r.modified_count: return
    rows = await standings(tr)
    cur = tr["currency"]
    other, bonus = PODIUM_BONUS[cur]
    label, unit = CATS[tr["category"]]["label"], CATS[tr["category"]]["unit"]
    results = []
    for i, s in enumerate(rows):
        reward = s["reward"]
        extra = bonus[i] if i < 3 else 0
        inc = {cur: reward, f"stats.{'gold' if cur == 'gold' else 'pearls'}_earned": reward}
        if extra: inc[other] = extra; inc[f"stats.{'gold' if other == 'gold' else 'pearls'}_earned"] = extra
        if i == 0: inc["stats.contest_wins"] = 1; inc["stats.tournament_wins"] = 1
        upd = {"$inc": inc, "$unset": {"tournament_ticket": ""}}
        if i == 0: upd["$addToSet"] = {"titles": CHAMPION_TITLE}
        await db.users.update_one({"_id": ObjectId(s["user_id"])}, upd)
        results.append({**s, "place": i + 1, "reward": reward, "bonus": extra})
        place = ["1st", "2nd", "3rd"][i] if i < 3 else f"{i + 1}th"
        bits = [f"{reward} {cur}"] + ([f"{extra} {other}"] if extra else []) + ([f'the title "{CHAMPION_TITLE}"'] if i == 0 else [])
        capped = " (capped)" if reward >= cap_for(tr) else ""
        await send_system_message(s["user_id"], s["username"], f"{label} tournament over, you finished {place} of {len(tr['entrants'])} with {s['value']} {unit}. Reward: {' + '.join(bits)}{capped}.")
        if i == 0:
            await add_feed("tournament", s["username"], f"{s['username']} won the {label} tournament with {s['value']} {unit} and takes the title \"{CHAMPION_TITLE}\".", "legendary")
            await check_achievements(ObjectId(s["user_id"]))
    from crates import tournament_crates
    await tournament_crates(rows, len(tr["entrants"]), label)
    scored = {s["user_id"] for s in rows}
    for e in tr["entrants"]:
        if e["user_id"] in scored: continue
        await db.users.update_one({"_id": ObjectId(e["user_id"])}, {"$unset": {"tournament_ticket": ""}})
        await send_system_message(e["user_id"], e["username"], f"{label} tournament over, you didn't land anything that counted, so no reward this time. The fee stays in the harbour's coffers.")
    await db.tournaments.update_one({"_id": tr["_id"]}, {"$set": {"status": "closed", "results": results, "closed_at": iso(now())}})


def tr_out(tr, uid):
    return {**spec_out({k: tr[k] for k in ("currency", "fee", "hours", "category", "start", "end", "signup_at")}), "id": str(tr["_id"]), "status": tr["status"],
            "entrants": [{"username": e["username"], "avatar": e.get("avatar")} for e in tr["entrants"]], "joined": any(e["user_id"] == uid for e in tr["entrants"]), "results": tr.get("results", [])}


@api.get("/tournaments")
async def tournaments(user=Depends(get_current_user)):
    await ensure_tournaments()
    uid = str(user["_id"])
    t = now()
    active = await db.tournaments.find({"status": {"$in": ["signup", "live"]}}).sort("start", 1).to_list(10)
    out = []
    for tr in active:
        o = tr_out(tr, uid)
        if tr["status"] == "live": o["standings"] = await cached(f"tournament:{tr['_id']}", 15, lambda tr=tr: standings(tr))
        out.append(o)
    stored = {(tr["currency"], tr["start"]) for tr in active}
    upcoming = sorted([spec_out(slot_spec(c, s)) for c in ("gold", "pearls") for s in slots(c, t, back_h=0, ahead_h=30) if (c, iso(s)) not in stored and s > t], key=lambda x: x["start"])[:4]
    past = await db.tournaments.find({"status": {"$in": ["closed", "cancelled"]}}).sort("end", -1).limit(8).to_list(8)
    fresh = await db.users.find_one({"_id": user["_id"]}, {"tournament_ticket": 1})  # the tick above may just have closed this angler's tournament
    return {"active": out, "upcoming": upcoming, "past": [{**tr_out(tr, uid), "results": tr.get("results", [])[:5]} for tr in past],
            "my_ticket": (fresh or {}).get("tournament_ticket"), "rules": {"signup_h": SIGNUP_H, "min_entrants": MIN_ENTRANTS, "fees": FEES, "durations": DURATIONS_H, "rates": {k: RATES[k] for k in CAT_KEYS}, "cap_mult_gold": CAP_MULT_GOLD, "cap_pearls": CAP_PEARLS, "podium": PODIUM_BONUS, "title": CHAMPION_TITLE},
            "categories": {k: {**CATS[k], "icon": f"/art/tournaments/{k}.webp", "rate": RATES[k]} for k in CAT_KEYS}, "user": public_user(user)}


@api.post("/tournaments/{tid}/join")
async def join(tid: str, user=Depends(get_current_user)):
    if user.get("is_guest"): raise HTTPException(403, "Guests can't buy in, claim your account first")
    tr = await db.tournaments.find_one({"_id": ObjectId(tid)}) if ObjectId.is_valid(tid) else None
    if not tr: raise HTTPException(404, "No such tournament")
    if tr["status"] != "signup": raise HTTPException(400, "Buy-in for this tournament is closed")
    if user.get("tournament_ticket"): raise HTTPException(400, "You already hold a ticket, one tournament at a time")
    if any(e["user_id"] == str(user["_id"]) for e in tr["entrants"]): raise HTTPException(400, "You're already in")
    cur, fee = tr["currency"], tr["fee"]
    r = await db.users.update_one({"_id": user["_id"], cur: {"$gte": fee}, "tournament_ticket": {"$exists": False}}, {"$inc": {cur: -fee}, "$set": {"tournament_ticket": tid}})
    if not r.modified_count: raise HTTPException(400, f"You need {fee} {cur} for this buy-in")
    r = await db.tournaments.update_one({"_id": tr["_id"], "status": "signup", "entrants.user_id": {"$ne": str(user["_id"])}},
                                        {"$push": {"entrants": {"user_id": str(user["_id"]), "username": user["username"], "avatar": user.get("avatar") or STARTER_AVATARS[0], "paid_at": iso(now())}}})
    if not r.modified_count:
        await db.users.update_one({"_id": user["_id"], "tournament_ticket": tid}, {"$inc": {cur: fee}, "$unset": {"tournament_ticket": ""}})
        raise HTTPException(400, "Buy-in just closed, your fee was returned")
    if tr.get("reminded"):  # joined inside the last REMIND_MIN minutes: the reminder already went out, so tell this angler directly
        await notify(user["_id"], f"Your {CATS[tr['category']]['label']} tournament starts at {tr['start'][11:16]} UTC. Get to your water.", "/game/tournaments")
    return await tournaments(await db.users.find_one({"_id": user["_id"]}))
