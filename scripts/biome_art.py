import io, sys, urllib.request
import numpy as np
from PIL import Image
from rembg import remove, new_session

OUT = "/app/frontend/public/art/map/"
B = "https://static.prod-images.emergentagent.com/jobs/17f69698-5e8d-4d75-85c3-475aadbaaadb/images/"
TILES = {
    "ice": "5bbc88f1d352fdf0ca3f3a818e73bec7c2bfc9076d63bd6e3988119be319ca8d", "moss": "8770f11b9e8ca19efd31af1cfdc7170a382377cc921419d0be566007543b04fc",
    "snow": "fb5b496725dcc52cd3be192d334ac1ed817941e9a37e123313ba6349487aa78c", "marsh": "60c2b09bcfc92faf5cd0b5ee212e26daa71a7a070ae7c74510722b4582c14538",
    "mud": "fc93d7704961fafddc37c135b2f5620b4bc7796719ec3a99bc3e001bb854d74a", "flag": "c6b0adb68061bf0ddaf4638c5a92ea3b681bd9e23ffa9e714203046e2679f4a6",
    "cave": "e7e1d869d87ffaccf16f09331b9eadfe7c253b66a834f5d16400d9b792903ff6", "ash": "73119e9b4e7af79a12b8f14929b15f1308734a51bd19bf0b5ca3b76409969b79",
    "jungle": "aedf77c38ba79a66b554c50215056c4c9151473f496a168557090663b43ef070", "rock": "64b0ef26babd11142fbcf8d821a90ed447c5f4855973b0e7daa34c8d5a348a3c",
    "estuary": "5d807cdbfe02da646e806f609a8258dbae37c48185d54e2dba39051cc9e8c421", "deep": "8d4ebe1c8f97682ab83d8155a84055180cd822bf9e82aa6c0a6bdc4547659ab2",
    "vent": "1474f45170f5b8e0f91a484200c925afa3b26a85858c5ea99d9712f45bff7f11", "lake": "2ddb806e73e565fa1a8127aca6d9ef6e15a4560152614ca2cb4c95e894f6ea20",
    "lagoon": "f9e395e650313fe0d44dade3c62ea61b829bc172d8f6e8d54302fa6b3e6898fb", "jade": "35ffbaba6536c674d78589ed4803e6fcafc4e60bd9203bf6f06b2acdc0119f7f",
    "cavewater": "17bf4e39c27777dd3560c9cc09ca7ef3e52a8fd6e92c4aaacdfbad245192311a", "swamp": "53104eb3463f1456c5a331a0c5d85fa8651f01099fa90a53b355faf87e5c6a15",
}
OBJS = {
    "stone_cottage": "b4880473c0d595eb9b44ef3a8686d4fa8b14d35d8b935908fcf51d283f6e5198", "marsh_grass": "bd931e61804776fc2f9625d5327869e4e0be5e1d03ab917e84f74871da2f5c6b",
    "cliff_rock": "30040d54b6da79d988a7e151195705365c53463cdc9b13490086f22a37a6eedb", "coast_hut": "f98eddb3ad0b8a83440c2a131744de67410c9e90dc9667b11929702e4060b318",
    "palm": "8b9071bfe9f39f96f3e976497577162042c0dee6a9529348c6e1fd478e659814", "stilt_hut": "596b5ed02e2246047827c09292748175c3765584cf0ba105adde75f541bb82ec",
    "cairn": "3f2bf2798f1fd348f8b8100ee7b13698707907ce48e4ea4c5bcd2c1042973d1b", "boathouse": "5ca176e64dfb3e585d84988d3c83d3a1274eb705e95ce4eea4134bdb35c768ee",
    "lighthouse": "548cd22a522f93999f729eafebfab52888214411908384eb19b8ae1332d20852", "beach_hut": "13e7ae86db7dea92673afdd3c7367096e12f588a7788e6f3a6adc71b64c49bcb",
    "glow_shroom": "075b600a917f960278405e52eb69d73341d9872549587ed23eb2c672db9c2955", "stalagmite": "a07a9aaf6a4a8c5b7f07b30f749ad04a904770e5fab012c84eae7dffc0b99ad7",
    "parasol": "fb1ba8ca5e72021946ddc359f671e0abcbea7c6ca0aa4f651d7accd4476baeed", "mangrove": "c2fb06213ba62f2fe1ca069daec2da5460e62d79d77ff58d31429bb97a99b00d",
    "snow_pine": "904b497b4098cbb7eabe05ccc653987f23bf21f8a44dd586d31f8ba4c56c763b", "swamp_shack": "31d159a99912b074487f48b2d674eff04d1def8c74be2f55d922e40eb934f079",
    "research_hut": "ed50951a144e5a9f56386f9ba4058a3c74fdb7234c156786a030147ee0418505", "charter_boat": "38cf97b66bfb29adf06eb0962d1c9c5ffe0830c75013567cb52a151853cecff8",
    "snowman": "eac429f8e833982f36565cbcd192c68b8e14eaa365543839373fe155adf6fbca", "ice_shack": "0abbb422d22f7cff2225e3b5ad398a56c22acafc2240c18ac96cb2cf2fb9cc22",
    "jungle_tree": "7eab397df72411a418b456d55fbf744b8303564c2682c2a113daa4f8fba1c6d2", "basalt": "5f1a67c725b15bbb392b6e87b5d0603a1cc58adcce1e66c814cd129ea650ef9d",
    "statue": "6fab291200e33f07ce28bd5bc46321f2711a369900f8e5d1ea3683782a346cd0", "vent_hut": "1fd103e1bc9ac587f00fbd1b07b9809a2bf4f4c3ba9dac5a6664237f2c168c4a",
    "dead_tree": "fbb147262c6d9547c796711740cddb0d4538a17a2bcf315cfb55e3df99075f70", "cave_camp": "aa0fae542dbf43a2c35c9a14c53acec03a3bc14f850fbbd0f08829b99cbda534",
    "temple": "ef0012abae8ac2b0631000e5eb98c96d4168b08bb7eb5f956a7930969033c3a9", "crystal": "cab14ef70f82b00806cc48f58c19c57c0c83cb23999f25e07069253d338ed50d",
    "ghost_tree": "59892619ba382b63589dc179ceab76db44350c44d7cfa9015205136cf29a1963", "pillar": "2b1e839306a061806688cd849c20fe17325d130e7544d2c82e754cf85d9df20a",
}


def get(h):
    return Image.open(io.BytesIO(urllib.request.urlopen(B + h + ".jpeg").read()))


def seamless(img):
    # blend the image with its half-offset copy across a soft cross so edges wrap cleanly
    a = np.asarray(img.convert("RGB").resize((1024, 1024), Image.LANCZOS)).astype(float)
    b = np.roll(np.roll(a, 512, 0), 512, 1)
    x = np.abs(np.linspace(-1, 1, 1024))
    w = np.clip((np.maximum.outer(x, x) - 0.7) / 0.3, 0, 1)[..., None]
    return Image.fromarray((a * (1 - w) + b * w).astype(np.uint8))


def cut(img, session, max_side=900):
    out = remove(img.convert("RGB"), session=session).convert("RGBA")
    a = np.asarray(out).copy()
    al = a[..., 3]
    al[al < 200] = 0
    al[al >= 200] = 255
    out = Image.fromarray(a)
    out = out.crop(out.getbbox())
    s = max_side / max(out.size)
    if s < 1:
        out = out.resize((int(out.width * s), int(out.height * s)), Image.LANCZOS)
    return out


if __name__ == "__main__":
    which = sys.argv[1:]
    if not which or "tiles" in which:
        for k, h in TILES.items():
            seamless(get(h)).save(OUT + f"t_{k}.webp", quality=86)
            print("tile", k)
    if not which or "objs" in which:
        sess = new_session("isnet-general-use")
        for k, h in OBJS.items():
            o = cut(get(h), sess)
            o.save(OUT + f"{k}.webp", quality=90)
            bg = Image.new("RGBA", o.size, (255, 0, 255, 255)); bg.alpha_composite(o)
            bg.convert("RGB").save(f"/tmp/chk_{k}.jpg", quality=70)
            print("obj", k, o.size)
