"""Bot catcher: turns the detector's signals into quiet consequences for suspects only, and gives admins one place to judge them.
Normal players never meet any of this: nothing changes until an angler's recent bot score crosses SUSPECT_SCORE or an admin acts.
Suspect = auto (score in the last 24 h) or admin status 'watch' / 'limited'. 'trusted' switches the auto rule off for that angler.
Suspects: catches pay less after long days. Only staff-limited accounts lose Market trading and gold deposits."""
import random
from datetime import timedelta
from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel
from server import api, db, now, iso, get_current_user, is_admin_user, is_mod_user, level_from_xp, WATER_BY_KEY, SIGNALS
from humancheck import SUSPECT_SCORE
from admin_tools import log_action

AUTO_SUSPECT_H = 72            # an auto flag keeps an angler a suspect this long after their last qualifying hit
TAPER_START_H, TAPER_END_H, TAPER_FLOOR = 3.0, 7.0, 0.3   # suspects: catch gold/XP slide from 100% at 3 h fished today to 30% at 7 h
JITTER = 0.05                  # everyone: each fight's pull, recovery and wander shift by up to ±5%, too little to feel, enough to break replayed inputs
STATUSES = ("watch", "limited", "trusted")
MOD_STATUSES = ("watch", "limited")  # MODs flag; trusting, clearing and banning stay with the owner
REPORT_DAYS = 7
TRADE_MSG = "Trading is paused on this account while the harbour reviews some unusual activity. If you think this is a mistake, contact support."


def _bot(user): return user.get("bot") or {}


def suspect(user):
    b = _bot(user)
    if b.get("status") in ("watch", "limited"): return True
    if b.get("status") == "trusted": return False
    return bool(b.get("suspect_until")) and b["suspect_until"] > iso(now())


def limited(user):
    return _bot(user).get("status") == "limited"


def guard_trade(user):
    if limited(user): raise HTTPException(403, TRADE_MSG)


def hours_today(user):
    rh = user.get("rhythm") or {}
    return (rh.get("day_secs") or 0) / 3600 if rh.get("day") == now().strftime("%Y-%m-%d") else 0.0


def reward_mult(user):
    if not suspect(user): return 1.0
    h = hours_today(user)
    if h <= TAPER_START_H: return 1.0
    return round(max(TAPER_FLOOR, 1 - (1 - TAPER_FLOOR) * (h - TAPER_START_H) / (TAPER_END_H - TAPER_START_H)), 3)


def shift_fight(params, user):
    """Per-fight variation. A few percent either way, unnoticeable; breaks replayed inputs."""
    j = lambda: random.uniform(1 - JITTER, 1 + JITTER)  # noqa: E731
    params["strength"] = round(params["strength"] * j(), 3)
    params["recovery"] = round(params["recovery"] * j(), 3)
    params["erratic"] = round(params["erratic"] * j(), 3)
    return params


async def recent_score(user_id, hours=24):
    row = await db.suspicious.find_one({"user_id": user_id}, {"events": 1, "cleared_at": 1})
    since = max(iso(now() - timedelta(hours=hours)), (row or {}).get("cleared_at") or "")
    return sum(SIGNALS.get(e["code"], ("", 1))[1] for e in (row or {}).get("events", []) if e.get("at", "") >= since)


async def on_flag(user):
    """Called after every detector hit: crossing the line makes (or keeps) the angler an auto suspect."""
    if _bot(user).get("status") == "trusted": return
    if await recent_score(str(user["_id"])) >= SUSPECT_SCORE:
        if not suspect(user) and not _bot(user).get("status"): await db.bot_log.insert_one({"kind": "suspect", "username": user["username"], "by": "detector", "at": iso(now())})
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"bot.suspect_until": iso(now() + timedelta(hours=AUTO_SUSPECT_H)), "bot.auto_at": iso(now())}})


# ---------- staff (owner + MODs) ----------
async def require_staff(user=Depends(get_current_user)):
    if not (is_admin_user(user) or is_mod_user(user)): raise HTTPException(403, "Staff only")
    return user


async def daily_report():
    """Per UTC day for the last week: new suspects, staff flags, clears and bans of anglers on the bot list."""
    since = (now() - timedelta(days=REPORT_DAYS - 1)).strftime("%Y-%m-%d")
    days = {(now() - timedelta(days=i)).strftime("%Y-%m-%d"): {"suspect": 0, "watch": 0, "limited": 0, "trusted": 0, "clear": 0, "ban": 0} for i in range(REPORT_DAYS)}
    async for e in db.bot_log.find({"at": {"$gte": since}}, {"kind": 1, "at": 1}):
        d = days.get(e["at"][:10])
        if d is not None and e["kind"] in d: d[e["kind"]] += 1
    listed = [ObjectId(r["user_id"]) async for r in db.suspicious.find({}, {"user_id": 1}) if ObjectId.is_valid(r["user_id"])]
    async for u in db.users.find({"_id": {"$in": listed}, "banned.at": {"$gte": since}}, {"banned.at": 1}):
        d = days.get(u["banned"]["at"][:10])
        if d is not None: d["ban"] += 1
    return [{"day": k, **v} for k, v in sorted(days.items(), reverse=True)]


# ---------- admin ----------
def _ips(u):
    return {h for h in [u.get("last_ip_hash"), u.get("reg_ip_hash"), *[e.get("h") for e in u.get("ip_log") or []]] if h}


async def _linked(u):
    hs = list(_ips(u))
    if not hs: return []
    rows = await db.users.find({"_id": {"$ne": u["_id"]}, "$or": [{"last_ip_hash": {"$in": hs}}, {"reg_ip_hash": {"$in": hs}}, {"ip_log.h": {"$in": hs}}]},
                               {"username": 1, "banned": 1, "is_guest": 1}).limit(12).to_list(12)
    return [{"username": r["username"], "banned": bool(r.get("banned")), "guest": bool(r.get("is_guest"))} for r in rows]


def _state(u):
    b = _bot(u)
    if b.get("status"): return b["status"]
    return "suspect" if suspect(u) else "new"


@api.get("/admin/suspicious")
async def admin_bots(admin=Depends(require_staff)):
    """Bot catcher list: every angler the detector has flagged, ranked by their last-24h score, with what's needed to judge them."""
    rows = await db.suspicious.find({}).sort([("last_at", -1)]).limit(150).to_list(150)
    ids = [ObjectId(r["user_id"]) for r in rows if ObjectId.is_valid(r["user_id"])]
    users = {str(u["_id"]): u async for u in db.users.find({"_id": {"$in": ids}}, {"username": 1, "xp": 1, "stats": 1, "banned": 1, "is_guest": 1, "last_seen": 1, "created_at": 1,
                                                                                    "rhythm.day": 1, "rhythm.day_secs": 1, "rhythm.hours": 1, "bot": 1, "humancheck": 1,
                                                                                    "last_ip_hash": 1, "reg_ip_hash": 1, "ip_log": 1, "gold": 1})}
    day_ago, week_ago = iso(now() - timedelta(hours=24)), iso(now() - timedelta(days=7))
    c24 = {r["_id"]: r for r in await db.catch_log.aggregate([
        {"$match": {"caught_by": {"$in": list(users)}, "caught_at": {"$gte": day_ago}}},
        {"$group": {"_id": "$caught_by", "n": {"$sum": 1}, "rare": {"$sum": {"$cond": [{"$in": ["$rarity", ["epic", "legendary", "mythic"]]}, 1, 0]}}}}]).to_list(500)}
    w = lambda code: SIGNALS.get(code, ("", 1))[1]  # noqa: E731
    out = []
    for r in rows:
        u = users.get(r["user_id"])
        ev = [e for e in r.get("events") or [] if e.get("at", "") >= (r.get("cleared_at") or "")]
        s24 = sum(w(e["code"]) for e in ev if e.get("at", "") >= day_ago)
        s7 = sum(w(e["code"]) for e in ev if e.get("at", "") >= week_ago)
        reasons = {}
        for e in ev: reasons[e["code"]] = reasons.get(e["code"], 0) + 1
        b = _bot(u or {})
        out.append({"user_id": r["user_id"], "username": (u or {}).get("username", r.get("username")), "gone": not u,
                    "level": level_from_xp(u.get("xp", 0))[0] if u else None, "score24": s24, "score7": s7, "score_all": r.get("score", 0),
                    "reasons": reasons, "events": list(reversed(ev)), "last_detail": r.get("last_detail", ""), "last_at": r.get("last_at"), "first_at": r.get("first_at"),
                    "water": WATER_BY_KEY.get(r.get("water"), {}).get("name", r.get("water")),
                    "state": _state(u) if u else "gone", "status_by": b.get("by"), "status_at": b.get("at"),
                    "limited": limited(u) if u else False, "reward_pct": round(reward_mult(u) * 100) if u else 100,
                    "hours_today": round(hours_today(u), 1) if u else 0, "active_hours": len((u or {}).get("rhythm", {}).get("hours") or []) if u and (u.get("rhythm") or {}).get("day") == now().strftime("%Y-%m-%d") else 0,
                    "catches24": c24.get(r["user_id"], {}).get("n", 0), "rare24": c24.get(r["user_id"], {}).get("rare", 0),
                    "casts": ((u or {}).get("stats") or {}).get("casts", 0), "catches": ((u or {}).get("stats") or {}).get("catches", 0), "gold": (u or {}).get("gold", 0),
                    "withheld": b.get("withheld_gold", 0), "created_at": (u or {}).get("created_at"), "last_seen": (u or {}).get("last_seen"),
                    "banned": bool((u or {}).get("banned")), "guest": bool((u or {}).get("is_guest")),
                    "humancheck": {"passed": ((u or {}).get("humancheck") or {}).get("passed", 0), "failed": (r.get("humancheck") or {}).get("failed", 0), "pending": bool(((u or {}).get("humancheck") or {}).get("pending"))},
                    "linked": await _linked(u) if u else []})
    order = {"limited": 0, "suspect": 1, "watch": 2, "new": 3, "trusted": 4, "gone": 5}
    out.sort(key=lambda a: (a["banned"], order.get(a["state"], 9), -a["score24"], -a["score7"]))
    owner = is_admin_user(admin)
    return {"signals": {k: {"label": v[0], "weight": v[1]} for k, v in SIGNALS.items()}, "anglers": out, "report": await daily_report(),
            "can": [*STATUSES, "clear", "ban", "check"] if owner else [*MOD_STATUSES, "check"],
            "rules": {"suspect_score": SUSPECT_SCORE, "auto_hours": AUTO_SUSPECT_H, "taper_start": TAPER_START_H, "taper_end": TAPER_END_H, "taper_floor": round(TAPER_FLOOR * 100)}}


class StatusIn(BaseModel):
    status: str  # watch | limited | trusted | clear


@api.post("/admin/suspicious/{user_id}/status")
async def admin_bot_status(user_id: str, body: StatusIn, admin=Depends(require_staff)):
    if body.status not in (*STATUSES, "clear"): raise HTTPException(400, "Unknown status")
    if not is_admin_user(admin) and body.status not in MOD_STATUSES: raise HTTPException(403, "Only the owner can trust or clear an angler")
    if not ObjectId.is_valid(user_id): raise HTTPException(404, "No such angler")
    u = await db.users.find_one({"_id": ObjectId(user_id)}, {"username": 1})
    if not u: raise HTTPException(404, "No such angler")
    if body.status == "clear":
        # Clear = not a bot after all: drop the status and the auto flag, and forget every hit so far (new hits still count).
        await db.users.update_one({"_id": u["_id"]}, {"$unset": {"bot.status": "", "bot.suspect_until": "", "bot.by": "", "bot.at": ""}})
        await db.suspicious.update_one({"user_id": user_id}, {"$set": {"cleared_at": iso(now())}})
    else:
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"bot.status": body.status, "bot.by": admin["username"], "bot.at": iso(now())},
                                                      **({"$unset": {"bot.suspect_until": ""}} if body.status == "trusted" else {})})
    await log_action(admin, u["username"], f"bot_{body.status}", [f"bot catcher: {body.status}"])
    await db.bot_log.insert_one({"kind": body.status, "username": u["username"], "by": admin["username"], "at": iso(now())})
    return await admin_bots(admin)
