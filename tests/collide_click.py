# click-to-walk helpers: calibrate world<->screen with two taps, then tap a world point
async def calib(page):
    pts = []
    for sx, sy in [(700, 300), (1300, 520)]:
        await page.evaluate("()=>{__fx.path=[]; __fx.dest=null;}")
        await page.mouse.click(sx, sy)
        await page.wait_for_timeout(60)
        w = await page.evaluate("()=>{const p=__fx.path||[]; const t=p.length?p[p.length-1]:__fx.dest; const r=t?{x:t.x,y:t.y}:null; __fx.path=[]; __fx.dest=null; return r;}")
        pts.append(((sx, sy), w))
    (a, wa), (b, wb) = pts
    if not wa or not wb:
        return None
    k = (b[0] - a[0]) / (wb["x"] - wa["x"])
    return {"k": k, "ox": a[0] - wa["x"] * k, "oy": a[1] - wa["y"] * k}

def to_screen(c, x, y):
    return c["ox"] + x * c["k"], c["oy"] + y * c["k"]

async def tap_world(page, c, x, y):
    sx, sy = to_screen(c, x, y)
    await page.mouse.click(sx, sy)
    await page.wait_for_timeout(50)
    return await page.evaluate("()=>({dest:__fx.dest, n:(__fx.path||[]).length})")
