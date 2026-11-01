"""Reel and line are simple upgrade tracks (levels 1-10, Pearls only). Rods are the only tackle bought in the shop."""
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import api, db, get_current_user, public_user, charge, apply_energy_live

MAX_LEVEL = 10
COSTS = [3, 5, 8, 12, 16, 20, 25, 30, 40]  # Pearls to go from level n to n+1
TRACKS = {
    "reel": {"name": "Reel", "stat": "recovery", "base": 1.0, "step": 0.12, "perk": "sell value", "desc": "Lets the needle drift back faster when you let go."},
    "line": {"name": "Line", "stat": "tolerance", "base": 1.0, "step": 0.11, "perk": "XP", "desc": "Holds longer at the edge of the bar before it snaps."},
}


def level(user, slot):
    return max(1, min(MAX_LEVEL, int((user.get("tackle") or {}).get(slot, 1))))


def stat(user, slot):
    t = TRACKS[slot]
    return round(t["base"] + t["step"] * (level(user, slot) - 1), 3)


def perk_pct(user, slot):
    return (level(user, slot) - 1) * 2


def view(user):
    return {s: {"level": level(user, s), "max": MAX_LEVEL, "stat": stat(user, s), "perk_pct": perk_pct(user, s),
                "next_cost": COSTS[level(user, s) - 1] if level(user, s) < MAX_LEVEL else None} for s in TRACKS}


INFO = {"max_level": MAX_LEVEL, "costs": COSTS, "tracks": TRACKS}


class UpgradeIn(BaseModel):
    slot: str


@api.post("/tackle/upgrade")
async def upgrade(body: UpgradeIn, user=Depends(get_current_user)):
    if body.slot not in TRACKS: raise HTTPException(400, "Only the reel and line can be upgraded")
    lv = level(user, body.slot)
    if lv >= MAX_LEVEL: raise HTTPException(400, f"Your {TRACKS[body.slot]['name'].lower()} is already at max level")
    cost = COSTS[lv - 1]
    await charge(user, {"$set": {f"tackle.{body.slot}": lv + 1}}, pearls=cost, extra={f"tackle.{body.slot}": {"$in": [lv, None] if lv == 1 else [lv]}},
                 msg=f"You need {cost} Pearls for this upgrade")
    return {"user": public_user(await apply_energy_live(await db.users.find_one({"_id": user["_id"]})))}
