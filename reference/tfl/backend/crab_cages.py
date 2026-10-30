"""Crab Cages: buy single-use cages, drop one at a water, come back up to 8 hours later and haul up what crawled in."""
import random
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import (api, db, now, iso, get_current_user, charge, public_user, level_from_xp, settle_level_up, xp_multiplier, add_feed,
                    roll_weight, fish_value, catch_ledger, WATER_BY_KEY, RARITY_XP)
from cages_data import CAGES, CAGE_BY_ID, CAGE_FISH_BY_WATER, MAX_SOAK_H, CAGE_XP_MULT


def schedule(cage, start):
    """Pre-rolled catch times: one every 20-60 min (by cage), up to the 8 h soak limit."""
    out, t, end = [], start, start + timedelta(hours=MAX_SOAK_H)
    while True:
        t += timedelta(minutes=random.uniform(*cage["gap"]))
        if t > end: return out
        out.append(iso(t))


def cage_out(doc, t):
    due = [x for x in doc["times"] if x <= iso(t)]
    end = datetime.fromisoformat(doc["placed_at"]) + timedelta(hours=MAX_SOAK_H)
    nxt = next((x for x in doc["times"] if x > iso(t)), None)
    c = CAGE_BY_ID[doc["cage"]]
    return {"water": doc["water"], "water_name": WATER_BY_KEY[doc["water"]]["name"], "cage": c["id"], "cage_name": c["name"], "placed_at": doc["placed_at"],
            "ends_at": iso(end), "caught": len(due), "max": len(doc["times"]), "next_at": nxt, "full": t >= end}


@api.get("/cages")
async def cages_state(user=Depends(get_current_user)):
    t = now()
    placed = await db.crab_cages.find({"user_id": str(user["_id"])}).to_list(20)
    items = user.get("items") or {}
    return {"max_hours": MAX_SOAK_H, "cages": [{k: v for k, v in c.items() if k != "weights"} | {"owned": items.get(c["id"], 0), "odds": c["weights"]} for c in CAGES],
            "placed": [cage_out(p, t) for p in placed]}


class BuyIn(BaseModel):
    cage_id: str
    qty: int = Field(1, ge=1, le=20)


@api.post("/cages/buy")
async def buy_cage(body: BuyIn, user=Depends(get_current_user)):
    c = CAGE_BY_ID.get(body.cage_id)
    if not c: raise HTTPException(404, "Unknown cage")
    if level_from_xp(user["xp"])[0] < c["level"]: raise HTTPException(400, f"The {c['name']} needs level {c['level']}")
    gold, pearls = c["price"] * body.qty, c["pearls"] * body.qty
    await charge(user, {"$inc": {f"items.{c['id']}": body.qty}}, gold=gold, pearls=pearls, msg=f"You need {f'{pearls} Pearls' if pearls else f'{gold} gold'} for that")
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


class PlaceIn(BaseModel):
    cage_id: str


@api.post("/cages/place")
async def place_cage(body: PlaceIn, user=Depends(get_current_user)):
    c = CAGE_BY_ID.get(body.cage_id)
    if not c: raise HTTPException(404, "Unknown cage")
    w = user["water"]
    if w not in CAGE_FISH_BY_WATER: raise HTTPException(400, "Crab cages can't be dropped here")
    if await db.crab_cages.find_one({"user_id": str(user["_id"]), "water": w}): raise HTTPException(400, "You already have a cage down here. Haul it first.")
    r = await db.users.update_one({"_id": user["_id"], f"items.{c['id']}": {"$gte": 1}}, {"$inc": {f"items.{c['id']}": -1}})
    if not r.modified_count: raise HTTPException(400, f"You don't have a {c['name']}. Buy one in the Tackle Shop.")
    t = now()
    doc = {"user_id": str(user["_id"]), "water": w, "cage": c["id"], "placed_at": iso(t), "times": schedule(c, t)}
    try:
        await db.crab_cages.insert_one(doc)
    except Exception:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {f"items.{c['id']}": 1}})
        raise HTTPException(400, "You already have a cage down here. Haul it first.")
    return {"placed": cage_out(doc, t), "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


def roll_critter(cage, water):
    pool = CAGE_FISH_BY_WATER[water]
    rarity = random.choices(list(cage["weights"]), weights=list(cage["weights"].values()))[0]
    return next(f for f in pool if f["rarity"] == rarity)


@api.post("/cages/haul")
async def haul_cage(user=Depends(get_current_user)):
    w = user["water"]
    doc = await db.crab_cages.find_one_and_delete({"user_id": str(user["_id"]), "water": w})
    if not doc: raise HTTPException(400, "You have no cage down at this water")
    try:
        return await _haul(user, w, doc)
    except Exception:
        doc.pop("_id", None); await db.crab_cages.insert_one(doc)  # put the cage back if anything failed mid-haul
        raise


async def _haul(user, w, doc):
    t = now()
    cage = CAGE_BY_ID[doc["cage"]]
    n = len([x for x in doc["times"] if x <= iso(t)])
    boost = await xp_multiplier()
    catches, xp, legendary = [], 0, 0
    for _ in range(n):
        f = roll_critter(cage, w)
        weight = roll_weight(f)
        xp += int(round((RARITY_XP[f["rarity"]] + int(weight ** 0.5 * 3)) * CAGE_XP_MULT)) * boost
        legendary += f["rarity"] == "legendary"
        catches.append({"user_id": str(user["_id"]), "username": user["username"], "species_id": f["id"], "name": f["name"], "rarity": f["rarity"],
                        "weight": weight, "length_cm": round((weight ** (1 / 3)) * 30, 1), "variant": "normal", "value": fish_value(f, weight, 1.0), "water": w,
                        "caught_at": iso(t), "listed": False, "mounted": False, "caught_by": str(user["_id"]), "caught_by_name": user["username"],
                        "crew_id": (user.get("crew") or {}).get("id"), "cage": cage["id"]})
    new_species = 0
    if catches:
        await db.catches.insert_many(catches)
        await db.catch_log.insert_many([catch_ledger(c) for c in catches])
        for c in catches:
            j = await db.journal.find_one_and_update({"user_id": str(user["_id"]), "species_id": c["species_id"]},
                                                     {"$inc": {"count": 1}, "$max": {"best_kg": c["weight"]}, "$addToSet": {"variants": "normal"},
                                                      "$setOnInsert": {"first_at": iso(t)}}, upsert=True)
            if j is None: new_species += 1
    old_level, _ = level_from_xp(user["xp"])
    inc = {"xp": xp, "stats.catches": n, "stats.cage_hauls": 1, "stats.cage_catches": n}
    if new_species: inc["stats.species"] = new_species
    if legendary: inc["stats.legendary"] = legendary
    await db.users.update_one({"_id": user["_id"]}, {"$inc": inc})
    for c in catches:
        if c["rarity"] in ("epic", "legendary"):
            await add_feed("catch", user["username"], f"{user['username']} hauled a {c['name']} ({c['weight']} kg) out of a crab cage at {WATER_BY_KEY[w]['name']}.", c["rarity"])
    await settle_level_up(user["_id"], old_level)
    out = [{"species_id": c["species_id"], "name": c["name"], "rarity": c["rarity"], "weight": c["weight"], "value": c["value"]} for c in catches]
    return {"cage_name": cage["name"], "water_name": WATER_BY_KEY[w]["name"], "caught": out, "xp": xp, "new_species": new_species,
            "user": public_user(await db.users.find_one({"_id": user["_id"]}))}
