"""Cut the raised front fist out of every character sprite (overlay drawn above the rod) and record grip points."""
import json, glob, os
import numpy as np
from PIL import Image

D = "/app/frontend/public/art/chars/"
out = {}
for p in sorted(glob.glob(D + "[mf]_*_*.webp")):
    k = os.path.basename(p)[:-5]
    im = np.array(Image.open(p).convert("RGBA")).astype(int)
    H, W = im.shape[:2]
    r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    skin = (a > 200) & (r > b + 12) & (r >= g) & ((mx - mn) > 18)
    yy, xx = np.mgrid[0:H, 0:W]
    band = skin & (yy > 0.2 * H) & (yy < 0.48 * H) & (xx > 0.6 * W)
    xs = xx[band]
    if not len(xs):
        print("no hand", k); continue
    x1 = xs.max()
    fist = band & (xx > x1 - 0.2 * W)
    ys, xs2 = yy[fist], xx[fist]
    cx, cy = xs2.mean(), ys.mean()
    # grow slightly so the outline around the fist is included
    m = Image.fromarray((fist * 255).astype("uint8")).filter(__import__("PIL.ImageFilter", fromlist=["x"]).MaxFilter(7))
    m = np.array(m) > 0
    m &= (a > 0) & (np.hypot(xx - cx, yy - cy) < 0.16 * W)
    o = im.copy(); o[..., 3] = np.where(m, im[..., 3], 0)
    Image.fromarray(o.astype("uint8"), "RGBA").save(D + "hand_" + k + ".webp", quality=90)
    out[k] = [round(cx / W, 3), round(cy / H, 3)]
json.dump(out, open("/app/frontend/src/game/gripMeta.json", "w"))
print(len(out), list(out.items())[:4])
