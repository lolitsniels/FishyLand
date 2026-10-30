"""Harbour Contract Board: four patron NPCs post delivery orders. Anglers accept a few at a time, source the fish (inventory or market),
hand them in for gold, XP, sometimes a Pearl, and favour with the patron, which unlocks lasting perks and special orders."""
import math
import random
from datetime import timedelta
from typing import List, Optional

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from contracts_data import PATRONS, RANKS, RANK_AT, RANK_REWARDS, COOK_FRAME, rank_for, patron_rank, perk_val
from game_data import SAME_SPECIES
from server import (localize, send_system_message, premium_active, api, db, now, iso, oid, get_current_user, add_feed, public_user, check_achievements, quest_event, quest_period, level_from_xp, xp_for_level, settle_level_up,
                    fish_value, FISH_BY_WATER, WATER_BY_KEY, RARITY_ORDER)

BOARD_SIZE = 6
BASE_SLOTS = 2
OFFER_HOURS = (12, 48)
ACCEPT_HOURS = 48
ABANDON_FAVOUR = 5
DAILY_CAP = 4  # contracts that can be filled per UTC day, keeps the board a side income, not a gold pump
REFILL_HOURS = 4  # an accepted offer's board slot is re-posted after this delay, not instantly
DONE_KEEP_HOURS = 24  # filled contracts stay on "Your contracts" this long unless cleared
VALUE_MULT = 1.5
TIER_GOLD_MULT = [1, 2, 4, 8]
TIER_XP = [0.08, 0.15, 0.3, 0.5]
TIER_PEARL = [0.0, 0.1, 0.3, 0.6]
TIER_FAVOUR = [8, 12, 20, 30]
SPECIAL_FAVOUR = 45
SPECIAL_CHANCE = 0.25
RARITY_W = {"common": 5, "uncommon": 4, "rare": 2, "epic": 1, "legendary": 0.3, "mythic": 0}
COUNT_QTY = {"common": (4, 6), "uncommon": (3, 4), "rare": (2, 3), "epic": (1, 2), "legendary": (1, 1), "mythic": (1, 1)}
FLAVOUR = {
    "harbourmaster": {"count": "The dock stores are low. Fill this and I'll enter it in the ledger with your name beside it.",
                      "weight": "The stores take fish by weight, not by tale, weighed on my scales, mind."},
    "baitseller": {"count": "My tubs are near empty. This lot would fill them nicely.",
                   "variant": "A collector's asking after odd fish. The stranger it looks, the better."},
    "sailor": {"trophy": "Any fool can land a small one. Bring me a proper one and then we'll talk.",
               "rarity_water": "The far waters sort the anglers from the tourists. Show me which you are."},
    "cook": {"weight": "The pots don't fill themselves. Fresh for the galley, and mind the weight.",
             "rarity_water": "The captain dines tonight. Nothing common on that table.",
             "count": "I've a recipe that wants exactly this. Don't make me substitute."},
}


def slots_for(user):
    return BASE_SLOTS + perk_val(user, "slot")


def contract_gold_mult(user):
    return 1 + perk_val(user, "gold") / 100


def describe(c):
    f = c.get("species_name")
    if c.get("cage"): f = f"{f} (crab cage)"
    if c["kind"] == "count": return f"Deliver {c['qty']}× {f}"
    if c["kind"] == "weight": return f"Deliver {c['target_kg']} kg of {f} in total"
    if c["kind"] == "trophy": return f"Deliver one {f} over {c['min_kg']} kg"
    if c["kind"] == "variant": return f"Deliver a scarred, giant, albino or golden {f}"
    return f"Deliver {c['qty']} {c['min_rarity']}-or-better fish from {WATER_BY_KEY[c['water']]['name']}"


def matches(c, catch):
    if c.get("species_id") and catch["species_id"] not in SAME_SPECIES.get(c["species_id"], {c["species_id"]}): return False
    if c["kind"] == "trophy" and catch["weight"] < c["min_kg"]: return False
    if c["kind"] == "variant" and catch.get("variant", "normal") == "normal": return False
    if c["kind"] == "rarity_water" and (catch["water"] != c["water"] or RARITY_ORDER.index(catch["rarity"]) < RARITY_ORDER.index(c["min_rarity"])): return False
    return True


def target_of(c):
    return c["target_kg"] if c["kind"] == "weight" else c["qty"]


def pick_for(c, rows):
    """Which inventory fish to hand in: cheapest first so trophies stay in the keepnet; heaviest first for weight orders."""
    rows = [r for r in rows if matches(c, r)]
    need = target_of(c) - c.get("progress", 0)
    if c["kind"] == "weight":
        rows.sort(key=lambda r: -r["weight"]); out, tot = [], 0.0
        for r in rows:
            if tot >= need - 1e-9: break
            out.append(r); tot += r["weight"]
        return out
    rows.sort(key=lambda r: (r["value"], r["weight"]))
    return rows[:max(0, int(math.ceil(need)))]


def make_offer(user, rnd, taken):
    level, _ = level_from_xp(user["xp"])
    cands = [f for k in user["unlocked_waters"] for f in FISH_BY_WATER[k] if f["id"] not in taken]
    f = rnd.choices(cands, weights=[RARITY_W[x["rarity"]] for x in cands])[0]
    r = f["rarity"]; ri = RARITY_ORDER.index(r)
    avg = (f["min_kg"] + f["max_kg"]) / 2
    qty = rnd.randint(*COUNT_QTY[r])
    deep = [k for k in user["unlocked_waters"] if sum(1 for x in FISH_BY_WATER[k] if RARITY_ORDER.index(x["rarity"]) >= 2) >= 3]
    kind = "trophy" if r == "legendary" else rnd.choices(["count", "weight", "trophy", "variant", "rarity_water"], weights=[5, 3, 2, 1 if ri <= 2 and not f.get("cage") else 0, 1 if deep else 0])[0]
    if kind == "trophy" and f["max_kg"] < 0.5: kind = "count"  # no "over 0.0 kg" orders for tiny fish
    tier = min(4, ri + 1)
    c = {"kind": kind, "species_id": f["id"], "species_name": f["name"], "rarity": r, "water": f["water"], "qty": qty}
    if f.get("cage"): c["cage"] = True  # cage-only critter: deliverable from a crab cage haul
    if kind == "count":
        c["patron"] = "baitseller" if f.get("baitable") and rnd.random() < 0.6 else ("cook" if rnd.random() < 0.2 else "harbourmaster")
    elif kind == "weight":
        c["target_kg"] = round(max(0.5, qty * avg), 1); c["patron"] = "cook" if rnd.random() < 0.7 else "harbourmaster"
    elif kind == "trophy":
        c.update(qty=1, min_kg=round(f["min_kg"] + (0.55 + 0.25 * rnd.random()) * (f["max_kg"] - f["min_kg"]), 2), patron="sailor"); qty = 1; tier = max(tier, 2)
    elif kind == "variant":
        c.update(qty=1, patron="baitseller"); qty = 1; tier = max(tier, 2)
    else:
        wk = rnd.choice(deep); qty = 3
        c = {"kind": kind, "species_id": None, "species_name": None, "rarity": "rare", "water": wk, "qty": qty, "min_rarity": "rare", "patron": rnd.choice(["sailor", "cook"])}
        tier = 3; avg = sorted(x["max_kg"] for x in FISH_BY_WATER[wk])[len(FISH_BY_WATER[wk]) // 2] / 2
        f = None
    fish_val = fish_value(f, avg, 1.0) * qty if f else 95 * qty
    wlvl = WATER_BY_KEY[c["water"]]["level"]
    gold = int((fish_val * VALUE_MULT + (40 + level * 10) * TIER_GOLD_MULT[tier - 1]) * (1 + wlvl / 60)) // 5 * 5
    special = patron_rank(user, c["patron"]) >= 5 and rnd.random() < SPECIAL_CHANCE
    if special:
        tier = 4; gold = int(gold * 1.5) // 5 * 5
    c.update(tier=tier, special=special, gold=gold, xp=int(xp_for_level(level) * TIER_XP[tier - 1]), pearls=1 if special or rnd.random() < TIER_PEARL[tier - 1] else 0,
             favour=SPECIAL_FAVOUR if special else TIER_FAVOUR[tier - 1], status="offered", progress=0, delivered=[],
             offered_at=iso(now()), expires_at=iso(now() + timedelta(hours=rnd.uniform(*OFFER_HOURS))), user_id=str(user["_id"]))
    c["text"] = describe(c)
    c["flavour"] = FLAVOUR[c["patron"]].get(kind) or next(iter(FLAVOUR[c["patron"]].values()))
    return c


async def ensure_board(user):
    """Expire stale rows, then fill the board. Slots freed by *accepting* re-post after REFILL_HOURS (tracked in users.contract_refills);
    slots freed by expiry/reroll re-post at once. Returns the pending refill times."""
    uid = str(user["_id"]); t = iso(now())
    await db.contracts.update_many({"user_id": uid, "status": "offered", "expires_at": {"$lte": t}}, {"$set": {"status": "expired"}})
    async for c in db.contracts.find({"user_id": uid, "status": "accepted", "deadline": {"$lte": t}}):
        r = await db.contracts.update_one({"_id": c["_id"], "status": "accepted"}, {"$set": {"status": "expired", "expired_at": t}})
        if r.modified_count and c.get("progress", 0) > 0:
            p = PATRONS[c["patron"]]
            await send_system_message(uid, user["username"], f"Your contract with {p['name']} ({c['text']}) ran out of time at {round(c.get('progress', 0), 2)}/{target_of(c)}. The fish you already handed in stay with the patron, accept a fresh order to start again.")
    pending = sorted(x for x in (user.get("contract_refills") or []) if x > t)
    if len(pending) != len(user.get("contract_refills") or []):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"contract_refills": pending}})
    open_rows = await db.contracts.find({"user_id": uid, "status": {"$in": ["offered", "accepted"]}}).to_list(50)
    offered = [c for c in open_rows if c["status"] == "offered"]
    target = max(0, BOARD_SIZE - len(pending))
    if len(offered) < target:
        rnd = random.Random()
        taken = {c.get("species_id") for c in open_rows if c.get("species_id")}
        new = []
        for _ in range(target - len(offered)):
            c = make_offer(user, rnd, taken); taken.add(c.get("species_id")); new.append(c)
        await db.contracts.insert_many(new)
    return pending


def contract_out(c, have=None, on_market=None):
    p = PATRONS[c["patron"]]
    out = {"id": str(c["_id"]), "patron": c["patron"], "patron_name": p["name"], "patron_short": p["short"], "portrait": p["portrait"], "kind": c["kind"], "species_id": c.get("species_id"),
           "species_name": c.get("species_name"), "rarity": c["rarity"], "water": c["water"], "water_name": WATER_BY_KEY[c["water"]]["name"], "qty": c["qty"], "target": target_of(c),
           "target_kg": c.get("target_kg"), "min_kg": c.get("min_kg"), "min_rarity": c.get("min_rarity"), "tier": c["tier"], "special": c.get("special", False),
           "gold": c["gold"], "xp": c["xp"], "pearls": c["pearls"], "favour": c["favour"], "status": c["status"], "progress": round(c.get("progress", 0), 2),
           "text": c["text"], "flavour": c.get("flavour"), "expires_at": c.get("expires_at"), "deadline": c.get("deadline"), "accepted_at": c.get("accepted_at"), "done_at": c.get("done_at"),
           "delivered": c.get("delivered", []), "paid_gold": c.get("paid_gold")}
    if have is not None: out["have"] = have
    if on_market is not None: out["on_market"] = on_market
    return out


async def keepnet(uid):
    # Unbounded on purpose: a capped list silently hid newer fish for hoarders (>3000 catches) and contracts reported "nothing matching".
    return await db.catches.find({"user_id": uid, "listed": False, "mounted": {"$ne": True}}, {"species_id": 1, "weight": 1, "variant": 1, "water": 1, "rarity": 1, "value": 1, "name": 1}).to_list(None)


def have_for(c, rows):
    m = [r for r in rows if matches(c, r)]
    return {"count": len(m), "kg": round(sum(r["weight"] for r in m), 2), "ready": (sum(r["weight"] for r in m) if c["kind"] == "weight" else len(m)) >= target_of(c) - c.get("progress", 0) - 1e-9}


async def wanted(user):
    rows = await db.contracts.find({"user_id": str(user["_id"]), "status": "accepted"}).to_list(10)
    return [{"id": str(c["_id"]), "kind": c["kind"], "species_id": c.get("species_id"), "species_ids": sorted(SAME_SPECIES.get(c.get("species_id"), set())), "min_kg": c.get("min_kg"), "water": c["water"], "min_rarity": c.get("min_rarity"),
             "patron_short": PATRONS[c["patron"]]["short"], "text": c["text"]} for c in rows]


async def contracts_ready_count(user):
    rows = await db.contracts.find({"user_id": str(user["_id"]), "status": "accepted"}).to_list(10)
    if not rows: return 0
    fish = await keepnet(str(user["_id"]))
    return sum(1 for c in rows if have_for(c, fish)["ready"])


def patron_view(user, pid):
    p = PATRONS[pid]; pts = (user.get("favour") or {}).get(pid, 0); r = patron_rank(user, pid)
    nxt = RANK_AT[r] if r < 5 else None
    return {"id": pid, "name": p["name"], "short": p["short"], "role": p["role"], "portrait": p["portrait"], "wants": p["wants"], "favour": pts, "rank": r, "rank_name": RANKS[r - 1],
            "rank_at": RANK_AT[r - 1], "next_at": nxt, "title": p["title"],
            "perks": [_perk_view(k, r) for k in p["perks"]], "milestones": milestones(pid)}


def milestones(pid):
    """Ranks 2..5 with what each one unlocks, for the dots on the favour bar."""
    p = PATRONS[pid]; out = []
    for i in range(1, 5):
        rw = RANK_REWARDS[i]
        unlocks = [k["label"].format(n=k["per"][i]) for k in p["perks"] if k["per"][i] and k["per"][i] != k["per"][i - 1]]
        out.append({"rank": i + 1, "name": RANKS[i], "at": RANK_AT[i], "gold": rw["gold"], "pearls": rw["pearls"], "title": p["title"] if i == 4 else None,
                    "special": i == 4, "perks": unlocks})
    return out


def _perk_view(k, r):
    n_now = k["per"][r - 1]
    first = next(i for i, x in enumerate(k["per"]) if x)
    return {"key": k["key"], "active": n_now > 0, "label": k["label"].format(n=n_now if n_now else k["per"][first]), "at_rank": RANKS[first], "best": k["label"].format(n=k["per"][-1])}


async def state(user):
    pending = await ensure_board(user)
    uid = str(user["_id"])
    rows = await db.contracts.find({"user_id": uid, "status": {"$in": ["offered", "accepted"]}}).sort("offered_at", 1).to_list(50)
    fish = await keepnet(uid)
    accepted, offers = [], []
    for c in rows:
        h = have_for(c, fish)
        om = await db.listings.count_documents({"kind": "fish", "item.species_id": {"$in": list(SAME_SPECIES.get(c["species_id"], {c["species_id"]}))}, "status": "open"}) if c.get("species_id") else None
        (accepted if c["status"] == "accepted" else offers).append(contract_out(c, h, om))
    done_rows = await db.contracts.find({"user_id": uid, "status": "done", "dismissed": {"$ne": True}, "done_at": {"$gt": iso(now() - timedelta(hours=DONE_KEEP_HOURS))}}).sort("done_at", -1).to_list(10)
    accepted += [contract_out(c) for c in done_rows]
    offers.sort(key=lambda c: (-c["special"], c["patron"], c["tier"]))
    recent = await db.contracts.find({"user_id": uid, "status": "done"}).sort("done_at", -1).limit(8).to_list(8)
    today = now().strftime("%Y-%m-%d")
    _, day_start, day_end = quest_period("daily")
    return {"patrons": [patron_view(user, pid) for pid in PATRONS], "accepted": accepted, "offers": offers,
            "slots": {"used": sum(1 for c in accepted if c["status"] == "accepted"), "max": slots_for(user)}, "reroll_available": rerolls_left(user, today) > 0, "rerolls_left": rerolls_left(user, today), "rerolls_max": rerolls_max(user),
            "gold_mult": contract_gold_mult(user), "recent": [contract_out(c) for c in recent], "ranks": RANKS, "rank_at": RANK_AT,
            "done_today": await done_today(uid), "daily_cap": DAILY_CAP, "day_resets_at": iso(day_end), "incoming": pending, "refill_hours": REFILL_HOURS}


async def done_today(uid):
    _, day_start, _ = quest_period("daily")
    return await db.contracts.count_documents({"user_id": uid, "status": "done", "done_at": {"$gte": iso(day_start)}})


@api.get("/contracts")
async def get_contracts(request: Request, user=Depends(get_current_user)):
    return localize(await state(user), request)


@api.get("/contracts/wanted")
async def get_wanted(request: Request, user=Depends(get_current_user)):
    return localize({"wanted": await wanted(user)}, request)


@api.post("/contracts/{cid}/accept")
async def accept(cid: str, user=Depends(get_current_user)):
    uid = str(user["_id"])
    held = await db.contracts.count_documents({"user_id": uid, "status": "accepted"})
    # The daily cap counts filled + in-hand, so anything you accept can always be handed in.
    if await done_today(uid) + held >= DAILY_CAP: raise HTTPException(400, f"Between filled orders and the ones in your hands that's {DAILY_CAP} contracts today, hand in what you hold; the board reopens for new orders tomorrow")
    if held >= slots_for(user):
        raise HTTPException(400, f"You can only hold {slots_for(user)} contracts at a time, finish or abandon one first")
    t = now()
    r = await db.contracts.find_one_and_update({"_id": oid(cid), "user_id": uid, "status": "offered", "expires_at": {"$gt": iso(t)}},
                                               {"$set": {"status": "accepted", "accepted_at": iso(t), "deadline": iso(t + timedelta(hours=ACCEPT_HOURS))}})
    if not r: raise HTTPException(404, "That offer is no longer on the board")
    if await db.contracts.count_documents({"user_id": uid, "status": "accepted"}) > slots_for(user):
        await db.contracts.update_one({"_id": r["_id"]}, {"$set": {"status": "offered"}, "$unset": {"accepted_at": "", "deadline": ""}})
        raise HTTPException(400, "Your contract slots are full")
    await db.users.update_one({"_id": user["_id"]}, {"$push": {"contract_refills": iso(t + timedelta(hours=REFILL_HOURS))}})
    return await state(await db.users.find_one({"_id": user["_id"]}))


class DeliverIn(BaseModel):
    catch_ids: Optional[List[str]] = None


async def _rank_up(user, pid, before, after):
    """One-off rewards when a patron rank is first reached; returns list of rank-up dicts."""
    out = []
    for r in range(before + 1, after + 1):
        rw = RANK_REWARDS[r - 1]
        inc = {"gold": rw["gold"], "stats.gold_earned": rw["gold"]}
        if rw["pearls"]: inc["pearls"] = rw["pearls"]; inc["stats.pearls_earned"] = rw["pearls"]
        upd = {"$inc": inc, "$set": {f"favour_rank.{pid}": r}}
        title = PATRONS[pid]["title"] if r == 5 else None
        if title: upd["$addToSet"] = {"titles": title}
        if r == 5 and pid == "cook": upd.setdefault("$addToSet", {})["owned_frames"] = COOK_FRAME
        # Guard on the stored rank so a milestone can only ever pay once (favour never decreases; this also covers two deliveries racing).
        res = await db.users.update_one({"_id": user["_id"], "$or": [{f"favour_rank.{pid}": {"$lt": r}}, {f"favour_rank.{pid}": {"$exists": False}}]}, upd)
        if res.modified_count == 0: continue
        out.append({"patron": PATRONS[pid]["name"], "rank": RANKS[r - 1], "gold": rw["gold"], "pearls": rw["pearls"], "title": title, "frame": COOK_FRAME if r == 5 and pid == "cook" else None})
        if r == 5:
            await add_feed("contract", user["username"], f"{user['username']} is now an Old Friend of {PATRONS[pid]['name']}. The harbour's most trusted hands.", "epic")
    return out


@api.post("/contracts/{cid}/deliver")
async def deliver(cid: str, body: DeliverIn, user=Depends(get_current_user)):
    uid = str(user["_id"])
    c = await db.contracts.find_one({"_id": oid(cid), "user_id": uid, "status": "accepted"})
    if not c: raise HTTPException(404, "That contract isn't in your hands")
    rows = await keepnet(uid)
    if body.catch_ids:
        ids = {x for x in body.catch_ids}
        rows = [r for r in rows if str(r["_id"]) in ids]
        rows = [r for r in rows if matches(c, r)]
        need = target_of(c) - c.get("progress", 0)
        if c["kind"] != "weight": rows = rows[:int(math.ceil(need))]
    else:
        rows = pick_for(c, rows)
    if not rows: raise HTTPException(400, f"Nothing in your inventory fits this order, {c['text'].lower()}. Catch them or buy them on the market.")
    res = await db.catches.delete_many({"_id": {"$in": [r["_id"] for r in rows]}, "user_id": uid, "listed": False, "mounted": {"$ne": True}})
    if res.deleted_count != len(rows):
        rows = rows[:res.deleted_count]  # a sale raced us; count what actually left the inventory
    gained = sum(r["weight"] for r in rows) if c["kind"] == "weight" else len(rows)
    delivered = c.get("delivered", []) + [{"name": r["name"], "weight": r["weight"], "variant": r.get("variant", "normal")} for r in rows]
    prog = round(c.get("progress", 0) + gained, 2)
    done = prog >= target_of(c) - 1e-9
    # Every delivery renews the 48h deadline so a contract that is actively being worked on never quietly expires.
    upd = {"$set": {"progress": prog, "delivered": delivered, "deadline": iso(now() + timedelta(hours=ACCEPT_HOURS))}}
    if done: upd["$set"].update(status="done", done_at=iso(now()))
    r = await db.contracts.update_one({"_id": c["_id"], "status": "accepted"}, upd)
    result = {"delivered": len(rows), "progress": prog, "target": target_of(c), "done": done}
    if done and r.modified_count:
        pid = c["patron"]; before = patron_rank(user, pid)
        gold = int(c["gold"] * contract_gold_mult(user)) // 5 * 5
        inc = {"gold": gold, "xp": c["xp"], "stats.gold_earned": gold, "stats.contracts_done": 1, f"favour.{pid}": c["favour"], "stats.favour_total": c["favour"]}
        if c["pearls"]: inc["pearls"] = c["pearls"]; inc["stats.pearls_earned"] = c["pearls"]
        if c.get("special"): inc["stats.special_contracts"] = 1
        old_level, _ = level_from_xp(user["xp"])
        await db.users.update_one({"_id": user["_id"]}, {"$inc": inc})
        level_up = await settle_level_up(user["_id"], old_level)
        await db.contracts.update_one({"_id": c["_id"]}, {"$set": {"paid_gold": gold}})
        fresh = await db.users.find_one({"_id": user["_id"]})
        after = rank_for((fresh.get("favour") or {}).get(pid, 0))
        rank_ups = await _rank_up(fresh, pid, before, after) if after > before else []
        if c["tier"] >= 3 or c.get("special"):
            await add_feed("contract", user["username"], f"{user['username']} filled {'a special order' if c.get('special') else 'a contract'} for {PATRONS[pid]['name']}, {c['text'].lower()}.", "rare" if c["tier"] == 3 else "epic")
        qd = await quest_event(user["_id"], "contract", {"n": 1})
        new_ach = await check_achievements(user["_id"])
        result.update(gold=gold, xp=c["xp"], pearls=c["pearls"], favour=c["favour"], patron=PATRONS[pid]["name"], rank_ups=rank_ups, quests_done=qd, new_achievements=new_ach, level_up=level_up)
    fresh = await db.users.find_one({"_id": user["_id"]})
    result["user"] = public_user(fresh)
    result["state"] = await state(fresh)
    return result


@api.post("/contracts/{cid}/dismiss")
async def dismiss(cid: str, user=Depends(get_current_user)):
    r = await db.contracts.update_one({"_id": oid(cid), "user_id": str(user["_id"]), "status": "done"}, {"$set": {"dismissed": True}})
    if not r.matched_count: raise HTTPException(404, "No such filled contract")
    return await state(user)


@api.post("/contracts/{cid}/abandon")
async def abandon(cid: str, user=Depends(get_current_user)):
    uid = str(user["_id"])
    c = await db.contracts.find_one_and_update({"_id": oid(cid), "user_id": uid, "status": "accepted"}, {"$set": {"status": "abandoned", "abandoned_at": iso(now())}})
    if not c: raise HTTPException(404, "That contract isn't in your hands")
    pts = (user.get("favour") or {}).get(c["patron"], 0)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {f"favour.{c['patron']}": max(0, pts - ABANDON_FAVOUR)}})
    return {"favour_lost": min(pts, ABANDON_FAVOUR), "patron": PATRONS[c["patron"]]["name"], "state": await state(await db.users.find_one({"_id": user["_id"]}))}


def rerolls_max(user):
    return 2 if premium_active(user) else 1


def rerolls_left(user, today):
    rr = user.get("contract_rerolls") or {}
    used = rr.get("n", 0) if rr.get("day") == today else (1 if user.get("contract_reroll_day") == today else 0)
    return max(0, rerolls_max(user) - used)


@api.post("/contracts/{cid}/reroll")
async def reroll(cid: str, user=Depends(get_current_user)):
    uid = str(user["_id"]); today = now().strftime("%Y-%m-%d")
    left = rerolls_left(user, today)
    if left <= 0: raise HTTPException(400, "You've used today's swaps, the board refreshes on its own as orders expire" if rerolls_max(user) > 1 else "You've already swapped an offer today, the board refreshes on its own as orders expire")
    used = rerolls_max(user) - left
    r = await db.users.update_one({"_id": user["_id"], "$or": [{"contract_rerolls.day": {"$ne": today}}, {"contract_rerolls.n": used}]}, {"$set": {"contract_rerolls": {"day": today, "n": used + 1}}})
    if r.modified_count == 0: raise HTTPException(409, "Try again")
    c = await db.contracts.find_one_and_update({"_id": oid(cid), "user_id": uid, "status": "offered"}, {"$set": {"status": "rerolled"}})
    if not c:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"contract_rerolls": {"day": today, "n": used}}})
        raise HTTPException(404, "That offer is no longer on the board")
    return await state(await db.users.find_one({"_id": user["_id"]}))
