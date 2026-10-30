"""Forgot / reset password via emailed single-use link (Resend)."""
import os
import hashlib
import logging
import secrets
from datetime import timedelta
from html import escape

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

from server import api, db, now, iso, hash_password, client_ip, guest_ip_hash, rate_limit
from emails import send_email, email_configured, shell

log = logging.getLogger("password_reset")
RESET_TTL_MIN = 30
RESET_PER_IP_HOUR = 5
RESET_PER_USER_HOUR = 3
GENERIC_MSG = "If that angler has an email on file, a reset link is on its way. Check your spam folder too."


class ForgotIn(BaseModel):
    identifier: str = Field(min_length=2, max_length=120)


class ResetIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=4, max_length=72)


def token_hash(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


def reset_email_html(username: str, link: str) -> str:
    body = (f"Ahoy {escape(username)},<br><br>Someone asked to reset the password for your angler. If that was you, use the button below within {RESET_TTL_MIN} minutes.")
    return shell("Reset your password", body, ("Set a new password", link),
                 f"If you did not ask for this, ignore this mail; your password stays as it is. The link works once.<br><br>Or copy this address into your browser:<br><span style=\"word-break:break-all;color:#ffcfa8;\">{link}</span>", greeting="Lost your way? Let's get you back on the water.")


async def send_reset_email(user, link):
    if not email_configured():
        log.warning("RESEND not configured; reset link for %s: %s", user["username"], link)
        return
    await send_email(user["email"], "Reset your Fishing Lands password", reset_email_html(user["username"], link),
                     f"Reset your password within {RESET_TTL_MIN} minutes: {link}", tag="reset")


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn, request: Request):
    ip_hash = guest_ip_hash(client_ip(request))
    await rate_limit("forgot", ip_hash, RESET_PER_IP_HOUR, 60, "Too many reset requests. Try again in an hour.")
    since = iso(now() - timedelta(hours=1))
    ident = body.identifier.strip().lower()
    q = {"$or": [{"username_lc": ident}, {"email_lc": ident}]} if "@" in ident else {"username_lc": ident}
    user = await db.users.find_one(q)
    if user and user.get("email") and not user.get("is_guest") and not user.get("banned"):
        uid = str(user["_id"])
        if await db.password_resets.count_documents({"user_id": uid, "at": {"$gte": since}}) < RESET_PER_USER_HOUR:
            raw = secrets.token_urlsafe(32)
            await db.password_resets.update_many({"user_id": uid, "used": False}, {"$set": {"used": True}})
            await db.password_resets.insert_one({"user_id": uid, "token_hash": token_hash(raw), "ip_hash": ip_hash, "at": iso(now()),
                                                 "expires_at": iso(now() + timedelta(minutes=RESET_TTL_MIN)), "used": False})
            link = f"{os.environ['SITE_URL'].rstrip('/')}/reset-password?token={raw}"
            await send_reset_email(user, link)
    return {"ok": True, "message": GENERIC_MSG, "email_configured": email_configured()}


async def valid_reset(token: str):
    r = await db.password_resets.find_one({"token_hash": token_hash(token), "used": False})
    if not r or r["expires_at"] < iso(now()):
        return None
    return r


@api.get("/auth/reset-check")
async def reset_check(token: str):
    r = await valid_reset(token)
    if not r:
        return {"valid": False}
    from bson import ObjectId
    u = await db.users.find_one({"_id": ObjectId(r["user_id"])}, {"username": 1})
    return {"valid": True, "username": u["username"] if u else None, "expires_at": r["expires_at"]}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    r = await valid_reset(body.token)
    if not r:
        raise HTTPException(400, "This reset link is invalid or has expired. Request a new one.")
    from bson import ObjectId
    u = await db.users.find_one({"_id": ObjectId(r["user_id"])})
    if not u:
        raise HTTPException(400, "This angler no longer exists.")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_resets.update_many({"user_id": r["user_id"], "used": False}, {"$set": {"used": True, "used_at": iso(now())}})
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{u['username_lc']}$"}})
    return {"ok": True, "username": u["username"]}
