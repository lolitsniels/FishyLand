"""Platform stats for distributors: DAU, MAU, retention and playtime, rebuilt from the permanent catch log."""
import time
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Depends

from server import api, db, now, require_admin

GAP = 600          # seconds between catches that still count as one session
LEAD = 60          # time before a session's first catch (casting, the fight)
WINDOW = 90        # days of history used
CACHE_SECS = 900
_cache = {"at": 0, "data": None}


def _pct(a, b): return round(100 * a / b, 1) if b else None


async def _user_days(since):
    """One row per player per day: seconds played and sessions, worked out inside Mongo."""
    pipe = [
        {"$match": {"caught_at": {"$gte": since}, "caught_by": {"$type": "string"}}},
        {"$project": {"_id": 0, "u": "$caught_by", "d": {"$substrCP": ["$caught_at", 0, 10]}, "ts": {"$dateFromString": {"dateString": "$caught_at", "onError": None}}}},
        {"$match": {"ts": {"$ne": None}}},
        {"$setWindowFields": {"partitionBy": "$u", "sortBy": {"ts": 1}, "output": {"prev": {"$shift": {"output": "$ts", "by": -1, "default": None}}}}},
        {"$project": {"u": 1, "d": 1, "gap": {"$cond": [{"$eq": ["$prev", None]}, None, {"$divide": [{"$subtract": ["$ts", "$prev"]}, 1000]}]}}},
        {"$project": {"u": 1, "d": 1, "new": {"$or": [{"$eq": ["$gap", None]}, {"$gt": ["$gap", GAP]}]}, "gap": 1}},
        {"$group": {"_id": {"u": "$u", "d": "$d"}, "secs": {"$sum": {"$cond": ["$new", LEAD, "$gap"]}}, "sess": {"$sum": {"$cond": ["$new", 1, 0]}}}},
    ]
    return await db.catch_log.aggregate(pipe, allowDiskUse=True).to_list(None)


async def _compute():
    t = now(); today = t.date(); tday = today.isoformat()
    since = (t - timedelta(days=WINDOW)).isoformat()
    banned = {str(u["_id"]) for u in await db.users.find({"banned": {"$nin": [None, False]}}, {"_id": 1}).to_list(None)}
    rows = [r for r in await _user_days(since) if r["_id"]["u"] not in banned]
    active, days_of = defaultdict(set), defaultdict(set)
    for r in rows:
        u, d = r["_id"]["u"], r["_id"]["d"]; active[d].add(u); days_of[u].add(d)

    def day(i): return (today - timedelta(days=i)).isoformat()

    def window(n):
        s = set()
        for i in range(1, n + 1): s |= active.get(day(i), set())
        return s
    dau = [len(active.get(day(i), ())) for i in range(1, 31)]
    mau = len(window(30)); dau7, dau30 = round(sum(dau[:7]) / 7, 1), round(sum(dau) / 30, 1)
    last30 = [r for r in rows if day(30) <= r["_id"]["d"] < tday]
    secs = sum(r["secs"] for r in last30); sess = sum(r["sess"] for r in last30)

    created = {str(u["_id"]): u["created_at"][:10] for u in await db.users.find({"created_at": {"$gte": since}}, {"created_at": 1}).to_list(None) if u.get("created_at")}
    ret = {}
    for n in (1, 7, 30):
        cohort = [u for u, c in created.items() if u not in banned and days_of.get(u) and (datetime.fromisoformat(c).date() + timedelta(days=n)) < today]
        mark = {u: (datetime.fromisoformat(created[u]).date() + timedelta(days=n)).isoformat() for u in cohort}
        ret[f"d{n}"] = {"cohort": len(cohort), "exact": _pct(sum(mark[u] in days_of[u] for u in cohort), len(cohort)),
                        "rolling": _pct(sum(any(d >= mark[u] for d in days_of[u]) for u in cohort), len(cohort))}
    return {
        "generated_at": t.isoformat(), "history_from": min(active) if active else None, "players_seen": len(days_of),
        "dau_7": dau7, "dau_30": dau30, "dau_peak": max(dau), "wau": len(window(7)), "mau": mau, "stickiness": _pct(dau30, mau),
        "playtime_min_per_dau": round(secs / len(last30) / 60, 1) if last30 else None,
        "session_min": round(secs / sess / 60, 1) if sess else None,
        "sessions_per_day": round(sess / len(last30), 2) if last30 else None,
        "retention": ret, "accounts": await db.users.count_documents({"is_guest": {"$ne": True}}),
    }


@api.get("/admin/platform-stats")
async def platform_stats(fresh: bool = False, admin=Depends(require_admin)):
    if fresh or not _cache["data"] or time.time() - _cache["at"] > CACHE_SECS:
        _cache["data"] = await _compute(); _cache["at"] = time.time()
    return _cache["data"]
