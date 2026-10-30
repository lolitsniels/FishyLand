"""Where visitors come from: the landing page reports document.referrer once per browser session; admins see it aggregated."""
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

from fastapi import Depends, Request
from pydantic import BaseModel, Field

from server import api, db, now, iso, require_admin, level_from_xp

SELF_HOSTS = ("thefishinglands.com", "localhost", "emergentagent.com", "emergent.sh")


def page_of(referrer, utm_source=None, utm_campaign=None):
    """Exact referring page: host + path (no query), or the utm name (+ campaign)."""
    if utm_source:
        u = utm_source.strip().lower()
        return f"{u} · {utm_campaign.strip().lower()}" if utm_campaign else u
    if not referrer: return "direct / typed"
    r = urlparse(referrer)
    host = r.netloc.lower().removeprefix("www.")
    if not host or any(h in host for h in SELF_HOSTS): return "direct / typed"
    path = r.path.rstrip("/")
    return (host + path)[:300]


class VisitIn(BaseModel):
    referrer: str = Field(default="", max_length=500)
    path: str = Field(default="/", max_length=200)
    utm_source: Optional[str] = Field(default=None, max_length=80)
    utm_campaign: Optional[str] = Field(default=None, max_length=80)


@api.post("/track/visit")
async def track_visit(body: VisitIn, request: Request):
    host = urlparse(body.referrer).netloc.lower().removeprefix("www.") if body.referrer else ""
    if any(h in host for h in SELF_HOSTS): host = ""
    source = (body.utm_source or "").strip().lower() or host or "direct / typed"
    page = page_of(body.referrer, body.utm_source, body.utm_campaign)
    await db.visits.insert_one({"source": source, "page": page, "referrer": body.referrer[:500], "path": body.path, "utm_campaign": body.utm_campaign,
                               "ua_mobile": "Mobi" in request.headers.get("user-agent", ""), "at": iso(now()), "day": now().strftime("%Y-%m-%d")})
    return {"ok": True}


class GuideViewIn(BaseModel):
    slug: str = Field(min_length=1, max_length=80, pattern="^[a-z0-9-]+$")


@api.post("/track/guide")
async def track_guide(body: GuideViewIn):
    await db.guide_views.insert_one({"slug": body.slug, "at": iso(now())})
    return {"ok": True}


async def guide_stats(since):
    views = {r["_id"]: r["n"] for r in await db.guide_views.aggregate([{"$match": {"at": {"$gte": since}}}, {"$group": {"_id": "$slug", "n": {"$sum": 1}}}]).to_list(100)}
    users = await db.users.aggregate([{"$match": {"acq_guide": {"$exists": True}, "$or": [{"claimed_at": {"$gte": since}}, {"created_at": {"$gte": since}}]}},
                                      {"$group": {"_id": "$acq_guide",
                                                  "accounts": {"$sum": {"$cond": [{"$and": [{"$ne": ["$is_guest", True]}, {"$gte": ["$claimed_at", since]}]}, 1, 0]}},
                                                  "guests": {"$sum": {"$cond": [{"$and": [{"$eq": ["$is_guest", True]}, {"$gte": ["$created_at", since]}]}, 1, 0]}}}}]).to_list(100)
    per = {u["_id"]: u for u in users}
    return [{"slug": s, "views": views.get(s, 0), "accounts": per.get(s, {}).get("accounts", 0), "guests": per.get(s, {}).get("guests", 0)} for s in set(views) | set(per)]


def _player_stats(users, t):
    """Per page: guests, accounts, back after a day / a week (by last_seen), average level, reached level 10."""
    out = {}
    for u in users:
        k = u.get("acq_page") or u.get("acq_source") or "unknown"
        if any(h in k for h in SELF_HOSTS): k = "direct / typed"
        r = out.setdefault(k, {"guests": 0, "accounts": 0, "players": 0, "d1_n": 0, "d1": 0, "d7_n": 0, "d7": 0, "lvl_sum": 0, "lvl10": 0})
        if u.get("_new_guest"): r["guests"] += 1
        if u.get("_new_account"): r["accounts"] += 1
        r["players"] += 1
        created, seen = u.get("created_at") or "", u.get("last_seen") or ""
        for days, n, hit in ((1, "d1_n", "d1"), (7, "d7_n", "d7")):
            mark = iso(datetime.fromisoformat(created) + timedelta(days=days)) if created else None
            if mark and mark <= t:
                r[n] += 1
                if seen >= mark: r[hit] += 1
        lvl = level_from_xp(u.get("xp", 0))[0]
        r["lvl_sum"] += lvl; r["lvl10"] += lvl >= 10
    for r in out.values():
        r["back_1d"] = round(100 * r["d1"] / r["d1_n"]) if r["d1_n"] else None
        r["back_7d"] = round(100 * r["d7"] / r["d7_n"]) if r["d7_n"] else None
        r["avg_level"] = round(r["lvl_sum"] / r["players"], 1) if r["players"] else None
    return out


@api.get("/admin/traffic")
async def admin_traffic(days: int = 30, admin=Depends(require_admin)):
    days = max(1, min(days, 365))
    t = iso(now())
    since = iso(now() - timedelta(days=days))
    by_page = await db.visits.aggregate([{"$match": {"at": {"$gte": since}}},
                                         {"$group": {"_id": {"$ifNull": ["$page", "$source"]}, "visits": {"$sum": 1}, "mobile": {"$sum": {"$cond": ["$ua_mobile", 1, 0]}}, "last": {"$max": "$at"}}},
                                         {"$sort": {"visits": -1}}, {"$limit": 300}]).to_list(300)
    by_day = await db.visits.aggregate([{"$match": {"at": {"$gte": since}}}, {"$group": {"_id": "$day", "visits": {"$sum": 1}}}, {"$sort": {"_id": 1}}]).to_list(400)
    users = await db.users.find({"$or": [{"claimed_at": {"$gte": since}}, {"created_at": {"$gte": since}}]},
                                {"acq_page": 1, "acq_source": 1, "is_guest": 1, "claimed_at": 1, "created_at": 1, "last_seen": 1, "xp": 1}).to_list(50000)
    for u in users:
        u["_new_guest"] = bool(u.get("is_guest")) and (u.get("created_at") or "") >= since
        u["_new_account"] = not u.get("is_guest") and (u.get("claimed_at") or "") >= since
    per = _player_stats(users, t)
    signups = sum(u["_new_account"] for u in users)
    guests = sum(u["_new_guest"] for u in users)
    rows = {r["_id"]: {"page": r["_id"], "visits": r["visits"], "mobile": r["mobile"], "last": r["last"]} for r in by_page}
    for k in per:
        if k not in rows and k != "unknown": rows[k] = {"page": k, "visits": 0, "mobile": 0, "last": None}
    keep = ("guests", "accounts", "players", "back_1d", "back_7d", "d7_n", "avg_level", "lvl10")
    pages = []
    for k, r in rows.items():
        p = per.get(k, {})
        pages.append({**r, "site": k if k == "direct / typed" else k.split("/")[0].split(" · ")[0], **{f: p.get(f, 0 if f in ("guests", "accounts", "players", "lvl10", "d7_n") else None) for f in keep}})
    pages.sort(key=lambda x: (-x["visits"], -x["accounts"], -x["guests"]))
    return {"days": days, "total": sum(r["visits"] for r in by_page), "signups": signups, "guests": guests,
            "pages": pages, "by_day": [{"day": r["_id"], "visits": r["visits"]} for r in by_day], "guides": await guide_stats(since)}
