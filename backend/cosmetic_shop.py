"""Donate-page cosmetics: looks only, never stats. Bought through Tebex (matched to packages by USD price), owned forever.
Rod skins sit on top of whatever rod is equipped; avatars and frames go into the normal My Angler collection."""
import secrets
import time

import httpx
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from pymongo import ReturnDocument

from server import api, db, now, iso, get_current_user, public_user, send_system_message
import boosters


SHOP = {
    "skin_kraken": {"id": "skin_kraken", "kind": "rod_skin", "name": "Krakenjaw Rod Skin", "usd": 3.99, "art": "/art/skins/skin_kraken.png",
                    "desc": "Wraps any rod you equip in a living kraken. Looks only, your rod's stats stay the same."},
    "av_leviathan_king": {"id": "av_leviathan_king", "kind": "avatar", "name": "Leviathan King", "usd": 2.99, "art": "/art/avatars/av_leviathan_king.jpg",
                     "desc": "An animated portrait: a crowned madman riding a sea serpent through a lightning storm."},
    "frame_maw": {"id": "frame_maw", "kind": "frame", "name": "Abyssal Maw", "usd": 1.99, "art": "/art/skins/frame_maw.png",
                  "desc": "An animated frame: your portrait sits inside the breathing jaws of an abyssal anglerfish."},
    "pack_leviathan": {"id": "pack_leviathan", "kind": "pack", "name": "Abyss Pack", "usd": 5.79, "items": ["skin_kraken", "av_leviathan_king", "frame_maw"],
                       "desc": "All three for 35% less."},
    "skin_inferno": {"id": "skin_inferno", "kind": "rod_skin", "name": "Inferno Wyrm Rod Skin", "usd": 3.99, "art": "/art/skins/skin_inferno.png",
                     "desc": "A red dragon wrapped round a molten lava rod, breathing fire off the tip. Looks only."},
    "skin_galleon": {"id": "skin_galleon", "kind": "rod_skin", "name": "Ghost Galleon Rod Skin", "usd": 3.99, "art": "/art/skins/skin_galleon.png",
                     "desc": "The mast of a phantom galleon with glowing ghost sails and a skull lantern. Looks only."},
    "av_storm_titan": {"id": "av_storm_titan", "kind": "avatar", "name": "Storm Titan", "usd": 2.99, "art": "/art/avatars/av_storm_titan.jpg",
                       "desc": "An animated portrait: a giant of living lightning towering over a tiny boat."},
    "av_kraken_lord": {"id": "av_kraken_lord", "kind": "avatar", "name": "Kraken Lord", "usd": 2.99, "art": "/art/avatars/av_kraken_lord.jpg",
                       "desc": "An animated portrait: a monocled kraken captain rising from the abyss."},
    "frame_dragonfire": {"id": "frame_dragonfire", "kind": "frame", "name": "Dragonfire Ring", "usd": 1.99, "art": "/art/skins/frame_dragonfire.png",
                         "desc": "An animated frame: flickering flames and a fire-breathing dragon coiled round your portrait."},
    "frame_frost": {"id": "frame_frost", "kind": "frame", "name": "Frozen Abyss", "usd": 1.99, "art": "/art/skins/frame_frost.png",
                    "desc": "An animated frame: shimmering ice spikes and a frost serpent with glowing eyes."},
    "pack_inferno": {"id": "pack_inferno", "kind": "pack", "name": "Inferno Pack", "usd": 3.89, "items": ["skin_inferno", "frame_dragonfire"],
                     "desc": "The dragon rod and its flaming frame for 35% less."},
    "pack_phantom": {"id": "pack_phantom", "kind": "pack", "name": "Phantom Pack", "usd": 5.79, "items": ["skin_galleon", "av_kraken_lord", "frame_frost"],
                     "desc": "Ghost ship rod, Kraken Lord and the Frozen Abyss frame for 35% less."},
    # limited: only LIMITED[id] copies are ever sold, then it is gone for good; its parts are never sold on their own
    "skin_founder": {"id": "skin_founder", "kind": "rod_skin", "name": "Golden Founder Rod Skin", "usd": 0, "pack_only": True, "art": "/art/skins/skin_founder.png",
                     "desc": "A gilded rod with a sun-disc tip and a golden serpent round the grip. Looks only."},
    "av_founder": {"id": "av_founder", "kind": "avatar", "name": "Golden Founder", "usd": 0, "pack_only": True, "art": "/art/avatars/av_founder.jpg",
                   "desc": "An animated portrait: a golden captain against a rising sun."},
    "frame_founder": {"id": "frame_founder", "kind": "frame", "name": "Founder's Sun", "usd": 0, "pack_only": True, "art": "/art/skins/frame_founder.png",
                      "desc": "An animated frame: gilded sun rays, a crown and two golden koi."},
    "pack_founder": {"id": "pack_founder", "kind": "pack", "name": "Golden Founder Pack", "usd": 9.99, "items": ["skin_founder", "av_founder", "frame_founder"],
                     "desc": "Limited: only 10 will ever be sold. Golden rod skin, animated Golden Founder portrait and the Founder's Sun frame."},
}
LIMITED = {"pack_founder": 10, "skin_kraken": 10, "av_leviathan_king": 10, "frame_maw": 10}
LIMIT_SINCE = {"skin_kraken": "2026-10-27T20:00:00", "av_leviathan_king": "2026-10-27T20:00:00", "frame_maw": "2026-10-27T20:00:00"}  # only sales after this count toward the limit
# kept for later: owners keep them, but they are not sold or giftable right now
SHELVED = {"skin_inferno", "skin_galleon", "av_storm_titan", "av_kraken_lord", "frame_dragonfire", "frame_frost", "pack_inferno", "pack_phantom", "pack_leviathan", "pack_founder"}
FIELD = {"rod_skin": "owned_rod_skins", "avatar": "owned_avatars", "frame": "owned_frames"}


async def stock_left(item_id, buyer_id=None):
    q = {"item": item_id, "status": "paid"}  # only finished payments use up a copy
    if item_id in LIMIT_SINCE: q["created_at"] = {"$gte": LIMIT_SINCE[item_id]}
    return LIMITED[item_id] - await db.cosmetic_orders.count_documents(q)


async def stock():
    return {k: max(0, await stock_left(k)) for k in LIMITED}


def owns(u, item_id):
    it = SHOP[item_id]
    if it["kind"] == "pack": return all(owns(u, i) for i in it["items"])
    return item_id in (u.get(FIELD[it["kind"]]) or [])


def listing(u, left=None):
    # owned items vanish; the pack vanishes as soon as any part of it is owned; sold-out limited items vanish for everyone
    def show(it): return not (any(owns(u, i) for i in it["items"]) if it["kind"] == "pack" else owns(u, it["id"]))
    return sorted([out(it, left) for it in SHOP.values() if show(it) and on_sale(it, left)], key=lambda o: not o.get("limited"))


def on_sale(it, left):
    return not it.get("pack_only") and it["id"] not in SHELVED and (it["id"] not in LIMITED or left is None or left[it["id"]] > 0)


def out(it, left=None):
    o = {**it, "full_usd": None if it["id"] in LIMITED else round(sum(SHOP[i]["usd"] for i in it.get("items", [])), 2) or None}
    if it["id"] in LIMITED: o.update(limited=LIMITED[it["id"]], left=(left or {}).get(it["id"]))
    return o


@api.get("/shop/cosmetics")
async def shop_cosmetics(user=Depends(get_current_user)):
    left = await stock()
    items = listing(user, left)
    mine = {x["id"] for x in items}
    return {"items": items, "giftable": [out(it, left) for it in SHOP.values() if it["id"] not in mine and on_sale(it, left)], "can_buy": not user.get("is_guest")}


class BuyIn(BaseModel):
    item: str
    gift_to: str | None = None


@api.post("/shop/cosmetics/checkout")
async def cosmetic_checkout(body: BuyIn, request: Request, user=Depends(get_current_user)):
    if user.get("is_guest"): raise HTTPException(403, "Claim your account first so the cosmetic can be credited to you")
    it = SHOP.get(body.item)
    if not it or it.get("pack_only") or it["id"] in SHELVED: raise HTTPException(400, "Unknown cosmetic")
    owner = user
    if body.gift_to:
        owner = await db.users.find_one({"username_lc": body.gift_to.strip().lower()})
        if not owner or owner.get("is_guest") or owner.get("banned"): raise HTTPException(404, "No angler by that name")
        if owner["_id"] == user["_id"]: raise HTTPException(400, "Buy it for yourself with the Buy button")
        if not any(x["id"] == it["id"] for x in listing(owner)): raise HTTPException(400, f"{owner['username']} already has this")
    elif not any(x["id"] == it["id"] for x in listing(user)): raise HTTPException(400, "You already own this")
    doc = {"item": it["id"], "price": it["usd"], "currency": "USD", "buyer_id": str(user["_id"]), "buyer": user["username"], "status": "pending",
           "owner_id": str(owner["_id"]), "owner": owner["username"], "gift": owner is not user, "nonce": secrets.token_urlsafe(16), "created_at": iso(now())}
    if it["id"] in LIMITED and await stock_left(it["id"], doc["buyer_id"]) <= 0: raise HTTPException(410, "Sold out! All copies have been claimed")
    oid = (await db.cosmetic_orders.insert_one(doc)).inserted_id
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            ident, url, pkg_id = await boosters._tebex_basket(client, {"price": it["usd"], "name": it["name"], "price_match": sum(x["usd"] == it["usd"] for x in SHOP.values()) == 1}, {"cosmetic_order": str(oid), "nonce": doc["nonce"], "username": user["username"]}, ip, back="/game/support?tab=cosmetics")
    except httpx.HTTPError:
        await db.cosmetic_orders.delete_one({"_id": oid}); raise HTTPException(424, "Could not reach Tebex, please try again in a moment")
    except HTTPException as e:
        await db.cosmetic_orders.delete_one({"_id": oid})
        if "No Tebex package" in str(e.detail): raise HTTPException(424, "This cosmetic isn't on sale just yet, check back soon")
        raise
    await db.cosmetic_orders.update_one({"_id": oid}, {"$set": {"ident": ident, "package_id": pkg_id}})
    if it["id"] in LIMITED and await stock_left(it["id"], doc["buyer_id"]) <= 0:  # someone else took the last copy meanwhile
        await db.cosmetic_orders.delete_one({"_id": oid}); raise HTTPException(410, "Sold out! All copies have been claimed")
    return {"provider": "tebex", "ident": ident, "url": url, "order_id": str(oid)}


def _order_from(subject):
    for c in [p.get("custom") or {} for p in subject.get("products") or []] + [subject.get("custom") or {}]:
        if c.get("cosmetic_order"): return c["cosmetic_order"], c.get("nonce")
    return None, None


async def grant(user_id, item_id):
    it = SHOP[item_id]
    for i in it.get("items") or [item_id]:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$addToSet": {FIELD[SHOP[i]["kind"]]: i}})


async def fulfil_cosmetic(subject, event_id):
    oid, nonce = _order_from(subject)
    if not oid: return False
    o = await db.cosmetic_orders.find_one_and_update({"_id": ObjectId(oid), "nonce": nonce, "status": "pending"},
                                                     {"$set": {"status": "paid", "paid_at": iso(now()), "txn_id": subject.get("transaction_id"), "event_id": event_id}}, return_document=ReturnDocument.AFTER)
    if not o: return True
    name = SHOP[o["item"]]["name"]
    await grant(o.get("owner_id") or o["buyer_id"], o["item"])
    await boosters.mark_supporter(o["buyer_id"])
    if o.get("gift"):
        await send_system_message(o["owner_id"], o["owner"], f"{o['buyer']} sent you a gift: {name}! It's yours forever. Equip it from My Angler (rod skins: on your profile, Tackle panel).")
        await send_system_message(o["buyer_id"], o["buyer"], f"Thank you! Your gift ({name}) has been delivered to {o['owner']}.")
    else:
        await send_system_message(o["buyer_id"], o["buyer"], f"Thank you! {name} is yours forever. Equip it from My Angler (rod skins: on your profile, Tackle panel).")
    return True


async def revoke_cosmetic(subject, reason):
    oid, _ = _order_from(subject)
    if not oid: return False
    o = await db.cosmetic_orders.find_one_and_update({"_id": ObjectId(oid), "status": "paid"}, {"$set": {"status": "refunded", "revoked": reason}})
    if o:
        for i in SHOP[o["item"]].get("items") or [o["item"]]:
            await db.users.update_one({"_id": ObjectId(o.get("owner_id") or o["buyer_id"])}, {"$pull": {FIELD[SHOP[i]["kind"]]: i}})
        u = await db.users.find_one({"_id": ObjectId(o.get("owner_id") or o["buyer_id"])}, {"rod_skin": 1, "owned_rod_skins": 1, "avatar": 1, "owned_avatars": 1, "frame": 1, "owned_frames": 1})
        fix = {}
        if u.get("rod_skin") and u["rod_skin"] not in (u.get("owned_rod_skins") or []): fix["rod_skin"] = None
        if u.get("avatar") in SHOP and u["avatar"] not in (u.get("owned_avatars") or []): fix["avatar"] = "av_lad"
        if u.get("frame") in SHOP and u["frame"] not in (u.get("owned_frames") or []): fix["frame"] = None
        if fix: await db.users.update_one({"_id": u["_id"]}, {"$set": fix})
    return True


@api.post("/shop/cosmetics/verify")
async def cosmetic_verify(user=Depends(get_current_user)):
    o = await db.cosmetic_orders.find_one({"buyer_id": str(user["_id"]), "status": "pending", "ident": {"$exists": True}}, sort=[("created_at", -1)])
    if not o: return {"fulfilled": False}
    basket = await boosters.tebex_basket_complete(o["ident"])
    if basket and basket.get("complete"):
        await fulfil_cosmetic({"custom": {"cosmetic_order": str(o["_id"]), "nonce": o["nonce"]}, "transaction_id": f"verify:{o['ident']}"}, f"verify:{o['ident']}:{int(time.time())}")
        u = await db.users.find_one({"_id": user["_id"]})
        return {"fulfilled": True, "user": public_user(u), "items": listing(u)}
    return {"fulfilled": False}


class SkinIn(BaseModel):
    skin: str | None = None


@api.post("/cosmetics/rod-skin")
async def equip_rod_skin(body: SkinIn, user=Depends(get_current_user)):
    if body.skin and body.skin not in (user.get("owned_rod_skins") or []): raise HTTPException(400, "You don't own that rod skin")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"rod_skin": body.skin}})
    u = await db.users.find_one({"_id": user["_id"]})
    return {"user": public_user(u)}
