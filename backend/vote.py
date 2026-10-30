"""Vote-for-us: angler opens a toplist vote link carrying a one-shot token; the toplist hits /vote/postback with it and we pay out."""
import asyncio
import random
import re
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, Request, HTTPException
import os
import hmac, hashlib
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel, Field
from bson import ObjectId

from server import api, db, now, iso, get_current_user, require_admin, add_feed, send_system_message, logger
from vote_data import DEFAULT_SITES, TICKET_TTL_MIN, site_out, vote_url, site_kind

# Monthly podium: the three anglers with the most confirmed votes when the month turns.
MONTH_PRIZES = [{"rank": 1, "gold": 2500, "pearls": 5}, {"rank": 2, "gold": 1500, "pearls": 3}, {"rank": 3, "gold": 800, "pearls": 2}]
ORDINAL = {1: "1st", 2: "2nd", 3: "3rd"}


def _month_bounds(t):
    start = t.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    nxt = (start + timedelta(days=32)).replace(day=1)
    return start, nxt


async def _top(month, limit):
    return await db.vote_log.aggregate([{"$match": {"month": month}}, {"$group": {"_id": "$user_id", "username": {"$last": "$username"}, "votes": {"$sum": 1}, "first_at": {"$min": "$at"}}},
                                        {"$sort": {"votes": -1, "first_at": 1}}, {"$limit": limit}]).to_list(limit)


async def settle_vote_month():
    """Pay last month's top-3 once. Runs lazily from the Vote page / postbacks; the unique month key makes it idempotent."""
    start, _ = _month_bounds(now())
    prev = (start - timedelta(days=1)).strftime("%Y-%m")
    if await db.vote_awards.find_one({"month": prev}): return
    top = await _top(prev, 3)
    try:
        await db.vote_awards.insert_one({"month": prev, "winners": [], "at": iso(now()), "status": "paying"})
    except Exception:
        return  # another request got there first
    winners = []
    for t, prize in zip(top, MONTH_PRIZES):
        u = await db.users.find_one({"_id": ObjectId(t["_id"])})
        if not u: continue
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"gold": prize["gold"], "pearls": prize["pearls"], "stats.gold_earned": prize["gold"], "stats.pearls_earned": prize["pearls"], "stats.vote_podiums": 1}})
        winners.append({"rank": prize["rank"], "user_id": t["_id"], "username": u["username"], "votes": t["votes"], "gold": prize["gold"], "pearls": prize["pearls"]})
        await send_system_message(u["_id"], u["username"], f"You finished {ORDINAL[prize['rank']]} on the {prev} voting board with {t['votes']} votes. The harbour thanks you: {prize['gold']:,} gold and {prize['pearls']} Pearls have been added to your purse.")
    await db.vote_awards.update_one({"month": prev}, {"$set": {"winners": winners, "status": "done"}})
    if winners:
        names = ", ".join(f"{ORDINAL[w['rank']]} {w['username']} ({w['votes']})" for w in winners)
        await add_feed("vote", winners[0]["username"], f"Top voters of {prev}: {names}. Gold and Pearls paid, thank you for spreading the word.", "epic")
    logger.info("Vote podium settled for %s: %s", prev, [w["username"] for w in winners])


async def get_sites():
    rows = await db.vote_sites.find({}).sort("order", 1).to_list(50)
    return rows


async def seed_vote_sites():
    """Insert any default site that is missing (never overwrites admin-edited rewards/timers) so new toplists ship with a deploy."""
    for i, s in enumerate(DEFAULT_SITES):
        if not await db.vote_sites.find_one({"key": s["key"]}):
            await db.vote_sites.insert_one({**s, "order": i, "created_at": iso(now())})


INSTANT_KINDS = ("xtremetop100",)  # toplists we pay on click (their postback tracking is paid) after a short delay
INSTANT_DELAY_S = 10


def _instant(site):
    return site_kind(site["url"]) in INSTANT_KINDS


async def _pay_instant_later(token):
    await asyncio.sleep(INSTANT_DELAY_S)
    await _pay_token(token, None)


async def _settle_instant(uid):
    """Safety net if the server restarted mid-delay: pay any due instant tickets."""
    cutoff = iso(now() - timedelta(seconds=INSTANT_DELAY_S))
    for t in await db.vote_tickets.find({"user_id": uid, "status": "pending", "instant": True, "at": {"$lte": cutoff}}).to_list(20):
        await _pay_token(t["token"], None)


def _ready(site, last):
    return not last or datetime.fromisoformat(last["at"]) + timedelta(hours=site["cooldown_h"]) <= now()


async def _last(uid, key):
    return await db.vote_log.find_one({"user_id": uid, "site": key}, sort=[("at", -1)])


async def vote_ready_count(user):
    uid = str(user["_id"])
    n = 0
    for s in await get_sites():
        if _ready(s, await _last(uid, s["key"])): n += 1
    return n


@api.get("/vote")
async def vote_state(user=Depends(get_current_user)):
    uid = str(user["_id"])
    await _settle_instant(uid)
    sites = []
    for s in await get_sites():
        last = await _last(uid, s["key"])
        ready = _ready(s, last)
        sites.append({**site_out(s), "last_at": last["at"] if last else None, "ready": ready,
                      "next_at": None if ready else iso(datetime.fromisoformat(last["at"]) + timedelta(hours=s["cooldown_h"]))})
    names = {s["key"]: s["name"] for s in sites}
    recent = await db.vote_log.find({"user_id": uid}).sort("at", -1).limit(10).to_list(10)
    await settle_vote_month()
    month = now().strftime("%Y-%m")
    top = await _top(month, 10)
    _, month_end = _month_bounds(now())
    last = await db.vote_awards.find_one({"status": "done"}, sort=[("month", -1)])
    return {"sites": sites, "total": user.get("stats", {}).get("votes", 0),
            "recent": [{"site": names.get(r["site"], r.get("site_name") or r["site"]), "at": r["at"], "gold": r["gold"], "pearls": r["pearls"]} for r in recent],
            "top_month": [{"username": t["username"], "votes": t["votes"]} for t in top], "month": month, "month_ends_at": iso(month_end),
            "prizes": MONTH_PRIZES, "last_podium": {"month": last["month"], "winners": [{k: w[k] for k in ("rank", "username", "votes", "gold", "pearls")} for w in last["winners"]]} if last else None}


@api.post("/vote/{site_key}/start")
async def vote_start(site_key: str, user=Depends(get_current_user)):
    s = await db.vote_sites.find_one({"key": site_key})
    if not s: raise HTTPException(404, "Unknown vote site")
    uid = str(user["_id"])
    if not _ready(s, await _last(uid, s["key"])):
        raise HTTPException(400, f"You already voted on {s['name']} recently, it accepts a new vote every {s['cooldown_h']} hours")
    token = "".join(random.choices("0123456789", k=16))
    instant = _instant(s)
    await db.vote_tickets.insert_one({"token": token, "user_id": uid, "username": user["username"], "site": s["key"], "status": "pending", "at": iso(now()), "instant": instant})
    if instant: asyncio.create_task(_pay_instant_later(token))
    return {"url": vote_url(s, token), "token": token}


TOKEN_KEYS = ("postback", "custom", "incentive", "param", "pingUsername", "userid", "p_resp", "id", "token")


def _tokens_from(mapping):
    """Pull our token out of a query/form mapping; Gtop100 form pings carry Successful (0 = ok)."""
    if str(mapping.get("Successful", "0")).strip() not in ("0", ""): return []
    for k in TOKEN_KEYS:
        v = mapping.get(k)
        if v: return [str(v).strip()]
    return []


async def _postback_tokens(request: Request):
    tokens = _tokens_from(request.query_params)
    if request.method != "POST": return tokens
    ctype = request.headers.get("content-type", "")
    if "json" in ctype:
        try:
            data = await request.json()
        except Exception:
            return tokens
        if isinstance(data, dict) and isinstance(data.get("Common"), list):  # Gtop100 batch format
            for entry in data["Common"]:
                m = {}
                for part in entry if isinstance(entry, list) else [entry]:
                    if isinstance(part, dict): m.update(part)
                if str(m.get("success", "0")).strip() == "0" and m.get("pb_name"): tokens.append(str(m["pb_name"]).strip())
        elif isinstance(data, dict):
            tokens += _tokens_from(data)
        return tokens
    try:
        form = await request.form()
        tokens += _tokens_from(form)
    except Exception:
        pass
    return tokens


async def _pay_token(token, ip):
    t = await db.vote_tickets.find_one({"token": token})
    if not t: return "unknown token"
    if t["status"] != "pending": return "already used"
    if datetime.fromisoformat(t["at"]) + timedelta(minutes=TICKET_TTL_MIN) < now():
        await db.vote_tickets.update_one({"_id": t["_id"]}, {"$set": {"status": "expired"}})
        return "expired"
    s = await db.vote_sites.find_one({"key": t["site"]})
    u = await db.users.find_one({"_id": ObjectId(t["user_id"])})
    if not s or not u: return "no such angler"
    if not _ready(s, await _last(t["user_id"], s["key"])):
        await db.vote_tickets.update_one({"_id": t["_id"]}, {"$set": {"status": "duplicate"}})
        return "too soon"
    gold, pearls = s["gold"], s["pearls"]
    inc = {"gold": gold, "stats.gold_earned": gold, "stats.votes": 1}
    if pearls: inc["pearls"] = pearls; inc["stats.pearls_earned"] = pearls
    await db.users.update_one({"_id": u["_id"]}, {"$inc": inc})
    await db.vote_log.insert_one({"user_id": t["user_id"], "username": u["username"], "site": s["key"], "site_name": s["name"], "at": iso(now()), "month": now().strftime("%Y-%m"),
                                  "gold": gold, "pearls": pearls, "ip": ip})
    await db.vote_tickets.update_one({"_id": t["_id"]}, {"$set": {"status": "done", "done_at": iso(now()), "reward": {"gold": gold, "pearls": pearls}}})
    total = u.get("stats", {}).get("votes", 0) + 1
    if total in (1, 10, 25, 50, 100) or total % 100 == 0:
        await add_feed("vote", u["username"], f"{u['username']} voted for FishyLand on {s['name']}" + (f", {total} votes and counting." if total > 1 else "."), "common")
    logger.info("Vote postback paid: %s on %s (%sg, %sP)", u["username"], s["key"], gold, pearls)
    await settle_vote_month()
    return "OK"


@api.get("/vote/postback", response_class=PlainTextResponse)
@api.post("/vote/postback", response_class=PlainTextResponse)
async def vote_postback(request: Request):
    tokens = [t for t in await _postback_tokens(request) if t]
    if not tokens: return "missing token"
    ip = request.client.host if request.client else None
    results = [await _pay_token(t, ip) for t in tokens]
    if "userid" in request.query_params:  # BBOGD sends the player's browser back to us, land them on the Vote page
        return RedirectResponse(f"{os.environ['SITE_URL'].rstrip('/')}/game/vote", status_code=302)
    return "OK" if "OK" in results else results[0]


@api.get("/vote/postback/browsergamestop", response_class=PlainTextResponse)
async def vote_postback_browsergamestop(request: Request, userid: str = "", timestamp: str = "", hash: str = ""):
    """BrowserGamesTop server-to-server GET: ?userid={userid}&ip={ip}&timestamp={timestamp}[&hash=sha256(secret + timestamp)].
    Set BROWSERGAMESTOP_SECRET (same value as the Signing Secret on their side) to require the hash."""
    secret = os.environ.get("BROWSERGAMESTOP_SECRET", "")
    if secret:
        expected = hashlib.sha256((secret + timestamp).encode()).hexdigest()
        if not hash or not hmac.compare_digest(hash.lower(), expected):
            logger.warning("BrowserGamesTop postback rejected: bad hash from %s", request.client.host if request.client else "?")
            raise HTTPException(403, "bad hash")
    if not userid.strip(): return "missing userid"
    return await _pay_token(userid.strip(), request.query_params.get("ip") or (request.client.host if request.client else None))


@api.post("/vote/postback/gametop", response_class=PlainTextResponse)
async def vote_postback_gametop(request: Request):
    """GameTop JSON callback: {event, server_id, username(our token), voter_ip, secret, timestamp[, test]}. Shared secret must match."""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(400, "expected JSON")
    if not isinstance(data, dict): raise HTTPException(400, "expected JSON object")
    secret = os.environ.get("GAMETOP_SECRET", "")
    if not secret or not hmac.compare_digest(str(data.get("secret", "")), secret):
        logger.warning("GameTop callback rejected: bad secret from %s", request.client.host if request.client else "?")
        raise HTTPException(403, "bad secret")
    if data.get("event") != "vote": return "ignored"
    if data.get("test"):
        logger.info("GameTop test callback received OK")
        return "OK test"
    token = str(data.get("username") or "").strip()
    if not token: return "missing username"
    return await _pay_token(token, data.get("voter_ip") or (request.client.host if request.client else None))


# ---------- Admin: manage vote sites ----------
class VoteSiteIn(BaseModel):
    key: Optional[str] = Field(default=None, max_length=32)
    name: str = Field(min_length=2, max_length=40)
    url: str = Field(min_length=8, max_length=400)
    cooldown_h: int = Field(default=12, ge=1, le=168)
    gold: int = Field(default=400, ge=0, le=1_000_000)
    pearls: int = Field(default=1, ge=0, le=50)


@api.get("/admin/vote-sites")
async def admin_vote_sites(admin=Depends(require_admin)):
    return [site_out(s) for s in await get_sites()]


@api.post("/admin/vote-sites")
async def admin_save_vote_site(body: VoteSiteIn, admin=Depends(require_admin)):
    if not body.url.startswith(("http://", "https://")): raise HTTPException(400, "The link must start with http:// or https://")
    key = body.key or re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")[:32]
    if not key: raise HTTPException(400, "Pick a clearer site name")
    doc = {"name": body.name.strip(), "url": body.url.strip(), "cooldown_h": body.cooldown_h, "gold": body.gold, "pearls": body.pearls}
    existing = await db.vote_sites.find_one({"key": key})
    if existing:
        await db.vote_sites.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        n = await db.vote_sites.count_documents({})
        await db.vote_sites.insert_one({**doc, "key": key, "order": n, "created_at": iso(now())})
    await db.admin_log.insert_one({"admin": admin["username"], "action": "vote_site", "target": doc["name"], "at": iso(now()),
                                   "changes": [f"{'updated' if existing else 'added'} vote site {key}", f"{doc['cooldown_h']}h", f"{doc['gold']}g + {doc['pearls']}P", doc["url"]]})
    return [site_out(s) for s in await get_sites()]


@api.delete("/admin/vote-sites/{key}")
async def admin_delete_vote_site(key: str, admin=Depends(require_admin)):
    r = await db.vote_sites.delete_one({"key": key})
    if r.deleted_count == 0: raise HTTPException(404, "No such site")
    await db.admin_log.insert_one({"admin": admin["username"], "action": "vote_site", "target": key, "at": iso(now()), "changes": ["removed vote site"]})
    return [site_out(s) for s in await get_sites()]
