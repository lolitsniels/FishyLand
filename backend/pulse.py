"""One shell poll instead of six: badges and counters the game shell refreshes every 20s."""
import asyncio
from fastapi import Depends

from server import api, db, get_current_user, unread_count, quests_summary, crew_inbox_count, mention_count, DATA_VERSION, is_admin_user, is_mod_user
from login_chest import login_chest
from guestbook import guestbook_unread
from vote import vote_ready_count
from boosters import active_boosts
from contracts import contracts_ready_count


import halloween  # noqa: E402


@api.get("/shell/pulse")
async def shell_pulse(user=Depends(get_current_user)):
    from server import touch_login_streak
    await touch_login_streak(user)
    unread, quests, crew, chest, gb, votes, boost, contracts_ready, mentions = await asyncio.gather(
        unread_count(user), quests_summary(user), crew_inbox_count(user), login_chest(user), guestbook_unread(user), vote_ready_count(user), active_boosts(), contracts_ready_count(user), mention_count(user))
    notices = await db.notices.find({"user_id": str(user["_id"])}).sort("at", 1).to_list(10)
    if notices: await db.notices.delete_many({"_id": {"$in": [n["_id"] for n in notices]}})
    return {"event": halloween.event_public(), "unread": unread["unread"], "story_ready": quests["story_ready"], "guest_open": quests["guest_open"], "notices": [{"text": n["text"], "url": n.get("url"), "label": n.get("label")} for n in notices],
            "crew_inbox": crew["count"], "chest_ready": not chest["claimed_today"], "guestbook_unread": gb["unread"],
            "vote_ready": votes, "boost": boost["xp"], "luck_boost": boost["luck"], "contracts_ready": contracts_ready, "mentions": mentions, "data_version": DATA_VERSION,
            "reports_open": await db.chat_reports.count_documents({"status": "open"}) if (is_admin_user(user) or is_mod_user(user)) else 0}
