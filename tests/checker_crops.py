# Iter19: find densest checkerboard-like patch per sprite and save crops on magenta for review
import numpy as np
from PIL import Image
from scipy import ndimage

D = "/app/frontend/public/art/map/"
KEYS = ["house", "ship", "stone_cottage", "ice_shack", "pearl_shop", "tackle_shop", "bait_hut", "coast_hut", "market_stall", "research_hut", "vent_hut", "boathouse"]
crops = []
for k in KEYS:
    im = Image.open(D + k + ".webp").convert("RGBA")
    a = np.asarray(im).astype(int)
    rgb, op = a[..., :3], a[..., 3] > 128
    m = rgb.mean(-1)
    sat = rgb.max(-1) - rgb.min(-1)
    grey = op & (sat < 12)
    best = np.zeros(m.shape, bool)
    for sh in range(6, 20, 2):
        for ax in (0, 1):
            best |= grey & np.roll(grey, sh, axis=ax) & (np.abs(m - np.roll(m, sh, axis=ax)) > 30) & (np.abs(m - np.roll(m, 2 * sh, axis=ax)) < 8)
    dens = ndimage.uniform_filter(best.astype(float), 60)
    y, x = np.unravel_index(dens.argmax(), dens.shape)
    print(f"{k:14s} max_density={dens.max():.3f} at {x},{y}")
    bg = Image.new("RGBA", im.size, (255, 0, 255, 255)); bg.alpha_composite(im)
    c = bg.crop((max(0, x - 110), max(0, y - 110), x + 110, y + 110)).convert("RGB")
    crops.append(c)
W = Image.new("RGB", (220 * 6, 440), (30, 30, 30))
for i, c in enumerate(crops):
    W.paste(c, ((i % 6) * 220, (i // 6) * 220))
W.save("/app/tests/checker_crops.jpg", quality=75)
