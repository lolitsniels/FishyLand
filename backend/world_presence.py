"""Live positions of anglers walking the harbour / waters (in-memory, short-lived)."""
import time
from typing import Optional

from fastapi import Depends
from pydantic import BaseModel, Field

from server import api, get_current_user, level_from_xp, WATER_BY_KEY

STALE_SEC = 12
MAX_PEERS = 40
_pos: dict = {}


class PosIn(BaseModel):
    loc: str = Field(max_length=40)
    x: float = Field(ge=0, le=1300)
    y: float = Field(ge=0, le=900)
    phase: Optional[str] = Field(default="idle", max_length=12)


@api.post("/world/pos")
async def world_pos(body: PosIn, user=Depends(get_current_user)):
    loc = body.loc if body.loc == "harbour" or body.loc in WATER_BY_KEY else "harbour"
    uid = str(user["_id"])
    t = time.time()
    _pos[uid] = {"id": uid, "username": user["username"], "level": level_from_xp(user["xp"])[0], "title": user.get("active_title") or "",
                 "loc": loc, "x": round(body.x, 1), "y": round(body.y, 1), "phase": body.phase or "idle", "at": t}
    for k in [k for k, v in _pos.items() if t - v["at"] > STALE_SEC * 5]:
        _pos.pop(k, None)
    peers = [{k: v[k] for k in ("id", "username", "level", "title", "x", "y", "phase")}
             for v in _pos.values() if v["loc"] == loc and v["id"] != uid and t - v["at"] <= STALE_SEC]
    return {"players": peers[:MAX_PEERS], "here": len(peers) + 1}
