"""Daily Spin (replaces the old harbour chest): one spin per UTC day on a 7-day ladder; day 7 spins the Better Wheel."""
import random
from datetime import timedelta

from fastapi import Depends

from server import (api, db, now, iso, get_current_user, public_user, level_from_xp, add_feed, quest_period, settle_level_up, catch_ledger,
                    roll_weight, fish_value, BAIT_BY_ID, ING_BY_ID, INGREDIENTS, BAITS, FISH, VARIANTS)

CRATE_NAMES = {"crate_bronze": "Bronze Crate", "crate_silver": "Silver Crate"}
GUEST_CRATE_GOLD = {"crate_bronze": 2500, "crate_silver": 10000}
JACKPOT_VARIANTS = ["albino", "golden"]

# (id, kind, amount, weight, rarity). Gold/XP amounts are base values that scale with level; weights sum to 100.
WHEEL = [
    ("gold_s", "gold", 150, 30, "common"), ("xp", "xp", 60, 15, "common"), ("bait", "bait", 8, 12, "common"), ("gold_m", "gold", 400, 15, "uncommon"),
    ("ingredient", "ingredient", 3, 10, "common"), ("scrap", "scrap", 40, 10, "uncommon"), ("potion", "potion", 1, 6, "rare"), ("crate", "crate_bronze", 1, 2, "epic"),
]
BETTER_WHEEL = [
    ("gold_l", "gold", 1500, 22, "uncommon"), ("xp_l", "xp", 200, 16, "uncommon"), ("crafted", "crafted", 4, 14, "rare"), ("pearls", "pearls", 3, 12, "rare"),
    ("scrap_l", "scrap", 200, 10, "rare"), ("potion_l", "potion", 3, 8, "epic"), ("gold_xl", "gold", 4000, 7, "epic"), ("bronze", "crate_bronze", 1, 3, "epic"),
    ("silver", "crate_silver", 1, 4, "legendary"), ("jackpot", "mythic", 1, 4, "mythic"),
]
for _w in (WHEEL, BETTER_WHEEL): assert sum(s[3] for s in _w) == 100


def _segment(seg, level, rnd, guest):
    sid, kind, amt, w, rarity = seg
    out = {"id": sid, "kind": kind, "weight": w, "rarity": rarity, "qty": amt}
    if kind == "gold": out.update(qty=int(amt * (1 + level / 25)) // 5 * 5, label=None)
    elif kind == "xp": out["qty"] = int(amt * (1 + level / 30))
    elif kind == "bait": out.update(item="bait_live", name=BAIT_BY_ID["bait_live"]["name"])
    elif kind == "crafted":
        b = rnd.choice([b for b in BAITS if b.get("crafted")]); out.update(item=b["id"], name=b["name"])
    elif kind == "ingredient":
        i = rnd.choice(INGREDIENTS); out.update(item=i["id"], name=ING_BY_ID[i["id"]]["name"])
    elif kind == "potion": out["name"] = "Energy Potion"
    elif kind.startswith("crate_"):
        if guest: out.update(kind="gold", qty=GUEST_CRATE_GOLD[kind], guest_swap=True)
        else: out["name"] = CRATE_NAMES[kind]
    elif kind == "mythic": out["name"] = "Mythic fish (rare variant)"
    out["label"] = label(out)
    return out


def label(s):
    k, q = s["kind"], s["qty"]
    if k == "gold": return f"{q:,} gold"
    if k == "xp": return f"{q:,} XP"
    if k == "pearls": return f"{q} Pearls"
    if k == "scrap": return f"{q:,} scrap"
    if k == "mythic": return "Mythic jackpot"
    return f"{q}× {s['name']}" if q > 1 else s["name"]


def spin_state(u):
    day_key, _, end = quest_period("daily")
    yesterday = (now() - timedelta(days=1)).strftime("%Y-%m-%d")
    lc = u.get("login_chest") or {"day": 0, "last_claim": None}
    claimed_today = lc.get("last_claim") == day_key
    current = lc["day"] if claimed_today else (lc["day"] % 7 + 1 if lc.get("last_claim") == yesterday else 1)
    level, _ = level_from_xp(u["xp"])
    rnd = random.Random(f"{u['_id']}:{day_key}")
    better = current == 7
    segs = [_segment(s, level, rnd, u.get("is_guest")) for s in (BETTER_WHEEL if better else WHEEL)]
    return {"day": current, "better": better, "claimed_today": claimed_today, "day_key": day_key, "resets_at": iso(end),
            "segments": segs, "last": lc.get("last_result") if claimed_today else None, "level": level}


async def _grant_mythic(u):
    from fish_grant import grant_fish
    f = random.choice([f for f in FISH if f["rarity"] == "mythic"])
    return await grant_fish(u, f, random.choice(JACKPOT_VARIANTS), "spin", "{name} hit the Better Wheel jackpot".replace("{name}", u["username"]) + ": a {variant} {name} ({weight} kg)!")


async def _apply(u, seg):
    k, q = seg["kind"], seg["qty"]
    inc = {"stats.chests_opened": 1, "stats.spins": 1}
    if k == "gold": inc.update({"gold": q, "stats.gold_earned": q})
    elif k == "xp": inc["xp"] = q
    elif k == "pearls": inc.update({"pearls": q, "stats.pearls_earned": q})
    elif k == "scrap": inc["scrap"] = q
    elif k == "potion": inc["items.potion_energy"] = q
    elif k in ("bait", "crafted"): inc[f"bait.{seg['item']}"] = q
    elif k == "ingredient": inc[f"ingredients.{seg['item']}"] = q
    await db.users.update_one({"_id": u["_id"]}, {"$inc": inc})
    if k.startswith("crate_"):
        from crates import grant_crate
        await grant_crate(u["_id"], u["username"], k, "Daily Spin")
    if k == "mythic":
        return await _grant_mythic(u)
    return None


def _public(s):
    return {k: v for k, v in s.items() if k != "day_key"}


@api.get("/daily-spin")
async def daily_spin(user=Depends(get_current_user)):
    return _public(spin_state(user))


login_chest = daily_spin  # pulse.py polls this for the "unclaimed" dot


@api.post("/daily-spin/spin")
async def spin(user=Depends(get_current_user)):
    s = spin_state(user)
    if s["claimed_today"]:
        return {"spun": False, "message": "You already spun today. Come back after the reset.", "state": _public(s)}
    idx = random.choices(range(len(s["segments"])), weights=[x["weight"] for x in s["segments"]])[0]
    seg = s["segments"][idx]
    result = {"index": idx, "id": seg["id"], "label": seg["label"], "rarity": seg["rarity"], "better": s["better"], "day": s["day"]}
    res = await db.users.update_one({"_id": user["_id"], "$or": [{"login_chest.last_claim": {"$ne": s["day_key"]}}, {"login_chest": {"$exists": False}}]},
                                    {"$set": {"login_chest": {"day": s["day"], "last_claim": s["day_key"], "last_result": result}}})
    if res.modified_count == 0:
        return {"spun": False, "message": "You already spun today.", "state": _public(s)}
    fish = await _apply(user, seg)
    if fish:
        result["fish"] = fish
        result["label"] = f"{fish['name']} ({fish['variant']}, {fish['weight']} kg)"
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"login_chest.last_result": result}})
    elif seg["rarity"] in ("legendary",):
        await add_feed("spin", user["username"], f"{user['username']} won a {seg['label']} on the Better Wheel.", seg["rarity"])
    level_up = await settle_level_up(user["_id"], level_from_xp(user["xp"])[0])
    u = await db.users.find_one({"_id": user["_id"]})
    return {"spun": True, "result": result, "state": _public(spin_state(u)), "user": public_user(u), "level_up": level_up}
