"""Live positions of anglers walking the harbour / waters (in-memory, short-lived)."""
import time
from typing import Optional

from fastapi import Depends
from pydantic import BaseModel, Field

from fastapi import HTTPException

from server import api, db, get_current_user, level_from_xp, public_user, WATER_BY_KEY, LOOK_RE, look_of

STALE_SEC = 12
MAX_PEERS = 40
_pos: dict = {}


class PosIn(BaseModel):
    loc: str = Field(max_length=40)
    x: float = Field(ge=0, le=6000)
    y: float = Field(ge=0, le=6000)
    phase: Optional[str] = Field(default="idle", max_length=12)


@api.post("/world/pos")
async def world_pos(body: PosIn, user=Depends(get_current_user)):
    crew = (user.get("crew") or {}).get("id")
    loc = f"crew:{crew}" if body.loc == "crew_island" and crew else body.loc if body.loc == "harbour" or body.loc in WATER_BY_KEY else "harbour"
    uid = str(user["_id"])
    t = time.time()
    _pos[uid] = {"id": uid, "username": user["username"], "level": level_from_xp(user["xp"])[0], "title": user.get("active_title") or "", "look": look_of(user.get("avatar")), "rod": (user.get("gear") or {}).get("rod", "rod_cane"),
                 "loc": loc, "x": round(body.x, 1), "y": round(body.y, 1), "phase": body.phase or "idle", "at": t}
    for k in [k for k, v in _pos.items() if t - v["at"] > STALE_SEC * 5]:
        _pos.pop(k, None)
    peers = [{k: v[k] for k in ("id", "username", "level", "title", "look", "rod", "x", "y", "phase")}
             for v in _pos.values() if v["loc"] == loc and v["id"] != uid and t - v["at"] <= STALE_SEC]
    return {"players": peers[:MAX_PEERS], "here": len(peers) + 1}


class LookIn(BaseModel):
    avatar: str = Field(max_length=20)


@api.post("/me/look")
async def set_look(body: LookIn, user=Depends(get_current_user)):
    if not LOOK_RE.match(body.avatar):
        raise HTTPException(400, "Unknown character look")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": body.avatar}})
    user["avatar"] = body.avatar
    return {"user": public_user(user)}
