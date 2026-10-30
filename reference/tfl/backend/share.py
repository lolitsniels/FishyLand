"""Social share cards for catches: an OG preview page plus a generated 1200x630 image, then a redirect into the game."""
import asyncio
import io
import os
from functools import lru_cache
from html import escape

import requests
from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from PIL import Image, ImageDraw, ImageFilter

from server import api, db, ensure_referral_code, get_current_user, public_user, level_from_xp, share_reward_amount, now
from game_data import FISH_BY_ID
from halloween_data import HALLOW_FISH, GHOST_BOSS
from bosses_data import BOSSES

BOSS_IDS = {b["id"] for b in BOSSES} | {GHOST_BOSS["id"]}
SPECIES = {**FISH_BY_ID, **{f["id"]: f for f in HALLOW_FISH}, **{b["id"]: {**b, "rarity": "mythic" if b["id"] == GHOST_BOSS["id"] else "legendary"} for b in [*BOSSES, GHOST_BOSS]}}
RAR_RGB = {"common": (170, 170, 160), "uncommon": (110, 200, 110), "rare": (90, 160, 255), "epic": (190, 110, 255), "legendary": (255, 170, 50), "mythic": (255, 80, 60)}
LB = 2.20462


def site(): return os.environ["SITE_URL"].rstrip("/")


@lru_cache(maxsize=400)
def card(sid: int) -> bytes:
    w, h = 1200, 630
    r = requests.get(f"{site()}/art/{'bosses' if sid in BOSS_IDS else 'fish_v2'}/{sid}.webp", timeout=15); r.raise_for_status()
    fish = Image.open(io.BytesIO(r.content)).convert("RGBA")
    col = RAR_RGB.get(SPECIES[sid]["rarity"], (255, 122, 53))
    im = Image.new("RGBA", (w, h), (20, 17, 15, 255))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((200, 120, 1000, 520), fill=col + (70,))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
    s = min(980 / fish.width, 460 / fish.height)
    fish = fish.resize((int(fish.width * s), int(fish.height * s)), Image.LANCZOS)
    im.alpha_composite(fish, ((w - fish.width) // 2, (h - fish.height) // 2 - 10))
    d = ImageDraw.Draw(im)
    d.rectangle((0, h - 14, w, h), fill=col + (255,))
    d.rectangle((0, 0, w - 1, h - 1), outline=(154, 74, 31, 255), width=4)
    out = io.BytesIO(); im.convert("RGB").save(out, "JPEG", quality=86)
    return out.getvalue()


@api.get("/share/img/{sid}.jpg")
async def share_img(sid: int):
    if sid not in SPECIES: raise HTTPException(404, "Unknown fish")
    try: data = await asyncio.to_thread(card, sid)
    except Exception: raise HTTPException(502, "Fish art unavailable")
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=604800"})


@api.get("/share/catch", response_class=HTMLResponse)
async def share_catch(request: Request, s: int, w: float = 0, u: str = "", v: str = "normal", un: str = "lb"):
    f = SPECIES.get(s)
    if not f: raise HTTPException(404, "Unknown fish")
    user = await db.users.find_one({"username_lc": u.lower()}, {"username": 1, "referral_code": 1, "is_guest": 1}) if u else None
    code = await ensure_referral_code(user) if user and not user.get("is_guest") else None
    who = user["username"] if user else "An angler"
    kg = max(0.0, min(w, 100000))
    size = f"{kg:,.1f} kg" if un == "kg" else f"{kg * LB:,.1f} lb"
    variant = v.title() if v and v != "normal" and v.isalpha() else ""
    if f["name"].startswith("The "): fish = f["name"] + (f" ({variant})" if variant else "")
    else:
        n = f"{variant} {f['name']}".strip()
        fish = ("an " if n[0].lower() in "aeiou" else "a ") + n
    title = f"{who} slew the boss {f['name']}: {size}" if s in BOSS_IDS else f"{who} landed {fish}: {size}, {f['rarity'].title()}"
    desc = "Catch it yourself in The Fishing Lands, a free multiplayer fishing MMO in your browser."
    dest = f"{site()}/?ref={code}" if code else f"{site()}/"
    img = f"{site()}/api/share/img/{s}.jpg"
    me = escape(f"{site()}/api/share/catch?{request.url.query}", quote=True)
    t, dsc, de, im = escape(title), escape(desc), escape(dest, quote=True), escape(img, quote=True)
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>{t}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="The Fishing Lands">
<meta property="og:title" content="{t}"><meta property="og:description" content="{dsc}">
<meta property="og:image" content="{im}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="{me}"><meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}"><meta name="twitter:description" content="{dsc}"><meta name="twitter:image" content="{im}">
<meta http-equiv="refresh" content="0;url={de}"></head>
<body style="background:#141110;color:#eee;font-family:sans-serif"><a href="{de}" style="color:#ff7a35">{t}. Play The Fishing Lands</a></body></html>"""
    return HTMLResponse(html)


@api.post("/share/reward")
async def share_reward(user=Depends(get_current_user)):
    day = now().date().isoformat()
    gold = share_reward_amount(level_from_xp(user["xp"])[0])
    u = await db.users.find_one_and_update({"_id": user["_id"], "share_day": {"$ne": day}}, {"$set": {"share_day": day}, "$inc": {"gold": gold}}, return_document=True)
    if not u: return {"gold": 0, "user": public_user(user)}
    return {"gold": gold, "user": public_user(u)}
