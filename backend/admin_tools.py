from datetime import timedelta
from typing import Optional

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import (api, db, now, iso, oid, online_cutoff, require_admin, hash_password, admin_user_view, is_admin_user, level_from_xp)
from game_data import FISH_BY_ID

ANNOUNCE_MAX_MIN = 24 * 60


class TargetIn(BaseModel):
    username: str
    reason: Optional[str] = Field(default=None, max_length=200)


class MuteIn(TargetIn):
    minutes: int = Field(default=60, ge=0, le=60 * 24 * 365)


class DeleteIn(BaseModel):
    username: str
    confirm: str


class ResetPasswordIn(BaseModel):
    username: str
    password: str = Field(min_length=6, max_length=72)


class RoleIn(BaseModel):
    username: str
    admin: bool


class SupporterIn(BaseModel):
    username: str
    supporter: bool


class AnnounceIn(BaseModel):
    text: str = Field(min_length=1, max_length=240)
    minutes: int = Field(default=30, ge=1, le=ANNOUNCE_MAX_MIN)


async def log_action(admin, target, action, changes):
    await db.admin_log.insert_one({"admin": admin["username"], "target": target, "action": action, "changes": changes, "at": iso(now())})


async def find_target(username, admin=None, allow_self=False):
    u = await db.users.find_one({"username_lc": username.lower()})
    if not u:
        raise HTTPException(404, "No such angler")
    if admin is not None and not allow_self and u["_id"] == admin["_id"]:
        raise HTTPException(400, "You cannot do that to your own account")
    return u


async def cancel_listings(uid):
    open_ls = await db.listings.find({"seller_id": uid, "status": "open"}).to_list(500)
    for l in open_ls:
        if l["kind"] == "fish" and l["item"].get("catch_id"):
            await db.catches.update_one({"_id": ObjectId(l["item"]["catch_id"])}, {"$set": {"listed": False}})
    await db.listings.update_many({"seller_id": uid, "status": "open"}, {"$set": {"status": "removed", "removed_at": iso(now())}})
    return len(open_ls)


async def remove_from_crew(u):
    uid = str(u["_id"])
    c = await db.crews.find_one({"members.user_id": uid})
    if not c:
        return
    remaining = [m for m in c["members"] if m["user_id"] != uid]
    if not remaining:
        await db.crews.delete_one({"_id": c["_id"]})
        await db.chat.delete_many({"channel": "crew", "crew_id": str(c["_id"])})
        await db.crew_invites.delete_many({"crew_id": str(c["_id"])})
        return
    sets = {"members": remaining, "officer_ids": [o for o in c.get("officer_ids", []) if o != uid]}
    if c["leader_id"] == uid:
        heir = next((m for m in remaining if m["user_id"] in c.get("officer_ids", [])), remaining[0])
        sets["leader"], sets["leader_id"] = heir["username"], heir["user_id"]
        sets["officer_ids"] = [o for o in sets["officer_ids"] if o != heir["user_id"]]
    await db.crews.update_one({"_id": c["_id"]}, {"$set": sets})


async def purge_user(u):
    uid, name = str(u["_id"]), u["username"]
    await remove_from_crew(u)
    await db.catches.delete_many({"user_id": uid})
    await db.journal.delete_many({"user_id": uid})
    await db.listings.delete_many({"seller_id": uid})
    await db.quests.delete_many({"user_id": uid})
    await db.messages.delete_many({"$or": [{"from_id": uid}, {"to_id": uid}]})
    await db.friends.delete_many({"pair": uid})
    await db.crew_invites.delete_many({"user_id": uid})
    await db.boss_kills.delete_many({"user_id": uid})
    await db.bounty_claims.delete_many({"user_id": uid})
    await db.contracts.delete_many({"user_id": uid})
    await db.pending.delete_many({"user_id": uid})
    await db.feed.delete_many({"username": name})
    await db.chat.delete_many({"username": name})
    await db.alerts.delete_many({"username": name})
    await db.guestbook.delete_many({"$or": [{"profile_id": uid}, {"author_id": uid}]})
    await db.users.delete_one({"_id": u["_id"]})


@api.post("/admin/ban")
async def admin_ban(body: TargetIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin)
    if is_admin_user(u):
        raise HTTPException(400, "Demote that admin before banning them")
    ban = {"reason": (body.reason or "").strip(), "at": iso(now()), "by": admin["username"]}
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"banned": ban}})
    n = await cancel_listings(str(u["_id"]))
    await log_action(admin, u["username"], "ban", [f"banned ({ban['reason'] or 'no reason'})", f"{n} listings removed"])
    return {"ok": True, "user": admin_user_view(await db.users.find_one({"_id": u["_id"]}))}


@api.post("/admin/unban")
async def admin_unban(body: TargetIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin, allow_self=True)
    await db.users.update_one({"_id": u["_id"]}, {"$unset": {"banned": ""}})
    await log_action(admin, u["username"], "unban", ["ban lifted"])
    return {"ok": True, "user": admin_user_view(await db.users.find_one({"_id": u["_id"]}))}


@api.post("/admin/mute")
async def admin_mute(body: MuteIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin)
    until = iso(now() + timedelta(minutes=body.minutes)) if body.minutes else None
    mute = {"until": until, "reason": (body.reason or "").strip(), "at": iso(now()), "by": admin["username"]}
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"mute": mute}})
    label = f"chat muted for {body.minutes} min" if body.minutes else "chat muted permanently"
    await log_action(admin, u["username"], "mute", [label + (f" ({mute['reason']})" if mute["reason"] else "")])
    return {"ok": True, "user": admin_user_view(await db.users.find_one({"_id": u["_id"]}))}


@api.post("/admin/unmute")
async def admin_unmute(body: TargetIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin, allow_self=True)
    await db.users.update_one({"_id": u["_id"]}, {"$unset": {"mute": ""}})
    await log_action(admin, u["username"], "unmute", ["chat mute lifted"])
    return {"ok": True, "user": admin_user_view(await db.users.find_one({"_id": u["_id"]}))}


@api.post("/admin/delete")
async def admin_delete(body: DeleteIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin)
    if body.confirm != u["username"]:
        raise HTTPException(400, "Type the angler's exact name to confirm deletion")
    if is_admin_user(u):
        raise HTTPException(400, "Demote that admin before deleting them")
    await purge_user(u)
    await log_action(admin, u["username"], "delete", ["account and all traces deleted"])
    return {"ok": True}


@api.post("/admin/reset-password")
async def admin_reset_password(body: ResetPasswordIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin, allow_self=True)
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.login_attempts.delete_many({"identifier": {"$regex": f":{u['username_lc']}$"}})
    await log_action(admin, u["username"], "reset_password", ["password reset"])
    return {"ok": True}


@api.post("/admin/role")
async def admin_role(body: RoleIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin)
    if u.get("is_guest"):
        raise HTTPException(400, "Guests cannot be made admin")
    if body.admin:
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"role": "admin"}})
    else:
        await db.users.update_one({"_id": u["_id"]}, {"$unset": {"role": ""}})
    await log_action(admin, u["username"], "role", ["promoted to admin" if body.admin else "admin rights removed"])
    return {"ok": True, "user": admin_user_view(await db.users.find_one({"_id": u["_id"]}))}


@api.post("/admin/supporter")
async def admin_supporter(body: SupporterIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin, allow_self=True)
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"supporter": body.supporter}})
    await log_action(admin, u["username"], "supporter", ["supporter heart given" if body.supporter else "supporter heart removed"])
    return {"ok": True, "user": admin_user_view(await db.users.find_one({"_id": u["_id"]}))}


@api.get("/admin/chat")
async def admin_chat(channel: str = "global", q: str = "", crew_id: str = "", before: str = "", limit: int = 80, admin=Depends(require_admin)):
    """Newest first; pass `before` (the oldest `at` on screen) to page back through the full history, chat is never pruned."""
    if channel not in ("global", "trade", "crew"):
        raise HTTPException(400, "Unknown channel")
    flt = {"channel": channel}
    if channel == "crew" and crew_id: flt["crew_id"] = crew_id
    if before: flt["at"] = {"$lt": before}
    if q:
        flt["$or"] = [{"username": {"$regex": q, "$options": "i"}}, {"text": {"$regex": q, "$options": "i"}}]
    limit = min(limit, 200)
    rows = await db.chat.find(flt).sort("at", -1).limit(limit + 1).to_list(limit + 1)
    more = len(rows) > limit; rows = rows[:limit]
    crews = {}
    if channel == "crew":
        ids = {r.get("crew_id") for r in rows if r.get("crew_id")}
        if crew_id: ids.add(crew_id)
        crews = {str(c["_id"]): {"name": c["name"], "tag": c.get("tag")} async for c in db.crews.find({"_id": {"$in": [oid(i) for i in ids if ObjectId.is_valid(i)]}}, {"name": 1, "tag": 1})}
    out = [{**{k: v for k, v in r.items() if k != "_id"}, "id": str(r["_id"]), "crew": crews.get(r.get("crew_id"))} for r in rows]
    all_crews = [{"id": str(c["_id"]), "name": c["name"], "tag": c.get("tag")} async for c in db.crews.find({}, {"name": 1, "tag": 1}).sort("name", 1)] if channel == "crew" else []
    return {"rows": out, "more": more, "crews": all_crews}


@api.delete("/admin/chat/{msg_id}")
async def admin_delete_chat(msg_id: str, admin=Depends(require_admin)):
    m = await db.chat.find_one({"_id": oid(msg_id)})
    if not m:
        raise HTTPException(404, "Message already gone")
    await db.chat.delete_one({"_id": m["_id"]})
    await log_action(admin, m.get("username", "?"), "delete_chat", [f"deleted {m.get('channel')} message: \"{m.get('text', '')[:80]}\""])
    return {"ok": True}


@api.post("/admin/announce")
async def admin_announce(body: AnnounceIn, admin=Depends(require_admin)):
    text = body.text.strip()
    doc = {"username": "Harbourmaster", "water": None, "water_name": None, "status": "announce", "species": None, "weight": None,
           "variant": None, "text": text, "cheers": [], "at": iso(now()), "end": iso(now() + timedelta(minutes=body.minutes)), "by": admin["username"]}
    res = await db.alerts.insert_one(doc)
    await db.feed.insert_one({"kind": "announce", "username": admin["username"], "text": f"Harbourmaster's notice: {text}", "rarity": "epic", "at": iso(now())})
    await log_action(admin, "server", "announce", [f"announcement for {body.minutes} min: \"{text[:80]}\""])
    return {"ok": True, "id": str(res.inserted_id)}


@api.get("/admin/announcements")
async def admin_announcements(admin=Depends(require_admin)):
    rows = await db.alerts.find({"status": "announce"}).sort("at", -1).limit(20).to_list(20)
    return [{"id": str(a["_id"]), "text": a["text"], "at": a["at"], "end": a["end"], "by": a.get("by"), "active": a["end"] >= iso(now())} for a in rows]


@api.delete("/admin/announcements/{alert_id}")
async def admin_end_announcement(alert_id: str, admin=Depends(require_admin)):
    a = await db.alerts.find_one({"_id": oid(alert_id), "status": "announce"})
    if not a:
        raise HTTPException(404, "No such announcement")
    await db.alerts.update_one({"_id": a["_id"]}, {"$set": {"end": iso(now() - timedelta(seconds=1))}})
    await log_action(admin, "server", "announce_end", [f"ended announcement: \"{a['text'][:80]}\""])
    return {"ok": True}


@api.get("/admin/overview")
async def admin_overview(admin=Depends(require_admin)):
    since = online_cutoff()
    day0 = now().strftime("%Y-%m-%dT00:00:00")
    return {"players": await db.users.count_documents({"is_guest": {"$ne": True}}), "online": await db.users.count_documents({"last_seen": {"$gte": since}}),
            "guests": await db.users.count_documents({"is_guest": True}), "banned": await db.users.count_documents({"banned": {"$exists": True}}),
            "muted": await db.users.count_documents({"mute": {"$exists": True}}), "admins": await db.users.count_documents({"role": "admin"}),
            "catches": await db.catches.count_documents({}), "open_listings": await db.listings.count_documents({"status": "open"}),
            "chat_today": await db.chat.count_documents({"at": {"$gte": now().strftime("%Y-%m-%dT00:00:00")}}),
            "new_today": await db.users.count_documents({"is_guest": {"$ne": True}, "created_at": {"$gte": day0}}),
            "new_guests_today": await db.users.count_documents({"is_guest": True, "created_at": {"$gte": day0}})}


class MergeIn(BaseModel):
    username: str
    source: str


SUM_STATS = ("casts", "catches", "escaped", "gold_earned", "sold", "legendary", "boss_kills", "votes", "cheers", "pearls_earned", "secret_finds", "contracts_done", "favour_total", "special_contracts")


@api.post("/admin/merge")
async def admin_merge(body: MergeIn, admin=Depends(require_admin)):
    """Fold an old (usually guest) account into the player's real one: catches, journal, kills, currency and stats move over."""
    tgt = await find_target(body.username, admin, allow_self=True)
    src = await find_target(body.source, admin)
    if src["_id"] == tgt["_id"]: raise HTTPException(400, "Pick two different anglers")
    if is_admin_user(src): raise HTTPException(400, "Demote that admin before merging them away")
    sid, tid, tname = str(src["_id"]), str(tgt["_id"]), tgt["username"]
    moved = (await db.catches.update_many({"user_id": sid}, {"$set": {"user_id": tid, "username": tname}})).modified_count
    await db.catches.update_many({"caught_by": sid}, {"$set": {"caught_by": tid, "caught_by_name": tname}})
    new_species = 0
    async for j in db.journal.find({"user_id": sid}):
        have = await db.journal.find_one({"user_id": tid, "species_id": j["species_id"]})
        if have:
            upd = {"$inc": {"count": j.get("count", 1)}, "$max": {"best_kg": j.get("best_kg", 0)}, "$addToSet": {"variants": {"$each": j.get("variants") or []}}}
            if j.get("first_at"): upd["$min"] = {"first_at": j["first_at"]}
            await db.journal.update_one({"_id": have["_id"]}, upd)
            await db.journal.delete_one({"_id": j["_id"]})
        else:
            await db.journal.update_one({"_id": j["_id"]}, {"$set": {"user_id": tid}})
            new_species += 1
    await db.contracts.delete_many({"user_id": sid, "status": {"$in": ["offered", "expired", "rerolled", "abandoned"]}})
    await db.contracts.update_many({"user_id": sid}, {"$set": {"user_id": tid}})
    for coll in ("boss_kills", "bounty_claims", "vote_log"):
        await db[coll].update_many({"user_id": sid}, {"$set": {"user_id": tid, "username": tname}})
    await db.listings.update_many({"seller_id": sid}, {"$set": {"seller_id": tid, "seller": tname}})
    await db.feed.update_many({"username": src["username"]}, {"$set": {"username": tname}})
    ss, ts = src.get("stats", {}), tgt.get("stats", {})
    inc = {"xp": src.get("xp", 0), "gold": src.get("gold", 0), "pearls": src.get("pearls", 0), "stats.species": new_species}
    for k in SUM_STATS:
        if ss.get(k): inc[f"stats.{k}"] = ss[k]
    for pid, pts in (src.get("favour") or {}).items():
        if pts: inc[f"favour.{pid}"] = pts
    sets = {}
    if (ss.get("heaviest_kg") or 0) > (ts.get("heaviest_kg") or 0):
        sets["stats.heaviest_kg"] = ss["heaviest_kg"]; sets["stats.heaviest_name"] = ss.get("heaviest_name")
    for b, n in (src.get("bait") or {}).items():
        if n: inc[f"bait.{b}"] = n
    op = {"$inc": inc, "$addToSet": {"owned_gear": {"$each": src.get("owned_gear") or []}, "unlocked_waters": {"$each": src.get("unlocked_waters") or []},
                                     "owned_avatars": {"$each": src.get("owned_avatars") or []}}}
    if sets: op["$set"] = sets
    await db.users.update_one({"_id": tgt["_id"]}, op)
    await purge_user(src)
    await log_action(admin, tname, "merge", [f"merged {src['username']} into {tname}", f"{moved} catches", f"{new_species} new species", f"{src.get('gold', 0)}g, {src.get('xp', 0)} xp, {src.get('pearls', 0)}P"])
    return {"ok": True, "moved_catches": moved, "new_species": new_species, "user": admin_user_view(await db.users.find_one({"_id": tgt["_id"]}))}


@api.get("/admin/doubles")
async def admin_doubles(admin=Depends(require_admin)):
    """Accounts that share a connection: any two accounts seen from the same (hashed) IP, at sign-up, last login or in the recent IP history."""
    fields = {"username": 1, "username_lc": 1, "xp": 1, "is_guest": 1, "banned": 1, "role": 1, "last_seen": 1, "created_at": 1, "gold": 1, "stats.catches": 1, "reg_ip_hash": 1, "last_ip_hash": 1, "ip_log.h": 1}
    by_hash = {}
    users = {}
    async for u in db.users.find({"$or": [{"reg_ip_hash": {"$exists": True}}, {"last_ip_hash": {"$exists": True}}]}, fields):
        uid = str(u["_id"]); users[uid] = u
        for h in {u.get("reg_ip_hash"), u.get("last_ip_hash"), *[e.get("h") for e in (u.get("ip_log") or [])]}:
            if h: by_hash.setdefault(h, set()).add(uid)
    # merge hashes into connected groups (A shares ip1 with B, B shares ip2 with C -> one household)
    parent = {}
    def find(x):
        while parent.setdefault(x, x) != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for ids in by_hash.values():
        ids = list(ids)
        for other in ids[1:]: parent[find(other)] = find(ids[0])
    groups = {}
    for h, ids in by_hash.items():
        if len(ids) < 2: continue
        root = find(next(iter(ids)))
        g = groups.setdefault(root, {"ids": set(), "hashes": set()})
        g["ids"] |= ids; g["hashes"].add(h)
    def view(uid):
        u = users[uid]
        return {"username": u["username"], "level": level_from_xp(u.get("xp", 0))[0], "guest": bool(u.get("is_guest")), "banned": bool(u.get("banned")), "admin": is_admin_user(u),
                "last_seen": u.get("last_seen"), "created_at": u.get("created_at"), "gold": u.get("gold", 0), "catches": (u.get("stats") or {}).get("catches", 0),
                "current": u.get("last_ip_hash", "")[:6], "signup": u.get("reg_ip_hash", "")[:6]}
    out = []
    for g in groups.values():
        members = sorted((view(i) for i in g["ids"]), key=lambda m: m["last_seen"] or "", reverse=True)
        out.append({"key": min(g["hashes"])[:6], "connections": sorted(h[:6] for h in g["hashes"]), "size": len(members), "guests": sum(m["guest"] for m in members),
                    "banned": sum(m["banned"] for m in members), "last_seen": max((m["last_seen"] or "") for m in members), "members": members})
    out.sort(key=lambda g: (-(g["size"] - g["guests"]), -g["size"], g["last_seen"]), reverse=False)
    return {"groups": out, "accounts": sum(g["size"] for g in out)}


@api.get("/admin/cheat-log")
async def admin_cheat_log(admin=Depends(require_admin)):
    """Flagged fights: per-angler totals (hard vs soft) for the last 7 days plus the latest 60 entries."""
    since = iso(now() - timedelta(days=7))
    by_user = await db.cheat_log.aggregate([{"$match": {"at": {"$gte": since}}},
                                            {"$group": {"_id": "$user_id", "username": {"$last": "$username"}, "flags": {"$sum": 1},
                                                        "hard": {"$sum": {"$cond": [{"$ne": ["$hard", False]}, 1, 0]}}, "last": {"$max": "$at"},
                                                        "reasons": {"$addToSet": {"$split": ["$reason", ","]}}}},
                                            {"$sort": {"hard": -1, "flags": -1}}, {"$limit": 50}]).to_list(50)
    ids = [ObjectId(r["_id"]) for r in by_user if ObjectId.is_valid(r["_id"])]
    catches = {str(u["_id"]): u.get("stats", {}).get("catches", 0) async for u in db.users.find({"_id": {"$in": ids}}, {"stats.catches": 1})}
    recent = await db.cheat_log.find({}).sort("at", -1).limit(60).to_list(60)
    return {"since": since,
            "anglers": [{"username": r["username"], "flags": r["flags"], "hard": r["hard"], "soft": r["flags"] - r["hard"], "last": r["last"],
                         "reasons": sorted({x for lst in r["reasons"] for x in lst}), "catches": catches.get(r["_id"], 0)} for r in by_user],
            "recent": [{"username": c["username"], "species": FISH_BY_ID.get(c.get("species_id"), {}).get("name", c.get("species_id")), "reason": c["reason"],
                        "hard": c.get("hard", True), "elapsed": round(c.get("elapsed", 0), 1), "age": round(c.get("age", 0), 1), "holds": c.get("holds", 0), "at": c["at"]} for c in recent]}
