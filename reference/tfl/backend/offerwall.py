"""offerwall.gg: free Pearls for completing offers. Players use the hosted wall (link in the header); we credit only on their signed postback."""
import hashlib
import hmac
import os

from fastapi import Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pymongo.errors import DuplicateKeyError

from server import api, db, now, iso, require_admin, logger

MAX_REWARD = 25000  # a single conversion above this is held for the admin instead of credited. A typo'd exchange rate must not print Pearls


def _keys():
    return os.environ["OFFERWALL_APP_ID"], os.environ["OFFERWALL_SECRET"]


@api.get("/offerwall/postback", response_class=PlainTextResponse)
async def postback(request: Request):
    """offerwall.gg → us. Signature = HMAC-SHA256(userId:transactionId:currencyAmount, secret). Dedupe on (tx, status); reversals are negative."""
    q = request.query_params
    uid, tx, amount_s, sig = q.get("user") or q.get("userId"), q.get("tx") or q.get("transactionId"), q.get("amount") or q.get("currencyAmount"), q.get("sig") or q.get("signature")
    if not (uid and tx and amount_s is not None and sig): raise HTTPException(400, "missing fields")
    expected = hmac.new(_keys()[1].encode(), f"{uid}:{tx}:{amount_s}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig): raise HTTPException(403, "invalid signature")
    if (q.get("test") or "0") == "1": return "ok"
    try: amount = int(round(float(amount_s)))
    except ValueError: raise HTTPException(400, "bad amount")
    status = q.get("status") or ("reversed" if amount < 0 else "credited")
    from bson import ObjectId
    if not ObjectId.is_valid(uid): raise HTTPException(400, "unknown user")
    held = status == "credited" and amount > MAX_REWARD
    doc = {"tx": tx, "status": "held" if held else status, "user_id": uid, "amount": amount, "offer": q.get("offer") or q.get("offerName"), "offer_id": q.get("offerId"),
           "payout_usd": q.get("payoutUsd"), "at": iso(now())}
    try: await db.offerwall_tx.insert_one(doc)
    except DuplicateKeyError: return "ok"
    if held:
        logger.warning("offerwall: held %s Pearls for %s (tx %s), above MAX_REWARD", amount, uid, tx); return "ok"
    if status == "reversed" and not await db.offerwall_tx.find_one({"tx": tx, "status": "credited"}):
        return "ok"  # nothing was credited under this transaction; nothing to take back
    await db.users.update_one({"_id": ObjectId(uid)}, {"$inc": {"pearls": amount, "stats.pearls_earned": max(amount, 0), "stats.offerwall_pearls": amount}})
    await db.users.update_one({"_id": ObjectId(uid), "pearls": {"$lt": 0}}, {"$set": {"pearls": 0}})
    if amount > 0:
        from server import notify
        await notify(uid, f"+{amount} Pearls from the offer wall, \"{doc['offer'] or 'offer'}\" paid out. Thank you!", "/game/pearl-shop")
    return "ok"


@api.get("/admin/offerwall")
async def admin_offerwall(admin=Depends(require_admin)):
    rows = await db.offerwall_tx.find({}).sort("at", -1).limit(100).to_list(100)
    ids = list({r["user_id"] for r in rows})
    from bson import ObjectId
    names = {str(u["_id"]): u["username"] async for u in db.users.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}}, {"username": 1})}
    return {"rows": [{**{k: r.get(k) for k in ("tx", "status", "amount", "offer", "payout_usd", "at")}, "username": names.get(r["user_id"], r["user_id"])} for r in rows],
            "total_pearls": sum(r["amount"] for r in rows if r["status"] == "credited"), "held": sum(1 for r in rows if r["status"] == "held")}
