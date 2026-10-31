# helpers for offline playgama build tests (exec'd inside browser_automation scripts)
BOT = open('/app/tests/pg_bot.js').read()

async def tut(page):
    c = page.locator('[data-testid="tutorial-card"]')
    return (await c.inner_text()).replace("\n", " | ")[:160] if await c.count() else None

async def hud(page):
    return await page.evaluate("""()=>({gold: document.querySelector('[data-testid=gold-value]')?.innerText,
      energy: document.querySelector('[data-testid=energy-value]')?.innerText,
      xp: [...document.querySelectorAll('[data-testid=xp-bar] *')].map(e=>e.style.width).filter(Boolean).join(','),
      lvl: document.querySelector('[data-testid=player-level]')?.innerText})""")

async def to_millbrook(page):
    await page.click('[data-testid="menu-waters"]', force=True); await page.wait_for_timeout(1500)
    await page.click('[data-testid="map-pin-millbrook"]', force=True); await page.wait_for_timeout(800)
    await page.click('[data-testid="map-fish-here"]', force=True); await page.wait_for_timeout(6000)

async def fish_once(page):
    await page.evaluate("()=>{__fx.me.x=1520; __fx.me.y=1065;}")
    await page.wait_for_timeout(1200)
    await page.evaluate(BOT)
    await page.click('[data-testid="cast-fish-button"]', force=True)
    for i in range(50):
        await page.wait_for_timeout(1000)
        if await page.locator('[data-testid="catch-popup"]').count():
            return "caught"
        msg = await page.evaluate("()=>document.body.innerText")
        if i > 3 and await page.locator('[data-testid="cast-fish-button"]:not([disabled])').count() and not await page.locator('[data-testid="tension-needle"]').count():
            if 'got away' in msg or 'Nothing' in msg or 'nothing' in msg or 'snapped' in msg or 'slack' in msg or 'outlasted' in msg or 'untouched' in msg or 'drifts' in msg or 'Ripples' in msg:
                return "miss"
    return "timeout"

async def fish_until_catch(page, tries=6):
    for t in range(tries):
        r = await fish_once(page)
        print("  cast", t, r)
        if r == "caught":
            return True
        await page.wait_for_timeout(1500)
    return False
