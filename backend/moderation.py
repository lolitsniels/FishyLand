"""Moderators: limited staff powers. Mute 1-6 h, ban 1 day / 1 week, warn, lift mod-made sanctions, delete public chat,
10-minute global slow mode, a staff chat and basic stats. Every action lands in the admin log; mods can never act on staff."""
import re
from datetime import timedelta
from typing import Optional

from pymongo.errors import DuplicateKeyError

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, oid, online_cutoff, get_current_user, require_admin, is_admin_user, is_mod_user, level_from_xp, send_system_message, public_user
from admin_tools import log_action, find_target, cancel_listings

SLOW_KEY = "chat_slow_until"
SLOW_SECONDS = 30


async def require_mod(user=Depends(get_current_user)):
    if not (is_mod_user(user) or is_admin_user(user)): raise HTTPException(403, "Staff only")
    return user


async def mod_target(username, mod):
    u = await find_target(username, mod)
    if is_admin_user(u) or is_mod_user(u): raise HTTPException(400, "Staff can't be moderated here, ask the owner")
    return u


def _by_mod(sanction):
    return bool(sanction) and (sanction.get("by_role") == "mod" or sanction.get("by") == "system")


class ModIn(BaseModel):
    username: str
    reason: Optional[str] = Field(default="", max_length=200)


class ModMuteIn(ModIn):
    hours: int = Field(ge=1, le=6)


class ModBanIn(ModIn):
    days: int


class RoleModIn(BaseModel):
    username: str
    mod: bool


class StaffMsgIn(BaseModel):
    text: str = Field(min_length=1, max_length=400)


class SlowIn(BaseModel):
    on: bool


@api.post("/admin/mod")
async def admin_set_mod(body: RoleModIn, admin=Depends(require_admin)):
    u = await find_target(body.username, admin)
    if u.get("is_guest"): raise HTTPException(400, "Guests cannot be made MOD")
    if is_admin_user(u): raise HTTPException(400, "That angler is already an admin")
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"role": "mod"}} if body.mod else {"$unset": {"role": ""}})
    await log_action(admin, u["username"], "role", ["made MOD" if body.mod else "MOD rights removed"])
    if body.mod: await send_system_message(str(u["_id"]), u["username"], "You are now a MOD of FishyLand. Your Mod Panel is in the menu. Thank you for keeping the docks friendly!")
    return {"ok": True}


@api.get("/mod/overview")
async def mod_overview(mod=Depends(require_mod)):
    day0 = now().strftime("%Y-%m-%dT00:00:00")
    t = iso(now())
    slow = await db.meta.find_one({"key": SLOW_KEY})
    return {"players": await db.users.count_documents({"is_guest": {"$ne": True}}), "online": await db.users.count_documents({"last_seen": {"$gte": online_cutoff()}}),
            "new_today": await db.users.count_documents({"is_guest": {"$ne": True}, "created_at": {"$gte": day0}}),
            "guests_today": await db.users.count_documents({"is_guest": True, "created_at": {"$gte": day0}}),
            "muted": await db.users.count_documents({"mute": {"$exists": True}, "$or": [{"mute.until": None}, {"mute.until": {"$gt": t}}]}),
            "banned": await db.users.count_documents({"banned": {"$exists": True}, "$or": [{"banned.until": {"$exists": False}}, {"banned.until": {"$gt": t}}]}),
            "fish_caught": await db.catch_log.count_documents({}),
            "slow_until": (slow or {}).get("value") if (slow or {}).get("value", "") > t else None}


@api.get("/mod/player/{username}")
async def mod_player(username: str, mod=Depends(require_mod)):
    u = await find_target(username, None)
    hist = await db.admin_log.find({"target": u["username"], "action": {"$in": ["warn", "mute", "unmute", "ban", "unban", "delete_chat"]}}).sort("at", -1).limit(40).to_list(40)
    recent = [h for h in hist if h["at"] >= iso(now() - timedelta(days=30)) and h["action"] in ("warn", "mute", "ban")]
    standing = "good" if not recent else "watch" if len(recent) <= 2 and not any(h["action"] == "ban" for h in recent) else "bad"
    m, b = u.get("mute"), u.get("banned")
    return {"username": u["username"], "level": level_from_xp(u["xp"])[0], "joined": u.get("created_at"), "is_guest": bool(u.get("is_guest")),
            "staff": is_admin_user(u) or is_mod_user(u), "last_seen": u.get("last_seen"), "catches": (u.get("stats") or {}).get("catches", 0),
            "mute": m and {"until": m.get("until"), "reason": m.get("reason"), "by": m.get("by"), "liftable": _by_mod(m)},
            "ban": b and {"until": b.get("until"), "reason": b.get("reason"), "by": b.get("by"), "liftable": _by_mod(b)},
            "standing": standing, "history": [{"action": h["action"], "by": h["admin"], "at": h["at"], "what": "; ".join(h.get("changes") or [])} for h in hist]}


@api.post("/mod/warn")
async def mod_warn(body: ModIn, mod=Depends(require_mod)):
    u = await mod_target(body.username, mod)
    reason = (body.reason or "").strip() or "Please keep chat friendly and within the rules."
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"warning": {"reason": reason, "by": mod["username"], "at": iso(now())}}})
    await send_system_message(str(u["_id"]), u["username"], f"Official warning from the harbour staff: {reason}")
    await log_action(mod, u["username"], "warn", [f"warned: {reason}"])
    return {"ok": True}


@api.post("/mod/mute")
async def mod_mute(body: ModMuteIn, mod=Depends(require_mod)):
    u = await mod_target(body.username, mod)
    if u.get("mute") and not _by_mod(u["mute"]) and (u["mute"].get("until") is None or u["mute"]["until"] > iso(now())): raise HTTPException(400, "The owner already muted this angler")
    mute = {"until": iso(now() + timedelta(hours=body.hours)), "reason": (body.reason or "").strip(), "at": iso(now()), "by": mod["username"], "by_role": "mod"}
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"mute": mute}})
    await log_action(mod, u["username"], "mute", [f"chat muted for {body.hours} h" + (f" ({mute['reason']})" if mute["reason"] else "")])
    return {"ok": True}


@api.post("/mod/ban")
async def mod_ban(body: ModBanIn, mod=Depends(require_mod)):
    if body.days not in (1, 7): raise HTTPException(400, "MODs can ban for 1 day or 1 week")
    u = await mod_target(body.username, mod)
    if u.get("banned") and not _by_mod(u["banned"]) and (not u["banned"].get("until") or u["banned"]["until"] > iso(now())): raise HTTPException(400, "The owner already banned this angler")
    ban = {"until": iso(now() + timedelta(days=body.days)), "reason": (body.reason or "").strip(), "at": iso(now()), "by": mod["username"], "by_role": "mod"}
    await db.users.update_one({"_id": u["_id"]}, {"$set": {"banned": ban}})
    n = await cancel_listings(str(u["_id"]))
    await log_action(mod, u["username"], "ban", [f"banned for {'1 day' if body.days == 1 else '1 week'} ({ban['reason'] or 'no reason'})", f"{n} listings removed"])
    return {"ok": True}


@api.post("/mod/unmute")
async def mod_unmute(body: ModIn, mod=Depends(require_mod)):
    u = await mod_target(body.username, mod)
    if not _by_mod(u.get("mute")): raise HTTPException(400, "Only mutes made by MODs can be lifted here")
    await db.users.update_one({"_id": u["_id"]}, {"$unset": {"mute": ""}})
    await log_action(mod, u["username"], "unmute", ["chat mute lifted"])
    return {"ok": True}


@api.post("/mod/unban")
async def mod_unban(body: ModIn, mod=Depends(require_mod)):
    u = await mod_target(body.username, mod)
    if not _by_mod(u.get("banned")): raise HTTPException(400, "Only bans made by MODs can be lifted here")
    await db.users.update_one({"_id": u["_id"]}, {"$unset": {"banned": ""}})
    await log_action(mod, u["username"], "unban", ["ban lifted"])
    return {"ok": True}


@api.get("/mod/chat")
async def mod_chat(channel: str = "global", q: str = "", before: str = "", mod=Depends(require_mod)):
    if channel not in ("global", "trade"): raise HTTPException(400, "MODs can read global and trade chat")
    flt = {"channel": channel}
    if before: flt["at"] = {"$lt": before}
    if q: flt["$or"] = [{"username": {"$regex": re.escape(q[:40]), "$options": "i"}}, {"text": {"$regex": re.escape(q[:40]), "$options": "i"}}]
    rows = await db.chat.find(flt).sort("at", -1).limit(81).to_list(81)
    return {"rows": [{"id": str(r["_id"]), "username": r.get("username"), "text": r.get("text", ""), "at": r["at"], "item": (r.get("item") or {}).get("name")} for r in rows[:80]], "more": len(rows) > 80}


@api.delete("/mod/chat/{msg_id}")
async def mod_delete_chat(msg_id: str, mod=Depends(require_mod)):
    m = await db.chat.find_one({"_id": oid(msg_id)})
    if not m: raise HTTPException(404, "Message already gone")
    if m.get("channel") not in ("global", "trade") and not is_admin_user(mod): raise HTTPException(403, "MODs can only remove global and trade messages")
    await db.chat.delete_one({"_id": m["_id"]})
    await db.chat_reports.update_many({"msg_id": msg_id, "status": "open"}, {"$set": {"status": "removed", "handled_by": mod["username"], "handled_at": iso(now())}})
    await log_action(mod, m.get("username", "?"), "delete_chat", [f"deleted {m.get('channel')} message: \"{m.get('text', '')[:80]}\""])
    return {"ok": True}


@api.post("/mod/slowmode")
async def mod_slowmode(body: SlowIn, mod=Depends(require_mod)):
    until = iso(now() + timedelta(minutes=10)) if body.on else iso(now())
    await db.meta.update_one({"key": SLOW_KEY}, {"$set": {"value": until}}, upsert=True)
    await log_action(mod, "global chat", "slowmode", ["slow mode on for 10 min (1 message per 30 s)" if body.on else "slow mode off"])
    return {"slow_until": until if body.on else None}


async def slow_mode_active():
    s = await db.meta.find_one({"key": SLOW_KEY})
    return bool(s and s.get("value", "") > iso(now()))


@api.get("/mod/staff-chat")
async def staff_chat(mod=Depends(require_mod)):
    rows = await db.staff_chat.find({}).sort("at", -1).limit(100).to_list(100)
    return {"rows": [{"id": str(r["_id"]), "username": r["username"], "owner": r.get("owner", False), "system": r.get("system", False), "text": r["text"], "at": r["at"]} for r in reversed(rows)]}


@api.post("/mod/staff-chat")
async def staff_chat_post(body: StaffMsgIn, mod=Depends(require_mod)):
    await db.staff_chat.insert_one({"username": mod["username"], "owner": is_admin_user(mod), "text": body.text.strip(), "at": iso(now())})
    return {"ok": True}


@api.post("/warning/ack")
async def warning_ack(user=Depends(get_current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$unset": {"warning": ""}})
    user.pop("warning", None)
    return {"user": public_user(user)}


async def file_report(user, msg_id, fields, where):
    if await db.report_events.count_documents({"reporter": user["username"], "at": {"$gt": iso(now() - timedelta(hours=1))}}) >= 10:
        raise HTTPException(429, "You've sent a lot of reports. Thanks, the staff will look at them.")
    upd = {"$addToSet": {"reporters": user["username"]}, "$setOnInsert": {**fields, "created_at": iso(now())}}
    try:
        res = await db.chat_reports.update_one({"msg_id": msg_id, "status": "open"}, upd, upsert=True)
    except DuplicateKeyError:
        res = await db.chat_reports.update_one({"msg_id": msg_id, "status": "open"}, upd)
    if res.upserted_id or res.modified_count:
        await db.report_events.insert_one({"reporter": user["username"], "msg_id": msg_id, "at": iso(now())})
        await db.staff_chat.insert_one({"username": "Reports", "system": True, "owner": False, "at": iso(now()),
                                        "text": f"{user['username']} reported {fields['username']} {where}: \"{fields['text'][:120]}\""})
    return {"ok": True}


@api.post("/chat/report/{msg_id}")
async def chat_report(msg_id: str, user=Depends(get_current_user)):
    m = await db.chat.find_one({"_id": oid(msg_id)})
    if not m or m.get("channel") not in ("global", "trade"): raise HTTPException(404, "That message is gone")
    if m.get("username") in (user["username"], "Harbourmaster"): raise HTTPException(400, "You can't report that message")
    return await file_report(user, msg_id, {"channel": m["channel"], "username": m["username"], "text": m.get("text", ""), "item": (m.get("item") or {}).get("name"), "msg_at": m["at"]}, f"in {m['channel']}")


@api.post("/messages/report/{msg_id}")
async def pm_report(msg_id: str, user=Depends(get_current_user)):
    m = await db.messages.find_one({"_id": oid(msg_id), "to_id": str(user["_id"])})
    if not m or m.get("from_id") == "system": raise HTTPException(404, "You can only report messages sent to you")
    return await file_report(user, msg_id, {"channel": "private", "username": m["from"], "to": m["to"], "text": m.get("text", ""), "msg_at": m["at"]}, "in a private message")


@api.get("/mod/reports")
async def mod_reports(mod=Depends(require_mod)):
    rows = await db.chat_reports.find({"status": "open"}).sort("created_at", -1).limit(100).to_list(100)
    return {"rows": [{"id": str(r["_id"]), "msg_id": r["msg_id"], "channel": r["channel"], "username": r["username"], "text": r["text"], "item": r.get("item"), "to": r.get("to"),
                      "msg_at": r["msg_at"], "created_at": r["created_at"], "reporters": r["reporters"]} for r in rows]}


class ReportActIn(BaseModel):
    action: str = Field(pattern="^(dismiss|delete)$")


@api.post("/mod/reports/{report_id}")
async def mod_report_act(report_id: str, body: ReportActIn, mod=Depends(require_mod)):
    r = await db.chat_reports.find_one({"_id": oid(report_id), "status": "open"})
    if not r: raise HTTPException(404, "Report already handled")
    if body.action == "delete":
        await (db.messages if r["channel"] == "private" else db.chat).delete_one({"_id": oid(r["msg_id"])})
    await db.chat_reports.update_one({"_id": r["_id"]}, {"$set": {"status": "removed" if body.action == "delete" else "dismissed", "handled_by": mod["username"], "handled_at": iso(now())}})
    await log_action(mod, r["username"], "delete_chat" if body.action == "delete" else "report_dismissed",
                     [f"{'deleted reported' if body.action == 'delete' else 'dismissed report on'} {r['channel']} message: \"{r['text'][:80]}\" ({len(r['reporters'])} report{'s' if len(r['reporters']) != 1 else ''})"])
    return {"ok": True}
