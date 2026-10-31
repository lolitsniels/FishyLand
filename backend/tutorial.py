"""First-hour tutorial: progress lives on the user (`tutorial: {step, done, skipped?, rewarded?}`). Reward is a handful of cheap bait, paid once."""
from pydantic import BaseModel, Field
from fastapi import Depends

from server import api, db, get_current_user, public_user, apply_energy_live

REWARD_BAIT = {"bait_worm": 10, "bait_bread": 10}
REWARD_PEARLS = 10
LAST_STEP = 10


class StepIn(BaseModel):
    step: int = Field(ge=0, le=LAST_STEP)


async def _fresh(user):
    return public_user(await apply_energy_live(await db.users.find_one({"_id": user["_id"]})))


@api.post("/tutorial/step")
async def tutorial_step(body: StepIn, user=Depends(get_current_user)):
    t = user.get("tutorial") or {}
    if not t.get("done"):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"tutorial.step": max(body.step, t.get("step", 0))}})
    return {"user": await _fresh(user)}


@api.post("/tutorial/skip")
async def tutorial_skip(user=Depends(get_current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"tutorial.done": True, "tutorial.skipped": True}})
    return {"user": await _fresh(user)}


@api.post("/tutorial/complete")
async def tutorial_complete(user=Depends(get_current_user)):
    t = user.get("tutorial") or {}
    reward = None
    if not t.get("rewarded"):
        r = await db.users.update_one({"_id": user["_id"], "tutorial.rewarded": {"$ne": True}},
                                      {"$set": {"tutorial.done": True, "tutorial.rewarded": True, "tutorial.step": LAST_STEP}, "$inc": {"pearls": REWARD_PEARLS, **{f"bait.{k}": v for k, v in REWARD_BAIT.items()}}})
        if r.modified_count: reward = {**REWARD_BAIT, "pearls": REWARD_PEARLS}
    else:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"tutorial.done": True, "tutorial.step": LAST_STEP}})
    return {"user": await _fresh(user), "reward": reward}


@api.post("/tutorial/restart")
async def tutorial_restart(user=Depends(get_current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"tutorial.step": 0, "tutorial.done": False, "tutorial.skipped": False}})
    return {"user": await _fresh(user)}
