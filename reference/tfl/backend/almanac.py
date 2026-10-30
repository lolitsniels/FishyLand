"""The Angler's Almanac: Angler Pass perk. Information only: market price history, personal catch charts, best-conditions tables.
Nothing here changes a roll; it just reads the ledgers everyone already writes to."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException

from server import api, db, now, iso, get_current_user, premium_active, conditions_for, FISH, FISH_BY_ID, WATERS, WATER_BY_KEY, BAIT_BY_ID, ING_BY_ID

DAYS = 30
MIN_SAMPLES = 8


def _gate(u):
    if not premium_active(u): raise HTTPException(403, "The Angler's Almanac is open to Angler Pass holders")


def _day(s):
    return s[:10]


@api.get("/almanac")
async def almanac_home(user=Depends(get_current_user)):
    """Cheap overview for the page shell: what's selling this week + which items have enough history to chart."""
    active = premium_active(user)
    since = iso(now() - timedelta(days=7))
    rows = await db.trades.find({"at": {"$gte": since}}, {"item": 1, "kind": 1, "price": 1, "qty": 1, "rarity": 1}).to_list(5000)
    agg = defaultdict(lambda: {"n": 0, "gold": 0, "units": 0})
    for r in rows:
        a = agg[(r["kind"], r["item"])]
        a["n"] += 1; a["gold"] += r["price"]; a["units"] += r.get("qty", 1)
        a["rarity"] = r.get("rarity", "common")
    selling = sorted(({"kind": k, "name": n, "trades": a["n"], "avg": round(a["gold"] / max(1, a["units"])), "rarity": a["rarity"]} for (k, n), a in agg.items()), key=lambda x: -x["trades"])[:12]
    return {"active": active, "until": user.get("premium_until"), "selling": selling if active else [], "days": DAYS,
            "waters": [{"key": w["key"], "name": w["name"]} for w in WATERS if not w.get("premium")]}


@api.get("/almanac/prices")
async def price_history(name: str, user=Depends(get_current_user)):
    """Daily median sale price of one item (by market name) over the last 30 days, plus vendor reference where known."""
    _gate(user)
    since = iso(now() - timedelta(days=DAYS))
    rows = await db.trades.find({"item": name, "at": {"$gte": since}}, {"price": 1, "qty": 1, "at": 1}).to_list(5000)
    by_day = defaultdict(list)
    for r in rows: by_day[_day(r["at"])].append(r["price"] / max(1, r.get("qty", 1)))
    series = []
    d0 = (now() - timedelta(days=DAYS - 1)).date()
    for i in range(DAYS):
        d = (d0 + timedelta(days=i)).isoformat()
        v = sorted(by_day.get(d, []))
        series.append({"day": d, "median": round(v[len(v) // 2]) if v else None, "n": len(v)})
    prices = sorted(p for v in by_day.values() for p in v)
    vendor = None
    sp = next((f for f in FISH if f["name"] == name), None)
    if sp: vendor = "fish"
    return {"name": name, "series": series, "trades": len(prices), "low": round(prices[0]) if prices else None, "high": round(prices[-1]) if prices else None,
            "median": round(prices[len(prices) // 2]) if prices else None, "vendor": vendor}


@api.get("/almanac/catches")
async def my_catches(user=Depends(get_current_user)):
    """Your own landings from the permanent catch log: per water, per rarity, plus a 30-day daily curve."""
    _gate(user)
    uid = str(user["_id"])
    rows = await db.catch_log.find({"caught_by": uid}, {"water": 1, "rarity": 1, "caught_at": 1, "species_id": 1, "weight": 1}).to_list(200000)
    per_water = defaultdict(lambda: Counter())
    daily = Counter()
    heaviest = {}
    since = _day(iso(now() - timedelta(days=DAYS - 1)))
    for r in rows:
        per_water[r.get("water") or "?"][r.get("rarity") or "common"] += 1
        if r.get("caught_at", "") >= since: daily[_day(r["caught_at"])] += 1
        sid = r.get("species_id")
        if sid in FISH_BY_ID and r.get("weight", 0) > heaviest.get(sid, {}).get("weight", 0): heaviest[sid] = {"name": FISH_BY_ID[sid]["name"], "weight": r["weight"], "rarity": FISH_BY_ID[sid]["rarity"]}
    d0 = (now() - timedelta(days=DAYS - 1)).date()
    curve = [{"day": (d0 + timedelta(days=i)).isoformat(), "n": daily.get((d0 + timedelta(days=i)).isoformat(), 0)} for i in range(DAYS)]
    waters = [{"key": k, "name": WATER_BY_KEY.get(k, {}).get("name", k), "total": sum(c.values()), "rarity": dict(c)} for k, c in per_water.items() if k in WATER_BY_KEY]
    waters.sort(key=lambda w: -w["total"])
    top = sorted(heaviest.values(), key=lambda x: -x["weight"])[:8]
    return {"total": len(rows), "waters": waters, "curve": curve, "heaviest": top}


@api.get("/almanac/conditions")
async def best_conditions(species_id: int, user=Depends(get_current_user)):
    """Server-wide: under which period / weather / tide a species has actually been landed, reconstructed from the catch log."""
    _gate(user)
    f = FISH_BY_ID.get(species_id)
    if not f: raise HTTPException(404, "Unknown species")
    rows = await db.catch_log.find({"species_id": species_id}, {"caught_at": 1, "water": 1}).sort("caught_at", -1).limit(4000).to_list(4000)
    period, weather, tide, hours = Counter(), Counter(), Counter(), Counter()
    for r in rows:
        try: t = datetime.fromisoformat(r["caught_at"])
        except Exception: continue
        c = conditions_for(r.get("water") or f["water"], t)
        period[c["period"]] += 1; weather[c["weather"]] += 1; hours[t.hour] += 1
        if c["tide"]: tide[c["tide"]] += 1
    n = len(rows)
    def share(cnt): return [{"key": k, "n": v, "pct": round(v * 100 / n)} for k, v in cnt.most_common()] if n else []
    return {"species": {"id": f["id"], "name": f["name"], "rarity": f["rarity"], "water": f["water"], "water_name": WATER_BY_KEY[f["water"]]["name"]},
            "samples": n, "enough": n >= MIN_SAMPLES, "period": share(period), "weather": share(weather), "tide": share(tide),
            "hours": [{"h": h, "n": hours.get(h, 0)} for h in range(24)]}


@api.get("/almanac/species")
async def species_index(user=Depends(get_current_user)):
    """Species with at least one landing anywhere, the ones a conditions table can be drawn for."""
    _gate(user)
    counts = {r["_id"]: r["n"] for r in await db.catch_log.aggregate([{"$group": {"_id": "$species_id", "n": {"$sum": 1}}}]).to_list(2000)}
    return [{"id": f["id"], "name": f["name"], "rarity": f["rarity"], "water": f["water"], "n": counts[f["id"]]} for f in FISH if counts.get(f["id"])]
