import asyncio
import json
import sys
import urllib.request

from PIL import Image
from playwright.async_api import async_playwright

URL = "https://fishing-realm--7ct8rsry.preview.emergentagent.com"


async def main():
    req = urllib.request.Request("http://localhost:8001/api/auth/login", data=json.dumps({"username": "TestAngler", "password": "Angler#2026"}).encode(), headers={"Content-Type": "application/json"})
    tok = json.loads(urllib.request.urlopen(req).read())["token"]
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--ignore-gpu-blocklist"])
        page = await b.new_page(viewport={"width": 1366, "height": 768}, device_scale_factor=float(sys.argv[1]) if len(sys.argv) > 1 else 1)
        await page.goto(URL + "/")
        await page.evaluate(f"() => {{ localStorage.setItem('owo_token', '{tok}'); sessionStorage.setItem('fr_mode', 'harbour'); }}")
        await page.goto(URL + "/game")
        await page.wait_for_timeout(9000)
        await page.click('[data-testid="menu-more"]', force=True)
        await page.wait_for_timeout(1500)
        bx = await page.locator(".fr-modal").first.bounding_box()
        await page.screenshot(path="/tmp/seam_full.png")
        await b.close()
    im = Image.open("/tmp/seam_full.png")
    s = im.width / 1366
    tl = im.crop((int((bx["x"] - 8) * s), int((bx["y"] - 8) * s), int((bx["x"] + 70) * s), int((bx["y"] + 70) * s)))
    br = im.crop((int((bx["x"] + bx["width"] - 70) * s), int((bx["y"] + bx["height"] - 70) * s), int((bx["x"] + bx["width"] + 8) * s), int((bx["y"] + bx["height"] + 8) * s)))
    out = Image.new("RGB", (tl.width * 2, tl.height))
    out.paste(tl, (0, 0)); out.paste(br, (tl.width, 0))
    out.resize((out.width * 5, out.height * 5), Image.NEAREST).save("/tmp/seam.png")


asyncio.run(main())
