"""Server-wide boosters bought through PayPal/Tebex; fulfilment only via verified IPN / signed webhook.
Two independent lanes: "xp" (Harbour Lantern: XP, vendor gold, energy) and "luck" (Lucky Tide: +luck on every cast). Each lane runs one
booster at a time with its own queue, and both lanes can be live at once."""
import hashlib
import hmac
import logging
import os, time
import secrets
from datetime import datetime, timedelta
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from pymongo import ReturnDocument

from server import api, db, now, iso, get_current_user, is_admin_user, add_feed, send_system_message, cached, _TTL, BOOST_ENERGY_MULT

log = logging.getLogger("tebex")
TEBEX_HEADLESS = "https://headless.tebex.io/api"
MULT = 2
SELL_MULT = 1.5
ENERGY_MULT = BOOST_ENERGY_MULT
LUCK_BONUS = 20
PERKS_TEXT = f"Double XP, {SELL_MULT}× vendor prices & {ENERGY_MULT}× energy regen"
KINDS = {
    "xp": {"name": "Harbour Lantern", "perks": PERKS_TEXT, "short": f"2× XP · {SELL_MULT}× vendor gold · {ENERGY_MULT}× energy regen"},
    "luck": {"name": "Lucky Tide", "perks": f"+{LUCK_BONUS} luck on every cast", "short": f"+{LUCK_BONUS} luck · about twice the legendary & mythic odds"},
}
SUPPORT_ADMIN_ONLY = False  # flip to True to restrict the Support page to admins
PROVIDER = os.environ.get("PAYMENT_PROVIDER", "tebex")  # "paypal" (Buy Now + IPN) or "tebex" (Headless API + Tebex.js + webhook)
PROVIDER_ADMIN = os.environ.get("PAYMENT_PROVIDER_ADMIN") or PROVIDER  # admins can trial a different provider before it goes live for everyone
OPTIONS = {
    "xp3": {"id": "xp3", "kind": "xp", "hours": 3, "price": 3.0},
    "xp6": {"id": "xp6", "kind": "xp", "hours": 6, "price": 5.0},
    "xp12": {"id": "xp12", "kind": "xp", "hours": 12, "price": 10.0},
    "xp24": {"id": "xp24", "kind": "xp", "hours": 24, "price": 18.0},
}


def kind_of(b):
    return b.get("kind") or "xp"


def _kq(kind):
    return {"kind": "luck"} if kind == "luck" else {"kind": {"$ne": "luck"}}


# Headless store credentials live under their own key names (a deploy only picks up NEW env keys, never changed values).
def _hauth():
    return (os.environ["TEBEX_HEADLESS_PUBLIC_TOKEN"], os.environ["TEBEX_HEADLESS_PRIVATE_KEY"])


def _hbase():
    return f"{TEBEX_HEADLESS}/accounts/{os.environ['TEBEX_HEADLESS_PUBLIC_TOKEN']}"


def _webhook_secret():
    return os.environ.get("TEBEX_HEADLESS_WEBHOOK_SECRET") or os.environ.get("TEBEX_WEBHOOK_SECRET")


def provider_for(user):
    return PROVIDER_ADMIN if is_admin_user(user) else PROVIDER


def _site():
    return os.environ["SITE_URL"].rstrip("/")


def buyer_name(b):
    return "An anonymous angler" if b.get("anonymous") else b["buyer"]


def boost_out(b, projected_start=None):
    k = kind_of(b)
    return {"id": str(b["_id"]), "kind": k, "name": KINDS[k]["name"], "hours": b["hours"], "mult": MULT, "sell_mult": SELL_MULT, "energy_mult": ENERGY_MULT, "luck": LUCK_BONUS if k == "luck" else 0,
            "buyer": buyer_name(b), "anonymous": bool(b.get("anonymous")),
            "status": b["status"], "starts_at": b.get("starts_at") or projected_start, "ends_at": b.get("ends_at"), "paid_at": b.get("paid_at")}


def _support_gate(user):
    if SUPPORT_ADMIN_ONLY and not is_admin_user(user):
        raise HTTPException(403, "The Support page is still being tested")


# ---------- queue ----------
def _bust():
    for k in ("boost_active", "boost_energy_windows"): _TTL.pop(k, None)


async def schedule(kind="xp"):
    """Expire finished boosts in this lane and start the next queued one. Safe to call from anywhere, any time."""
    t = iso(now())
    q = _kq(kind)
    await db.boosts.update_many({**q, "status": "active", "ends_at": {"$lte": t}}, {"$set": {"status": "done"}})
    active = await db.boosts.find_one({**q, "status": "active"})
    if active:
        return active
    nxt = await db.boosts.find_one({**q, "status": "queued"}, sort=[("paid_at", 1)])
    if not nxt:
        return None
    started = await db.boosts.find_one_and_update(
        {"_id": nxt["_id"], "status": "queued"},
        {"$set": {"status": "active", "starts_at": t, "ends_at": iso(now() + timedelta(hours=nxt["hours"]))}},
        return_document=ReturnDocument.AFTER)
    if not started:
        return await db.boosts.find_one({**q, "status": "active"})
    _bust()
    who, k = buyer_name(started), KINDS[kind]
    await add_feed("boost", started["buyer"] if not started.get("anonymous") else "Harbourmaster",
                   f"{k['name']}: {k['perks']}. Live for {started['hours']} hours. Thank {who} for supporting The Fishing Lands!", "legendary")
    await db.chat.insert_one({"channel": "global", "username": "Harbourmaster", "level": 0, "at": t,
                              "text": f"The {k['name']} is lit! {k['perks']} for the next {started['hours']} hours, courtesy of {who}. Tight lines!"})
    return started


async def schedule_all():
    return {k: await schedule(k) for k in KINDS}


async def active_boosts():
    """Cheap, cached view of the running boost per lane for the pulse, XP maths and cast luck."""
    async def _f():
        return {k: (boost_out(b) if b else None) for k, b in (await schedule_all()).items()}
    return await cached("boost_active", 5, _f)


async def active_boost():
    return (await active_boosts())["xp"]


async def luck_bonus():
    return LUCK_BONUS if (await active_boosts())["luck"] else 0


async def energy_windows():
    """[(start, end)] of boosters that ran in the last few hours, energy regen is ENERGY_MULT× faster inside them."""
    async def _f():
        await schedule("xp")
        since = iso(now() - timedelta(hours=3))
        rows = await db.boosts.find({**_kq("xp"), "status": {"$in": ["active", "done", "refunded"]}, "starts_at": {"$exists": True}, "ends_at": {"$gt": since}},
                                    {"starts_at": 1, "ends_at": 1}).to_list(20)
        return [(datetime.fromisoformat(r["starts_at"]), datetime.fromisoformat(r["ends_at"])) for r in rows]
    return await cached("boost_energy_windows", 5, _f)


async def xp_multiplier():
    b = await active_boost()
    return MULT if b else 1


async def sell_multiplier():
    b = await active_boost()
    return SELL_MULT if b else 1


async def mark_supporter(user_id):
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"supporter": True}, "$inc": {"stats.boosts_bought": 1}})


async def queue_view():
    lanes = {}
    for kind in KINDS:
        active = await schedule(kind)
        queued = await db.boosts.find({**_kq(kind), "status": "queued"}).sort("paid_at", 1).to_list(50)
        cursor = datetime.fromisoformat(active["ends_at"]) if active else now()
        out = []
        for q in queued:
            out.append(boost_out(q, projected_start=iso(cursor)))
            cursor += timedelta(hours=q["hours"])
        lanes[kind] = {"active": boost_out(active) if active else None, "queue": out}
    recent = await db.boosts.find({"status": "done"}).sort("ends_at", -1).limit(8).to_list(8)
    return {"lanes": lanes, "recent": [boost_out(r) for r in recent]}


# ---------- Tebex Headless API ----------
_PKG_CACHE = {"at": 0.0, "by_price": {}, "by_name": {}}


async def tebex_packages(client):
    """Store packages keyed by USD price (5-min cache). Boosters are matched to packages by price, so names in Tebex are free."""
    if time.time() - _PKG_CACHE["at"] < 300 and _PKG_CACHE["by_price"]: return _PKG_CACHE["by_price"]
    r = await client.get(f"{_hbase()}/packages")
    if r.status_code >= 400: raise HTTPException(424, f"Tebex package list failed ({r.status_code})")
    sellable = [p for p in r.json().get("data", []) if p.get("type") in ("single", "both")]  # "both" = one-time or recurring, we always sell it one-time
    by_price = {round(float(p["base_price"]), 2): p for p in sellable}
    _PKG_CACHE.update(at=time.time(), by_price=by_price, by_name={(p.get("name") or "").strip().lower(): p for p in sellable})
    return by_price


async def _tebex_basket(client, opt, custom, ip, back="/game/support", sub=False):
    pkgs = await tebex_packages(client)
    # cosmetics are matched by package name first (several share a price); price only when it is unambiguous
    pkg = _PKG_CACHE["by_name"].get(opt["name"].lower()) if opt.get("name") else None
    if not pkg and opt.get("price_match", True): pkg = pkgs.get(round(opt["price"], 2))
    if not pkg: raise HTTPException(424, f"No Tebex package priced ${opt['price']:.2f}, create one in the Tebex creator panel")
    if sub and pkg.get("type") != "both": raise HTTPException(424, "This pass can't renew automatically yet, buy it once instead")
    sep = "&" if "?" in back else "?"
    body = {"complete_url": f"{_site()}{back}{sep}paid=1", "cancel_url": f"{_site()}{back}", "complete_auto_redirect": True, "custom": custom, "ip_address": ip or "127.0.0.1"}
    r = await client.post(f"{_hbase()}/baskets", auth=_hauth(), json=body)
    if r.status_code >= 400: raise HTTPException(424, f"Tebex refused to open a basket ({r.status_code}): {r.text[:200]}")
    ident = r.json()["data"]["ident"]
    r = await client.post(f"{TEBEX_HEADLESS}/baskets/{ident}/packages", auth=_hauth(), json={"package_id": pkg["id"], "quantity": 1, **({"type": "subscription" if sub else "single"} if pkg.get("type") == "both" else {})})
    if r.status_code >= 400: raise HTTPException(424, f"Tebex refused the booster package ({r.status_code}): {r.text[:200]}")
    data = r.json().get("data") or r.json()
    return ident, (data.get("links") or {}).get("checkout"), pkg["id"]


async def tebex_basket_complete(ident):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{_hbase()}/baskets/{ident}", auth=_hauth())
    if r.status_code >= 400: return None
    return r.json().get("data") or {}


class CheckoutIn(BaseModel):
    option: str
    anonymous: bool = False


@api.get("/support/state")
async def support_state(user=Depends(get_current_user)):
    _support_gate(user)
    view = await queue_view()
    prov = provider_for(user)
    ready = bool(os.environ.get("PAYPAL_EMAIL")) if prov == "paypal" else bool(_webhook_secret())
    return {**view, "options": list(OPTIONS.values()), "kinds": KINDS, "mult": MULT, "sell_mult": SELL_MULT, "energy_mult": ENERGY_MULT, "luck": LUCK_BONUS, "can_buy": not user.get("is_guest"),
            "provider": prov, "provider_trial": prov != PROVIDER, "webhook_ready": ready}


@api.post("/support/checkout")
async def support_checkout(body: CheckoutIn, request: Request, user=Depends(get_current_user)):
    _support_gate(user)
    if user.get("is_guest"): raise HTTPException(400, "Claim your account first so the booster can be credited to you")
    opt = OPTIONS.get(body.option)
    if not opt: raise HTTPException(404, "Unknown booster")
    doc = {"kind": opt["kind"], "hours": opt["hours"], "price": opt["price"], "currency": "USD", "buyer_id": str(user["_id"]), "buyer": user["username"],
           "anonymous": body.anonymous, "status": "pending", "nonce": secrets.token_urlsafe(16), "created_at": iso(now())}
    res = await db.boosts.insert_one(doc)
    bid = str(res.inserted_id)
    if provider_for(user) == "paypal":
        from paypal_ipn import checkout_url
        url = checkout_url(bid, doc["nonce"], opt["hours"], opt["price"], _site(), user.get("email"), KINDS[opt["kind"]]["name"])
        await db.boosts.update_one({"_id": res.inserted_id}, {"$set": {"checkout_url": url, "via": "paypal"}})
        return {"url": url, "id": bid, "provider": "paypal"}
    custom = {"boost_id": bid, "user_id": str(user["_id"]), "nonce": doc["nonce"]}
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (request.client.host if request.client else "")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            ident, url, pkg_id = await _tebex_basket(client, opt, custom, ip)
    except httpx.HTTPError as e:
        await db.boosts.update_one({"_id": res.inserted_id}, {"$set": {"status": "failed", "error": str(e)}})
        raise HTTPException(424, "Could not reach Tebex, please try again in a moment")
    except HTTPException as e:
        await db.boosts.update_one({"_id": res.inserted_id}, {"$set": {"status": "failed", "error": e.detail}})
        raise
    if not url:
        await db.boosts.update_one({"_id": res.inserted_id}, {"$set": {"status": "failed", "error": "no checkout link", "ident": ident}})
        raise HTTPException(424, "Tebex did not return a checkout link")
    await db.boosts.update_one({"_id": res.inserted_id}, {"$set": {"ident": ident, "checkout_url": url, "via": "headless", "package_id": pkg_id}})
    return {"url": url, "id": bid, "ident": ident, "provider": "tebex"}


@api.post("/support/verify")
async def support_verify(user=Depends(get_current_user)):
    """Fallback when the webhook is slow: ask Tebex whether this angler's recent pending baskets are paid and fulfil them."""
    since = iso(now() - timedelta(hours=24))
    pend = await db.boosts.find({"buyer_id": str(user["_id"]), "status": "pending", "via": "headless", "created_at": {"$gte": since}}).to_list(10)
    done = 0
    for b in pend:
        data = await tebex_basket_complete(b["ident"])
        if data and data.get("complete"):
            await fulfil({"custom": {"boost_id": str(b["_id"]), "nonce": b["nonce"]}, "transaction_id": f"basket:{b['ident']}", "price_paid": {"amount": data.get("total_price"), "currency": data.get("currency")}}, f"verify:{b['ident']}")
            done += 1
    return {"checked": len(pend), "fulfilled": done, **(await queue_view())}


# ---------- webhook ----------
def _signature_ok(raw: bytes, sig: Optional[str]) -> bool:
    secret = _webhook_secret()
    if not secret or not sig: return False
    body_hash = hashlib.sha256(raw).hexdigest()
    expected = hmac.new(secret.encode(), body_hash.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig.strip().lower())


def _boost_id_from(subject):
    for p in subject.get("products") or []:
        c = p.get("custom") or {}
        if c.get("boost_id"): return c["boost_id"], c.get("nonce")
    c = subject.get("custom") or {}
    return c.get("boost_id"), c.get("nonce")


async def fulfil(subject, event_id):
    bid, nonce = _boost_id_from(subject)
    if not bid: log.warning("payment.completed without boost_id: %s", subject.get("transaction_id")); return
    b = await db.boosts.find_one_and_update(
        {"_id": ObjectId(bid), "nonce": nonce, "status": "pending"},
        {"$set": {"status": "queued", "paid_at": iso(now()), "txn_id": subject.get("transaction_id"), "event_id": event_id, "declined": None,
                  "paid": (subject.get("price_paid") or subject.get("price") or {}), "customer_email": (subject.get("customer") or {}).get("email")}},
        return_document=ReturnDocument.AFTER)
    if not b: log.info("boost %s already fulfilled or unknown", bid); return
    k = KINDS[kind_of(b)]
    ahead = await db.boosts.count_documents({**_kq(kind_of(b)), "status": {"$in": ["active", "queued"]}, "_id": {"$ne": b["_id"]}})
    when = "It starts right now." if ahead == 0 else f"There {'is' if ahead == 1 else 'are'} {ahead} {k['name']} booster{'s' if ahead > 1 else ''} ahead of yours in the queue. It starts automatically when they finish."
    await send_system_message(b["buyer_id"], b["buyer"], f"Thank you for supporting The Fishing Lands! Your {b['hours']}-hour {k['name']} ({k['perks']}) is paid for. {when} Every angler on the server will know it was {'an anonymous supporter' if b.get('anonymous') else 'you'}, and a supporter's heart now sits beside your name in chat and on your profile.")
    await mark_supporter(b["buyer_id"])
    await schedule(kind_of(b))


async def revoke(subject, reason):
    bid, _ = _boost_id_from(subject)
    if not bid: return
    b = await db.boosts.find_one({"_id": ObjectId(bid)})
    if not b or b["status"] in ("done", "refunded", "pending", "failed"): return
    if b["status"] == "active":
        await db.boosts.update_one({"_id": b["_id"]}, {"$set": {"status": "refunded", "ends_at": iso(now()), "revoked": reason}})
        _bust()
    else:
        await db.boosts.update_one({"_id": b["_id"]}, {"$set": {"status": "refunded", "revoked": reason}})
    await schedule(kind_of(b))


@api.post("/tebex/webhook")
async def tebex_webhook(request: Request):
    raw = await request.body()
    try:
        event = await request.json()
    except Exception:
        raise HTTPException(400, "Bad JSON")
    kind = event.get("type")
    sig = request.headers.get("x-signature")
    verified = _signature_ok(raw, sig)
    if kind == "validation.webhook":
        log.info("Tebex validation webhook %s (signature %s)", event.get("id"), "ok" if verified else "unverified")
        return {"id": event.get("id")}
    if not verified:
        log.warning("Rejected Tebex webhook %s: bad or missing signature", kind)
        raise HTTPException(401, "Invalid signature")
    try:
        await db.tebex_events.insert_one({"event_id": event.get("id"), "type": kind, "at": iso(now()), "txn": (event.get("subject") or {}).get("transaction_id")})
    except Exception:
        return {"ok": True, "duplicate": True}
    subject = event.get("subject") or {}
    if kind == "payment.completed":
        import premium
        import cosmetic_shop
        if not await premium.fulfil_premium(subject, event.get("id")) and not await cosmetic_shop.fulfil_cosmetic(subject, event.get("id")): await fulfil(subject, event.get("id"))
    elif kind.startswith("recurring-payment."):
        import premium
        await premium.recurring_event(kind, subject)
    elif kind == "payment.declined":
        await declined(subject)
    elif kind in ("payment.refunded", "payment.dispute.opened", "payment.dispute.lost"):
        import premium
        import cosmetic_shop
        if not await premium.revoke_premium(subject, kind) and not await cosmetic_shop.revoke_cosmetic(subject, kind): await revoke(subject, kind)
    return {"ok": True}


async def declined(subject):
    """A declined card leaves the boost pending (the angler may retry from the same basket) but records why, for the admin log."""
    bid, _ = _boost_id_from(subject)
    if not bid: return
    reason = (subject.get("decline_reason") or {}).get("message") or "declined"
    await db.boosts.update_one({"_id": ObjectId(bid), "status": "pending"}, {"$set": {"declined": reason, "declined_at": iso(now()), "txn_id": subject.get("transaction_id")}})


# ---------- admin ----------
class GrantIn(BaseModel):
    option: str
    anonymous: bool = False
    username: Optional[str] = None


@api.post("/admin/support/grant")
async def admin_grant_boost(body: GrantIn, user=Depends(get_current_user)):
    if not is_admin_user(user): raise HTTPException(403, "Admins only")
    opt = OPTIONS.get(body.option)
    if not opt: raise HTTPException(404, "Unknown booster")
    target = user
    if body.username:
        target = await db.users.find_one({"username_lc": body.username.lower()})
        if not target: raise HTTPException(404, "No such angler")
    doc = {"kind": opt["kind"], "hours": opt["hours"], "price": 0, "currency": "USD", "buyer_id": str(target["_id"]), "buyer": target["username"],
           "anonymous": body.anonymous, "status": "queued", "via": "admin", "granted_by": user["username"], "created_at": iso(now()), "paid_at": iso(now())}
    await db.boosts.insert_one(doc)
    await mark_supporter(target["_id"])
    await db.admin_log.insert_one({"admin": user["username"], "target": target["username"], "action": "boost_grant", "changes": {"kind": opt["kind"], "hours": opt["hours"], "anonymous": body.anonymous}, "at": iso(now())})
    await schedule(opt["kind"])
    return await queue_view()


@api.post("/admin/support/{boost_id}/end")
async def admin_end_boost(boost_id: str, user=Depends(get_current_user)):
    if not is_admin_user(user): raise HTTPException(403, "Admins only")
    b = await db.boosts.find_one({"_id": ObjectId(boost_id), "status": {"$in": ["active", "queued"]}})
    if not b: raise HTTPException(404, "Boost not found")
    await db.boosts.update_one({"_id": b["_id"]}, {"$set": {"status": "done", "ends_at": iso(now()), "ended_by": user["username"]}})
    _bust()
    await db.admin_log.insert_one({"admin": user["username"], "target": b["buyer"], "action": "boost_end", "changes": {"kind": kind_of(b), "hours": b["hours"], "was": b["status"]}, "at": iso(now())})
    await schedule(kind_of(b))
    return await queue_view()


@api.get("/admin/support/events")
async def admin_support_events(user=Depends(get_current_user)):
    if not is_admin_user(user): raise HTTPException(403, "Admins only")
    ev = await db.tebex_events.find({}, {"_id": 0}).sort("at", -1).limit(30).to_list(30)
    pp = await db.paypal_ipn.find({}, {"_id": 0}).sort("at", -1).limit(30).to_list(30)
    ev += [{"event_id": f"pp:{e.get('txn_id')}:{e.get('payment_status')}:{e['at']}", "type": f"paypal.{e.get('payment_status') or e.get('verdict')}", "at": e["at"], "txn": e.get("txn_id"), "result": e.get("result")} for e in pp]
    ev = sorted(ev, key=lambda e: e["at"], reverse=True)[:30]
    boosts = await db.boosts.find({}).sort("created_at", -1).limit(60).to_list(60)
    projected = {q["id"]: q["starts_at"] for lane in (await queue_view())["lanes"].values() for q in lane["queue"]}
    paid = [b for b in boosts if b.get("txn_id")]
    summary = {"paid_count": await db.boosts.count_documents({"txn_id": {"$exists": True}}),
               "revenue_usd": round(sum(b.get("price", 0) for b in await db.boosts.find({"txn_id": {"$exists": True}, "status": {"$ne": "refunded"}}, {"price": 1}).to_list(10000)), 2),
               "refunded": await db.boosts.count_documents({"status": "refunded"}),
               "hours_gifted": sum(b["hours"] for b in paid if b["status"] != "refunded"),
               "supporters": await db.users.count_documents({"supporter": True})}
    return {"summary": summary, "events": ev, "provider": PROVIDER, "provider_admin": PROVIDER_ADMIN,
            "boosts": [{**boost_out(b, projected.get(str(b["_id"]))), "buyer": b["buyer"], "price": b.get("price"), "via": b.get("via"), "txn_id": b.get("txn_id"), "error": b.get("error"),
                        "created_at": b.get("created_at"), "ended_by": b.get("ended_by"), "granted_by": b.get("granted_by"), "revoked": b.get("revoked"),
                        "email": b.get("customer_email"), "ident": b.get("ident"), "declined": b.get("declined")} for b in boosts]}
