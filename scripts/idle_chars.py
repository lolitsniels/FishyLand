"""Cut the relaxed-arm character portraits (character picker) out of their white backgrounds."""
import io, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from rembg import remove, new_session

B = "https://static.prod-images.emergentagent.com/jobs/17f69698-5e8d-4d75-85c3-475aadbaaadb/images/"
H = {
    "f_0_0": "14b77178b3e2bf63b00dead31857b076d7f01c6e43aa31c173bf772fdf934e6f", "m_0_0": "6faaedcdc3a600b7500a024a3c9471d2832654ea6c28e8764e89d1c3d47dd305",
    "f_2_0": "6415810caf55d41d21dec57951dee96ac1e83421ed39895c4315a86bf9839455", "f_1_2": "2a96edfd0f522dadb80ba47ba7d10e240086a311fce28c228e8d7053145d880b",
    "f_1_0": "fade8fb7bd643c770032304f4898ad4b998c47284b972cc1776111f9e30951bb", "f_0_1": "a6640b492f51efc7cf46ddc9d74b5849249137d5b597ea2a0a5a7171e1db1fb3",
    "f_0_4": "51225d796e61f4b3d16ad935dc11f56836062b5d82fd907fb2dae205a2cc170b", "f_1_1": "9d368e5ec44fa58ee89103409c10a914aa187492270f13f2966713e9f93d0b98",
    "f_0_3": "97c8ab29afc0848a86c4347b82b8f0526349a5344c97b2337dd1f5f14cc8f7d3", "f_1_3": "7aa9c1b7170cfc79a8315307b14dd158e61337bb5badc95595b06b3eee45e4e0",
    "f_0_2": "b0ab7c807d88e929c518108b13fdc38b2c3e118268b31b134486eda57765d397", "f_1_4": "0b2bc61147ce144becd3a68d5e004f900db86e894503ac0f6c1ecde8d30140f8",
    "f_3_2": "7b36e8886c448ab84c044e65f2430cc80afb346abedf42a098144e7186b3300f", "f_3_4": "e35afb622030bd3a64e9e461423fd2ac7b135c2afe1c1f5fe84d0a05205313e4",
    "f_2_4": "e6f28a16cc595e00ca0bdbe3f99377bc06285fa931d367faa30d6bb99ddaa053", "f_2_1": "87a9efae773d0d46aab5ce28eb1277df2a6b028892c5d8b298596a547fa8651e",
    "f_2_3": "ace1568e66c5cec54aa3c42d0dd78d4a42986cd35ad59b547f0d83dd8b707646", "f_3_0": "4e2ea5cf449539fb2f5a442caa7fe32e291e5105c722f79d74240c1fe18039e4",
    "f_2_2": "b5f06a56eac3c6244e1f77c27729adc92c2624e7f17037108c456c9c06ab5381", "m_0_1": "fd1ff9306c12383a64826310c348d02e41d664a48e00ebab9e05ecc9fa1561a9",
    "f_3_3": "4266efb0a7e3274a4f1cf5f9aec9753f7d82166d24f837ebb20bc060c11f522c", "f_3_1": "aed23a5054e0df327e5870c330290bb084fb67f681cd0e7706a571dc3619982a",
    "m_1_0": "760e94c36691d6744a5fcac02b2655e1cf31a138580a090da69f3621971c0044", "m_1_1": "82c9cc220b7f141fa329fee4fee0f18d738b68cea3bd66784f78b572f712d984",
    "m_2_1": "f3dd5b0768a0c1086d706369e5d89e4f3f9c34dbc404e1b6d4e8808f4ff82ea3", "m_0_2": "f5ef3bc59c57bb4aec5006a0110eb1d7afb24d8cac56ca4d5318222b23c02c58",
    "m_2_0": "e840e396f0886120f59fdd72a0f7e7b71ed56b62394df763ae9bb9ed4e92fb9e", "m_1_4": "16433e79e22519ee09aa1b1ea354c8e50eafb22506b6c3ae4614a3f9c2041731",
    "m_0_3": "73cb42db2d7f0e0d71f209f7be69c2aa978094c7f55f3ddd97163bf8ec985264", "m_1_3": "18db6232c5bff6105e1e9fc589bc0699d41e09f196cbb7bcb751486e6743c442",
    "m_1_2": "a4a59bff1f07c4dcfd20c5858020ecadd92f53fd9bbb62b151d989f0f6ffd201", "m_0_4": "63402c39088d0c6988c7152b1f3ebb2a68cb86aa598030b1f824b9754e2227af",
    "m_2_3": "1984026245cb258a14cddd1e8c6bed366a29a9bf98e3e48acdfabd3c82bd6df1", "m_3_3": "4f0c0cb532ef700a46ddde08aa65bfd9d22b123c4c9e48ba382f916f647153f1",
    "m_3_2": "350b16a566a7bcf3841e18b97fbd8b5a5bbabc91027116ef5e94d979347c6814", "m_2_2": "59460db789d9dab30d7a19a7b589664bf721c059d3f3b7eea331565a1777f1f0",
    "m_2_4": "eb9d919d88ece35d78e8874784c6daa3eb79f9b3b137c85e3ae351bc4586b024", "m_3_0": "ba8160d6ae4bb404249af4b3b361b177db97f9b035f7190201e0e35ded552757",
    "m_3_4": "e7005fedad914830283051c5f8fef5b522f4e112028c0ee6c48836c3234c3f99", "m_3_1": "9efb17cf7bb453c051bbf0b4d81d5ef2cb5da8af1050eec1f586fca79e72745d",
}
OUT = "/app/frontend/public/art/chars/idle_"
S = new_session("isnet-general-use")


def fetch(k):
    return k, Image.open(io.BytesIO(urllib.request.urlopen(B + H[k] + ".jpeg").read())).convert("RGB")


with ThreadPoolExecutor(8) as ex:
    imgs = list(ex.map(fetch, H))
for k, im in imgs:
    cut = remove(im, session=S, post_process_mask=True)
    cut = cut.crop(cut.getbbox())
    cut.thumbnail((400, 640))
    cut.save(OUT + k + ".webp", quality=88)
print("done", len(imgs))
