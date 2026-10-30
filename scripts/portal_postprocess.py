import json, re, sys, os
from PIL import Image

BRIDGE = '<script src="https://bridge.playgama.com/v1/stable/playgama-bridge.js"></script>'


def html(root, gd_id):
    p = os.path.join(root, "index.html")
    s = open(p).read()
    s = re.sub(r'<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>', "", s)
    s = re.sub(r'<script src="https://assets\.emergent\.sh[^"]*"></script>', "", s)
    s = re.sub(r'<script>(?:(?!</script>).)*posthog(?:(?!</script>).)*</script>', "", s, flags=re.S)
    s = re.sub(r'<a[^>]*emergent[^>]*>.*?</a>', "", s, flags=re.S)
    s = s.replace("<head>", "<head>" + BRIDGE, 1)
    open(p, "w").write(s)
    left = re.findall(r'https?://[^"\' )]+', s)
    print("external refs left in index.html:", [u for u in left if "playgama" not in u])
    cfg = {
        "$schema": "https://bridge.playgama.com/v1/stable/schema.json",
        "platforms": {"game_distribution": {"gameId": gd_id}},
        "advertisement": {"interstitial": {"preloadOnStart": True, "minimumDelayBetweenInterstitial": 120}},
    }
    json.dump(cfg, open(os.path.join(root, "playgama-bridge-config.json"), "w"), indent=2)
    for dp, _, fs in os.walk(root):
        for f in fs:
            if not re.fullmatch(r"[A-Za-z0-9._\-]+", f):
                print("NON-LATIN FILENAME:", os.path.join(dp, f))


def thumbs(out):
    bg = Image.open("/app/frontend/public/art/landing.jpg").convert("RGB")
    logo = Image.open("/app/frontend/public/art/logo.png").convert("RGBA")
    os.makedirs(os.path.join(out, "thumbnails"), exist_ok=True)
    for w, h in [(512, 512), (512, 384), (200, 120)]:
        sc = max(w / bg.width, h / bg.height)
        im = bg.resize((int(bg.width * sc) + 1, int(bg.height * sc) + 1), Image.LANCZOS)
        x = (im.width - w) // 2
        im = im.crop((x, (im.height - h) // 2, x + w, (im.height - h) // 2 + h)).convert("RGBA")
        lg = logo.copy()
        lg.thumbnail((int(w * 0.62), int(h * 0.5)), Image.LANCZOS)
        im.alpha_composite(lg, ((w - lg.width) // 2, h - lg.height - int(h * 0.06)))
        im.convert("RGB").save(os.path.join(out, "thumbnails", f"thumb_{w}x{h}.jpg"), quality=92)
    print("thumbnails written")


if __name__ == "__main__":
    if sys.argv[1] == "--thumbs":
        thumbs(sys.argv[2])
    else:
        html(sys.argv[1], sys.argv[2])
