# Iter19: render sprites over magenta and mark enclosed holes for visual review
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

D = "/app/frontend/public/art/map/"
tiles = []
for k in ["tavern", "fountain", "ship", "house", "guild_hall", "charter_boat", "swamp_shack", "coast_hut"]:
    im = Image.open(D + k + ".webp").convert("RGBA")
    a = np.asarray(im)
    op = a[..., 3] > 128
    holes = ndimage.binary_fill_holes(op) & ~op
    lab, n = ndimage.label(holes)
    bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
    bg.alpha_composite(im)
    dr = ImageDraw.Draw(bg)
    for sl in ndimage.find_objects(lab):
        if (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start) > 60:
            dr.rectangle([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], outline=(0, 255, 0, 255), width=4)
            print(k, "hole bbox x", sl[1].start, sl[1].stop, "y", sl[0].start, sl[0].stop)
    bg.thumbnail((450, 450))
    tiles.append(bg)
W = Image.new("RGB", (1800, 900), (40, 40, 40))
for i, t in enumerate(tiles):
    W.paste(t.convert("RGB"), ((i % 4) * 450, (i // 4) * 450))
W.save("/app/tests/sprites_magenta.jpg", quality=70)
