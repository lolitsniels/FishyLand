"""Shareable forum signatures (468x100) and userbars (350x19) with live angler stats, rendered as crisp pixel PNGs."""
import io
import time
from pathlib import Path

from fastapi import HTTPException, Response
from PIL import Image, ImageDraw, ImageFont

from server import api, db, level_from_xp
from game_data import FISH

ART = Path(__file__).parent.parent / "frontend/public/art"
FONTS = Path(__file__).parent / "assets/fonts"
FISH_BY_NAME = {f["name"]: f for f in FISH}
GOLD, CREAM, MUTED, TEAL = (242, 199, 68), (244, 234, 210), (170, 156, 136), (110, 200, 190)
CACHE, TTL = {}, 600
BG = Image.open(ART / "bg_game_night.webp").convert("RGB")


def font(px, name="Silkscreen-Regular.ttf"):
    return ImageFont.truetype(str(FONTS / name), px)


def kg(v):
    return f"{v:,.2f} kg" if v < 100 else f"{v:,.0f} kg"


async def angler(username):
    u = await db.users.find_one({"username_lc": username.lower(), "is_guest": {"$ne": True}, "banned": {"$ne": True}},
                                {"username": 1, "xp": 1, "stats": 1, "avatar": 1, "crew": 1, "title": 1})
    if not u: raise HTTPException(404, "Angler not found")
    return u


def outlined(d, xy, s, fn, fill, o=(8, 6, 6)):
    x, y = xy
    for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1), (1, 1)): d.text((x + ox, y + oy), s, font=fn, fill=o)
    d.text(xy, s, font=fn, fill=fill)


def signature(u):
    W, H = 468, 100
    src = BG.crop((0, BG.height - BG.width * H // W, BG.width, BG.height)).resize((W, H), Image.NEAREST)
    im = Image.blend(src, Image.new("RGB", (W, H), (10, 9, 12)), 0.35).convert("RGBA")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline=(120, 92, 60)); d.rectangle([1, 1, W - 2, H - 2], outline=(30, 22, 16))
    av = ART / f"avatars/{u.get('avatar') or 'av_lad'}.jpg"
    if av.exists():
        a = Image.open(av).convert("RGB").resize((80, 80), Image.BOX)
        d.rectangle([7, 7, 92, 92], fill=(20, 14, 10)); d.rectangle([8, 8, 91, 91], outline=GOLD); im.paste(a, (10, 10))
    st = u.get("stats", {}); lvl = level_from_xp(u["xp"])[0]
    outlined(d, (104, 6), u["username"], font(16, "Silkscreen-Bold.ttf"), GOLD)
    if u.get("title"): outlined(d, (104 + d.textlength(u["username"], font=font(16, "Silkscreen-Bold.ttf")) + 8, 11), u["title"], font(8), CREAM)
    f8 = font(8)
    rows = [("LEVEL", str(lvl)), ("FISH CAUGHT", f"{st.get('catches', 0):,}"),
            ("BEST CATCH", f"{st['heaviest_name']} {kg(st.get('heaviest_kg', 0))}" if st.get("heaviest_name") else "-"),
            ("CREW", f"[{u['crew']['tag']}] {u['crew']['name']}" if u.get("crew") else "No crew yet")]
    y = 32
    for k, v in rows:
        outlined(d, (104, y), k, f8, MUTED); outlined(d, (186, y), v[:34], f8, CREAM); y += 13
    best = FISH_BY_NAME.get(st.get("heaviest_name") or "")
    if best and (ART / f"fish_v2/{best['id']}.webp").exists():
        f = Image.open(ART / f"fish_v2/{best['id']}.webp").convert("RGBA"); f = f.crop(f.getbbox()); f.thumbnail((90, 46), Image.NEAREST)
        im.alpha_composite(f, (W - 10 - f.width, 30 + (46 - f.height) // 2))
    outlined(d, (W - 8 - d.textlength("THEFISHINGLANDS.COM", font=f8), H - 14), "THEFISHINGLANDS.COM", f8, TEAL)
    return im.convert("RGB")


def userbar(u):
    W, H = 350, 19
    im = Image.new("RGB", (W, H)); d = ImageDraw.Draw(im)
    for y in range(H): d.line([(0, y), (W, y)], fill=(int(28 + 40 * (1 - y / H)), int(70 + 60 * (1 - y / H)), int(88 + 50 * (1 - y / H))))
    for x in range(-H, W, 4): d.line([(x, H), (x + H, 0)], fill=(18, 40, 52))  # classic diagonal userbar stripes
    gl = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ImageDraw.Draw(gl).rectangle([0, 0, W, H // 2 - 1], fill=(255, 255, 255, 34)); im = im.convert("RGBA"); im.alpha_composite(gl)
    d = ImageDraw.Draw(im)
    best = FISH_BY_NAME.get(u.get("stats", {}).get("heaviest_name") or "")
    x = 4
    if best and (ART / f"fish_v2/{best['id']}.webp").exists():
        f = Image.open(ART / f"fish_v2/{best['id']}.webp").convert("RGBA"); f = f.crop(f.getbbox()); f.thumbnail((30, 15), Image.NEAREST)
        im.alpha_composite(f, (x, (H - f.height) // 2)); x += f.width + 5
    st = u.get("stats", {}); lvl = level_from_xp(u["xp"])[0]
    crew = f" [{u['crew']['tag']}]" if u.get("crew") else ""
    s = f"{u['username']}{crew} · LV {lvl} · {st.get('catches', 0):,} FISH"
    fn = font(8, "Silkscreen-Bold.ttf")
    outlined(d, (x, 5), s, fn, (255, 255, 255), (10, 24, 32))
    tag = "THE FISHING LANDS"; outlined(d, (W - 5 - d.textlength(tag, font=font(8)), 5), tag, font(8), GOLD, (10, 24, 32))
    d.rectangle([0, 0, W - 1, H - 1], outline=(6, 14, 20))
    return im.convert("RGB")


async def render(kind, username):
    key = (kind, username.lower()); hit = CACHE.get(key)
    if hit and time.time() - hit[0] < TTL: return hit[1]
    u = await angler(username)
    buf = io.BytesIO(); (signature if kind == "sig" else userbar)(u).save(buf, "PNG", optimize=True)
    CACHE[key] = (time.time(), buf.getvalue())
    if len(CACHE) > 2000: CACHE.clear()
    return buf.getvalue()


@api.api_route("/sig/{username}.png", methods=["GET", "HEAD"])
async def sig_png(username: str):
    return Response(await render("sig", username), media_type="image/png", headers={"Cache-Control": "public, max-age=600"})


@api.api_route("/userbar/{username}.png", methods=["GET", "HEAD"])
async def userbar_png(username: str):
    return Response(await render("bar", username), media_type="image/png", headers={"Cache-Control": "public, max-age=600"})
