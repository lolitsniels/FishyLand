"""PayPal Buy Now (_xclick, personal account) + IPN listener. Fulfilment happens only after PayPal confirms the notification (VERIFIED)."""
import logging
import os
from urllib.parse import parse_qsl, urlencode

import httpx
from bson import ObjectId
from fastapi import HTTPException, Request
from fastapi.responses import PlainTextResponse

from server import api, db, now, iso
import boosters

log = logging.getLogger("paypal")
CURRENCY = "USD"


def _mode():
    return os.environ.get("PAYPAL_MODE", "live")


def _checkout_base():
    return "https://www.sandbox.paypal.com/cgi-bin/webscr" if _mode() == "sandbox" else "https://www.paypal.com/cgi-bin/webscr"


def _verify_url():
    return "https://ipnpb.sandbox.paypal.com/cgi-bin/webscr" if _mode() == "sandbox" else "https://ipnpb.paypal.com/cgi-bin/webscr"


def receiver_email():
    return os.environ["PAYPAL_EMAIL"].strip().lower()


def checkout_url(boost_id: str, nonce: str, hours: int, price: float, site: str, buyer_email: str = None, name: str = "booster") -> str:
    q = {"cmd": "_xclick", "business": os.environ["PAYPAL_EMAIL"], "item_name": f"Fishing Realms: {name} server-wide booster, {hours} hours", "item_number": boost_id,
         "amount": f"{price:.2f}", "currency_code": CURRENCY, "custom": f"{boost_id}:{nonce}", "no_shipping": "1", "no_note": "1", "rm": "2",
         "notify_url": f"{site}/api/paypal/ipn", "return": f"{site}/game/support?paid=1", "cancel_return": f"{site}/game/support"}
    if buyer_email: q["email"] = buyer_email
    return f"{_checkout_base()}?{urlencode(q)}"


async def _verify(raw: bytes) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(_verify_url(), content=b"cmd=_notify-validate&" + raw,
                              headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "TheFishingLands-IPN/1.0"})
        r.raise_for_status()
        return r.text.strip()


def _subject(f: dict):
    """Shape an IPN message like the Tebex webhook subject so boosters.fulfil / revoke work unchanged."""
    bid, _, nonce = (f.get("custom") or "").partition(":")
    return {"transaction_id": f.get("txn_id"), "custom": {"boost_id": bid, "nonce": nonce},
            "price_paid": {"amount": f.get("mc_gross"), "currency": f.get("mc_currency")}, "customer": {"email": f.get("payer_email")}}


async def process_ipn(fields: dict):
    """Business checks + fulfilment for a VERIFIED message. Returns a short status string (also stored in the event log)."""
    status = fields.get("payment_status")
    txn = fields.get("txn_id")
    receiver = (fields.get("receiver_email") or fields.get("business") or "").strip().lower()
    if receiver != receiver_email():
        return f"ignored: receiver {receiver!r} is not ours"
    subject = _subject(fields)
    bid = subject["custom"]["boost_id"]
    if status == "Completed":
        if not ObjectId.is_valid(bid): return "ignored: no boost id in custom"
        b = await db.boosts.find_one({"_id": ObjectId(bid)})
        if not b: return f"ignored: unknown boost {bid}"
        if b.get("nonce") != subject["custom"]["nonce"]: return "rejected: nonce mismatch"
        if b["status"] != "pending": return f"noted: boost already {b['status']}"
        if fields.get("mc_currency") != CURRENCY: return f"rejected: currency {fields.get('mc_currency')}"
        try: gross = float(fields.get("mc_gross") or 0)
        except ValueError: gross = 0
        if gross + 1e-9 < float(b["price"]): return f"rejected: paid {gross} < price {b['price']}"
        await boosters.fulfil(subject, f"paypal:{txn}")
        return "fulfilled"
    if status in ("Refunded", "Reversed", "Canceled_Reversal"):
        if status != "Canceled_Reversal" and ObjectId.is_valid(bid):
            await boosters.revoke(subject, f"paypal.{status.lower()}")
            return "revoked"
        return f"noted: {status}"
    return f"noted: {status}"


@api.post("/paypal/ipn")
async def paypal_ipn(request: Request):
    raw = await request.body()
    fields = dict(parse_qsl(raw.decode("utf-8", "replace"), keep_blank_values=True))
    txn, status = fields.get("txn_id"), fields.get("payment_status")
    try:
        verdict = await _verify(raw)
    except httpx.HTTPError as e:
        log.warning("IPN verify unreachable (%s), asking PayPal to retry", e)
        raise HTTPException(503, "verify unavailable")
    if verdict != "VERIFIED":
        log.warning("IPN %s rejected by PayPal: %s", txn, verdict)
        await db.paypal_ipn.insert_one({"txn_id": txn, "payment_status": status, "verdict": verdict, "result": "rejected: not verified", "at": iso(now())})
        return PlainTextResponse("ok")
    # One event per (txn, status): PayPal re-sends until it gets a 200, so duplicates are expected.
    try:
        await db.paypal_ipn.insert_one({"txn_id": txn, "payment_status": status, "verdict": verdict, "at": iso(now()), "payer": fields.get("payer_email"),
                                        "gross": fields.get("mc_gross"), "currency": fields.get("mc_currency"), "custom": fields.get("custom"), "result": "processing"})
    except Exception:
        return PlainTextResponse("ok")
    result = await process_ipn(fields)
    log.info("IPN %s %s -> %s", txn, status, result)
    await db.paypal_ipn.update_one({"txn_id": txn, "payment_status": status}, {"$set": {"result": result}})
    return PlainTextResponse("ok")
