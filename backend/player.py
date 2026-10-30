import time
from datetime import datetime, timezone

from game_data import (BASE_STAMINA, STAMINA_REGEN_SEC, GEAR_SLOTS, gear_def, xp_needed, WINGS_BR, PET_BR,
                       FISHDEX_BR, LEVEL_BR, MAX_LEVEL)
from db import db


def new_player(username, email, password_hash, is_guest):
    now = time.time()
    return {
        "username": username, "username_lower": username.lower(), "email": email, "password_hash": password_hash,
        "is_guest": is_guest, "role": "player", "level": 1, "xp": 0, "gold": 1000, "diamonds": 0,
        "bound_diamonds": 100, "vip_points": 0, "vip_level": 0, "stamina": BASE_STAMINA, "stamina_at": now,
        "gear": {s: 1 for s in GEAR_SLOTS},
        "owned_gear": {s: {"1": {"enh": 0, "dur": gear_def(s, 1)["dur"]}} for s in GEAR_SLOTS},
        "items": {"glow_shrimp": 10, "stamina_potion": 2, "enhance_stone": 5},
        "equipped": {"wings": "seraph_wings", "pet": "tide_fox", "mount": None, "fashion": None, "rod_skin": None, "title": "Novice Angler"},
        "stats": {"casts": 0, "catches": 0, "lost": 0},
        "last_cast_at": 0, "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": datetime.now(timezone.utc).isoformat(), "ip_log": [], "banned": False, "bot": {"status": "clear"},
    }


def max_stamina(u):
    return BASE_STAMINA


def current_stamina(u, now=None):
    now = now or time.time()
    st, at, mx = u["stamina"], u["stamina_at"], max_stamina(u)
    if st >= mx:
        return st, now
    regen = int((now - at) // STAMINA_REGEN_SEC)
    st = min(mx, st + regen)
    return st, (at + regen * STAMINA_REGEN_SEC if st < mx else now)



def gear_info(u, slot, tier=None):
    tier = tier or u["gear"][slot]
    g = gear_def(slot, tier)
    o = u["owned_gear"][slot][str(tier)]
    mult = 1 + 0.03 * o["enh"]
    broken = o["dur"] <= 0
    return {**g, "slot": slot, "enh": o["enh"], "cur_dur": o["dur"], "broken": broken,
            "effective": round(g["stat"] * mult * (0.5 if broken else 1.0), 4),
            "br_value": int(g["br"] * (1 + 0.12 * o["enh"]))}


def compute_br(u, fishdex_count):
    gear = sum(gear_info(u, s)["br_value"] for s in GEAR_SLOTS)
    parts = {"level": u["level"] * LEVEL_BR, "gear": gear, "wings": WINGS_BR if u["equipped"].get("wings") else 0,
             "pet": PET_BR if u["equipped"].get("pet") else 0, "fishdex": fishdex_count * FISHDEX_BR}
    return sum(parts.values()), parts


def add_xp(u, amount):
    """Mutates u; returns number of levels gained."""
    u["xp"] += amount
    gained = 0
    while u["level"] < MAX_LEVEL and u["xp"] >= xp_needed(u["level"]):
        u["xp"] -= xp_needed(u["level"])
        u["level"] += 1
        gained += 1
        mx = max_stamina(u)
        u["stamina"] = min(2 * mx, u["stamina"] + mx)
    return gained


async def player_state(u):
    fd = await db.fishdex.count_documents({"user_id": str(u["_id"])})
    st, _ = current_stamina(u)
    br, parts = compute_br(u, fd)
    mx = max_stamina(u)
    next_sec = 0 if st >= mx else int(STAMINA_REGEN_SEC - ((time.time() - u["stamina_at"]) % STAMINA_REGEN_SEC))
    return {
        "id": str(u["_id"]), "username": u["username"], "email": u.get("email"), "is_guest": u.get("is_guest", False),
        "role": u.get("role", "player"), "level": u["level"], "xp": u["xp"], "xp_need": xp_needed(u["level"]),
        "gold": u["gold"], "diamonds": u["diamonds"], "bound_diamonds": u["bound_diamonds"],
        "vip_level": u.get("vip_level", 0), "stamina": st, "stamina_max": mx, "stamina_next_sec": next_sec,
        "br": br, "br_parts": parts, "gear": {s: gear_info(u, s) for s in GEAR_SLOTS},
        "owned_gear": u["owned_gear"], "items": u.get("items", {}), "equipped": u.get("equipped", {}),
        "fishdex_count": fd, "stats": u.get("stats", {}),
    }
