# Iter19: audit building sprites for see-through holes (enclosed transparent regions) and grey/white checkerboard residue
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

D = "/app/frontend/public/art/map/"
KEYS = ["bait_hut", "house", "tackle_shop", "market_stall", "guild_hall", "tavern", "pearl_shop", "ship", "quest_board", "fountain",
        "stone_cottage", "coast_hut", "stilt_hut", "boathouse", "lighthouse", "beach_hut", "swamp_shack", "research_hut", "charter_boat",
        "ice_shack", "vent_hut", "cave_camp", "temple", "statue"]

for k in KEYS:
    im = Image.open(D + k + ".webp").convert("RGBA")
    a = np.asarray(im)
    al = a[..., 3]
    opaque = al > 128
    filled = ndimage.binary_fill_holes(opaque)
    holes = filled & ~opaque
    lab, n = ndimage.label(holes)
    sizes = sorted(ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)), reverse=True) if n else []
    big = [int(s) for s in sizes if s > 30]
    rgb = a[..., :3].astype(int)
    sat = rgb.max(-1) - rgb.min(-1)
    grey = opaque & (sat < 10) & (rgb.mean(-1) > 170)
    # checkerboard: grey pixels whose 8px-shifted neighbour differs strongly in brightness while also grey
    m = rgb.mean(-1)
    chk = 0
    for sh in (8, 10, 12, 16):
        g2 = np.roll(grey, sh, axis=1)
        diff = np.abs(m - np.roll(m, sh, axis=1))
        chk = max(chk, int((grey & g2 & (diff > 25)).sum()))
    pct = 100 * grey.sum() / max(1, opaque.sum())
    print(f"{k:14s} size={im.size} holes>30px={len(big)} top={big[:4]} grey%={pct:.2f} checker_px={chk}")
