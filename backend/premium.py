"""Angler Pass (Premium): bought for real money through Tebex as an inventory item (items.pass_month), then activated from Inventory
or traded on the Market. Perks while active: 150 max energy, 0% market fee, pass badge, the Angler's Almanac, two contract swaps a day, one free Energy Potion a week."""
import os
import secrets
import time
from datetime import timedelta

import httpx
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from pymongo import ReturnDocument

from server import api, db, now, iso, get_current_user, public_user, send_system_message, premium_active, PREMIUM_MAX_ENERGY, logger
import boosters

# Passes are matched to Tebex packages by price ($2 week, $6 month), so prices must not collide with the booster prices ($3/5/10/18).
PASSES = {"pass_week": {"id": "pass_week", "name": "Angler Pass · Week", "days": 7, "usd": 2.0}, "pass_month": {"id": "pass_month", "name": "Angler Pass · Month", "days": 30, "usd": 6.0}}
PERKS = [f"{PREMIUM_MAX_ENERGY} max energy", "0% Market fee", "The Angler's Almanac: price history, catch charts and best-conditions tables", "Two Contract Board swaps a day instead of one", "A free Energy Potion delivered every week", "Angler Pass badge beside your name"]
POTION_EVERY_H = 7 * 24
LOYAL_FRAME, LOYAL_DAYS = "frame_tidekeeper", 90


def potion_ready_at(u):
    last = u.get("premium_potion_at")
    return None if not last else iso(datetime_from(last) + timedelta(hours=POTION_EVERY_H))


def datetime_from(s):
    from datetime import datetime
    return datetime.fromisoformat(s)


def owned(u):
    return {k: int((u.get("items") or {}).get(k, 0)) for k in PASSES}


def state(u):
    ready = potion_ready_at(u)
    return {"active": premium_active(u), "until": u.get("premium_until"), "passes": [{**p, "owned": owned(u)[p["id"]]} for p in PASSES.values()], "perks": PERKS, "max_energy": PREMIUM_MAX_ENERGY,
            "potion": {"next_at": ready, "every_h": POTION_EVERY_H},
            "provider": "tebex", "can_buy": not u.get("is_guest")}


async def sub_state(u):
    o = await db.premium_orders.find_one({"buyer_id": str(u["_id"]), "auto_renew": True, "status": "paid", "sub_status": {"$in": ["active", "cancelled"]}}, sort=[("paid_at", -1)])
    if not o: return None
    days = len(o.get("txns") or []) * PASSES[o["plan"]]["days"]
    return {"plan": o["plan"], "name": PASSES[o["plan"]]["name"], "status": o["sub_status"], "renewals": len(o.get("txns") or []) - 1, "days_paid": days, "loyal_days": LOYAL_DAYS}


async def full_state(u):
    return {**state(u), "subscription": await sub_state(u)}


@api.get("/premium")
async def get_premium(user=Depends(get_current_user)):
    return await full_state(user)


class PassIn(BaseModel):
    item: str = "pass_month"
    auto_renew: bool = False
    gift_to: str = ""


@api.post("/premium/activate")
async def activate_pass(body: PassIn, user=Depends(get_current_user)):
    p = PASSES.get(body.item)
    if not p: raise HTTPException(400, "Unknown pass")
    until = extend_until(user, p["days"])
    r = await db.users.update_one({"_id": user["_id"], f"items.{p['id']}": {"$gte": 1}},
                                  {"$inc": {f"items.{p['id']}": -1, "stats.premium_days": p["days"], "stats.premium_month": 1}, "$set": {"premium_until": until}})
    if not r.modified_count: raise HTTPException(400, f"You don't have an {p['name']} in your inventory")
    if not user.get("premium_first_at"): await db.users.update_one({"_id": user["_id"]}, {"$set": {"premium_first_at": iso(now())}})
    u = await db.users.find_one({"_id": user["_id"]})
    return {"message": f"{p['name']} activated, your Angler Pass runs until {until[:10]}. The Almanac is open to you.", "user": public_user(u), **(await full_state(u))}


def extend_until(u, days):
    base = datetime_from(u["premium_until"]) if premium_active(u) else now()
    return iso(base + timedelta(days=days))


async def auto_potion(user):
    """Weekly Energy Potion: handed over by the Harbourmaster the first time an active pass holder shows up once it's due."""
    if not premium_active(user): return None
    ready = potion_ready_at(user)
    if ready and ready > iso(now()): return None
    r = await db.users.update_one({"_id": user["_id"], "premium_potion_at": user.get("premium_potion_at")}, {"$set": {"premium_potion_at": iso(now())}, "$inc": {"items.potion_energy": 1, "stats.premium_potions": 1}})
    if not r.modified_count: return None
    await send_system_message(str(user["_id"]), user["username"], "Your weekly Angler Pass Energy Potion has been placed in your Inventory, drink it whenever the tide suits you. The next one follows in seven days.")
    return await db.users.find_one({"_id": user["_id"]})


# ---------- Buying a pass (Tebex, real money) ----------
@api.post("/premium/checkout")
async def premium_checkout(body: PassIn, request: Request, user=Depends(get_current_user)):
    if user.get("is_guest"): raise HTTPException(403, "Claim your account first, the Angler Pass is tied to a permanent angler")
    plan = PASSES.get(body.item)
    if not plan: raise HTTPException(400, "Unknown pass")
    if body.auto_renew and await sub_state(user) and (await sub_state(user))["status"] == "active":
        raise HTTPException(400, "You already have an Angler Pass that renews automatically")
    gift = None
    if body.gift_to.strip():
        if body.auto_renew: raise HTTPException(400, "Gifts are one-time passes, untick Renew automatically")
        gift = await db.users.find_one({"username_lc": body.gift_to.strip().lower()}, {"username": 1, "is_guest": 1, "banned": 1})
        if not gift or gift.get("banned"): raise HTTPException(404, f"No angler called {body.gift_to.strip()}")
        if gift["_id"] == user["_id"]: raise HTTPException(400, "Untick the gift to buy a pass for yourself")
        if gift.get("is_guest"): raise HTTPException(400, f"{gift['username']} still has a guest account, they need to claim it first")
    doc = {"plan": plan["id"], **({"recipient_id": str(gift["_id"]), "recipient": gift["username"]} if gift else {}), "days": plan["days"], "price": plan["usd"], "currency": "USD", "buyer_id": str(user["_id"]), "buyer": user["username"], "auto_renew": body.auto_renew,
           "status": "pending", "nonce": secrets.token_urlsafe(16), "created_at": iso(now())}
    oid = (await db.premium_orders.insert_one(doc)).inserted_id
    custom = {"premium_order": str(oid), "nonce": doc["nonce"], "username": user["username"]}
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            ident, url, pkg_id = await boosters._tebex_basket(client, {"price": plan["usd"]}, custom, ip, back="/game/support", sub=body.auto_renew)
    except httpx.HTTPError:
        await db.premium_orders.delete_one({"_id": oid}); raise HTTPException(424, "Could not reach Tebex, please try again in a moment")
    except HTTPException:
        await db.premium_orders.delete_one({"_id": oid}); raise
    await db.premium_orders.update_one({"_id": oid}, {"$set": {"ident": ident, "package_id": pkg_id}})
    return {"provider": "tebex", "ident": ident, "url": url, "order_id": str(oid)}


def _order_from(subject):
    for p in subject.get("products") or []:
        c = p.get("custom") or {}
        if c.get("premium_order"): return c["premium_order"], c.get("nonce")
    c = subject.get("custom") or {}
    return c.get("premium_order"), c.get("nonce")


async def fulfil_premium(subject, event_id):
    oid, nonce = _order_from(subject)
    if not oid: return False
    o = await db.premium_orders.find_one_and_update({"_id": ObjectId(oid), "nonce": nonce, "status": "pending"},
                                                    {"$set": {"status": "paid", "paid_at": iso(now()), "txn_id": subject.get("transaction_id"), "event_id": event_id}}, return_document=ReturnDocument.AFTER)
    if not o:
        await renew_premium(oid, nonce, subject)
        return True
    p = PASSES.get(o["plan"], PASSES["pass_month"])
    if o.get("auto_renew"):
        await db.premium_orders.update_one({"_id": o["_id"]}, {"$set": {"sub_status": "active", "extended_at": iso(now()), "txns": [subject.get("transaction_id")],
                                                                        **({"recurring_ref": subject["recurring_payment_reference"]} if subject.get("recurring_payment_reference") else {})}})
        until = await _extend(o["buyer_id"], p["days"])
        await send_system_message(o["buyer_id"], o["buyer"], f"Thank you! Your {p['name']} is active until {until[:10]} and renews automatically every {p['days']} days. You can turn renewing off any time on the Donate page.")
        return True
    if o.get("recipient_id"):
        await db.users.update_one({"_id": ObjectId(o["recipient_id"])}, {"$inc": {f"items.{p['id']}": 1}})
        await db.users.update_one({"_id": ObjectId(o["buyer_id"])}, {"$inc": {"stats.passes_bought": 1, "stats.passes_gifted": 1}})
        await send_system_message(o["recipient_id"], o["recipient"], f"{o['buyer']} gifted you an {p['name']}! It is waiting in your Inventory, activate it whenever you like.")
        await send_system_message(o["buyer_id"], o["buyer"], f"Thank you! Your {p['name']} has been delivered to {o['recipient']}'s Inventory with a note from you.")
        return True
    await db.users.update_one({"_id": ObjectId(o["buyer_id"])}, {"$inc": {f"items.{p['id']}": 1, "stats.passes_bought": 1}})
    await send_system_message(o["buyer_id"], o["buyer"], f"Thank you! An {p['name']} has been placed in your Inventory. Activate it there whenever you like, or sell it on the Market.")
    return True


async def _extend(buyer_id, days):
    u = await db.users.find_one({"_id": ObjectId(buyer_id)})
    until = extend_until(u, days)
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"premium_until": until, **({} if u.get("premium_first_at") else {"premium_first_at": iso(now())})}, "$inc": {"stats.premium_days": days}})
    return until


async def renew_premium(oid, nonce, subject):
    """A later payment on a subscription order: extend once per transaction. The 2-day gap keeps the first payment's webhook (after /verify) from counting twice."""
    txn = subject.get("transaction_id")
    if not txn: return
    gap = iso(now() - timedelta(days=2))
    q = {"_id": ObjectId(oid), "auto_renew": True, "status": "paid", "txns": {"$ne": txn}, "extended_at": {"$lt": gap}}
    if nonce: q["nonce"] = nonce
    o = await db.premium_orders.find_one_and_update(q, {"$push": {"txns": txn}, "$set": {"extended_at": iso(now()), "sub_status": "active"}}, return_document=ReturnDocument.AFTER)
    if not o: logger.info("premium order %s: payment %s already counted or not a renewal", oid, txn); return
    p = PASSES.get(o["plan"], PASSES["pass_month"])
    until = await _extend(o["buyer_id"], p["days"])
    await send_system_message(o["buyer_id"], o["buyer"], f"Your {p['name']} renewed, it now runs until {until[:10]}. Thank you for supporting FishyLand!")
    if len(o["txns"]) * p["days"] >= LOYAL_DAYS:
        r = await db.users.update_one({"_id": ObjectId(o["buyer_id"]), "owned_frames": {"$ne": LOYAL_FRAME}}, {"$addToSet": {"owned_frames": LOYAL_FRAME}})
        if r.modified_count:
            await send_system_message(o["buyer_id"], o["buyer"], "Three months of renewing without a break! The Loyal Tidekeeper portrait frame is yours forever, equip it from My Angler.")


async def recurring_event(kind, subject):
    pay = subject.get("last_payment") or subject.get("initial_payment") or {}
    oid, nonce = _order_from(pay)
    ref = subject.get("reference")
    o = await db.premium_orders.find_one({"_id": ObjectId(oid)} if oid else {"recurring_ref": ref}) if (oid or ref) else None
    if not o: logger.info("recurring event %s for unknown order (ref %s)", kind, ref); return
    if ref and not o.get("recurring_ref"): await db.premium_orders.update_one({"_id": o["_id"]}, {"$set": {"recurring_ref": ref}})
    if kind == "recurring-payment.renewed" and pay.get("transaction_id"):
        await renew_premium(str(o["_id"]), None, pay)
    elif kind in ("recurring-payment.cancellation.requested", "recurring-payment.ended"):
        await db.premium_orders.update_one({"_id": o["_id"]}, {"$set": {"sub_status": "cancelled" if kind.endswith("requested") else "ended"}})


@api.post("/premium/cancel-renew")
async def cancel_renew(user=Depends(get_current_user)):
    o = await db.premium_orders.find_one({"buyer_id": str(user["_id"]), "auto_renew": True, "status": "paid", "sub_status": "active"}, sort=[("paid_at", -1)])
    if not o: raise HTTPException(400, "You have no Angler Pass that renews automatically")
    ok = False
    if o.get("recurring_ref"):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.delete(f"https://checkout.tebex.io/api/recurring-payments/{o['recurring_ref']}", auth=(os.environ["TEBEX_PROJECT_ID"], os.environ["TEBEX_PRIVATE_KEY"]))
            ok = r.status_code < 300
            if not ok: logger.warning("Tebex cancel %s failed %s %s", o["recurring_ref"], r.status_code, r.text[:200])
        except httpx.HTTPError: pass
    if not ok: raise HTTPException(424, "Tebex couldn't cancel it right now. You can also cancel from the link in your Tebex payment email.")
    await db.premium_orders.update_one({"_id": o["_id"]}, {"$set": {"sub_status": "cancelled", "cancelled_at": iso(now())}})
    return {"message": f"Auto-renew is off. Your pass keeps running until {(user.get('premium_until') or '')[:10]}.", **(await full_state(await db.users.find_one({"_id": user["_id"]})))}


async def revoke_premium(subject, reason):
    oid, _ = _order_from(subject)
    if not oid: return False
    o = await db.premium_orders.find_one_and_update({"_id": ObjectId(oid), "status": "paid"}, {"$set": {"status": "refunded", "revoked": reason, "revoked_at": iso(now())}}, return_document=ReturnDocument.AFTER)
    if o:
        p = PASSES.get(o["plan"], PASSES["pass_month"])
        holder = ObjectId(o.get("recipient_id") or o["buyer_id"])
        took = await db.users.update_one({"_id": holder, f"items.{p['id']}": {"$gte": 1}}, {"$inc": {f"items.{p['id']}": -1}})
        if not took.modified_count:
            u = await db.users.find_one({"_id": holder})
            if u and u.get("premium_until"):
                await db.users.update_one({"_id": u["_id"]}, {"$set": {"premium_until": iso(datetime_from(u["premium_until"]) - timedelta(days=o["days"]))}})
    return True


@api.post("/premium/verify")
async def premium_verify(user=Depends(get_current_user)):
    """After the Tebex popup closes: check the newest pending order straight from Tebex in case the webhook is slow."""
    o = await db.premium_orders.find_one({"buyer_id": str(user["_id"]), "status": "pending"}, sort=[("created_at", -1)])
    if not o or not o.get("ident"): return {"fulfilled": False}
    basket = await boosters.tebex_basket_complete(o["ident"])
    if basket and basket.get("complete"):
        await fulfil_premium({"custom": {"premium_order": str(o["_id"]), "nonce": o["nonce"]}, "transaction_id": f"verify:{o['ident']}"}, f"verify:{o['ident']}:{int(time.time())}")
        u = await db.users.find_one({"_id": user["_id"]})
        return {"fulfilled": True, "user": public_user(u), **(await full_state(u))}
    return {"fulfilled": False}
