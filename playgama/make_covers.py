from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

A = "/tmp/as"
LOGO = Image.open("/app/frontend/public/art/hud/logo_fishyland.webp").convert("RGBA")
OUT = "/app/playgama/promo"
F = lambda s: ImageFont.truetype(f"{A}/Lilita.ttf", s)


def cover(src, size, crop_y=0.5):
    im = Image.open(src).convert("RGB")
    W, H = size
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = int((im.height - H) * crop_y)
    im = im.crop((x, y, x + W, y + H))
    im = ImageEnhance.Color(im).enhance(1.12)
    return ImageEnhance.Sharpness(im).enhance(1.3).convert("RGBA")


def shadow_paste(base, img, xy, blur=14, off=(0, 10), alpha=150):
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    m = img.split()[-1].point(lambda v: v * alpha // 255)
    blk = Image.new("RGBA", img.size, (10, 30, 60, 255)); blk.putalpha(m)
    sh.alpha_composite(blk, (xy[0] + off[0], xy[1] + off[1]))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))
    base.alpha_composite(img, xy)


def headline(text, size, fill=(255, 236, 90), stroke=(18, 52, 110)):
    f = F(size); d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=f, stroke_width=size // 9)
    im = Image.new("RGBA", (r - l + 20, b - t + 20), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10 - l, 10 - t), text, font=f, fill=fill, stroke_width=size // 9, stroke_fill=stroke)
    return im


def pill(text, size, bg=(255, 255, 255), fg=(18, 52, 110), ring=(255, 196, 40)):
    f = F(size); d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    pw, ph = r - l + size * 1.3, b - t + size * 0.75
    im = Image.new("RGBA", (int(pw) + 12, int(ph) + 12), (0, 0, 0, 0)); g = ImageDraw.Draw(im)
    g.rounded_rectangle((6, 6, 6 + pw, 6 + ph), radius=ph / 2, fill=ring)
    g.rounded_rectangle((6 + size * 0.14, 6 + size * 0.14, 6 + pw - size * 0.14, 6 + ph - size * 0.14), radius=ph / 2, fill=bg)
    g.text((6 + (pw - (r - l)) / 2 - l, 6 + (ph - (b - t)) / 2 - t), text, font=f, fill=fg)
    return im


def logo(w):
    lg = LOGO.copy(); lg = lg.resize((w, round(LOGO.height * w / LOGO.width)), Image.LANCZOS); return lg


def make(name, src, size, crop_y, logo_w, logo_xy, head, head_size, head_xy, pills, pill_size, pill_xy, gap, vertical=True):
    im = cover(src, size, crop_y)
    lg = logo(logo_w); shadow_paste(im, lg, (logo_xy[0] if logo_xy[0] >= 0 else (size[0] - lg.width) // 2, logo_xy[1]))
    h = headline(head, head_size); shadow_paste(im, h, ((size[0] - h.width) // 2 if head_xy[0] < 0 else head_xy[0], head_xy[1]), blur=8, off=(0, 6))
    x, y = pill_xy
    ps = [pill(p, pill_size) for p in pills]
    if not vertical:
        tot = sum(p.width for p in ps) + gap * (len(ps) - 1); x = (size[0] - tot) // 2 if x < 0 else x
    for p in ps:
        px = (size[0] - p.width) // 2 if (vertical and x < 0) else x
        shadow_paste(im, p, (px, y), blur=8, off=(0, 6), alpha=120)
        if vertical: y += p.height + gap
        else: x += p.width + gap
    im.convert("RGB").save(f"{OUT}/{name}.jpg", quality=92)
    print(name, im.size)


if __name__ == "__main__":
    import os; os.makedirs(OUT, exist_ok=True)
    PILLS = ["Catch 350+ Fish", "Play with Friends", "Explore 12 Waters"]
    make("cover_landscape_1920x1080", f"{A}/land.jpg", (1920, 1080), 0.0, 760, (60, 30), "Multiplayer Fishing", 112, (60, 420), PILLS, 54, (-1, 952), 34, vertical=False)
    make("cover_portrait_1080x1920", f"{A}/port.jpg", (1080, 1920), 0.0, 900, (-1, 40), "Multiplayer Fishing", 104, (-1, 500), ["Catch 350+ Fish", "Play with Friends"], 60, (-1, 1740), 30, vertical=False)
    make("cover_square_800x800", f"{A}/sq.jpg", (800, 800), 0.0, 520, (-1, 10), "Multiplayer Fishing", 64, (-1, 282), ["Catch 350+ Fish", "Play with Friends"], 30, (-1, 718), 18, vertical=False)
