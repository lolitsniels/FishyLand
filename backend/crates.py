"""Loot crates: Bronze / Silver / Gold. Earned only in game (contests, random draws, bosses, ultra-rare fishing drops), tradable, never sold for Pearls or money."""
import random
from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import api, db, now, iso, get_current_user, require_admin, public_user, add_feed, send_system_message, GEAR_BY_ID, BAIT_BY_ID, MAX_DURABILITY

TOTAL = 10_000_000  # weights are "per ten million" so chances down to 0.00001% are exact
PEARL_VALUE, POTION_VALUE, SCRAP_VALUE = 2000, 900, 12
CRATE_RODS = ["rod_coral", "rod_moonreed", "rod_tempest", "rod_jade", "rod_starfall", "rod_abyssal"]

CRATES = {
    "crate_bronze": {"name": "Bronze Crate", "rarity": "rare", "base": 6000, "desc": "Nailed shut with bronze bands. Mostly gold and tackle, but every so often something extraordinary rattles inside.", "table": [
        ("gold", None, 2500, 3_000_000), ("gold", None, 6000, 1_500_000), ("bait", "bait_chum", 25, 1_600_000), ("potion", "potion_energy", 1, 1_200_000),
        ("scrap", None, 200, 1_200_000), ("bait", "bait_moonfly", 10, 800_000), ("gold", None, 15000, 400_000), ("pearls", None, 3, 200_000),
        ("crate", "crate_silver", 1, 50_000), ("rod", "rod_coral", 1, 40_000), ("rod", "rod_moonreed", 1, 9_000), ("rod", "rod_tempest", 1, 900), ("rod", "rod_jade", 1, 100)]},
    "crate_silver": {"name": "Silver Crate", "rarity": "epic", "base": 30000, "desc": "Silver-bound and humming with cold light. Better hauls and a real shot at a crate-only rod.", "table": [
        ("gold", None, 10000, 2_800_000), ("gold", None, 25000, 1_500_000), ("bait", "bait_lantern", 10, 1_200_000), ("potion", "potion_energy", 3, 1_200_000),
        ("scrap", None, 750, 1_000_000), ("bait", "bait_roe", 10, 800_000), ("pearls", None, 8, 500_000), ("gold", None, 60000, 400_000),
        ("crate", "crate_gold", 1, 150_000), ("rod", "rod_coral", 1, 250_000), ("rod", "rod_moonreed", 1, 150_000), ("rod", "rod_tempest", 1, 40_000),
        ("rod", "rod_jade", 1, 9_000), ("rod", "rod_starfall", 1, 900), ("rod", "rod_abyssal", 1, 100)]},
    "crate_gold": {"name": "Gold Crate", "rarity": "legendary", "base": 150000, "desc": "Black lacquer and gold filigree, light pouring out of every seam. The only crate where the rarest rods are more than a dream.", "table": [
        ("gold", None, 50000, 2_500_000), ("gold", None, 120000, 1_500_000), ("bait", "bait_roe", 30, 1_200_000), ("potion", "potion_energy", 6, 1_000_000),
        ("scrap", None, 2500, 1_000_000), ("pearls", None, 20, 800_000), ("gold", None, 300000, 500_000), ("rod", "rod_moonreed", 1, 700_000),
        ("rod", "rod_tempest", 1, 500_000), ("rod", "rod_jade", 1, 250_000), ("rod", "rod_starfall", 1, 49_000), ("rod", "rod_abyssal", 1, 1_000)]},
}
for _c in CRATES.values(): assert sum(e[3] for e in _c["table"]) == TOTAL, _c["name"]

def wiki_data():
    return {"crates": [crate_out(cid) for cid in CRATES], "how_to_get": HOW_TO_GET, "rods": [{**GEAR_BY_ID[r], "id": r} for r in CRATE_RODS],
            "fish_drop": {cid: round(p * 100, 5) for cid, p in FISH_DROP}, "boss_drop": {cid: round(p * 100, 3) for cid, p in BOSS_DROP},
            "leviathan_drop": {cid: round(p * 100, 3) for cid, p in LEVIATHAN_DROP}}


HOW_TO_GET = ["Weekly crew challenge: every member of the 1st place crew gets a Silver Crate, 2nd and 3rd place crews get Bronze.",
              "Weekly lucky draw: three random anglers who landed 20+ fish that week win a crate, whatever their rank.",
              "Tournaments: one random angler who scored (not the winner) wins a Bronze Crate, plus a Silver draw in tournaments with 8+ anglers.",
              "Bosses: slaying a boss or pulling on a crew Leviathan has a small chance to drop one.",
              "Fishing: any fish you land has a tiny chance to come up with a crate tangled in the line.",
              "Random events: a few times a day a surprise Hidden Goldfish, Shipwreck Salvage or Chat Quick-Draw pops up. Winners get a Bronze, Silver or Gold Crate."]
FISH_DROP = [("crate_gold", 1 / 400_000), ("crate_silver", 1 / 80_000), ("crate_bronze", 1 / 20_000)]
BOSS_DROP = [("crate_gold", 0.003), ("crate_silver", 0.02), ("crate_bronze", 0.08)]
LEVIATHAN_DROP = [("crate_gold", 0.001), ("crate_silver", 0.01), ("crate_bronze", 0.05)]


def roll_drop(table):
    r = random.random()
    for cid, p in table:
        if r < p: return cid
        r -= p
    return None


def prize_value(kind, item_id, qty):
    if kind == "gold": return qty
    if kind == "pearls": return qty * PEARL_VALUE
    if kind == "potion": return qty * POTION_VALUE
    if kind == "scrap": return qty * SCRAP_VALUE
    if kind == "bait": b = BAIT_BY_ID[item_id]; return int(qty * (b["price"] / b.get("pack", 1)))
    if kind == "crate": return CRATES[item_id]["base"]
    return GEAR_BY_ID[item_id]["price"]


def prize_label(kind, item_id, qty):
    if kind == "gold": return f"{qty:,} gold"
    if kind == "pearls": return f"{qty} Pearls"
    if kind == "potion": return f"{qty}× Energy Potion" if qty > 1 else "Energy Potion"
    if kind == "scrap": return f"{qty:,} Tackle Scrap"
    if kind == "bait": return f"{qty}× {BAIT_BY_ID[item_id]['name']}"
    return CRATES[item_id]["name"] if kind == "crate" else GEAR_BY_ID[item_id]["name"]


def prize_rarity(kind, item_id, w):
    if kind == "rod": return GEAR_BY_ID[item_id].get("crate_rarity", "legendary")
    if kind == "crate": return CRATES[item_id]["rarity"]
    p = w / TOTAL
    return "epic" if p <= 0.05 else "rare" if p <= 0.12 else "uncommon" if p <= 0.2 else "common"


def prize_icon(kind, item_id):
    return {"gold": "coins", "pearls": "pearl", "potion": "potion_energy", "scrap": "scrap"}.get(kind, item_id)


def fmt_pct(c):
    return f"{c:g}%" if c >= 0.01 else f"{c:.4f}".rstrip("0") + "%"


def prize_out(e):
    kind, item_id, qty, w = e
    return {"kind": kind, "id": item_id, "qty": qty, "label": prize_label(kind, item_id, qty), "icon": prize_icon(kind, item_id), "rarity": prize_rarity(kind, item_id, w),
            "chance": round(w / TOTAL * 100, 5), "value": prize_value(kind, item_id, qty)}


async def market_prices():
    rows = await db.trades.aggregate([{"$match": {"kind": "crate"}}, {"$sort": {"at": -1}}, {"$limit": 300},
                                      {"$group": {"_id": "$item", "avg": {"$avg": {"$divide": ["$price", "$qty"]}}, "n": {"$sum": 1}, "last": {"$first": {"$divide": ["$price", "$qty"]}}}}]).to_list(10)
    by_name = {r["_id"]: r for r in rows}
    out = {}
    for cid, c in CRATES.items():
        r = by_name.get(c["name"])
        lo = await db.listings.find({"kind": "crate", "status": "open", "item.item_id": cid}).sort("price", 1).limit(1).to_list(1)
        out[cid] = {"avg": round(r["avg"]) if r else None, "last": round(r["last"]) if r else None, "sales": r["n"] if r else 0,
                    "cheapest": round(lo[0]["price"] / lo[0]["qty"]) if lo else None}
    return out


def crate_out(cid, owned=0, market=None):
    c = CRATES[cid]
    contents = [prize_out(e) for e in c["table"]]
    return {"id": cid, "name": c["name"], "rarity": c["rarity"], "desc": c["desc"], "owned": owned, "contents": contents,
            "expected_value": round(sum(p["value"] * p["chance"] / 100 for p in contents)), "market": market}


@api.get("/crates")
async def crates_view(user=Depends(get_current_user)):
    items = user.get("items") or {}
    mk = await market_prices()
    return {"crates": [crate_out(cid, int(items.get(cid, 0)), mk[cid]) for cid in CRATES], "how_to_get": HOW_TO_GET,
            "rods": [{**GEAR_BY_ID[r], "id": r} for r in CRATE_RODS]}


async def grant_crate(user_id, username, cid, reason):
    u = await db.users.find_one({"_id": ObjectId(str(user_id))}, {"is_guest": 1})
    if not u or u.get("is_guest"): return False
    await db.users.update_one({"_id": ObjectId(str(user_id))}, {"$inc": {f"items.{cid}": 1, "stats.crates_found": 1}})
    await db.crate_log.insert_one({"user_id": str(user_id), "username": username, "crate": cid, "reason": reason, "at": iso(now())})
    await send_system_message(str(user_id), username, f"You received a {CRATES[cid]['name']}! ({reason}) Open it from Inventory, Crates, or sell it on the Market.")
    if cid != "crate_bronze":
        await add_feed("crate", username, f"{username} earned a {CRATES[cid]['name']} ({reason}).", CRATES[cid]["rarity"])
    return True


async def apply_prize(user, cid, e):
    kind, item_id, qty, _ = e
    uid = user["_id"]
    note = None
    if kind == "gold": inc = {"gold": qty, "stats.gold_earned": qty}
    elif kind == "pearls": inc = {"pearls": qty, "stats.pearls_earned": qty}
    elif kind == "potion": inc = {"items.potion_energy": qty}
    elif kind == "scrap": inc = {"scrap": qty}
    elif kind == "bait": inc = {f"bait.{item_id}": qty}
    elif kind == "crate": inc = {f"items.{item_id}": qty}
    else:
        r = await db.users.update_one({"_id": uid, "owned_gear": {"$ne": item_id}}, {"$push": {"owned_gear": item_id}, "$set": {f"durability.{item_id}": MAX_DURABILITY}})
        inc = {}
        if not r.modified_count:
            await db.users.update_one({"_id": uid}, {"$push": {f"spare_copies.{item_id}": {"enhance": 0, "durability": MAX_DURABILITY}}})
            note = "You already own one, so the spare went into your Tackle box. Sell it to another angler on the Market or to the vendor."
    if inc: await db.users.update_one({"_id": uid}, {"$inc": inc})
    return note


class OpenIn(BaseModel):
    crate_id: str


STRIP_LEN, WIN_AT = 48, 40


def strip_for(c, winner):
    shown = [(e, max(e[3], TOTAL // 30)) for e in c["table"]]  # rare prizes appear on the reel more often than their real odds, purely visual
    pool, weights = [s[0] for s in shown], [s[1] for s in shown]
    strip = [prize_out(e) for e in random.choices(pool, weights, k=STRIP_LEN)]
    strip[WIN_AT] = prize_out(winner)
    return strip


@api.post("/crates/open")
async def open_crate(body: OpenIn, user=Depends(get_current_user)):
    c = CRATES.get(body.crate_id)
    if not c: raise HTTPException(404, "Unknown crate")
    r = await db.users.update_one({"_id": user["_id"], f"items.{body.crate_id}": {"$gte": 1}}, {"$inc": {f"items.{body.crate_id}": -1, "stats.crates_opened": 1}})
    if not r.modified_count: raise HTTPException(400, f"You don't have a {c['name']}")
    e = random.choices(c["table"], [x[3] for x in c["table"]])[0]
    note = await apply_prize(user, body.crate_id, e)
    prize = prize_out(e)
    notable = e[0] in ("rod", "crate") or prize["chance"] <= 2
    await db.crate_opens.insert_one({"user_id": str(user["_id"]), "username": user["username"], "crate": c["name"], "label": prize["label"], "kind": e[0], "item": e[1],
                                     "rarity": prize["rarity"], "chance": prize["chance"], "notable": notable, "at": iso(now())})
    if e[0] == "rod":
        await add_feed("crate", user["username"], f"{user['username']} opened a {c['name']} and pulled the {prize['label']}! ({fmt_pct(prize['chance'])} chance)", prize["rarity"])
        if prize["rarity"] in ("legendary", "mythic"):
            await db.alerts.insert_one({"username": user["username"], "water": user.get("water"), "water_name": "", "status": "crate", "species": prize["label"], "weight": None, "variant": None,
                                        "rarity": prize["rarity"], "gear_id": e[1], "at": iso(now()), "cheers": [],
                                        "text": f"{user['username']} opened a {c['name']} and pulled the {prize['label']}! Only a {fmt_pct(prize['chance'])} chance."})
            from server import uncache
            uncache("alerts_live")
    elif e[0] == "crate":
        await add_feed("crate", user["username"], f"{user['username']} opened a {c['name']} and found a {prize['label']} inside!", prize["rarity"])
    return {"prize": prize, "note": note, "strip": strip_for(c, e), "win_at": WIN_AT, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


# ---------- hooks used by fishing, bosses, contests and tournaments ----------
async def maybe_fish_drop(user) -> Optional[dict]:
    if user.get("is_guest"): return None
    cid = roll_drop(FISH_DROP)
    if not cid: return None
    await grant_crate(user["_id"], user["username"], cid, "it came up tangled in your line")
    return {"id": cid, "name": CRATES[cid]["name"], "rarity": CRATES[cid]["rarity"]}


async def maybe_boss_drop(user, boss_name, leviathan=False) -> Optional[str]:
    cid = roll_drop(LEVIATHAN_DROP if leviathan else BOSS_DROP)
    if cid and await grant_crate(user["_id"], user["username"], cid, f"dropped by {boss_name}"): return cid
    return None


async def crew_contest_crates(standings, start_iso, end_iso, label):
    podium_ids = set()
    for i, s in enumerate(standings[:3]):
        crew = await db.crews.find_one({"_id": ObjectId(s["crew_id"])})
        if not crew: continue
        cid = "crate_silver" if i == 0 else "crate_bronze"
        for m in crew["members"]:
            podium_ids.add(m["user_id"])
            await grant_crate(m["user_id"], m["username"], cid, f"your crew placed {['1st', '2nd', '3rd'][i]} in the weekly {label} challenge")
    await lucky_draw(start_iso, end_iso, podium_ids, label)


async def lucky_draw(start_iso, end_iso, exclude, label):
    rows = await db.catch_log.aggregate([{"$match": {"caught_at": {"$gte": start_iso, "$lt": end_iso}}},
                                         {"$group": {"_id": {"$ifNull": ["$caught_by", "$user_id"]}, "username": {"$first": {"$ifNull": ["$caught_by_name", "$username"]}}, "n": {"$sum": 1}}},
                                         {"$match": {"n": {"$gte": 20}}}]).to_list(100000)
    pool = [r for r in rows if r["_id"] and r["_id"] not in exclude]
    if not pool: return []
    prizes = ["crate_silver", "crate_bronze", "crate_bronze"] + (["crate_gold"] if random.random() < 0.125 else [])
    random.shuffle(pool)
    winners = []
    for w in pool:
        if len(winners) == len(prizes): break
        u = await db.users.find_one({"_id": ObjectId(w["_id"])}, {"username": 1})
        if u and await grant_crate(w["_id"], u["username"], prizes[len(winners)], "you won the weekly lucky draw"): winners.append(u["username"])
    if winners: await add_feed("crate", "Harbourmaster", f"Weekly lucky draw: {', '.join(winners)} each won a crate.", "epic")
    return winners


async def tournament_crates(rows, n_entrants, label):
    pool = [s for s in rows[1:] if s.get("value")]
    if not pool: return
    picks = random.sample(pool, min(2 if n_entrants >= 8 else 1, len(pool)))
    for s, cid in zip(picks, ["crate_bronze", "crate_silver"]):
        await grant_crate(s["user_id"], s["username"], cid, f"lucky draw in the {label} tournament")


class GrantIn(BaseModel):
    username: str
    crate_id: str
    qty: int = 1


@api.post("/admin/crates/grant")
async def admin_grant_crate(body: GrantIn, admin=Depends(require_admin)):
    if body.crate_id not in CRATES or not 1 <= body.qty <= 100: raise HTTPException(400, "Unknown crate or bad quantity")
    u = await db.users.find_one({"username_lc": body.username.lower()}, {"username": 1})
    if not u: raise HTTPException(404, "No angler by that name")
    for _ in range(body.qty):
        await grant_crate(u["_id"], u["username"], body.crate_id, f"a gift from {admin['username']}")
    return {"ok": True, "username": u["username"], "qty": body.qty}
