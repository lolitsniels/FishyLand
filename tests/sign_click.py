# Click each harbour signboard on the canvas using the Scene camera formula (sc=1.1 at 1920x1080) and check its page opens
SIGNS = [("contracts", "Anchor Café · Contracts", 900, 1640), ("crews", "Crew HQ", 2000, 1010),
         ("market", "Market", 1560, 1000), ("pearl-shop", "Pearl Shop", 2120, 1640), ("shop", "Tackle Shop", 1160, 1000)]

async def click_sign(page, sid, label, x, y, sc=1.1):
    mx, my = x + 140, y + 40
    await page.evaluate(f"()=>{{__fx.dest=null;__fx.path=[];__fx.autoOpen=null;__fx.me.x={mx};__fx.me.y={my};}}")
    await page.wait_for_timeout(2500)
    sw, sh = await page.evaluate("()=>[innerWidth, innerHeight]")
    sx = sw / 2 + (x - mx) * sc
    sy = sh * 0.55 + ((y - 30) - (my - 60)) * sc
    await page.mouse.click(sx, sy)
    try:
        await page.wait_for_url(f"**/game/{sid}**", timeout=8000)
        ok = True
    except Exception:
        ok = False
    print(f"SIGN {label}: click=({round(sx)},{round(sy)}) url={page.url} opened={ok}")
    return ok
