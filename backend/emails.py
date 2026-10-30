"""Transactional email via Resend. Fire-and-forget helpers; failures are logged, never raised to players."""
import os
import asyncio
import logging
from html import escape

import resend

log = logging.getLogger("emails")
DISCORD_URL = "https://discord.gg/FHCVrbj4kJ"


def email_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY") and os.environ.get("SENDER_EMAIL"))


def site_url() -> str:
    return os.environ["SITE_URL"].rstrip("/")


def shell(title: str, body_html: str, cta: tuple | None = None, footer: str = "", asset_base: str | None = None, greeting: str = "Welcome to Fishing Realms!") -> str:
    """Every game email: pixel-water backdrop, game header, a panel box and the Harbourmaster with a speech bubble beside it."""
    art = f"{(asset_base or site_url()).rstrip('/')}/art/email"
    cta_html = (f'''<tr><td style="padding:18px 28px 6px;">
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
<td style="background:#f27b35;border:2px solid #9a4a1f;padding:0 22px 0 8px;" valign="bottom">
<a href="{cta[1]}" style="text-decoration:none;display:block;"><table cellpadding="0" cellspacing="0"><tr>
<td valign="bottom" style="padding:0;"><img src="{art}/rod.png" width="99" height="68" alt="" style="display:block;border:0;margin-top:-22px;image-rendering:pixelated;"></td>
<td valign="middle" style="padding:14px 0 14px 10px;font-family:Georgia,serif;font-size:18px;font-weight:bold;color:#1a110c;letter-spacing:.5px;white-space:nowrap;">{escape(cta[0])}</td>
</tr></table></a></td></tr></table></td></tr>''') if cta else ""
    links = f'<a href="{site_url()}" style="color:#f27b35;">thefishinglands.com</a> &middot; <a href="{site_url()}/wiki" style="color:#f27b35;">Wiki</a> &middot; <a href="{DISCORD_URL}" style="color:#f27b35;">Discord</a>'
    return f"""<table width="100%" cellpadding="0" cellspacing="0" background="{art}/water_bg.png" bgcolor="#0e2733" style="background-color:#0e2733;background-image:url('{art}/water_bg.png');background-repeat:repeat;padding:28px 0;font-family:Georgia,serif;">
<tr><td align="center">
<table width="780" cellpadding="0" cellspacing="0" style="max-width:780px;width:100%;">
<tr><td colspan="2" style="background:#161412;border:1px solid #3b342f;border-bottom:3px solid #9a4a1f;padding:14px 22px;">
<a href="{site_url()}" style="text-decoration:none;"><img src="{art}/logo.png" width="200" height="47" alt="Fishing Realms" style="display:block;border:0;image-rendering:pixelated;"></a></td></tr>
<tr><td colspan="2" style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr>
<tr><td valign="top">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#161412;border:1px solid #3b342f;color:#e6dcc6;">
<tr><td style="background:#100f0e;border-bottom:1px solid #3b342f;padding:12px 28px;font-size:15px;letter-spacing:2px;text-transform:uppercase;color:#f27b35;">&#9875;&nbsp; {escape(title)}</td></tr>
<tr><td style="padding:18px 28px 4px;font-size:16.5px;line-height:1.6;color:#e6dcc6;">{body_html}</td></tr>
{cta_html}
<tr><td style="padding:14px 28px 20px;font-size:12.5px;line-height:1.5;color:#8c8178;">{footer}</td></tr>
</table></td>
<td width="280" valign="top" style="padding:0 0 0 10px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f4ead2;border:3px solid #1a110c;padding:12px 14px;font-family:Georgia,serif;font-size:17px;font-weight:bold;line-height:1.35;color:#2a1a10;text-align:center;">{escape(greeting)}</td></tr>
<tr><td style="padding:0 0 0 120px;line-height:0;font-size:0;"><img src="{art}/bubble_tail.png" width="20" height="12" alt="" style="display:block;border:0;margin-top:-3px;"></td></tr>
<tr><td style="padding-top:4px;"><img src="{art}/harbourmaster.png" width="280" height="380" alt="The Harbourmaster" style="display:block;border:0;image-rendering:pixelated;"></td></tr></table>
</td></tr>
<tr><td colspan="2" style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>
<tr><td colspan="2" style="background:#100f0e;border:1px solid #3b342f;padding:10px 4px;font-size:12.5px;color:#8c8178;text-align:center;">Fishing Realms &middot; {links}</td></tr>
</table></td></tr></table>"""


async def send_email(to: str, subject: str, html: str, text: str = "", bcc: list | None = None, tag: str = "mail"):
    if not email_configured():
        log.warning("RESEND not configured; skipped %s to %s", tag, to)
        return None
    resend.api_key = os.environ["RESEND_API_KEY"]
    params = {"from": os.environ["SENDER_EMAIL"], "to": [to], "subject": subject, "html": html, "text": text or subject}
    if bcc:
        params["bcc"] = bcc
    try:
        r = await asyncio.to_thread(resend.Emails.send, params)
        log.info("%s sent to %s id=%s", tag, to, (r or {}).get("id"))
        return r
    except Exception as e:
        log.error("%s failed for %s: %s", tag, to, e)
        return None


def welcome_html(username: str, referral_code: str, asset_base: str | None = None) -> str:
    link = f"{site_url()}/?ref={referral_code}"
    o = "color:#f27b35;"
    body = (f"Ahoy {escape(username)}, welcome to the dock.<br><br>"
            f"You start at <b style=\"{o}\">Millbrook Pond</b> with a cane pole, 120 gold and 15 worms. Every cast is a real fight: hold to reel, keep the bobber in the green "
            f"and out of the red or the line snaps. Spin the <b style=\"{o}\">Daily Spin</b> at the Harbour every day, fill your journal, take on harbour contracts, "
            f"set crab cages, join a crew and climb the weekly Duel Ladder from level 10.<br><br>"
            f"<b style=\"{o}\">Recruit a friend.</b> Share your recruit link. Every 10 levels your recruit reaches pays you a crate "
            f"(Bronze at 10, Silver at 20, Gold from 30 on) plus up to 15 Pearls, they get 3 Pearls each time too, and at level 20 you earn the title "
            f"<b style=\"{o}\">Dockside Mentor</b>:<br>"
            f"<a href=\"{link}\" style=\"word-break:break-all;color:#ffcfa8;\">{link}</a><br><br>"
            f"New to the water? The <a href=\"{site_url()}/wiki\" style=\"{o}\">Fishing Lands Wiki</a> explains every water, fish, bait and system. "
            f"Questions, trades and dockside gossip live on our <a href=\"{DISCORD_URL}\" style=\"{o}\">Discord</a>.")
    return shell("Welcome aboard", body, ("Return to the water", f"{site_url()}/?login=1"),
                 "You are receiving this once because you registered this address on Fishing Realms. Forgot your password later? Use \"Forgot password?\" on the sign-in box.", asset_base)


async def send_welcome(user: dict, referral_code: str):
    if not user.get("email"):
        return None
    text = (f"Welcome to Fishing Realms, {user['username']}. Your recruit link: {site_url()}/?ref={referral_code}. "
            f"Discord: {DISCORD_URL}. Sign in: {site_url()}/?login=1")
    return await send_email(user["email"], f"Welcome to Fishing Realms, {user['username']}", welcome_html(user["username"], referral_code), text,
                            tag="welcome")
