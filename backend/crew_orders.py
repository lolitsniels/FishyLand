"""Weekly crew order: one big delivery contract per crew per week, scaled to crew size. Every member hands fish in from
their own inventory; when every line is filled the pool is split by contribution, the crew bank takes a cut, and each
contributor earns XP, Pearls and favour with the week's patron. All or nothing, an unfinished order pays nobody."""
import random
from datetime import datetime
from typing import List, Optional

from bson import ObjectId

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from contracts import keepnet, contract_gold_mult
from contracts_data import PATRONS
from game_data import SAME_SPECIES
from server import (api, db, now, iso, oid, get_current_user, add_feed, public_user, check_achievements, level_from_xp, xp_for_level, fish_value, settle_level_up,
                    quest_period, send_system_message, FISH_BY_WATER, WATER_BY_KEY, WATERS, RARITY_ORDER)

BANK_SHARE = 0.25
PER_MEMBER_GOLD = 600
FAVOUR = 30
PEARLS_BIG, PEARLS_SMALL, BIG_SHARE = 2, 1, 0.05
XP_MULT = 0.4
PATRON_ROTA = ["harbourmaster", "cook", "sailor", "baitseller"]
POINTS = {"count": 1, "water_kg": 1, "rarity_any": 4}


def _n(c):
    return max(3, min(20, len(c["members"])))


async def _crew_waters(c):
    """Waters at least half the crew has unlocked (so everyone can pitch in), deepest-first."""
    ids = [ObjectId(m["user_id"]) for m in c["members"]]
    counts = {}
    async for u in db.users.find({"_id": {"$in": ids}}, {"unlocked_waters": 1}):
        for w in u.get("unlocked_waters", []): counts[w] = counts.get(w, 0) + 1
    ok = [w["key"] for w in WATERS if counts.get(w["key"], 0) * 2 >= len(c["members"])] or ["millbrook"]
    return ok


def _pick(rnd, water, rarity):
    every = FISH_BY_WATER[water]  # crab cage species count too
    pool = [f for f in every if f["rarity"] == rarity] or [f for f in every if f["rarity"] in ("common", "uncommon")]
    return rnd.choice(pool)


async def make_order(c, week, start, end):
    rnd = random.Random(f"crew-order:{c['_id']}:{week}")
    n = _n(c)
    waters = await _crew_waters(c)
    w1, w2 = rnd.choice(waters), rnd.choice(waters)
    f1, f2 = _pick(rnd, w1, "common"), _pick(rnd, w2, "uncommon")
    med = sorted(f["max_kg"] for f in FISH_BY_WATER[w1])[len(FISH_BY_WATER[w1]) // 2]
    items = [
        {"kind": "count", "species_id": f1["id"], "species_name": f1["name"], "rarity": f1["rarity"], "water": w1, "target": 6 * n, "progress": 0,
         "text": f"Deliver {6 * n}× {f1['name']}", "pool": fish_value(f1, (f1["min_kg"] + f1["max_kg"]) / 2, 1.0) * 6 * n * 2},
        {"kind": "count", "species_id": f2["id"], "species_name": f2["name"], "rarity": f2["rarity"], "water": w2, "target": 2 * n + 2, "progress": 0,
         "text": f"Deliver {2 * n + 2}× {f2['name']}", "pool": fish_value(f2, (f2["min_kg"] + f2["max_kg"]) / 2, 1.0) * (2 * n + 2) * 2},
        {"kind": "water_kg", "water": w1, "target": round(max(6.0, med * 4 * n), 1), "progress": 0, "text": f"Deliver {round(max(6.0, med * 4 * n), 1)} kg of fish from {WATER_BY_KEY[w1]['name']}, any species",
         "pool": int(med * 4 * n * 25)},
        {"kind": "rarity_any", "min_rarity": "rare", "target": n + 2, "progress": 0, "text": f"Deliver {n + 2} rare-or-better fish from any water", "pool": 130 * (n + 2) * 2},
    ]
    patron = PATRON_ROTA[int(start.timestamp() // 604800) % 4]
    pool = int(sum(i["pool"] for i in items) + PER_MEMBER_GOLD * len(c["members"])) // 50 * 50
    return {"crew_id": str(c["_id"]), "week": week, "patron": patron, "items": items, "pool": pool, "status": "active", "contrib": {},
            "created_at": iso(now()), "starts_at": iso(start), "ends_at": iso(end)}


async def ensure_order(c):
    week, start, end = quest_period("weekly")
    o = await db.crew_orders.find_one({"crew_id": str(c["_id"]), "week": week})
    if o: return o
    doc = await make_order(c, week, start, end)
    try:
        await db.crew_orders.insert_one(doc)
    except Exception:
        pass
    return await db.crew_orders.find_one({"crew_id": str(c["_id"]), "week": week})


def matches(item, f):
    if item["kind"] == "count": return f["species_id"] in SAME_SPECIES.get(item["species_id"], {item["species_id"]})
    if item["kind"] == "water_kg": return f["water"] == item["water"]
    return RARITY_ORDER.index(f["rarity"]) >= RARITY_ORDER.index(item["min_rarity"])


def have_for(item, rows):
    m = [r for r in rows if matches(item, r)]
    return {"count": len(m), "kg": round(sum(r["weight"] for r in m), 2)}


def split(o):
    """Share of the member pool per contributor, by weighted points; the crew bank takes BANK_SHARE first."""
    total = sum(v["points"] for v in o["contrib"].values()) or 1
    members_pool = int(o["pool"] * (1 - BANK_SHARE))
    return {uid: {"username": v["username"], "points": v["points"], "fish": v["fish"], "share": v["points"] / total, "gold": int(members_pool * v["points"] / total) // 5 * 5,
                  "pearls": PEARLS_BIG if v["points"] / total >= BIG_SHARE else PEARLS_SMALL} for uid, v in o["contrib"].items()}


def order_out(o, user=None, rows=None):
    p = PATRONS[o["patron"]]
    sp = split(o)
    return {"id": str(o["_id"]), "week": o["week"], "patron": o["patron"], "patron_name": p["name"], "portrait": p["portrait"], "status": o["status"], "pool": o["pool"],
            "bank_cut": int(o["pool"] * BANK_SHARE), "members_pool": int(o["pool"] * (1 - BANK_SHARE)), "ends_at": o["ends_at"], "done_at": o.get("done_at"),
            "items": [{**{k: v for k, v in i.items() if k != "pool"}, "index": idx, "progress": round(i["progress"], 2), "done": i["progress"] >= i["target"] - 1e-9,
                       "have": have_for(i, rows) if rows is not None else None} for idx, i in enumerate(o["items"])],
            "complete": all(i["progress"] >= i["target"] - 1e-9 for i in o["items"]),
            "contributors": sorted(sp.values(), key=lambda v: -v["points"]),
            "mine": sp.get(str(user["_id"])) if user else None, "favour": FAVOUR, "big_share_pct": int(BIG_SHARE * 100), "pearls": [PEARLS_SMALL, PEARLS_BIG]}


async def _crew(crew_id):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    return c


def _is_member(c, user):
    return any(m["user_id"] == str(user["_id"]) for m in c["members"])


@api.get("/crews/{crew_id}/order")
async def get_order(crew_id: str, user=Depends(get_current_user)):
    c = await _crew(crew_id)
    o = await ensure_order(c)
    rows = await keepnet(str(user["_id"])) if _is_member(c, user) else None
    last = await db.crew_orders.find_one({"crew_id": crew_id, "status": "done", "week": {"$ne": o["week"]}}, sort=[("done_at", -1)])
    return {"order": order_out(o, user, rows), "member": _is_member(c, user), "last": order_out(last) if last else None, "bank_share_pct": int(BANK_SHARE * 100)}


class DeliverIn(BaseModel):
    item: int
    max_fish: Optional[int] = None
    catch_ids: Optional[List[str]] = Field(default=None, max_length=500)


@api.get("/crews/{crew_id}/order/candidates")
async def candidates(crew_id: str, item: int, user=Depends(get_current_user)):
    """Fish in your inventory that fit an order line, lowest value first (what an automatic hand-in would take)."""
    c = await _crew(crew_id)
    if not _is_member(c, user): raise HTTPException(403, "Members only")
    o = await ensure_order(c)
    if not 0 <= item < len(o["items"]): raise HTTPException(404, "No such line on the order")
    rows = sorted([r for r in await keepnet(str(user["_id"])) if matches(o["items"][item], r)], key=lambda r: (r["value"], r["weight"]))
    return {"fish": [{"id": str(r["_id"]), "name": r["name"], "species_id": r["species_id"], "rarity": r["rarity"], "weight": r["weight"], "variant": r.get("variant", "normal"),
                      "value": r["value"]} for r in rows]}


@api.post("/crews/{crew_id}/order/deliver")
async def deliver(crew_id: str, body: DeliverIn, user=Depends(get_current_user)):
    c = await _crew(crew_id)
    if not _is_member(c, user): raise HTTPException(403, "Members only")
    o = await ensure_order(c)
    if o["status"] != "done" and now() >= datetime.fromisoformat(o["ends_at"]): raise HTTPException(400, "This week's order has closed")
    if o["status"] == "done": raise HTTPException(400, "The crew already filled this week's order")
    if not 0 <= body.item < len(o["items"]): raise HTTPException(404, "No such line on the order")
    item = o["items"][body.item]
    need = item["target"] - item["progress"]
    if need <= 1e-9: raise HTTPException(400, "That line is already filled")
    uid = str(user["_id"])
    rows = [r for r in await keepnet(uid) if matches(item, r)]
    if body.catch_ids is not None:
        chosen = set(body.catch_ids)
        rows = [r for r in rows if str(r["_id"]) in chosen]
        if not rows: raise HTTPException(400, "Pick at least one fish that fits this line")
    if not rows: raise HTTPException(400, f"Nothing in your inventory fits, {item['text'].lower()}")
    if item["kind"] == "water_kg" and body.catch_ids is not None:
        rows.sort(key=lambda r: (r["value"], r["weight"])); pick, tot = [], 0.0
        for r in rows:
            if tot >= need - 1e-9: break
            pick.append(r); tot += r["weight"]
    elif item["kind"] == "water_kg":
        rows.sort(key=lambda r: -r["weight"]); pick, tot = [], 0.0
        for r in rows:
            if tot >= need - 1e-9: break
            pick.append(r); tot += r["weight"]
    else:
        rows.sort(key=lambda r: (r["value"], r["weight"])); pick = rows[:int(need + 0.999)]
    if body.max_fish: pick = pick[:max(1, body.max_fish)]
    gone = []
    for r in pick:  # one by one, so only fish that really left the keepnet are credited
        if (await db.catches.delete_one({"_id": r["_id"], "user_id": uid, "listed": False, "mounted": {"$ne": True}})).deleted_count: gone.append(r)
    pick = gone
    if not pick: raise HTTPException(409, "Those fish just left your inventory, try again")
    gained = sum(r["weight"] for r in pick) if item["kind"] == "water_kg" else len(pick)
    pts = len(pick) * POINTS[item["kind"]]
    await db.crew_orders.update_one({"_id": o["_id"]}, {"$inc": {f"items.{body.item}.progress": gained, f"contrib.{uid}.points": pts, f"contrib.{uid}.fish": len(pick)},
                                                        "$set": {f"contrib.{uid}.username": user["username"]}})
    o = await db.crew_orders.find_one({"_id": o["_id"]})
    result = {"delivered": len(pick), "item": body.item, "done": False}
    if all(i["progress"] >= i["target"] - 1e-9 for i in o["items"]):
        won = await db.crew_orders.find_one_and_update({"_id": o["_id"], "status": "active"}, {"$set": {"status": "done", "done_at": iso(now())}})
        if won:
            await payout(c, o)
            result["done"] = True
            from crew_extras import crew_log
            await crew_log(c["_id"], user["username"], "handed in the last line, the weekly crew order is complete", "order")
    o = await db.crew_orders.find_one({"_id": o["_id"]})
    result["order"] = order_out(o, user, await keepnet(uid))
    result["user"] = public_user(await db.users.find_one({"_id": user["_id"]}))
    return result


async def payout(c, o):
    sp = split(o)
    p = PATRONS[o["patron"]]
    bank = int(o["pool"] * BANK_SHARE)
    await db.crews.update_one({"_id": c["_id"]}, {"$inc": {"bank": bank, "orders_done": 1},
                                                  "$push": {"hall_log": {"$each": [{"who": p["short"].capitalize(), "text": f"paid {bank:,} gold into the bank for the weekly order", "at": iso(now())}], "$slice": -50}}})
    for uid, v in sp.items():
        u = await db.users.find_one({"_id": ObjectId(uid)})
        if not u: continue
        gold = int(v["gold"] * contract_gold_mult(u)) // 5 * 5
        old_level, _ = level_from_xp(u["xp"])
        xp = int(xp_for_level(old_level) * XP_MULT)
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"gold": gold, "xp": xp, "pearls": v["pearls"], "stats.gold_earned": gold, "stats.pearls_earned": v["pearls"],
                                                             "stats.crew_orders": 1, f"favour.{o['patron']}": FAVOUR, "stats.favour_total": FAVOUR}})
        await settle_level_up(u["_id"], old_level)
        await send_system_message(uid, u["username"], f"Your crew [{c['tag']}] filled {p['name']}'s weekly order. Your share for {v['fish']} fish ({int(v['share'] * 100)}% of the work): {gold:,} gold, {xp:,} XP, {v['pearls']} Pearl{'s' if v['pearls'] > 1 else ''} and +{FAVOUR} favour with {p['short']}. {bank:,} gold went into the crew bank.")
        await check_achievements(u["_id"])
    await add_feed("crew", c["leader"], f"Crew [{c['tag']}] {c['name']} filled {p['name']}'s weekly order: {len(sp)} anglers share {int(o['pool'] * (1 - BANK_SHARE)):,} gold and the bank grows by {bank:,}.", "epic")
    await db.chat.insert_one({"channel": "crew", "crew_id": str(c["_id"]), "username": "Harbourmaster", "level": 0, "at": iso(now()),
                              "text": f"Weekly order filled! {p['name']} pays {o['pool']:,} gold: {bank:,} to the bank, the rest split among the {len(sp)} of you who delivered. Well done."})
