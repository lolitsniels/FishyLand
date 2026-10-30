"""Weekly Duel Ladder: a progress bar that resets every week. Only wins move you up (+3); draws and losses never move you back.
Crossing a milestone pays its reward once per week. Milestone rewards change every week.
The top 3 by wins each week get podium prizes; #1 wears the Pier Champion title until another angler wins a week."""
import random
from datetime import timedelta

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from server import db, now, iso, quest_period, level_from_xp, xp_for_level, add_feed, send_system_message, FISH, BAIT_BY_ID, BAITS, INGREDIENTS, ING_BY_ID

CHAMPION_TITLE = "Pier Champion"
POINTS_FOR = {"win": 3, "draw": 0, "loss": 0}
MILESTONES = [3, 6, 10, 15, 21, 28, 36, 45, 55, 66]
TIER_OF = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3]
TIER_RARITY = ["common", "rare", "epic", "legendary"]
# (kind, arg, qty). xp qty = share of the angler's current level; fish arg = rarity, qty = variant.
POOLS = [
    [("gold", None, 400), ("gold", None, 700), ("bait", "bait_worm", 25), ("bait", "bait_live", 10), ("scrap", None, 40), ("xp", None, 0.08),
     ("fish", "common", "scarred"), ("fish", "uncommon", "normal"), ("ingredient", None, 3)],
    [("gold", None, 1500), ("gold", None, 2500), ("crafted", None, 5), ("scrap", None, 125), ("pearls", None, 2), ("potion", None, 1),
     ("fish", "rare", "scarred"), ("fish", "rare", "giant"), ("xp", None, 0.2), ("bait", "bait_duel", 10)],
    [("gold", None, 6000), ("pearls", None, 5), ("potion", None, 3), ("scrap", None, 375), ("fish", "epic", "giant"), ("fish", "epic", "albino"),
     ("bait", "bait_duel", 25), ("crafted", None, 12), ("xp", None, 0.4)],
    [("gold", None, 15000), ("pearls", None, 10), ("fish", "legendary", "albino"), ("fish", "legendary", "golden"), ("scrap", None, 1000), ("crate", "crate_silver", 1), ("seal", None, 1)],
]
PODIUM = [{"gold": 15000, "pearls": 15, "seal": 1, "title": True}, {"gold": 8000, "pearls": 8, "crate": "crate_silver"}, {"gold": 4000, "pearls": 4, "crate": "crate_bronze"}]
CRATE_NAMES = {"crate_bronze": "Bronze Crate", "crate_silver": "Silver Crate"}
SETTLED_KEY = "duel_week_settled"
HOLDER_KEY = "pier_champion_holder"
RESULTS_KEY = "duel_week_results"


def week_key(t=None):
    return quest_period("weekly", t)[0]


VALUE = {"seal": 25000, "gold": 1, "pearls": 1500, "scrap": 10, "xp": 10000, "crafted": 200, "ingredient": 100, "potion": 900, "crate": 30000}
FISH_VALUE = {"common": 300, "uncommon": 600, "rare": 2000, "epic": 5000, "legendary": 20000}
VMULT = {"normal": 1, "scarred": 1.35, "giant": 2.2, "albino": 3, "golden": 5}


def _value(e):
    if e[0] == "fish": return FISH_VALUE[e[1]] * VMULT[e[2]]
    if e[0] == "bait": return e[2] * (BAIT_BY_ID[e[1]].get("price") or 60)
    return e[2] * VALUE[e[0]]


def week_rewards(key):
    rnd = random.Random(f"duel-ladder:{key}")
    picks = {t: sorted(rnd.sample(POOLS[t], TIER_OF.count(t)), key=_value, reverse=True) for t in range(4)}
    out = []
    for i, t in enumerate(TIER_OF):
        e = picks[t].pop()
        r = {"kind": e[0], "item": e[1], "qty": e[2], "rarity": TIER_RARITY[t]}
        if e[0] == "fish":
            f = rnd.choice([f for f in FISH if f["rarity"] == e[1]])
            r.update(species_id=f["id"], name=f["name"], rarity=f["rarity"], variant=e[2], qty=1)
        elif e[0] == "crafted":
            b = rnd.choice([b for b in BAITS if b.get("crafted")]); r.update(item=b["id"], name=b["name"])
        elif e[0] == "ingredient":
            i2 = rnd.choice(INGREDIENTS); r.update(item=i2["id"], name=ING_BY_ID[i2["id"]]["name"])
        elif e[0] == "bait": r["name"] = BAIT_BY_ID[e[1]]["name"]
        elif e[0] == "crate": r["name"] = CRATE_NAMES[e[1]]
        elif e[0] == "seal": r.update(name="Harbourmaster's Seal", rarity="legendary")
        elif e[0] == "potion": r["name"] = "Energy Potion"
        out.append(r)
    return out


def _xp(level, share):
    return max(50, int(xp_for_level(level) * share))


def label(r, level):
    k, q = r["kind"], r["qty"]
    if k == "gold": return f"{q:,} gold"
    if k == "pearls": return f"{q} Pearls"
    if k == "scrap": return f"{q:,} scrap"
    if k == "xp": return f"{_xp(level, q):,} XP"
    if k == "fish": return r["name"] + ("" if r["variant"] == "normal" else f" ({r['variant']})")
    return f"{q}× {r['name']}" if q > 1 else r["name"]


def _blank(key):
    return {"key": key, "points": 0, "wins": 0, "losses": 0, "draws": 0, "claimed": []}


def my_week(u, key=None):
    key = key or week_key()
    dw = u.get("duel_week") or {}
    return dw if dw.get("key") == key else _blank(key)


async def _grant(u, r):
    level = level_from_xp(u["xp"])[0]
    k, q = r["kind"], r["qty"]
    inc = {}
    if k == "gold": inc = {"gold": q, "stats.gold_earned": q}
    elif k == "pearls": inc = {"pearls": q, "stats.pearls_earned": q}
    elif k == "scrap": inc = {"scrap": q}
    elif k == "xp": inc = {"xp": _xp(level, q)}
    elif k in ("bait", "crafted"): inc = {f"bait.{r['item']}": q}
    elif k == "ingredient": inc = {f"ingredients.{r['item']}": q}
    elif k == "potion": inc = {"items.potion_energy": q}
    elif k == "seal": inc = {"items.seal": q, "stats.seals_earned": q}
    elif k == "crate":
        from crates import grant_crate
        if not await grant_crate(u["_id"], u["username"], r["item"], "Duel Ladder"): inc = {"gold": 10000}
    elif k == "fish":
        from fish_grant import grant_fish
        f = next(f for f in FISH if f["id"] == r["species_id"])
        await grant_fish(u, f, r["variant"], "duel")
    if inc: await db.users.update_one({"_id": u["_id"]}, {"$inc": inc})
    if k == "xp":
        from server import settle_level_up
        await settle_level_up(u["_id"], level)


async def record(uid, outcome):
    """Called once per finished duel for each player. Returns the labels of milestones newly reached."""
    u = await db.users.find_one({"_id": ObjectId(str(uid))})
    if not u: return []
    key = week_key()
    dw = my_week(u, key)
    dw["points"] = max(0, dw["points"] + POINTS_FOR[outcome])
    dw[{"win": "wins", "loss": "losses", "draw": "draws"}[outcome]] += 1
    newly = [i for i, t in enumerate(MILESTONES) if dw["points"] >= t and i not in dw["claimed"]]
    dw["claimed"] = dw["claimed"] + newly
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"duel_week": dw}})
    rewards = week_rewards(key)
    level = level_from_xp(u["xp"])[0]
    got = []
    for i in newly:
        await _grant(u, rewards[i])
        got.append(label(rewards[i], level))
        await db.duel_notices.insert_one({"user_id": u["_id"], "text": f"Duel Ladder milestone {i + 1} reached: {got[-1]}!", "at": iso(now())})
    return got


async def leaderboard(key=None, limit=10):
    key = key or week_key()
    rows = await db.users.find({"duel_week.key": key, "duel_week.wins": {"$gt": 0}}, {"username": 1, "avatar": 1, "duel_week": 1}) \
        .sort([("duel_week.wins", -1), ("duel_week.points", -1), ("duel_week.losses", 1)]).limit(limit).to_list(limit)
    return [{"rank": i + 1, "id": str(r["_id"]), "username": r["username"], "avatar": r.get("avatar"), "wins": r["duel_week"]["wins"],
             "points": r["duel_week"]["points"], "losses": r["duel_week"]["losses"]} for i, r in enumerate(rows)]


def podium_label(p):
    bits = [f"{p['gold']:,} gold", f"{p['pearls']} Pearls"]
    if p.get("seal"): bits.append("a Harbourmaster's Seal")
    if p.get("crate"): bits.append(f"a {CRATE_NAMES[p['crate']]}")
    if p.get("title"): bits.append(f'the title "{CHAMPION_TITLE}"')
    return ", ".join(bits)


async def _pass_title(new_uid):
    holder = await db.meta.find_one({"key": HOLDER_KEY})
    old = holder.get("value") if holder else None
    if old and old != new_uid:
        ou = await db.users.find_one({"_id": ObjectId(old)}, {"duel_title_from_ladder": 1, "active_title": 1})
        if ou and ou.get("duel_title_from_ladder"):
            upd = {"$pull": {"titles": CHAMPION_TITLE}, "$unset": {"duel_title_from_ladder": ""}}
            if ou.get("active_title") == CHAMPION_TITLE: upd["$set"] = {"active_title": None}
            await db.users.update_one({"_id": ou["_id"]}, upd)
    nu = await db.users.find_one({"_id": ObjectId(new_uid)}, {"titles": 1})
    if CHAMPION_TITLE not in (nu.get("titles") or []):
        await db.users.update_one({"_id": nu["_id"]}, {"$addToSet": {"titles": CHAMPION_TITLE}, "$set": {"duel_title_from_ladder": True}})
    await db.meta.update_one({"key": HOLDER_KEY}, {"$set": {"value": new_uid}}, upsert=True)


async def settle_weeks():
    """Pay last week's podium exactly once (called from the server's minute loop)."""
    prev = week_key(now() - timedelta(days=7))
    try:
        r = await db.meta.update_one({"key": SETTLED_KEY, "value": {"$ne": prev}}, {"$set": {"value": prev, "at": iso(now())}}, upsert=True)
    except DuplicateKeyError:
        return
    if not (r.modified_count or r.upserted_id): return
    top = await leaderboard(prev, 3)
    for row, prize in zip(top, PODIUM):
        uid = ObjectId(row["id"])
        inc = {"gold": prize["gold"], "stats.gold_earned": prize["gold"], "pearls": prize["pearls"], "stats.pearls_earned": prize["pearls"]}
        if prize.get("seal"): inc["items.seal"] = prize["seal"]; inc["stats.seals_earned"] = prize["seal"]
        await db.users.update_one({"_id": uid}, {"$inc": inc})
        if prize.get("crate"):
            from crates import grant_crate
            if not await grant_crate(uid, row["username"], prize["crate"], "Duel Ladder podium"): await db.users.update_one({"_id": uid}, {"$inc": {"gold": 10000}})
        if prize.get("title"): await _pass_title(row["id"])
        await send_system_message(row["id"], row["username"], f"You finished #{row['rank']} on last week's Duel Ladder with {row['wins']} wins. Your prize: {podium_label(prize)}.")
    if top:
        w = top[0]
        await add_feed("duel", w["username"], f"{w['username']} topped the weekly Duel Ladder with {w['wins']} wins and is the new {CHAMPION_TITLE}.", "legendary")
    await db.meta.update_one({"key": RESULTS_KEY}, {"$set": {"value": {"week": prev, "top": top}}}, upsert=True)


async def ladder_view(u):
    key, _, end = quest_period("weekly")
    dw = my_week(u, key)
    level = level_from_xp(u["xp"])[0]
    rewards = week_rewards(key)
    res = await db.meta.find_one({"key": RESULTS_KEY})
    return {"week": key, "ends_at": iso(end), "points": dw["points"], "wins": dw["wins"], "losses": dw["losses"], "draws": dw["draws"], "points_for": POINTS_FOR,
            "milestones": [{"n": i + 1, "points": t, "claimed": i in dw["claimed"], "kind": r["kind"], "rarity": r["rarity"], "label": label(r, level), "item": r.get("item"),
                            **({"species_id": r["species_id"], "variant": r["variant"]} if r["kind"] == "fish" else {})} for i, (t, r) in enumerate(zip(MILESTONES, rewards))],
            "leaderboard": await leaderboard(key), "podium": [podium_label(p) for p in PODIUM], "last_week": (res or {}).get("value")}
