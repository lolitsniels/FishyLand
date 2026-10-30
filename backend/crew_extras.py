"""Crew extras: activity feed, leader-only bank withdrawals (25%/24h cap) and a paid emblem colour."""
from datetime import timedelta
from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, get_current_user, public_user, oid

WITHDRAW_SHARE = 0.25          # of (bank + already withdrawn in the window) per rolling 24h
WITHDRAW_WINDOW_H = 24
COLOUR_COST = 25_000           # paid from the crew bank
COLOURS = {"gold": "#f0c27a", "crimson": "#e0554f", "ember": "#f08a3c", "jade": "#4fc98a", "teal": "#3fbfc9", "sky": "#5aa9f0",
           "violet": "#9b7cf0", "rose": "#f07aa8", "ivory": "#f4ead2", "steel": "#9fb0bf"}


async def crew_log(crew_id, who, text, kind="misc"):
    await db.crew_activity.insert_one({"crew_id": str(crew_id), "who": who, "text": text, "kind": kind, "at": iso(now())})


async def _crew(crew_id):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    return c


def _is_member(c, user): return any(m["user_id"] == str(user["_id"]) for m in c["members"])
def _is_leader(c, user): return c["leader"] == user["username"]


@api.get("/crews/{crew_id}/activity")
async def crew_activity(crew_id: str, user=Depends(get_current_user)):
    c = await _crew(crew_id)
    if not _is_member(c, user): raise HTTPException(403, "Only crew members can read the crew log")
    rows = await db.crew_activity.find({"crew_id": str(c["_id"])}, {"_id": 0}).sort("at", -1).limit(60).to_list(60)
    return {"events": rows}


class WithdrawIn(BaseModel):
    amount: int = Field(ge=1, le=100_000_000)


def withdraw_allowance(c):
    cut = iso(now() - timedelta(hours=WITHDRAW_WINDOW_H))
    recent = sum(w["amount"] for w in c.get("withdrawals", []) if w["at"] >= cut)
    return max(0, int((c.get("bank", 0) + recent) * WITHDRAW_SHARE) - recent), recent


@api.get("/crews/{crew_id}/hall/withdraw")
async def withdraw_info(crew_id: str, user=Depends(get_current_user)):
    c = await _crew(crew_id)
    if not _is_leader(c, user): raise HTTPException(403, "Only the crew leader can withdraw from the bank")
    allowed, recent = withdraw_allowance(c)
    return {"allowed": allowed, "withdrawn_24h": recent, "share_pct": int(WITHDRAW_SHARE * 100), "window_h": WITHDRAW_WINDOW_H}


@api.post("/crews/{crew_id}/hall/withdraw")
async def withdraw(crew_id: str, body: WithdrawIn, user=Depends(get_current_user)):
    c = await _crew(crew_id)
    if not _is_leader(c, user): raise HTTPException(403, "Only the crew leader can withdraw from the bank")
    allowed, _ = withdraw_allowance(c)
    if body.amount > allowed:
        raise HTTPException(400, f"The crew allows at most {WITHDRAW_SHARE:.0%} of the bank out per {WITHDRAW_WINDOW_H}h, {allowed:,} gold more right now")
    cut = iso(now() - timedelta(hours=WITHDRAW_WINDOW_H * 2))
    r = await db.crews.update_one({"_id": c["_id"], "bank": {"$gte": body.amount}},
                                  {"$inc": {"bank": -body.amount},
                                   "$push": {"withdrawals": {"amount": body.amount, "at": iso(now())},
                                             "hall_log": {"$each": [{"who": user["username"], "text": f"withdrew {body.amount:,} gold", "at": iso(now())}], "$slice": -50}}})
    if not r.modified_count: raise HTTPException(400, "The bank doesn't hold that much")
    await db.crews.update_one({"_id": c["_id"]}, {"$pull": {"withdrawals": {"at": {"$lt": cut}}}})
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"gold": body.amount}})
    await crew_log(c["_id"], user["username"], f"withdrew {body.amount:,} gold from the bank", "bank")
    from crew_hall import hall_out
    return {"hall": hall_out(await db.crews.find_one({"_id": c["_id"]})), "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


class ColourIn(BaseModel):
    colour: Optional[str] = Field(default=None, max_length=12)


@api.get("/crew-colours")
async def crew_colours():
    return {"colours": COLOURS, "cost": COLOUR_COST}


@api.post("/crews/{crew_id}/colour")
async def set_colour(crew_id: str, body: ColourIn, user=Depends(get_current_user)):
    c = await _crew(crew_id)
    if not _is_leader(c, user): raise HTTPException(403, "Only the crew leader can choose the emblem colour")
    if body.colour is not None and body.colour not in COLOURS: raise HTTPException(400, "Pick one of the harbour's dyes")
    hex_ = COLOURS.get(body.colour) if body.colour else None
    if hex_ == c.get("colour"): return {"colour": hex_, "colour_key": body.colour}
    r = await db.crews.update_one({"_id": c["_id"], "bank": {"$gte": COLOUR_COST}},
                                  {"$inc": {"bank": -COLOUR_COST}, "$set": {"colour": hex_, "colour_key": body.colour},
                                   "$push": {"hall_log": {"$each": [{"who": user["username"], "text": f"dyed the emblem {body.colour or 'plain'} ({COLOUR_COST:,} gold)", "at": iso(now())}], "$slice": -50}}})
    if not r.modified_count: raise HTTPException(400, f"Dyeing the emblem costs {COLOUR_COST:,} gold from the crew bank (has {c.get('bank', 0):,})")
    await db.users.update_many({"crew.id": str(c["_id"])}, {"$set": {"crew.colour": hex_}})
    await crew_log(c["_id"], user["username"], f"dyed the crew emblem {body.colour or 'plain'}", "emblem")
    return {"colour": hex_, "colour_key": body.colour}
