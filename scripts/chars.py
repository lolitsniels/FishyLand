"""Builds the 2 x 4 x 5 angler variants (gender x skin tone x hair colour) from two magenta-keyed base sprites."""
import colorsys
import io
import os
import urllib.request

import numpy as np
from PIL import Image

B = "https://static.prod-images.emergentagent.com/jobs/17f69698-5e8d-4d75-85c3-475aadbaaadb/images/"
BASE = {"m": "bfa82b713c2865e07026d03139d77249ca0764480ffc90030c27bc4bb09e93f9", "f": "23735864bd62405be89b705f457c6d51161adbbe57239069468eadb6b458b9ed"}
OUT = "/app/frontend/public/art/chars/"
SKINS = [(247, 214, 186), (226, 170, 128), (184, 124, 84), (120, 76, 50)]
HAIRS = [(38, 30, 28), (112, 66, 34), (232, 192, 102), (186, 64, 32), (205, 208, 220)]


def load(h):
    im = Image.open(io.BytesIO(urllib.request.urlopen(B + h + ".jpeg").read())).convert("RGB")
    a = np.asarray(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = np.minimum(r, b) - g
    alpha = np.clip(1 - (mag - 60) / 70, 0, 1)
    # despill magenta fringes
    sp = np.clip(np.minimum(r, b) - g, 0, None) * (1 - alpha)
    a[..., 0] -= sp * 0.6
    a[..., 2] -= sp * 0.6
    return a.clip(0, 255), alpha


def hsv(a):
    f = a / 255.0
    mx, mn = f.max(-1), f.min(-1)
    d = mx - mn + 1e-6
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / (mx + 1e-6), mx


def build(key, h):
    a, alpha = load(h)
    hu, sa, va = hsv(a)
    solid = alpha > 0.5
    hair = solid & (hu > 85) & (hu < 170) & (sa > 0.3)
    skin = solid & ~hair & (hu > 4) & (hu < 38) & (sa > 0.18) & (sa < 0.8) & (va > 0.22)
    lum = a.mean(-1)
    hair_mean = lum[hair].mean()
    skin_mean = a[skin].mean(0)
    ys, xs = np.where(alpha > 0.5)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    hair_ys = ys[hair[ys, xs]]
    for si, st in enumerate(SKINS):
        for hi, hc in enumerate(HAIRS):
            o = a.copy()
            o[skin] = a[skin] * (np.array(st) / skin_mean)
            k = (lum[hair] / hair_mean)[:, None]
            o[hair] = np.array(hc)[None, :] * k ** 1.15 + 12 * (k > 1.25)
            rgba = np.dstack([o.clip(0, 255), alpha * 255]).astype(np.uint8)
            im = Image.fromarray(rgba, "RGBA").crop(box)
            im.thumbnail((400, 640), Image.LANCZOS)
            im.save(f"{OUT}{key}_{si}_{hi}.webp", "WEBP", quality=90)
            # head portrait for avatars
            full = Image.fromarray(rgba, "RGBA")
            top = int(hair_ys.min()) - 10
            hx = int(np.median(xs[(ys > top) & (ys < top + 200)]))
            face = full.crop((hx - 105, top - 4, hx + 115, top + 216)).resize((160, 160), Image.LANCZOS)
            face.save(f"{OUT}face_{key}_{si}_{hi}.webp", "WEBP", quality=90)
    print(key, "done", box)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for k, h in BASE.items():
        build(k, h)
