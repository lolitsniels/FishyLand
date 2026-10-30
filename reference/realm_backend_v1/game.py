import random
import time
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db
from game_data import (SPECIES, SPECIES_BY_ID, RARITY_WEIGHT, RARITY_XP, RARITY_TIME, VARIANTS, BEHAVIOR_TRICKS,
                       ITEMS, GEAR, GEAR_SLOTS, ENHANCE_CHANCE, ENHANCE_MAX, gear_def, public_data)
from player import current_stamina, max_stamina, gear_info, add_xp, player_state
from sim import simulate, DT

router = APIRouter(prefix="/api")
CAST_COOLDOWN = 1.5
FIGHT_DELAY = 0.6


def _oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(400, "Invalid id")


async def _save(u: dict, fields: List[str]):
    rev = u.get("rev")
    res = await db.users.update_one({"_id": u["_id"], "rev": rev}, {"$set": {**{f: u[f] for f in fields}, "rev": (rev or 0) + 1}})
    if res.matched_count == 0:
        raise HTTPException(409, "Another action was in progress - please try again")
    u["rev"] = (rev or 0) + 1


@router.get("/game/data")
async def game_data():
    return public_data()


@router.get("/player")
async def get_player(u: dict = Depends(get_current_user)):
    return await player_state(u)


class CastIn(BaseModel):
    bait: str = "worm"
    water: str = "crystal_lagoon"


def _roll_species(water: str, bait: str):
    luck = ITEMS[bait].get("luck", 0.0)
    pool = [s for s in SPECIES if s["water"] == water]
    weights = []
    for s in pool:
        w = RARITY_WEIGHT[s["rarity"]] / max(1, sum(1 for x in pool if x["rarity"] == s["rarity"]))
        if s["rarity"] not in ("common", "uncommon"):
            w *= 1 + luck
        if s["bait"] == bait:
            w *= 1.5
        weights.append(w)
    return random.choices(pool, weights=weights)[0]


def _roll_variant():
    r = random.random()
    acc = 0.0
    for v in VARIANTS:
        acc += v["chance"]
        if r < acc:
            return v
    return None


def _tricks(species, limit):
    n = {"common": 0, "uncommon": 1, "rare": 1, "epic": 2, "legendary": 3, "mythic": 4}[species["rarity"]]
    kinds = BEHAVIOR_TRICKS[species["behavior"]]
    return sorted([{"at": random.randint(60, int(limit * 0.8)), "dur": random.randint(18, 42), "kind": random.choice(kinds)}
                   for _ in range(n)], key=lambda t: t["at"])


@router.post("/fish/cast")
async def cast(body: CastIn, u: dict = Depends(get_current_user)):
    if body.bait not in ITEMS or ITEMS[body.bait]["kind"] != "bait":
        raise HTTPException(400, "Unknown bait")
    if body.water != "crystal_lagoon":
        raise HTTPException(400, "This water is not open yet")
    now = time.time()
    if now - u.get("last_cast_at", 0) < CAST_COOLDOWN:
        raise HTTPException(429, "Casting too fast")
    st, at = current_stamina(u, now)
    if st < 1:
        raise HTTPException(400, "Out of stamina")
    if body.bait != "worm":
        if u["items"].get(body.bait, 0) < 1:
            raise HTTPException(400, "No bait left")
        u["items"][body.bait] -= 1
    await db.encounters.update_many({"user_id": str(u["_id"]), "used": False}, {"$set": {"used": True, "abandoned": True}})

    sp = _roll_species(body.water, body.bait)
    variant = _roll_variant()
    r = random.random()
    wfrac = r * r
    weight = sp["weight"][0] + (sp["weight"][1] - sp["weight"][0]) * wfrac
    if variant and variant["id"] == "giant":
        weight *= 1.8
    rod, reel, line = (gear_info(u, s) for s in GEAR_SLOTS)
    limit = RARITY_TIME[sp["rarity"]] * 30
    params = {
        "seed": random.randint(1, 2**32 - 1), "strength": round(min(1.1, sp["strength"] * (1 + 0.15 * wfrac)), 4),
        "erratic": sp["erratic"], "power": rod["effective"], "control": reel["effective"], "line": line["effective"],
        "green_w": 0.09, "limit_ticks": limit, "tricks": _tricks(sp, limit),
    }
    bite_delay = (2.0 + random.random() * 6.0) / rod["effective"]
    bite_at = now + bite_delay + FIGHT_DELAY
    doc = {"user_id": str(u["_id"]), "species_id": sp["id"], "weight": round(weight, 2),
           "variant": variant["id"] if variant else None, "params": params, "bait": body.bait,
           "created_at": now, "bite_at": bite_at, "expires_at": bite_at + limit * DT + 60, "used": False}
    res = await db.encounters.insert_one(doc)
    u["stamina"], u["stamina_at"] = st - 1, at
    u["last_cast_at"] = now
    u["stats"]["casts"] = u["stats"].get("casts", 0) + 1
    await _save(u, ["stamina", "stamina_at", "last_cast_at", "items", "stats"])
    return {"encounter_id": str(res.inserted_id), "bite_delay_ms": int(bite_delay * 1000), "fight_delay_ms": int(FIGHT_DELAY * 1000),
            "params": params, "species_id": sp["id"], "rarity": sp["rarity"], "weight": doc["weight"],
            "variant": doc["variant"], "stamina": u["stamina"]}


class LandIn(BaseModel):
    encounter_id: str
    holds: List[List[int]] = Field(default_factory=list, max_length=600)


def _validate_holds(holds, limit):
    held = [False] * limit
    prev = -1
    for iv in holds:
        if len(iv) != 2:
            raise HTTPException(400, "Bad input")
        a, b = iv
        if a < 0 or b <= a or b > limit or a < prev:
            raise HTTPException(400, "Bad input timeline")
        prev = b
        for t in range(a, b):
            held[t] = True
    if len(holds) > limit / 4:
        raise HTTPException(400, "Inhuman input rate")
    return held


@router.post("/fish/land")
async def land(body: LandIn, u: dict = Depends(get_current_user)):
    uid = str(u["_id"])
    enc = await db.encounters.find_one_and_update({"_id": _oid(body.encounter_id), "user_id": uid, "used": False}, {"$set": {"used": True}})
    if not enc:
        raise HTTPException(400, "Encounter invalid or already used")
    now = time.time()
    if now > enc["expires_at"]:
        raise HTTPException(400, "Encounter expired")
    p = enc["params"]
    if not body.holds:
        await db.encounters.update_one({"_id": enc["_id"]}, {"$set": {"rejected": "no_input"}})
        raise HTTPException(400, "No reel input - fight rejected")
    held = _validate_holds(body.holds, p["limit_ticks"])
    outcome, end_tick, green_ticks = simulate(p, held)
    if now < enc["bite_at"] + end_tick * DT - 1.0:
        await db.encounters.update_one({"_id": enc["_id"]}, {"$set": {"rejected": "too_fast"}})
        raise HTTPException(400, "Fight finished faster than possible - rejected")

    for s in GEAR_SLOTS:
        o = u["owned_gear"][s][str(u["gear"][s])]
        loss = 1 + (4 if s == "line" and outcome == "snapped" else 0)
        o["dur"] = max(0, o["dur"] - loss)

    sp = SPECIES_BY_ID[enc["species_id"]]
    result = {"outcome": outcome, "end_tick": end_tick, "fish": None, "xp": 0, "level_ups": 0, "drops": []}
    stats = u["stats"]
    if outcome == "landed":
        variant = next((v for v in VARIANTS if v["id"] == enc["variant"]), None)
        span = sp["weight"][1] - sp["weight"][0]
        frac = min(1.0, max(0.0, (enc["weight"] - sp["weight"][0]) / span)) if span else 0
        value = int(sp["value"] * (0.6 + 0.8 * frac) * (variant["mult"] if variant else 1))
        xp = int(RARITY_XP[sp["rarity"]] * (1 + frac * 0.5) * (1.5 if variant else 1))
        caught_at = datetime.now(timezone.utc).isoformat()
        fish = {"user_id": uid, "species_id": sp["id"], "name": sp["name"], "rarity": sp["rarity"], "weight": enc["weight"],
                "variant": enc["variant"], "value": value, "caught_at": caught_at}
        ins = await db.fish_inventory.insert_one(dict(fish))
        await db.catch_log.insert_one({**fish, "water": sp["water"], "fight_ticks": end_tick, "green_ticks": green_ticks,
                                       "holds": len(body.holds), "cast_to_land": round(now - enc["created_at"], 2)})
        prev = await db.fishdex.find_one({"user_id": uid, "species_id": sp["id"]})
        new_species = prev is None
        await db.fishdex.update_one({"user_id": uid, "species_id": sp["id"]},
                                    {"$inc": {"count": 1}, "$max": {"best_weight": enc["weight"]}, "$setOnInsert": {"first_at": caught_at}}, upsert=True)
        result["level_ups"] = add_xp(u, xp)
        result["xp"] = xp
        stats["catches"] = stats.get("catches", 0) + 1
        if random.random() < 0.12:
            result["drops"].append({"item_id": "enhance_stone", "qty": 1})
        if random.random() < 0.05:
            result["drops"].append({"item_id": "glow_shrimp", "qty": 3})
        for d in result["drops"]:
            u["items"][d["item_id"]] = u["items"].get(d["item_id"], 0) + d["qty"]
        if sp["rarity"] in ("legendary", "mythic"):
            vname = f"{variant['name']} " if variant else ""
            await db.world_feed.insert_one({"kind": "rare_catch", "rarity": sp["rarity"],
                                            "text": f"{u['username']} just caught a {sp['rarity'].title()} {vname}{sp['name']} ({enc['weight']} kg)!",
                                            "created_at": datetime.now(timezone.utc)})
        result["fish"] = {**fish, "id": str(ins.inserted_id), "img": sp["img"], "lore": sp["lore"], "new_species": new_species}
    else:
        stats["lost"] = stats.get("lost", 0) + 1
        result["level_ups"] = add_xp(u, 2)
        result["xp"] = 2
    await _save(u, ["owned_gear", "xp", "level", "stamina", "items", "stats"])
    result["player"] = await player_state(u)
    return result


@router.get("/inventory/fish")
async def list_fish(u: dict = Depends(get_current_user)):
    docs = await db.fish_inventory.find({"user_id": str(u["_id"])}).sort("caught_at", -1).to_list(500)
    return [{**{k: v for k, v in d.items() if k != "_id"}, "id": str(d["_id"]), "img": SPECIES_BY_ID[d["species_id"]]["icon"]} for d in docs]


class SellIn(BaseModel):
    ids: List[str] = Field(default_factory=list)
    all: bool = False


@router.post("/inventory/sell")
async def sell(body: SellIn, u: dict = Depends(get_current_user)):
    q = {"user_id": str(u["_id"])}
    if not body.all:
        if not body.ids:
            raise HTTPException(400, "Nothing selected")
        q["_id"] = {"$in": [_oid(i) for i in body.ids]}
    docs = await db.fish_inventory.find(q, {"value": 1}).to_list(1000)
    if not docs:
        raise HTTPException(400, "Nothing to sell")
    total = sum(d["value"] for d in docs)
    await db.fish_inventory.delete_many({"_id": {"$in": [d["_id"] for d in docs]}})
    u["gold"] += total
    await _save(u, ["gold"])
    return {"sold": len(docs), "gold": total, "player": await player_state(u)}


@router.get("/fishdex")
async def fishdex(u: dict = Depends(get_current_user)):
    docs = await db.fishdex.find({"user_id": str(u["_id"])}, {"_id": 0, "user_id": 0}).to_list(1000)
    return {d["species_id"]: d for d in docs}


class BuyItemIn(BaseModel):
    item_id: str
    qty: int = Field(1, ge=1, le=99)


@router.post("/shop/buy")
async def buy_item(body: BuyItemIn, u: dict = Depends(get_current_user)):
    it = ITEMS.get(body.item_id)
    if not it or it["price"] <= 0:
        raise HTTPException(400, "Item not for sale")
    cost = it["price"] * body.qty
    if u["gold"] < cost:
        raise HTTPException(400, "Not enough gold")
    u["gold"] -= cost
    u["items"][body.item_id] = u["items"].get(body.item_id, 0) + body.qty
    await _save(u, ["gold", "items"])
    return {"player": await player_state(u)}


class UseItemIn(BaseModel):
    item_id: str


@router.post("/items/use")
async def use_item(body: UseItemIn, u: dict = Depends(get_current_user)):
    if body.item_id != "stamina_potion":
        raise HTTPException(400, "Item cannot be used")
    if u["items"].get("stamina_potion", 0) < 1:
        raise HTTPException(400, "No potions left")
    st, at = current_stamina(u)
    mx = max_stamina(u)
    if st >= 3 * mx:
        raise HTTPException(400, "Stamina already overflowing")
    u["items"]["stamina_potion"] -= 1
    u["stamina"], u["stamina_at"] = min(3 * mx, st + 30), (time.time() if st + 30 >= mx else at)
    await _save(u, ["items", "stamina", "stamina_at"])
    return {"player": await player_state(u)}


class GearIn(BaseModel):
    slot: str
    tier: Optional[int] = None
    protect: bool = False


def _check_slot(slot, tier=None):
    if slot not in GEAR:
        raise HTTPException(400, "Unknown slot")
    if tier is not None and not 1 <= tier <= len(GEAR[slot]):
        raise HTTPException(400, "Unknown tier")


@router.post("/gear/buy")
async def gear_buy(body: GearIn, u: dict = Depends(get_current_user)):
    _check_slot(body.slot, body.tier)
    if body.tier is None:
        raise HTTPException(400, "Tier required")
    g = gear_def(body.slot, body.tier)
    if str(body.tier) in u["owned_gear"][body.slot]:
        raise HTTPException(400, "Already owned")
    if u["level"] < g["level"]:
        raise HTTPException(400, f"Requires level {g['level']}")
    if u["gold"] < g["price"]:
        raise HTTPException(400, "Not enough gold")
    u["gold"] -= g["price"]
    u["owned_gear"][body.slot][str(body.tier)] = {"enh": 0, "dur": g["dur"]}
    u["gear"][body.slot] = body.tier
    await _save(u, ["gold", "owned_gear", "gear"])
    return {"player": await player_state(u)}


@router.post("/gear/equip")
async def gear_equip(body: GearIn, u: dict = Depends(get_current_user)):
    _check_slot(body.slot, body.tier)
    if str(body.tier) not in u["owned_gear"][body.slot]:
        raise HTTPException(400, "Not owned")
    u["gear"][body.slot] = body.tier
    await _save(u, ["gear"])
    return {"player": await player_state(u)}


def enhance_cost(tier, enh):
    return 200 * (enh + 1) ** 2 * tier, 1 + enh // 3


@router.post("/gear/enhance")
async def gear_enhance(body: GearIn, u: dict = Depends(get_current_user)):
    _check_slot(body.slot)
    tier = u["gear"][body.slot]
    o = u["owned_gear"][body.slot][str(tier)]
    if o["enh"] >= ENHANCE_MAX:
        raise HTTPException(400, "Already at max enhance")
    gold, stones = enhance_cost(tier, o["enh"])
    if u["gold"] < gold:
        raise HTTPException(400, "Not enough gold")
    if u["items"].get("enhance_stone", 0) < stones:
        raise HTTPException(400, "Not enough Enhance Stones")
    if body.protect and u["items"].get("protection_scroll", 0) < 1:
        raise HTTPException(400, "No Protection Scroll")
    u["gold"] -= gold
    u["items"]["enhance_stone"] -= stones
    if body.protect:
        u["items"]["protection_scroll"] -= 1
    success = random.random() < ENHANCE_CHANCE[o["enh"]]
    dropped = False
    if success:
        o["enh"] += 1
    elif o["enh"] >= 5 and not body.protect:
        o["enh"] -= 1
        dropped = True
    await _save(u, ["gold", "items", "owned_gear"])
    return {"success": success, "dropped": dropped, "enh": o["enh"], "player": await player_state(u)}


def repair_cost(slot, tier, cur):
    g = gear_def(slot, tier)
    return (g["dur"] - cur) * max(2, g["price"] // (g["dur"] * 5))


@router.post("/gear/repair")
async def gear_repair(body: GearIn, u: dict = Depends(get_current_user)):
    _check_slot(body.slot)
    tier = u["gear"][body.slot]
    o = u["owned_gear"][body.slot][str(tier)]
    cost = repair_cost(body.slot, tier, o["dur"])
    if cost <= 0:
        raise HTTPException(400, "Already fully repaired")
    if u["gold"] < cost:
        raise HTTPException(400, "Not enough gold")
    u["gold"] -= cost
    o["dur"] = gear_def(body.slot, tier)["dur"]
    await _save(u, ["gold", "owned_gear"])
    return {"cost": cost, "player": await player_state(u)}


@router.get("/gear/costs")
async def gear_costs(u: dict = Depends(get_current_user)):
    out = {}
    for s in GEAR_SLOTS:
        tier = u["gear"][s]
        o = u["owned_gear"][s][str(tier)]
        g, st = enhance_cost(tier, o["enh"])
        out[s] = {"enhance_gold": g, "enhance_stones": st, "chance": ENHANCE_CHANCE[o["enh"]] if o["enh"] < ENHANCE_MAX else 0,
                  "repair_gold": repair_cost(s, tier, o["dur"])}
    return out


@router.get("/world/feed")
async def world_feed():
    docs = await db.world_feed.find({}, {"_id": 0}).sort("created_at", -1).to_list(20)
    for d in docs:
        d["created_at"] = d["created_at"].isoformat()
    return docs[::-1]


