import asyncio
import json
import time
import urllib.request

from playwright.async_api import async_playwright

URL = "https://fishing-realm--7ct8rsry.preview.emergentagent.com"
OUT = "/app/trailer/shots"
HIDE = "[data-testid^=tutorial], [data-testid^=starter], [data-testid=walk-hint], [data-testid=chat-box], .fr-tut, [data-testid=world-tutorial] { display: none !important; }"


def api(path, body=None, token=None):
    req = urllib.request.Request("http://localhost:8001/api" + path, data=json.dumps(body or {}).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if token else {})})
    return json.loads(urllib.request.urlopen(req).read())


async def shot(page, name):
    await page.screenshot(path=f"{OUT}/{name}.png")
    print("shot", name, flush=True)


async def open_game(ctx, token, mode):
    page = await ctx.new_page()
    await page.goto(URL + "/")
    await page.evaluate(f"() => {{ localStorage.setItem('owo_token', '{token}'); sessionStorage.setItem('fr_mode', '{mode}'); }}")
    await page.goto(URL + "/game")
    await page.add_style_tag(content=HIDE)
    await page.wait_for_timeout(9000)
    await page.add_style_tag(content=HIDE)
    return page


async def fight(page, prefix):
    # walk to a spot and cast
    async def win(route):
        body = json.loads(route.request.post_data or "{}")
        body["success"] = True
        await route.continue_(post_data=json.dumps(body))
    await page.route("**/api/fish/land", win)
    await page.mouse.click(1671, 533)
    await page.wait_for_timeout(20000)
    await page.mouse.click(1231, 606)
    await page.wait_for_timeout(10000)
    await shot(page, "debug_walk")
    t0 = time.time()
    while time.time() - t0 < 160:
        if await page.locator('[data-testid="tension-game"]').count():
            break
        lab = (await page.locator('.fish-btn-label').inner_text()).strip()
        print("label", lab, flush=True)
        if await page.locator('[data-testid="cast-fish-button"]').is_enabled():
            await page.click('[data-testid="cast-fish-button"]', force=True)
        await page.wait_for_timeout(4000)
    if not await page.locator('[data-testid="tension-game"]').count():
        print("no fight"); return
    await shot(page, f"{prefix}_hook")
    btn = await page.locator('[data-testid="reel-button"]').bounding_box()
    cx, cy = btn["x"] + btn["width"] / 2, btn["y"] + btn["height"] / 2
    await page.mouse.move(cx, cy)
    held, n, t0 = False, 0, time.time()
    while time.time() - t0 < 150:
        if not await page.locator('[data-testid="tension-game"]').count():
            break
        try:
            pos = await page.evaluate("() => parseFloat(document.querySelector('[data-testid=tension-needle]').style.left)")
        except Exception:
            break
        want = pos < 51
        if want and not held:
            await page.mouse.down(); held = True
        elif not want and held:
            await page.mouse.up(); held = False
        if n % 45 == 0 and n // 45 < 6:
            await page.screenshot(path=f"{OUT}/{prefix}_f{n // 45:02d}.jpg", type="jpeg", quality=90)
        n += 1
        await page.wait_for_timeout(60)
    if held:
        await page.mouse.up()
    for k in range(6):
        await page.wait_for_timeout(700)
        await shot(page, f"{prefix}_card{k}")


async def main():
    tok = api("/auth/login", {"username": "TestAngler", "password": "Angler#2026"})["token"]
    guest = open("/app/trailer/guest.tok").read().strip() if __import__("os").path.exists("/app/trailer/guest.tok") else api("/auth/guest", {})["token"]
    open("/app/trailer/guest.tok", "w").write(guest)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        if "--fight" not in __import__("sys").argv:
            await harbour(ctx, tok)
        page = await open_game(ctx, guest, "water")
        await shot(page, "water_a")
        await fight(page, "mythic")
        await page.close()
        await b.close()


async def harbour(ctx, tok):
    if True:
        page = await open_game(ctx, tok, "harbour")
        await shot(page, "harbour_a")
        for i in range(5):
            await page.mouse.click(1750, 640); await page.wait_for_timeout(1500)
        await shot(page, "harbour_b")
        for path, name in [("/game/waters", "map"), ("/game/journal", "fishdex"), ("/game/crews", "crews"), ("/game/shop", "shop")]:
            await page.evaluate(f"() => {{ window.history.pushState({{}}, '', '{path}'); window.dispatchEvent(new PopStateEvent('popstate')); }}")
            await page.wait_for_timeout(3500)
            await shot(page, name)
        await page.close()


asyncio.run(main())
