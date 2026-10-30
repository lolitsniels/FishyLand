"""Recruit an Angler: referral codes, recruit roster and late code entry."""
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from server import api, db, now, iso, get_current_user, public_user, level_from_xp, ensure_referral_code, link_recruit, client_ip, guest_ip_hash, check_referral
from referrals_data import MENTOR_TITLE, APPLY_WINDOW_HOURS, APPLY_MAX_CATCHES, LEVEL_STEP, RECRUIT_LEVEL_PEARLS, TITLE_LEVEL, level_milestone

def can_apply(u):
    if u.get("referred_by"): return False, "This account already has a recruiter"
    if u.get("is_guest"): return False, "Claim your account first, then enter the code"
    if now() - datetime.fromisoformat(u["created_at"]) > timedelta(hours=APPLY_WINDOW_HOURS): return False, f"Codes can only be entered within {APPLY_WINDOW_HOURS} hours of creating an account"
    if u["stats"].get("catches", 0) >= APPLY_MAX_CATCHES: return False, "Codes must be entered before you have landed 50 fish"
    return True, None


@api.get("/referrals")
async def my_referrals(user=Depends(get_current_user)):
    code = None if user.get("is_guest") else await ensure_referral_code(user)
    rows = await db.users.find({"referred_by": str(user["_id"])}, {"username": 1, "xp": 1, "stats": 1, "referral_stage": 1, "referred_at": 1, "is_guest": 1, "referral_flag": 1, "avatar": 1, "referral_lvl_paid": 1}).sort("referred_at", -1).to_list(200)
    recruits = [{"username": r["username"], "level": level_from_xp(r["xp"])[0], "fish": r["stats"].get("catches", 0), 
                 "joined": r.get("referred_at"), "is_guest": bool(r.get("is_guest")), "flagged": bool(r.get("referral_flag")), "avatar": r.get("avatar"), "next_milestone": r.get("referral_lvl_paid", 0) + LEVEL_STEP} for r in rows]
    log = await db.referral_log.find({"recruiter_id": str(user["_id"])}).sort("at", -1).limit(30).to_list(30)
    recruiter = await db.users.find_one({"_id": ObjectId(user["referred_by"])}, {"username": 1}) if user.get("referred_by") else None
    ok, why = can_apply(user)
    return {"code": code, "recruits": recruits, "log": [{k: v for k, v in x.items() if k != "_id" and not k.endswith("_id")} for x in log],
            "totals": {"recruits": len(recruits), "completed": user["stats"].get("recruits_completed", 0), "gold": user["stats"].get("referral_gold", 0), "pearls": user["stats"].get("referral_pearls", 0)},
            "referred_by": recruiter["username"] if recruiter else None,
            "can_apply": ok, "apply_reason": why, "mentor_title": MENTOR_TITLE,
            "level_rewards": {"step": LEVEL_STEP, "recruit_pearls": RECRUIT_LEVEL_PEARLS, "title_level": TITLE_LEVEL, "milestones": [{"level": m, **level_milestone(m)} for m in (10, 20, 30, 40)]}}


@api.get("/referrals/lookup/{code}")
async def lookup_code(code: str):
    rec = await db.users.find_one({"referral_code": code.strip().upper(), "is_guest": {"$ne": True}}, {"username": 1, "xp": 1})
    if not rec: raise HTTPException(404, "Unknown referral code")
    return {"recruiter": rec["username"], "level": level_from_xp(rec["xp"])[0]}


class ApplyIn(BaseModel):
    code: str = Field(min_length=4, max_length=16)


@api.post("/referrals/apply")
async def apply_code(body: ApplyIn, request: Request, user=Depends(get_current_user)):
    ok, why = can_apply(user)
    if not ok: raise HTTPException(400, why)
    ip_hash = guest_ip_hash(client_ip(request))
    doc = {}
    res = await link_recruit(doc, body.code, ip_hash, self_id=user["_id"])
    if not res or not res["applied"]: raise HTTPException(400, (res or {}).get("reason", "Unknown referral code"))
    await db.users.update_one({"_id": user["_id"]}, {"$set": doc})
    fresh = await db.users.find_one({"_id": user["_id"]})
    await check_referral(fresh)
    return {"recruiter": res["recruiter"], "user": public_user(await db.users.find_one({"_id": user["_id"]}))}
