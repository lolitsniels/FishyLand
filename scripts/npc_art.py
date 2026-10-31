"""Patron art: portraits (art/npc/<id>.webp, square, white bg kept as soft card) and walking NPC sprites (art/npc/body_<id>.webp, cut out)."""
import io, os, urllib.request
from PIL import Image
from rembg import remove, new_session

B = "https://static.prod-images.emergentagent.com/jobs/17f69698-5e8d-4d75-85c3-475aadbaaadb/images/"
OUT = "/app/frontend/public/art/npc/"
os.makedirs(OUT, exist_ok=True)
S = new_session("isnet-general-use")
FACE = {"harbourmaster": "e0f1040adcc4d9b00d4267731cfb3214897b4e2461286b6f07444f3ed58e24b9", "baitseller": "55e6925c69beec3c494cd9e2feced6534f046698c0ee951b3becb1b762eafc4d",
        "sailor": "2754ad38fb8d08cf3a616bc844376e2a8b8a749b46be0d5b77b817f2f3a3866f", "cook": "75653e616a3d3c52a95fd729bcc4d7c13a4c0d54e638e20b22de7e6f2d54df0b"}
BODY = {"harbourmaster": "7f1e2753b89974de9591052ada713add035b76d0979c7b05d4eaf1e85c3f0550", "baitseller": "23a5a011ea5af9ec32ad8b942c32dd2df53a2c09237cfd080ee4e94b9e258067",
        "sailor": "2d5c7e5b21a1f312f756d9714962bc730a6c00ff6582d8b55eebaeb68a598731", "cook": "85dd42e8e01857bf6dcc44142a0e69a3e8c1ac2e6d19b7d6e42355eebdd3d5af"}
get = lambda h: Image.open(io.BytesIO(urllib.request.urlopen(B + h + ".jpeg").read())).convert("RGB")
for k, h in FACE.items():
    cut = remove(get(h), session=S, post_process_mask=True)
    cut = cut.crop(cut.getbbox()); s = max(cut.size); sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sq.alpha_composite(cut, ((s - cut.width) // 2, s - cut.height)); sq.resize((384, 384), Image.LANCZOS).save(OUT + k + ".webp", quality=90)
for k, h in BODY.items():
    cut = remove(get(h), session=S, post_process_mask=True)
    cut = cut.crop(cut.getbbox()); cut.thumbnail((300, 640), Image.LANCZOS); cut.save(OUT + "body_" + k + ".webp", quality=90)
    print(k, cut.size, flush=True)
