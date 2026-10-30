"""Admin mail-out: one email to every player with an address on file, sent in the background."""
import asyncio
from datetime import timedelta
import os
import re
from html import escape

from bson import ObjectId
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from server import api, db, now, iso, require_admin
from emails import send_email, shell, site_url, email_configured

SEND_GAP_SEC = 0.6  # stays under Resend's per-second rate limit
RECIPIENTS = {"email": {"$nin": [None, ""]}, "banned": {"$in": [None, False]}}

HALLOWEEN_SUBJECT = "Halloween has come to Fishing Realms"
HALLOWEEN_BODY = """Ahoy {username},

The Marsh Witch has set up her stall by the water, and strange things are biting.

**Spooky fish in every water**
12 limited Halloween fish now bite wherever you cast, from the Gourdfin Sunfish to the mythic Banshee of the Shallows. Sell them to the Marsh Witch for Soul Candles, the new event currency.

**The Marsh Witch's stall**
- Hexwood Rod (level 30): its Hex Hook power lasts all year. 8% of the fish you land bring a twin of the same species, and it never wears out.
- Pumpkin Head portrait and Jack-o'-Lantern frame
- Witch's Draught: three energy potions to keep you casting

**The Phantom of Black Water**
Every 6 hours a ghost boss rises at a random water for 30 minutes. Hook it for 15 Soul Candles. Land it for 150 Soul Candles, a boss purse and the title Ghostbreaker.

The event ends on 1 November. Everything you earn stays yours forever.

Tight lines and happy haunting!"""


class MailIn(BaseModel):
    subject: str = Field(min_length=3, max_length=140)
    body: str = Field(min_length=10, max_length=8000)


def to_html(body: str, username: str) -> str:
    out = []
    for block in re.split(r"\n\s*\n", body.replace("{username}", username).strip()):
        lines = [escape(x) for x in block.strip().split("\n")]
        lines = [re.sub(r"\*\*(.+?)\*\*", r'<b style="color:#f27b35;">\1</b>', x) for x in lines]
        items = [x[2:] for x in lines if x.startswith("- ")]
        head = [x for x in lines if not x.startswith("- ")]
        html = "<br>".join(head)
        if items: html += '<ul style="margin:6px 0 0 18px;padding:0;">' + "".join(f"<li>{i}</li>" for i in items) + "</ul>"
        out.append(html)
    return "<br><br>".join(out)


def build(m: MailIn, username: str):
    html = shell(m.subject, to_html(m.body, username), ("Go fishing", f"{site_url()}/?login=1"),
                 "You are receiving this because you have an account on Fishing Realms.", greeting="Ahoy from the harbour!")
    return html, re.sub(r"\*\*(.+?)\*\*", r"\1", m.body.replace("{username}", username))


async def run_mailout(mid, m: MailIn):
    sent = failed = 0
    async for u in db.users.find(RECIPIENTS, {"email": 1, "username": 1}):
        html, text = build(m, u["username"])
        r = await send_email(u["email"], m.subject, html, text, tag="mailout")
        if r: sent += 1
        else: failed += 1
        if (sent + failed) % 10 == 0:
            await db.mailouts.update_one({"_id": mid}, {"$set": {"sent": sent, "failed": failed}})
        await asyncio.sleep(SEND_GAP_SEC)
    await db.mailouts.update_one({"_id": mid}, {"$set": {"sent": sent, "failed": failed, "status": "done", "finished_at": iso(now())}})


@api.get("/admin/mailout")
async def mailout_state(admin=Depends(require_admin)):
    rows = await db.mailouts.find({}, {"body": 0}).sort("at", -1).to_list(10)
    return {"configured": email_configured(), "recipients": await db.users.count_documents(RECIPIENTS),
            "test_to": admin.get("email") or os.environ.get("ADMIN_NOTIFY_EMAIL"),
            "template": {"subject": HALLOWEEN_SUBJECT, "body": HALLOWEEN_BODY},
            "history": [{"id": str(r["_id"]), "subject": r["subject"], "by": r["by"], "at": r["at"], "status": r["status"], "total": r["total"],
                         "sent": r.get("sent", 0), "failed": r.get("failed", 0)} for r in rows]}


@api.post("/admin/mailout/test")
async def mailout_test(body: MailIn, admin=Depends(require_admin)):
    to = admin.get("email") or os.environ.get("ADMIN_NOTIFY_EMAIL")
    if not to: raise HTTPException(400, "Add an email to your admin account first")
    if not email_configured(): raise HTTPException(400, "Email sending is not set up on this server")
    html, text = build(body, admin["username"])
    if not await send_email(to, f"[TEST] {body.subject}", html, text, tag="mailout-test"):
        raise HTTPException(502, "The test email could not be sent")
    return {"ok": True, "to": to}


@api.post("/admin/mailout/send")
async def mailout_send(body: MailIn, admin=Depends(require_admin)):
    if not email_configured(): raise HTTPException(400, "Email sending is not set up on this server")
    if await db.mailouts.find_one({"status": "sending", "at": {"$gt": iso(now() - timedelta(hours=3))}}): raise HTTPException(409, "A mail-out is already being sent")
    total = await db.users.count_documents(RECIPIENTS)
    doc = {"subject": body.subject, "body": body.body, "by": admin["username"], "at": iso(now()), "status": "sending", "total": total, "sent": 0, "failed": 0}
    mid = (await db.mailouts.insert_one(doc)).inserted_id
    asyncio.create_task(run_mailout(ObjectId(mid), body))
    return {"ok": True, "id": str(mid), "total": total}
