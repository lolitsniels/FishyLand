from rembg import remove, new_session
from PIL import Image
import numpy as np
s = new_session("isnet-general-use")
for n, size in [("i_gold", 128), ("i_pearl", 128), ("i_tackle", 256)]:
    o = remove(Image.open(n + ".jpg").convert("RGB"), session=s)
    o = o.crop(o.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()); o.thumbnail((size, size), Image.LANCZOS)
    o.save("/app/frontend/public/art/hud/" + {"i_gold": "gold", "i_pearl": "pearl", "i_tackle": "tackle"}[n] + ".webp", quality=92); print(n, o.size, flush=True)
# house sprite: kill the dithered half-transparent shadow at the bottom
p = "/app/frontend/public/art/map/house.webp"
a = np.array(Image.open(p).convert("RGBA")); h = a.shape[0]
band = a[h - 70:, :, 3]; band[band < 230] = 0; a[h - 70:, :, 3] = band
Image.fromarray(a).save(p, quality=92); print("house fixed")
