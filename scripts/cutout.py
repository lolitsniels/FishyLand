import sys, io, urllib.request
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

NOINT = "nointerior" in sys.argv
ART = "/app/frontend/public/art/"

def checker_colors(a):
    patch = np.concatenate([a[:60, :60].reshape(-1, 3), a[:60, -60:].reshape(-1, 3), a[-60:, :60].reshape(-1, 3), a[-60:, -60:].reshape(-1, 3)]).astype(float)
    lum = patch.mean(1)
    t = (lum.min() + lum.max()) / 2
    lo, hi = patch[lum <= t], patch[lum > t]
    cols = [c.mean(0) for c in (lo, hi) if len(c)]
    return cols

def cutout(url, name, max_side):
    data = urllib.request.urlopen(url).read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    a = np.asarray(img).astype(float)
    cols = checker_colors(a)
    sat = a.max(2) - a.min(2)
    dist = np.min([np.abs(a - c).max(2) for c in cols], axis=0)
    cand = (dist < 34) & (sat < 28)
    lab, _ = ndimage.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    d0, d1 = [np.abs(a - c).max(2) < 24 for c in cols] if len(cols) == 2 else (cand, cand)
    n_lab = lab.max()
    areas = ndimage.sum(cand, lab, range(1, n_lab + 1))
    f0 = ndimage.sum(d0, lab, range(1, n_lab + 1))
    f1 = ndimage.sum(d1, lab, range(1, n_lab + 1))
    interior = [] if NOINT else [i + 1 for i in range(n_lab) if areas[i] > 250 and (i + 1) not in border
                and f0[i] / areas[i] > 0.15 and f1[i] / areas[i] > 0.15]
    bg |= np.isin(lab, interior)
    bg = ndimage.binary_closing(bg, iterations=2) | bg
    fg = ~bg
    fg = ndimage.binary_opening(fg, iterations=2)
    labf, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, labf, range(1, n + 1))
        keep = np.isin(labf, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.02])
        fg = keep
    fg = ndimage.binary_erosion(fg, iterations=2)
    alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    bbox = out.getbbox()
    out = out.crop(bbox)
    s = max_side / max(out.size)
    if s < 1:
        out = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    out.save(ART + name + ".png", optimize=True)
    print(name, out.size)

def plain(url, name):
    data = urllib.request.urlopen(url).read()
    Image.open(io.BytesIO(data)).convert("RGB").save(ART + name + ".jpg", quality=90)
    print(name)

if __name__ == "__main__":
    mode, url, name, *rest = sys.argv[1:]
    if mode == "cut":
        cutout(url, name, int(rest[0]) if rest else 1024)
    else:
        plain(url, name)

def black_key(url, name, max_side):
    img = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
    a = np.asarray(img).astype(float) / 255
    m = a.max(2)
    alpha = np.clip((m - 0.06) / 0.30, 0, 1)
    rgb = np.clip(a / np.maximum(alpha[..., None], 1e-3) * np.minimum(1, alpha[..., None] * 3), 0, 1)
    rgb = np.where(alpha[..., None] > 0.02, np.clip(a / np.maximum(alpha[..., None], 0.35), 0, 1), 0)
    out = Image.fromarray(np.dstack([rgb * 255, alpha * 255]).astype(np.uint8), "RGBA")
    out = out.crop(out.getbbox())
    s = max_side / max(out.size)
    if s < 1:
        out = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    out.save(ART + name + ".png", optimize=True)
    print(name, out.size)

def green_key(url, name, max_side):
    img = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
    a = np.asarray(img).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    excess = g - np.maximum(r, b)
    alpha = np.clip(1 - (excess - 25) / 70, 0, 1)
    hard = ndimage.binary_erosion(alpha > 0.5, iterations=1)
    alpha = np.where(hard, alpha, alpha * 0.0)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    rgb = np.dstack([r, g2, b])
    out = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
    out = out.crop(out.getbbox())
    s = max_side / max(out.size)
    if s < 1:
        out = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    out.save(ART + name + ".png", optimize=True)
    print(name, out.size)
