"""Salvage & enhancement: trash hauled up on empty casts is recycled into Tackle Scrap, which (with gold) enhances rods, reels and lines +1…+10.
Every level is +2% to the item's fight stat; rods add +1 luck per even level, reels +1% vendor value per level, lines +1% XP per level.
Upgrades past +1 can fail (scrap and gold lost; from +6 the item also drops a level) unless a Harbourmaster's Seal (Pearls) is spent."""
import random
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import api, db, now, iso, get_current_user, public_user, charge, add_feed, check_achievements, GEAR_BY_ID

TRASH = [
    {"id": "trash_boot", "name": "Waterlogged Boot", "scrap": 1, "weight": 30, "deep_weight": 18, "desc": "Somebody's left foot, or what the eels left of it."},
    {"id": "trash_bottle", "name": "Glass Bottle", "scrap": 1, "weight": 28, "deep_weight": 18, "desc": "Corked. Sometimes there's something inside."},
    {"id": "trash_line", "name": "Tangled Line", "scrap": 2, "weight": 20, "deep_weight": 16, "desc": "A bird's nest of old nylon and a lost sinker."},
    {"id": "trash_hook", "name": "Rusty Hook", "scrap": 3, "weight": 12, "deep_weight": 20, "desc": "Bent, barbed and older than you."},
    {"id": "trash_plank", "name": "Driftwood Plank", "scrap": 3, "weight": 10, "deep_weight": 16, "desc": "Good hardwood under the barnacles."},
    {"id": "trash_chain", "name": "Anchor Chain Link", "scrap": 5, "weight": 0, "deep_weight": 12, "desc": "Heavy iron from some forgotten wreck. Deep waters only."},
]
TRASH_BY_ID = {t["id"]: t for t in TRASH}
TRASH_CHANCE = 0.12  # share of "nothing bites" casts that haul up trash instead
DEEP_WATERS = {"harrow", "coral", "frozen", "sunken", "ghostlight", "cinder"}
BOTTLE_GOLD_CHANCE, BOTTLE_GOLD = 0.05, (25, 250)
BOTTLE_SEAL_CHANCE = 0.001
MAX_LEVEL = 10
SUCCESS = {1: 100, 2: 90, 3: 80, 4: 70, 5: 60, 6: 50, 7: 40, 8: 30, 9: 25, 10: 20}
DROP_FROM = 6  # a failed attempt at this target level or higher knocks the item down one level
STAT_PER_LEVEL = 0.02
SEAL = {"id": "seal", "name": "Harbourmaster's Seal", "desc": "The Harbourmaster's own wax seal on an enhancement order. Spend one on an upgrade and it cannot fail. One Seal per attempt."}
TRASH_LINES = ["Something heavy drags on the line... it's a {name}.", "No fish, but you haul up a {name}.", "The hook snags. Up comes a {name}.", "A dull weight, no fight at all: a {name}."]


def roll_trash(water_key):
    deep = water_key in DEEP_WATERS
    w = [t["deep_weight"] if deep else t["weight"] for t in TRASH]
    return random.choices(TRASH, weights=w)[0]


def level(u, gear_id):
    return int((u.get("enhance") or {}).get(gear_id, 0))


def stat_mult(u, gear_id):
    return 1 + STAT_PER_LEVEL * level(u, gear_id)


def bonuses(u):
    """Extra perks from enhancement on the equipped set: rod luck, reel vendor %, line XP %."""
    g = u["gear"]
    return {"luck": level(u, g["rod"]) // 2, "value_pct": level(u, g["reel"]), "xp_pct": level(u, g["line"])}


def cost_for(gear, target):
    return {"scrap": 8 * target * target, "gold": int(max(50, gear["price"] * 0.10) * target), "chance": SUCCESS[target], "drops_on_fail": target >= DROP_FROM}


def perk_text(slot, lvl):
    stat = f"+{lvl * 2}% {'power & control' if slot == 'rod' else 'recovery' if slot == 'reel' else 'tolerance'}"
    extra = f"+{lvl // 2} luck" if slot == "rod" else f"+{lvl}% vendor price" if slot == "reel" else f"+{lvl}% XP"
    return f"{stat} · {extra}"


def gear_view(u):
    out = []
    for gid in u.get("owned_gear", []):
        g = GEAR_BY_ID.get(gid)
        if not g: continue
        lvl, slot = level(u, gid), gid.split("_")[0]
        out.append({"id": gid, "name": g["name"], "tier": g["tier"], "slot": slot, "level": lvl, "equipped": u["gear"].get(slot) == gid,
                    "perks": perk_text(slot, lvl) if lvl else None, "next": {**cost_for(g, lvl + 1), "perks": perk_text(slot, lvl + 1)} if lvl < MAX_LEVEL else None})
    return out


def state(u):
    salvage = {k: v for k, v in (u.get("salvage") or {}).items() if v > 0}
    return {"gear": gear_view(u), "scrap": int(u.get("scrap", 0)), "salvage": salvage, "seals": int((u.get("items") or {}).get("seal", 0)),
            "trash": [{k: t[k] for k in ("id", "name", "scrap", "desc")} for t in TRASH], "seal": SEAL, "max_level": MAX_LEVEL, "success_table": SUCCESS, "drop_from": DROP_FROM, "stat_per_level": STAT_PER_LEVEL}


@api.get("/enhance")
async def get_state(user=Depends(get_current_user)):
    return state(user)


class RecycleIn(BaseModel):
    trash_id: Optional[str] = None


@api.post("/enhance/recycle")
async def recycle(body: RecycleIn, user=Depends(get_current_user)):
    raise HTTPException(410, "Tackle enhancement has been retired")
    have = {k: v for k, v in (user.get("salvage") or {}).items() if v > 0 and k in TRASH_BY_ID}
    if body.trash_id:
        if body.trash_id not in have: raise HTTPException(400, "You have none of that to recycle")
        have = {body.trash_id: have[body.trash_id]}
    if not have: raise HTTPException(400, "Nothing to recycle, trash turns up now and then on empty casts")
    scrap = sum(TRASH_BY_ID[k]["scrap"] * n for k, n in have.items())
    gold = sum(random.randint(*BOTTLE_GOLD) for _ in range(have.get("trash_bottle", 0)) if random.random() < BOTTLE_GOLD_CHANCE)
    seals = sum(1 for _ in range(have.get("trash_bottle", 0)) if random.random() < BOTTLE_SEAL_CHANCE)
    inc = {"scrap": scrap, "stats.recycled": sum(have.values()), **{f"salvage.{k}": -n for k, n in have.items()}}
    if gold: inc["gold"] = gold; inc["stats.gold_earned"] = gold
    if seals: inc["items.seal"] = seals; inc["stats.seals_earned"] = seals
    r = await db.users.update_one({"_id": user["_id"], **{f"salvage.{k}": {"$gte": n} for k, n in have.items()}}, {"$inc": inc})
    if not r.matched_count: raise HTTPException(409, "Your salvage changed, try again")
    u = await db.users.find_one({"_id": user["_id"]})
    msg = f"Recycled {sum(have.values())} item{'s' if sum(have.values()) != 1 else ''} into {scrap} Tackle Scrap."
    if gold: msg += f" A bottle held a note wrapped round {gold} gold!"
    if seals: msg += f" And one bottle held a Harbourmaster's Seal, a genuine one!"
    return {**state(u), "scrap_gained": scrap, "gold_found": gold, "seals_found": seals, "message": msg, "user": public_user(u)}


class UpgradeIn(BaseModel):
    gear_id: str
    use_seal: bool = False


@api.post("/enhance/upgrade")
async def upgrade(body: UpgradeIn, user=Depends(get_current_user)):
    raise HTTPException(410, "Tackle enhancement has been retired")
    g = GEAR_BY_ID.get(body.gear_id)
    if not g or body.gear_id not in user.get("owned_gear", []): raise HTTPException(404, "You don't own that tackle")
    lvl = level(user, body.gear_id)
    if lvl >= MAX_LEVEL: raise HTTPException(400, f"That's already +{MAX_LEVEL}, it can't go higher")
    target = lvl + 1
    c = cost_for(g, target)
    if user.get("scrap", 0) < c["scrap"]: raise HTTPException(400, f"You need {c['scrap']} Tackle Scrap for +{target} (you have {user.get('scrap', 0)})")
    if user["gold"] < c["gold"]: raise HTTPException(400, f"You need {c['gold']:,} gold for +{target}")
    use_seal = body.use_seal and c["chance"] < 100
    if use_seal and (user.get("items") or {}).get("seal", 0) < 1: raise HTTPException(400, "You have no Harbourmaster's Seal")
    ok = use_seal or random.randint(1, 100) <= c["chance"]
    new_lvl = target if ok else (lvl - 1 if c["drops_on_fail"] else lvl)
    inc = {"scrap": -c["scrap"], "stats.enhance_attempts": 1}
    if ok: inc["stats.enhanced"] = 1
    if use_seal: inc["items.seal"] = -1; inc["stats.seals_used"] = 1
    flt = {"scrap": {"$gte": c["scrap"]}, f"enhance.{body.gear_id}": {"$in": [lvl] if lvl else [0, None]}}
    if use_seal: flt["items.seal"] = {"$gte": 1}
    await charge(user, {"$inc": inc, "$set": {f"enhance.{body.gear_id}": new_lvl}}, gold=c["gold"], extra=flt, msg="Not enough gold, scrap or Seals, or the item just changed")
    u = await db.users.find_one({"_id": user["_id"]})
    name = f"{g['name']} +{new_lvl}" if new_lvl else g["name"]
    if ok:
        msg = f"Success! Your {g['name']} is now +{new_lvl}." + (" The Harbourmaster's Seal held." if use_seal else "")
        if new_lvl == MAX_LEVEL:
            await add_feed("enhance", u["username"], f"{u['username']} forged a {g['name']} to +{MAX_LEVEL}. The finest tackle the harbour has seen.", "legendary")
        elif new_lvl >= 7:
            await add_feed("enhance", u["username"], f"{u['username']} enhanced a {g['name']} to +{new_lvl}.", "epic")
    else:
        msg = f"The enhancement failed. {c['scrap']} scrap and {c['gold']:,} gold are lost" + (f", and the {g['name']} slipped back to +{new_lvl}." if c["drops_on_fail"] else ".")
    new_ach = await check_achievements(user["_id"])
    if new_ach: u = await db.users.find_one({"_id": user["_id"]})
    return {**state(u), "success": ok, "level": new_lvl, "name": name, "message": msg, "used_seal": use_seal, "new_achievements": new_ach, "user": public_user(u)}
