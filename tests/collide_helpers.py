# helpers for building-collision tests on the online preview (exec'd inside browser_automation with g=globals())
import json, urllib.request
BASE = "https://fishing-realm--7ct8rsry.preview.emergentagent.com"

def get_token():
    req = urllib.request.Request(BASE + "/api/auth/login", data=json.dumps({"username": "TestAngler", "password": "Angler#2026"}).encode(), headers={"Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req).read())
    return d.get("token") or d.get("access_token")

async def boot(page, mode="harbour"):
    await page.goto(BASE + "/")
    tok = await page.evaluate("""async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'TestAngler',password:'Angler#2026'})});const d=await r.json();return d.token||d.access_token||JSON.stringify(d).slice(0,200);}""")
    print("token", str(tok)[:20])
    await page.evaluate(f"()=>{{localStorage.setItem('owo_token','{tok}'); sessionStorage.setItem('fr_mode','{mode}');}}")
    await page.goto(BASE + "/game")
    try:
        await page.wait_for_selector('[data-testid=map-loading]', state='attached', timeout=15000)
        await page.wait_for_selector('[data-testid=map-loading]', state='detached', timeout=40000)
    except Exception as e:
        print("loading wait:", str(e)[:80])
    await page.wait_for_timeout(2500)
    sk = page.locator('[data-testid=tutorial-skip], [data-testid=tutorial-skip-button]')
    if await sk.count():
        await sk.first.click(); await page.wait_for_timeout(800)

async def push(page, x, y, key, ms=2500):
    await page.evaluate(f"()=>{{__fx.dest=null; __fx.path=[]; __fx.me.x={x}; __fx.me.y={y};}}")
    await page.wait_for_timeout(300)
    await page.keyboard.down(key); await page.wait_for_timeout(ms); await page.keyboard.up(key)
    await page.wait_for_timeout(300)
    return await page.evaluate("()=>({x:Math.round(__fx.me.x),y:Math.round(__fx.me.y)})")

async def probe(page, name, bx, by, w, fh):
    # from front (below, walk up), back (above, walk down), left (walk right), right (walk left)
    depth = w * fh
    tests = {"front": (bx, by + 160, "w"), "back": (bx, by - depth - 140, "s"),
             "left": (bx - w * 0.5 - 120, by - 40, "d"), "right": (bx + w * 0.5 + 120, by - 40, "a")}
    res = {}
    for side, (x, y, k) in tests.items():
        p = await push(page, x, y, k)
        inside = (bx - w * 0.38 < p["x"] < bx + w * 0.38) and (by - depth * 0.85 < p["y"] < by - 4)
        res[side] = (p, "INSIDE" if inside else "ok")
    print(name, res)
    return res
