import io
import os
import shutil
import sys
import urllib.request
from collections import deque

import numpy as np
from PIL import Image
from scipy import ndimage

MAP = sys.argv[2] if len(sys.argv) > 2 else "/app/frontend/public/art/map"
BACKUP = "/app/art_backup/map"
URLS = dict(line.split("=", 1) for line in open(sys.argv[1]).read().split())


def key(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g
    alpha = np.where(m > 60, 0, 255).astype(np.uint8)
    # despill the edge: pull magenta tint out of kept pixels near the key colour
    spill = (m > 15) & (alpha > 0)
    a[..., 0] = np.where(spill, np.minimum(r, g + 30), r)
    a[..., 2] = np.where(spill, np.minimum(b, g + 30), b)
    return a.astype(np.uint8), alpha


def fill_small_holes(alpha):
    lab, n = ndimage.label(alpha == 0)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    inner = np.isin(lab, [i for i in range(1, n + 1) if i not in edge])
    alpha[inner] = 255
    return alpha


def drop_specks(alpha, min_area=400):
    lab, n = ndimage.label(alpha > 0)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    small = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz < min_area])
    alpha[small] = 0
    return alpha


os.makedirs(BACKUP, exist_ok=True)
for name, url in URLS.items():
    dst = f"{MAP}/{name}.webp"
    if os.path.exists(dst) and not os.path.exists(f"{BACKUP}/{name}.webp"):
        shutil.copy(dst, f"{BACKUP}/{name}.webp")
    src = Image.open(io.BytesIO(urllib.request.urlopen(url).read()))
    small = src.convert("RGB")
    rgb, alpha = key(small)
    keyed = alpha.copy()
    alpha = fill_small_holes(alpha)
    alpha = drop_specks(alpha)
    # filled holes take the colour of the nearest real pixel instead of the magenta key
    _, idx = ndimage.distance_transform_edt(keyed == 0, return_indices=True)
    rgb = rgb[idx[0], idx[1]]
    holes = (keyed == 0) & (alpha > 0)
    rgb[holes] = (38, 52, 66)  # enclosed key-colour areas (windows, doorways) become dark glass
    im = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    im = im.crop(im.getbbox())
    if os.path.exists(f"{BACKUP}/{name}.webp"):
        ow, oh = Image.open(f"{BACKUP}/{name}.webp").size
    else:
        ow, oh = im.size
    s = min(ow / im.width, oh / im.height)
    nw, nh = max(1, round(im.width * s)), max(1, round(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    a = np.asarray(im).copy()
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    im = Image.fromarray(a, "RGBA")
    canvas = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    canvas.paste(im, ((ow - nw) // 2, oh - nh), im)
    canvas.save(dst, quality=90, method=6)
    print(name, (ow, oh), (nw, nh))
