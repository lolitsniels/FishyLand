# helpers for offline harbour buildings tests (exec'd inside browser_automation scripts after pg_helpers)
SPOTS = {"shop": (1160, 1000), "boat": (3260, 1665), "quests": (1830, 1215), "achievements": (2440, 1000),
         "pearl-shop": (2120, 1640), "contracts": (900, 1640), "almanac": (800, 1000)}
PAGE_ID = {"shop": "shop-page", "boat": "waters-page", "quests": "quests-page", "achievements": "achievements-page",
           "pearl-shop": "pearl-shop-page", "contracts": "contracts-page", "almanac": "almanac-page"}

async def boot(page):
    try:
        await page.wait_for_selector('[data-testid=map-loading]', state='attached', timeout=15000)
        await page.wait_for_selector('[data-testid=map-loading]', state='detached', timeout=30000)
    except Exception as e:
        print("loading wait:", str(e)[:80])
    await page.wait_for_timeout(1500)

async def skip_tut(page):
    sk = page.locator('[data-testid=tutorial-skip], [data-testid=tutorial-skip-button]')
    if await sk.count():
        await sk.first.click(); await page.wait_for_timeout(800)

async def close_page(page):
    await page.keyboard.press("Escape"); await page.wait_for_timeout(700)

async def open_spot(page, sid):
    x, y = SPOTS[sid]
    await page.evaluate(f"()=>{{__fx.dest=null; __fx.path=null; __fx.me.x={x}; __fx.me.y={y + 30};}}")
    await page.wait_for_timeout(900)
    p = page.locator('[data-testid=spot-prompt]')
    label = (await p.inner_text()) if await p.count() else None
    if label:
        await p.click()
    else:
        await page.evaluate(f"()=>__fx.openSpot('{sid}')")
    await page.wait_for_timeout(1500)
    ok = await page.locator(f'[data-testid={PAGE_ID[sid]}]').count()
    return label, ok
