"""Clubhouse interior art: floor + wall textures and cut-out furniture (yacht club style)."""
import io, sys, urllib.request
import numpy as np
from PIL import Image
sys.path.insert(0, "/app/scripts")
from biome_art import seamless, B
from solid_buildings import S, ndimage
from rembg import remove

OUT = "/app/frontend/public/art/map/"
H = {
    "club_floor": "0f4558b808d91c3f7d6b2c202ee782e259129e6c569a9f1a594ba0776227eb12",
    "club_wall": "c612356cfd7ddf26e3d6b5974424792f04f6620e032fd4fadd984bffa3c988cf",
    "club_plant": "fc41222156dd8913ec07e60217d7ddd92683d76d7df0a32b2809d26c3d492425",
    "club_mailbox": "f2137d5b99cf87ceb6790c0f7f2001f9a2aec9504226ef785fb9a6c09e33f129",
    "club_portraits": "ee00fb228c01576266492148728c0980ce8302931ea4dc2e7f5c483468697d4b",
    "club_notice": "09800e5aa772c8eae3b90c89d20afd39b9e53d002e3c389f96f5857b4ce56547",
    "club_trophies": "489c5ad332ea1642a11817813a7aa3f6ac713d27c2b1873bf41110d0452f729a",
    "club_desk": "9c06877569f40303dbbb3e9fe2ffce2f323986a3cf57811af7f35276e79ec4b4",
    "club_rug": "546a40893fec6044671ed09bd99ad246eff5cfece0366d360af8e3557a7b5e40",
    "club_sofa": "9c625f7d640a9bd87474227477ab624eef4f0ffe42196cd6f86fcbdc82145ced",
}


def get(k):
    return Image.open(io.BytesIO(urllib.request.urlopen(B + H[k] + ".jpeg").read())).convert("RGB")


def wall_strip(img):
    # wrap horizontally only (top trim and bottom wainscot must stay where they are)
    a = np.asarray(img.resize((1536, 1024), Image.LANCZOS)).astype(float)
    b = np.roll(a, 768, 1)
    x = np.abs(np.linspace(-1, 1, 1536))
    w = np.clip((x - 0.8) / 0.2, 0, 1)[None, :, None]
    return Image.fromarray((a * (1 - w) + b * w).astype(np.uint8))


def cutout(img):
    rgb = np.asarray(img).astype(int)
    fg = np.asarray(remove(img, session=S).getchannel("A")) > 128
    fg = ndimage.binary_fill_holes(fg)  # glass doors, frames: keep what's painted inside
    im = Image.fromarray(np.dstack([rgb.astype(np.uint8), (fg * 255).astype(np.uint8)]), "RGBA")
    im = im.crop(im.getbbox())
    im.thumbnail((700, 700), Image.LANCZOS)
    return im


for k in H:
    img = get(k)
    if k == "club_floor":
        seamless(img).save(OUT + "t_clubfloor.webp", quality=90)
    elif k == "club_wall":
        wall_strip(img).save(OUT + "t_clubwall.webp", quality=90)
    else:
        im = cutout(img)
        im.save(OUT + k + ".webp", quality=92)
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255)); bg.alpha_composite(im)
        bg.convert("RGB").resize((im.width // 3, im.height // 3)).save("/tmp/cl_" + k + ".jpg")
    print(k, flush=True)
