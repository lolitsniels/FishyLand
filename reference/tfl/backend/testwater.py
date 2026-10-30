"""Admin test water: a sandbox for trying new fight mechanics. No energy, no catch, no rewards.
Admins always have access and can grant it to other anglers (users.test_water = True)."""
import random

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import api, db, get_current_user, require_admin, is_admin_user, FISH, encounter_params
from admin_tools import log_action, find_target

MECHANICS = ["hookset", "needle", "rhythm"]
RARITY_W = {"common": 18, "uncommon": 18, "rare": 20, "epic": 18, "legendary": 15, "mythic": 11}


def has_access(u):
    return is_admin_user(u) or bool(u.get("test_water"))


async def require_tester(user=Depends(get_current_user)):
    if not has_access(user): raise HTTPException(403, "No access")
    return user


class CastIn(BaseModel):
    mechanics: list[str] = MECHANICS
    rarity: str = ""


@api.post("/testwater/cast")
async def test_cast(body: CastIn, user=Depends(require_tester)):
    pool = [f for f in FISH if not f.get("cage") and (not body.rarity or f["rarity"] == body.rarity)] or FISH
    weights = [RARITY_W.get(f["rarity"], 10) for f in pool]
    f = random.choices(pool, weights)[0]
    weight = round(random.uniform(f["min_kg"] + (f["max_kg"] - f["min_kg"]) * 0.5, f["max_kg"]), 3)
    variant = random.choice(["normal", "normal", "giant", "albino"])
    params = encounter_params(f, weight, user, variant, "cinder")
    params["mechanics"] = [m for m in body.mechanics if m in MECHANICS]
    params["test"] = True
    return {"fish": {"id": f["id"], "name": f["name"], "rarity": f["rarity"], "weight": weight, "variant": variant}, "params": params}


@api.get("/admin/testwater")
async def testers(admin=Depends(require_admin)):
    rows = await db.users.find({"test_water": True}, {"username": 1}).to_list(200)
    return {"testers": sorted(r["username"] for r in rows)}


class GrantIn(BaseModel):
    username: str
    grant: bool = True


@api.post("/admin/testwater")
async def grant_tester(body: GrantIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin, allow_self=True)
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"test_water": True}} if body.grant else {"$unset": {"test_water": ""}})
    await log_action(admin, u["username"], "testwater_grant" if body.grant else "testwater_revoke", "")
    return await testers(admin)
