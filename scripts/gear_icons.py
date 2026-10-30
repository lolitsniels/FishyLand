import io, sys, urllib.request
import numpy as np
from PIL import Image
sys.path.insert(0, "/app/backend")
import game_data as gd

B = "https://static.prod-images.emergentagent.com/jobs/17f69698-5e8d-4d75-85c3-475aadbaaadb/images/"
OUT = "/app/frontend/public/art/gear/"
H = {
    "rod_t1": "7b5444934250347107876dfa780f285fb59fe0442f43e36f11369d85ea914624", "rod_t3": "78e318f428855d8bbdcd929c95d6108d8bcb2d0e762f28f94b4d6569eb6f92c7",
    "rod_t5": "26caceea33444592f67017d852497bb3bd810a53dd16bea9a6d8c56c2a7a088f", "rod_t7": "2bc6c82fd02563c78856b42173d67cd55932fd6ef699dc7cd9689e3fa596aef9",
    "rod_t9": "25f856d46f30e3470b04e56bc5fe16fadba5fdc4bd115fc185e1201e1273ab52", "rod_t11": "e780f9d99c838d66f224204c451e4e20a0530144d8faf147ee3bdd4017993e6b",
    "reel_t1": "b1fefdbc344f4f5bde992bc21d359b449bc31d37d12faaaf2a77ea6940898ac8", "reel_t3": "c4af488fcdde830d022237f20e354d459d80a90c88ac1ddc3ac9f564a7eadbaf",
    "reel_t5": "e80f1ef285d8a94e78217a86cfaa06157cc353262aeb21dd277b58a346825e28", "reel_t7": "f739a2949c8625048a86246d30e4a65a347b44c994bf17f2ff1ba09b6ca60b70",
    "reel_t9": "aca408e9f173398e4e5fb4b6c3e8ec771dc220d85aad54940a7d00d216a81892",
    "line_t1": "6453b2a2b648e6b8bcc6d3ff8d992221b4d2ec8c389173a9004200e28af06279", "line_t3": "fd69e042f45da133094399623b59b04cf22c4edaccc54c40ef3d5891d5f79037",
    "line_t5": "399f8203516239a2c2ac7a3c813a0c025a9b4e157602a4d44916dc113a6575f9", "line_t7": "b66bc3f8da05e8aab1340ad93aa325f47a9b402e82aca01d1fce54a287498eda",
    "line_t9": "482723ca6daec9903b6b5ad25c509e2465e3e9ed2792edaccaa0a84429b233a3",
    "bait_bread": "b475c342d8d5c9bffacb8bb867103ea946e9018f2acd841868bed9eb105ac12a", "bait_worm": "0e00b6e2edf4549e9b5d79ba66cc3296f7b369b558fbf540a8b62ab96bd2a08d",
    "bait_maggot": "0002a0598c646b22339ef5479ce7c4bd4f4a3e02488be69c57d47166b797ffd9", "bait_minnow": "add0c0442023e8f19b080c537dab7618d41c58128718e2ad41758efbe4b8f777",
    "bait_shrimp": "07001d75c49fec4d733c53cd40a414ce905036d93121a2aa3bfacdb3501fe22d", "bait_squid": "18185389f95a35ad457fb5c301b8bb5b02820649f4c72c57f9dc778532e2ac6f",
    "bait_lure": "c5f70aa8d0f51e0d63918abf4a31458e2824be0efbfac10f9492a7e4bbe3bfd6", "bait_cut": "23d4aed282625f2cfbe9993b0e29fa8e239c59388ffe28001c65a7ff068318d2",
    "bait_live": "a6a20ed0114e045787646d5d26269b208117771471cd6ac3176c1a986bd2651b", "bait_chum": "1a735a20bc0dc5a8d6da2596cb2c532f32df646713cc7829383b609f78d71cfb",
    "bait_glow": "8a5363d198e69a351a584278b1601850ac5873040fcdc6d93ddb0e97d20734ac", "bait_cricket": "14669d62ce66bafd7ff594fb1f1a5551563c9897fbcad35557cbd5b396da500d",
    "bait_ground": "a9d599cb1cd0fca52003a1ddbc788d07aa7b589facac7f1dcb7f1b4c0bd19226", "bait_bloodworm": "8d87470a37d30641a7f036d2b36277031552c06d5a0c895f75ffd254a4796144",
    "bait_sardine": "ab535ad4ebf0f828749633655ea1b4273a56d7a926dad34fc69e051ce299437b", "bait_moonfly": "39497b602fcfd74377537993e8e1976a4fa4e34370949ac617373896d7b84a17",
    "bait_lantern": "0f0b904636b2bec61c0ca7206f668d75ec32b33ab5a3a793856da9a213ef884f", "bait_roe": "d6220b4fce58265ac452fd8e3c896004d91e7df78c5e7d3b506acf66148653d1",
    "bait_duel": "423fccd133ff9107e239cc87984f55b6b486936c45d8a7b29ac88598bf7b8156", "craft_salted": "98f0e01f7f0fdb549e2643a0f0cdffe22236b3e20da0a1ea075181d3806acd14",
    "craft_chum": "b1d449018188f5a92e4814b696f3984eeed7403954259d145d43d20b64ee3c6c", "craft_glowpaste": "67b49ce3b8daddce4a9f60f0147b9e1aec4c376f4a540977c9ca7d856f5b6f3a",
    "craft_secret": "7975f1dbac9474c3041b9be7219923284e5ad65f65b94e0885242f3a697a01f3",
}


def key(url):
    im = Image.open(io.BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
    a = np.asarray(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    alpha = np.clip(1 - (spill - 40) / 60, 0, 1)
    a[..., 1] = np.minimum(g, np.maximum(r, b) + 12)
    rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    out = out.crop(out.getbbox())
    out.thumbnail((240, 240), Image.LANCZOS)
    c = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    c.paste(out, ((256 - out.width) // 2, (256 - out.height) // 2), out)
    return c


def nearest(prefix, tier, have):
    return min(have, key=lambda t: (abs(t - tier), -t))


if __name__ == "__main__":
    import os
    os.makedirs(OUT, exist_ok=True)
    imgs = {k: key(B + h + ".jpeg") for k, h in H.items()}
    for k, im in imgs.items():
        im.save(OUT + f"_{k}.webp", "WEBP", quality=88)
    tiers = {p: [int(k.split("_t")[1]) for k in H if k.startswith(p + "_t")] for p in ("rod", "reel", "line")}
    for p, lst in (("rod", gd.RODS), ("reel", gd.REELS), ("line", gd.LINES)):
        for g in lst:
            imgs[f"{p}_t{nearest(p, g['tier'], tiers[p])}"].save(OUT + g["id"] + ".webp", "WEBP", quality=88)
    for b in gd.BAITS:
        if b["id"] in imgs:
            imgs[b["id"]].save(OUT + b["id"] + ".webp", "WEBP", quality=88)
    print("done", len(os.listdir(OUT)))
