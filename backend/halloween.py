"""Halloween event: runs every year from 15 Oct to 1 Nov (UTC) and switches itself off. Soul Candles, the Marsh Witch's shop, the ghost boss."""
import random
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, get_current_user, public_user, level_from_xp, WATERS
from halloween_data import HALLOW_FISH, HALLOW_IDS, CANDLES, SHOP, SHOP_BY_ID, GHOST_BOSS, GHOST_PERIOD_H, GHOST_WINDOW_MIN

START = (10, 15)
LAUNCH = datetime(2026, 6, 1, tzinfo=timezone.utc)  # first edition opens early


def window(t=None):
    t = t or now()
    s = LAUNCH if t.year == LAUNCH.year else datetime(t.year, *START, tzinfo=timezone.utc)
    e = datetime(t.year, 11, 1, tzinfo=timezone.utc)
    return s, e


def active(t=None):
    s, e = window(t)
    return s <= (t or now()) < e


def event_public():
    if not active(): return None
    return {"key": "halloween", "name": "Halloween", "ends_at": iso(window()[1])}


def ghost_spawn(t=None):
    """Scheduled ghost boss: one 30-minute window in every 6 hours, at a random water."""
    t = t or now()
    if not active(t): return None
    period = GHOST_PERIOD_H * 3600
    ts = t.timestamp(); k = int(ts // period)
    for kk in (k - 1, k):
        rnd = random.Random(f"ghost:{kk}")
        start = kk * period + rnd.uniform(300, period - GHOST_WINDOW_MIN * 60 - 300)
        water = rnd.choice(WATERS)["key"]
        if start <= ts < start + GHOST_WINDOW_MIN * 60:
            s = datetime.fromtimestamp(start, tz=timezone.utc)
            return {"key": f"ghost:{kk}", "boss_id": GHOST_BOSS["id"], "water": water, "start": iso(s), "end": iso(s + timedelta(minutes=GHOST_WINDOW_MIN))}
    return None


def next_ghost(t=None):
    t = t or now()
    for m in range(0, GHOST_PERIOD_H * 2 * 60 + 1, 5):
        g = ghost_spawn(t + timedelta(minutes=m))
        if g: return g
    return None


def candles_for(fish_rows):
    return sum(CANDLES[c["rarity"]] for c in fish_rows if c.get("species_id") in HALLOW_IDS)


async def add_candles(user_ids, n):
    if n > 0 and user_ids:
        await db.users.update_many({"_id": {"$in": user_ids}}, {"$inc": {"candles": n, "stats.candles_earned": n}})


@api.get("/halloween")
async def halloween_state(user=Depends(get_current_user)):
    s, e = window()
    caught = {j["species_id"]: j.get("count", 0) for j in await db.journal.find({"user_id": str(user["_id"]), "species_id": {"$in": list(HALLOW_IDS)}}, {"species_id": 1, "count": 1}).to_list(50)}
    owned = {"rod_hexwood": "rod_hexwood" in user.get("owned_gear", []), "av_pumpkin": "av_pumpkin" in (user.get("owned_avatars") or []),
             "frame_jackolantern": "frame_jackolantern" in (user.get("owned_frames") or [])}
    g = ghost_spawn()
    nm = {w["key"]: w["name"] for w in WATERS}
    if g: g = {**g, "water_name": nm.get(g["water"])}
    return {"active": active(), "starts_at": iso(s), "ends_at": iso(e), "candles": user.get("candles", 0), "rates": CANDLES, "exchange": {"gold": CANDLE_GOLD, "pearl": CANDLES_PER_PEARL},
            "fish": [{"id": f["id"], "name": f["name"], "rarity": f["rarity"], "blurb": f["blurb"], "caught": caught.get(f["id"], 0), "candles": CANDLES[f["rarity"]]} for f in HALLOW_FISH],
            "shop": [{**i, "owned": owned.get(i["id"], False)} for i in SHOP],
            "ghost": {"name": GHOST_BOSS["name"], "blurb": GHOST_BOSS["blurb"], "now": g, "next": None if g else next_ghost()}}


class BuyIn(BaseModel):
    item_id: str


@api.post("/halloween/buy")
async def halloween_buy(body: BuyIn, user=Depends(get_current_user)):
    if not active(): raise HTTPException(400, "The Marsh Witch has packed up her stall until next Halloween")
    it = SHOP_BY_ID.get(body.item_id)
    if not it: raise HTTPException(404, "Unknown item")
    if user.get("is_guest") and it["kind"] != "potion": raise HTTPException(400, "Claim your account first to keep event rewards")
    inc, add, sets = {"candles": -it["price"]}, {}, {}
    if it["kind"] == "gear":
        if it["id"] in user.get("owned_gear", []): raise HTTPException(400, "You already own the Hexwood Rod")
        if level_from_xp(user["xp"])[0] < it["level"]: raise HTTPException(400, f"The Hexwood Rod needs level {it['level']}")
        add = {"owned_gear": it["id"]}; sets = {"gear.rod": it["id"], f"durability.{it['id']}": 100}
    elif it["kind"] == "avatar":
        if it["id"] in (user.get("owned_avatars") or []): raise HTTPException(400, "You already own that portrait")
        add = {"owned_avatars": it["id"]}
    elif it["kind"] == "frame":
        if it["id"] in (user.get("owned_frames") or []): raise HTTPException(400, "You already own that frame")
        add = {"owned_frames": it["id"]}
    else:
        inc["items.potion_energy"] = it["qty"]
    upd = {"$inc": inc}
    if add: upd["$addToSet"] = add
    if sets: upd["$set"] = sets
    r = await db.users.update_one({"_id": user["_id"], "candles": {"$gte": it["price"]}}, upd)
    if not r.modified_count: raise HTTPException(400, f"Not enough Soul Candles ({it['price']} needed)")
    return {"ok": True, "item": it["name"], "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


PUMPKIN_DAILY, PUMPKIN_CANDLES, PUMPKIN_GAP_MIN, PUMPKIN_TTL_S, PUMPKIN_RETRY_MIN = 6, (15, 30), (45, 75), 180, 15


class PumpkinIn(BaseModel):
    token: str


def _pumpkin_state(user):
    p = user.get("pumpkin") or {}
    return p if p.get("day") == now().date().isoformat() else {"day": now().date().isoformat(), "found": 0}


@api.get("/halloween/pumpkin")
async def pumpkin_check(user=Depends(get_current_user)):
    """Offers a hidden pumpkin when one is due. Rare (about hourly), capped per UTC day."""
    if not active(): return {"pumpkin": None}
    p, t = _pumpkin_state(user), now()
    if p["found"] >= PUMPKIN_DAILY: return {"pumpkin": None, "found": p["found"], "cap": PUMPKIN_DAILY}
    if p.get("token") and p.get("expires", "") > iso(t): return {"pumpkin": {"token": p["token"], "expires": p["expires"]}}
    if "next_at" not in p:
        p["next_at"] = iso(t + timedelta(minutes=random.randint(3, 12)))
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"pumpkin": p}})
        return {"pumpkin": None}
    if p["next_at"] > iso(t): return {"pumpkin": None}
    p.update(token=uuid.uuid4().hex, expires=iso(t + timedelta(seconds=PUMPKIN_TTL_S)), next_at=iso(t + timedelta(minutes=PUMPKIN_RETRY_MIN)))
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"pumpkin": p}})
    return {"pumpkin": {"token": p["token"], "expires": p["expires"]}}


@api.post("/halloween/pumpkin")
async def pumpkin_claim(body: PumpkinIn, user=Depends(get_current_user)):
    if not active(): raise HTTPException(400, "The pumpkins have all rotted away until next Halloween")
    p, t = _pumpkin_state(user), now()
    if not p.get("token") or p["token"] != body.token or p.get("expires", "") < iso(t): raise HTTPException(400, "That pumpkin crumbled before you reached it")
    n = random.randint(*PUMPKIN_CANDLES)
    nxt = iso(t + timedelta(minutes=random.randint(*PUMPKIN_GAP_MIN)))
    r = await db.users.update_one({"_id": user["_id"], "pumpkin.token": body.token},
                                  {"$set": {"pumpkin": {"day": p["day"], "found": p["found"] + 1, "next_at": nxt}}, "$inc": {"candles": n, "stats.candles_earned": n, "stats.pumpkins": 1}})
    if not r.modified_count: raise HTTPException(409, "Someone already smashed that pumpkin")
    return {"candles": n, "found": p["found"] + 1, "cap": PUMPKIN_DAILY, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}


CANDLE_GOLD, CANDLES_PER_PEARL = 100, 60


class ExchangeIn(BaseModel):
    to: str
    qty: int = Field(ge=1, le=100000)


@api.post("/halloween/exchange")
async def halloween_exchange(body: ExchangeIn, user=Depends(get_current_user)):
    """Trade Soul Candles to the Witch: qty is candles for gold, Pearls wanted for pearls."""
    if not active(): raise HTTPException(400, "The Marsh Witch has packed up her stall until next Halloween")
    if user.get("is_guest"): raise HTTPException(400, "Claim your account first to trade with the Witch")
    if body.to == "gold": cost, inc = body.qty, {"gold": body.qty * CANDLE_GOLD, "stats.gold_earned": body.qty * CANDLE_GOLD}
    elif body.to == "pearls": cost, inc = body.qty * CANDLES_PER_PEARL, {"pearls": body.qty, "stats.pearls_earned": body.qty}
    else: raise HTTPException(400, "The Witch only trades for gold or Pearls")
    r = await db.users.update_one({"_id": user["_id"], "candles": {"$gte": cost}}, {"$inc": {"candles": -cost, **inc}})
    if not r.modified_count: raise HTTPException(400, f"Not enough Soul Candles ({cost:,} needed)")
    got = f"{inc['gold']:,} gold" if body.to == "gold" else f"{body.qty} Pearl{'s' if body.qty > 1 else ''}"
    return {"ok": True, "spent": cost, "got": got, "user": public_user(await db.users.find_one({"_id": user["_id"]}))}
