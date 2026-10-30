"""Random events: a few times a day a surprise contest pops up for everyone online. Hidden Goldfish, Shipwreck Salvage, Chat Quick-Draw. Winners get a crate."""
import asyncio
import random
from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel

from server import api, db, now, iso, require_admin, add_feed, uncache, cached, WATERS, WATER_BY_KEY
from crates import CRATES, grant_crate

LENGTH_MIN = 30
GAP_HOURS = (4, 8)
CRATE_ODDS = {"crate_bronze": 40, "crate_silver": 40, "crate_gold": 20}
GOLDFISH_CHANCE = 0.12  # per cast at the hiding water
SALVAGE_CHANCE = 0.3    # per cast at the wreck
SALVAGE_SLOTS = 10
WORDS = ["BOBBER", "SINKER", "TACKLE", "MINNOW", "KEEPNET", "LANTERN", "HARBOUR", "DRIFTWOOD", "BARNACLE", "RIPTIDE", "SEAGULL", "ANCHOR", "LOBSTER", "MACKEREL", "TIGHTLINES"]
KINDS = ("goldfish", "salvage", "quickdraw")
NAMES = {"goldfish": "Hidden Goldfish", "salvage": "Shipwreck Salvage", "quickdraw": "Chat Quick-Draw"}


def roll_crate():
    return random.choices(list(CRATE_ODDS), list(CRATE_ODDS.values()))[0]


def event_waters():
    return [w for w in WATERS if not w.get("premium")]


async def harbour_say(text):
    await db.chat.insert_one({"channel": "global", "username": "Harbourmaster", "level": 0, "at": iso(now()), "text": text})


async def _active():
    doc = await db.random_events.find_one({"status": "active", "end": {"$gt": iso(now())}})
    return clean(doc)


def clean(doc):
    if not doc: return None
    return {**{k: v for k, v in doc.items() if k not in ("_id", "alert_id")}, "id": str(doc["_id"]), "alert_id": str(doc["alert_id"]) if doc.get("alert_id") else None}


async def active_event():
    return await cached("random_event_active", 3, _active)


def intro_text(ev):
    if ev["kind"] == "goldfish": return "RANDOM EVENT: A tiny golden goldfish is hiding in one of the waters. Nobody knows where. The first angler to hook it wins a crate!"
    if ev["kind"] == "salvage": return f"RANDOM EVENT: A merchant ship has gone down at {ev['water_name']}! The first {SALVAGE_SLOTS} anglers to fish there each pull up a crate."
    return f"RANDOM EVENT: Quick-draw! The first angler to type {ev['word']} in Global chat wins a crate!"


async def start_event(kind=None):
    if await _active(): return None
    kind = kind or random.choice(KINDS)
    t = now()
    w = random.choice(event_waters())
    ev = {"kind": kind, "status": "active", "start": iso(t), "end": iso(t + timedelta(minutes=LENGTH_MIN)), "winners": [],
          "water": w["key"] if kind != "quickdraw" else None, "water_name": w["name"] if kind != "quickdraw" else None,
          "word": random.choice(WORDS) if kind == "quickdraw" else None}
    ev_id = (await db.random_events.insert_one(ev)).inserted_id
    text = intro_text(ev)
    a = await db.alerts.insert_one({"key": f"random:{ev_id}", "username": "Harbourmaster", "status": "random", "kind": kind, "rarity": "legendary", "species": None, "weight": None, "variant": None,
                                    "water": ev["water"] if kind == "salvage" else None, "water_name": ev["water_name"] if kind == "salvage" else "",
                                    "at": ev["start"], "end": ev["end"], "cheers": [], "text": text})
    await db.random_events.update_one({"_id": ev_id}, {"$set": {"alert_id": a.inserted_id}})
    await harbour_say(text)
    await add_feed("event", "Harbourmaster", text.replace("RANDOM EVENT: ", f"{NAMES[kind]}: "), "legendary")
    from push_notifications import broadcast
    push = {"goldfish": ("Random event: Hidden Goldfish!", "A tiny golden goldfish is hiding in one of the waters. First to hook it wins a crate.", "/game/fish"),
            "salvage": (f"Random event: Shipwreck at {ev['water_name']}!", f"The first {SALVAGE_SLOTS} anglers to fish there each pull up a crate. Hurry!", "/game/waters"),
            "quickdraw": ("Random event: Chat Quick-Draw!", f"First to type {ev['word']} in Global chat wins a crate.", "/game")}[kind]
    asyncio.create_task(broadcast(title=push[0], body=push[1], url=push[2], tag=f"random:{ev_id}", kind="random"))
    uncache("alerts_live", "random_event_active")
    return {k: v for k, v in ev.items() if k != "_id"}


async def close_event(ev, text):
    r = await db.random_events.update_one({"_id": ObjectId(ev["id"]), "status": "active"}, {"$set": {"status": "done", "closed_at": iso(now())}})
    if not r.modified_count: return
    if ev.get("alert_id"):
        await db.alerts.update_one({"_id": ObjectId(ev["alert_id"])}, {"$set": {"status": "random_done", "at": iso(now()), "end": iso(now()), "text": text}})
    await harbour_say(text)
    uncache("alerts_live", "random_event_active")


async def tick():
    t = now()
    stale = clean(await db.random_events.find_one({"status": "active", "end": {"$lte": iso(t)}}))
    if stale:
        n = len(stale.get("winners") or [])
        if stale["kind"] == "goldfish": msg = f"The hidden goldfish slipped away unseen. It was hiding at {stale['water_name']}."
        elif stale["kind"] == "salvage": msg = f"The wreck at {stale['water_name']} has sunk into the mud. {n} of {SALVAGE_SLOTS} crates were salvaged."
        else: msg = f"Nobody typed {stale['word']} in time. The quick-draw is over."
        await close_event(stale, msg)
    sched = await db.random_events_meta.find_one({"_id": "schedule"})
    if not sched:
        await db.random_events_meta.update_one({"_id": "schedule"}, {"$setOnInsert": {"next_at": iso(t + timedelta(hours=random.uniform(*GAP_HOURS)))}}, upsert=True)
        return
    if sched["next_at"] <= iso(t) and not await _active():
        nxt = iso(t + timedelta(minutes=LENGTH_MIN) + timedelta(hours=random.uniform(*GAP_HOURS)))
        claimed = await db.random_events_meta.update_one({"_id": "schedule", "next_at": sched["next_at"]}, {"$set": {"next_at": nxt}})
        if claimed.modified_count: await start_event()  # only one worker wins the claim


async def award(ev, user, filt, push_extra=None):
    """Atomically claim a prize slot; returns the crate id or None if someone got there first."""
    cid = roll_crate()
    win = {"user_id": str(user["_id"]), "username": user["username"], "crate": cid, "at": iso(now())}
    r = await db.random_events.update_one({"_id": ObjectId(ev["id"]), "status": "active", "winners.user_id": {"$ne": str(user["_id"])}, **filt}, {"$push": {"winners": win}, **(push_extra or {})})
    if not r.modified_count: return None
    uncache("random_event_active")
    await grant_crate(user["_id"], user["username"], cid, f"you won the {NAMES[ev['kind']]} random event")
    return cid


async def on_cast(user, water_key) -> Optional[dict]:
    if user.get("is_guest"): return None
    ev = await active_event()
    if not ev or ev["kind"] not in ("goldfish", "salvage") or ev["water"] != water_key: return None
    if ev["kind"] == "goldfish":
        if random.random() >= GOLDFISH_CHANCE: return None
        cid = await award(ev, user, {"winners": {"$size": 0}})
        if not cid: return None
        await close_event(ev, f"{user['username']} found the hidden goldfish at {ev['water_name']} and won a {CRATES[cid]['name']}!")
        return {"kind": "goldfish", "crate": cid, "crate_name": CRATES[cid]["name"], "rarity": CRATES[cid]["rarity"],
                "message": f"A tiny golden goldfish wriggles on your hook! You found the hidden goldfish and won a {CRATES[cid]['name']}!"}
    if random.random() >= SALVAGE_CHANCE: return None
    cid = await award(ev, user, {f"winners.{SALVAGE_SLOTS - 1}": {"$exists": False}})
    if not cid: return None
    fresh = clean(await db.random_events.find_one({"_id": ObjectId(ev["id"])}))
    left = SALVAGE_SLOTS - len(fresh["winners"])
    names = ", ".join(w["username"] for w in fresh["winners"])
    if left <= 0: await close_event(fresh, f"The wreck at {ev['water_name']} has been picked clean! Crates went to {names}.")
    elif ev.get("alert_id"):
        await db.alerts.update_one({"_id": ObjectId(ev["alert_id"])}, {"$set": {"text": f"{intro_text(ev)} {left} of {SALVAGE_SLOTS} crates left."}}); uncache("alerts_live")
    return {"kind": "salvage", "crate": cid, "crate_name": CRATES[cid]["name"], "rarity": CRATES[cid]["rarity"],
            "message": f"Your hook snags a sea-soaked crate from the wreck! You salvaged a {CRATES[cid]['name']}. {max(0, left)} left in the wreck."}


async def on_chat(user, channel, text) -> Optional[dict]:
    if channel != "global" or user.get("is_guest"): return None
    ev = await active_event()
    if not ev or ev["kind"] != "quickdraw" or text.strip().strip("!.").upper() != ev["word"]: return None
    cid = await award(ev, user, {"winners": {"$size": 0}})
    if not cid: return None
    secs = max(1, int((now() - datetime.fromisoformat(ev["start"])).total_seconds()))
    await close_event(ev, f"{user['username']} typed {ev['word']} first ({secs}s) and won a {CRATES[cid]['name']}!")
    return {"kind": "quickdraw", "crate": cid, "crate_name": CRATES[cid]["name"], "rarity": CRATES[cid]["rarity"], "message": f"Quick-draw won! A {CRATES[cid]['name']} is yours."}


class StartIn(BaseModel):
    kind: str


@api.post("/admin/random-event/start")
async def admin_start(body: StartIn, admin=Depends(require_admin)):
    if body.kind not in KINDS: raise HTTPException(400, "Unknown event")
    ev = await start_event(body.kind)
    if not ev: raise HTTPException(400, "A random event is already running")
    return {"ok": True, "kind": ev["kind"], "water": ev["water_name"], "word": ev["word"], "end": ev["end"]}


@api.get("/admin/random-event")
async def admin_view(admin=Depends(require_admin)):
    ev = await _active()
    sched = await db.random_events_meta.find_one({"_id": "schedule"}) or {}
    recent = await db.random_events.find({"status": "done"}).sort("start", -1).limit(10).to_list(10)
    out = lambda e: {"kind": e["kind"], "name": NAMES[e["kind"]], "water": e.get("water_name"), "word": e.get("word"), "start": e["start"], "end": e["end"],
                     "winners": [{"username": w["username"], "crate": CRATES[w["crate"]]["name"]} for w in e.get("winners") or []]}
    return {"active": out(ev) if ev else None, "next_at": sched.get("next_at"), "recent": [out(e) for e in recent]}
