from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import asyncio
import time
import math
import zlib
import random
import logging
import hashlib
import httpx
from pymongo.errors import DuplicateKeyError
from pymongo import ReturnDocument
from datetime import datetime, timezone, timedelta
from typing import Optional, Any, List

import bcrypt
import mastery
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Response
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator
from typing_extensions import Annotated

from secrets_data import SECRET_FISH, SECRET_BY_ID, SECRET_CHANCE, SECRET_TITLE, window_open
from contracts_data import perk_val as favour_perk
from game_data import (WATER_POOL, BAIT_ONLY_OTHER, RARE_SET_WEAR_SKIP, FISH, FISH_BY_ID, FISH_BY_WATER, WATERS, RODS, REELS, LINES, BAITS, GEAR_BY_ID, BAIT_BY_ID,
                       RARITY_BASE_VALUE, RARITY_XP, RARITY_WEIGHT, GROUNDBAIT_MULT, BEHAVIORS, VARIANTS, INGREDIENTS, ING_BY_ID, RECIPES)
from quests_data import STORY_QUESTS, STORY_BY_ID, GUEST_QUESTS, GUEST_ORDER, daily_pool, weekly_pool
from avatars_data import AVATAR_BY_ID, STARTER_AVATARS, colour_hex
from referrals_data import LEVEL_STEP, RECRUIT_LEVEL_PEARLS, TITLE_LEVEL, MENTOR_TITLE, level_milestone

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
app = FastAPI()
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("owo")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
PyObjectId = Annotated[str, BeforeValidator(str)]
WATER_BY_KEY = {w["key"]: w for w in WATERS}
WATER_BY_KEY["hallow"] = {"key": "hallow", "name": "Any water (Halloween)", "type": "Halloween event", "salt": False, "level": 1, "fee": 0, "image": "/art/water_willow.jpg", "desc": "Halloween fish bite in every water while the event runs."}
MAX_ENERGY = 100
PREMIUM_MAX_ENERGY = 150


def premium_active(u):
    return bool(u.get("premium_until")) and u["premium_until"] > iso(now())


def max_energy(u):
    return PREMIUM_MAX_ENERGY if premium_active(u) else MAX_ENERGY


ENERGY_BANK_MULT = 2  # level-ups and potions may stack energy above the bar, up to this many bars


def energy_cap(u):
    return max_energy(u) * ENERGY_BANK_MULT
ONLINE_MINUTES = 30  # a player counts as online this long after the server last heard from them


def online_cutoff(t=None):
    return iso((t or now()) - timedelta(minutes=ONLINE_MINUTES))

LAST_SEEN_WRITE_SEC = 30  # presence heartbeat granularity; well under the ONLINE_MINUTES window
ENERGY_REGEN_SEC = 60
BOOST_ENERGY_MULT = 1.5  # energy regen speed while a server-wide booster is live
CAST_COST = 2
LIVE_BAIT_PER_FISH = 1  # was 3, a common fish was out-valuing early epics via Live Bait
VENDOR_RATE = 0.7
MARKET_FEE = 0.05
RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic"]
ADMIN_USERNAMES = {n.strip().lower() for n in os.environ.get("ADMIN_USERNAME", "").split(",") if n.strip()}
MAX_TROPHIES = 6
CONTEST_PRIZES = {"daily": [1500, 750, 300], "weekly": [8000, 4000, 1500], "crew": [12000, 6000, 2500]}
CONTEST_LABEL = {"heaviest": "Heaviest Catch", "species": "Most Species", "catches": "Most Catches", "rarity": "Rarity Points",
                 "weight": "Total Weight", "variants": "Variant Hunter", "legendary": "Legendary Hunter",
                 "crew": "Crew Total Weight", "crew_species": "Crew Species", "crew_rarity": "Crew Rarity Points"}
CONTEST_DESC = {"heaviest": "Single heaviest fish landed this period.", "species": "Most different species landed.", "catches": "Most fish landed, any size.",
                "rarity": "Points per fish: common 1, uncommon 3, rare 8, epic 20, legendary 50, mythic 120.", "weight": "Combined weight of everything you land.",
                "variants": "Most giant, albino, golden, scarred or monstrous fish landed.", "legendary": "Most legendary and mythic fish landed.",
                "crew": "Every kilogram your crew lands, pooled.", "crew_species": "Different species landed by the whole crew.", "crew_rarity": "Rarity points pooled across the crew."}
CONTEST_UNIT = {"heaviest": "kg", "species": "species", "catches": "catches", "rarity": "pts", "weight": "kg", "variants": "variants", "legendary": "legendaries",
                "crew": "kg", "crew_species": "species", "crew_rarity": "pts"}
CONTEST_POOL = ["heaviest", "species", "catches", "rarity", "weight", "variants", "legendary"]
CREW_CONTEST_POOL = ["crew", "crew_species", "crew_rarity"]
RARITY_POINTS = {"common": 1, "uncommon": 3, "rare": 8, "epic": 20, "legendary": 50, "mythic": 120}
WEEKLY_CHAMPION_TITLE = "Weekly Champion"
TOURNAMENT_LABEL = {"catches": "Most Catches", "heaviest": "Biggest Catch", "smallest": "Smallest Catch", "species": "Most Species", "rarity": "Rarity Points", "weight": "Heaviest Total", "variants": "Most Variants"}
TOURNAMENT_UNIT = {"catches": "catches", "heaviest": "kg", "smallest": "kg", "species": "species", "rarity": "pts", "weight": "kg", "variants": "variants"}
CREW_COST = 5000
CREW_MIN_LEVEL = 30
CREW_MAX = 20
SYSTEM_SENDER = "Harbourmaster"
PLACE_LABEL = {1: "1st", 2: "2nd", 3: "3rd"}


def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.isoformat()


def oid(s):
    try:
        return ObjectId(s)
    except Exception:
        raise HTTPException(400, "Invalid id")


MAX_LEVEL = 250


def xp_for_level(level):
    return int(80 * (level ** 1.55))


def level_from_xp(xp):
    lvl = 1
    while xp >= xp_for_level(lvl) and lvl < MAX_LEVEL:
        xp -= xp_for_level(lvl)
        lvl += 1
    return lvl, xp


# ---------- Auth ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(uid: str, username: str) -> str:
    return jwt.encode({"sub": uid, "username": username, "type": "access",
                       "exp": now() + timedelta(days=7)}, JWT_SECRET, algorithm=JWT_ALG)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def guest_ip_hash(ip: str) -> str:
    if not ip:
        return ""
    return hashlib.sha256(f"guest:{JWT_SECRET}:{ip}".encode()).hexdigest()


async def touch_ip(user, request: Request):
    """Remember the (hashed) connection an account is used from, last one plus a short history, for the admin 'Doubles' view."""
    ip = client_ip(request)
    h = guest_ip_hash(ip)
    if not h or (user.get("last_ip_hash") == h and user.get("last_ip")): return
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_ip_hash": h, "last_ip": ip, "last_ip_at": iso(now())}, "$push": {"ip_log": {"$each": [{"h": h, "ip": ip, "at": iso(now())}], "$slice": -10}}})


async def rate_limit(action: str, key: str, limit: int, window_min: int, msg: str):
    """Per-IP throttle for public endpoints (signup, guest, forgot-password). Events expire via TTL index on rate_events."""
    if not key: return
    since = datetime.now(timezone.utc) - timedelta(minutes=window_min)
    if await db.rate_events.count_documents({"action": action, "key": key, "at": {"$gte": since}}) >= limit:
        raise HTTPException(429, msg)
    await db.rate_events.insert_one({"action": action, "key": key, "at": datetime.now(timezone.utc)})


SIGNUPS_PER_IP_HOUR = 3


REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


async def ensure_referral_code(u):
    if u.get("referral_code"): return u["referral_code"]
    while True:
        code = "".join(random.choices(REF_ALPHABET, k=8))
        if not await db.users.find_one({"referral_code": code}):
            break
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"referral_code": code}})
    u["referral_code"] = code
    return code


async def link_recruit(doc, code, ip_hash, self_id=None):
    """Attach a recruiter to a user doc (mutates doc). Returns a small status dict or None when no code given."""
    if not code: return None
    rec = await db.users.find_one({"referral_code": code.strip().upper()})
    if not rec or rec.get("is_guest"): return {"applied": False, "reason": "Unknown referral code"}
    if self_id and rec["_id"] == self_id: return {"applied": False, "reason": "You cannot recruit yourself"}
    if ip_hash and ip_hash in (rec.get("reg_ip_hash"), rec.get("last_ip_hash")):
        return {"applied": False, "reason": "Referral not applied: you share a network with that recruiter"}
    doc["referred_by"] = str(rec["_id"]); doc["referred_at"] = iso(now()); doc["referral_stage"] = 0
    return {"applied": True, "recruiter": rec["username"]}


async def check_referral(user):
    """Pay out any newly reached referral stages for this recruit (user = fresh doc)."""
    if not user.get("referred_by") or user.get("is_guest") or user.get("referral_flag"): return
    level = level_from_xp(user["xp"])[0]
    if level < user.get("referral_lvl_paid", 0) + LEVEL_STEP: return
    rec = await db.users.find_one({"_id": ObjectId(user["referred_by"])})
    if not rec: return
    if user.get("last_ip_hash") and user["last_ip_hash"] in (rec.get("last_ip_hash"), rec.get("reg_ip_hash")):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"referral_flag": "same_network"}})
        return
    await pay_level_milestones(user, rec, level)


async def pay_level_milestones(user, rec, level):
    """Every 10 levels the recruit gains: crate + Pearls for the recruiter, a few Pearls for the recruit. Claimed atomically per milestone."""
    from crates import grant_crate, CRATES
    paid = user.get("referral_lvl_paid", 0)
    for ms in range(paid + LEVEL_STEP, level // LEVEL_STEP * LEVEL_STEP + 1, LEVEL_STEP):
        got = await db.users.update_one({"_id": user["_id"], "referral_lvl_paid": {"$in": [paid, None]} if not paid else paid}, {"$set": {"referral_lvl_paid": ms}, "$inc": {"pearls": RECRUIT_LEVEL_PEARLS, "stats.pearls_earned": RECRUIT_LEVEL_PEARLS}})
        if not got.modified_count: return
        paid = ms
        r = level_milestone(ms)
        upd = {"$inc": {"pearls": r["pearls"], "stats.pearls_earned": r["pearls"], "stats.referral_pearls": r["pearls"]}}
        if ms == TITLE_LEVEL: upd["$inc"]["stats.recruits_completed"] = 1; upd["$addToSet"] = {"titles": MENTOR_TITLE}
        await db.users.update_one({"_id": rec["_id"]}, upd)
        await grant_crate(rec["_id"], rec["username"], r["crate"], f"your recruit {user['username']} reached level {ms}")
        text = f"a {CRATES[r['crate']]['name']} + {r['pearls']} Pearls" + (f' + the title "{MENTOR_TITLE}"' if ms == TITLE_LEVEL else "")
        await db.referral_log.insert_one({"recruiter_id": str(rec["_id"]), "recruit_id": str(user["_id"]), "recruit": user["username"], "stage": 0,
                                          "name": f"level {ms}", "reward": text, "at": iso(now())})
        await add_feed("referral", rec["username"], f"{user['username']}, recruited by {rec['username']}, reached level {ms}. {rec['username']} earned {text}.", "rare")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("banned") and not await ban_expired(user):
        raise HTTPException(403, ban_text(user["banned"]))
    stored_energy, stored_at, stored_seen = user["energy"], user["energy_at"], user.get("last_seen") or ""
    user = await apply_energy_live(user)
    t = iso(now())
    # Only write when something actually changed; polling endpoints otherwise hammer the pool with no-op updates.
    changed = user["energy"] != stored_energy or (user["energy"] < max_energy(user) and user["energy_at"] != stored_at)
    if changed or stored_seen < iso(now() - timedelta(seconds=LAST_SEEN_WRITE_SEC)):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"energy": user["energy"], "energy_at": user["energy_at"], "last_seen": t}})
    user["last_seen"] = t if changed or stored_seen < t else stored_seen
    from presence import touch_presence
    touch_presence(user, request)
    return user


def regen_sec(user):
    t = ((user.get("crew") or {}).get("perks") or {}).get("energy", 0)
    return ENERGY_REGEN_SEC / (1 + 0.1 * t)


def apply_energy(user, windows=()):
    """Credit regen since energy_at. `windows` = [(start, end)] of server boosters; time inside them regens BOOST_ENERGY_MULT× faster."""
    last = datetime.fromisoformat(user["energy_at"])
    t_now = now()
    base = regen_sec(user)
    fast = base / BOOST_ENERGY_MULT
    user["_regen_now"] = fast if any(ws <= t_now < we for ws, we in windows) else base
    if user["energy"] >= max_energy(user):
        user["energy_at"] = iso(t_now)
        return user
    cuts = sorted({last, t_now, *[c for w in windows for c in w if last < c < t_now]})
    segs = [(a, b, fast if any(ws <= a and b <= we for ws, we in windows) else base) for a, b in zip(cuts, cuts[1:])]
    gained = int(sum((b - a).total_seconds() / r for a, b, r in segs))
    if gained > 0:
        acc, anchor = 0.0, t_now
        for a, b, r in segs:
            dp = (b - a).total_seconds() / r
            if acc + dp >= gained:
                anchor = a + timedelta(seconds=(gained - acc) * r)
                break
            acc += dp
        user["energy"] = min(max_energy(user), user["energy"] + gained)
        user["energy_at"] = iso(t_now if user["energy"] >= max_energy(user) else anchor)
    return user


_WINDOWS_NOW = []  # latest booster windows; lets public_user() report the boosted regen even for docs re-read from the DB


def regen_now(user):
    if user.get("_regen_now"): return user["_regen_now"]
    base = regen_sec(user)
    t = now()
    return base / BOOST_ENERGY_MULT if any(ws <= t < we for ws, we in _WINDOWS_NOW) else base


async def apply_energy_live(user):
    global _WINDOWS_NOW
    from boosters import energy_windows
    _WINDOWS_NOW = await energy_windows()
    return apply_energy(user, _WINDOWS_NOW)


MAX_DURABILITY = 100
WORN_PENALTY = 0.7  # stat multiplier for gear at 0 durability
REPAIR_RATE = 0.006  # gold per point = item price * rate (min 1g); free gear repairs free
# Pearls: rare cosmetic currency
WEEKLY_PEARLS, STREAK_PEARLS, TITLE_ACH_PEARLS, BOSS_PEARLS = 1, 3, 1, 1
CONTEST_PEARLS = {"daily": [3, 2, 1], "weekly": [8, 4, 2], "crew": [3, 2, 1]}


def gear_dur(u, gear_id):
    return (u.get("durability") or {}).get(gear_id, MAX_DURABILITY)


def durability_map(u):
    return {g: gear_dur(u, g) for g in u.get("owned_gear", [])}


def repair_cost_per_point(g):
    return 0 if g["price"] == 0 else REPAIR_BANDS.get(g.get("tier", 1), 50)


async def charge(user, update: dict, gold: int = 0, pearls: int = 0, extra: Optional[dict] = None, msg: str = "Not enough gold"):
    """Atomic spend: the balance check lives in the update filter so concurrent (spammed) requests can't double-charge."""
    flt = {"_id": user["_id"], **(extra or {})}
    if gold: flt["gold"] = {"$gte": gold}
    if pearls: flt["pearls"] = {"$gte": pearls}
    inc = dict(update.get("$inc", {}))
    if gold: inc["gold"] = inc.get("gold", 0) - gold
    if pearls: inc["pearls"] = inc.get("pearls", 0) - pearls; inc["stats.pearls_spent"] = inc.get("stats.pearls_spent", 0) + pearls
    upd = {**update, "$inc": inc} if inc else update
    r = await db.users.update_one(flt, upd)
    if r.matched_count == 0: raise HTTPException(400, msg)


DUEL_LEVEL = 10  # the duelling pier opens at this level
POTION_ENERGY = 100
POTION_COOLDOWN_H = 1


def potion_next_at(u):
    """ISO time the next Energy Potion may be drunk, or None if one can be drunk now."""
    last = u.get("potion_used_at")
    if not last: return None
    nxt = datetime.fromisoformat(last) + timedelta(hours=POTION_COOLDOWN_H)
    return iso(nxt) if nxt > now() else None


def public_user(u):
    level, into = level_from_xp(u["xp"])
    return {
        "id": str(u["_id"]), "username": u["username"], "gold": u["gold"], "xp": u["xp"], "level": level, "tutorial": u.get("tutorial"), "seen_flags": u.get("seen_flags") or [], "app_reward": bool(u.get("app_reward_at")), "humancheck_due": bool((u.get("humancheck") or {}).get("pending")),
        "pearls": u.get("pearls", 0), "candles": u.get("candles", 0), "avatar": look_of(u.get("avatar")), "owned_avatars": u.get("owned_avatars", []),
        "name_colour": u.get("name_colour"), "name_colour_hex": colour_hex(u), "frame": u.get("frame"), "wall": u.get("wall"), "rod_skin": u.get("rod_skin"), "owned_rod_skins": u.get("owned_rod_skins") or [],
        "durability": durability_map(u),
        "xp_into_level": into, "xp_next": xp_for_level(level), "energy": u["energy"], "max_energy": max_energy(u), "energy_cap": energy_cap(u), "premium": premium_active(u), "premium_until": u.get("premium_until"),
        "energy_regen_sec": round(regen_now(u), 2), "energy_progress_sec": round(max(0.0, (now() - datetime.fromisoformat(u["energy_at"])).total_seconds()), 2) if u["energy"] < max_energy(u) else 0,
        "cast_cost": CAST_COST, "repair_discount": repair_discount(u), "bait_discount": bait_discount(u), "market_fee": market_fee(u), "water": u["water"], "unlocked_waters": u["unlocked_waters"],
        "gear": u["gear"], "owned_gear": u["owned_gear"], "bait": u["bait"], "active_bait": u.get("active_bait"), "ingredients": u.get("ingredients", {}), "ingredient_buys": ingredient_buys_today(u),
        "stats": u["stats"], "created_at": u["created_at"], "title": title_for(level, u["stats"], u.get("active_title"), is_admin_user(u)),
        "is_admin": is_admin_user(u), "is_mod": is_mod_user(u) and not is_admin_user(u), "warning": u.get("warning"), "test_water": is_admin_user(u) or bool(u.get("test_water")),
        "duel_access": level >= DUEL_LEVEL, "duel_level": DUEL_LEVEL,
        "duel": {k: (u.get("duel") or {}).get(k, 0) for k in ("wins", "losses", "draws", "streak", "best_streak")},
        "potion": {"have": (u.get("items") or {}).get("potion_energy", 0), "next_at": potion_next_at(u), "energy": POTION_ENERGY, "cooldown_h": POTION_COOLDOWN_H},
        "enhance": {k: v for k, v in (u.get("enhance") or {}).items() if v}, "scrap": int(u.get("scrap", 0)), "seals": int((u.get("items") or {}).get("seal", 0)), "passes": int((u.get("items") or {}).get("pass_month", 0)) + int((u.get("items") or {}).get("pass_week", 0)),
        "salvage_count": sum(v for v in (u.get("salvage") or {}).values() if v > 0),
        "is_guest": bool(u.get("is_guest")), "pending_setup": bool(u.get("pending_setup")),
        "offerwall_url": None,
        "email": u.get("email"),
        "rare_set": rare_set(u), "gear_bonuses": gear_bonuses(u), "achievements": u.get("achievements", []), "titles": u.get("titles", []) + ([ADMIN_TITLE] if is_admin_user(u) and ADMIN_TITLE not in u.get("titles", []) else []), "active_title": u.get("active_title"),
        "crew": u.get("crew"), "crates": {k: v for k, v in (u.get("items") or {}).items() if k.startswith("crate_") and v > 0},
        "spare_copies": {k: v for k, v in (u.get("spare_copies") or {}).items() if v},
        "share_reward": 0 if u.get("share_day") == now().date().isoformat() else share_reward_amount(level),
    }


def share_reward_amount(level):
    return max(100, min(2000, 40 * level))


def is_admin_user(u):
    return u.get("role") == "admin" or u["username_lc"] in ADMIN_USERNAMES


async def ban_expired(u):
    b = u["banned"]
    if not isinstance(b, dict) or not b.get("until") or b["until"] > iso(now()): return False
    await db.users.update_one({"_id": u["_id"]}, {"$unset": {"banned": ""}})
    u.pop("banned", None)
    return True


def ban_text(b):
    until = f" until {b['until'][:16].replace('T', ' ')} UTC" if isinstance(b, dict) and b.get("until") else ""
    return f"This account has been banned{until}. {(b or {}).get('reason') or '' if isinstance(b, dict) else ''}".strip()


def is_mod_user(u):
    return u.get("role") == "mod"


def mute_active(u):
    m = u.get("mute")
    if not m: return None
    if m.get("until") and datetime.fromisoformat(m["until"]) <= now(): return None
    return m


async def require_admin(user=Depends(get_current_user)):
    if not is_admin_user(user):
        raise HTTPException(403, "Admins only")
    return user


ADMIN_TITLE = "Harbour Warden"


def title_for(level, stats, active_title=None, admin=False):
    if active_title: return active_title
    if admin: return ADMIN_TITLE
    if level >= 250: return "Living Myth"
    if level >= 200: return "Fathom Lord"
    if level >= 150: return "Tidecaller"
    if level >= 100: return "Centurion of the Deep"
    if stats.get("legendary", 0) >= 3: return "Living Legend"
    if level >= 70: return "Grand Angler"
    if level >= 45: return "Master Angler"
    if level >= 30: return "Deepwater Captain"
    if level >= 20: return "Sea Hand"
    if level >= 10: return "River Warden"
    if level >= 5: return "Pond Regular"
    return "Greenhorn"


LOOK_RE = re.compile(r"^look:[mf]_[0-3]_[0-4]$")
DEFAULT_LOOK = "look:m_1_1"


def look_of(a):
    """The 2.5D character (gender_skin_hair) is the avatar; legacy avatar ids map to the default male angler."""
    return a if isinstance(a, str) and LOOK_RE.match(a) else DEFAULT_LOOK


def new_user_doc(username, pw_hash, email=None, is_guest=False, avatar=None):
    doc = {"username": username, "username_lc": username.lower(), "password_hash": pw_hash,
           "is_guest": bool(is_guest), "pending_setup": bool(is_guest),
           "gold": 120, "xp": 0, "pearls": 0,
           "avatar": look_of(avatar), "owned_avatars": [],
           "durability": {"rod_cane": MAX_DURABILITY, "reel_spool": MAX_DURABILITY, "line_cotton": MAX_DURABILITY},
           "energy": MAX_ENERGY, "energy_at": iso(now()), "water": "millbrook", "unlocked_waters": ["millbrook"],
           "gear": {"rod": "rod_cane", "reel": "reel_spool", "line": "line_cotton"},
           "owned_gear": ["rod_cane", "reel_spool", "line_cotton"], "bait": {"bait_worm": 15}, "active_bait": "bait_worm",
           "stats": {"casts": 0, "catches": 0, "escaped": 0, "heaviest_kg": 0, "heaviest_name": None, "gold_earned": 0, "species": 0,
                     "legendary": 0, "sold": 0},
           "tutorial": {"step": 0, "done": False},
           "created_at": iso(now()), "last_seen": iso(now())}
    if email:
        doc["email"] = email
        doc["email_lc"] = email
    return doc


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=16)
    password: str = Field(min_length=4, max_length=72)
    email: Optional[str] = Field(default=None, max_length=120)
    avatar: Optional[str] = None
    ref: Optional[str] = Field(default=None, max_length=16)
    source: Optional[str] = Field(default=None, max_length=120)
    source_page: Optional[str] = Field(default=None, max_length=300)
    guide: Optional[str] = Field(default=None, max_length=80, pattern="^[a-z0-9-]+$")


class GuestIn(BaseModel):
    ref: Optional[str] = Field(default=None, max_length=16)
    source: Optional[str] = Field(default=None, max_length=120)
    source_page: Optional[str] = Field(default=None, max_length=300)
    guide: Optional[str] = Field(default=None, max_length=80, pattern="^[a-z0-9-]+$")
    recaptcha_token: Optional[str] = Field(default=None, max_length=4096)
    portal: Optional[str] = Field(default=None, pattern="^(gd|smaz|pg)$")


RECAPTCHA_SECRET = os.environ.get("RECAPTCHA_SECRET_KEY")
RECAPTCHA_MIN_SCORE = float(os.environ.get("RECAPTCHA_MIN_SCORE", "0.5"))
RECAPTCHA_ACTION = "guest_signup"


async def verify_recaptcha(body: Optional[GuestIn]):
    """reCAPTCHA v3: token must verify with Google, carry our action and clear the score bar. Fails closed if Google is unreachable."""
    if not RECAPTCHA_SECRET: raise HTTPException(503, "Bot check is not configured")
    if body is None or not body.recaptcha_token: raise HTTPException(400, "Bot check failed, please reload the page and try again")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            r = await client.post("https://www.google.com/recaptcha/api/siteverify", data={"secret": RECAPTCHA_SECRET, "response": body.recaptcha_token})
            r.raise_for_status(); res = r.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Bot check unavailable right now, try again in a moment")
    score = res.get("score")
    if not res.get("success") or res.get("action") != RECAPTCHA_ACTION or score is None or score < RECAPTCHA_MIN_SCORE:
        logging.info("recaptcha rejected: success=%s action=%s score=%s errors=%s", res.get("success"), res.get("action"), score, res.get("error-codes"))
        raise HTTPException(400, "Bot check failed, please reload the page and try again")
    return score


class LoginIn(BaseModel):
    username: str
    password: str


class CompleteSignupIn(BaseModel):
    username: str = Field(min_length=3, max_length=16)
    password: str = Field(min_length=4, max_length=72)
    email: Optional[str] = Field(default=None, max_length=120)
    avatar: Optional[str] = None
    source: Optional[str] = Field(default=None, max_length=120)
    source_page: Optional[str] = Field(default=None, max_length=300)
    guide: Optional[str] = Field(default=None, max_length=80, pattern="^[a-z0-9-]+$")


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean_email(raw):
    if raw is None:
        return None
    s = raw.strip().lower()
    if not s:
        return None
    if not EMAIL_RE.match(s):
        raise HTTPException(400, "That doesn't look like a valid email")
    if len(s) > 120:
        raise HTTPException(400, "Email is too long")
    return s


def set_auth(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=7 * 86400, path="/")


def _random_guest_name():
    return "Guest_" + "".join(random.choices("abcdefghjkmnpqrstuvwxyz23456789", k=6))


async def seed_guest_quests(user_id):
    uid = str(user_id)
    docs = []
    for q in GUEST_QUESTS:
        docs.append({"user_id": uid, "quest_id": q["id"], "kind": "guest", "period": None,
                     "name": q["name"], "desc": q["desc"], "story": q["story"], "step": q["step"],
                     "objective": q["objective"], "target": q["target"], "progress": 0,
                     "reward": q["reward"], "status": "active" if q["step"] == 1 else "locked",
                     "created_at": iso(now())})
    try:
        await db.quests.insert_many(docs, ordered=False)
    except Exception:
        pass


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response, request: Request):
    if not re.fullmatch(r"[A-Za-z0-9_]+", body.username):
        raise HTTPException(400, "Username may only contain letters, numbers and underscores")
    if body.username.lower().startswith("guest_"):
        raise HTTPException(400, "That name is reserved for guest accounts")
    if body.username.lower() == SYSTEM_SENDER.lower():
        raise HTTPException(400, "That name is reserved for the harbour")
    if await db.users.find_one({"username_lc": body.username.lower()}):
        raise HTTPException(400, "That name is already taken on this server")
    email = _clean_email(body.email)
    if email and await db.users.find_one({"email_lc": email}):
        raise HTTPException(400, "That email is already registered")
    doc = new_user_doc(body.username, hash_password(body.password), email=email, avatar=body.avatar)
    doc["acq_source"] = (body.source or "").strip().lower()[:120] or "direct / typed"; doc["claimed_at"] = doc["created_at"]
    if body.source_page: doc["acq_page"] = body.source_page.strip().lower()[:300]
    if body.guide: doc["acq_guide"] = body.guide
    ip_hash = guest_ip_hash(client_ip(request))
    await rate_limit("signup", ip_hash, SIGNUPS_PER_IP_HOUR, 60, "Too many new accounts from your connection. Try again in an hour.")
    if ip_hash: doc["reg_ip_hash"] = ip_hash; doc["last_ip_hash"] = ip_hash
    referral = await link_recruit(doc, body.ref, ip_hash)
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await add_feed("join", body.username, f"{body.username} arrived at Millbrook Pond for the first time.", "common")
    if email:
        asyncio.create_task(emails.send_welcome(doc, await ensure_referral_code(doc)))
    token = make_token(str(res.inserted_id), body.username)
    set_auth(response, token)
    return {"token": token, "user": public_user(doc), "referral": referral}


@api.post("/auth/guest")
async def guest_register(request: Request, response: Response, body: Optional[GuestIn] = None):
    if RECAPTCHA_SECRET and not (body and body.portal):  # no key configured = IP limits only; portal builds (GameDistribution) may not load Google's bot check; IP limits below still apply
        await verify_recaptcha(body)
    ip_hash = guest_ip_hash(client_ip(request))
    # Same IP already has a live guest? Sign them back into that account instead of
    # spawning a fresh one, so logging out and hitting "Play as guest" resumes progress.
    if ip_hash:
        existing = await db.users.find_one({"is_guest": True, "guest_ip_hash": ip_hash, "banned": {"$exists": False}})
        if existing:
            token = make_token(str(existing["_id"]), existing["username"])
            set_auth(response, token)
            return {"token": token, "user": public_user(existing), "resumed": True}
    for _ in range(20):
        name = _random_guest_name()
        if not await db.users.find_one({"username_lc": name.lower()}):
            break
    else:
        raise HTTPException(500, "Could not allocate a guest name, try again")
    # Random throwaway password; guest logs in via the JWT/cookie until they claim.
    await rate_limit("signup", ip_hash, SIGNUPS_PER_IP_HOUR, 60, "Too many new accounts from your connection. Try again in an hour.")
    pw = "guest-" + "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=24))
    doc = new_user_doc(name, hash_password(pw), is_guest=True)
    doc["acq_source"] = (body.source or "").strip().lower()[:120] or "direct / typed"
    if body.source_page: doc["acq_page"] = body.source_page.strip().lower()[:300]
    if body.guide: doc["acq_guide"] = body.guide
    if ip_hash:
        doc["guest_ip_hash"] = ip_hash; doc["reg_ip_hash"] = ip_hash; doc["last_ip_hash"] = ip_hash
    referral = await link_recruit(doc, body.ref if body else None, ip_hash)
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await seed_guest_quests(res.inserted_id)
    await add_feed("join", name, f"{name} wandered onto the dock at Millbrook Pond.", "common")
    token = make_token(str(res.inserted_id), name)
    set_auth(response, token)
    return {"token": token, "user": public_user(doc), "resumed": False, "referral": referral}


@api.post("/auth/complete-signup")
async def complete_signup(body: CompleteSignupIn, response: Response, user=Depends(get_current_user)):
    if not user.get("is_guest"):
        raise HTTPException(400, "This account is already set up")
    if not re.fullmatch(r"[A-Za-z0-9_]+", body.username):
        raise HTTPException(400, "Username may only contain letters, numbers and underscores")
    if body.username.lower().startswith("guest_"):
        raise HTTPException(400, "Please pick a real angler name")
    if body.username.lower() == SYSTEM_SENDER.lower():
        raise HTTPException(400, "That name is reserved for the harbour")
    if body.username.lower() != user["username_lc"] and await db.users.find_one({"username_lc": body.username.lower()}):
        raise HTTPException(400, "That name is already taken on this server")
    email = _clean_email(body.email)
    if email:
        clash = await db.users.find_one({"email_lc": email, "_id": {"$ne": user["_id"]}})
        if clash:
            raise HTTPException(400, "That email is already registered")
    upd = {"username": body.username, "username_lc": body.username.lower(),
           "password_hash": hash_password(body.password),
           "is_guest": False, "pending_setup": False, "claimed_at": iso(now())}
    if not user.get("acq_source"):
        upd["acq_source"] = (body.source or "").strip().lower()[:120] or "direct / typed"
        if body.source_page: upd["acq_page"] = body.source_page.strip().lower()[:300]
    if body.guide and not user.get("acq_guide"): upd["acq_guide"] = body.guide
    if body.avatar and LOOK_RE.match(body.avatar):
        upd["avatar"] = body.avatar
    unset = {}
    if email:
        upd["email"] = email
        upd["email_lc"] = email
    else:
        unset["email"] = ""
        unset["email_lc"] = ""
    # Free the IP for future guest sessions once the account is claimed.
    unset["guest_ip_hash"] = ""
    op = {"$set": upd}
    if unset:
        op["$unset"] = unset
    await db.users.update_one({"_id": user["_id"]}, op)
    # rewrite the display name on catches/chat/feed/listings so history follows the angler
    old_name = user["username"]
    new_name = body.username
    if old_name != new_name:
        await rename_user(user, new_name)
        await add_feed("join", new_name, f"{new_name} claimed the dock (was {old_name}).", "common")
    fresh = await db.users.find_one({"_id": user["_id"]})
    await check_referral(fresh)
    if email and not user.get("email"):
        asyncio.create_task(emails.send_welcome(fresh, await ensure_referral_code(fresh)))
    token = make_token(str(user["_id"]), new_name)
    set_auth(response, token)
    return {"token": token, "user": public_user(await apply_energy_live(fresh))}


async def rename_user(user, new_name):
    """Rewrite the display name everywhere history references it (users doc updated by caller)."""
    uid, old = str(user["_id"]), user["username"]
    await db.catches.update_many({"user_id": uid}, {"$set": {"username": new_name}})
    await db.catches.update_many({"caught_by": uid}, {"$set": {"caught_by_name": new_name}})
    await db.catch_log.update_many({"caught_by": uid}, {"$set": {"caught_by_name": new_name, "username": new_name}})
    await db.listings.update_many({"seller_id": uid}, {"$set": {"seller": new_name}})
    await db.chat.update_many({"username": old}, {"$set": {"username": new_name}})
    await db.messages.update_many({"from_id": uid}, {"$set": {"from": new_name}})
    await db.messages.update_many({"to_id": uid}, {"$set": {"to": new_name}})
    await db.friends.update_many({"from_id": uid}, {"$set": {"from_name": new_name}})
    await db.friends.update_many({"to_id": uid}, {"$set": {"to_name": new_name}})
    await db.boss_kills.update_many({"user_id": uid}, {"$set": {"username": new_name}})
    await db.bounty_claims.update_many({"user_id": uid}, {"$set": {"username": new_name}})
    await db.alerts.update_many({"username": old}, {"$set": {"username": new_name}})
    await db.crews.update_many({"members.user_id": uid}, {"$set": {"members.$.username": new_name}})
    await db.crews.update_many({"leader_id": uid}, {"$set": {"leader": new_name}})
    await db.crew_invites.update_many({"user_id": uid}, {"$set": {"username": new_name}})


@api.post("/auth/login")
async def login(body: LoginIn, response: Response, request: Request):
    ident = f"{request.client.host}:{body.username.lower()}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and datetime.fromisoformat(att["last"]) > now() - timedelta(minutes=15):
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    ident_lc = body.username.strip().lower()
    user = await db.users.find_one({"$or": [{"username_lc": ident_lc}, {"email_lc": ident_lc}]} if "@" in ident_lc else {"username_lc": ident_lc})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": ident}, {"$inc": {"count": 1}, "$set": {"last": iso(now())}}, upsert=True)
        raise HTTPException(401, "Wrong name, email or password")
    if user.get("banned") and not await ban_expired(user):
        raise HTTPException(403, ban_text(user["banned"]))
    await db.login_attempts.delete_one({"identifier": ident})
    await touch_ip(user, request)
    token = make_token(str(user["_id"]), user["username"])
    set_auth(response, token)
    return {"token": token, "user": public_user(await apply_energy_live(user))}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(request: Request, user=Depends(get_current_user)):
    await touch_ip(user, request)
    user = (await premium.auto_potion(user)) or user
    return public_user(user)


@api.get("/auth/ping")
async def ping(user=Depends(get_current_user)):
    """Presence heartbeat for hidden tabs: get_current_user already refreshes last_seen."""
    return {"ok": True}


class ChangePasswordIn(BaseModel):
    current: str = Field(max_length=72)
    password: str = Field(min_length=4, max_length=72)
    confirm: str = Field(max_length=72)


class ChangeEmailIn(BaseModel):
    current: str = Field(max_length=72)
    email: Optional[str] = Field(default=None, max_length=120)


def _check_current_password(user, current: str):
    if user.get("is_guest"): raise HTTPException(400, "Claim your account first (use the banner above the harbour)")
    if not verify_password(current, user["password_hash"]): raise HTTPException(400, "Your current password is wrong")


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(get_current_user)):
    _check_current_password(user, body.current)
    if body.password != body.confirm: raise HTTPException(400, "The two new passwords don't match")
    if body.password == body.current: raise HTTPException(400, "The new password is the same as the old one")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(body.password), "password_changed_at": iso(now())}})
    await db.password_resets.update_many({"user_id": str(user["_id"]), "used": {"$ne": True}}, {"$set": {"used": True}})
    return {"ok": True}


@api.post("/auth/email")
async def change_email(body: ChangeEmailIn, user=Depends(get_current_user)):
    _check_current_password(user, body.current)
    email = _clean_email(body.email)
    if email and email == user.get("email_lc"): raise HTTPException(400, "That is already your email")
    if email and await db.users.find_one({"email_lc": email, "_id": {"$ne": user["_id"]}}): raise HTTPException(400, "That email is already registered")
    if email: await db.users.update_one({"_id": user["_id"]}, {"$set": {"email": email, "email_lc": email}})
    else: await db.users.update_one({"_id": user["_id"]}, {"$unset": {"email": "", "email_lc": ""}})
    return {"ok": True, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


# ---------- Static game data ----------
HARD_WATER_BONUS = 0.20  # extra gold & XP at the very hardest water, scaled by pressure


def water_pressure(water_key):
    """0 at the first water, a step harder each water up to 1.0 at the last one."""
    t = next((i for i, w in enumerate(WATERS) if w["key"] == water_key), 0)
    return round(t / (len(WATERS) - 1), 3)


RARITY_PRESSURE = {"common": 0.3, "uncommon": 0.45, "rare": 0.7, "epic": 1.0, "legendary": 1.3, "mythic": 1.6}


def soft_cap(raw, cap):
    return raw if raw <= cap else cap + (raw - cap) * 0.35



def _game_data_payload():
    return {"waters": [{**w, "rough_pct": round(HARD_WATER_BONUS * water_pressure(w["key"]) * 100), "pressure": water_pressure(w["key"])} for w in WATERS], "fish": [{k: v for k, v in f.items() if k not in ("hours", "window_label")} for f in FISH], "rods": RODS, "reels": REELS, "lines": LINES, "baits": BAITS, "ingredients": INGREDIENTS, "recipes": RECIPES,
            "behaviors": BEHAVIORS, "variants": [v[0] for v in VARIANTS],
            "avatars": [{"id": a["id"], "name": a["name"], "sex": a["sex"], "price": a["price"], "kind": a.get("kind")} for a in AVATAR_BY_ID.values()],
            "durability": {"max": MAX_DURABILITY, "worn_penalty": WORN_PENALTY, "repair_rate": REPAIR_RATE}}


import json as _json  # noqa: E402
_GAME_DATA = _game_data_payload()
DATA_VERSION = hashlib.sha1(_json.dumps(_GAME_DATA, sort_keys=True, default=str).encode()).hexdigest()[:10]


def localize(obj, request):
    return obj  # English-only site: API text is served as-is


@api.get("/game/data")
async def game_data(response: Response):
    # Payload is static per deploy (fish, waters, gear, baits, recipes). Browsers may cache it; clients bust the cache with ?v=DATA_VERSION (from /shell/pulse).
    response.headers["Cache-Control"] = "public, max-age=600"
    return {**_GAME_DATA, "version": DATA_VERSION}


@api.get("/game/stats")
async def server_stats():
    return await cached("game_stats", 30, _server_stats)


async def _mythics():
    out = []
    for f in FISH:
        if f["rarity"] != "mythic": continue
        rows = await db.catch_log.find({"species_id": f["id"]}, {"username": 1, "weight": 1, "caught_at": 1}).sort("caught_at", 1).to_list(500)
        first = rows[0] if rows else None
        best = max(rows, key=lambda r: r.get("weight", 0)) if rows else None
        out.append({"id": f["id"], "name": f["name"], "water": f["water"], "water_name": WATER_BY_KEY[f["water"]]["name"], "blurb": f["blurb"], "max_kg": f["max_kg"],
                    "landed": len(rows), "first": {"username": first["username"], "weight": first["weight"], "at": first["caught_at"]} if first else None,
                    "record": {"username": best["username"], "weight": best["weight"]} if best else None})
    return out


@api.get("/game/mythics")
async def game_mythics():
    return await cached("game_mythics", 60, _mythics)


async def _server_stats():
    t = now(); day = t.replace(hour=0, minute=0, second=0, microsecond=0)
    players, online, active_today, new_today, catches, catches_today, listings, gold, top = await asyncio.gather(
        db.users.count_documents({}),
        db.users.count_documents({"last_seen": {"$gte": online_cutoff(t)}}),
        db.users.count_documents({"last_seen": {"$gte": iso(day)}}),
        db.users.count_documents({"created_at": {"$gte": iso(day)}}),
        db.catch_log.estimated_document_count(),
        db.catch_log.count_documents({"caught_at": {"$gte": iso(day)}}),
        db.listings.count_documents({"status": "open"}),
        db.users.aggregate([{"$group": {"_id": None, "g": {"$sum": "$gold"}}}]).to_list(1),
        db.catches.find({"caught_at": {"$gte": iso(t - timedelta(days=7))}}, {"name": 1, "weight": 1, "species_id": 1, "rarity": 1, "user_id": 1}).sort("weight", -1).limit(1).to_list(1))
    catch_week = None
    if top:
        u = await db.users.find_one({"_id": ObjectId(top[0]["user_id"])}, {"username": 1})
        catch_week = {"name": top[0]["name"], "weight": top[0]["weight"], "species_id": top[0]["species_id"], "rarity": top[0].get("rarity"), "username": u["username"] if u else None}
    return {"players": players, "online": online, "active_today": active_today, "new_today": new_today, "catches": catches, "catches_today": catches_today,
            "species": len(FISH), "waters": len(WATERS), "open_listings": listings, "gold_in_circulation": gold[0]["g"] if gold else 0, "catch_week": catch_week}


# ---------- Fishing ----------
REPAIR_BANDS = {1: 0, 2: 5, 3: 10, 4: 10, 5: 20, 6: 20, 7: 35, 8: 35, 9: 50}
SET_POWER = 1.05


def rare_set(user):
    """Matched set: rod, reel and line all of the same tier."""
    tiers = {GEAR_BY_ID.get(g, {}).get("tier") for g in user["gear"].values()}
    return len(tiers) == 1 and None not in tiers


def gear_tier(user, slot):
    return GEAR_BY_ID.get(user["gear"].get(slot), {}).get("tier", 1)


def enh_level(user, gear_id):
    return int((user.get("enhance") or {}).get(gear_id, 0))


def gear_bonuses(user):
    """Visible per-tier perks: rod luck, reel sell value, line XP (+ enhancement: rod +1 luck per even level, reel/line +1% per level).
    Worn-out (0 durability) gear keeps only WORN_PENALTY of its perk."""
    def perk(slot, base):
        return int(base * WORN_PENALTY) if gear_dur(user, user["gear"][slot]) <= 0 else base
    worn = [s for s in ("rod", "reel", "line") if gear_dur(user, user["gear"][s]) <= 0]
    e = {slot: enh_level(user, user["gear"][slot]) for slot in ("rod", "reel", "line")}
    return {"luck": perk("rod", gear_tier(user, "rod") - 1 + e["rod"] // 2 + GEAR_BY_ID.get(user["gear"]["rod"], {}).get("luck_bonus", 0)), "value_pct": perk("reel", (gear_tier(user, "reel") - 1) * 2 + e["reel"]), "xp_pct": perk("line", (gear_tier(user, "line") - 1) * 2 + e["line"]),
            "set": rare_set(user), "worn": worn, "enhance": e}


async def vendor_quotes(user, rows, counts=None):
    """Vendor payout per catch id: VENDOR_RATE × current reel bonus × current species mastery (applied at sale, not at land)."""
    reel = 1 + gear_bonuses(user)["value_pct"] / 100
    boost = await sell_multiplier()
    if counts is None:
        sids = list({c["species_id"] for c in rows})
        counts = {j["species_id"]: j["count"] async for j in db.journal.find({"user_id": str(user["_id"]), "species_id": {"$in": sids}}, {"species_id": 1, "count": 1})}
    out = {}
    for c in rows:
        f = FISH_BY_ID.get(c["species_id"])
        m = mastery.perks(mastery.level_for(f["rarity"], counts.get(c["species_id"], 0)))["value_mult"] if f else 1
        out[str(c.get("_id") or c.get("id"))] = {"vendor": int(round(c["value"] * VENDOR_RATE * reel * m * boost)), "vendor_bonus_pct": int(round((reel * m * boost - 1) * 100))}
    return out


def rarity_weights(luck, bait_id=None):
    if bait_id and BAIT_BY_ID.get(bait_id, {}).get("ground"):
        return {k: v * GROUNDBAIT_MULT.get(k, 1) for k, v in RARITY_WEIGHT.items()}
    # Luck mostly moves anglers from common to uncommon/rare; the top tiers barely move so stacked luck can't make legendaries routine.
    weights = dict(RARITY_WEIGHT)
    shift = luck * 5
    weights["common"] = max(300, weights["common"] - shift * 2.5)
    weights["uncommon"] += shift * 0.8
    weights["rare"] += shift * 0.5
    weights["epic"] += shift * 0.3
    weights["legendary"] += shift * 0.07
    weights["mythic"] += shift * 0.012
    return weights


SIZE_EXP = 2.2  # weight roll skew; a bait's size grade (0-5) flattens it: avg catch ~31% of the species range at grade 0, ~55% at grade 5
SIZE_VARIANT = 0.15  # Giant/Albino/Golden odds +15% per size grade


def bait_size(bait):
    return (bait or {}).get("size", 0)


def bait_ev(water_key, luck, bite, bait=None):
    """Expected fish value (before the vendor's cut) of one cast at a water with the given luck, bite and bait."""
    import statistics
    size = bait_size(bait)
    ratio = 1 / (SIZE_EXP * 0.8 ** size + 1)
    vb = 1 + SIZE_VARIANT * size
    vmult = (1 - sum(c * vb for _, c, _ in VARIANTS[1:])) + sum(c * vb * m for _, c, m in VARIANTS[1:])
    w = rarity_weights(luck, bait["id"] if bait else None)
    tot = sum(w.values())
    pool = FISH_BY_WATER[water_key]
    ev = 0
    for r, x in w.items():
        c = [f for f in pool if f["rarity"] == r] or pool
        ev += x / tot * statistics.mean(RARITY_BASE_VALUE[f["rarity"]] * f["value_mod"] * (0.7 + ratio * 1.3) for f in c)
    return ev * vmult * (72 + bite) / 100


def pick_species(water_key, luck, period=None, bait_id=None, mythic_mult=1):
    weights = rarity_weights(luck, bait_id)
    weights["mythic"] *= mythic_mult
    pool = FISH_BY_WATER[water_key]
    rarity = random.choices(list(weights.keys()), weights=list(weights.values()))[0]
    candidates = [f for f in pool if f["rarity"] == rarity] or pool
    def wgt(f):
        w = 2.2 if (period and active_period(f) == period) else 1.0
        if f.get("bait_only") and bait_id not in f["bait_only"]: w *= BAIT_ONLY_OTHER
        return w
    return random.choices(candidates, weights=[wgt(f) for f in candidates])[0]


def secret_open_at(water_key):
    """The secret species whose UTC window is open at this water right now, if any."""
    h = now().hour
    return next((f for f in SECRET_FISH if f["water"] == water_key and window_open(f, h)), None)


def secret_public(f, t):
    # Windows and open/closed state are deliberately not exposed: anglers are meant to discover them.
    return {"id": f["id"], "name": f["name"], "water": f["water"], "water_name": WATER_BY_KEY[f["water"]]["name"], "rarity": f["rarity"]}


@api.get("/secrets")
async def secrets_list(user=Depends(get_current_user)):
    t = now()
    have = {r["species_id"] for r in await db.journal.find({"user_id": str(user["_id"]), "species_id": {"$in": [f["id"] for f in SECRET_FISH]}}, {"species_id": 1}).to_list(10)}
    return {"server_time": iso(t), "chance_pct": round(SECRET_CHANCE * 100), "secrets": [{**secret_public(f, t), "caught": f["id"] in have} for f in SECRET_FISH]}


# ---------- Weather & tides ----------
PERIODS = ["dawn", "day", "dusk", "night"]
WEATHERS = {"clear": (0, 0), "overcast": (4, 1), "rain": (8, 2), "storm": (-6, 5), "fog": (-2, 4), "wind": (-3, 0)}
TIDES = {"rising": (5, 1), "high": (3, 2), "falling": (0, 0), "low": (-5, 0)}
WEATHER_TEXT = {"clear": "Clear skies and still water.", "overcast": "A grey lid of cloud. Fish feed confidently.", "rain": "Steady rain dimples the surface, the fish are up and feeding.",
                "storm": "A storm churns the water. Dangerous, but strange things come up.", "fog": "Thick fog. You can barely see your float.", "wind": "A stiff wind makes casting awkward."}


def active_period(f):
    if f["rarity"] in ("legendary", "mythic") or f["behavior"] == "sluggish": return "night"
    return PERIODS[f["id"] % 4]


def conditions_for(water_key, t=None):
    t = t or now()
    h = t.hour + t.minute / 60
    period = "dawn" if 5 <= h < 8 else "day" if 8 <= h < 17 else "dusk" if 17 <= h < 20 else "night"
    block = int(t.timestamp() // 10800)
    rnd = random.Random(f"{water_key}:{block}")
    weather = rnd.choices(list(WEATHERS), weights=[30, 22, 18, 7, 12, 11])[0]
    bite, luck = WEATHERS[weather]
    bite += {"dawn": 6, "day": 0, "dusk": 6, "night": -4}[period]
    luck += {"dawn": 2, "day": 0, "dusk": 2, "night": 4}[period]
    tide = None
    if WATER_BY_KEY[water_key]["salt"]:
        phase = (t.timestamp() / 3600 + zlib.crc32(water_key.encode()) % 12) % 12.4 / 12.4
        tide = "rising" if phase < 0.25 else "high" if phase < 0.5 else "falling" if phase < 0.75 else "low"
        bite += TIDES[tide][0]; luck += TIDES[tide][1]
    return {"water": water_key, "period": period, "weather": weather, "tide": tide, "bite": bite, "luck": luck, "text": WEATHER_TEXT[weather],
            "next_change_min": int((block + 1) * 10800 - t.timestamp()) // 60}


@api.get("/waters/conditions")
async def all_conditions():
    return {w["key"]: conditions_for(w["key"]) for w in WATERS}

@api.get("/waters/progress")
async def waters_progress(user=Depends(get_current_user)):
    """Per water: distinct species recorded and distinct species caught as a variant, out of the water's pool."""
    rows = await db.journal.find({"user_id": str(user["_id"])}, {"species_id": 1, "variants": 1}).to_list(2000)
    have = {r["species_id"]: 1 if any(v and v != "normal" for v in (r.get("variants") or [])) else 0 for r in rows}
    out = {}
    for w in WATERS:
        pool = [f["id"] for f in WATER_POOL[w["key"]]]
        rod = [f["id"] for f in FISH_BY_WATER[w["key"]]]
        got = [i for i in pool if i in have]
        var = sum(1 for i in rod if have.get(i))
        out[w["key"]] = {"species": len(got), "total": len(pool), "variants": var, "variants_total": len(rod),
                         "complete": len(got) == len(pool) and len(pool) > 0,
                         "variants_complete": var == len(rod) and len(rod) > 0}
    return out



@api.get("/waters/{water_key}/active")
async def active_species(water_key: str, user=Depends(get_current_user)):
    if water_key not in WATER_BY_KEY: raise HTTPException(404, "Unknown water")
    cond = conditions_for(water_key)
    known = {r["species_id"] for r in await db.journal.find({"user_id": str(user["_id"])}, {"species_id": 1}).to_list(2000)}
    act = [f for f in FISH_BY_WATER[water_key] if active_period(f) == cond["period"]]
    return {"conditions": cond, "active": [{"id": f["id"], "name": f["name"] if f["id"] in known else None, "rarity": f["rarity"]} for f in act]}


def roll_weight(f, size=0):
    r = random.random() ** (SIZE_EXP * 0.8 ** size)
    return round(f["min_kg"] + (f["max_kg"] - f["min_kg"]) * r, 3)


def roll_variant(boost=1.0):
    r = random.random()
    acc = 0
    for name, chance, mult in VARIANTS[1:]:
        acc += chance * boost
        if r < acc:
            return name, mult
    return "normal", 1.0


def fish_value(f, weight, variant_mult):
    ratio = (weight - f["min_kg"]) / max(0.001, f["max_kg"] - f["min_kg"])
    base = RARITY_BASE_VALUE[f["rarity"]] * f["value_mod"] * (0.7 + ratio * 1.3)
    return max(1, int(round(base * variant_mult)))


RARITY_SCORE = {"common": 0, "uncommon": 1, "rare": 2, "epic": 3, "legendary": 4, "mythic": 5}
BEHAVIOR_TRICK = {"diver": "dive", "sluggish": "dive", "runner": "run", "jumper": "leap", "thrasher": "leap", "steady": "second_wind"}
TRICK_INFO = {
    "dive": {"name": "Dive", "hint": "expect it to plunge, ease off when the sweet spot drops"},
    "run": {"name": "Burst run", "hint": "expect long runs, keep the pressure on when the sweet spot climbs"},
    "leap": {"name": "Leap", "hint": "expect it to leap, take up the slack right after"},
    "second_wind": {"name": "Second wind", "hint": "expect a rally near the end, the sweet spot narrows and it pulls harder"},
    "tiring": {"name": "Tiring zone", "hint": "the sweet spot narrows as you wear it down"},
    "panic": {"name": "Panic", "hint": "it thrashes twice as often in the last stretch"},
}


def fight_tricks(f, ratio, variant, water_key):
    """Which extra mechanics a fish gets: driven by rarity and size, nudged by how far out the water is."""
    score = RARITY_SCORE[f["rarity"]] + (1 if ratio >= 0.6 else 0) + (1 if ratio >= 0.85 else 0) + (1 if variant != "normal" else 0) + round(2 * water_pressure(water_key) * RARITY_PRESSURE[f["rarity"]])
    tricks = []
    if score >= 2: tricks.append(BEHAVIOR_TRICK[f["behavior"]])
    if score >= 4: tricks.append("tiring")
    if score >= 6: tricks.append("panic")
    if f["rarity"] in ("legendary", "mythic") and "second_wind" not in tricks: tricks.append("second_wind")
    return {"tricks": tricks, "trick_score": score, "tiring_min": 0.6 if score >= 6 else 0.75, "trick_repeat": score >= 5,
            "trick_names": [TRICK_INFO[t]["name"] for t in tricks]}


def encounter_params(f, weight, user, variant="normal", water_key=None):
    ratio = (weight - f["min_kg"]) / max(0.001, f["max_kg"] - f["min_kg"])
    b = BEHAVIORS[f["behavior"]]
    p = water_pressure(water_key or user["water"])
    rmult = {"common": 0.72, "uncommon": 0.88, "rare": 1.12, "epic": 1.35, "legendary": 1.65, "mythic": 1.95}[f["rarity"]]
    rod, reel, line = GEAR_BY_ID[user["gear"]["rod"]], GEAR_BY_ID[user["gear"]["reel"]], GEAR_BY_ID[user["gear"]["line"]]
    worn = lambda g: (WORN_PENALTY if gear_dur(user, g["id"]) <= 0 else 1.0) * (1 + 0.02 * enh_level(user, g["id"]))  # noqa: E731
    power, control, recovery, tolerance = rod["power"] * worn(rod), rod["control"] * worn(rod), reel["recovery"] * worn(reel), line["tolerance"] * worn(line)
    if rare_set(user): power *= SET_POWER
    base_stamina = 6 + {"common": 0, "uncommon": 2, "rare": 4, "epic": 7, "legendary": 11, "mythic": 16}[f["rarity"]] + ratio * 3
    # big rods shorten fights, but never below a floor that rises in harder water
    e = p * RARITY_PRESSURE[f["rarity"]]  # deep water mostly toughens the rare fish; commons stay fair
    raw_st, floor_st = base_stamina / power, base_stamina * (0.3 + 0.25 * e)
    stamina = raw_st if raw_st >= floor_st else floor_st - (floor_st - raw_st) * 0.4  # past the floor, 40% of extra power still counts
    time_k, time_base = 3.2 - 0.6 * e, 12 - 3 * e
    # Size word is the fish's real weight (players read "monstrous" as kilos, not as "big for a crappie"); size_note covers the species scale.
    # ...nudged one step by how big it is for its own species, so a runt never reads as "big" and a trophy never as "small".
    words = ["tiny", "small", "decent", "big", "monstrous"]
    idx = 0 if weight < 0.4 else 1 if weight < 1.5 else 2 if weight < 6 else 3 if weight < 25 else 4
    idx += -1 if ratio < 0.25 else 1 if ratio >= 0.85 else 0
    size_word = words[max(0, min(4, idx))]
    size_note = "A giant of its kind." if ratio >= 0.85 else "A runt of its kind." if ratio < 0.15 else ""
    tricks = fight_tricks(f, ratio, variant, water_key or user["water"])
    hint = f"Something {size_word} is on the line. It {b['desc']}."
    return {
        "strength": round(b["strength"] * (0.85 + ratio * 0.45) * rmult * (1 + 0.3 * e), 3),
        "erratic": round(b["erratic"] * rmult * (1 + 0.45 * e), 3),
        "stamina": round(stamina, 2),
        # sweet spot: the water's cap rises with rod control; past it each extra point still counts for 35%
        "zone_width": round(soft_cap(30 * control, 58 - 22 * e + 8 * (control - 1)), 1),
        "recovery": round(recovery, 3),
        "tolerance": round(tolerance, 3),
        "time_limit": round(stamina * time_k + time_base, 1),
        "time_k": round(time_k, 3), "time_base": round(time_base, 2),
        "hint": hint,
        "size_note": size_note,
        "behavior": f["behavior"],
        **tricks,
    }


class CastOut(BaseModel):
    result: str
    encounter: Optional[dict] = None
    message: str
    user: dict


async def cast_luck(user, water):
    """Exactly what the next cast rolls with: (luck, bite, bait, parts). Shared by /fish/cast and /fish/odds."""
    bait_id = user.get("active_bait")
    bait = BAIT_BY_ID.get(bait_id) if bait_id and user["bait"].get(bait_id, 0) > 0 else None
    cond = conditions_for(water["key"])
    parts = [{"key": "period", "label": cond["period"], "luck": {"dawn": 2, "day": 0, "dusk": 2, "night": 4}[cond["period"]]},
             {"key": "weather", "label": cond["weather"], "luck": WEATHERS[cond["weather"]][1]}]
    if cond["tide"]: parts.append({"key": "tide", "label": f"{cond['tide']} tide", "luck": TIDES[cond["tide"]][1]})
    bite = cond["bite"]
    active_event, _ = current_expedition()
    if active_event and active_event["water"] == water["key"]:
        parts.append({"key": "expedition", "label": "expedition", "luck": EVENT_LUCK}); bite += EVENT_BITE
    fl = await friend_luck(user)
    if fl: parts.append({"key": "friends", "label": "friend at your water", "luck": fl})
    pl = perk_value((user.get("crew") or {}).get("perks"), "luck")
    if pl: parts.append({"key": "crew", "label": "crew Lucky Charms", "luck": pl})
    bl = await luck_bonus()
    if bl: parts.append({"key": "booster", "label": "Lucky Tide booster", "luck": bl})
    gl = gear_bonuses(user)["luck"]
    bite += GEAR_BY_ID.get(user["gear"]["rod"], {}).get("bite_bonus", 0)
    if gl or gear_tier(user, "rod") > 1:
        el = enh_level(user, user["gear"]["rod"])
        parts.append({"key": "rod", "label": f"rod T{gear_tier(user, 'rod')}" + (f" +{el}" if el else "") + (" (worn, 70%)" if "rod" in gear_bonuses(user)["worn"] else ""), "luck": gl})
    if bait:
        if bait["waters"] is None or water["key"] in bait["waters"]:
            parts.append({"key": "bait", "label": bait["name"], "luck": bait["luck"]}); bite += bait["bite"]
        else:
            parts.append({"key": "bait", "label": f"{bait['name']} (off-water, ⅓)", "luck": max(0, bait["luck"] // 3)})
    luck = max(0, sum(p["luck"] for p in parts))
    return luck, bite, bait, parts


@api.get("/fish/odds")
async def fish_odds(user=Depends(get_current_user)):
    """Live rarity odds for the angler's next cast (current water, bait, conditions, gear, friends, crew)."""
    water = WATER_BY_KEY[user["water"]]
    luck, bite, bait, parts = await cast_luck(user, water)
    ground = bool(bait and bait.get("ground"))
    present = {f["rarity"] for f in FISH_BY_WATER[water["key"]]}
    def shares(w):
        tot = sum(w.values())
        return {k: round(v / tot * 100, 2) for k, v in w.items()}  # 2 dp: mythic with groundbait is ~0.04%, not 0
    return {"water": water["key"], "luck": luck, "bite": bite, "groundbait": ground, "size": bait_size(bait), "parts": [p for p in parts if p["luck"] or p["key"] == "rod"],
            "odds": shares(rarity_weights(luck, bait["id"] if bait else None)), "base": shares(rarity_weights(0)),
            "missing": [r for r in RARITY_WEIGHT if r not in present]}


@api.get("/shop/bait-value")
async def shop_bait_value(user=Depends(get_current_user)):
    """Per bait: expected vendor gold per cast over a bare hook at the angler's current water, against its cost per cast."""
    water = WATER_BY_KEY[user["water"]]
    bare = {**user, "active_bait": None}
    luck0, bite0, _, _ = await cast_luck(bare, water)
    base = bait_ev(water["key"], luck0, bite0) * VENDOR_RATE
    out = {}
    for b in BAITS:
        here = b["waters"] is None or water["key"] in b["waters"]
        luck = luck0 + (b["luck"] if here else b["luck"] // 3)
        bite = bite0 + (b["bite"] if here else 0)
        gain = bait_ev(water["key"], luck, bite, b) * VENDOR_RATE - base
        cost = bait_price(b, user) / b.get("pack", 1) if b["price"] else 0
        out[b["id"]] = {"gain": round(gain), "cost": round(cost, 1), "net": round(gain - cost), "here": here,
                        "unlocks": [f["name"] for f in FISH_BY_WATER[water["key"]] if b["id"] in f.get("bait_only", [])]}
    return {"water": water["key"], "water_name": water["name"], "base": round(base), "baits": out}


# ---------- "doesn't look human" detector ----------
# Every signal below is a lead, not a verdict; each hit adds to the angler's suspicion score and lands them on Admin > Suspicious.
# Reaction gap = time between the server saying the water is free (a "nothing" or a landing) and the next cast. Fights of random
# length sit between casts, so raw cast-to-cast timing is useless; reaction gaps are what a macro keeps constant.
METRO_STREAK = 10          # identical reaction gaps in a row
METRO_SPREAD = 0.15        # max - min of those gaps (covers network jitter)
METRO_MAX_GAP = 60.0       # walked away, the streak is broken, not counted
GAP_WINDOW = 30            # reaction gaps kept per stream for the statistical checks
LOWVAR_CV = 0.08           # stdev/mean below this over a full window: too regular for a person (humans sit around 0.25-0.5)
INSTANT_GAP = 0.15         # a recast this soon after the response can't include a human reading it (network round-trip alone eats most of it)
INSTANT_MIN = 20           # ...this many of the last GAP_WINDOW
SESSION_BREAK = 180        # seconds without a cast = the session ended
MARATHON_H = 4             # casting for this long without a 3-minute break
ALLHOURS_MIN = 20          # distinct UTC hours with casts in one day
EDGE_STREAK = 15           # casts in a row made the moment the energy for exactly one cast was available
FIGHT_PATTERN = 8          # consecutive fights with the identical hold pattern
SIGNALS = {"metronome": ("Recasts on an exact timer", 3), "lowvar": ("Reaction time too regular", 2), "instant": ("Recasts faster than a person could read the result", 3),
           "marathon": ("Casting 4+ hours without a 3-minute break", 2), "allhours": ("Casting in 20+ hours of one day", 2),
           "edge": ("Casts the moment energy allows, 15× in a row", 1), "fightpattern": ("Identical fight input 8 fights in a row", 3),
           "humancheck": ("Failed the human check (3 failed captchas)", 3)}


async def flag_suspicious(user, code, detail):
    label, weight = SIGNALS[code]
    await db.suspicious.update_one({"user_id": str(user["_id"])},
                                   {"$set": {"username": user["username"], "last_at": iso(now()), "last_code": code, "last_detail": detail, "water": user.get("water")},
                                    "$inc": {"score": weight, "streaks": 1, f"reasons.{code}": 1},
                                    "$push": {"events": {"$each": [{"code": code, "detail": detail, "at": iso(now())}], "$slice": -20}},
                                    "$setOnInsert": {"first_at": iso(now())}}, upsert=True)
    logger.warning("suspicious: %s, %s (%s)", user["username"], label, detail)
    await humancheck.arm(user)  # module imported at the bottom of this file
    await botwatch.on_flag(user)


def _gap_checks(gaps, kind):
    """Return (reset, [(code, detail)]) for one stream of reaction gaps."""
    hits = []
    last = gaps[-METRO_STREAK:]
    if len(last) == METRO_STREAK and max(last) - min(last) <= METRO_SPREAD:
        hits.append(("metronome", f"{sum(last) / len(last):.2f}s after every {'landing' if kind == 'land' else 'miss'} (±{(max(last) - min(last)) * 1000:.0f} ms)"))
    if len(gaps) >= GAP_WINDOW:
        mean = sum(gaps) / len(gaps)
        sd = (sum((g - mean) ** 2 for g in gaps) / len(gaps)) ** 0.5
        if mean > 0 and sd / mean < LOWVAR_CV: hits.append(("lowvar", f"{len(gaps)} reactions after a {kind}: {mean:.2f}s ± {sd * 1000:.0f} ms"))
        fast = sum(1 for g in gaps if g < INSTANT_GAP)
        if fast >= INSTANT_MIN: hits.append(("instant", f"{fast} of {len(gaps)} recasts within {INSTANT_GAP * 1000:.0f} ms of the {kind}"))
    return bool(hits), hits


async def mark_free(uid, kind):
    """The server just told this angler the water is free again; remember when, so the next cast can be timed."""
    await db.users.update_one({"_id": uid}, {"$set": {"rhythm.free_at": time.time(), "rhythm.free_kind": kind}})


async def note_cast_rhythm(user):
    rh = user.get("rhythm") or {}
    t = time.time(); dt = now()
    sets, unsets, hits = {"rhythm.last_cast": t}, {"rhythm.free_at": ""}, []
    # session length without a break
    last = rh.get("last_cast")
    if not last or t - last > SESSION_BREAK: sets["rhythm.session_start"] = t; sets["rhythm.session_flagged"] = False
    elif t - rh.get("session_start", t) > MARATHON_H * 3600 and not rh.get("session_flagged"):
        sets["rhythm.session_flagged"] = True; hits.append(("marathon", f"{(t - rh['session_start']) / 3600:.1f} h of casting without a break"))
    # hours of the day
    day, hour = dt.strftime("%Y-%m-%d"), dt.hour
    hours = set(rh.get("hours") or []) | {hour}
    if rh.get("day") != day: sets["rhythm.day"] = day; sets["rhythm.hours"] = [hour]; sets["rhythm.day_flagged"] = False; sets["rhythm.day_secs"] = 0
    else:
        sets["rhythm.hours"] = sorted(hours)
        if last and t - last <= SESSION_BREAK: sets["rhythm.day_secs"] = round((rh.get("day_secs") or 0) + t - last)  # time spent fishing today
        if len(hours) >= ALLHOURS_MIN and not rh.get("day_flagged"): sets["rhythm.day_flagged"] = True; hits.append(("allhours", f"casts in {len(hours)} different hours today"))
    # casting the instant a single cast becomes affordable
    edge = rh.get("edge_streak", 0) + 1 if user["energy"] < CAST_COST * 2 else 0
    if edge >= EDGE_STREAK: hits.append(("edge", f"{edge} casts in a row on the last drop of energy")); edge = 0
    sets["rhythm.edge_streak"] = edge
    # reaction gaps
    free, kind = rh.get("free_at"), rh.get("free_kind")
    push = None
    if free and kind in ("miss", "land"):
        gap = round(t - free, 3)
        if gap > METRO_MAX_GAP: sets[f"rhythm.{kind}"] = []
        else:
            push = {f"rhythm.{kind}": {"$each": [gap], "$slice": -GAP_WINDOW}}
            reset, gap_hits = _gap_checks((rh.get(kind) or [])[-(GAP_WINDOW - 1):] + [gap], kind)
            hits += gap_hits
            if reset: push = None; sets[f"rhythm.{kind}"] = []  # one flag per streak, not one per cast
    op = {"$set": sets, "$unset": unsets}
    if push: op["$push"] = push
    await db.users.update_one({"_id": user["_id"]}, op)
    for code, detail in hits: await flag_suspicious(user, code, detail)
    return bool(hits)


async def note_fight_pattern(user, body, params):
    """A person never reels with the identical button timing fight after fight; a script does."""
    if not body.success or not body.holds: return
    sig = f"{len(body.holds)}|{round(body.holds[0][0], 1)}|{round(body.elapsed, 1)}|{round(sum(e - s for s, e in body.holds), 1)}"
    prev = ((user.get("rhythm") or {}).get("fights") or [])[-(FIGHT_PATTERN - 1):]
    if len(prev) == FIGHT_PATTERN - 1 and all(p == sig for p in prev):
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"rhythm.fights": []}})
        await flag_suspicious(user, "fightpattern", f"{FIGHT_PATTERN} fights with identical input ({len(body.holds)} holds, {body.elapsed:.1f}s)")
        return
    await db.users.update_one({"_id": user["_id"]}, {"$push": {"rhythm.fights": {"$each": [sig], "$slice": -FIGHT_PATTERN}}})


@api.post("/fish/cast")
async def cast(user=Depends(get_current_user)):
    if user["energy"] < CAST_COST:
        raise HTTPException(400, "You are exhausted. Rest a while before casting again.")
    flagged = await note_cast_rhythm(user)
    hc = humancheck.pending(user)
    if flagged and not hc: hc = humancheck.pending(await db.users.find_one({"_id": user["_id"]}, {"humancheck": 1}) or {})  # a flag just fired: it may have dealt a check
    if hc: raise HTTPException(423, {"code": "humancheck", "msg": "A quick check before you cast again: prove you're an angler, not a machine.", "challenge": humancheck.public_challenge(hc)})
    water = WATER_BY_KEY[user["water"]]
    if water.get("premium") and not premium_active(user): raise HTTPException(403, f"Your Angler Pass has ended, {water['name']} is closed to you until you renew. Travel to another water.")
    cond = conditions_for(water["key"])
    luck, bite, bait, _ = await cast_luck(user, water)
    bait_id = bait["id"] if bait else None
    free_cast = random.random() < GEAR_BY_ID.get(user["gear"]["rod"], {}).get("free_cast", 0)
    updates = {"$inc": {"energy": 0 if free_cast else -CAST_COST, "stats.casts": 1}, "$set": {"energy_full_notified": False}}
    if user["energy"] >= max_energy(user): updates["$set"]["energy_at"] = iso(now())  # regen clock starts at the first cast off a full bar
    if bait: updates["$inc"][f"bait.{bait_id}"] = -1
    # Tutorial first-cast guarantee: once per account, only while the tutorial waits for the first fish and nothing has ever been landed.
    # Yields a plain common of this water (no boss/secret/variant rolls), so there is nothing to farm.
    t = user.get("tutorial") or {}
    guaranteed = bool(t) and not t.get("done") and t.get("step") == 2 and not t.get("guaranteed") and user["stats"].get("catches", 0) == 0
    if guaranteed: updates["$set"]["tutorial.guaranteed"] = True
    await db.pending.delete_many({"user_id": str(user["_id"])})
    r = await db.users.update_one({"_id": user["_id"], **({"tutorial.guaranteed": {"$ne": True}} if guaranteed else {})}, updates)
    if guaranteed and not r.modified_count:  # raced with another cast that already used the guarantee
        guaranteed = False
        await db.users.update_one({"_id": user["_id"]}, updates)
    if not free_cast: user["energy"] -= CAST_COST
    qd = await quest_event(user["_id"], "cast")
    if qd: user = await db.users.find_one({"_id": user["_id"]})
    ev_win = None if guaranteed else await random_events.on_cast(user, water["key"])
    if ev_win:
        user = await db.users.find_one({"_id": user["_id"]})
        await mark_free(user["_id"], "miss")
        return {"result": "nothing", "encounter": None, "message": ev_win["message"], "event_win": ev_win, "user": public_user(user), "quests_done": qd}
    if not guaranteed and random.randint(1, 100) > 72 + bite:
        await mark_free(user["_id"], "miss")
        if random.random() < enhance.TRASH_CHANCE * (2 if water.get("premium") else 1):
            t = enhance.roll_trash(water["key"])
            await db.users.update_one({"_id": user["_id"]}, {"$inc": {f"salvage.{t['id']}": 1, "stats.trash": 1}})
            user = await db.users.find_one({"_id": user["_id"]})
            return {"result": "nothing", "encounter": None, "trash": {"id": t["id"], "name": t["name"], "scrap": t["scrap"]},
                    "message": random.choice(enhance.TRASH_LINES).format(name=t["name"]), "user": public_user(user), "quests_done": qd}
        return {"result": "nothing", "encounter": None, "message": random.choice([
            "The line drifts. Nothing bites.", "A nibble... then nothing.", "Your bait comes back untouched.",
            "Ripples spread and fade. The water keeps its secrets."]), "user": public_user(user), "quests_done": qd}
    if guaranteed:
        plain = [x for x in FISH_BY_WATER[water["key"]] if x["rarity"] == "common" and not x.get("bait_only")]
        f = random.choice(plain) if plain else pick_species(water["key"], 0, cond["period"], None)
    else:
        boss_hit = await try_hook_boss(user, water["key"])
        if boss_hit: return boss_hit
        secret = secret_open_at(water["key"])
        if halloween.active() and random.random() < HALLOW_BITE: f = pick_species(HALLOW_WATER, luck, mythic_mult=HALLOW_MYTHIC_MULT)
        else: f = secret if (secret and random.random() < SECRET_CHANCE) else pick_species(water["key"], luck, cond["period"], bait["id"] if bait else None)
    mj = await db.journal.find_one({"user_id": str(user["_id"]), "species_id": f["id"]}, {"count": 1})
    mp = mastery.perks(mastery.level_for(f["rarity"], mj["count"] if mj else 0))
    wb = 1 + GEAR_BY_ID.get(user["gear"]["rod"], {}).get("weight_bonus", 0)
    weight = min(round(f["max_kg"] * 1.1 * wb, 3), round(roll_weight(f, bait_size(bait)) * mp["weight_mult"] * wb, 3))
    variant, vmult = ("normal", 1.0) if guaranteed else roll_variant(mp["variant_mult"] * (1 + SIZE_VARIANT * bait_size(bait)))
    params = encounter_params(f, weight, user, variant, water["key"])
    if mp["stamina_mult"] < 1:
        params["stamina"] = round(params["stamina"] * mp["stamina_mult"], 2); params["time_limit"] = round(params["stamina"] * params["time_k"] + params["time_base"], 1)
    if not guaranteed: botwatch.shift_fight(params, user)
    enc = {"user_id": str(user["_id"]), "species_id": f["id"], "weight": weight, "variant": variant, "vmult": vmult,
           "water": water["key"], "created_at": iso(now()), "params": params}
    if f["rarity"] in ("legendary", "mythic"):
        a = await db.alerts.insert_one({"username": user["username"], "water": water["key"], "water_name": water["name"], "status": "hooked", "species": None, "rarity": f["rarity"],
                                        "weight": None, "variant": None, "at": iso(now()), "cheers": [], "text": f"{user['username']} has hooked something {'mythic' if f['rarity'] == 'mythic' else 'legendary'} at {water['name']}!"})
        enc["alert_id"] = str(a.inserted_id)
    res = await db.pending.insert_one(enc)
    return {"result": "hooked", "encounter": {"id": str(res.inserted_id), **params},
            "message": "Fish on!", "user": public_user(user), "quests_done": qd}


class LandIn(BaseModel):
    encounter_id: str
    success: bool
    elapsed: float = 0
    game_time: Optional[float] = None  # simulated fight seconds (frame steps are capped, so this lags wall-clock on slow phones)
    holds: List[List[float]] = []  # list of [start_sec, end_sec] hold intervals


async def wear_gear(user):
    """Every fish fought (landed or lost) takes one point off each equipped item; never below 0. A full rare set skips half the wear."""
    if rare_set(user) and random.random() < RARE_SET_WEAR_SKIP:
        return
    sets = {}
    for gid in user["gear"].values():
        if GEAR_BY_ID.get(gid, {}).get("no_wear"): continue
        d = gear_dur(user, gid)
        if d > 0:
            sets[f"durability.{gid}"] = d - 1
    if sets:
        await db.users.update_one({"_id": user["_id"]}, {"$set": sets})
        user.setdefault("durability", {}).update({k.split(".", 1)[1]: v for k, v in sets.items()})


def validate_fight(params, elapsed, holds, age, game_time=None):
    """Server-side anti-cheat for the tension mini-game. Returns (ok, reasons).

    Only physically impossible claims are refused ("hard"): the server's own clock says the fight was
    quicker than the fish allows, or the telemetry is malformed. Everything else, slow phones, screen
    locks, dropped frames, odd hold patterns, is logged as "soft:" and the catch is granted.
    """
    stamina = params["stamina"]
    strength = params["strength"]
    recovery = params["recovery"]
    time_limit = params["time_limit"]
    if age < stamina * 0.75 - 1.0:
        return False, ["landed_too_fast"]
    if not isinstance(holds, list):
        return False, ["bad_telemetry"]
    total_hold, last_end = 0.0, -1.0
    for iv in holds:
        if not (isinstance(iv, list) and len(iv) == 2): return False, ["bad_interval"]
        s, e = float(iv[0]), float(iv[1])
        if s < -0.5 or e < s - 0.05 or s < last_end - 0.5: return False, ["bad_interval"]
        last_end = e
        total_hold += max(0.0, e - s)
    soft = []
    gt = game_time if game_time is not None else elapsed
    if not holds: soft.append("soft:no_telemetry")
    if gt > time_limit + 5: soft.append("soft:over_time_limit")
    if gt > elapsed + 1.0: soft.append("soft:game_time_over_wall")
    if elapsed < stamina * 0.9: soft.append("soft:elapsed_too_short")
    if last_end > elapsed + 1.0 or total_hold > elapsed + 1.0: soft.append("soft:hold_over_elapsed")
    ratio = total_hold / max(0.001, elapsed)
    if elapsed > 8 and ratio > 0.97: soft.append("soft:held_constantly")
    p = 11.0 + strength * 20.0
    d = max(1.0, 34.0 * recovery - strength * 6.0)
    if holds and ratio < (d / (p + d)) * 0.2: soft.append("soft:hold_ratio_low")
    return True, soft


@api.post("/fish/land")
async def land(body: LandIn, user=Depends(get_current_user)):
    enc = await db.pending.find_one({"_id": oid(body.encounter_id), "user_id": str(user["_id"])})
    if not enc:
        raise HTTPException(404, "No fish on the line")
    await db.pending.delete_one({"_id": enc["_id"]})
    await mark_free(user["_id"], "land")
    await wear_gear(user)
    if enc.get("boss_id"):
        return await land_boss(enc, user, body)
    f = FISH_BY_ID[enc["species_id"]]
    age = (now() - datetime.fromisoformat(enc["created_at"])).total_seconds()
    fail_msg = f"The {f['name']} got away."
    if age > enc["params"]["time_limit"] + 60:
        body.success = False
    if body.success:
        ok, reasons = validate_fight(enc["params"], body.elapsed, body.holds, age, body.game_time)
        await note_fight_pattern(user, body, enc["params"])
        if not ok:
            body.success = False; fail_msg = "The line went slack, the fight didn't add up."
        if reasons:
            await db.cheat_log.insert_one({"user_id": str(user["_id"]), "username": user["username"], "species_id": f["id"], "reason": ",".join(reasons),
                                           "hard": not ok, "elapsed": body.elapsed, "game_time": body.game_time, "age": age, "holds": len(body.holds), "at": iso(now())})
    if not body.success:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"stats.escaped": 1}})
        if enc.get("alert_id"):
            await db.alerts.update_one({"_id": ObjectId(enc["alert_id"])}, {"$set": {"status": "lost", "species": f["name"], "at": iso(now()),
                                        "text": f"{user['username']} lost a {f['rarity']} {f['name']} at {WATER_BY_KEY[enc['water']]['name']}. The line went slack."}})
        return {"success": False, "species": f["name"], "rarity": f["rarity"],
                "message": fail_msg}
    weight = enc["weight"]
    length = round((weight ** (1 / 3)) * 38 * (1.0 if f["behavior"] != "thrasher" else 1.1), 1)
    journal = await db.journal.find_one({"user_id": str(user["_id"]), "species_id": f["id"]})
    m_old = mastery.level_for(f["rarity"], journal["count"] if journal else 0)
    mp = mastery.perks(m_old)
    gb = gear_bonuses(user)
    hard = 1 + HARD_WATER_BONUS * water_pressure(enc["water"])
    value = int(round(fish_value(f, weight, enc["vmult"]) * hard))
    boost_mult = await xp_multiplier()
    xp = int(round((RARITY_XP[f["rarity"]] + int(weight ** 0.5 * 3)) * mp["xp_mult"] * (1 + gb["xp_pct"] / 100) * (1 + GEAR_BY_ID.get(user["gear"]["rod"], {}).get("xp_bonus", 0)) * hard)) * boost_mult
    taper = botwatch.reward_mult(user)  # 1.0 for everyone except suspects on a very long day
    if taper < 1:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bot.withheld_gold": value - max(1, int(value * taper))}})
        value, xp = max(1, int(value * taper)), max(1, int(xp * taper))
    catch = {"user_id": str(user["_id"]), "username": user["username"], "species_id": f["id"], "name": f["name"], "rarity": f["rarity"],
             "weight": weight, "length_cm": length, "variant": enc["variant"], "value": value, "water": enc["water"],
             "caught_at": iso(now()), "listed": False, "mounted": False, "caught_by": str(user["_id"]), "caught_by_name": user["username"],
             "crew_id": (user.get("crew") or {}).get("id")}
    res = await db.catches.insert_one(catch)
    await db.catch_log.insert_one(catch_ledger(catch))
    catch["id"] = str(res.inserted_id)
    catch.pop("_id", None)
    first = journal is None
    if first:
        await db.journal.insert_one({"user_id": str(user["_id"]), "species_id": f["id"], "count": 1, "best_kg": weight,
                                     "first_at": iso(now()), "variants": [enc["variant"]]})
    else:
        await db.journal.update_one({"_id": journal["_id"]}, {"$inc": {"count": 1}, "$max": {"best_kg": weight},
                                                              "$addToSet": {"variants": enc["variant"]}})
    old_level, _ = level_from_xp(user["xp"])
    inc = {"xp": xp, "stats.catches": 1}
    sets = {}
    m_new = mastery.level_for(f["rarity"], (journal["count"] if journal else 0) + 1)
    mastery_up = None
    if m_new > m_old:
        inc["stats.mastery_total"] = m_new - m_old
        mastery_up = {"level": m_new, "species": f["name"], "perks": mastery.perk_lines(m_new)}
        if m_new == mastery.MAX_LEVEL:
            inc["stats.masteries"] = 1; inc["pearls"] = 1; inc["stats.pearls_earned"] = 1
            upd_titles = {"$addToSet": {"titles": f"{f['name']} Master"}}
            await db.users.update_one({"_id": user["_id"]}, upd_titles)
            await add_feed("mastery", user["username"], f"{user['username']} has mastered the {f['name']}. Every one of them now knows the name.", "epic")
    if first: inc["stats.species"] = 1
    if f["rarity"] == "legendary": inc["stats.legendary"] = 1
    if f["rarity"] == "mythic": inc["stats.mythic"] = 1; inc["stats.legendary"] = 1
    if f.get("secret"):
        inc["stats.secret_catches"] = 1
        await add_feed("secret", user["username"], f"{user['username']} landed the secret {f['name']} ({weight} kg) at {WATER_BY_KEY[enc['water']]['name']}. A fish most anglers never see.", "legendary")
    if weight > user["stats"].get("heaviest_kg", 0):
        sets["stats.heaviest_kg"] = weight
        sets["stats.heaviest_name"] = f["name"]
    upd = {"$inc": inc}
    if sets: upd["$set"] = sets
    await db.users.update_one({"_id": user["_id"]}, upd)
    qd = await quest_event(user["_id"], "catch", {"water": enc["water"], "rarity": f["rarity"], "weight": weight, "variant": enc["variant"], "new_species": first,
                                                  "period": conditions_for(enc["water"])["period"]})
    if f["rarity"] in ("rare", "epic", "legendary", "mythic") or enc["variant"] != "normal":
        vtxt = f" {enc['variant']}" if enc["variant"] != "normal" else ""
        await add_feed("catch", user["username"], f"{user['username']} landed a{vtxt} {f['name']} ({weight} kg) at {WATER_BY_KEY[enc['water']]['name']}.", f["rarity"])
    new_level = await settle_level_up(user["_id"], old_level) or old_level
    if enc.get("alert_id"):
        vtxt = f" {enc['variant']}" if enc["variant"] != "normal" else ""
        await db.alerts.update_one({"_id": ObjectId(enc["alert_id"])}, {"$set": {"status": "landed", "species": f["name"], "weight": weight, "variant": enc["variant"], "at": iso(now()),
                                    "catch_id": catch["id"], "text": f"{user['username']} landed a {f['rarity']}{vtxt} {f['name']} ({weight} kg) at {WATER_BY_KEY[enc['water']]['name']}!"}})
    new_ach = await check_achievements(user["_id"])
    user = await db.users.find_one({"_id": user["_id"]})
    await check_referral(user)
    catch.update((await vendor_quotes(user, [catch], {f["id"]: (journal["count"] if journal else 0) + 1}))[catch["id"]])
    from friends import friends_here
    n_fr = len(await friends_here(user))
    if n_fr > (user.get("stats") or {}).get("max_friends_together", 0):
        await db.users.update_one({"_id": user["_id"]}, {"$max": {"stats.max_friends_together": n_fr}})
    hex_bonus = None
    if GEAR_BY_ID.get(user["gear"]["rod"], {}).get("hex_hook") and random.random() < GEAR_BY_ID[user["gear"]["rod"]]["hex_hook"]:
        twin = {k: v for k, v in catch.items() if k not in ("id", "vendor", "vendor_bonus_pct")}
        twin["weight"] = round(weight * random.uniform(0.8, 1.0), 3); twin["variant"] = "normal"; twin["value"] = fish_value(f, twin["weight"], 1.0); twin["caught_at"] = iso(now())
        r2 = await db.catches.insert_one(twin)
        await db.catch_log.insert_one(catch_ledger(twin))
        await db.journal.update_one({"user_id": str(user["_id"]), "species_id": f["id"]}, {"$inc": {"count": 1}})
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"stats.catches": 1, "stats.hex_hooks": 1}})
        hex_bonus = {"id": str(r2.inserted_id), "name": f["name"], "weight": twin["weight"], "value": twin["value"]}
        user = await db.users.find_one({"_id": user["_id"]})
    await duel_live.record_catch(user, f["name"], weight)
    from crates import maybe_fish_drop
    crate_drop = await maybe_fish_drop(user)
    return {"success": True, "catch": catch, "hex_bonus": hex_bonus, "crate_drop": crate_drop, "candles": HALLOW_CANDLES.get(f["rarity"]) if f["id"] in HALLOW_IDS else None, "xp": xp, "xp_boost": boost_mult if boost_mult > 1 else None, "first_discovery": first, "level_up": new_level if new_level > old_level else None,
            "blurb": f["blurb"], "baitable": f["baitable"], "user": public_user(user), "new_achievements": new_ach, "quests_done": qd, "mastery_up": mastery_up}


# ---------- Waters ----------
class TravelIn(BaseModel):
    water: str


@api.post("/waters/travel")
async def travel(body: TravelIn, user=Depends(get_current_user)):
    w = WATER_BY_KEY.get(body.water)
    if not w or w["key"] == HALLOW_WATER: raise HTTPException(404, "Unknown water")
    level, _ = level_from_xp(user["xp"])
    if w.get("premium"):
        if not premium_active(user): raise HTTPException(403, f"{w['name']} is Angler Pass water, buy a pass on the Donate page and activate it from your Inventory")
        if level_from_xp(user["xp"])[0] < w["level"]: raise HTTPException(400, f"{w['name']} needs level {w['level']}")
    elif w["key"] not in user["unlocked_waters"]:
        if level < w["level"]: raise HTTPException(400, f"You need level {w['level']} to fish {w['name']}")
        if user["gold"] < w["fee"]: raise HTTPException(400, f"The passage to {w['name']} costs {w['fee']} gold")
        await charge(user, {"$addToSet": {"unlocked_waters": w["key"]}}, gold=w["fee"], extra={"unlocked_waters": {"$ne": w["key"]}}, msg=f"The passage to {w['name']} costs {w['fee']} gold")
        await add_feed("travel", user["username"], f"{user['username']} unlocked {w['name']}.", "rare")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"water": w["key"], "at_pond": None}})
    await db.pending.delete_many({"user_id": str(user["_id"])})
    qd = await quest_event(user["_id"], "travel", {"water": w["key"]})
    await check_achievements(user["_id"])
    return {**public_user(await db.users.find_one({"_id": user["_id"]})), "quests_done": qd}


# ---------- Inventory / Journal ----------
def catch_out(c):
    c["id"] = str(c.pop("_id"))
    return c


INVENTORY_PAGE = 5000  # newest fish returned to the keepnet view; older ones surface as these are sold


@api.get("/inventory")
async def inventory(user=Depends(get_current_user)):
    flt = {"user_id": str(user["_id"]), "listed": False, "mounted": {"$ne": True}}
    total = await db.catches.count_documents(flt)
    rows = await db.catches.find(flt).sort("caught_at", -1).to_list(INVENTORY_PAGE)
    mounted = await db.catches.count_documents({"user_id": str(user["_id"]), "mounted": True})
    quotes = await vendor_quotes(user, rows)
    return {"fish": [{**catch_out(c), **quotes[str(c["id"])]} for c in rows], "total": total, "shown": len(rows), "bait": user["bait"], "gear": user["gear"], "owned_gear": user["owned_gear"],
            "mounted": mounted, "max_trophies": MAX_TROPHIES}


class CatchIn(BaseModel):
    catch_id: str


@api.post("/inventory/mount")
async def mount_trophy(body: CatchIn, user=Depends(get_current_user)):
    c = await db.catches.find_one({"_id": oid(body.catch_id), "user_id": str(user["_id"]), "listed": False, "mounted": {"$ne": True}})
    if not c: raise HTTPException(404, "Fish not found in your keepnet")
    if await db.catches.count_documents({"user_id": str(user["_id"]), "mounted": True}) >= MAX_TROPHIES:
        raise HTTPException(400, f"Your trophy wall only holds {MAX_TROPHIES} mounts")
    await db.catches.update_one({"_id": c["_id"]}, {"$set": {"mounted": True, "mounted_at": iso(now())}})
    if c["rarity"] in ("epic", "legendary", "mythic"):
        await add_feed("trophy", user["username"], f"{user['username']} mounted a {c['name']} ({c['weight']} kg) on their trophy wall.", c["rarity"])
    return {"ok": True}


@api.post("/inventory/unmount")
async def unmount_trophy(body: CatchIn, user=Depends(get_current_user)):
    r = await db.catches.update_one({"_id": oid(body.catch_id), "user_id": str(user["_id"]), "mounted": True}, {"$set": {"mounted": False}})
    if r.modified_count == 0: raise HTTPException(404, "No such trophy")
    return {"ok": True}


class RepairIn(BaseModel):
    gear_id: Optional[str] = None  # None = repair everything you own


def repair_discount(user):
    return min(75, perk_value((user.get("crew") or {}).get("perks"), "repair") + favour_perk(user, "repair"))


def bait_discount(user):
    return favour_perk(user, "bait")


def market_fee(user):
    if premium_active(user): return 0.0
    return max(0.0, MARKET_FEE - favour_perk(user, "fee") / 100)


def repair_quote(user, gear_id=None):
    items = [gear_id] if gear_id else user["owned_gear"]
    disc = repair_discount(user)
    out = []
    for gid in items:
        g = GEAR_BY_ID.get(gid)
        if not g or gid not in user["owned_gear"]: continue
        missing = MAX_DURABILITY - gear_dur(user, gid)
        if missing <= 0: continue
        full = missing * repair_cost_per_point(g)
        cost = max(1, math.ceil(full * (100 - disc) / 100)) if full else 0
        out.append({"gear_id": gid, "name": g["name"], "points": missing, "cost": cost, "full_cost": full})
    return out


@api.get("/inventory/repair-quote")
async def get_repair_quote(user=Depends(get_current_user)):
    q = repair_quote(user)
    return {"items": q, "total": sum(i["cost"] for i in q), "rate": REPAIR_RATE, "discount": repair_discount(user)}


@api.post("/inventory/repair")
async def repair_gear(body: RepairIn, user=Depends(get_current_user)):
    if body.gear_id and body.gear_id not in user["owned_gear"]: raise HTTPException(400, "You don't own that")
    q = repair_quote(user, body.gear_id)
    if not q: raise HTTPException(400, "Nothing needs repairing")
    total = sum(i["cost"] for i in q)
    if user["gold"] < total: raise HTTPException(400, f"Repairs cost {total} gold and you have {user['gold']}")
    await charge(user, {"$set": {f"durability.{i['gear_id']}": MAX_DURABILITY for i in q}}, gold=total, msg=f"Repairs cost {total} gold")
    return {"cost": total, "repaired": q, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.get("/journal")
async def journal(user=Depends(get_current_user)):
    rows = await db.journal.find({"user_id": str(user["_id"])}).to_list(2000)
    return {str(r["species_id"]): {"count": r["count"], "best_kg": r["best_kg"], "first_at": r["first_at"], "variants": r.get("variants", []),
                                   "mastery": mastery.info(FISH_BY_ID[r["species_id"]]["rarity"], r["count"]) if r["species_id"] in FISH_BY_ID else None} for r in rows}


@api.get("/species/{species_id}")
async def species_detail(species_id: int, user=Depends(get_current_user)):
    f = FISH_BY_ID.get(species_id)
    if not f: raise HTTPException(404, "No such species")
    w = WATER_BY_KEY[f["water"]]
    beh = BEHAVIORS[f["behavior"]]
    # Baits that work in this water (schema: waters list or None = all)
    baits = [{"id": b["id"], "name": b["name"], "luck": b["luck"], "crafted": b.get("crafted", False)}
             for b in BAITS if b["waters"] is None or f["water"] in (b["waters"] or [])]
    baits.sort(key=lambda x: -x["luck"])
    # Top record holders (heaviest ever landed of this species)
    rec_rows = await db.catch_log.find({"species_id": species_id}).sort("weight", -1).limit(3).to_list(3)
    records = [{"username": r.get("caught_by_name") or r.get("username", "Unknown"),
                "weight": round(r["weight"], 2), "variant": r.get("variant", "normal"),
                "caught_at": r["caught_at"]} for r in rec_rows]
    # Player's own progress
    j = await db.journal.find_one({"user_id": str(user["_id"]), "species_id": species_id})
    you = None
    if j:
        best = await db.catch_log.find_one({"user_id": str(user["_id"]), "species_id": species_id}, sort=[("weight", -1)])
        you = {"count": j["count"], "best_kg": round(j["best_kg"], 2), "first_at": j["first_at"],
               "variants": j.get("variants", []),
               "best_variant": best.get("variant", "normal") if best else "normal",
               "best_at": best["caught_at"] if best else None}
    total_catches = await db.catch_log.count_documents({"species_id": species_id})
    return {
        "id": f["id"], "name": f["name"], "rarity": f["rarity"], "blurb": f["blurb"], "bait_only": [BAIT_BY_ID[b]["name"] for b in f.get("bait_only", []) if b in BAIT_BY_ID],
        "min_kg": f["min_kg"], "max_kg": f["max_kg"], "baitable": f["baitable"], "value_mod": f["value_mod"],
        "water": {"key": w["key"], "name": w["name"], "type": w["type"], "salt": w["salt"], "level": w["level"], "desc": w["desc"]},
        "behavior": {"key": f["behavior"], "desc": beh["desc"], "strength": beh["strength"], "erratic": beh["erratic"]},
        "baits": baits[:6],
        "records": records,
        "total_catches": total_catches,
        "you": you,
    }


class SellIn(BaseModel):
    catch_ids: List[str]


@api.post("/inventory/sell")
async def sell(body: SellIn, user=Depends(get_current_user)):
    ids = [oid(i) for i in body.catch_ids]
    rows = await db.catches.find({"_id": {"$in": ids}, "user_id": str(user["_id"]), "listed": False, "mounted": {"$ne": True}}).to_list(None)
    if not rows: raise HTTPException(404, "Nothing to sell")
    quotes = await vendor_quotes(user, rows)
    sold = [c for c in rows if (await db.catches.delete_one({"_id": c["_id"], "user_id": str(user["_id"]), "listed": False})).deleted_count]  # pay only for fish that actually left
    if not sold: raise HTTPException(409, "Those fish just left your keepnet")
    rows = sold
    candles = halloween.candles_for(rows)
    total = sum(quotes[str(c["_id"])]["vendor"] for c in rows if c.get("species_id") not in HALLOW_IDS)
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"gold": total, "stats.gold_earned": total, "stats.sold": len(rows), "candles": candles, "stats.candles_earned": candles}})
    qd = await quest_event(user["_id"], "sell", {"n": len(rows), "gold": total})
    new_ach = await check_achievements(user["_id"])
    return {"gold": total, "candles": candles, "count": len(rows), "user": public_user(await db.users.find_one({"_id": user["_id"]})), "new_achievements": new_ach, "quests_done": qd}


@api.post("/inventory/use-bait")
async def use_as_bait(body: SellIn, user=Depends(get_current_user)):
    ids = [oid(i) for i in body.catch_ids]
    rows = await db.catches.find({"_id": {"$in": ids}, "user_id": str(user["_id"]), "listed": False, "mounted": {"$ne": True}}).to_list(None)
    rows = [c for c in rows if FISH_BY_ID[c["species_id"]]["baitable"]]
    if not rows: raise HTTPException(400, "None of those fish can be used as live bait")
    res = await db.catches.delete_many({"_id": {"$in": [c["_id"] for c in rows]}, "user_id": str(user["_id"]), "listed": False})
    if not res.deleted_count: raise HTTPException(409, "Those fish just left your keepnet")
    gained = res.deleted_count * LIVE_BAIT_PER_FISH
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"bait.bait_live": gained}})
    return {"bait": gained, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


# ---------- Shop ----------
class BuyGearIn(BaseModel):
    gear_id: str


class BuyBaitIn(BaseModel):
    bait_id: str
    qty: int = Field(ge=1, le=500)


class EquipIn(BaseModel):
    gear_id: Optional[str] = None
    bait_id: Optional[str] = None
    copy: Optional[int] = None  # index into spare_copies: swap that copy in, the current one goes to the spares


MILESTONE_LABELS = {"catches": "fish landed", "cheers": "cheers received", "friends_together": "friends fishing beside you at once", "recruits": "recruits completed",
                    "duel_wins": "duel wins", "tournament_wins": "tournament wins", "boss_kills": "boss kills", "legendary": "legendary fish landed", "mythic": "mythic fish landed"}


def milestone_value(u, key):
    s = u.get("stats") or {}
    return {"catches": s.get("catches", 0), "cheers": s.get("cheers", 0), "friends_together": s.get("max_friends_together", 0), "recruits": s.get("recruits_completed", 0),
            "duel_wins": (u.get("duel") or {}).get("wins", 0), "tournament_wins": s.get("tournament_wins", 0), "boss_kills": s.get("boss_kills", 0),
            "legendary": s.get("legendary", 0), "mythic": s.get("mythic", 0)}[key]


def milestone_progress(u, g):
    return [{"key": k, "label": MILESTONE_LABELS[k], "have": milestone_value(u, k), "need": n} for k, n in g.get("milestones", [])]


def fmt_n(n): return f"{n:,}"


@api.get("/shop/milestones")
async def shop_milestones(user=Depends(get_current_user)):
    return {g["id"]: milestone_progress(user, g) for g in GEAR_BY_ID.values() if g.get("milestones")}


@api.post("/shop/buy-gear")
async def buy_gear(body: BuyGearIn, user=Depends(get_current_user)):
    g = GEAR_BY_ID.get(body.gear_id)
    if not g: raise HTTPException(404, "Unknown item")
    if g.get("event"): raise HTTPException(400, "Only the Marsh Witch trades that, for Soul Candles")
    if g.get("crate"): raise HTTPException(400, "That rod only comes out of crates, or from another angler on the Market")
    dup = g["id"] in user["owned_gear"]
    if dup and (g.get("bound") or not g["price"]): raise HTTPException(400, "You already own that")
    level, _ = level_from_xp(user["xp"])
    if level < g.get("level", 1): raise HTTPException(400, f"The {g['name']} needs level {g['level']}")
    if user["gold"] < g["price"]: raise HTTPException(400, "Not enough gold")
    pearls = g.get("pearls", 0)
    if pearls and user.get("pearls", 0) < pearls: raise HTTPException(400, f"Not enough Pearls ({pearls} needed)")
    missing = [m for m in milestone_progress(user, g) if m["have"] < m["need"]]
    if missing: raise HTTPException(400, f"The {g['name']} needs: " + ", ".join(f"{m['label']} ({fmt_n(m['have'])}/{fmt_n(m['need'])})" for m in missing))
    slot = g["id"].split("_")[0]
    if dup:
        await charge(user, {"$push": {f"spare_copies.{g['id']}": {"enhance": 0, "durability": MAX_DURABILITY}}}, gold=g["price"], pearls=pearls, msg="Not enough gold or Pearls")
        return public_user(await db.users.find_one({"_id": user["_id"]}))
    await charge(user, {"$addToSet": {"owned_gear": g["id"]}, "$set": {f"gear.{slot}": g["id"], f"durability.{g['id']}": MAX_DURABILITY}},
                 gold=g["price"], pearls=pearls, extra={"owned_gear": {"$ne": g["id"]}}, msg="Purchase failed, you already own it or can't afford it")
    if g["price"] >= 20000 or g.get("rare"):
        await add_feed("gear", user["username"], f"{user['username']} bought a {g['name']}.", "legendary" if pearls else "epic")
    return public_user(await db.users.find_one({"_id": user["_id"]}))


def bait_price(b, user):
    return max(1, math.ceil(b["price"] * (100 - bait_discount(user)) / 100)) if b["price"] else 0


@api.post("/shop/buy-bait")
async def buy_bait(body: BuyBaitIn, user=Depends(get_current_user)):
    b = BAIT_BY_ID.get(body.bait_id)
    if not b or b["price"] is None: raise HTTPException(404, "That bait is not sold here")
    if level_from_xp(user["xp"])[0] < b.get("level", 1): raise HTTPException(400, f"{b['name']} needs level {b['level']}")
    cost = bait_price(b, user) * body.qty
    pearl_cost = b.get("pearls", 0) * body.qty
    if user["gold"] < cost: raise HTTPException(400, "Not enough gold")
    if pearl_cost and user.get("pearls", 0) < pearl_cost: raise HTTPException(400, "Not enough Pearls")
    await charge(user, {"$inc": {f"bait.{b['id']}": body.qty * b.get("pack", 1)}}, gold=cost, pearls=pearl_cost, msg="Not enough gold or Pearls")
    return public_user(await db.users.find_one({"_id": user["_id"]}))


@api.post("/shop/equip")
async def equip(body: EquipIn, user=Depends(get_current_user)):
    sets = {}
    if body.gear_id:
        if body.gear_id not in user["owned_gear"]: raise HTTPException(400, "You don't own that")
        need = GEAR_BY_ID.get(body.gear_id, {}).get("level", 1)
        if level_from_xp(user["xp"])[0] < need: raise HTTPException(400, f"You need level {need} to use the {GEAR_BY_ID[body.gear_id]['name']}")
        sets[f"gear.{body.gear_id.split('_')[0]}"] = body.gear_id
        if body.copy is not None:
            gid, cur = body.gear_id, list((user.get("spare_copies") or {}).get(body.gear_id, []))
            if not 0 <= body.copy < len(cur): raise HTTPException(400, "That copy just left your box")
            pick = cur[body.copy]
            new = cur[:body.copy] + [{"enhance": enh_level(user, gid), "durability": gear_dur(user, gid)}] + cur[body.copy + 1:]
            upd = {"$set": {**sets, f"spare_copies.{gid}": new, f"durability.{gid}": pick["durability"]}}
            if pick["enhance"]: upd["$set"][f"enhance.{gid}"] = pick["enhance"]
            else: upd["$unset"] = {f"enhance.{gid}": ""}
            r = await db.users.update_one({"_id": user["_id"], f"spare_copies.{gid}": cur}, upd)
            if not r.matched_count: raise HTTPException(409, "Your tackle box changed, try again")
            return public_user(await db.users.find_one({"_id": user["_id"]}))
    if body.bait_id is not None:
        if body.bait_id and user["bait"].get(body.bait_id, 0) <= 0: raise HTTPException(400, "You have none of that bait")
        sets["active_bait"] = body.bait_id or None
    await db.users.update_one({"_id": user["_id"]}, {"$set": sets})
    return public_user(await db.users.find_one({"_id": user["_id"]}))


# ---------- Market ----------
class ListIn(BaseModel):
    kind: str
    catch_id: Optional[str] = None
    bait_id: Optional[str] = None
    ingredient_id: Optional[str] = None
    item_id: Optional[str] = None
    copy: Optional[int] = None
    qty: int = Field(default=1, ge=1, le=500)
    price: int = Field(ge=1, le=100_000_000)


def listing_out(l):
    l["id"] = str(l.pop("_id"))
    return l


def listing_stack_field(l):
    if l["kind"] == "scrap": return "scrap"
    if l["kind"] in ("pass", "potion", "crate"): return f"items.{l['item']['item_id']}"
    return f"ingredients.{l['item']['ingredient_id']}" if l["kind"] == "ingredient" else f"bait.{l['item']['bait_id']}"


GEAR_VENDOR_RATE = 0.4  # the vendor buys used tackle at 40% of shop price, scaled by durability (worn-out = half of that)
POTION_VENDOR = 400
SCRAP_VENDOR = 5


def gear_vendor_price(u, g, copy=None):
    if not g["price"]: return 0
    if copy is not None:
        c = ((u.get("spare_copies") or {}).get(g["id"]) or [])[copy] if 0 <= copy < len((u.get("spare_copies") or {}).get(g["id"]) or []) else None
        if not c: return 0
        dur, enh = c["durability"] / MAX_DURABILITY, c["enhance"]
    else:
        dur, enh = gear_dur(u, g["id"]) / MAX_DURABILITY, enh_level(u, g["id"])
    return max(1, int(round(g["price"] * GEAR_VENDOR_RATE * (0.5 + 0.5 * dur) * (1 + 0.05 * enh))))


def bait_vendor_price(b):
    if b["price"]: return max(1, round((b["price"] / b.get("pack", 1)) * 0.5))
    return 3 if b["id"] == "bait_live" else b["luck"] * 2  # Live Bait must stay below a vendored common fish or it becomes a money pump


async def take_gear(user, gear_id, copy=None):
    """Remove one piece of tackle from an angler (for listing or vendoring); returns the snapshot to hand to a buyer."""
    g = GEAR_BY_ID.get(gear_id)
    if not g: raise HTTPException(404, "Unknown tackle")
    if copy is not None:
        cur = list((user.get("spare_copies") or {}).get(gear_id, []))
        if not 0 <= copy < len(cur): raise HTTPException(400, "That copy just left your box")
        if g.get("bound") or not g["price"]: raise HTTPException(400, "That tackle can't be sold")
        r = await db.users.update_one({"_id": user["_id"], f"spare_copies.{gear_id}": cur}, {"$set": {f"spare_copies.{gear_id}": cur[:copy] + cur[copy + 1:]}})
        if not r.modified_count: raise HTTPException(409, "Your tackle box changed, try again")
        return {"gear_id": g["id"], "name": g["name"], "slot": g["id"].split("_")[0], "tier": g["tier"], "rarity": "rare" if g.get("rare") else "uncommon",
                "durability": MAX_DURABILITY, "enhance": 0, "shop_price": g["price"], "orig": dict(cur[copy])}
    if gear_id not in user["owned_gear"]: raise HTTPException(400, "You don't own that")
    if gear_id in user["gear"].values(): raise HTTPException(400, "Unequip it first, you can't sell tackle you're using")
    if not g["price"]: raise HTTPException(400, "The village lends you that, it can't be sold")
    if g.get("bound"): raise HTTPException(400, f"The {g['name']} is untradable, it stays with the angler who earned it")
    snap = {"gear_id": g["id"], "name": g["name"], "slot": g["id"].split("_")[0], "tier": g["tier"], "rarity": "rare" if g.get("rare") else "uncommon",
            "durability": MAX_DURABILITY, "enhance": 0, "shop_price": g["price"],  # sold tackle always reaches the buyer as a fresh copy
            "orig": {"durability": gear_dur(user, g["id"]), "enhance": enh_level(user, g["id"])}}  # restored if the seller withdraws it
    spares = list((user.get("spare_copies") or {}).get(g["id"], []))
    if spares:  # the next copy steps up so the tackle box never holds spares of something it doesn't own
        nxt = spares[0]
        upd = {"$set": {f"spare_copies.{g['id']}": spares[1:], f"durability.{g['id']}": nxt["durability"]}}
        if nxt["enhance"]: upd["$set"][f"enhance.{g['id']}"] = nxt["enhance"]
        else: upd["$unset"] = {f"enhance.{g['id']}": ""}
        r = await db.users.update_one({"_id": user["_id"], f"spare_copies.{g['id']}": spares}, upd)
    else:
        r = await db.users.update_one({"_id": user["_id"], "owned_gear": g["id"]}, {"$pull": {"owned_gear": g["id"]}, "$unset": {f"durability.{g['id']}": "", f"enhance.{g['id']}": ""}})
    if not r.modified_count: raise HTTPException(409, "That tackle just left your box")
    return snap


async def give_gear(user_id, item):
    """Hand listed tackle to a buyer (or back to the seller). Someone who already owns the same piece keeps the better enhancement."""
    u = await db.users.find_one({"_id": user_id}, {"owned_gear": 1, "enhance": 1})
    if item["gear_id"] in (u or {}).get("owned_gear", []):
        await db.users.update_one({"_id": user_id}, {"$push": {f"spare_copies.{item['gear_id']}": {"enhance": item.get("enhance", 0), "durability": item["durability"]}}})
        return
    upd = {"$addToSet": {"owned_gear": item["gear_id"]}, "$set": {f"durability.{item['gear_id']}": item["durability"]}}
    if item["gear_id"] not in (u or {}).get("owned_gear", []) or item.get("enhance", 0) > ((u or {}).get("enhance") or {}).get(item["gear_id"], 0):
        if item.get("enhance"): upd["$set"][f"enhance.{item['gear_id']}"] = item["enhance"]
    await db.users.update_one({"_id": user_id}, upd)


@api.get("/market")
async def market(kind: Optional[str] = None, rarity: Optional[str] = None, q: Optional[str] = None, sort: str = "newest", mine: bool = False,
                 user=Depends(get_current_user)):
    flt: dict[str, Any] = {"status": "open"}
    if mine: flt = {"seller_id": str(user["_id"]), "status": "open"}
    if kind == "baitfish": flt["kind"] = "fish"; flt["item.species_id"] = {"$in": [f["id"] for f in FISH if f["baitable"]]}
    elif kind: flt["kind"] = kind
    if rarity: flt["item.rarity"] = rarity
    if q: flt["item.name"] = {"$regex": re.escape(q), "$options": "i"}
    sort_spec = {"newest": [("created_at", -1)], "cheapest": [("price", 1)], "priciest": [("price", -1)]}.get(sort, [("created_at", -1)])
    rows = await db.listings.find(flt).sort(sort_spec).limit(200).to_list(200)
    return [listing_out(l) for l in rows]


@api.post("/market/list")
async def create_listing(body: ListIn, user=Depends(get_current_user)):
    botwatch.guard_trade(user)
    cap = market_cap(user)
    if await db.listings.count_documents({"seller_id": str(user["_id"]), "status": "open"}) >= cap:
        raise HTTPException(400, f"You can only have {cap} open listings at once (crew Trade Licence raises this)")
    if body.kind == "fish":
        c = await db.catches.find_one({"_id": oid(body.catch_id), "user_id": str(user["_id"]), "listed": False, "mounted": {"$ne": True}})
        if not c: raise HTTPException(404, "Fish not found in your inventory")
        if c.get("species_id") in HALLOW_IDS: raise HTTPException(400, "Halloween fish can only be sold to the Marsh Witch for Soul Candles")
        await db.catches.update_one({"_id": c["_id"]}, {"$set": {"listed": True}})
        item = {"catch_id": str(c["_id"]), "name": c["name"], "rarity": c["rarity"], "weight": c["weight"], "variant": c["variant"],
                "value": c["value"], "species_id": c["species_id"], "water": c["water"], "length_cm": c["length_cm"]}
        qty = 1
    elif body.kind == "bait":
        b = BAIT_BY_ID.get(body.bait_id)
        if not b: raise HTTPException(404, "Unknown bait")
        if b.get("duel"): raise HTTPException(400, f"{b['name']} is earned on the duelling pier and can't be sold")
        if user["bait"].get(b["id"], 0) < body.qty: raise HTTPException(400, "Not enough bait")
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {f"bait.{b['id']}": -body.qty}})
        item = {"bait_id": b["id"], "name": b["name"], "rarity": "common", "luck": b["luck"]}
        qty = body.qty
    elif body.kind == "ingredient":
        ing = ING_BY_ID.get(body.ingredient_id)
        if not ing: raise HTTPException(404, "Unknown ingredient")
        if user.get("is_guest"): raise HTTPException(400, "Claim your account before selling ingredients")
        if user.get("ingredients", {}).get(ing["id"], 0) < body.qty: raise HTTPException(400, "Not enough of that ingredient")
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {f"ingredients.{ing['id']}": -body.qty}})
        item = {"ingredient_id": ing["id"], "name": ing["name"], "rarity": "common", "vendor_price": ing["price"]}
        qty = body.qty
    elif body.kind == "pass":
        from premium import PASSES
        p = PASSES.get(body.item_id or "pass_month")
        if not p: raise HTTPException(404, "Unknown pass")
        if user.get("is_guest"): raise HTTPException(400, "Claim your account before selling a pass")
        r = await db.users.update_one({"_id": user["_id"], f"items.{p['id']}": {"$gte": body.qty}}, {"$inc": {f"items.{p['id']}": -body.qty}})
        if not r.modified_count: raise HTTPException(400, f"You don't have that many {p['name']} passes")
        item = {"item_id": p["id"], "name": p["name"], "rarity": "epic", "days": p["days"]}
        qty = body.qty
    elif body.kind == "crate":
        from crates import CRATES
        cr = CRATES.get(body.item_id or "")
        if not cr: raise HTTPException(404, "Unknown crate")
        if user.get("is_guest"): raise HTTPException(400, "Claim your account before selling crates")
        r = await db.users.update_one({"_id": user["_id"], f"items.{body.item_id}": {"$gte": body.qty}}, {"$inc": {f"items.{body.item_id}": -body.qty}})
        if not r.modified_count: raise HTTPException(400, f"You don't have that many {cr['name']}s")
        item = {"item_id": body.item_id, "name": cr["name"], "rarity": cr["rarity"]}
        qty = body.qty
    elif body.kind == "potion":
        if user.get("is_guest"): raise HTTPException(400, "Claim your account before selling potions")
        r = await db.users.update_one({"_id": user["_id"], "items.potion_energy": {"$gte": body.qty}}, {"$inc": {"items.potion_energy": -body.qty}})
        if not r.modified_count: raise HTTPException(400, "You don't have that many Energy Potions")
        item = {"item_id": "potion_energy", "name": "Energy Potion", "rarity": "rare", "energy": POTION_ENERGY}
        qty = body.qty
    elif body.kind == "gear":
        if user.get("is_guest"): raise HTTPException(400, "Claim your account before selling tackle")
        item = await take_gear(user, body.item_id or "", body.copy)
        qty = 1
    elif body.kind == "scrap":
        if user.get("is_guest"): raise HTTPException(400, "Claim your account before selling scrap")
        r = await db.users.update_one({"_id": user["_id"], "scrap": {"$gte": body.qty}}, {"$inc": {"scrap": -body.qty}})
        if not r.modified_count: raise HTTPException(400, "Not enough Tackle Scrap")
        item = {"scrap": True, "name": "Tackle Scrap", "rarity": "common"}
        qty = body.qty
    else:
        raise HTTPException(400, "Unknown listing type")
    doc = {"seller_id": str(user["_id"]), "seller": user["username"], "kind": body.kind, "item": item, "qty": qty, "price": body.price,
           "status": "open", "created_at": iso(now())}
    res = await db.listings.insert_one(doc)
    if body.kind == "fish" and item["rarity"] in ("epic", "legendary", "mythic"):
        await add_feed("market", user["username"], f"{user['username']} listed a {item['name']} for {body.price} gold.", item["rarity"])
    qd = await quest_event(user["_id"], "list", {"n": 1})
    return {**listing_out({**doc, "_id": res.inserted_id}), "quests_done": qd}


@api.post("/market/{listing_id}/buy")
async def buy_listing(listing_id: str, user=Depends(get_current_user)):
    l = await db.listings.find_one({"_id": oid(listing_id), "status": "open"})
    if not l: raise HTTPException(404, "That listing is gone")
    if l["seller_id"] == str(user["_id"]): raise HTTPException(400, "You can't buy your own listing")
    botwatch.guard_trade(user)
    if user.get("last_ip_hash"):
        s = await db.users.find_one({"_id": ObjectId(l["seller_id"])}, {"last_ip_hash": 1, "reg_ip_hash": 1, "ip_log": 1}) or {}
        seller_ips = {s.get("last_ip_hash"), s.get("reg_ip_hash")} | {e.get("h") for e in s.get("ip_log") or []}
        mine = {user.get("last_ip_hash"), user.get("reg_ip_hash")} | {e.get("h") for e in user.get("ip_log") or []}
        if (seller_ips & mine) - {None}: raise HTTPException(409, "This listing isn't available right now")
    if user["gold"] < l["price"]: raise HTTPException(400, "Not enough gold")
    if l["kind"] == "gear":
        if level_from_xp(user["xp"])[0] < GEAR_BY_ID[l["item"]["gear_id"]].get("level", 1): raise HTTPException(400, f"{l['item']['name']} needs level {GEAR_BY_ID[l['item']['gear_id']]['level']}")
    r = await db.listings.update_one({"_id": l["_id"], "status": "open"}, {"$set": {"status": "sold", "buyer": user["username"], "sold_at": iso(now())}})
    if r.modified_count == 0: raise HTTPException(409, "Someone beat you to it")
    seller = await db.users.find_one({"_id": ObjectId(l["seller_id"])}, {"favour": 1, "favour_rank": 1}) or {}
    fee_rate = market_fee(seller)
    payout = int(round(l["price"] * (1 - fee_rate)))
    pay = await db.users.update_one({"_id": user["_id"], "gold": {"$gte": l["price"]}}, {"$inc": {"gold": -l["price"]}})
    if pay.matched_count == 0:
        await db.listings.update_one({"_id": l["_id"]}, {"$set": {"status": "open"}, "$unset": {"buyer": "", "sold_at": ""}})
        raise HTTPException(400, "Not enough gold")
    await db.users.update_one({"_id": ObjectId(l["seller_id"])}, {"$inc": {"gold": payout, "stats.gold_earned": payout, "stats.sold": 1}})
    if l["kind"] == "fish":
        await db.catches.update_one({"_id": ObjectId(l["item"]["catch_id"])}, {"$set": {"user_id": str(user["_id"]), "username": user["username"], "listed": False}})
    elif l["kind"] == "gear":
        await give_gear(user["_id"], l["item"])
    else:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {listing_stack_field(l): l["qty"]}})
    await db.trades.insert_one({"listing_id": str(l["_id"]), "seller": l["seller"], "buyer": user["username"], "item": l["item"]["name"],
                                "rarity": l["item"]["rarity"], "kind": l["kind"], "qty": l["qty"], "price": l["price"], "at": iso(now())})
    await add_feed("trade", user["username"], f"{user['username']} bought {l['item']['name']} from {l['seller']} for {l['price']} gold.", l["item"]["rarity"])
    await quest_event(ObjectId(l["seller_id"]), "sell", {"n": l["qty"] if l["kind"] == "fish" else 0, "gold": payout})
    qty_txt = f"{l['qty']}× " if l["qty"] > 1 else ""
    fee = l["price"] - payout
    await send_system_message(l["seller_id"], l["seller"], f"Sold! {user['username']} bought your {qty_txt}{l['item']['name']} for {l['price']:,} gold. "
                              f"After the {round(fee_rate * 100)}% market fee ({fee:,}g) you received {payout:,} gold.")
    await check_achievements(ObjectId(l["seller_id"]))
    return public_user(await db.users.find_one({"_id": user["_id"]}))


@api.post("/market/{listing_id}/cancel")
async def cancel_listing(listing_id: str, user=Depends(get_current_user)):
    l = await db.listings.find_one({"_id": oid(listing_id), "status": "open", "seller_id": str(user["_id"])})
    if not l: raise HTTPException(404, "Listing not found")
    r = await db.listings.update_one({"_id": l["_id"], "status": "open"}, {"$set": {"status": "cancelled"}})
    if not r.modified_count: raise HTTPException(409, "That listing was already closed")
    if l["kind"] == "fish":
        await db.catches.update_one({"_id": ObjectId(l["item"]["catch_id"])}, {"$set": {"listed": False}})
    elif l["kind"] == "gear":
        await give_gear(user["_id"], {**l["item"], **(l["item"].get("orig") or {})})
    else:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {listing_stack_field(l): l["qty"]}})
    return public_user(await db.users.find_one({"_id": user["_id"]}))


class SellItemIn(BaseModel):
    kind: str  # gear | potion | bait | ingredient | scrap
    item_id: Optional[str] = None
    copy: Optional[int] = None
    qty: int = Field(default=1, ge=1, le=10000)


def vendor_item_quote(user, kind, item_id, copy=None):
    """Gold the vendor pays per unit for a non-fish item (0 = not buying)."""
    if kind == "gear": g = GEAR_BY_ID.get(item_id); return gear_vendor_price(user, g, copy) if g and not g.get("bound") and not g.get("event") else 0
    if kind == "potion": return POTION_VENDOR
    if kind == "bait":
        b = BAIT_BY_ID.get(item_id)
        return 0 if not b or b.get("duel") else bait_vendor_price(b)
    if kind == "ingredient": i = ING_BY_ID.get(item_id); return max(1, i["price"] // 2) if i else 0
    if kind == "scrap": return SCRAP_VENDOR
    return 0


@api.get("/inventory/vendor-quotes")
async def vendor_item_quotes(user=Depends(get_current_user)):
    """What the vendor pays right now for each stackable/tackle item the angler owns."""
    q = {"gear": {g: vendor_item_quote(user, "gear", g) for g in user["owned_gear"] if g in GEAR_BY_ID},
         "gear_copies": {g: [vendor_item_quote(user, "gear", g, i) for i in range(len(cs))] for g, cs in (user.get("spare_copies") or {}).items() if cs and g in GEAR_BY_ID},
         "bait": {b: bait_vendor_price(BAIT_BY_ID[b]) for b in user["bait"] if b in BAIT_BY_ID and not BAIT_BY_ID[b].get("duel")},
         "ingredient": {i["id"]: max(1, i["price"] // 2) for i in INGREDIENTS}, "potion": POTION_VENDOR, "scrap": SCRAP_VENDOR}
    return q


@api.post("/inventory/sell-item")
async def sell_item(body: SellItemIn, user=Depends(get_current_user)):
    """Sell tackle, potions, bait, ingredients or scrap straight to the dockside vendor."""
    each = vendor_item_quote(user, body.kind, body.item_id, body.copy)
    if not each: raise HTTPException(400, "The vendor doesn't buy that")
    qty = body.qty
    if body.kind == "gear":
        await take_gear(user, body.item_id, body.copy); qty = 1; name = GEAR_BY_ID[body.item_id]["name"]
    else:
        field, name = {"potion": ("items.potion_energy", "Energy Potion"), "bait": (f"bait.{body.item_id}", BAIT_BY_ID.get(body.item_id, {}).get("name")),
                       "ingredient": (f"ingredients.{body.item_id}", ING_BY_ID.get(body.item_id, {}).get("name")), "scrap": ("scrap", "Tackle Scrap")}[body.kind]
        r = await db.users.update_one({"_id": user["_id"], field: {"$gte": qty}}, {"$inc": {field: -qty}})
        if not r.modified_count: raise HTTPException(400, f"You don't have that many {name}")
    total = each * qty
    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"gold": total, "stats.gold_earned": total}})
    return {"gold": total, "qty": qty, "name": name, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.get("/market/trades")
async def recent_trades(user=Depends(get_current_user)):
    rows = await db.trades.find({}, {"_id": 0}).sort("at", -1).limit(30).to_list(30)
    return rows


# ---------- Social ----------
async def add_feed(kind, username, text, rarity):
    await db.feed.insert_one({"kind": kind, "username": username, "text": text, "rarity": rarity, "at": iso(now())})


async def settle_level_up(user_id, old_level):
    """Any XP source: if the angler crossed a level, add a full bar of energy on top (banked up to energy_cap) and announce it. Returns the new level or None."""
    u = await db.users.find_one({"_id": user_id}, {"xp": 1, "username": 1, "premium_until": 1, "energy": 1, "energy_at": 1, "crew": 1})
    new_level, _ = level_from_xp(u["xp"])
    if new_level <= old_level: return None
    e = apply_energy(dict(u), _WINDOWS_NOW)["energy"]  # credit pending regen first so it isn't lost
    await db.users.update_one({"_id": user_id}, {"$set": {"energy": min(energy_cap(u), e + max_energy(u)), "energy_at": iso(now())}})
    await add_feed("level", u["username"], f"{u['username']} reached level {new_level}.", "uncommon")
    return new_level


async def notify(user_id, text: str, url: str = None, push_title: str = None):
    """In-game toast on the next shell pulse (≤30 s) plus, if push_title is given, a web push of kind 'events' for closed tabs."""
    await db.notices.insert_one({"user_id": str(user_id), "text": text, "url": url, "at": iso(now())})
    if push_title:
        from push_notifications import broadcast
        await broadcast(push_title, text, url or "/game", tag="events", kind="events", user_ids=[str(user_id)])


async def send_system_message(user_id: str, username: str, text: str):
    await db.messages.insert_one({"from_id": "system", "from": SYSTEM_SENDER,
                                   "to_id": str(user_id), "to": username,
                                   "text": text, "at": iso(now()), "read": False})


@api.get("/feed")
async def feed(limit: int = 40):
    limit = min(limit, 100)
    return await cached(f"feed:{limit}", 10, lambda: _feed(limit))


async def _feed(limit):
    rows = await db.feed.find({}, {"_id": 0}).sort("at", -1).limit(limit).to_list(limit)
    names = list({r.get("username") for r in rows if r.get("username")})
    looks = {u["username"]: u async for u in db.users.find({"username": {"$in": names}}, {"username": 1, "avatar": 1, "frame": 1})} if names else {}
    for r in rows:
        u = looks.get(r.get("username"))
        if u: r["avatar"] = u.get("avatar") or STARTER_AVATARS[0]; r["frame"] = u.get("frame")
    return rows


@api.get("/chat/{channel}")
async def chat_get(channel: str, after: str = "", user=Depends(get_current_user)):
    flt = chat_filter(channel, user)
    if after: flt = {**flt, "at": {"$gt": after}}
    rows = await db.chat.find(flt).sort("at", -1).limit(60).to_list(60)
    if not rows: return []
    names = list({r["username"] for r in rows})
    looks = {u["username"]: u async for u in db.users.find({"username": {"$in": names}}, {"username": 1, "avatar": 1, "frame": 1, "supporter": 1, "premium_until": 1, "role": 1})}
    return [chat_out(r, looks.get(r["username"])) for r in rows[::-1]]


def chat_out(m, u=None):
    look = {"avatar": (u or {}).get("avatar") or STARTER_AVATARS[0], "frame": (u or {}).get("frame"), "supporter": bool((u or {}).get("supporter")), "premium": premium_active(u or {}), "mod": (u or {}).get("role") == "mod"} if u is not None else {}
    if u is None and m.get("username") == "Harbourmaster" and not m.get("level"): look = {"avatar": "npc_harbourmaster", "system": True}
    return {**{k: v for k, v in m.items() if k not in ("_id", "dk")}, **look, "id": str(m["_id"])}


def chat_filter(channel, user):
    if channel in ("global", "trade"): return {"channel": channel}
    if channel == "crew":
        if not user.get("crew"): raise HTTPException(400, "You are not in a crew")
        return {"channel": "crew", "crew_id": user["crew"]["id"]}
    raise HTTPException(404, "No such channel")


async def mention_count(user):
    """Chat lines that @mention this angler since they last had the chat open (24 h window)."""
    since = max(user.get("chat_seen_at") or "", iso(now() - timedelta(hours=24)))
    chans = [{"channel": {"$in": ["global", "trade"]}}]
    if user.get("crew"): chans.append({"channel": "crew", "crew_id": user["crew"]["id"]})
    return await db.chat.count_documents({"at": {"$gt": since}, "username": {"$ne": user["username"]}, "$or": chans,
                                          "text": {"$regex": f"@{re.escape(user['username'])}(?![A-Za-z0-9_])", "$options": "i"}}, limit=99)


@api.post("/chat/seen")
async def chat_seen(user=Depends(get_current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"chat_seen_at": iso(now())}})
    return {"ok": True}


class ChatItemIn(BaseModel):
    kind: str = Field(pattern="^(fish|gear|item)$")
    ref: str = Field(min_length=1, max_length=40)
    copy_idx: Optional[int] = Field(default=None, ge=0, le=500)


class ChatIn(BaseModel):
    text: str = Field(default="", max_length=240)
    item: Optional[ChatItemIn] = None


async def chat_item_snapshot(user, it):
    """Validate the angler really owns the linked item and freeze a small public card of it."""
    if it.kind == "fish":
        c = await db.catches.find_one({"_id": oid(it.ref), "user_id": str(user["_id"])}) if ObjectId.is_valid(it.ref) else None
        if not c or c.get("listed"): raise HTTPException(400, "That fish isn't in your keepnet")
        return {"kind": "fish", "id": str(c["_id"]), "name": c["name"], "rarity": c["rarity"], "species_id": c["species_id"], "weight": c["weight"],
                "length_cm": c.get("length_cm"), "variant": c.get("variant", "normal"), "value": c.get("value"), "water": WATER_BY_KEY.get(c.get("water"), {}).get("name")}
    if it.kind == "gear":
        g = GEAR_BY_ID.get(it.ref)
        if not g or it.ref not in user.get("owned_gear", []): raise HTTPException(400, "You don't own that tackle")
        if it.copy_idx is not None:
            copies = (user.get("spare_copies") or {}).get(it.ref) or []
            if it.copy_idx >= len(copies): raise HTTPException(400, "You don't own that copy")
            enh, dur = copies[it.copy_idx].get("enhance", 0), copies[it.copy_idx].get("durability", MAX_DURABILITY)
        else:
            enh, dur = (user.get("enhance") or {}).get(it.ref, 0), (user.get("durability") or {}).get(it.ref, MAX_DURABILITY)
        rar = g.get("crate_rarity") or ("rare" if g.get("rare") else "common")
        return {"kind": "gear", "id": it.ref, "name": g["name"], "rarity": rar, "tier": g["tier"], "enhance": enh, "durability": dur, "slot": it.ref.split("_")[0],
                **{k: g[k] for k in ("power", "control", "recovery", "tolerance", "perk", "level") if g.get(k) is not None}, "price": g.get("price") or None}
    items = user.get("items") or {}
    if it.ref.startswith("crate_"):
        from crates import CRATES
        c = CRATES.get(it.ref)
        if not c or items.get(it.ref, 0) < 1: raise HTTPException(400, "You don't have that crate")
        return {"kind": "item", "id": it.ref, "name": c["name"], "rarity": c["rarity"], "qty": items[it.ref], "desc": c.get("desc")}
    if it.ref in ("potion_energy", "pass_week", "pass_month"):
        if items.get(it.ref, 0) < 1: raise HTTPException(400, "You don't have that")
        names = {"potion_energy": ("Energy Potion", f"+{POTION_ENERGY} energy at once"), "pass_week": ("Angler Pass (7 days)", "Seven days of Angler Pass perks"), "pass_month": ("Angler Pass (30 days)", "Thirty days of Angler Pass perks")}
        return {"kind": "item", "id": it.ref, "name": names[it.ref][0], "rarity": "rare" if it.ref != "potion_energy" else "uncommon", "qty": items[it.ref], "desc": names[it.ref][1]}
    if it.ref == "scrap":
        if (user.get("scrap") or 0) < 1: raise HTTPException(400, "You don't have any Tackle Scrap")
        return {"kind": "item", "id": "scrap", "name": "Tackle Scrap", "rarity": "common", "qty": user["scrap"], "desc": "Used to enhance tackle"}
    if it.ref in BAIT_BY_ID:
        b = BAIT_BY_ID[it.ref]
        if (user.get("bait") or {}).get(it.ref, 0) < 1: raise HTTPException(400, "You don't have that bait")
        return {"kind": "item", "id": it.ref, "name": b["name"], "rarity": "rare" if b.get("crafted") else "common", "qty": user["bait"][it.ref],
                "desc": f"+{b.get('luck', 0)} luck · +{b.get('bite', 0)}% bite" + (" · crafted" if b.get("crafted") else "")}
    if it.ref in ING_BY_ID:
        i = ING_BY_ID[it.ref]
        if (user.get("ingredients") or {}).get(it.ref, 0) < 1: raise HTTPException(400, "You don't have that ingredient")
        return {"kind": "item", "id": it.ref, "name": i["name"], "rarity": "common", "qty": user["ingredients"][it.ref], "desc": "Bait crafting ingredient"}
    raise HTTPException(400, "That can't be linked")


_CHAT_RECENT: dict = {}   # uid -> [(ts, text_norm)], last ~60 s
_CHAT_STRIKES: dict = {}  # uid -> [strike_ts]
SPAM_TIMEOUTS = (30, 120, 600)  # escalating pause in seconds within one hour


def chat_spam_check(user, text):
    """Light in-process anti-spam: >5 messages in 10 s or the same line 3× in 60 s earns a short, escalating timeout (stored as a mute)."""
    if is_admin_user(user): return None
    uid = str(user["_id"]); t = time.monotonic()
    recent = [r for r in _CHAT_RECENT.get(uid, []) if t - r[0] < 60]
    norm = " ".join(text.lower().split())
    recent.append((t, norm)); _CHAT_RECENT[uid] = recent
    burst = sum(1 for r in recent if t - r[0] < 10) > 5
    repeat = sum(1 for r in recent if r[1] == norm) >= 3
    if not (burst or repeat): return None
    strikes = [s for s in _CHAT_STRIKES.get(uid, []) if t - s < 3600] + [t]
    _CHAT_STRIKES[uid] = strikes; _CHAT_RECENT[uid] = []
    return SPAM_TIMEOUTS[min(len(strikes), len(SPAM_TIMEOUTS)) - 1]


@api.post("/chat/{channel}")
async def chat_post(channel: str, body: ChatIn, user=Depends(get_current_user)):
    flt = chat_filter(channel, user)
    m = mute_active(user)
    if m:
        until = f" until {m['until'][:16].replace('T', ' ')} UTC" if m.get("until") else " permanently"
        raise HTTPException(403, f"You are muted{until}. {m.get('reason') or ''}".strip())
    level, _ = level_from_xp(user["xp"])
    text = body.text.strip()
    if not text and not body.item: raise HTTPException(400, "Say something first")
    item = await chat_item_snapshot(user, body.item) if body.item else None
    if flt["channel"] in ("global", "trade") and not (is_admin_user(user) or is_mod_user(user)) and await moderation.slow_mode_active():
        last = await db.chat.find_one({"channel": {"$in": ["global", "trade"]}, "at": {"$gt": iso(now() - timedelta(seconds=moderation.SLOW_SECONDS))}, "username": user["username"]})
        if last: raise HTTPException(429, f"Slow mode is on: one message every {moderation.SLOW_SECONDS} seconds.")
    pause = chat_spam_check(user, text + (f" [{item['name']}]" if item else ""))
    if pause:
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"mute": {"until": iso(now() + timedelta(seconds=pause)), "reason": "Auto: chat spam", "by": "system", "at": iso(now())}}})
        raise HTTPException(429, f"Slow down, you're posting too fast. Chat is paused for {pause // 60} min." if pause >= 60 else f"Slow down, you're posting too fast. Chat is paused for {pause} s.")
    # Dedupe key: same angler, same channel, same text within a 3s window collapses to one message (unique sparse index on dk).
    dk = f"{user['_id']}|{flt.get('channel')}|{flt.get('crew_id', '')}|{int(now().timestamp() // 3)}|{hashlib.sha1((text + (item or {}).get('id', '')).encode()).hexdigest()[:16]}"
    msg = {**flt, "username": user["username"], "level": level, "text": text, "at": iso(now()), "tag": (user.get("crew") or {}).get("tag"), "tag_colour": (user.get("crew") or {}).get("colour"), "colour": colour_hex(user), "admin": is_admin_user(user), "mod": is_mod_user(user), "dk": dk}
    if item: msg["item"] = item
    try:
        await db.chat.insert_one(msg)
    except DuplicateKeyError:
        msg = await db.chat.find_one({"dk": dk})
    ev_win = await random_events.on_chat(user, flt.get("channel"), text) if not item else None
    return {**chat_out(msg, user), **({"event_win": ev_win} if ev_win else {})}


_TTL = {}
_INFLIGHT = {}


async def cached(key, ttl, fn):
    """Tiny in-process TTL cache for read-heavy views polled by many players. Concurrent misses share one DB round-trip."""
    hit = _TTL.get(key)
    if hit and hit[0] > time.monotonic(): return hit[1]
    task = _INFLIGHT.get(key)
    if task is None:
        task = _INFLIGHT[key] = asyncio.ensure_future(fn())
        try:
            val = await asyncio.shield(task)
            _TTL[key] = (time.monotonic() + ttl, val)
            return val
        finally:
            _INFLIGHT.pop(key, None)
    return await asyncio.shield(task)


def uncache(*keys):
    for k in keys: _TTL.pop(k, None)


@api.get("/leaderboards")
async def leaderboards():
    return await cached("leaderboards", 30, _leaderboards)


async def _leaderboards():
    async def top(sort_field, proj):
        rows = await db.users.find({}, {"username": 1, "xp": 1, "gold": 1, "stats": 1, "avatar": 1, "frame": 1}).sort(sort_field, -1).limit(15).to_list(15)
        return [{"username": r["username"], "level": level_from_xp(r["xp"])[0], "value": proj(r), "avatar": look_of(r.get("avatar")), "frame": r.get("frame")} for r in rows]

    # Top Mentors: anglers who brought in the most recruits (guests and same-network signups excluded).
    mentor_rows = await db.users.aggregate([
        {"$match": {"referred_by": {"$exists": True, "$ne": None}, "is_guest": {"$ne": True}, "referral_flag": {"$ne": "same_network"}}},
        {"$group": {"_id": "$referred_by", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]).to_list(15)
    mentors = []
    for row in mentor_rows:
        try:
            rec = await db.users.find_one({"_id": ObjectId(row["_id"])}, {"username": 1, "xp": 1, "stats": 1, "avatar": 1, "frame": 1})
        except Exception:
            rec = None
        if not rec:
            continue
        mentors.append({"username": rec["username"], "level": level_from_xp(rec["xp"])[0], "value": row["count"],
                        "completed": rec.get("stats", {}).get("recruits_completed", 0),
                        "avatar": look_of(rec.get("avatar")), "frame": rec.get("frame")})

    return {
        "wealth": await top("gold", lambda r: r["gold"]),
        "level": await top("xp", lambda r: r["xp"]),
        "collection": await top("stats.species", lambda r: r["stats"].get("species", 0)),
        "heaviest": [
            {"username": r["username"], "level": level_from_xp(r["xp"])[0], "value": r["stats"].get("heaviest_kg", 0), "name": r["stats"].get("heaviest_name"),
             "avatar": look_of(r.get("avatar")), "frame": r.get("frame")}
            for r in await db.users.find({"stats.heaviest_kg": {"$gt": 0}}, {"username": 1, "xp": 1, "stats": 1, "avatar": 1, "frame": 1}).sort("stats.heaviest_kg", -1).limit(15).to_list(15)],
        "catches": await top("stats.catches", lambda r: r["stats"].get("catches", 0)),
        "mastery": await top("stats.mastery_total", lambda r: r["stats"].get("mastery_total", 0)),
        "duels": [{"username": r["username"], "level": level_from_xp(r["xp"])[0], "value": r["duel"].get("wins", 0), "name": f"{r['duel'].get('losses', 0)} lost · best streak {r['duel'].get('best_streak', 0)}",
                   "avatar": look_of(r.get("avatar")), "frame": r.get("frame")}
                  for r in await db.users.find({"duel.wins": {"$gt": 0}}, {"username": 1, "xp": 1, "duel": 1, "avatar": 1, "frame": 1}).sort([("duel.wins", -1), ("duel.best_streak", -1)]).limit(15).to_list(15)],
        "tournaments": [r for r in await top("stats.tournament_wins", lambda r: r["stats"].get("tournament_wins", 0)) if r["value"] > 0],
        "mentors": mentors,
    }


@api.get("/health")
async def health():
    return {"ok": True, "at": iso(now())}


@api.get("/players/online")
async def online_players():
    return await cached("players_online", 10, _online_players)


async def _online_players():
    rows = await db.users.find({"last_seen": {"$gte": online_cutoff()}}, {"username": 1, "xp": 1, "water": 1, "avatar": 1, "frame": 1}).limit(50).to_list(50)
    return [{"username": r["username"], "level": level_from_xp(r["xp"])[0], "water": r["water"], "avatar": look_of(r.get("avatar")), "frame": r.get("frame")} for r in rows]


@api.get("/players")
async def players_list(q: str = "", sort: str = "level", online: bool = False, page: int = 0, user=Depends(get_current_user)):
    """Directory of anglers: search by name, sort by level / recently seen / catches. Guests who never claimed are hidden."""
    per = 40
    flt = {"is_guest": {"$ne": True}, "banned": {"$ne": True}}
    if q.strip(): flt["username_lc"] = {"$regex": re.escape(q.strip().lower())}
    if online: flt["last_seen"] = {"$gte": online_cutoff()}
    order = [("last_seen", -1)] if sort == "seen" else [("stats.catches", -1)] if sort == "catches" else [("xp", -1)]
    total = await db.users.count_documents(flt)
    rows = await db.users.find(flt, {"username": 1, "xp": 1, "water": 1, "avatar": 1, "frame": 1, "active_title": 1, "titles": 1, "crew": 1, "last_seen": 1, "stats": 1, "created_at": 1, "supporter": 1, "is_admin": 1, "role": 1, "premium_until": 1}) \
        .sort(order).skip(max(0, page) * per).limit(per).to_list(per)
    cut = online_cutoff()
    return {"total": total, "page": page, "per": per, "players": [
        {"username": r["username"], "level": level_from_xp(r["xp"])[0], "water": r.get("water"), "avatar": look_of(r.get("avatar")), "frame": r.get("frame"),
         "title": title_for(level_from_xp(r["xp"])[0], r.get("stats") or {}, r.get("active_title"), bool(r.get("is_admin"))), "tag": (r.get("crew") or {}).get("tag"), "tag_colour": (r.get("crew") or {}).get("colour"), "online": (r.get("last_seen") or "") >= cut, "last_seen": r.get("last_seen"),
         "catches": (r.get("stats") or {}).get("catches", 0), "joined": r.get("created_at"), "supporter": bool(r.get("supporter")), "premium": premium_active(r), "admin": bool(r.get("is_admin")), "mod": r.get("role") == "mod"} for r in rows]}


@api.get("/players/{username}")
async def player_profile(username: str):
    u = await db.users.find_one({"username_lc": username.lower()})
    if not u: raise HTTPException(404, "No such angler")
    recent = await db.catches.find({"user_id": str(u["_id"]), "mounted": {"$ne": True}}).sort("caught_at", -1).limit(10).to_list(10)
    trophies = await db.catches.find({"user_id": str(u["_id"]), "mounted": True}).sort("mounted_at", 1).to_list(MAX_TROPHIES)
    boss_trophies = await db.boss_kills.find({"user_id": str(u["_id"]), "mounted": True}).sort("mounted_at", 1).to_list(MAX_BOSS_MOUNTS)
    podiums = await db.tournaments.find({"status": "closed", "results": {"$elemMatch": {"user_id": str(u["_id"]), "place": {"$lte": 3}}}}).sort("end", -1).limit(20).to_list(20)
    level, _ = level_from_xp(u["xp"])
    have_ach = set(u.get("achievements", []))
    return {"username": u["username"], "level": level, "duel": {k: (u.get("duel") or {}).get(k, 0) for k in ("wins", "losses", "draws", "best_streak")},
            "badges": [{"id": b, "name": ACH_BY_ID[b]["name"], "desc": ACH_BY_ID[b]["desc"], "tier": ach_tier(ACH_BY_ID[b]["reward"])} for b in (u.get("badges") or []) if b in ACH_BY_ID and b in have_ach],
            "title": title_for(level, u["stats"], u.get("active_title"), is_admin_user(u)), "is_admin": is_admin_user(u), "is_mod": is_mod_user(u) and not is_admin_user(u), "supporter": bool(u.get("supporter")), "premium": premium_active(u), "stats": u["stats"], "water": u["water"],
            "avatar": look_of(u.get("avatar")), "avatar_name": None,
            "name_colour_hex": colour_hex(u), "frame": u.get("frame"), "rod_skin": u.get("rod_skin"),
            "pearls": u.get("pearls", 0), "durability": {slot: gear_dur(u, gid) for slot, gid in u["gear"].items()},
            "crew": u.get("crew"), "achievements": len(u.get("achievements", [])),
            "unlocked_waters": len(u["unlocked_waters"]), "gear": u["gear"], "enhance": {slot: int((u.get("enhance") or {}).get(gid, 0)) for slot, gid in u["gear"].items()}, "created_at": u["created_at"], "last_seen": u["last_seen"],
            "recent": [catch_out(c) for c in recent], "trophies": [catch_out(c) for c in trophies],
            "boss_trophies": [boss_kill_out(k) for k in boss_trophies], "max_boss_mounts": MAX_BOSS_MOUNTS,
            "contest_wins": [{"kind": "tournament", "category": c["category"], "label": TOURNAMENT_LABEL.get(c["category"], c["category"]), "unit": TOURNAMENT_UNIT.get(c["category"], ""), "end": c["end"], "currency": c["currency"],
                              **{k: r[k] for r in c["results"] if r["user_id"] == str(u["_id"]) for k in ("value", "place", "reward", "bonus")}} for c in podiums]}


# ---------- Contests ----------
def period_bounds(kind, t):
    day = t.replace(hour=0, minute=0, second=0, microsecond=0)
    if kind == "daily":
        return day, day + timedelta(days=1)
    start = day - timedelta(days=t.weekday())
    return start, start + timedelta(days=7)


def contest_categories(kind, start):
    """Deterministic rotation so every angler sees the same pair; changes every period."""
    idx = int((start - datetime(2024, 1, 1, tzinfo=timezone.utc)).total_seconds() // 86400)
    if kind == "weekly":
        idx //= 7
        return [CONTEST_POOL[(idx + 1) % len(CONTEST_POOL)], CONTEST_POOL[(idx + 5) % len(CONTEST_POOL)]]
    return [CONTEST_POOL[idx % len(CONTEST_POOL)], CONTEST_POOL[(idx + 3) % len(CONTEST_POOL)]]


def crew_contest_category(start):
    idx = int((start - datetime(2024, 1, 1, tzinfo=timezone.utc)).total_seconds() // 86400) // 7
    return CREW_CONTEST_POOL[idx % len(CREW_CONTEST_POOL)]


def contest_kind_key(c):
    return "crew" if c["category"].startswith("crew") else c["kind"]


def contest_value_stage(category):
    """Aggregation $group value expression per solo/crew category (after grouping by owner)."""
    cat = category.replace("crew_", "") if category.startswith("crew_") else ("weight" if category == "crew" else category)
    if cat == "heaviest": return {"$max": "$weight"}
    if cat == "catches": return {"$sum": 1}
    if cat == "weight": return {"$sum": "$weight"}
    if cat == "rarity": return {"$sum": {"$switch": {"branches": [{"case": {"$eq": ["$rarity", r]}, "then": p} for r, p in RARITY_POINTS.items()], "default": 1}}}
    if cat == "variants": return {"$sum": {"$cond": [{"$ne": ["$variant", "normal"]}, 1, 0]}}
    if cat == "legendary": return {"$sum": {"$cond": [{"$in": ["$rarity", ["legendary", "mythic"]]}, 1, 0]}}
    return None  # species: handled with a two-stage group


async def contest_standings(category, start_iso, end_iso, limit=10):
    if category.startswith("crew"):
        return await crew_standings(start_iso, end_iso, limit, category)
    rows = await db.catch_log.aggregate(_contest_pipe(category, start_iso, end_iso) + [{"$sort": {"value": -1, "username": 1}}, {"$limit": limit}]).to_list(limit)
    # Attach avatar/frame from the users collection so contest pages show portraits like everywhere else.
    ids = [r["_id"] for r in rows if r.get("_id")]
    looks = {}
    if ids:
        try:
            oids = [ObjectId(i) for i in ids]
            async for u in db.users.find({"_id": {"$in": oids}}, {"avatar": 1, "frame": 1}):
                looks[str(u["_id"])] = {"avatar": look_of(u.get("avatar")), "frame": u.get("frame")}
        except Exception:
            pass
    return [{"user_id": r["_id"], "username": r["username"], "value": round(r["value"], 2) if isinstance(r["value"], float) else r["value"], "name": r.get("name"), "rarity": r.get("rarity"),
             **looks.get(r["_id"], {"avatar": STARTER_AVATARS[0], "frame": None})} for r in rows]


def _contest_pipe(category, start_iso, end_iso):
    pipe = [{"$match": {"caught_at": {"$gte": start_iso, "$lt": end_iso}}},
            {"$addFields": {"who": {"$ifNull": ["$caught_by", "$user_id"]}, "who_name": {"$ifNull": ["$caught_by_name", "$username"]}}}]
    if category == "heaviest":
        pipe += [{"$sort": {"weight": -1}},
                 {"$group": {"_id": "$who", "username": {"$first": "$who_name"}, "value": {"$first": "$weight"}, "name": {"$first": "$name"}, "rarity": {"$first": "$rarity"}}}]
    elif category == "species":
        pipe += [{"$group": {"_id": {"u": "$who", "s": "$species_id"}, "username": {"$first": "$who_name"}}},
                 {"$group": {"_id": "$_id.u", "username": {"$first": "$username"}, "value": {"$sum": 1}}}]
    else:
        pipe += [{"$group": {"_id": "$who", "username": {"$first": "$who_name"}, "value": contest_value_stage(category)}}]
        if category != "weight": pipe += [{"$match": {"value": {"$gt": 0}}}]
    return pipe


async def close_contest(c):
    standings = await contest_standings(c["category"], c["start"], c["end"], 3)
    kk = contest_kind_key(c)
    winners = []
    label = CONTEST_LABEL[c["category"]]
    for i, s in enumerate(standings):
        prize, pearls = CONTEST_PRIZES[kk][i], CONTEST_PEARLS[kk][i]
        unit = CONTEST_UNIT[c["category"]]
        place = PLACE_LABEL[i + 1]
        if kk == "crew":
            crew = await db.crews.find_one({"_id": ObjectId(s["crew_id"])})
            if crew and crew["members"]:
                each = max(50, prize // len(crew["members"]))
                await db.users.update_many({"_id": {"$in": [ObjectId(m["user_id"]) for m in crew["members"]]}},
                                           {"$inc": {"gold": each, "stats.gold_earned": each, "pearls": pearls, "stats.pearls_earned": pearls}})
                if i == 0:
                    await db.crews.update_one({"_id": crew["_id"]}, {"$inc": {"wins": 1}})
                    await add_feed("contest", crew["name"], f"Crew [{crew['tag']}] {crew['name']} won the weekly {label} challenge with {s['value']} {unit}.", "legendary")
                msg = (f"Your crew [{crew['tag']}] {crew['name']} took {place} place in the weekly {label} crew challenge "
                       f"with {s['value']} {unit}. Every member pockets {each} gold and {pearls} Pearls.")
                for m in crew["members"]:
                    await send_system_message(m["user_id"], m["username"], msg)
            winners.append({**s, "prize": prize, "place": i + 1, "pearls": pearls})
            continue
        upd = {"$inc": {"gold": prize, "stats.gold_earned": prize, "stats.contest_wins": 1 if i == 0 else 0, "pearls": pearls, "stats.pearls_earned": pearls}}
        title = WEEKLY_CHAMPION_TITLE if (c["kind"] == "weekly" and i == 0) else None
        if title: upd["$addToSet"] = {"titles": title}
        await db.users.update_one({"_id": ObjectId(s["user_id"])}, upd)
        winners.append({**s, "prize": prize, "place": i + 1, "pearls": pearls, "title": title})
        title_line = f" You keep the title \"{title}\"." if title else ""
        await send_system_message(s["user_id"], s["username"],
            f"Congratulations! You took {place} place in the {c['kind']} {label} contest with {s['value']} {unit}. "
            f"Reward: {prize} gold and {pearls} Pearls.{title_line}")
        if i == 0:
            await add_feed("contest", s["username"], f"{s['username']} won the {c['kind']} {label} contest with {s['value']} {unit}, taking {prize} gold and {pearls} Pearls.", "legendary")
            await check_achievements(ObjectId(s["user_id"]))
    await db.contests.update_one({"_id": c["_id"]}, {"$set": {"status": "closed", "winners": winners, "end": c["end"]}})
    if kk == "crew":
        from crates import crew_contest_crates
        await crew_contest_crates(standings, c["start"], c["end"], label)


async def ensure_contests():
    t = now()
    for c in await db.contests.find({"status": "open", "end": {"$lte": iso(t)}}).to_list(50):
        await close_contest(c)
    # Solo daily/weekly contests were replaced by buy-in tournaments (tournaments.py); only the weekly crew challenge remains here.
    for kind in ("weekly",):
        start, end = period_bounds(kind, t)
        cats = [crew_contest_category(start)]
        # Contests from before the rotation existed close early so the board only shows this period's draw.
        for c in await db.contests.find({"status": "open", "category": {"$nin": cats}}).to_list(20):
            await close_contest({**c, "end": min(c["end"], iso(t))})
        for cat in cats:
            if not await db.contests.find_one({"kind": kind, "category": cat, "start": iso(start)}):
                await db.contests.insert_one({"kind": kind, "category": cat, "start": iso(start), "end": iso(end), "status": "open", "winners": []})


def contest_meta(c):
    kk = contest_kind_key(c)
    return {"id": str(c["_id"]), "kind": c["kind"], "category": c["category"], "label": CONTEST_LABEL[c["category"]], "desc": CONTEST_DESC[c["category"]],
            "unit": CONTEST_UNIT[c["category"]], "prizes": CONTEST_PRIZES[kk], "pearls": CONTEST_PEARLS[kk],
            "title": WEEKLY_CHAMPION_TITLE if (c["kind"] == "weekly" and kk != "crew") else None}


@api.get("/contests")
async def contests(user=Depends(get_current_user)):
    await ensure_contests()
    open_ = await db.contests.find({"status": "open"}).to_list(10)
    current = [{**contest_meta(c), "start": c["start"], "end": c["end"],
                "standings": await cached(f"contest:{c['category']}:{c['start']}", 15, lambda c=c: contest_standings(c["category"], c["start"], c["end"]))} for c in open_]
    current.sort(key=lambda c: (c["kind"] != "daily", c["category"]))
    t = now()
    _, end = period_bounds("weekly", t)
    upcoming = [{"kind": "weekly", "category": crew_contest_category(end), "label": CONTEST_LABEL[crew_contest_category(end)], "start": iso(end)}]
    past = await db.contests.find({"status": "closed"}).sort("end", -1).limit(12).to_list(12)
    return {"current": current, "upcoming": upcoming, "past": [{**contest_meta(c), "end": c["end"], "winners": c["winners"]} for c in past]}


# ---------- Admin ----------
class GrantIn(BaseModel):
    username: str
    gold: int = 0
    xp: int = 0
    pearls: int = 0
    level: Optional[int] = Field(default=None, ge=1, le=MAX_LEVEL)
    energy: Optional[int] = Field(default=None, ge=0, le=PREMIUM_MAX_ENERGY * ENERGY_BANK_MULT)
    bait_id: Optional[str] = None
    bait_qty: int = Field(default=0, ge=0, le=10000)
    gear_id: Optional[str] = None
    water: Optional[str] = None
    pass_days: Optional[int] = None
    pass_items: Optional[int] = None
    species_id: Optional[int] = None
    weight: Optional[float] = None
    variant: str = "normal"
    crate_id: Optional[str] = None
    crate_qty: int = Field(default=0, ge=-100, le=100)


@api.get("/admin/players")
async def admin_players(q: str = "", admin=Depends(require_admin)):
    flt = {"username_lc": {"$regex": re.escape(q.lower())}} if q else {}
    rows = await db.users.find(flt, {"password_hash": 0}).sort("last_seen", -1).limit(30).to_list(30)
    return [admin_user_view(r) for r in rows]


def admin_user_view(u):
    ips = []
    for e in reversed(u.get("ip_log") or []):
        if e.get("ip") and e["ip"] not in ips: ips.append(e["ip"])
    return {**public_user(u), "banned": u.get("banned"), "mute": mute_active(u), "role": u.get("role"), "last_seen": u.get("last_seen"), "supporter": bool(u.get("supporter")), "source": u.get("acq_source") or "unknown",
            "last_ip": u.get("last_ip"), "last_ip_at": u.get("last_ip_at"), "recent_ips": ips[:10]}


@api.post("/admin/grant")
async def admin_grant(body: GrantIn, admin=Depends(require_admin)):
    u = await db.users.find_one({"username_lc": body.username.lower()})
    if not u: raise HTTPException(404, "No such angler")
    inc, sets, push, log = {}, {}, {}, []
    if body.gold: g = max(body.gold, -u.get("gold", 0)); inc["gold"] = g; log.append(f"{g:+,} gold")
    if body.pearls: p = max(body.pearls, -u.get("pearls", 0)); inc["pearls"] = p; log.append(f"{p:+} pearls")
    if body.crate_id and body.crate_qty:
        from crates import CRATES
        if body.crate_id not in CRATES: raise HTTPException(400, "Unknown crate")
        q = max(body.crate_qty, -int((u.get("items") or {}).get(body.crate_id, 0)))
        if q: inc[f"items.{body.crate_id}"] = q; log.append(f"{q:+} {CRATES[body.crate_id]['name']}")
        if q > 0: await send_system_message(str(u["_id"]), u["username"], f"You received {q}× {CRATES[body.crate_id]['name']} from the Harbourmaster! Open it from Inventory, Crates & more.")
    if body.xp: inc["xp"] = body.xp; log.append(f"{body.xp:+} xp")
    if body.level: sets["xp"] = sum(xp_for_level(l) for l in range(1, body.level)); log.append(f"level set to {body.level}")
    if body.energy is not None: sets["energy"] = body.energy; sets["energy_at"] = iso(now()); log.append(f"energy {body.energy}")
    if body.bait_id and body.bait_qty:
        if body.bait_id not in BAIT_BY_ID: raise HTTPException(400, "Unknown bait")
        inc[f"bait.{body.bait_id}"] = body.bait_qty; log.append(f"+{body.bait_qty} {BAIT_BY_ID[body.bait_id]['name']}")
    if body.gear_id:
        if body.gear_id not in GEAR_BY_ID: raise HTTPException(400, "Unknown gear")
        if body.gear_id not in u["owned_gear"]: push["owned_gear"] = body.gear_id
        sets[f"gear.{body.gear_id.split('_')[0]}"] = body.gear_id; sets[f"durability.{body.gear_id}"] = MAX_DURABILITY; log.append(GEAR_BY_ID[body.gear_id]["name"])
    if body.pass_days:
        from premium import extend_until
        base = extend_until(u, body.pass_days) if body.pass_days > 0 else iso(datetime.fromisoformat(u["premium_until"]) + timedelta(days=body.pass_days)) if u.get("premium_until") else None
        if base: sets["premium_until"] = base; log.append(f"{body.pass_days:+} Angler Pass days (until {base[:10]})")
    if body.pass_items: inc["items.pass_month"] = body.pass_items; log.append(f"{body.pass_items:+} Angler Pass · Month item(s)")
    if body.water:
        if body.water not in WATER_BY_KEY: raise HTTPException(400, "Unknown water")
        if body.water not in u["unlocked_waters"]: push["unlocked_waters"] = body.water
        log.append(f"unlocked {WATER_BY_KEY[body.water]['name']}")
    if "xp" in inc and "xp" in sets: inc.pop("xp")
    upd = {k: v for k, v in (("$inc", inc), ("$set", sets), ("$push", push)) if v}
    if upd: await db.users.update_one({"_id": u["_id"]}, upd)
    if body.species_id:
        f = FISH_BY_ID.get(body.species_id)
        if not f: raise HTTPException(400, "Unknown species")
        weight = body.weight if body.weight else roll_weight(f)
        vmult = next((m for n, _, m in VARIANTS if n == body.variant), 1.0)
        catch = {"user_id": str(u["_id"]), "username": u["username"], "species_id": f["id"], "name": f["name"], "rarity": f["rarity"], "weight": weight,
                 "length_cm": round(weight ** (1 / 3) * 38, 1), "variant": body.variant, "value": fish_value(f, weight, vmult), "water": f["water"],
                 "caught_at": iso(now()), "listed": False, "mounted": False, "caught_by": str(u["_id"]), "caught_by_name": u["username"], "admin_granted": True}
        await db.catches.insert_one(catch)
        await db.catch_log.insert_one(catch_ledger(catch))
        j = await db.journal.find_one({"user_id": str(u["_id"]), "species_id": f["id"]})
        if not j:
            await db.journal.insert_one({"user_id": str(u["_id"]), "species_id": f["id"], "count": 1, "best_kg": weight, "first_at": iso(now()), "variants": [body.variant]})
            await db.users.update_one({"_id": u["_id"]}, {"$inc": {"stats.species": 1}})
        else:
            await db.journal.update_one({"_id": j["_id"]}, {"$inc": {"count": 1}, "$max": {"best_kg": weight}, "$addToSet": {"variants": body.variant}})
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"stats.catches": 1}})
        if weight > u["stats"].get("heaviest_kg", 0):
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"stats.heaviest_kg": weight, "stats.heaviest_name": f["name"]}})
        log.append(f"granted {f['name']} {weight} kg")
    await db.admin_log.insert_one({"admin": admin["username"], "target": u["username"], "changes": log, "at": iso(now())})
    return {"changes": log, "user": public_user(await db.users.find_one({"_id": u["_id"]}))}


@api.get("/admin/log")
async def admin_log(admin=Depends(require_admin)):
    return await db.admin_log.find({}, {"_id": 0}).sort("at", -1).limit(50).to_list(50)


@api.get("/catches/recent")
async def recent_catches():
    rows = await db.catches.find({"rarity": {"$in": ["rare", "epic", "legendary", "mythic"]}}).sort("caught_at", -1).limit(20).to_list(20)
    return [catch_out(c) for c in rows]


# ---------- Achievements ----------
def _ach(id_, name, desc, reward, title, cond):
    return {"id": id_, "name": name, "desc": desc, "reward": reward, "title": title, "cond": cond}


ACHIEVEMENTS = [
    _ach("first_catch", "First Blood", "Land your first fish.", 25, None, lambda c: c["catches"] >= 1),
    _ach("secret_1", "Well-Kept Secret", "Land one of the three secret catches.", 2500, None, lambda c: c["secret_species"] >= 1),
    _ach("secret_all", "Keeper of Secrets", "Land all three secret catches.", 15000, SECRET_TITLE, lambda c: c["secret_species"] >= 3),
    _ach("catches_100", "Hundred Hooks", "Land 100 fish.", 300, None, lambda c: c["catches"] >= 100),
    _ach("catches_1000", "Thousand Tides", "Land 1,000 fish.", 3000, "Old Hand", lambda c: c["catches"] >= 1000),
    _ach("species_10", "Curious Angler", "Discover 10 species.", 100, None, lambda c: c["species"] >= 10),
    _ach("species_50", "Naturalist", "Discover 50 species.", 800, "Naturalist", lambda c: c["species"] >= 50),
    _ach("species_100", "Collector", "Discover 100 species.", 3000, "Collector", lambda c: c["species"] >= 100),
    _ach("species_200", "Archivist", "Discover 200 species.", 10000, "Archivist", lambda c: c["species"] >= 200),
    _ach("species_all", "The Complete Journal", "Discover every species in FishyLand.", 100000, "Keeper of the Journal", lambda c: c["species"] >= len(FISH)),
    _ach("first_rare", "Something Special", "Discover a rare species.", 100, None, lambda c: c["rare"] >= 1),
    _ach("contracts_10", "Reliable Hands", "Fill 10 harbour contracts.", 400, None, lambda c: c["contracts"] >= 10),
    _ach("contracts_50", "Contractor", "Fill 50 harbour contracts.", 2500, "Contractor", lambda c: c["contracts"] >= 50),
    _ach("old_friend", "Friend of the Harbour", "Become an Old Friend of one of the dockside patrons.", 5000, None, lambda c: c["old_friends"] >= 1),
    _ach("old_friend_all", "Everybody's Favourite", "Become an Old Friend of all four patrons.", 25000, "Pillar of the Harbour", lambda c: c["old_friends"] >= 4),
    _ach("first_epic", "Tall Tale", "Discover an epic species.", 500, None, lambda c: c["epic"] >= 1),
    _ach("first_legendary", "Legend Hunter", "Land a legendary fish.", 2500, "Legend Hunter", lambda c: c["legendary"] >= 1),
    _ach("legendary_5", "Living Legend", "Land five legendary fish.", 15000, "Living Legend", lambda c: c["legendary"] >= 5),
    _ach("legendary_all", "Legend Collector", "Discover every legendary species.", 30000, "Legend Collector", lambda c: c["legendary_species"] >= c["legendary_total"]),
    _ach("first_mythic", "Myth Made Flesh", "Land a mythic fish.", 5000, "Mythbreaker", lambda c: c["mythic"] >= 1),
    _ach("mythic_all", "Keeper of Myths", "Discover every mythic species.", 50000, "Keeper of Myths", lambda c: c["mythic_species"] >= c["mythic_total"]),
    _ach("heavy_10", "Heavy Hands", "Land a fish over 10 kg.", 100, None, lambda c: c["heaviest"] >= 10),
    _ach("heavy_100", "Giant Slayer", "Land a fish over 100 kg.", 2000, "Giant Slayer", lambda c: c["heaviest"] >= 100),
    _ach("heavy_500", "Leviathan Bane", "Land a fish over 500 kg.", 20000, "Leviathan Bane", lambda c: c["heaviest"] >= 500),
    _ach("gold_10k", "Comfortable", "Hold 10,000 gold.", 250, None, lambda c: c["gold"] >= 10000),
    _ach("gold_100k", "Wealthy", "Hold 100,000 gold.", 2500, "Merchant", lambda c: c["gold"] >= 100000),
    _ach("gold_1m", "Tycoon", "Hold 1,000,000 gold.", 25000, "Tycoon", lambda c: c["gold"] >= 1000000),
    _ach("sold_100", "Market Regular", "Sell 100 fish or items.", 500, "Trader", lambda c: c["sold"] >= 100),
    _ach("level_10", "River Warden", "Reach level 10.", 200, None, lambda c: c["level"] >= 10),
    _ach("level_25", "Salt in the Blood", "Reach level 25.", 1500, "Sea Hand", lambda c: c["level"] >= 25),
    _ach("level_50", "Master Angler", "Reach level 50.", 10000, "Master Angler", lambda c: c["level"] >= 50),
    _ach("level_100", "Centurion of the Deep", "Reach level 100.", 50000, "Centurion", lambda c: c["level"] >= 100),
    _ach("level_150", "Tidecaller", "Reach level 150.", 100000, "Tidecaller", lambda c: c["level"] >= 150),
    _ach("level_200", "Fathom Lord", "Reach level 200.", 200000, "Fathom Lord", lambda c: c["level"] >= 200),
    _ach("level_250", "Living Myth", "Reach level 250, the top of the ladder.", 500000, "Living Myth", lambda c: c["level"] >= 250),
    _ach("all_waters", "World Angler", "Unlock every water.", 20000, "World Angler", lambda c: c["waters"] >= len(WATERS)),
    _ach("variant_golden", "Golden Touch", "Land a golden variant.", 1500, "Gilded", lambda c: "golden" in c["variants"]),
    _ach("variant_albino", "Ghost Sighting", "Land an albino variant.", 800, None, lambda c: "albino" in c["variants"]),
    _ach("variant_giant", "Big One", "Land a giant variant.", 500, None, lambda c: "giant" in c["variants"]),
    _ach("contest_win", "Champion", "Win a server contest.", 1000, "Champion", lambda c: c["contest_wins"] >= 1),
    _ach("crew_join", "Crewmate", "Join a crew.", 100, None, lambda c: c["crew"]),
    # --- progression ---
    _ach("catches_10000", "Ten Thousand Casts Remembered", "Land 10,000 fish.", 30000, "Tidebound", lambda c: c["catches"] >= 10000),
    _ach("casts_1000", "Patience", "Cast 1,000 times.", 300, None, lambda c: c["casts"] >= 1000),
    _ach("recycled_100", "Harbour Cleaner", "Recycle 100 pieces of trash into Tackle Scrap.", 500, None, lambda c: c["recycled"] >= 100),
    _ach("enhance_5", "Tempered", "Enhance any piece of tackle to +5.", 1500, None, lambda c: c["enhance_max"] >= 5),
    _ach("enhance_10", "Forged in Salt", "Enhance any piece of tackle to +10.", 15000, "Tacklesmith", lambda c: c["enhance_max"] >= 10),
    _ach("escaped_100", "The Ones That Got Away", "Lose 100 fish. Every angler has stories.", 500, None, lambda c: c["escaped"] >= 100),
    _ach("crafted_100", "Bait Kitchen", "Craft 100 baits.", 800, None, lambda c: c["crafted"] >= 100),
    _ach("crafted_1000", "Master Baiter", "Craft 1,000 baits.", 6000, "Bait Master", lambda c: c["crafted"] >= 1000),
    _ach("quests_100", "Errand Runner", "Complete 100 daily quests.", 1500, None, lambda c: c["quests_done"] >= 100),
    _ach("quests_500", "Harbour Fixture", "Complete 500 daily quests.", 12000, "Fixture", lambda c: c["quests_done"] >= 500),
    _ach("contracts_250", "Contract Baron", "Fill 250 harbour contracts.", 12000, "Contract Baron", lambda c: c["contracts"] >= 250),
    _ach("sold_1000", "Fishmonger", "Sell 1,000 fish or items.", 5000, "Fishmonger", lambda c: c["sold"] >= 1000),
    _ach("gold_earned_10m", "Ten Million", "Earn 10,000,000 gold in total.", 40000, "Magnate", lambda c: c["gold_earned"] >= 10_000_000),
    _ach("gold_10m", "Dragon's Hoard", "Hold 10,000,000 gold at once.", 100000, "Dragon", lambda c: c["gold"] >= 10_000_000),
    _ach("level_75", "Salt-Cured", "Reach level 75.", 25000, "Salt-Cured", lambda c: c["level"] >= 75),
    # --- bosses, duels, crews ---
    _ach("boss_1", "Boss Slayer", "Help land a legendary boss fish.", 1500, None, lambda c: c["boss_kills"] >= 1),
    _ach("boss_25", "Bane of Giants", "Help land 25 boss fish.", 15000, "Bane of Giants", lambda c: c["boss_kills"] >= 25),
    _ach("duel_win_1", "First Blood Drawn", "Win a duel.", 500, None, lambda c: c["duel_wins"] >= 1),
    _ach("duel_win_50", "Duellist", "Win 50 duels.", 10000, "Duellist", lambda c: c["duel_wins"] >= 50),
    _ach("escaped_500", "Butterfingers", "Lose 500 fish. At this point the fish tell stories about you.", 15000, None, lambda c: c["escaped"] >= 500),
    _ach("recruit_1", "Bring a Friend", "Recruit a friend who signs up with your referral link.", 1000, None, lambda c: c["recruits"] >= 1),
    _ach("recruit_5", "Harbour Crier", "Recruit 5 friends.", 10000, None, lambda c: c["recruits"] >= 5),
    _ach("login_30", "Regular at the Docks", "Log in 30 days in a row.", 20000, "Dock Regular", lambda c: c["login_best"] >= 30),
    _ach("duel_draw_1", "Honours Even", "Finish a duel in a draw.", 1000, None, lambda c: c["duel_draws"] >= 1),
    _ach("duel_streak_10", "Untouchable", "Win 10 duels in a row.", 15000, "Untouchable", lambda c: c["duel_best_streak"] >= 10),
    _ach("crew_orders_50", "Crew's Provider", "Fill 50 crew orders.", 5000, "Provider", lambda c: c["crew_orders"] >= 50),
    _ach("old_koi", "The Old Koi", "Land The Old Koi.", 10000, "Koi Whisperer", lambda c: c["old_koi"]),
    # --- mastery & completion (the hard ones) ---
    _ach("mastery_1", "Studied", "Master one species (max mastery).", 1000, None, lambda c: c["masteries"] >= 1),
    _ach("mastery_10", "Scholar of Fins", "Master 10 species.", 8000, "Scholar", lambda c: c["masteries"] >= 10),
    _ach("mastery_50", "Grandmaster Angler", "Master 50 species.", 50000, "Grandmaster", lambda c: c["masteries"] >= 50),
    _ach("mastery_all_water", "Every Fish, Every Time", "Master every species of one water.", 30000, "Warden of the Water", lambda c: c["water_mastered"] >= 1),
    _ach("variants_all", "Four Faces", "Land a giant, an albino, a golden AND a scarred variant.", 3000, None, lambda c: {"giant", "albino", "golden", "scarred"} <= c["variants"]),
    _ach("golden_10", "Midas", "Discover 10 species as golden variants.", 20000, "Midas", lambda c: c["golden_species"] >= 10),
    _ach("legendary_variant", "Gilded Legend", "Land a legendary or mythic fish as a golden or albino variant.", 30000, "Gilded Legend", lambda c: c["legendary_variant"]),
    _ach("heavy_1000", "Kraken's Equal", "Land a fish over 1,000 kg.", 60000, "Kraken's Equal", lambda c: c["heaviest"] >= 1000),
    _ach("all_waters_wildlife", "Warden of the Wild", "Complete the Wildlife achievement of every water.", 150000, "Warden of the Wild", lambda c: len(c["water_variants_complete"]) >= len(WATERS)),
    _ach("secret_all_variants", "Nothing Left to Find", "Every species discovered, every water mastered, all three secrets landed.", 250000, "The Compleat Angler", lambda c: c["species"] >= len(FISH) and c["secret_species"] >= 3 and len(c["water_complete"]) >= len(WATERS)),
    _ach("streak_30", "Thirty Dawns", "Keep a 30-day quest streak.", 5000, "Dawn Patrol", lambda c: c["quest_streak"] >= 30),
    _ach("streak_100", "Hundred Dawns", "Keep a 100-day quest streak.", 40000, "Ever-Present", lambda c: c["quest_streak"] >= 100),
] + [_ach(f"water_{w['key']}", f"Master of {w['name']}", f"Discover every species at {w['name']}.", 2000 + i * 1500, f"Master of {w['name'].replace('The ', '')}",
          (lambda k: lambda c: k in c["water_complete"])(w["key"])) for i, w in enumerate(WATERS)
] + [_ach(f"water_variants_{w['key']}", f"Wildlife of {w['name']}", f"Land every species at {w['name']} as a rare variant (giant, albino, golden or scarred).",
          6000 + i * 3000, f"Wildlife of {w['name'].replace('The ', '')}",
          (lambda k: lambda c: k in c["water_variants_complete"])(w["key"])) for i, w in enumerate(WATERS)]
ACH_BY_ID = {a["id"]: a for a in ACHIEVEMENTS}


async def achievement_context(u):
    rows = await db.journal.find({"user_id": str(u["_id"])}, {"species_id": 1, "variants": 1, "count": 1}).to_list(2000)
    species = {r["species_id"] for r in rows}
    variants = set()
    species_with_variant = set()
    golden_species, legendary_variant, mastered = 0, False, set()
    for r in rows:
        rv = r.get("variants", [])
        variants.update(rv)
        if any(v != "normal" for v in rv):
            species_with_variant.add(r["species_id"])
        if "golden" in rv: golden_species += 1
        f = FISH_BY_ID.get(r["species_id"])
        if f and f["rarity"] in ("legendary", "mythic") and ({"golden", "albino"} & set(rv)): legendary_variant = True
        if f and mastery.level_for(f["rarity"], r.get("count", 0)) >= mastery.MAX_LEVEL: mastered.add(r["species_id"])
    water_mastered = sum(1 for k, fl in WATER_POOL.items() if fl and all(f["id"] in mastered for f in fl))
    per_water = {w["key"]: 0 for w in WATERS}
    per_water_var = {w["key"]: 0 for w in WATERS}
    rar = {"rare": 0, "epic": 0, "legendary": 0, "mythic": 0}
    for sid in species:
        f = FISH_BY_ID.get(sid)
        if f and not f.get("secret") and f["water"] in per_water:  # secret / event catches are bonuses, they never count toward a water's completion
            if f["rarity"] in rar: rar[f["rarity"]] += 1
            per_water[f["water"]] += 1
            if sid in species_with_variant: per_water_var[f["water"]] += 1
    secret_species = sum(1 for sid in species if sid in SECRET_BY_ID)
    complete = {k for k, n in per_water.items() if n >= len(WATER_POOL[k])}
    variants_complete = {k for k, n in per_water_var.items() if n >= len(FISH_BY_WATER[k]) and n > 0}
    s = u["stats"]
    return {"catches": s.get("catches", 0), "species": len(species), "legendary": s.get("legendary", 0), "secret_species": secret_species, "heaviest": s.get("heaviest_kg", 0), "gold": u["gold"],
            "sold": s.get("sold", 0), "level": level_from_xp(u["xp"])[0], "waters": len(u["unlocked_waters"]), "variants": variants, "rare": rar["rare"],
            "epic": rar["epic"], "mythic": s.get("mythic", 0), "legendary_species": rar["legendary"], "mythic_species": rar["mythic"],
            "legendary_total": sum(1 for f in FISH if f["rarity"] == "legendary" and not f.get("secret")), "mythic_total": sum(1 for f in FISH if f["rarity"] == "mythic"),
            "contest_wins": s.get("contest_wins", 0), "crew": bool(u.get("crew")), "contracts": s.get("contracts_done", 0),
            "old_friends": sum(1 for r in (u.get("favour_rank") or {}).values() if r >= 5), "water_complete": complete, "water_variants_complete": variants_complete,
            "casts": s.get("casts", 0), "escaped": s.get("escaped", 0), "crafted": s.get("crafted", 0), "quests_done": s.get("quests_done", 0), "gold_earned": s.get("gold_earned", 0),
            "boss_kills": s.get("boss_kills", 0), "duel_wins": (u.get("duel") or {}).get("wins", 0), "duel_best_streak": (u.get("duel") or {}).get("best_streak", 0), "duel_draws": (u.get("duel") or {}).get("draws", 0),
            "recruits": await db.users.count_documents({"referred_by": str(u["_id"]), "is_guest": {"$ne": True}}), "login_best": (u.get("login_streak") or {}).get("best", 0),
            "crew_orders": s.get("crew_orders", 0), 
            "old_koi": 311 in species, "masteries": len(mastered), "water_mastered": water_mastered, "golden_species": golden_species, "legendary_variant": legendary_variant,
            "quest_streak": (u.get("quest_streak") or {}).get("count", 0),
            "enhance_max": max([0, *((u.get("enhance") or {}).values())]), "recycled": s.get("recycled", 0)}


async def check_achievements(user_id):
    u = await db.users.find_one({"_id": user_id})
    if not u: return []
    have = set(u.get("achievements", []))
    ctx = await achievement_context(u)
    new = [a for a in ACHIEVEMENTS if a["id"] not in have and a["cond"](ctx)]
    if not new: return []
    reward = sum(a["reward"] for a in new)
    titles = [a["title"] for a in new if a["title"]]
    upd = {"$push": {"achievements": {"$each": [a["id"] for a in new]}}, "$inc": {"gold": reward, "stats.gold_earned": reward}}
    if titles:
        upd["$addToSet"] = {"titles": {"$each": titles}}
        upd["$inc"]["pearls"] = TITLE_ACH_PEARLS * len(titles); upd["$inc"]["stats.pearls_earned"] = TITLE_ACH_PEARLS * len(titles)
    await db.users.update_one({"_id": user_id}, upd)
    for a in new:
        if a["title"] or a["reward"] >= 1000:
            await add_feed("achievement", u["username"], f"{u['username']} earned the achievement \"{a['name']}\".", "epic" if a["title"] else "rare")
    return [{"id": a["id"], "name": a["name"], "desc": a["desc"], "reward": a["reward"], "title": a["title"]} for a in new]


class BadgesIn(BaseModel):
    ids: List[str] = Field(default_factory=list, max_length=3)


@api.post("/achievements/badges")
async def set_badges(body: BadgesIn, user=Depends(get_current_user)):
    have = set(user.get("achievements", []))
    ids = list(dict.fromkeys(body.ids))
    if any(i not in have or i not in ACH_BY_ID for i in ids): raise HTTPException(400, "You can only show badges you've earned")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"badges": ids}})
    return {"badges": ids}


def ach_tier(reward):
    return "easy" if reward <= 1000 else "medium" if reward <= 5000 else "hard" if reward <= 20000 else "legendary"


async def touch_login_streak(u):
    """Count consecutive UTC days the angler shows up (for the 30-day achievement)."""
    today = now().strftime("%Y-%m-%d")
    ls = u.get("login_streak") or {}
    if ls.get("last") == today: return
    yesterday = (now() - timedelta(days=1)).strftime("%Y-%m-%d")
    count = ls.get("count", 0) + 1 if ls.get("last") == yesterday else 1
    r = await db.users.update_one({"_id": u["_id"], "login_streak.last": {"$ne": today}},
                                  {"$set": {"login_streak": {"last": today, "count": count, "best": max(count, ls.get("best", 0))}}})
    if r.modified_count and count >= 30: await check_achievements(u["_id"])


@api.get("/achievements")
async def achievements(user=Depends(get_current_user)):
    new = await check_achievements(user["_id"])
    u = await db.users.find_one({"_id": user["_id"]})
    have = set(u.get("achievements", []))
    return {"badges": u.get("badges") or [], "all": [{"id": a["id"], "name": a["name"], "desc": a["desc"], "reward": a["reward"], "title": a["title"], "pearls": TITLE_ACH_PEARLS if a["title"] else 0, "unlocked": a["id"] in have, "tier": ach_tier(a["reward"])} for a in ACHIEVEMENTS],
            "titles": u.get("titles", []), "active_title": u.get("active_title"), "new": new, "user": public_user(u)}


class TitleIn(BaseModel):
    title: Optional[str] = None


@api.post("/achievements/title")
async def set_title(body: TitleIn, user=Depends(get_current_user)):
    if body.title and body.title not in user.get("titles", []) and not (body.title == ADMIN_TITLE and is_admin_user(user)): raise HTTPException(400, "You haven't earned that title")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"active_title": body.title or None}})
    return public_user(await db.users.find_one({"_id": user["_id"]}))


# ---------- Private messages ----------
class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@api.get("/messages")
async def conversations(user=Depends(get_current_user)):
    uid = str(user["_id"])
    pipe = [{"$match": {"$or": [{"from_id": uid}, {"to_id": uid}]}}, {"$sort": {"at": -1}},
            {"$addFields": {"partner": {"$cond": [{"$eq": ["$from_id", uid]}, "$to", "$from"]}}},
            {"$group": {"_id": "$partner", "last": {"$first": "$text"}, "at": {"$first": "$at"}, "from": {"$first": "$from"},
                        "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$to_id", uid]}, {"$eq": ["$read", False]}]}, 1, 0]}}}},
            {"$sort": {"at": -1}}, {"$limit": 50}]
    rows = await db.messages.aggregate(pipe).to_list(50)
    return [{"partner": r["_id"], "last": r["last"], "at": r["at"], "from": r["from"], "unread": r["unread"]} for r in rows]


@api.get("/messages/unread")
async def unread_count(user=Depends(get_current_user)):
    return {"unread": await db.messages.count_documents({"to_id": str(user["_id"]), "read": False})}


@api.get("/messages/{username}")
async def thread(username: str, user=Depends(get_current_user)):
    uid = str(user["_id"])
    if username.lower() == SYSTEM_SENDER.lower():
        rows = [pm_out(r) for r in await db.messages.find({"from_id": "system", "to_id": uid}).sort("at", -1).limit(100).to_list(100)]
        await db.messages.update_many({"from_id": "system", "to_id": uid, "read": False}, {"$set": {"read": True}})
        return {"partner": SYSTEM_SENDER, "messages": rows[::-1], "system": True}
    other = await db.users.find_one({"username_lc": username.lower()})
    if not other: raise HTTPException(404, "No such angler")
    oid_ = str(other["_id"])
    rows = [pm_out(r) for r in await db.messages.find({"$or": [{"from_id": uid, "to_id": oid_}, {"from_id": oid_, "to_id": uid}]}).sort("at", -1).limit(100).to_list(100)]
    await db.messages.update_many({"from_id": oid_, "to_id": uid, "read": False}, {"$set": {"read": True}})
    return {"partner": other["username"], "messages": rows[::-1]}


SEEN_FLAGS = {"friend_tab"}


class SeenIn(BaseModel):
    flag: str


@api.post("/me/seen")
async def mark_seen(body: SeenIn, user=Depends(get_current_user)):
    if body.flag not in SEEN_FLAGS: raise HTTPException(400, "Unknown flag")
    await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"seen_flags": body.flag}})
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]}))}




@api.post("/me/app-reward")
async def app_install_reward(request: Request, user=Depends(get_current_user)):
    """One-time thank-you for playing from the installed app, phone or PC (once per account and per connection)."""
    if request.headers.get("x-client") != "pwa": raise HTTPException(400, "Open the game from the installed app")
    if user.get("app_reward_at"): raise HTTPException(400, "Already claimed")
    ip_hash = guest_ip_hash(client_ip(request))
    if ip_hash and await db.app_rewards.find_one({"ip_hash": ip_hash}): raise HTTPException(400, "This connection already claimed the app reward")
    r = await db.users.update_one({"_id": user["_id"], "app_reward_at": {"$exists": False}}, {"$set": {"app_reward_at": iso(now())}, "$inc": {"items.potion_energy": 1}, "$addToSet": {"owned_frames": "frame_app"}})
    if not r.modified_count: raise HTTPException(400, "Already claimed")
    if ip_hash: await db.app_rewards.insert_one({"ip_hash": ip_hash, "user_id": str(user["_id"]), "at": iso(now())})
    return {"user": public_user(await db.users.find_one({"_id": user["_id"]})), "frame": "frame_app"}


@api.post("/messages/{username}")
async def send_message(username: str, body: MessageIn, user=Depends(get_current_user)):
    if username.lower() == SYSTEM_SENDER.lower():
        raise HTTPException(400, "The Harbourmaster is too busy for a reply.")
    other = await db.users.find_one({"username_lc": username.lower()})
    if not other: raise HTTPException(404, "No such angler")
    if other["_id"] == user["_id"]: raise HTTPException(400, "You mutter to yourself. Nobody answers.")
    msg = {"from_id": str(user["_id"]), "from": user["username"], "to_id": str(other["_id"]), "to": other["username"], "text": body.text.strip(),
           "at": iso(now()), "read": False}
    await db.messages.insert_one(msg)
    return pm_out(msg)


def pm_out(r):
    return {**{k: v for k, v in r.items() if k != "_id"}, "id": str(r["_id"])}


# ---------- Crews ----------
class CrewIn(BaseModel):
    name: str = Field(min_length=3, max_length=24)
    tag: str = Field(min_length=2, max_length=4)
    desc: str = Field(default="", max_length=200)
    open: bool = True


def crew_role(c, uid):
    if c["leader_id"] == uid: return "leader"
    if uid in c.get("officer_ids", []): return "officer"
    return "member" if any(m["user_id"] == uid for m in c["members"]) else None


def manages(c, uid):
    return crew_role(c, uid) in ("leader", "officer")


CREW_BROADCAST_H = 24


def crew_out(c, weekly=None):
    officer_ids = set(c.get("officer_ids", []))
    nxt = datetime.fromisoformat(c["last_broadcast_at"]) + timedelta(hours=CREW_BROADCAST_H) if c.get("last_broadcast_at") else None
    return {"id": str(c["_id"]), "name": c["name"], "tag": c["tag"], "desc": c.get("desc", ""), "open": c.get("open", True), "leader": c["leader"],
            "officers": [m["username"] for m in c["members"] if m["user_id"] in officer_ids],
            "members": c["members"], "member_count": len(c["members"]), "created_at": c["created_at"], "wins": c.get("wins", 0), "weekly_kg": weekly,
            "perks": c.get("perks", {}), "max_members": crew_max(c), "motd": c.get("motd", ""), "colour": c.get("colour"), "colour_key": c.get("colour_key"),
            "hall_tier": (c.get("perks") or {}).get("hall", 0), "bank": c.get("bank", 0),
            "broadcast_next_at": iso(nxt) if nxt and nxt > now() else None}


async def crew_standings(start_iso, end_iso, limit=10, category="crew"):
    pipe = [{"$match": {"caught_at": {"$gte": start_iso, "$lt": end_iso}, "crew_id": {"$ne": None}}}]
    if category == "crew_species":
        pipe += [{"$group": {"_id": {"c": "$crew_id", "s": "$species_id"}, "n": {"$sum": 1}}},
                 {"$group": {"_id": "$_id.c", "value": {"$sum": 1}, "catches": {"$sum": "$n"}}}]
    else:
        pipe += [{"$group": {"_id": "$crew_id", "value": contest_value_stage(category), "catches": {"$sum": 1}}}]
    pipe += [{"$sort": {"value": -1}}, {"$limit": limit}]
    rows = await db.catch_log.aggregate(pipe).to_list(limit)
    out = []
    for r in rows:
        c = await db.crews.find_one({"_id": ObjectId(r["_id"])})
        if c: out.append({"crew_id": r["_id"], "username": f"[{c['tag']}] {c['name']}", "name": c["name"], "tag": c["tag"], "value": round(r["value"], 2) if isinstance(r["value"], float) else r["value"], "catches": r["catches"], "rarity": None})
    return out


@api.get("/crews")
async def list_crews(user=Depends(get_current_user)):
    start, end = period_bounds("weekly", now())
    standings = {s["crew_id"]: s for s in await crew_standings(iso(start), iso(end), 100)}
    crews = await db.crews.find({}).to_list(200)
    out = [crew_out(c, standings.get(str(c["_id"]), {}).get("value", 0)) for c in crews]
    out.sort(key=lambda c: (-c["weekly_kg"], -c["member_count"]))
    return {"crews": out, "week_end": iso(end), "cost": CREW_COST, "min_level": CREW_MIN_LEVEL, "max": CREW_MAX}


@api.post("/crews")
async def create_crew(body: CrewIn, user=Depends(get_current_user)):
    if user.get("crew"): raise HTTPException(400, "Leave your current crew first")
    if level_from_xp(user["xp"])[0] < CREW_MIN_LEVEL: raise HTTPException(400, f"You need to be level {CREW_MIN_LEVEL} to found a crew (anyone can join one)")
    if not re.fullmatch(r"[A-Za-z0-9 _'-]+", body.name) or not re.fullmatch(r"[A-Za-z0-9]+", body.tag): raise HTTPException(400, "Letters and numbers only")
    if user["gold"] < CREW_COST: raise HTTPException(400, f"Founding a crew costs {CREW_COST} gold")
    if await db.crews.find_one({"$or": [{"name_lc": body.name.lower()}, {"tag_lc": body.tag.lower()}]}): raise HTTPException(400, "That crew name or tag is taken")
    doc = {"name": body.name.strip(), "name_lc": body.name.lower(), "tag": body.tag.upper(), "tag_lc": body.tag.lower(), "desc": body.desc, "open": body.open,
           "leader": user["username"], "leader_id": str(user["_id"]), "members": [{"user_id": str(user["_id"]), "username": user["username"], "joined": iso(now())}],
           "created_at": iso(now()), "wins": 0, "bank": 0, "perks": {}}
    res = await db.crews.insert_one(doc)
    crew = {"id": str(res.inserted_id), "name": doc["name"], "tag": doc["tag"]}
    try:
        await charge(user, {"$set": {"crew": crew}}, gold=CREW_COST, extra={"crew": None}, msg=f"Founding a crew costs {CREW_COST} gold")
    except HTTPException:
        await db.crews.delete_one({"_id": res.inserted_id})
        raise
    await add_feed("crew", user["username"], f"{user['username']} founded the crew [{crew['tag']}] {crew['name']}.", "epic")
    await check_achievements(user["_id"])
    return crew_out({**doc, "_id": res.inserted_id}, 0)


@api.get("/crews/inbox")
async def crew_inbox(user=Depends(get_current_user)):
    invites_raw = await db.crew_invites.find({"user_id": str(user["_id"]), "kind": "invite", "status": "pending"}).sort("created_at", -1).to_list(20)
    invites = [{"id": str(x["_id"]), "crew_id": x["crew_id"], "crew_name": x["crew_name"], "crew_tag": x["crew_tag"],
                "from_username": x["from_username"], "created_at": x["created_at"]} for x in invites_raw]
    led = await db.crews.find({"$or": [{"leader_id": str(user["_id"])}, {"officer_ids": str(user["_id"])}]}).to_list(20)
    requests = []
    if led:
        led_ids = [str(c["_id"]) for c in led]
        reqs = await db.crew_invites.find({"crew_id": {"$in": led_ids}, "kind": "request", "status": "pending"}).sort("created_at", -1).to_list(40)
        for r in reqs:
            requests.append({"id": str(r["_id"]), "crew_id": r["crew_id"], "crew_name": r["crew_name"], "crew_tag": r["crew_tag"],
                             "username": r["username"], "user_id": r["user_id"], "created_at": r["created_at"]})
    return {"invites": invites, "requests": requests, "count": len(invites) + len(requests)}


@api.get("/crews/inbox/count")
async def crew_inbox_count(user=Depends(get_current_user)):
    n_inv = await db.crew_invites.count_documents({"user_id": str(user["_id"]), "kind": "invite", "status": "pending"})
    n_req = 0
    led = await db.crews.find({"$or": [{"leader_id": str(user["_id"])}, {"officer_ids": str(user["_id"])}]}, {"_id": 1}).to_list(20)
    if led:
        n_req = await db.crew_invites.count_documents({"crew_id": {"$in": [str(c["_id"]) for c in led]}, "kind": "request", "status": "pending"})
    return {"count": n_inv + n_req, "invites": n_inv, "requests": n_req}


@api.get("/crews/{crew_id}")
async def crew_detail(crew_id: str, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    start, end = period_bounds("weekly", now())
    pipe = [{"$match": {"caught_at": {"$gte": iso(start), "$lt": iso(end)}, "crew_id": crew_id}},
            {"$group": {"_id": "$caught_by", "kg": {"$sum": "$weight"}, "catches": {"$sum": 1}}}]
    contrib = {r["_id"]: r for r in await db.catch_log.aggregate(pipe).to_list(100)}
    members = []
    officer_ids = set(c.get("officer_ids", []))
    for m in c["members"]:
        u = await db.users.find_one({"_id": ObjectId(m["user_id"])}, {"xp": 1, "last_seen": 1})
        members.append({**m, "role": "leader" if m["user_id"] == c["leader_id"] else "officer" if m["user_id"] in officer_ids else "member",
                        "level": level_from_xp(u["xp"])[0] if u else 1, "last_seen": u["last_seen"] if u else None,
                        "week_kg": round(contrib.get(m["user_id"], {}).get("kg", 0), 2), "week_catches": contrib.get(m["user_id"], {}).get("catches", 0)})
    members.sort(key=lambda m: -m["week_kg"])
    out = crew_out(c, round(sum(m["week_kg"] for m in members), 2))
    out["members"] = members
    return out


@api.post("/crews/{crew_id}/join")
async def join_crew(crew_id: str, user=Depends(get_current_user)):
    if user.get("crew"): raise HTTPException(400, "You are already in a crew")
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    if not c.get("open", True): raise HTTPException(400, "This crew is invite-only")
    if crew_full(c): raise HTTPException(400, "That crew is full")
    if not await _crew_add_member(c, user): raise HTTPException(400, "You are already in that crew")
    return public_user(await db.users.find_one({"_id": user["_id"]}))


@api.post("/crews/{crew_id}/leave")
async def leave_crew(crew_id: str, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id), "members.user_id": str(user["_id"])})
    if not c: raise HTTPException(404, "You are not in that crew")
    remaining = [m for m in c["members"] if m["user_id"] != str(user["_id"])]
    if not remaining:
        await db.crews.delete_one({"_id": c["_id"]})
    else:
        sets = {"members": remaining, "officer_ids": [o for o in c.get("officer_ids", []) if o != str(user["_id"])]}
        if c["leader_id"] == str(user["_id"]):
            heir = next((m for m in remaining if m["user_id"] in c.get("officer_ids", [])), remaining[0])
            sets["leader"], sets["leader_id"] = heir["username"], heir["user_id"]
            sets["officer_ids"] = [o for o in sets["officer_ids"] if o != heir["user_id"]]
        await db.crews.update_one({"_id": c["_id"]}, {"$set": sets})
        from crew_extras import crew_log
        await crew_log(c["_id"], user["username"], "left the crew" + (f", {sets['leader']} takes the helm" if "leader" in sets else ""), "member")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"crew": None}})
    return public_user(await db.users.find_one({"_id": user["_id"]}))


class KickIn(BaseModel):
    username: str


@api.post("/crews/{crew_id}/kick")
async def kick_member(crew_id: str, body: KickIn, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id), "leader_id": str(user["_id"])})
    if not c: raise HTTPException(403, "Only the crew leader can do that")
    target = next((m for m in c["members"] if m["username"].lower() == body.username.lower()), None)
    if not target or target["user_id"] == str(user["_id"]): raise HTTPException(400, "No such member")
    await db.crews.update_one({"_id": c["_id"]}, {"$pull": {"members": {"user_id": target["user_id"]}, "officer_ids": target["user_id"]}})
    await db.users.update_one({"_id": ObjectId(target["user_id"])}, {"$set": {"crew": None}})
    from crew_extras import crew_log
    await crew_log(c["_id"], user["username"], f"removed {target['username']} from the crew", "member")
    return {"ok": True}


@api.post("/crews/{crew_id}/promote")
async def promote_member(crew_id: str, body: KickIn, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id), "leader_id": str(user["_id"])})
    if not c: raise HTTPException(403, "Only the crew leader can do that")
    target = next((m for m in c["members"] if m["username"].lower() == body.username.lower()), None)
    if not target or target["user_id"] == str(user["_id"]): raise HTTPException(400, "No such member")
    if target["user_id"] in c.get("officer_ids", []): raise HTTPException(400, f"{target['username']} is already an officer")
    await db.crews.update_one({"_id": c["_id"]}, {"$addToSet": {"officer_ids": target["user_id"]}})
    from crew_extras import crew_log
    await crew_log(c["_id"], user["username"], f"made {target['username']} an officer", "rank")
    await db.chat.insert_one({"channel": "crew", "crew_id": crew_id, "username": "Harbourmaster", "level": 0, "at": iso(now()),
                              "text": f"{target['username']} has been made an officer of the crew."})
    await db.messages.insert_one({"from_id": str(user["_id"]), "from": user["username"], "to_id": target["user_id"], "to": target["username"],
                                  "text": f"[crew] You are now an officer of [{c['tag']}] {c['name']}. Officers can build hall upgrades, write the notice board, invite anglers, handle join requests and send crew messages.", "at": iso(now()), "read": False})
    return {"ok": True}


@api.post("/crews/{crew_id}/demote")
async def demote_member(crew_id: str, body: KickIn, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id), "leader_id": str(user["_id"])})
    if not c: raise HTTPException(403, "Only the crew leader can do that")
    target = next((m for m in c["members"] if m["username"].lower() == body.username.lower()), None)
    if not target or target["user_id"] not in c.get("officer_ids", []): raise HTTPException(400, f"{body.username} is not an officer")
    await db.crews.update_one({"_id": c["_id"]}, {"$pull": {"officer_ids": target["user_id"]}})
    from crew_extras import crew_log
    await crew_log(c["_id"], user["username"], f"demoted {target['username']} from officer", "rank")
    return {"ok": True}


class BroadcastIn(BaseModel):
    text: str = Field(min_length=3, max_length=500)


@api.post("/crews/{crew_id}/broadcast")
async def crew_broadcast(crew_id: str, body: BroadcastIn, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c or not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can message the whole crew")
    if c.get("last_broadcast_at"):
        nxt = datetime.fromisoformat(c["last_broadcast_at"]) + timedelta(hours=CREW_BROADCAST_H)
        if nxt > now():
            mins = int((nxt - now()).total_seconds() // 60)
            raise HTTPException(400, f"Your crew already sent a message today. Next one in {mins // 60}h {mins % 60}m")
    text = body.text.strip()
    at = iso(now())
    docs = [{"from_id": str(user["_id"]), "from": user["username"], "to_id": m["user_id"], "to": m["username"],
             "text": f"[crew message · {c['tag']}] {text}", "at": at, "read": False} for m in c["members"] if m["user_id"] != str(user["_id"])]
    if docs: await db.messages.insert_many(docs)
    await db.chat.insert_one({"channel": "crew", "crew_id": crew_id, "username": "Harbourmaster", "level": 0, "at": at, "text": f"Crew message from {user['username']}: {text}"})
    await db.crews.update_one({"_id": c["_id"]}, {"$set": {"last_broadcast_at": at, "last_broadcast_by": user["username"]}})
    return {"ok": True, "sent": len(docs), "next_at": iso(now() + timedelta(hours=CREW_BROADCAST_H))}


class CrewSettingsIn(BaseModel):
    desc: Optional[str] = Field(default=None, max_length=200)
    open: Optional[bool] = None


@api.post("/crews/{crew_id}/settings")
async def crew_settings(crew_id: str, body: CrewSettingsIn, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id), "leader_id": str(user["_id"])})
    if not c: raise HTTPException(403, "Only the crew leader can do that")
    sets = {k: v for k, v in (("desc", body.desc), ("open", body.open)) if v is not None}
    if sets: await db.crews.update_one({"_id": c["_id"]}, {"$set": sets})
    return {"ok": True}


# ---------- Crew invites / join requests ----------
class InviteIn(BaseModel):
    username: str = Field(min_length=1, max_length=24)


async def _crew_add_member(crew, target_user):
    """Atomically add a user once (double-clicks / parallel accepts can't create duplicate member rows). Returns False if already a member."""
    uid = str(target_user["_id"])
    r = await db.crews.update_one({"_id": crew["_id"], "members.user_id": {"$ne": uid}},
                                  {"$push": {"members": {"user_id": uid, "username": target_user["username"], "joined": iso(now())}}})
    await db.users.update_one({"_id": target_user["_id"]},
                              {"$set": {"crew": {"id": str(crew["_id"]), "name": crew["name"], "tag": crew["tag"], "perks": crew.get("perks", {}), "colour": crew.get("colour")}}})
    if r.modified_count != 1: return False
    await db.chat.insert_one({"channel": "crew", "crew_id": str(crew["_id"]), "username": "Harbourmaster", "level": 0, "text": f"{target_user['username']} joined the crew.", "at": iso(now())})
    from crew_extras import crew_log
    await crew_log(crew["_id"], target_user["username"], "joined the crew", "member")
    await db.crew_invites.update_many({"crew_id": str(crew["_id"]), "user_id": uid, "status": "pending"}, {"$set": {"status": "superseded"}})
    await check_achievements(target_user["_id"])
    return True


async def dedupe_crew_members():
    """Repair crews that already carry duplicate member rows from the old non-atomic join."""
    async for c in db.crews.find({}, {"members": 1}):
        seen, clean = set(), []
        for m in c.get("members", []):
            if m["user_id"] in seen: continue
            seen.add(m["user_id"]); clean.append(m)
        if len(clean) != len(c.get("members", [])):
            await db.crews.update_one({"_id": c["_id"]}, {"$set": {"members": clean}})
            logger.info("Removed %s duplicate member rows from crew %s", len(c["members"]) - len(clean), c["_id"])


@api.post("/crews/{crew_id}/invite")
async def invite_to_crew(crew_id: str, body: InviteIn, user=Depends(get_current_user)):
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c or not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can send invites")
    if crew_full(c): raise HTTPException(400, "That crew is full")
    target = await db.users.find_one({"username_lc": body.username.strip().lower()})
    if not target: raise HTTPException(404, "No such angler")
    if str(target["_id"]) == str(user["_id"]): raise HTTPException(400, "You are already in this crew")
    if target.get("crew"): raise HTTPException(400, f"{target['username']} is already in a crew")
    exists = await db.crew_invites.find_one({"crew_id": crew_id, "user_id": str(target["_id"]), "kind": "invite", "status": "pending"})
    if exists: raise HTTPException(400, f"{target['username']} already has a pending invite from your crew")
    doc = {"kind": "invite", "crew_id": crew_id, "crew_name": c["name"], "crew_tag": c["tag"],
           "user_id": str(target["_id"]), "username": target["username"],
           "from_user_id": str(user["_id"]), "from_username": user["username"],
           "status": "pending", "created_at": iso(now())}
    res = await db.crew_invites.insert_one(doc)
    # notify via private message so the whisper lands too
    await db.messages.insert_one({"from_id": str(user["_id"]), "from": user["username"], "to_id": str(target["_id"]), "to": target["username"],
                                   "text": f"[crew invite] Join us at [{c['tag']}] {c['name']}? Accept from the Crews tab.", "at": iso(now()), "read": False})
    return {"id": str(res.inserted_id), "ok": True}


@api.post("/crews/{crew_id}/apply")
async def apply_to_crew(crew_id: str, user=Depends(get_current_user)):
    if user.get("crew"): raise HTTPException(400, "Leave your current crew first")
    c = await db.crews.find_one({"_id": oid(crew_id)})
    if not c: raise HTTPException(404, "No such crew")
    if c.get("open", True): raise HTTPException(400, "This crew is open, just join it")
    if crew_full(c): raise HTTPException(400, "That crew is full")
    exists = await db.crew_invites.find_one({"crew_id": crew_id, "user_id": str(user["_id"]), "kind": "request", "status": "pending"})
    if exists: raise HTTPException(400, "You've already asked to join that crew")
    # if there's already a pending invite from that crew, auto-accept it instead
    inv = await db.crew_invites.find_one({"crew_id": crew_id, "user_id": str(user["_id"]), "kind": "invite", "status": "pending"})
    if inv:
        if crew_full(c): raise HTTPException(400, "That crew is full")
        await _crew_add_member(c, user)
        await db.crew_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "accepted", "resolved_at": iso(now())}})
        return {"ok": True, "joined": True}
    doc = {"kind": "request", "crew_id": crew_id, "crew_name": c["name"], "crew_tag": c["tag"],
           "user_id": str(user["_id"]), "username": user["username"],
           "from_user_id": str(user["_id"]), "from_username": user["username"],
           "status": "pending", "created_at": iso(now())}
    res = await db.crew_invites.insert_one(doc)
    return {"id": str(res.inserted_id), "ok": True}


@api.post("/crews/invites/{invite_id}/accept")
async def accept_invite(invite_id: str, user=Depends(get_current_user)):
    inv = await db.crew_invites.find_one({"_id": oid(invite_id), "user_id": str(user["_id"]), "kind": "invite", "status": "pending"})
    if not inv: raise HTTPException(404, "No such invite")
    if user.get("crew"): raise HTTPException(400, "Leave your current crew first")
    c = await db.crews.find_one({"_id": ObjectId(inv["crew_id"])})
    if not c: raise HTTPException(404, "That crew no longer exists")
    if crew_full(c): raise HTTPException(400, "That crew is full")
    await _crew_add_member(c, user)
    await db.crew_invites.update_one({"_id": inv["_id"]}, {"$set": {"status": "accepted", "resolved_at": iso(now())}})
    return {"ok": True, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


@api.post("/crews/invites/{invite_id}/decline")
async def decline_invite(invite_id: str, user=Depends(get_current_user)):
    r = await db.crew_invites.update_one({"_id": oid(invite_id), "user_id": str(user["_id"]), "kind": "invite", "status": "pending"},
                                          {"$set": {"status": "declined", "resolved_at": iso(now())}})
    if r.matched_count == 0: raise HTTPException(404, "No such invite")
    return {"ok": True}


@api.post("/crews/requests/{request_id}/approve")
async def approve_request(request_id: str, user=Depends(get_current_user)):
    req = await db.crew_invites.find_one({"_id": oid(request_id), "kind": "request", "status": "pending"})
    if not req: raise HTTPException(404, "No such request")
    c = await db.crews.find_one({"_id": ObjectId(req["crew_id"])})
    if not c or not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can do that")
    if crew_full(c): raise HTTPException(400, "Your crew is full")
    target = await db.users.find_one({"_id": ObjectId(req["user_id"])})
    if not target: raise HTTPException(404, "That angler is gone")
    if target.get("crew"):
        await db.crew_invites.update_one({"_id": req["_id"]}, {"$set": {"status": "superseded", "resolved_at": iso(now())}})
        raise HTTPException(400, f"{target['username']} already joined another crew")
    await _crew_add_member(c, target)
    await db.crew_invites.update_one({"_id": req["_id"]}, {"$set": {"status": "accepted", "resolved_at": iso(now())}})
    return {"ok": True}


@api.post("/crews/requests/{request_id}/decline")
async def decline_request(request_id: str, user=Depends(get_current_user)):
    req = await db.crew_invites.find_one({"_id": oid(request_id), "kind": "request", "status": "pending"})
    if not req: raise HTTPException(404, "No such request")
    c = await db.crews.find_one({"_id": ObjectId(req["crew_id"])})
    if not c or not manages(c, str(user["_id"])): raise HTTPException(403, "Only the crew leader and officers can do that")
    await db.crew_invites.update_one({"_id": req["_id"]}, {"$set": {"status": "declined", "resolved_at": iso(now())}})
    return {"ok": True}


# ---------- Night Expeditions ----------
EVENT_PERIOD = 4 * 3600
EVENT_LENGTH = 3600
EVENT_LUCK = 25
EVENT_BITE = 10


def expedition_for_block(block):
    rnd = random.Random(f"expedition:{block}")
    w = rnd.choice(WATERS)
    start = datetime.fromtimestamp(block * EVENT_PERIOD, tz=timezone.utc)
    return {"block": block, "water": w["key"], "water_name": w["name"], "start": iso(start), "end": iso(start + timedelta(seconds=EVENT_LENGTH)),
            "name": rnd.choice(["Night Expedition", "The Great Rising", "Feeding Frenzy", "Midnight Shoal", "The Deep Stirs"])}


def current_expedition(t=None):
    t = t or now()
    ts = t.timestamp()
    block = int(ts // EVENT_PERIOD)
    active = expedition_for_block(block) if ts % EVENT_PERIOD < EVENT_LENGTH else None
    nxt = expedition_for_block(block + 1)
    return active, nxt


async def ensure_expedition_alert():
    active, _ = current_expedition()
    if not active: return
    key = f"expedition:{active['block']}"
    if await db.alerts.find_one({"key": key}): return
    try:
        await db.alerts.insert_one({"key": key, "username": "Harbourmaster", "water": active["water"], "water_name": active["water_name"], "status": "event",
                                    "species": None, "weight": None, "variant": None, "at": active["start"], "end": active["end"], "cheers": [],
                                    "text": f"{active['name']}: rare fish are flooding {active['water_name']} for the next hour!"})
        await add_feed("event", "Harbourmaster", f"{active['name']} has begun at {active['water_name']}. Rare fish for one hour.", "legendary")
        from push_notifications import broadcast as _push_broadcast
        asyncio.create_task(_push_broadcast(title=f"{active['name']} at {active['water_name']}", body=f"Rare fish are flooding {active['water_name']} for the next hour. Luck +{EVENT_LUCK}.",
                                            url="/game/fish", tag=key, kind="expedition"))
    except Exception:
        pass


@api.get("/events")
async def events(user=Depends(get_current_user)):
    await ensure_expedition_alert()
    await ensure_boss_alert()
    active, nxt = current_expedition()
    return {"active": active, "next": nxt, "luck": EVENT_LUCK, "bite": EVENT_BITE, "boss": boss_public(await current_boss())}


# ---------- Alerts ----------
ALERT_WINDOW_MIN = 12


@api.get("/alerts/live")
async def live_alerts(user=Depends(get_current_user)):
    await cached("alerts_ensure", 10, _ensure_alerts)
    rows = await cached("alerts_live", 3, _live_alert_rows)
    return [{"id": str(a["_id"]), "username": a["username"], "status": a["status"], "species": a["species"], "weight": a["weight"], "variant": a["variant"], "rarity": a.get("rarity", "legendary"),
             "water": a["water_name"], "water_key": a.get("water"), "at": a["at"], "end": a.get("end"), "text": a["text"], "cheers": len(a["cheers"]), "cheered": user["username"] in a["cheers"], "gear_id": a.get("gear_id"), "kind": a.get("kind")} for a in rows]


async def _ensure_alerts():
    await ensure_expedition_alert()
    await ensure_boss_alert()
    return True


async def _live_alert_rows():
    return await db.alerts.find({"$or": [{"at": {"$gte": iso(now() - timedelta(minutes=ALERT_WINDOW_MIN))}, "status": {"$nin": ["announce", "duel"]}}, {"status": {"$in": ["event", "boss", "announce", "random", "duel"]}, "end": {"$gte": iso(now())}}]}).sort("at", -1).limit(5).to_list(5)


@api.post("/alerts/{alert_id}/cheer")
async def cheer(alert_id: str, user=Depends(get_current_user)):
    a = await db.alerts.find_one({"_id": oid(alert_id)})
    if not a: raise HTTPException(404, "That moment has passed")
    if a["username"] == user["username"]: raise HTTPException(400, "You can't cheer yourself")
    if a["status"] not in ("landed", "boss_landed", "crate"): raise HTTPException(400, "You can only cheer a landed fish")
    r = await db.alerts.update_one({"_id": a["_id"], "cheers": {"$ne": user["username"]}}, {"$addToSet": {"cheers": user["username"]}})
    uncache("alerts_live")
    if r.modified_count:
        await db.users.update_one({"username": a["username"]}, {"$inc": {"stats.cheers": 1}})
    return {"cheers": len(a["cheers"]) + r.modified_count}


# ---------- Bait crafting ----------
def ingredient_buys_today(u):
    b = u.get("ingredient_buys") or {}
    return dict(b.get("counts", {})) if b.get("date") == now().strftime("%Y-%m-%d") else {}


class BuyIngIn(BaseModel):
    ingredient_id: str
    qty: int = Field(ge=1, le=500)


@api.post("/shop/buy-ingredient")
async def buy_ingredient(body: BuyIngIn, user=Depends(get_current_user)):
    ing = ING_BY_ID.get(body.ingredient_id)
    if not ing: raise HTTPException(404, "Unknown ingredient")
    today = now().strftime("%Y-%m-%d")
    bought = ingredient_buys_today(user)
    left = ing["daily_cap"] - bought.get(ing["id"], 0)
    if body.qty > left:
        raise HTTPException(400, f"The vendor only has {max(left, 0)} more {ing['name']} for you today, try the Market, or come back after the daily reset")
    cost = ing["price"] * body.qty
    if user["gold"] < cost: raise HTTPException(400, "Not enough gold")
    await charge(user, {"$inc": {f"ingredients.{ing['id']}": body.qty},
                        "$set": {"ingredient_buys": {"date": today, "counts": {**bought, ing["id"]: bought.get(ing["id"], 0) + body.qty}}}}, gold=cost)
    return public_user(await db.users.find_one({"_id": user["_id"]}))


CRAFT_MAX_BATCHES = 50


class CraftIn(BaseModel):
    recipe_id: str
    catch_ids: List[str] = Field(max_length=400)


@api.post("/craft")
async def craft(body: CraftIn, user=Depends(get_current_user)):
    recipe = next((r for r in RECIPES if r["id"] == body.recipe_id), None)
    if not recipe: raise HTTPException(404, "Unknown recipe")
    ids = [oid(i) for i in set(body.catch_ids)]
    k = len(ids) // recipe["fish"]
    if not k or len(ids) % recipe["fish"] or len(ids) != len(body.catch_ids): raise HTTPException(400, f"Pick a multiple of {recipe['fish']} small fish")
    if k > CRAFT_MAX_BATCHES: raise HTTPException(400, f"You can craft up to {CRAFT_MAX_BATCHES} batches at once")
    rows = await db.catches.find({"_id": {"$in": ids}, "user_id": str(user["_id"]), "listed": False, "mounted": {"$ne": True}}).to_list(len(ids))
    if len(rows) != len(ids): raise HTTPException(400, "Some of those fish aren't in your keepnet")
    if not all(FISH_BY_ID[c["species_id"]]["baitable"] for c in rows): raise HTTPException(400, "Only small bait-grade fish can be used")
    need = {i: n * k for i, n in recipe["ingredients"].items()}
    have = user.get("ingredients", {})
    for ing_id, n in need.items():
        if have.get(ing_id, 0) < n: raise HTTPException(400, f"You need {n} × {ING_BY_ID[ing_id]['name']} for {k} batch{'es' if k > 1 else ''}")
    ws = sorted((c["weight"] for c in rows), reverse=True)
    bonus = sum(1 for j in range(k) if sum(ws[j * recipe["fish"]:(j + 1) * recipe["fish"]]) >= recipe["fish"] * 0.4)
    made = recipe["yield"] * k + bonus
    inc = {f"bait.{recipe['id']}": made, "stats.crafted": made}
    for ing_id, n in need.items(): inc[f"ingredients.{ing_id}"] = -n
    # take the ingredients atomically first (balance check in the filter), then the fish; refund if the fish raced away
    took = await db.users.update_one({"_id": user["_id"], **{f"ingredients.{i}": {"$gte": n} for i, n in need.items()}}, {"$inc": inc})
    if not took.matched_count: raise HTTPException(400, "You no longer have those ingredients")
    res = await db.catches.delete_many({"_id": {"$in": [c["_id"] for c in rows]}, "user_id": str(user["_id"]), "listed": False})
    if res.deleted_count != len(rows):
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {k2: -v for k2, v in inc.items()}})
        raise HTTPException(409, "Some of those fish just left your keepnet, try again")
    qd = await quest_event(user["_id"], "craft", {"n": made})
    return {"made": made, "batches": k, "bait": BAIT_BY_ID[recipe["id"]]["name"], "bonus": bonus, "user": public_user(await db.users.find_one({"_id": user["_id"]})), "quests_done": qd}


# ---------- Quests ----------
DAILY_COUNT, WEEKLY_COUNT, STREAK_DAYS = 3, 2, 7


def quest_period(kind, t=None):
    t = t or now()
    start, end = period_bounds(kind, t)
    return start.strftime("%Y-%m-%d"), start, end


def quest_reward(kind, level, mult):
    if kind == "daily": return {"gold": int((40 + level * 10) * mult) // 5 * 5, "xp": int(xp_for_level(level) * 0.12 * mult), "title": None, "pearls": 0}
    return {"gold": int((200 + level * 50) * mult) // 10 * 10, "xp": int(xp_for_level(level) * 0.5 * mult), "title": None, "pearls": WEEKLY_PEARLS}


def streak_bonus(level):
    return {"gold": 1000 + level * 40, "xp": int(xp_for_level(level) * 0.6), "pearls": STREAK_PEARLS}


async def quest_ctx(u):
    level, _ = level_from_xp(u["xp"])
    waters = []
    for k in u["unlocked_waters"]:
        kgs = sorted(f["max_kg"] for f in FISH_BY_WATER[k])
        waters.append({"key": k, "name": WATER_BY_KEY[k]["name"], "median_kg": kgs[len(kgs) // 2]})
    _, left = await discovery_scope(u)
    return {"level": level, "waters": waters, "mid": level >= 5, "undiscovered": left > 0, "undiscovered_left": left, "duel": level >= DUEL_LEVEL}


def default_pearls(d):
    if d["kind"] == "weekly": return WEEKLY_PEARLS
    if d["kind"] == "story": return 3 if d["reward"].get("title") else 2
    return 0


def quest_out(d):
    reward = {**d["reward"], "pearls": d["reward"].get("pearls", default_pearls(d))}
    return {"id": d["quest_id"], "kind": d["kind"], "name": d["name"], "desc": d["desc"], "story": d.get("story"), "reward": reward,
            "progress": round(d["progress"], 2), "target": d["target"], "status": d["status"], "done_at": d.get("done_at")}


async def ensure_periodic_quests(u, kind):
    key, start, end = quest_period(kind)
    uid = str(u["_id"])
    if await db.quests.count_documents({"user_id": uid, "kind": kind, "period": key}) > 0: return
    ctx = await quest_ctx(u)
    rnd = random.Random(f"{uid}:{kind}:{key}")
    pool = (daily_pool if kind == "daily" else weekly_pool)(rnd, ctx)
    pool = [t for t in pool if not t["needs"] or ctx.get(t["needs"])]
    picks = rnd.sample(pool, DAILY_COUNT if kind == "daily" else WEEKLY_COUNT)
    docs = [{"user_id": uid, "quest_id": f"{t['id']}:{key}", "template": t["id"], "kind": kind, "period": key, "name": t["name"], "desc": t["desc"].replace("{n}", f"{t['target']:,}"),
             "objective": {"event": t["event"], "filter": t["filter"], "measure": t["measure"]}, "target": t["target"], "progress": 0,
             "reward": quest_reward(kind, ctx["level"], t["mult"]), "status": "active", "created_at": iso(now()), "ends_at": iso(end)} for t in picks]
    try:
        await db.quests.insert_many(docs, ordered=False)
    except Exception:
        pass


def obj_matches(obj, event, p):
    if obj["event"] != event: return 0
    f = obj.get("filter") or {}
    if "water" in f and p.get("water") != f["water"]: return 0
    if "min_rarity" in f and RARITY_ORDER.index(p.get("rarity", "common")) < RARITY_ORDER.index(f["min_rarity"]): return 0
    if "min_kg" in f and p.get("weight", 0) < f["min_kg"]: return 0
    if "period" in f and p.get("period") != f["period"]: return 0
    if f.get("new_species") and not p.get("new_species"): return 0
    if f.get("variant") and p.get("variant", "normal") == "normal": return 0
    if f.get("won") and not p.get("won"): return 0
    m = obj.get("measure")
    if m == "gold": return p.get("gold", 0)
    if m == "kg": return p.get("weight", 0)
    return p.get("n", 1)


async def grant_quest_reward(u, reward, label, kind):
    upd = {"$inc": {"gold": reward["gold"], "xp": reward["xp"], "stats.gold_earned": reward["gold"], "stats.quests_done": 1}}
    if reward.get("pearls"):
        upd["$inc"]["pearls"] = reward["pearls"]; upd["$inc"]["stats.pearls_earned"] = reward["pearls"]
    if reward.get("title"): upd["$addToSet"] = {"titles": reward["title"]}
    old_level, _ = level_from_xp((await db.users.find_one({"_id": u["_id"]}, {"xp": 1}))["xp"])
    await db.users.update_one({"_id": u["_id"]}, upd)
    await settle_level_up(u["_id"], old_level)
    if kind == "story":
        await add_feed("quest", u["username"], f"{u['username']} completed the quest \"{label}\".", "epic" if reward.get("title") else "rare")


def streak_alive(s, day_key):
    """Unbroken up to (not including) day_key: every day since last_day is either last_day itself or a graced day."""
    last = s.get("last_day")
    if not last: return False
    graces = set(s.get("graces") or [])
    d = datetime.strptime(day_key, "%Y-%m-%d") - timedelta(days=1)
    for _ in range(14):
        k = d.strftime("%Y-%m-%d")
        if k == last: return True
        if k not in graces: return False
        d -= timedelta(days=1)
    return False


async def update_streak(u):
    day_key, _, _ = quest_period("daily")
    remaining = await db.quests.count_documents({"user_id": str(u["_id"]), "kind": "daily", "period": day_key, "status": "active"})
    if remaining: return None
    s = u.get("quest_streak") or {"count": 0, "last_day": None}
    if s.get("last_day") == day_key: return None
    count = s["count"] + 1 if streak_alive(s, day_key) else 1
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"quest_streak.count": count, "quest_streak.last_day": day_key}})
    if count % STREAK_DAYS == 0:
        level, _ = level_from_xp(u["xp"])
        b = streak_bonus(level)
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"gold": b["gold"], "xp": b["xp"], "stats.gold_earned": b["gold"], "pearls": b["pearls"], "stats.pearls_earned": b["pearls"]}})
        await add_feed("quest", u["username"], f"{u['username']} kept a {count}-day quest streak and earned {b['gold']} gold and {b['pearls']} Pearls.", "epic")
        return {"id": f"streak:{day_key}", "name": f"{count}-day quest streak bonus", "kind": "streak", "reward": {**b, "title": None}}
    return None


async def retire_period_dailies():
    """One-off: swap live 'catch at dawn/dusk/night' dailies for timezone-neutral ones and grace the streaks of anyone holding one."""
    if await db.meta.find_one({"key": "period_dailies_retired"}): return
    dkey, _, _ = quest_period("daily")
    ykey = (now() - timedelta(days=1)).strftime("%Y-%m-%d")
    swapped, graced = 0, set()
    async for q in db.quests.find({"kind": "daily", "template": "d_period", "period": {"$in": [dkey, ykey]}, "status": "active"}):
        graced.add(q["user_id"])
        if q["period"] != dkey: continue
        has_catch = await db.quests.find_one({"user_id": q["user_id"], "kind": "daily", "period": dkey, "template": "d_catch"})
        if has_catch:
            tgt = q["target"] * 5
            sets = {"template": "d_cast", "name": "Patience", "desc": f"Cast your line {tgt:,} times.", "objective": {"event": "cast", "filter": {}, "measure": None}, "target": tgt}
        else:
            sets = {"template": "d_catch", "name": "Busy Lines", "desc": f"Land {q['target']:,} fish anywhere.", "objective": {"event": "catch", "filter": {}, "measure": None}}
        await db.quests.update_one({"_id": q["_id"]}, {"$set": sets})
        swapped += 1
    for uid in graced:
        await db.users.update_one({"_id": ObjectId(uid), "quest_streak.count": {"$gt": 0}}, {"$addToSet": {"quest_streak.graces": {"$each": [ykey, dkey]}}})
    await db.meta.insert_one({"key": "period_dailies_retired", "at": iso(now()), "swapped": swapped, "graced": len(graced)})
    logger.info("Retired period dailies: swapped %s quests, graced %s anglers", swapped, len(graced))


LEDGER_KEYS = ("user_id", "username", "caught_by", "caught_by_name", "crew_id", "species_id", "name", "rarity", "weight", "variant", "water", "caught_at")


def catch_ledger(c):
    """Permanent record of a landing, survives the fish being sold, used as bait or handed in."""
    return {k: c.get(k) for k in LEDGER_KEYS}


async def backfill_catch_log():
    if await db.meta.find_one({"key": "catch_log_backfilled"}): return
    n = 0
    async for c in db.catches.find({}):
        await db.catch_log.update_one({"src": str(c["_id"])}, {"$setOnInsert": {**catch_ledger(c), "src": str(c["_id"])}}, upsert=True); n += 1
    await db.meta.insert_one({"key": "catch_log_backfilled", "at": iso(now()), "copied": n})
    logger.info("catch_log backfilled with %s catches", n)


async def backfill_mastery():
    """One-off: derive stats.mastery_total / stats.masteries (and Master titles) from existing journal counts."""
    if await db.meta.find_one({"key": "mastery_backfilled_v2"}): return
    totals = {}
    async for j in db.journal.find({}, {"user_id": 1, "species_id": 1, "count": 1}):
        f = FISH_BY_ID.get(j["species_id"])
        if not f: continue
        lvl = mastery.level_for(f["rarity"], j.get("count", 0))
        t = totals.setdefault(j["user_id"], {"total": 0, "masters": []})
        t["total"] += lvl
        if lvl >= mastery.MAX_LEVEL: t["masters"].append(f"{f['name']} Master")
    for uid, t in totals.items():
        if not ObjectId.is_valid(uid): continue
        upd = {"$set": {"stats.mastery_total": t["total"], "stats.masteries": len(t["masters"])}}
        if t["masters"]: upd["$addToSet"] = {"titles": {"$each": t["masters"]}}
        await db.users.update_one({"_id": ObjectId(uid)}, upd)
    await db.meta.insert_one({"key": "mastery_backfilled_v2", "at": iso(now()), "users": len(totals)})
    logger.info("Mastery backfilled for %s anglers", len(totals))


async def quest_event(user_id, event, payload=None):
    p = payload or {}
    u = await db.users.find_one({"_id": user_id})
    if not u: return []
    for kind in ("daily", "weekly"):
        await ensure_periodic_quests(u, kind)
    dkey, _, _ = quest_period("daily"); wkey, _, _ = quest_period("weekly")
    active = await db.quests.find({"user_id": str(user_id), "status": "active", "$or": [{"kind": "story"}, {"kind": "guest"}, {"kind": "daily", "period": dkey}, {"kind": "weekly", "period": wkey}]}).to_list(50)
    done = []
    for q in active:
        amt = obj_matches(q["objective"], event, p)
        if not amt: continue
        prog = min(q["target"], q["progress"] + amt)
        if prog >= q["target"]:
            r = await db.quests.update_one({"_id": q["_id"], "status": "active"}, {"$set": {"progress": prog, "status": "done", "done_at": iso(now())}})
            if r.modified_count:
                await grant_quest_reward(u, {**q["reward"], "pearls": q["reward"].get("pearls", default_pearls(q))}, q["name"], q["kind"])
                # Unlock next guest step if this was a guest quest
                if q["kind"] == "guest":
                    try:
                        idx = GUEST_ORDER.index(q["quest_id"])
                        if idx + 1 < len(GUEST_ORDER):
                            await db.quests.update_one({"user_id": str(user_id), "quest_id": GUEST_ORDER[idx + 1], "status": "locked"},
                                                       {"$set": {"status": "active"}})
                    except ValueError:
                        pass
                done.append({"id": q["quest_id"], "name": q["name"], "kind": q["kind"], "reward": q["reward"]})
        else:
            await db.quests.update_one({"_id": q["_id"]}, {"$set": {"progress": prog}})
    if any(d["kind"] == "daily" for d in done):
        bonus = await update_streak(u)
        if bonus: done.append(bonus)
    return done


REACHABLE_RARITIES = {"common", "uncommon", "rare", "epic"}


async def discovery_scope(u, water=None):
    """(known, left): species the angler has / could still discover in scope (one water, or every water they've unlocked).
    Legendary and mythic species are not counted as 'left', a quest must never hinge on a once-a-month fish."""
    keys = [water] if water else list(u["unlocked_waters"])
    pool = {f["id"] for k in keys for f in FISH_BY_WATER.get(k, []) if f["rarity"] in REACHABLE_RARITIES}
    known = {j["species_id"] for j in await db.journal.find({"user_id": str(u["_id"]), "species_id": {"$in": list(pool)}}, {"species_id": 1}).to_list(len(pool) or 1)}
    return len(pool & known), len(pool - known)


async def settle_exhausted_discovery_quests(u):
    """'Discover N new species' must stay possible. Story: counts the journal, so anglers who already know N species there (or everything there is) hand it in.
    Daily/weekly: nothing reachable left -> completed and paid; weekly asking for more than is left -> target trimmed to what remains."""
    dkey, _, _ = quest_period("daily"); wkey, _, _ = quest_period("weekly")
    active = await db.quests.find({"user_id": str(u["_id"]), "status": "active", "objective.filter.new_species": True,
                                   "$or": [{"kind": "story"}, {"kind": "daily", "period": dkey}, {"kind": "weekly", "period": wkey}]}).to_list(30)
    daily_done = False
    for q in active:
        known, left = await discovery_scope(u, q["objective"]["filter"].get("water"))
        if q["kind"] == "story":
            if left > 0 and known < q["target"]: continue
        else:
            if left > 0 and q["target"] - q["progress"] > left:
                await db.quests.update_one({"_id": q["_id"], "status": "active"}, {"$set": {"target": q["progress"] + left, "desc": q["desc"].replace(f"{q['target']:,}", f"{q['progress'] + left:,}"), "settled": "trimmed"}})
            if left > 0: continue
        r = await db.quests.update_one({"_id": q["_id"], "status": "active"}, {"$set": {"progress": q["target"], "status": "done", "done_at": iso(now()), "settled": "exhausted"}})
        if r.modified_count:
            await grant_quest_reward(u, {**q["reward"], "pearls": q["reward"].get("pearls", default_pearls(q))}, q["name"], q["kind"])
            daily_done = daily_done or q["kind"] == "daily"
            await send_system_message(u["_id"], u["username"], f"'{q['name']}' asked you to discover new species, your journal already holds every page you could reasonably find. The schoolmistress marks it complete; reward paid.")
    if daily_done: await update_streak(u)


async def story_state(u):
    await settle_exhausted_discovery_quests(u)
    rows = {r["quest_id"]: r for r in await db.quests.find({"user_id": str(u["_id"]), "kind": "story"}).to_list(100)}
    level, _ = level_from_xp(u["xp"])
    out, prev_done = [], True
    for q in STORY_QUESTS:
        r = rows.get(q["id"])
        if r: status, prog = r["status"], r["progress"]
        elif prev_done and level >= q["level"]: status, prog = "available", 0
        elif prev_done: status, prog = "level_locked", 0
        else: status, prog = "locked", 0
        out.append({"id": q["id"], "kind": "story", "name": q["name"], "level": q["level"], "story": q["story"], "desc": q["desc"], "reward": q["reward"],
                    "target": q["target"], "progress": round(prog, 2), "status": status, "done_at": r.get("done_at") if r else None})
        prev_done = bool(r and r["status"] == "done")
    return out


async def guest_state(u):
    rows = {r["quest_id"]: r for r in await db.quests.find({"user_id": str(u["_id"]), "kind": "guest"}).to_list(20)}
    if not rows:
        return []
    out = []
    for q in GUEST_QUESTS:
        r = rows.get(q["id"])
        if not r: continue
        out.append({"id": q["id"], "kind": "guest", "step": q["step"], "name": q["name"], "story": q["story"], "desc": q["desc"],
                    "reward": q["reward"], "target": q["target"], "progress": round(r["progress"], 2), "status": r["status"],
                    "done_at": r.get("done_at")})
    return out


@api.get("/quests/summary")
async def quests_summary(user=Depends(get_current_user)):
    st = await story_state(user)
    ready = sum(1 for q in st if q["status"] == "available")
    gs = await guest_state(user)
    guest_open = sum(1 for q in gs if q["status"] in ("active", "locked"))
    return {"story_ready": ready, "guest_open": guest_open}


@api.get("/quests")
async def quests(request: Request, user=Depends(get_current_user)):
    for kind in ("daily", "weekly"):
        await ensure_periodic_quests(user, kind)
    await settle_exhausted_discovery_quests(user)
    dkey, _, dend = quest_period("daily"); wkey, _, wend = quest_period("weekly")
    daily = [quest_out(q) for q in await db.quests.find({"user_id": str(user["_id"]), "kind": "daily", "period": dkey}).sort("created_at", 1).to_list(10)]
    weekly = [quest_out(q) for q in await db.quests.find({"user_id": str(user["_id"]), "kind": "weekly", "period": wkey}).sort("created_at", 1).to_list(10)]
    s = user.get("quest_streak") or {"count": 0, "last_day": None}
    streak = s["count"] if s.get("last_day") == dkey or streak_alive(s, dkey) else 0
    level, _ = level_from_xp(user["xp"])
    return localize({"guest": await guest_state(user), "story": await story_state(user),
            "daily": {"period": dkey, "ends_at": iso(dend), "quests": daily}, "weekly": {"period": wkey, "ends_at": iso(wend), "quests": weekly},
            "streak": {"count": streak, "today_done": s.get("last_day") == dkey, "days": STREAK_DAYS, "bonus": streak_bonus(level)},
            "completed": user.get("stats", {}).get("quests_done", 0)}, request)


@api.post("/quests/{quest_id}/accept")
async def accept_quest(quest_id: str, user=Depends(get_current_user)):
    q = STORY_BY_ID.get(quest_id)
    if not q: raise HTTPException(404, "No such quest")
    st = next(s for s in await story_state(user) if s["id"] == quest_id)
    if st["status"] == "level_locked": raise HTTPException(400, f"You need level {q['level']} for this quest")
    if st["status"] != "available": raise HTTPException(400, "That quest isn't available to you right now")
    doc = {"user_id": str(user["_id"]), "quest_id": q["id"], "kind": "story", "period": None, "name": q["name"], "desc": q["desc"], "story": q["story"],
           "objective": q["objective"], "target": q["target"], "progress": 0, "reward": q["reward"], "status": "active", "created_at": iso(now())}
    try:
        await db.quests.insert_one(doc)
    except Exception:
        raise HTTPException(400, "Already accepted")
    return {"story": await story_state(user)}


# ---------- Seed ----------
NIELS_PASSWORD = "CHANGE_ME"


async def seed_world():
    # Production world: one anchor angler, Niels (admin). Everyone else is a real player.
    niels = await db.users.find_one({"username_lc": "niels"})
    if niels:
        if niels.get("role") != "admin":
            await db.users.update_one({"_id": niels["_id"]}, {"$set": {"role": "admin"}})
        return
    logger.info("Seeding Niels (admin)...")
    doc = new_user_doc("Niels", hash_password(NIELS_PASSWORD))
    doc["seeded"] = True
    doc["is_admin_seed"] = True
    doc["role"] = "admin"
    await db.users.insert_one(doc)


async def cleanup_legacy_world():
    # One-time: remove the old fake residents and the retired Admin/AdminTest accounts from any database.
    if await db.meta.find_one({"key": "legacy_cleanup_v1"}):
        return
    from admin_tools import purge_user
    flt = {"username_lc": {"$ne": "niels"}, "$or": [{"seeded": True}, {"demo": True}, {"username_lc": {"$in": ["admin", "admintest"]}}]}
    legacy = await db.users.find(flt).to_list(2000)
    for u in legacy:
        await purge_user(u)
    if legacy:
        logger.info("Legacy cleanup removed %d accounts: %s", len(legacy), ", ".join(u["username"] for u in legacy[:10]))
    await db.meta.insert_one({"key": "legacy_cleanup_v1", "at": iso(now()), "removed": [u["username"] for u in legacy]})


LANTERNBAY_IDS = list(range(400, 416))


async def cleanup_lanternbay():
    # One-time: Lantern Bay (Angler Pass water) was retired. Its 16 species leave every journal, keepnet, trophy wall, listing and record.
    if await db.meta.find_one({"key": "lanternbay_cleanup_v1"}): return
    flt = {"species_id": {"$in": LANTERNBAY_IDS}}
    await db.listings.update_many({"kind": "fish", "status": "open", "item.species_id": {"$in": LANTERNBAY_IDS}}, {"$set": {"status": "cancelled", "retired": True}})
    counts = {c: (await getattr(db, c).delete_many(flt)).deleted_count for c in ("journal", "catches", "catch_log")}
    moved = await db.users.update_many({"water": "lanternbay"}, {"$set": {"water": "millbrook", "at_pond": None}})
    await db.users.update_many({}, {"$pull": {"unlocked_waters": "lanternbay"}})
    await db.feed.delete_many({"text": {"$regex": "Lantern Bay"}})
    logger.info("Lantern Bay retired: %s, %d anglers moved to Millbrook", counts, moved.modified_count)
    await db.meta.insert_one({"key": "lanternbay_cleanup_v1", "at": iso(now()), **counts})


POND_UPGRADE_COSTS = {"dredge": [150_000, 500_000, 1_500_000], "hatchery": [400_000, 1_200_000, 3_000_000], "lanterns": [250_000], "boathouse": [600_000],
                      "plaque": [200_000, 750_000, 2_000_000], "reeds": [100_000], "willow": [150_000], "posts": [200_000], "wall": [400_000], "pennant": [150_000]}


async def retire_ponds():
    # One-time: Player Ponds were retired. Owners get their plot, upgrades, sign and upkeep back in gold and their stocked fish back in the keepnet.
    if await db.meta.find_one({"key": "ponds_retired_v1"}): return
    refunds = []
    async for p in db.ponds.find({}):
        ups = p.get("upgrades") or {}
        gold = 250_000 + sum(sum(c[:int(ups.get(k) or 0)]) for k, c in POND_UPGRADE_COSTS.items()) + (25_000 if p.get("sign") else 0)
        created, due = datetime.fromisoformat(p["created_at"]), datetime.fromisoformat(p.get("upkeep_due") or p["created_at"])
        gold += 25_000 * max(0, round((min(due, now() + timedelta(days=7)) - created).total_seconds() / (7 * 86400)) - 1)
        fish = []
        for st in p.get("stock") or []:
            f = FISH_BY_ID.get(st["species_id"])
            keep = max(0, st.get("count", 0) - st.get("bred", 0))
            if not f or not keep: continue
            for w in (st.get("weights") or [])[:keep]:
                fish.append({"user_id": p["owner_id"], "username": p["owner_name"], "species_id": f["id"], "name": f["name"], "rarity": f["rarity"], "weight": w,
                             "length_cm": round((w ** (1 / 3)) * 38, 1), "variant": "normal", "value": fish_value(f, w, 1.0), "water": p.get("water") or f["water"], "caught_at": iso(now()),
                             "listed": False, "mounted": False, "caught_by": p["owner_id"], "caught_by_name": p["owner_name"]})
        if fish: await db.catches.insert_many(fish)
        await db.users.update_one({"_id": oid(p["owner_id"])}, {"$inc": {"gold": gold}})
        await send_system_message(oid(p["owner_id"]), p["owner_name"], f"Player Ponds have closed for good. The harbour has refunded {gold:,} gold for your pond '{p['name']}' (deed, upgrades and upkeep)"
                                  + (f" and returned {len(fish)} stocked fish to your keepnet." if fish else ".") + " Its strains now swim wild at The Drowned Temple.")
        refunds.append({"owner": p["owner_name"], "gold": gold, "fish": len(fish)})
    await db.pending.delete_many({"pond_id": {"$exists": True}})
    await db.users.update_many({"at_pond": {"$exists": True}}, {"$unset": {"at_pond": ""}})
    retired = await db.ponds.find({}).to_list(None)
    if retired:
        await db.ponds_retired.insert_many(retired)
        await db.ponds.delete_many({"_id": {"$in": [p["_id"] for p in retired]}})
    logger.info("Ponds retired: %s", refunds)
    await db.meta.insert_one({"key": "ponds_retired_v1", "at": iso(now()), "refunds": refunds})


async def repair_duplicate_gear():
    # One-time: players who spammed Buy before purchases were atomic got the same gear pushed several times and paid for each copy.
    if await db.meta.find_one({"key": "dupe_gear_refund_v1"}):
        return
    fixed = []
    async for u in db.users.find({"owned_gear.0": {"$exists": True}}, {"username": 1, "owned_gear": 1, "gold": 1, "pearls": 1}):
        gear = u.get("owned_gear") or []
        if len(gear) == len(set(gear)): continue
        seen, uniq, refund_gold, refund_pearls = set(), [], 0, 0
        for gid in gear:
            if gid in seen:
                g = GEAR_BY_ID.get(gid, {}); refund_gold += g.get("price", 0); refund_pearls += g.get("pearls", 0)
            else:
                seen.add(gid); uniq.append(gid)
        upd = {"$set": {"owned_gear": uniq}, "$inc": {"gold": refund_gold}}
        if refund_pearls: upd["$inc"]["pearls"] = refund_pearls; upd["$inc"]["stats.pearls_spent"] = -refund_pearls
        await db.users.update_one({"_id": u["_id"]}, upd)
        if u.get("gold", 0) + refund_gold < 0:
            await db.users.update_one({"_id": u["_id"]}, {"$set": {"gold": 0}})
        await send_system_message(u["_id"], u["username"], f"The harbourmaster found {len(gear) - len(uniq)} duplicate purchase(s) in your locker from a shop glitch. "
                                  f"The extra copies were removed and {refund_gold:,} gold{f' and {refund_pearls} Pearls' if refund_pearls else ''} refunded to you.")
        fixed.append({"username": u["username"], "dupes": len(gear) - len(uniq), "gold": refund_gold, "pearls": refund_pearls})
    if fixed:
        logger.info("Duplicate gear refund: %s", fixed)
    await db.meta.insert_one({"key": "dupe_gear_refund_v1", "at": iso(now()), "fixed": fixed})


@app.on_event("startup")
async def startup():
    await db.users.create_index("username_lc", unique=True)
    await db.offerwall_tx.create_index([("tx", 1), ("status", 1)], unique=True)
    # one-off migration: duplicate tackle used to be a bare count, now each copy keeps its own enhance + wear
    async for u in db.users.find({"spare_gear": {"$exists": True}}, {"spare_gear": 1}):
        await db.users.update_one({"_id": u["_id"]}, {"$push": {f"spare_copies.{k}": {"$each": [{"enhance": 0, "durability": MAX_DURABILITY}] * v} for k, v in u["spare_gear"].items() if v > 0},
                                                       "$unset": {"spare_gear": ""}} if any(v > 0 for v in u["spare_gear"].values()) else {"$unset": {"spare_gear": ""}})
    # one-off repair: duel losses were counted under a typo key ("losss") before June 2026
    async for u in db.users.find({"duel.losss": {"$exists": True}}, {"duel.losss": 1}):
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"duel.losses": u["duel"]["losss"]}, "$unset": {"duel.losss": ""}})
    await db.users.create_index("email_lc", unique=True, sparse=True)
    await db.users.create_index("guest_ip_hash", sparse=True)
    await db.users.create_index("last_seen")
    await db.users.create_index("xp")
    await db.rate_events.create_index("at", expireAfterSeconds=3600)
    await db.messages.update_many({"from_username": {"$exists": True}}, [{"$set": {"from": "$from_username", "to": "$to_username"}}, {"$unset": ["from_username", "to_username"]}])
    await db.rate_events.create_index([("action", 1), ("key", 1), ("at", -1)])
    await db.users.create_index([("is_guest", 1), ("last_seen", 1)])
    await db.catches.create_index([("user_id", 1), ("listed", 1)])
    await db.journal.create_index([("user_id", 1), ("species_id", 1)], unique=True)
    await db.listings.create_index([("status", 1), ("created_at", -1)])
    await db.listings.create_index([("status", 1), ("item.species_id", 1)])
    await db.catch_log.create_index([("caught_at", -1)])
    await db.catch_log.create_index([("caught_by", 1), ("caught_at", 1)])
    await db.catch_log.create_index([("crew_id", 1), ("caught_at", -1)])
    await db.catch_log.create_index("src", sparse=True)
    await db.catch_log.create_index([("species_id", 1), ("weight", -1)])
    await db.catch_log.create_index([("user_id", 1), ("species_id", 1), ("weight", -1)])
    await db.visits.create_index([("at", -1)])
    await db.visits.create_index([("source", 1), ("at", -1)])
    await db.feed.create_index([("at", -1)])
    await db.chat.create_index([("channel", 1), ("at", -1)])
    await db.chat_reports.create_index("msg_id", unique=True, partialFilterExpression={"status": "open"})
    await db.report_events.create_index([("reporter", 1), ("at", -1)])
    await db.chat.create_index([("channel", 1), ("crew_id", 1), ("at", -1)])
    await db.chat.create_index("dk", unique=True, sparse=True)
    await db.boosts.create_index([("status", 1), ("paid_at", 1)])
    await db.tebex_events.create_index("event_id", unique=True, sparse=True)
    await db.paypal_ipn.create_index([("txn_id", 1), ("payment_status", 1)], unique=True, partialFilterExpression={"verdict": "VERIFIED"})
    await db.crews.create_index("leader_id")
    for f in ("gold", "xp", "stats.species", "stats.catches", "stats.heaviest_kg", "stats.mastery_total"):
        await db.users.create_index([(f, -1)])
    await db.users.create_index("referred_by", sparse=True)
    await db.crews.create_index("members.user_id")
    await db.alerts.create_index([("status", 1), ("end", -1)])
    await db.vote_sites.create_index("key", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.catches.create_index([("caught_at", -1)])
    await db.contests.create_index([("status", 1), ("end", -1)])
    await db.password_resets.create_index("token_hash")
    await db.password_resets.create_index([("user_id", 1), ("at", -1)])
    await db.messages.create_index([("to_id", 1), ("read", 1)])
    await db.messages.create_index([("from_id", 1), ("to_id", 1), ("at", -1)])
    await db.crews.create_index("name_lc", unique=True)
    await db.crews.create_index("tag_lc", unique=True)
    await db.catches.create_index([("crew_id", 1), ("caught_at", -1)])
    await db.alerts.create_index([("at", -1)])
    await db.alerts.create_index("key", unique=True, sparse=True)
    await db.quests.create_index([("user_id", 1), ("quest_id", 1)], unique=True)
    await db.quests.create_index([("user_id", 1), ("status", 1), ("kind", 1), ("period", 1)])
    await db.crew_invites.create_index([("user_id", 1), ("kind", 1), ("status", 1)])
    await db.crew_invites.create_index([("crew_id", 1), ("kind", 1), ("status", 1)])
    await db.friends.create_index([("pair", 1), ("status", 1)])
    await db.boss_kills.create_index([("boss_id", 1), ("weight", -1)])
    await db.boss_kills.create_index([("user_id", 1), ("spawn_key", 1)])
    await db.boss_spawns.create_index([("start", 1), ("end", 1)])
    await db.boss_cancels.create_index("key", unique=True)
    await db.guestbook.create_index([("profile_id", 1), ("at", -1)])
    await db.guestbook.create_index("author_id")
    await db.bounty_claims.create_index([("day_key", 1), ("user_id", 1)], unique=True)
    await db.contracts.create_index([("user_id", 1), ("status", 1)])
    await db.pending.create_index("user_id")
    await db.users.create_index("created_at")
    await db.crew_orders.create_index([("crew_id", 1), ("week", 1)], unique=True)
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index("user_id")
    await db.meta.create_index("key", unique=True)
    await db.vote_tickets.create_index("token", unique=True)
    await db.vote_log.create_index([("user_id", 1), ("site", 1), ("at", -1)])
    await db.vote_log.create_index("month")
    await seed_world()
    await cleanup_legacy_world()
    await news.seed_halloween_news()
    await db.users.update_one({"username_lc": "niels"}, {"$addToSet": {"owned_avatars": "av_niels", "owned_frames": "frame_owner"}})  # owner's personal portrait + frame
    await db.users.update_many({"app_reward_at": {"$exists": True}, "owned_frames": {"$ne": "frame_app"}}, {"$addToSet": {"owned_frames": "frame_app"}})  # earlier app-reward claimers get the frame too
    await db.users.update_one({"username_lc": "niels", "owner_frame_set": {"$ne": True}}, {"$set": {"frame": "frame_owner", "owner_frame_set": True}})  # put it on once
    await cleanup_lanternbay()
    await retire_ponds()
    await db.users.update_many({"lang": {"$exists": True}}, {"$unset": {"lang": ""}})
    await repair_duplicate_gear()
    await ensure_contests()
    await retire_period_dailies()
    await backfill_mastery()
    await backfill_catch_log()
    await dedupe_crew_members()
    await vote.seed_vote_sites()
    await db.vote_awards.create_index("month", unique=True)
    await db.crew_activity.create_index([("crew_id", 1), ("at", -1)])
    await db.users.create_index("duel_week.key")
    import release_news
    await release_news.publish_pending()
    await db.users.update_many({"duel.marks": {"$exists": True}}, {"$unset": {"duel.marks": ""}})  # Duel Marks retired with the ladder rework
    # Boss/expedition watcher: raises the alert and push the moment a window opens, even if nobody is online.
    from push_notifications import notify_energy_full as _notify_energy_full
    async def _watch_loop():
        while True:
            try:
                await asyncio.sleep(60)
                await ensure_boss_alert()
                await ensure_expedition_alert()
                await _notify_energy_full()
                import tournaments as _t
                await _t.ensure_tournaments()
                import crew_boss as _cb
                await _cb.ensure_events()
                await random_events.tick()
                import duel_ladder as _dl
                await _dl.settle_weeks()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("boss watcher failed")
    app.state.watch_task = asyncio.create_task(_watch_loop())


@app.on_event("shutdown")
async def shutdown():
    client.close()


from friends import friend_luck  # noqa: E402
from crew_hall import perk_value, market_cap, crew_max, crew_full  # noqa: E402
from bosses import try_hook_boss, land_boss, current_boss, boss_public, ensure_boss_alert  # noqa: E402
import npcs  # noqa: E402,F401
import login_chest  # noqa: E402,F401
import contracts  # noqa: E402,F401
import crew_orders  # noqa: E402,F401
from bosses import boss_kill_out, MAX_BOSS_MOUNTS  # noqa: E402
import wiki  # noqa: E402,F401
import admin_tools  # noqa: E402,F401
from boosters import xp_multiplier, sell_multiplier, luck_bonus  # noqa: E402
import tutorial  # noqa: E402,F401
import crew_extras  # noqa: E402,F401
import paypal_ipn  # noqa: E402,F401  (registers /api/paypal/ipn)
import cosmetics  # noqa: E402,F401
import duel  # noqa: E402,F401
import duel_live  # noqa: E402,F401
import tournaments  # noqa: E402,F401
import offerwall  # noqa: E402,F401
import enhance  # noqa: E402
import premium  # noqa: E402,F401
import almanac  # noqa: E402,F401
import crew_boss  # noqa: E402,F401
import referrals  # noqa: E402,F401
import guestbook  # noqa: E402,F401
import password_reset  # noqa: E402,F401
import emails  # noqa: E402
import push_notifications  # noqa: E402,F401
import vote  # noqa: E402,F401
import halloween  # noqa: E402
import mailout  # noqa: E402,F401
import social_links  # noqa: E402,F401
import share  # noqa: E402,F401
import leaderboards_period  # noqa: E402,F401
from halloween_data import HALLOW_BITE, HALLOW_IDS, HALLOW_WATER, HALLOW_MYTHIC_MULT, CANDLES as HALLOW_CANDLES  # noqa: E402
import pulse  # noqa: E402,F401
import presence  # noqa: E402,F401
import world_presence  # noqa: E402,F401
import traffic  # noqa: E402,F401
import news  # noqa: E402,F401
import humancheck  # noqa: E402,F401
import botwatch  # noqa: E402
import platform_stats  # noqa: E402,F401
import crates  # noqa: E402,F401
import random_events  # noqa: E402
import moderation  # noqa: E402
import testwater  # noqa: E402
# sig_images (forum signatures) not used in FishyLand
import cosmetic_shop  # noqa: E402,F401

app.include_router(api)
# Echo the caller's origin explicitly: "*" is rejected by browsers when credentials (cookies) are enabled,
# which broke public requests such as /game/data on the custom domain before login.
_origins = [o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()]
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=[o for o in _origins if o != "*"],
                   allow_origin_regex=".*" if "*" in _origins else None,
                   allow_methods=["*"], allow_headers=["*"])
