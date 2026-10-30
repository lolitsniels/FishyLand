from rembg import remove, new_session
from PIL import Image
import glob, os
s = new_session("isnet-general-use")
for f in sorted(glob.glob("m_*.jpg") + glob.glob("n_*.jpg")):
    n = os.path.basename(f)[:-4]
    if n == "n_panel": continue
    o = remove(Image.open(f).convert("RGB"), session=s)
    o = o.crop(o.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox())
    lim = 1200 if n in ("m_ship",) else 900
    if max(o.size) > lim: o.thumbnail((lim, lim), Image.LANCZOS)
    name = {"n_card": "card2"}.get(n, n[2:])
    o.save(("/app/frontend/public/art/map/" if n[0] == "m" else "/app/frontend/public/art/hud/") + name + ".webp", quality=92)
    print(name, o.size, flush=True)
