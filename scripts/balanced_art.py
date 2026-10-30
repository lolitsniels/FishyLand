import sys, urllib.request, io, os
sys.path.insert(0, "/app/scripts")
from cutout import green_key
from PIL import Image
import numpy as np
from scipy import ndimage

ART = "/app/frontend/public/art/"
B = "https://static.prod-images.emergentagent.com/jobs/17f69698-5e8d-4d75-85c3-475aadbaaadb/images/"
ITEMS = {
    "angler": ("827c165948cfe666416d1fa44763a4fe58ab7c0d036fd5a0d092fb5882d2069b", 900),
    "wings": ("10d4de02e79e2e7cdfac85acc42c7d3de8bb9fa8ad8408ddcc689f789614a532", 1100),
    "pet": ("452ee87e88ebec2386495298f6245a15a95f82e01abd4e08e56746ba914ddf04", 512),
    "fish/golden_sunray": ("ed455f08c3c4bd7bffdabd2d63f1b96d37440b3bbfbf9550d13b4482975102d4", 512),
    "fish/stormscale_pike": ("9103a76eb5bec7646b4dabbc7f42c9c49837d3feed2b754a0a24ddf3e1c728f4", 512),
    "fish/azure_perch": ("a7288f641a3569c8dd0aa27db10e2a62d7555dbb3f1ced83942ef486b984d283", 512),
    "fish/starwhale": ("2fa9b0e5709fe4c9d577fe1ee2f6db5c5bd4a8211625b949d10d47e083a21e3e", 512),
    "fish/glimmer_minnow": ("83ded9e0d9bbcd97e3429aaf4785589e943ec50d52d1019c7912d3b30ac7ed01", 512),
    "fish/prism_koi": ("a7d9dc518614b830a36a1b86c12a5a91798e72450cef5a881c8060011ee92f0a", 512),
    "fish/crystal_angelfish": ("995e89e136d0da28e7d13c323e8d314321f6c032184d06eb6ec6baf6618bd9ae", 512),
    "fish/lagoon_carp": ("e9a273a5f91430f529ba3d13d68c28d3d96c44d88c17b2c30faa942659399726", 512),
    "fish/coral_snapper": ("c7e2f7c3ade9821061cb671b70d49e8a153661ae0d6e318b566ee99fa8e449ee", 512),
    "fish/moonfin_trout": ("cd804a004d2b8defa1e039469f9d24040f6725a756acf6b7d2eb56bed73e3c48", 512),
    "ui/market": ("5fb193875323d2d9349a2e959157b87caa142dd8ca16317d9670920d667719b7", 192),
    "ui/fishdex": ("180540e9cce6231401b04cb147b313be51e4a70840ed3d4daf96a91fad803a85", 192),
    "ui/settings": ("92a01554248feeb1f4d22b308706969dadfae6126741314473399131e32f5d1e", 192),
    "ui/rod": ("7f9408b190fcb4247d35d4aa10eba25882c908d1576779dc793a15dc08752a1a", 192),
    "ui/skills": ("83484fd507ef94c3bd287e9a31bcbc9ab5b6bfcb4276f41d028f1d3d044d475a", 192),
    "ui/craft": ("2ff77aaa3e2bc1072b4247d644b6548cdde9ae1eeebd83a5d74778555d6c00dc", 192),
    "ui/inventory": ("7c5c305d874aceee1d3fc17a4eb2f36290bef911c7ac87436d45cae098d476bc", 192),
    "ui/bait": ("f0ea30a14afbf0d837a1fef3ef7e7ab2a822d6a13517ec1167943d9524a0c51f", 192),
    "ui/rankings": ("e237f659a4ee70d31088fa9d508191b25b51c3782274f458be0dd81adafc584a", 192),
    "ui/auto": ("204a3f0d5a7936bce71bdef51c061b16c8ec2cb7dd3e6e211d8b495376aa5441", 192),
    "ui/daily": ("b5a06144f3b3890b276fa999884ca029dd375062493df156cba8110b86233a8c", 192),
    "ui/quests": ("4aa50acb60a2130629aaa39061307b92e27351d52385f50314e7aac00ee35500", 192),
    "ui/pass": ("1701116a1324139c1c65162af23423de2af6a4b3c72820a1dc5f5abb0d184bdf", 192),
    "ui/guild": ("c2e6360e77d9fbe087d91c0815088b0d50a8539d0016729bd59368ad0b9677b3", 192),
    "ui/crew": ("2e1a6669ace113c83f7362be2b894ff046b73bc1ebbcff2cc4dda0813b0844d4", 192),
    "ui/banner": ("9a0a705419cb2c9f5eaa30298ad3996d180a7eee0cea40fa7cd8e83a803cd232", 900),
    "items/star_lure": ("339f1427460c22f67b1aef5959411496470f1be2bcf1330f6b60d0822f1f43a7", 128),
    "items/stamina_potion": ("f16895545ea12d85076f9ecb9043d13f92f01cfd7f776f8bd9d114e726ac0761", 128),
    "items/glow_shrimp": ("a879fb45b16b1e36f1f2e530ca3fa72f966f1e238cb3f2317c54bac8798652fd", 128),
    "items/enhance_stone": ("c292c48cec327d8e8dad5b248a849fcd3d98daddedb026fa94b7325bc472a265", 128),
    "items/worm": ("ce1c2121b52761f1bc0a92c8538d6cc483641b87fa83e3720344ef1245717c05", 128),
    "items/protection_scroll": ("0c2dc2b88c3e72faedc3ac51f82f21ff8ee7a72d96cb5bce9ee96d114d44e628", 128),
}


def strip_border_white(path):
    im = Image.open(path).convert("RGBA"); a = np.array(im)
    white = (a[..., :3].min(2) > 200) | (a[..., 3] == 0)
    lab, _ = ndimage.label(white)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    a[np.isin(lab, list(border)), 3] = 0
    out = Image.fromarray(a); out.crop(out.getbbox()).save(path)


if __name__ == "__main__":
    for d in ["ui", "items", "fish/icons"]:
        os.makedirs(ART + d, exist_ok=True)
    for name, (h, side) in ITEMS.items():
        green_key(B + h + ".jpeg", name, side)
        if name.startswith(("ui/", "items/")):
            strip_border_white(ART + name + ".png")
    bg = Image.open(io.BytesIO(urllib.request.urlopen(B + "3ce51af0a0bea9a08123f1bcb811f698b7b105ee1d5c6490a271204087c19dfd.jpeg").read())).convert("RGB")
    bg.save(ART + "crystal_lagoon.jpg", quality=90)
    bg.save(ART + "landing.jpg", quality=88)
    for f in os.listdir(ART + "fish"):
        if f.endswith(".png"):
            im = Image.open(ART + "fish/" + f); im.thumbnail((256, 256), Image.LANCZOS)
            im.save(ART + "fish/icons/" + f.replace(".png", ".webp"), "WEBP", quality=88)
    print("done", bg.size)
