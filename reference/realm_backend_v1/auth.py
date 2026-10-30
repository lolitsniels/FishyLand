import os
import re
import random
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field

from db import db
from player import new_player, player_state

JWT_ALGORITHM = "HS256"
router = APIRouter(prefix="/api/auth")


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def _secret():
    return os.environ["JWT_SECRET"]


def create_access_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "type": "access", "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "type": "refresh", "exp": datetime.now(timezone.utc) + timedelta(days=30)}, _secret(), algorithm=JWT_ALGORITHM)


def _issue(response: Response, uid: str) -> dict:
    access, refresh = create_access_token(uid), create_refresh_token(uid)
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=2592000, path="/")
    return {"access_token": access, "refresh_token": refresh}


async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("banned"):
        raise HTTPException(403, "Account banned")
    return user


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=16, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)


class LoginIn(BaseModel):
    email: str
    password: str


class ClaimIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)


async def _username_free(name: str) -> bool:
    return await db.users.find_one({"username_lower": name.lower()}) is None


BLOCKED_WORDS = ["fuck", "shit", "bitch", "cunt", "nigg", "nazi", "hitler", "porn", "pussy", "whore", "slut", "asshole", "retard"]
BLOCKED_TOKENS = {"sex", "dick", "rape", "fag", "fags", "cock", "tits", "anal"}


def _name_ok(name: str) -> bool:
    n = name.lower().replace("0", "o").replace("1", "i").replace("3", "e").replace("4", "a").replace("5", "s").replace("_", "")
    tokens = set(re.split(r"[^a-z]+", re.sub(r"([a-z])([A-Z])", r"\1 \2", name).lower()))
    return not any(w in n for w in BLOCKED_WORDS) and not (tokens & BLOCKED_TOKENS) and n not in BLOCKED_TOKENS


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    if not _name_ok(body.username):
        raise HTTPException(400, "Please choose a different hero name")
    if not await _username_free(body.username):
        raise HTTPException(400, "Name already taken")
    doc = new_player(body.username, email, hash_password(body.password), False)
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {**_issue(response, str(res.inserted_id)), "player": await player_state(doc)}


@router.post("/guest")
async def guest(response: Response):
    name = None
    for _ in range(10):
        cand = f"Angler{random.randint(1000, 99999)}"
        if await _username_free(cand):
            name = cand
            break
    doc = new_player(name, None, None, True)
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    return {**_issue(response, str(res.inserted_id)), "player": await player_state(doc)}


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.strip().lower()
    ident = f"email:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    now = datetime.now(timezone.utc)
    if att and att.get("count", 0) >= 5 and att.get("locked_until") and att["locked_until"].replace(tzinfo=timezone.utc) > now:
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        count = (att.get("count", 0) if att else 0) + 1
        await db.login_attempts.update_one({"identifier": ident}, {"$set": {"count": count, "locked_until": now + timedelta(minutes=15)}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    if user.get("banned"):
        raise HTTPException(403, "Account banned")
    await db.login_attempts.delete_one({"identifier": ident})
    ip = _client_ip(request)
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": now.isoformat()}, "$push": {"ip_log": {"$each": [ip], "$slice": -10}}})
    return {**_issue(response, str(user["_id"])), "player": await player_state(user)}


@router.post("/claim")
async def claim(body: ClaimIn, user: dict = Depends(get_current_user)):
    if not user.get("is_guest"):
        raise HTTPException(400, "Account already claimed")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"email": email, "password_hash": hash_password(body.password), "is_guest": False}})
    user = await db.users.find_one({"_id": user["_id"]})
    return {"player": await player_state(user)}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    token = body.get("refresh_token") or request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(401, "Invalid token type")
    u = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not u or u.get("banned"):
        raise HTTPException(401, "User not found or banned")
    return _issue(response, payload["sub"])


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"player": await player_state(user)}


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    if await db.users.find_one({"email": email}) is None:
        doc = new_player("RealmOwner", email, hash_password(os.environ["ADMIN_PASSWORD"]), False)
        doc["role"] = "owner"
        await db.users.insert_one(doc)


