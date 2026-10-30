from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, oid, get_current_user, public_user, add_feed, CREW_MAX, manages, charge

PERKS = {
    "luck": {"name": "Lucky Charms", "unit": "+{n} luck on every cast", "costs": [9500, 25000, 62500], "per": [1, 2, 3]},
    "market": {"name": "Trade Licence", "unit": "+{n} market listing slots", "costs": [6500, 19000, 44000], "per": [2, 4, 6]},
    "energy": {"name": "Galley Rations", "unit": "+{n}% energy regeneration", "costs": [11500, 31500, 81500], "per": [10, 20, 30]},
    "repair": {"name": "Ship's Chandler", "unit": "-{n}% gear repair costs for every member", "costs": [7500, 22500, 56500], "per": [15, 30, 50]},
    "hall": {"name": "Crew Hall", "unit": "+{n} member capacity, hall banner & notice board", "costs": [6500, 22000, 69000], "per": [5, 10, 20]},
}
# Requirements to build each tier (index = tier being built - 1). Crews that already own a tier keep it.
TIER_REQS = [{}, {"members": 5, "orders": 5}, {"members": 10, "orders": 15, "bosses": 1}]
REQ_LABEL = {"members": "crew members", "orders": "crew orders filled", "bosses": "crew boss landed"}
HALL_NAMES = ["Dockside Shack", "Fishermen's Lodge", "Great Hall", "Harbour Palace"]
MARKET_SLOTS = 10
MIN_DEPOSIT = 10


def perk_value(perks, key):
    t = (perks or {}).get(key, 0)
    return PERKS[key]["per"][t - 1] if t else 0


def crew_max(c):
    return CREW_MAX + perk_value(c.get("perks"), "hall")


def crew_full(c):
    return len(c["members"]) >= crew_max(c)


def market_cap(user):
    return MARKET_SLOTS + perk_value((user.get("crew") or {}).get("perks"), "market")


def crew_progress(c):
    return {"members": len(c["members"]), "orders": c.get("orders_done", 0), "bosses": c.get("leviathans", 0)}


def tier_reqs(c, tier):
    have = crew_progress(c)
    return [{"key": k, "label": REQ_LABEL[k], "need": n, "have": have[k], "met": have[k] >= n} for k, n in TIER_REQS[tier].items()] if tier < 3 else []


def hall_out(c):
    perks = c.get("perks", {})
    defs = []
    for k, p in PERKS.items():
        t = perks.get(k, 0)
        defs.append({"key": k, "name": p["name"], "tier": t, "max": 3, "current": p["unit"].format(n=p["per"][t - 1]) if t else None,
                     "next": p["unit"].format(n=p["per"][t]) if t < 3 else None, "cost": p["costs"][t] if t < 3 else None, "reqs": tier_reqs(c, t)})
    return {"bank": c.get("bank", 0), "perks": perks, "defs": defs, "motd": c.get("motd", ""), "hall_name": HALL_NAMES[perks.get("hall", 0)],
            "hall_tier": perks.get("hall", 0), "max_members": crew_max(c), "log": c.get("hall_log", [])[-12:][::-1]}


class DepositIn(BaseModel):
    amount: int = Field(ge=MIN_DEPOSIT, le=100_000_000)


class BuyIn(BaseModel):
    perk: str


class MotdIn(BaseModel):
    text: str = Field(default="", max_length=300)


async def _member_crew(crew_id, user):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    if not any(m["user_id"] == str(user["_id"]) for m in c["members"]): raise HTTPException(403, "Members only")
    return c


@api.get("/crews/{crew_id}/hall")
async def crew_hall(crew_id: str, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    out = hall_out(c)
    if not any(m["user_id"] == str(user["_id"]) for m in c["members"]):
        out["bank"] = None; out["log"] = []
    return out


@api.post("/crews/{crew_id}/hall/deposit")
async def hall_deposit(crew_id: str, body: DepositIn, user=Depends(get_current_user)):
    c = await _member_crew(crew_id, user)
    from botwatch import guard_trade
    guard_trade(user)
    await charge(user, {}, gold=body.amount)
    await db.crews.update_one({"_id": c["_id"]}, {"$inc": {"bank": body.amount},
                                                  "$push": {"hall_log": {"$each": [{"who": user["username"], "text": f"deposited {body.amount:,} gold", "at": iso(now())}], "$slice": -50}}})
    from crew_extras import crew_log
    await crew_log(c["_id"], user["username"], f"deposited {body.amount:,} gold into the bank", "bank")
    return {"hall": hall_out(await db.crews.find_one({"_id": c["_id"]})), "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/crews/{crew_id}/hall/buy")
async def hall_buy(crew_id: str, body: BuyIn, user=Depends(get_current_user)):
    c = await _member_crew(crew_id, user)
    if not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can buy upgrades")
    p = PERKS.get(body.perk)
    if not p: raise HTTPException(400, "Unknown upgrade")
    perks = dict(c.get("perks", {}))
    t = perks.get(body.perk, 0)
    if t >= 3: raise HTTPException(400, f"{p['name']} is already at its highest tier")
    missing = [f"{r['need']} {r['label']} (has {r['have']})" for r in tier_reqs(c, t) if not r["met"]]
    if missing: raise HTTPException(400, f"{p['name']} tier {t + 1} needs " + ", ".join(missing))
    cost = p["costs"][t]
    if c.get("bank", 0) < cost: raise HTTPException(400, f"The crew bank needs {cost:,} gold for that (has {c.get('bank', 0):,})")
    perks[body.perk] = t + 1
    r = await db.crews.update_one({"_id": c["_id"], "bank": {"$gte": cost}, f"perks.{body.perk}": {"$in": [t, None]}},
                                  {"$inc": {"bank": -cost}, "$set": {"perks": perks},
                                   "$push": {"hall_log": {"$each": [{"who": user["username"], "text": f"bought {p['name']} tier {t + 1}", "at": iso(now())}], "$slice": -50}}})
    if r.matched_count == 0: raise HTTPException(409, "That upgrade was just bought, refresh the hall")
    await db.users.update_many({"crew.id": crew_id}, {"$set": {"crew.perks": perks}})
    from crew_extras import crew_log
    await crew_log(c["_id"], user["username"], f"built {p['name']} tier {t + 1}", "hall")
    await db.chat.insert_one({"channel": "crew", "crew_id": crew_id, "username": "Harbourmaster", "level": 0, "at": iso(now()),
                              "text": f"The crew hall grows: {p['name']} tier {t + 1}, {p['unit'].format(n=p['per'][t])} for every member."})
    if t + 1 == 3:
        await add_feed("crew", user["username"], f"Crew [{c['tag']}] {c['name']} completed {p['name']} at its highest tier.", "epic")
    return {"hall": hall_out(await db.crews.find_one({"_id": c["_id"]})), "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/crews/{crew_id}/hall/motd")
async def hall_motd(crew_id: str, body: MotdIn, user=Depends(get_current_user)):
    c = await _member_crew(crew_id, user)
    if not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can write on the notice board")
    if not c.get("perks", {}).get("hall"): raise HTTPException(400, "Buy the Crew Hall upgrade first to unlock the notice board")
    await db.crews.update_one({"_id": c["_id"]}, {"$set": {"motd": body.text.strip()}})
    return {"ok": True}
