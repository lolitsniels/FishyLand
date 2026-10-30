"""Re-cut building sprites so windows, glass and see-through bits are solid instead of holes onto the map."""
import io, os, sys, urllib.request
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage
sys.path.insert(0, "/app/scripts")
from biome_art import OBJS, B

OUT = "/app/frontend/public/art/map/"
RAW = "/app/memory/raw/m_"
HARBOUR = ["bait_hut", "house", "tackle_shop", "market_stall", "guild_hall", "tavern", "pearl_shop", "ship", "quest_board", "fountain"]
BIOME = ["stone_cottage", "coast_hut", "stilt_hut", "boathouse", "lighthouse", "beach_hut", "swamp_shack", "research_hut", "charter_boat",
         "ice_shack", "vent_hut", "cave_camp", "temple", "statue"]
GLASS = np.array([196, 222, 238])
S = new_session("isnet-general-use")


def src(k):
    if os.path.exists(RAW + k + ".jpg"):
        return Image.open(RAW + k + ".jpg").convert("RGB")
    return Image.open(io.BytesIO(urllib.request.urlopen(B + OBJS[k] + ".jpeg").read())).convert("RGB")


def solid(k):
    img = src(k)
    rgb = np.asarray(img).astype(int)
    fg = np.asarray(remove(img, session=S).getchannel("A")) > 128
    sil = ndimage.binary_fill_holes(ndimage.binary_closing(fg, structure=np.ones((9, 9)), iterations=1))
    sat = rgb.max(-1) - rgb.min(-1)
    bgish = (sat < 16) & (rgb.mean(-1) > 150)  # the fake checkerboard / plain backdrop
    keep = fg | (sil & ~bgish)
    lab, n = ndimage.label(sil & bgish & ~fg)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    small = [i + 1 for i, s in enumerate(sizes) if s < 0.006 * lab.size]  # little panes, not open-air gaps
    plain = k in ("guild_hall", "charter_boat")  # white-painted art: small holes are white paint, not glass
    small = [i + 1 for i, s in enumerate(sizes) if s < (0.0012 if plain else 0.006) * lab.size]
    glass = np.isin(lab, small)
    if k == "guild_hall":  # white backdrop wedge between the flag pole and the pennant string
        top = np.zeros_like(fg); top[: int(0.2 * fg.shape[0])] = True
        lb, nb = ndimage.label(bgish & top)
        sz = ndimage.sum(np.ones_like(lb), lb, range(1, nb + 1))
        wedge = np.isin(lb, [i + 1 for i, s in enumerate(sz) if s > 1500])
        fg &= ~wedge; keep &= ~wedge; glass &= ~wedge
    out = rgb.copy()
    if not plain:
        out[glass] = GLASS
    alpha = np.where(keep | glass, 255, 0).astype(np.uint8)
    alpha = ndimage.binary_opening(alpha > 0, structure=np.ones((3, 3))).astype(np.uint8) * 255
    im = Image.fromarray(np.dstack([out.astype(np.uint8), alpha]), "RGBA")
    im = im.crop(im.getbbox())
    lim = 1200 if k == "ship" else 900
    if max(im.size) > lim:
        im.thumbnail((lim, lim), Image.LANCZOS)
    return im, int(glass.sum()), int((keep & ~fg).sum())


if __name__ == "__main__":
    keys = sys.argv[1:] or HARBOUR + BIOME
    for k in keys:
        im, g, added = solid(k)
        dst = sys.argv and "--dry" in keys and "/tmp/sb_" or OUT
        im.save(OUT + k + ".webp", quality=92)
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255)); bg.alpha_composite(im)
        bg.convert("RGB").resize((im.width // 2, im.height // 2)).save("/tmp/sb_" + k + ".jpg")
        print(k, im.size, "glass", g, "added", added, flush=True)
