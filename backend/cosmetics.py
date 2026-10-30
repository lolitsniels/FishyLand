"""Pearls shop: avatars and name changes. Pearls are the rare cosmetic currency."""
import re
from typing import Optional
from fastapi import Depends, HTTPException, Response
from pydantic import BaseModel, Field

from server import api, db, now, iso, get_current_user, public_user, add_feed, rename_user, make_token, set_auth, charge
from friends import friend_slots, friend_count, FRIEND_SLOT_PACK, FRIEND_SLOT_PACK_COST, MAX_FRIEND_SLOTS
from avatars_data import AVATARS, AVATAR_BY_ID, NAME_COLOURS, COLOUR_BY_ID, FRAMES, FRAME_BY_ID, WALLS, WALL_BY_ID

RENAME_COST = 30
REPAIR_RATE = 0.01  # gold per durability point = price * rate (min 1g), starter gear free


def owned_avatars(u):
    return set(u.get("owned_avatars") or []) | {a["id"] for a in AVATARS if a["price"] == 0}


@api.get("/cosmetics")
async def cosmetics(user=Depends(get_current_user)):
    have = owned_avatars(user)
    cols = set(user.get("owned_colours") or [])
    frames = set(user.get("owned_frames") or [])
    walls = set(user.get("owned_walls") or [])
    return {"pearls": user.get("pearls", 0), "rename_cost": RENAME_COST, "avatar": user.get("avatar"), "name_colour": user.get("name_colour"),
            "frame": user.get("frame"), "wall": user.get("wall"),
            "friend_slots": {"have": friend_slots(user), "used": await friend_count(str(user["_id"])), "pack": FRIEND_SLOT_PACK, "cost": FRIEND_SLOT_PACK_COST, "max": MAX_FRIEND_SLOTS},
            "avatars": [{**{k: a[k] for k in ("id", "name", "sex", "price")}, "owned": a["id"] in have} for a in AVATARS if a["price"] is not None or a["id"] in have],
            "colours": [{**c, "owned": c["id"] in cols} for c in NAME_COLOURS if c["price"] is not None or c["id"] in cols],
            "frames": [{**f, "owned": f["id"] in frames} for f in FRAMES if f["price"] is not None or f["id"] in frames],
            "walls": [{**w, "owned": w["id"] in walls} for w in WALLS]}


class WallIn(BaseModel):
    wall_id: Optional[str] = None  # None = plain panel


@api.post("/cosmetics/buy-wall")
async def buy_wall(body: WallIn, user=Depends(get_current_user)):
    w = WALL_BY_ID.get(body.wall_id or "")
    if not w: raise HTTPException(404, "Unknown wall")
    if w["id"] in (user.get("owned_walls") or []): raise HTTPException(400, "You already own that wall theme")
    if user.get("pearls", 0) < w["price"]: raise HTTPException(400, f"You need {w['price']} Pearls for that wall theme")
    await charge(user, {"$addToSet": {"owned_walls": w["id"]}, "$set": {"wall": w["id"]}}, pearls=w["price"], extra={"owned_walls": {"$ne": w["id"]}}, msg="Not enough Pearls")
    if w["price"] >= 25:
        await add_feed("cosmetic", user["username"], f"{user['username']} re-panelled their guestbook in {w['name']}.", "epic")
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/cosmetics/wall")
async def set_wall(body: WallIn, user=Depends(get_current_user)):
    if body.wall_id:
        if body.wall_id not in WALL_BY_ID: raise HTTPException(404, "Unknown wall")
        if body.wall_id not in (user.get("owned_walls") or []): raise HTTPException(400, "You don't own that wall theme yet. Buy it in the Pearl Shop.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"wall": body.wall_id}})
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


class FrameIn(BaseModel):
    frame_id: Optional[str] = None  # None = plain border


@api.post("/cosmetics/buy-frame")
async def buy_frame(body: FrameIn, user=Depends(get_current_user)):
    f = FRAME_BY_ID.get(body.frame_id or "")
    if not f: raise HTTPException(404, "Unknown frame")
    if f["price"] is None: raise HTTPException(400, f["earned"])
    if f["id"] in (user.get("owned_frames") or []): raise HTTPException(400, "You already own that frame")
    if user.get("pearls", 0) < f["price"]: raise HTTPException(400, f"You need {f['price']} Pearls for that frame")
    await charge(user, {"$addToSet": {"owned_frames": f["id"]}, "$set": {"frame": f["id"]}}, pearls=f["price"], extra={"owned_frames": {"$ne": f["id"]}}, msg="Not enough Pearls")
    if f["price"] >= 25:
        await add_feed("cosmetic", user["username"], f"{user['username']} framed their portrait in {f['name']}.", "epic")
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/cosmetics/frame")
async def set_frame(body: FrameIn, user=Depends(get_current_user)):
    if body.frame_id:
        if body.frame_id not in FRAME_BY_ID: raise HTTPException(404, "Unknown frame")
        if body.frame_id not in (user.get("owned_frames") or []): raise HTTPException(400, "You don't own that frame yet. Buy it in the Pearl Shop.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"frame": body.frame_id}})
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


class ColourIn(BaseModel):
    colour_id: Optional[str] = None  # None = back to the default name colour


@api.post("/cosmetics/buy-colour")
async def buy_colour(body: ColourIn, user=Depends(get_current_user)):
    c = COLOUR_BY_ID.get(body.colour_id or "")
    if not c: raise HTTPException(404, "Unknown colour")
    if c["price"] is None: raise HTTPException(400, "That colour is earned on the duelling pier, not bought with Pearls")
    if c["id"] in (user.get("owned_colours") or []): raise HTTPException(400, "You already own that colour")
    if user.get("pearls", 0) < c["price"]: raise HTTPException(400, f"You need {c['price']} Pearls for that colour")
    await charge(user, {"$addToSet": {"owned_colours": c["id"]}, "$set": {"name_colour": c["id"]}}, pearls=c["price"], extra={"owned_colours": {"$ne": c["id"]}}, msg="Not enough Pearls")
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/cosmetics/colour")
async def set_colour(body: ColourIn, user=Depends(get_current_user)):
    if body.colour_id:
        if body.colour_id not in COLOUR_BY_ID: raise HTTPException(404, "Unknown colour")
        if body.colour_id not in (user.get("owned_colours") or []): raise HTTPException(400, "You don't own that colour yet. Buy it in the Pearl Shop.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"name_colour": body.colour_id}})
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


class AvatarIn(BaseModel):
    avatar_id: str


@api.post("/cosmetics/avatar")
async def set_avatar(body: AvatarIn, user=Depends(get_current_user)):
    raise HTTPException(410, "Portraits are retired: your angler look is your avatar")
    a = AVATAR_BY_ID.get(body.avatar_id)
    if not a: raise HTTPException(404, "Unknown avatar")
    if a["id"] not in owned_avatars(user): raise HTTPException(400, "You don't own that portrait yet. Buy it in the Pearl Shop.")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"avatar": a["id"]}})
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/cosmetics/buy-avatar")
async def buy_avatar(body: AvatarIn, user=Depends(get_current_user)):
    raise HTTPException(410, "Portraits are retired: your angler look is your avatar")
    a = AVATAR_BY_ID.get(body.avatar_id)
    if not a: raise HTTPException(404, "Unknown avatar")
    if a["id"] in owned_avatars(user): raise HTTPException(400, "You already own that portrait")
    if a["price"] is None: raise HTTPException(400, "That portrait can't be bought with Pearls")
    if user.get("pearls", 0) < a["price"]: raise HTTPException(400, f"You need {a['price']} Pearls for that portrait")
    await charge(user, {"$addToSet": {"owned_avatars": a["id"]}, "$set": {"avatar": a["id"]}}, pearls=a["price"], extra={"owned_avatars": {"$ne": a["id"]}}, msg="Not enough Pearls")
    if a["price"] >= 20:
        await add_feed("cosmetic", user["username"], f"{user['username']} now wears the {a['name']} portrait.", "epic")
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}


class RenameIn(BaseModel):
    username: str = Field(min_length=3, max_length=16)


@api.post("/cosmetics/rename")
async def rename(body: RenameIn, response: Response, user=Depends(get_current_user)):
    if user.get("is_guest"): raise HTTPException(400, "Claim your account first, then you can change your name")
    if not re.fullmatch(r"[A-Za-z0-9_]+", body.username): raise HTTPException(400, "Username may only contain letters, numbers and underscores")
    if body.username.lower().startswith("guest_"): raise HTTPException(400, "That name is reserved for guest accounts")
    if body.username == user["username"]: raise HTTPException(400, "That is already your name")
    if body.username.lower() != user["username_lc"] and await db.users.find_one({"username_lc": body.username.lower()}):
        raise HTTPException(400, "That name is already taken on this server")
    if user.get("pearls", 0) < RENAME_COST: raise HTTPException(400, f"A name change costs {RENAME_COST} Pearls")
    old = user["username"]
    await charge(user, {"$set": {"username": body.username, "username_lc": body.username.lower()},
                        "$push": {"name_history": {"from": old, "to": body.username, "at": iso(now())}}}, pearls=RENAME_COST, extra={"username": old}, msg="Not enough Pearls")
    await rename_user(user, body.username)
    await add_feed("cosmetic", body.username, f"{old} is now known as {body.username}.", "rare")
    fresh = await db.users.find_one({"_id": user["_id"]})
    token = make_token(str(user["_id"]), body.username)
    set_auth(response, token)
    return {"token": token, "user": public_user(fresh)}
