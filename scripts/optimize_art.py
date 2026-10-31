"""Shrinks game art in place (same names/formats): caps oversized sprites near 2x their on-screen size and re-encodes."""
import os, re, shutil, sys
from PIL import Image

ART = "/app/frontend/public/art"
BAK = "/tmp/art_bak"
TILEMAP = open("/app/frontend/src/game/tilemap.js").read()
SHOWN = {m.group(1): int(m.group(2)) for m in re.finditer(r"^\s+(\w+): \{[^}]*?\bw: (\d+)", TILEMAP, flags=re.M)}
# 9-slice sources: slice numbers are in source pixels, so never resize these
NO_RESIZE = {"panel", "card", "card2", "tile", "btn_dark", "btn_gold", "btn_green", "frame", "plank", "rope"}


def cap_for(rel, name):
    d = rel.split("/")[0]
    if d == "map":
        if name.startswith("t_"): return None
        return max(2 * SHOWN.get(name, 300), 240)
    if d == "hud":
        if name in NO_RESIZE or name in ("world_map", "home_bg", "logo_fishyland", "mascot"): return None
        return 360
    if d == "ui": return 160 if name != "banner" else None
    if d == "npc": return 420
    return None


def process(path):
    rel = os.path.relpath(path, ART); name, ext = os.path.splitext(os.path.basename(path)); ext = ext.lower()
    before = os.path.getsize(path)
    im = Image.open(path); im.load()
    cap = cap_for(rel, name)
    if cap and max(im.size) > cap:
        s = cap / max(im.size); im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    tmp = path + ".tmp"
    if ext == ".webp":
        im.save(tmp, "WEBP", quality=82 if name.startswith("t_") else 86, method=6)
    elif ext in (".jpg", ".jpeg"):
        im.convert("RGB").save(tmp, "JPEG", quality=80, optimize=True, progressive=True)
    elif ext == ".png":
        im.save(tmp, "PNG", optimize=True)
    else:
        return 0
    after = os.path.getsize(tmp)
    if after < before * 0.97:
        dst = os.path.join(BAK, rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst): shutil.copy2(path, dst)
        os.replace(tmp, path); return before - after
    os.remove(tmp); return 0


if __name__ == "__main__":
    saved = 0; total = 0
    for root, _, files in os.walk(ART):
        for f in files:
            if f.lower().endswith((".webp", ".jpg", ".jpeg", ".png")):
                p = os.path.join(root, f); total += os.path.getsize(p)
                try: saved += process(p)
                except Exception as e: print("skip", p, e, file=sys.stderr)
    print(f"art before {total/1e6:.1f} MB, saved {saved/1e6:.1f} MB")
