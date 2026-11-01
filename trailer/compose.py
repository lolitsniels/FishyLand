import math
import random
import subprocess

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1920, 1080, 30
S = "/app/trailer/shots"
A = "/app/frontend/public/audio"
FONT = "/app/trailer/LilitaOne.ttf"
FF = imageio_ffmpeg.get_ffmpeg_exe()
GOLD, ORANGE, WHITE = (255, 214, 90), (255, 150, 40), (255, 255, 255)

_img = {}


def img(name):
    if name not in _img:
        path = f"{S}/{name}.jpg" if name.startswith("mythic_f0") else f"{S}/{name}.png"
        _img[name] = Image.open(path).convert("RGB").resize((W, H))
    return _img[name]


_txt = {}


def text_layer(lines):
    key = repr(lines)
    if key in _txt:
        return _txt[key]
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    y = None
    blocks = []
    for txt, size, col in lines:
        f = ImageFont.truetype(FONT, size)
        bw, bh = d.textbbox((0, 0), txt, font=f, stroke_width=max(4, size // 14))[2:]
        blocks.append((txt, f, col, bw, bh, max(4, size // 14)))
    total = sum(b[4] for b in blocks) + 14 * (len(blocks) - 1)
    y = H * 0.78 - total / 2 if len(lines) and lines[0][1] < 150 else H * 0.2 - total / 2
    for txt, f, col, bw, bh, sw in blocks:
        x = (W - bw) / 2
        d.text((x + 6, y + 8), txt, font=f, fill=(0, 0, 0, 150), stroke_width=sw, stroke_fill=(0, 0, 0, 150))
        d.text((x, y), txt, font=f, fill=col, stroke_width=sw, stroke_fill=(40, 20, 5))
        y += bh + 14
    _txt[key] = layer
    return layer


def view(name, t, z0, z1, cx=0.5, cy=0.5, cx1=None, cy1=None):
    """Ken Burns: zoom from z0 to z1 while the centre glides from (cx, cy) to (cx1, cy1)."""
    e = t * t * (3 - 2 * t)
    z = z0 + (z1 - z0) * e
    x = cx + ((cx1 if cx1 is not None else cx) - cx) * e
    y = cy + ((cy1 if cy1 is not None else cy) - cy) * e
    src = img(name)
    w, h = W / z, H / z
    l = min(max(0, x * W - w / 2), W - w)
    tp = min(max(0, y * H - h / 2), H - h)
    return src.crop((int(l), int(tp), int(l + w), int(tp + h))).resize((W, H), Image.BILINEAR)


# (start, end, render(t, local_seconds) -> frame, caption lines, caption pop)
SHOTS = []


def shot(a, b, fn, cap=None):
    SHOTS.append((a, b, fn, cap))


shot(0.0, 2.6, lambda t, s: view("harbour_a", t, 1.0, 1.25, 0.5, 0.45), [("WELCOME TO FISHYLAND", 120, GOLD), ("A FREE FISHING MMO", 54, WHITE)])
shot(2.6, 5.0, lambda t, s: view("harbour_b", t, 1.15, 1.35, 0.4, 0.45, 0.6, 0.5), [("A LIVING HARBOUR", 110, GOLD), ("FULL OF REAL PLAYERS", 54, WHITE)])
shot(5.0, 7.0, lambda t, s: view("water_a", t, 1.0, 1.4, 0.5, 0.5, 0.62, 0.48), [("CAST YOUR LINE", 120, GOLD)])
shot(7.0, 8.2, lambda t, s: view("mythic_hook", t, 1.25, 1.6, 0.42, 0.55, 0.38, 0.62), [("SOMETHING ENORMOUS...", 110, GOLD)])
FIGHT = [("mythic_f00", "HOLD TO REEL"), ("mythic_f01", "KEEP IT IN THE MIDDLE"), ("mythic_f02", "IT RALLIES!"), ("mythic_f03", "DON'T LET IT ESCAPE!"), ("mythic_f04", "ALMOST..."), ("mythic_f05", "ALMOST...")]
for i, (n, c) in enumerate(FIGHT):
    a = 8.2 + i * 0.7
    shot(a, a + 0.7, (lambda n, i: lambda t, s: view(n, t, 1.7 + 0.05 * i, 1.85 + 0.05 * i, 0.4, 0.62))(n, i), [(c, 104, ORANGE if "!" in c else GOLD)])
shot(12.4, 13.1, lambda t, s: view("mythic_card4", t, 1.5, 2.1, 0.55, 0.6, 0.56, 0.62), None)
BOOM = 13.1
shot(BOOM, 17.0, lambda t, s: view("mythic_card5", min(1, s / 0.35), 1.45, 1.0, 0.5, 0.56), [("MYTHIC CATCH!", 150, GOLD), ("THE MILL GIANT · 643.9 LB", 56, WHITE)])
shot(17.0, 19.2, lambda t, s: view("map", t, 1.1, 1.35, 0.5, 0.55), [("12 WATERS TO EXPLORE", 110, GOLD)])
shot(19.2, 21.2, lambda t, s: view("fishdex", t, 1.15, 1.4, 0.5, 0.52), [("350+ FISH TO COLLECT", 110, GOLD)])
shot(21.2, 23.2, lambda t, s: view("crews", t, 1.1, 1.3, 0.5, 0.5), [("JOIN A CREW", 110, GOLD), ("DUEL OTHER ANGLERS", 54, WHITE)])
shot(23.2, 25.0, lambda t, s: view("shop", t, 1.1, 1.3, 0.5, 0.5), [("UPGRADE YOUR ROD", 110, GOLD)])
shot(25.0, 26.6, lambda t, s: view("harbour_b", t, 1.05, 1.25, 0.6, 0.5, 0.75, 0.55), [("SPIN THE DAILY WHEEL", 110, GOLD)])
DUR = 30.5

logo = Image.open("/app/frontend/public/art/hud/logo_fishyland.webp").convert("RGBA")
logo = logo.resize((900, int(900 * logo.height / logo.width)))
end_bg = img("harbour_a").filter(ImageFilter.GaussianBlur(10))
end_bg = Image.blend(end_bg, Image.new("RGB", (W, H), (6, 18, 40)), 0.45)


def end_card(s):
    f = end_bg.copy()
    k = min(1, s / 0.6)
    sc = 0.8 + 0.2 * (1 - (1 - k) ** 3) + 0.01 * math.sin(s * 3)
    lg = logo.resize((int(logo.width * sc), int(logo.height * sc)))
    f.paste(lg, ((W - lg.width) // 2, int(H * 0.36 - lg.height / 2)), lg)
    if s > 0.7:
        layer = text_layer([("PLAY FREE NOW", 110, GOLD), ("fishyland.com", 64, WHITE), ("IN YOUR BROWSER · NO DOWNLOAD · REAL PLAYERS", 36, (210, 225, 245))])
        a = min(1, (s - 0.7) / 0.4)
        off = Image.new("RGBA", (W, H)); off.paste(layer, (0, int(H * 0.0)))
        f = Image.alpha_composite(f.convert("RGBA"), Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), off, a)).convert("RGB")
    return f


def frame(t):
    if t >= 26.6:
        f = end_card(t - 26.6)
        return fade(f, t)
    for a, b, fn, cap in SHOTS:
        if a <= t < b:
            s = t - a
            f = fn(min(1, s / (b - a)), s)
            if cap:
                layer = text_layer(cap)
                pop = min(1, s / 0.18)
                if abs(a - BOOM) < 1e-6:
                    pop = min(1, max(0, (s - 0.12) / 0.2))
                sc = 1.25 - 0.25 * pop
                lw, lh = int(W * sc), int(H * sc)
                lay = layer.resize((lw, lh), Image.BILINEAR) if sc != 1 else layer
                anc = H * (0.78 if cap[0][1] < 150 else 0.2)
                cx, cy = (W - lw) // 2, int(anc - anc * sc)
                base = f.convert("RGBA")
                tmp = Image.new("RGBA", (W, H))
                tmp.paste(lay, (cx, cy))
                if pop < 1:
                    tmp.putalpha(tmp.getchannel("A").point(lambda v: int(v * pop)))
                f = Image.alpha_composite(base, tmp).convert("RGB")
            # BOOM: white flash and camera shake
            if abs(a - BOOM) < 1e-6:
                if s < 0.25:
                    f = Image.blend(f, Image.new("RGB", (W, H), (255, 255, 240)), 1 - s / 0.25)
                if s < 0.6:
                    amp = 28 * (1 - s / 0.6)
                    dx, dy = int(random.uniform(-amp, amp)), int(random.uniform(-amp, amp))
                    sh = Image.new("RGB", (W, H)); sh.paste(f, (dx, dy)); f = sh
            # quick dip between fight cuts for punch
            if a >= 8.2 and b <= 12.4 and s < 0.05:
                f = Image.blend(f, Image.new("RGB", (W, H), (255, 255, 255)), 0.35)
            return fade(f, t)
    return Image.new("RGB", (W, H))


def fade(f, t):
    if t < 0.4:
        return Image.blend(Image.new("RGB", (W, H)), f, t / 0.4)
    if t > DUR - 0.6:
        return Image.blend(Image.new("RGB", (W, H)), f, max(0, (DUR - t) / 0.6))
    return f


def audio():
    flt = (
        f"[0:a]atrim=0:8.2,afade=t=in:d=0.4,afade=t=out:st=7.4:d=0.8,volume=0.8[m1];"
        f"[1:a]atrim=0:6,adelay=7600|7600,afade=t=in:st=7.6:d=0.4,afade=t=out:st=12.9:d=0.5,volume=0.9[m2];"
        f"[0:a]atrim=start=30:end=48,asetpts=PTS-STARTPTS,adelay=13600|13600,afade=t=in:st=13.6:d=1,afade=t=out:st=29.3:d=1.2,volume=0.8[m3];"
        f"[2:a]adelay=5300|5300,volume=0.9[c];[3:a]adelay=7000|7000,volume=1[bi];"
        f"[4:a]adelay=13100|13100,volume=1.4[lg];[5:a]adelay=13100|13100,volume=1.2[ld];[6:a]adelay=25200|25200,volume=0.8[cn];"
        f"[m1][m2][m3][c][bi][lg][ld][cn]amix=inputs=8:normalize=0,atrim=0:{DUR}[out]"
    )
    ins = [f"{A}/harbour.mp3", f"{A}/fight.mp3", f"{A}/sfx/cast.mp3", f"{A}/sfx/bite.mp3", f"{A}/sfx/legendary.mp3", f"{A}/sfx/land.mp3", f"{A}/sfx/coin.mp3"]
    cmd = [FF, "-y"] + sum([["-i", p] for p in ins], []) + ["-filter_complex", flt, "-map", "[out]", "-c:a", "aac", "-b:a", "192k", "/app/trailer/audio.m4a"]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    audio()
    p = subprocess.Popen([FF, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", "/app/trailer/audio.m4a",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", "-movflags", "+faststart",
                          "/app/trailer/fishyland_trailer.mp4"], stdin=subprocess.PIPE)
    n = int(DUR * FPS)
    for i in range(n):
        p.stdin.write(frame(i / FPS).tobytes())
        if i % 60 == 0:
            print("frame", i, "/", n, flush=True)
    p.stdin.close(); p.wait()
    print("done")


main()
