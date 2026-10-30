"""Discord webhook posts: a 'Go catch it' message in the boss channel when a boss surfaces."""
import logging
import os
import socket

import httpx

log = logging.getLogger("discord")
# The preview pod shares the Discord webhooks with the live game; only the live game posts, so nothing goes out twice.
IS_PREVIEW = socket.gethostname().startswith("agent-env-")


def site():
    return os.environ["SITE_URL"].rstrip("/")


async def post_boss(boss, water_name, end_iso, art_path):
    url = os.environ.get("DISCORD_BOSS_WEBHOOK_URL")
    if not url or IS_PREVIEW: return False
    role = (os.environ.get("DISCORD_BOSS_ROLE_ID") or "").strip()
    if not role.isdigit(): role = ""
    link = f"{site()}/game/fish"
    from datetime import datetime
    ts = int(datetime.fromisoformat(end_iso).timestamp())
    body = {
        "username": "Harbourmaster",
        "content": (f"<@&{role}> " if role else "") + f"**{boss['name']}** has surfaced at **{water_name}**! [Go catch it]({link})",
        "allowed_mentions": {"roles": [role] if role else []},
        "embeds": [{
            "title": f"A boss has surfaced at {water_name}",
            "url": link,
            "description": f"**{boss['name']}**, {boss['title']}\nIt leaves <t:{ts}:R>. Travel to {water_name} and cast before it's gone.\n\n**[Go catch it](%s)**" % link,
            "color": 0xF27B35,
            "thumbnail": {"url": f"{site()}{art_path}"},
            "fields": [{"name": "Reward", "value": f"{boss['gold']:,} gold · {boss['xp']:,} XP", "inline": True},
                       {"name": "Water", "value": water_name, "inline": True}],
            "footer": {"text": "The Fishing Lands"},
        }],
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, json=body)
        if r.status_code >= 300: log.warning("discord boss post %s %s", r.status_code, r.text[:200]); return False
        return True
    except Exception as e:
        log.warning("discord boss post failed: %s", e)
        return False


def _plain(md):
    import re
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)  # images can't render inside an embed body
    return re.sub(r"\n{3,}", "\n\n", md).strip()


async def post_news(title, body, image=None):
    url = os.environ.get("DISCORD_NEWS_WEBHOOK_URL")
    if not url or IS_PREVIEW: return False
    link = f"{site()}/game"
    text = _plain(body)
    if len(text) > 3800: text = text[:3800].rsplit("\n", 1)[0] + "\n…"
    embed = {"title": title, "url": link, "description": f"{text}\n\n**[Read it in game]({link})**", "color": 0xF27B35, "footer": {"text": "The Fishing Lands · Harbour Notices"}}
    if image: embed["image"] = {"url": image if image.startswith("http") else f"{site()}{image}"}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, json={"username": "Harbourmaster", "embeds": [embed], "allowed_mentions": {"parse": []}})
        if r.status_code >= 300: log.warning("discord news post %s %s", r.status_code, r.text[:200]); return False
        return True
    except Exception as e:
        log.warning("discord news post failed: %s", e)
        return False
