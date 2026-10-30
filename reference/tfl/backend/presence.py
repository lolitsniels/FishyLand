"""Presence: remember each angler's country (from IP, cached) and platform (from user agent) for the admin online list."""
import asyncio
import ipaddress
import logging
import re
from datetime import datetime, timedelta

import httpx
from fastapi import Depends, Request

from server import api, db, now, iso, online_cutoff, require_admin, level_from_xp, client_ip, WATER_BY_KEY

log = logging.getLogger("presence")
PRESENCE_REFRESH = timedelta(minutes=10)


def parse_platform(ua: str, client: str) -> str:
    ua = ua or ""
    if "iPhone" in ua or "iPod" in ua: dev = "iPhone"
    elif "iPad" in ua: dev = "iPad"
    elif "Android" in ua: dev = "Android"
    elif "Windows" in ua: dev = "Windows"
    elif "Mac OS" in ua or "Macintosh" in ua: dev = "Mac"
    elif "CrOS" in ua: dev = "ChromeOS"
    elif "Linux" in ua: dev = "Linux"
    else: dev = "Unknown"
    if "Edg/" in ua: br = "Edge"
    elif "OPR/" in ua or "Opera" in ua: br = "Opera"
    elif "SamsungBrowser" in ua: br = "Samsung"
    elif "Firefox/" in ua: br = "Firefox"
    elif "Chrome/" in ua or "CriOS/" in ua: br = "Chrome"
    elif "Safari/" in ua: br = "Safari"
    else: br = ""
    kind = "app" if client == "pwa" else ("mobile" if dev in ("iPhone", "iPad", "Android") else "desktop")
    return f"{dev}{' · ' + br if br else ''}{' · installed app' if kind == 'app' else ''}"


def _public_ip(ip: str) -> bool:
    try:
        a = ipaddress.ip_address(ip)
        return not (a.is_private or a.is_loopback or a.is_link_local or a.is_reserved or a.is_multicast)
    except ValueError:
        return False


async def geo_lookup(ip: str):
    """Country for an IP via ip-api.com, cached in db.geo_cache for 30 days. Returns {"cc", "country"} or None."""
    if not ip or not _public_ip(ip): return None
    hit = await db.geo_cache.find_one({"ip": ip})
    if hit: return {"cc": hit.get("cc"), "country": hit.get("country")}
    geo = None
    try:
        async with httpx.AsyncClient(timeout=4) as c:
            r = await c.get(f"http://ip-api.com/json/{ip}", params={"fields": "status,country,countryCode"})
            d = r.json()
            if d.get("status") == "success":
                geo = {"cc": d.get("countryCode"), "country": d.get("country")}
    except Exception as e:
        log.info("geo lookup failed for %s: %s", ip, e)
    await db.geo_cache.update_one({"ip": ip}, {"$set": {"ip": ip, "cc": geo["cc"] if geo else None, "country": geo["country"] if geo else None, "at": iso(now())}}, upsert=True)
    return geo


async def _refresh(user_id, ip, platform):
    geo = await geo_lookup(ip)
    await db.users.update_one({"_id": user_id}, {"$set": {"presence": {"ip": ip, "platform": platform, "cc": geo["cc"] if geo else None,
                                                                       "country": geo["country"] if geo else None, "at": iso(now())}}})


def touch_presence(user: dict, request: Request):
    """Cheap: only refreshes when IP/platform changed or the record is older than PRESENCE_REFRESH."""
    ip = client_ip(request)
    platform = parse_platform(request.headers.get("user-agent", ""), request.headers.get("x-client", ""))
    p = user.get("presence") or {}
    fresh = p.get("at") and (now() - datetime.fromisoformat(p["at"])) < PRESENCE_REFRESH
    if p.get("ip") == ip and p.get("platform") == platform and fresh: return
    asyncio.create_task(_refresh(user["_id"], ip, platform))


@api.get("/admin/online")
async def admin_online(admin=Depends(require_admin)):
    rows = await db.users.find({"last_seen": {"$gte": online_cutoff()}},
                               {"username": 1, "xp": 1, "water": 1, "avatar": 1, "frame": 1, "is_guest": 1, "presence": 1, "last_seen": 1, "acq_source": 1}).sort("last_seen", -1).limit(200).to_list(200)
    out = []
    for u in rows:
        p = u.get("presence") or {}
        out.append({"id": str(u["_id"]), "username": u["username"], "level": level_from_xp(u["xp"])[0], "is_guest": u.get("is_guest", False),
                    "water": WATER_BY_KEY.get(u.get("water"), {}).get("name"), "last_seen": u["last_seen"],
                    "cc": p.get("cc"), "country": p.get("country"), "platform": p.get("platform"), "ip": p.get("ip"), "source": u.get("acq_source") or "unknown"})
    return out
