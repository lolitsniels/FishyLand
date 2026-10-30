from rembg import remove, new_session
from PIL import Image
import numpy as np
s = new_session("isnet-general-use")
for n, out, lim in [("mascot", "mascot.webp", 700), ("logo", "logo_fishyland.webp", 900)]:
    o = remove(Image.open(n + ".jpg").convert("RGB"), session=s)
    o = o.crop(o.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()); o.thumbnail((lim, lim), Image.LANCZOS)
    a = np.array(o); al = a[..., 3]; al[al < 160] = 0; al[al >= 160] = 255; a[..., 3] = al
    Image.fromarray(a).save("/app/frontend/public/art/hud/" + out, quality=92); print(out, o.size, flush=True)
