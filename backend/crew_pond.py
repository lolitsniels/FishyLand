"""Crew Pond: leaders/officers stock species one by one with crew bank gold; members fish them only on their crew island."""
import random

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import api, db, now, iso, oid, get_current_user, manages, rarity_weights
from game_data import POND_FISH

POND_BY_ID = {f["id"]: f for f in POND_FISH}


class StockIn(BaseModel):
    species_id: int


async def stocked_for(user):
    cid = (user.get("crew") or {}).get("id")
    if not cid: raise HTTPException(403, "Only crew members can fish a crew pond")
    c = await db.crews.find_one({"_id": oid(cid)}, {"pond": 1})
    if not c: raise HTTPException(404, "No such crew")
    fish = [POND_BY_ID[i] for i in c.get("pond", []) if i in POND_BY_ID]
    if not fish: raise HTTPException(400, "The crew pond has no fish yet. Ask the Pond Keeper to stock it.")
    return fish


def pick(stocked, luck, bait_id):
    w = rarity_weights(luck, bait_id)
    return random.choices(stocked, weights=[w[f["rarity"]] for f in stocked])[0]


async def _pond_out(c, user):
    stocked = c.get("pond", [])
    mine = {r["species_id"] for r in await db.journal.find({"user_id": str(user["_id"]), "species_id": {"$in": list(POND_BY_ID)}}, {"species_id": 1}).to_list(50)}
    nxt = next((f["id"] for f in POND_FISH if f["id"] not in stocked), None)
    species = [{"id": f["id"], "name": f["name"], "rarity": f["rarity"], "min_kg": f["min_kg"], "max_kg": f["max_kg"], "blurb": f["blurb"],
                "cost": f["stock_cost"], "stocked": f["id"] in stocked, "next": f["id"] == nxt, "caught": f["id"] in mine} for f in POND_FISH]
    return {"bank": c.get("bank", 0), "stocked": len(stocked), "total": len(POND_FISH), "species": species,
            "can_manage": manages(c, str(user["_id"]))}


async def _member_crew(crew_id, user):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    if not any(m["user_id"] == str(user["_id"]) for m in c["members"]): raise HTTPException(403, "Members only")
    return c


@api.get("/crews/{crew_id}/pond")
async def pond_info(crew_id: str, user=Depends(get_current_user)):
    return await _pond_out(await _member_crew(crew_id, user), user)


@api.post("/crews/{crew_id}/pond/stock")
async def pond_stock(crew_id: str, body: StockIn, user=Depends(get_current_user)):
    c = await _member_crew(crew_id, user)
    if not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can stock the pond")
    f = POND_BY_ID.get(body.species_id)
    if not f: raise HTTPException(400, "Unknown pond fish")
    stocked = c.get("pond", [])
    if f["id"] in stocked: raise HTTPException(400, f"{f['name']} already swims in the pond")
    nxt = next((x for x in POND_FISH if x["id"] not in stocked), None)
    if nxt["id"] != f["id"]: raise HTTPException(400, f"Stock the {nxt['name']} first, the pond fills up in order")
    cost = f["stock_cost"]
    if c.get("bank", 0) < cost: raise HTTPException(400, f"The crew bank needs {cost:,} gold for that (has {c.get('bank', 0):,})")
    r = await db.crews.update_one({"_id": c["_id"], "bank": {"$gte": cost}, "pond": {"$ne": f["id"]}, "$expr": {"$eq": [{"$size": {"$ifNull": ["$pond", []]}}, len(stocked)]}},
                                  {"$inc": {"bank": -cost}, "$push": {"pond": f["id"], "hall_log": {"$each": [{"who": user["username"], "text": f"stocked the pond with {f['name']}", "at": iso(now())}], "$slice": -50}}})
    if r.matched_count == 0: raise HTTPException(409, "The pond just changed, have another look")
    from crew_extras import crew_log
    await crew_log(c["_id"], user["username"], f"stocked the crew pond with {f['name']}", "hall")
    await db.chat.insert_one({"channel": "crew", "crew_id": crew_id, "username": "Pond Keeper", "level": 0, "at": iso(now()),
                              "text": f"Splash! {f['name']} ({f['rarity']}) now swims in the crew pond. Come and catch one!"})
    return await _pond_out(await db.crews.find_one({"_id": c["_id"]}), user)
