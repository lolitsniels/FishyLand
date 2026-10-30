from datetime import datetime

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, oid, get_current_user, is_admin_user, mute_active
from avatars_data import colour_hex

GUESTBOOK_LIMIT = 30
GUESTBOOK_MAX_CHARS = 300
GUESTBOOK_COOLDOWN_SEC = 30


class PostIn(BaseModel):
    text: str = Field(min_length=1, max_length=GUESTBOOK_MAX_CHARS)


def entry_out(e, viewer, owner_id):
    return {"id": str(e["_id"]), "author": e["author_username"], "author_avatar": e.get("author_avatar"),
            "author_frame": e.get("author_frame"), "author_colour": e.get("author_colour"),
            "author_admin": e.get("author_admin", False), "text": e["text"], "at": e["at"],
            "can_delete": bool(viewer) and (str(viewer["_id"]) == e["author_id"] or is_admin_user(viewer) or str(viewer["_id"]) == owner_id)}


async def _find_owner(username: str):
    u = await db.users.find_one({"username_lc": username.lower()})
    if not u: raise HTTPException(404, "No such angler")
    return u


@api.get("/players/{username}/guestbook")
async def list_guestbook(username: str, viewer=Depends(get_current_user)):
    owner = await _find_owner(username)
    rows = await db.guestbook.find({"profile_id": str(owner["_id"])}).sort("at", -1).limit(GUESTBOOK_LIMIT).to_list(GUESTBOOK_LIMIT)
    # Owner viewing their own book resets the unread badge.
    if str(viewer["_id"]) == str(owner["_id"]):
        await db.users.update_one({"_id": viewer["_id"]}, {"$set": {"guestbook_seen_at": iso(now())}})
    return {"entries": [entry_out(e, viewer, str(owner["_id"])) for e in rows],
            "can_post": not viewer.get("is_guest") and not mute_active(viewer) and not viewer.get("banned"),
            "guest": bool(viewer.get("is_guest")), "muted": bool(mute_active(viewer)),
            "wall": owner.get("wall"),
            "max_chars": GUESTBOOK_MAX_CHARS, "cooldown_sec": GUESTBOOK_COOLDOWN_SEC}


@api.get("/guestbook/unread")
async def guestbook_unread(viewer=Depends(get_current_user)):
    seen = viewer.get("guestbook_seen_at") or viewer.get("created_at")
    # Count entries on the viewer's book from other authors after they last opened it.
    n = await db.guestbook.count_documents({"profile_id": str(viewer["_id"]), "author_id": {"$ne": str(viewer["_id"])}, "at": {"$gt": seen}})
    return {"unread": n}


@api.post("/players/{username}/guestbook")
async def post_guestbook(username: str, body: PostIn, viewer=Depends(get_current_user)):
    if viewer.get("is_guest"): raise HTTPException(403, "Claim your account before signing guestbooks")
    if mute_active(viewer): raise HTTPException(403, "You are muted and cannot sign guestbooks")
    if viewer.get("banned"): raise HTTPException(403, "Banned accounts cannot post")
    owner = await _find_owner(username)
    last = await db.guestbook.find_one({"author_id": str(viewer["_id"])}, sort=[("at", -1)])
    if last:
        gap = (now() - datetime.fromisoformat(last["at"])).total_seconds()
        if gap < GUESTBOOK_COOLDOWN_SEC:
            raise HTTPException(429, f"Wait {int(GUESTBOOK_COOLDOWN_SEC - gap)}s before signing again")
    doc = {"profile_id": str(owner["_id"]), "author_id": str(viewer["_id"]), "author_username": viewer["username"],
           "author_avatar": viewer.get("avatar"), "author_frame": viewer.get("frame"),
           "author_colour": colour_hex(viewer), "author_admin": is_admin_user(viewer),
           "text": body.text.strip(), "at": iso(now())}
    r = await db.guestbook.insert_one(doc)
    doc["_id"] = r.inserted_id
    return entry_out(doc, viewer, str(owner["_id"]))


@api.delete("/players/{username}/guestbook/{entry_id}")
async def delete_guestbook(username: str, entry_id: str, viewer=Depends(get_current_user)):
    owner = await _find_owner(username)
    e = await db.guestbook.find_one({"_id": oid(entry_id), "profile_id": str(owner["_id"])})
    if not e: raise HTTPException(404, "Entry not found")
    if not (str(viewer["_id"]) == e["author_id"] or is_admin_user(viewer) or str(viewer["_id"]) == str(owner["_id"])):
        raise HTTPException(403, "Not allowed")
    await db.guestbook.delete_one({"_id": e["_id"]})
    return {"ok": True}
