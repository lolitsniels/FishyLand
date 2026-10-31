"""728x90 animated leaderboard banner (GIF) for FishyLand."""
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

W, H = 728, 90
SRC = "/app/promo_src"
F = lambda s: ImageFont.truetype(f"{SRC}/Lilita.ttf", s)
TITLE, DESC, CTA = "Multiplayer Fishing Fun!", "Catch 350+ fish with friends. Free in your browser", "PLAY FREE"

bg = Image.open(f"{SRC}/land.jpg").convert("RGB")
s = W / bg.width; bg = bg.resize((W, round(bg.height * s)), Image.LANCZOS)
bg = bg.crop((0, int(bg.height * 0.52), W, int(bg.height * 0.52) + H))
bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(1.2))).enhance(0.62).convert("RGBA")
shade = Image.new("RGBA", (W, H), (8, 34, 70, 120)); bg.alpha_composite(shade)

logo = Image.open("/app/frontend/public/art/hud/logo_fishyland.webp").convert("RGBA"); logo.thumbnail((150, 80), Image.LANCZOS)
fish = Image.open("/app/frontend/public/art/fish_v2/959.webp").convert("RGBA"); fish.thumbnail((58, 36), Image.LANCZOS)


def text_img(t, size, fill, stroke, sw):
    f = F(size); l, tp, r, b = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), t, font=f, stroke_width=sw)
    im = Image.new("RGBA", (r - l + 4, b - tp + 4), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((2 - l, 2 - tp), t, font=f, features=["-kern"], fill=fill, stroke_width=sw, stroke_fill=stroke)
    return im


title = text_img(TITLE, 30, (255, 228, 80), (16, 44, 100), 3)
desc = text_img(DESC, 17, (255, 255, 255), (10, 30, 60), 2)


def button(scale):
    bw, bh = int(126 * scale), int(44 * scale)
    im = Image.new("RGBA", (bw + 8, bh + 10), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    g.rounded_rectangle((4, 7, 4 + bw, 7 + bh), radius=bh // 2, fill=(170, 95, 0))
    g.rounded_rectangle((4, 3, 4 + bw, 3 + bh), radius=bh // 2, fill=(255, 196, 40), outline=(255, 244, 200), width=3)
    t = text_img(CTA, int(21 * scale), (24, 40, 90), None, 0)
    im.alpha_composite(t, ((bw + 8 - t.width) // 2, 3 + (bh - t.height) // 2))
    return im


N = 30
frames = []
TX = 168
for i in range(N):
    fr = bg.copy()
    p = i / N
    # sparkles on the water
    d = ImageDraw.Draw(fr)
    for k in range(9):
        a = (math.sin((p * 2 + k * 0.37) * math.pi * 2) + 1) / 2
        x, y = 505 + (k * 23) % 80, 70 + (k * 7) % 16
        d.ellipse((x - 1.5, y - 1.5, x + 1.5, y + 1.5), fill=(255, 255, 230, int(200 * a)))
    # leaping golden koi arc across the middle
    t = (p * 1.0) % 1.0
    fx, fy = 500 + t * 85, 92 - math.sin(t * math.pi) * 62
    rot = 25 - 50 * t
    f2 = fish.rotate(rot, expand=True, resample=Image.BICUBIC)
    if 0.05 < t < 0.95: fr.alpha_composite(f2, (int(fx - f2.width / 2), int(fy - f2.height / 2)))
    # logo bob
    fr.alpha_composite(logo, (10, int(5 + 3 * math.sin(p * 2 * math.pi))))
    # title slides in during the first quarter, then stays
    k = min(1.0, i / 7); e = 1 - (1 - k) ** 3
    tx = int(TX - 40 * (1 - e)); ti = title.copy(); ti.putalpha(ti.getchannel("A").point(lambda v: int(v * e)))
    fr.alpha_composite(ti, (tx, 10))
    k2 = max(0.0, min(1.0, (i - 5) / 6)); di = desc.copy(); di.putalpha(di.getchannel("A").point(lambda v: int(v * k2)))
    fr.alpha_composite(di, (TX + 2, 52))
    # pulsing call-to-action
    b = button(1 + 0.06 * math.sin(p * 4 * math.pi))
    fr.alpha_composite(b, (W - 12 - b.width + (b.width - 134) // 2, (H - b.height) // 2 + 1))
    frames.append(fr.convert("RGB"))

pal = frames[10].quantize(colors=48, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
durs = [80] * N
q[0].save("/app/promo_src/banner_728x90.gif", save_all=True, append_images=q[1:], duration=durs, loop=0, optimize=True, disposal=1)
frames[24].save("/app/promo_src/banner_728x90_static.png")
import os; print(os.path.getsize("/app/promo_src/banner_728x90.gif") // 1024, "KB")
