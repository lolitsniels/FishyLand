# Seeded-save setup for offline harbour tests (exec after pg_helpers + pg_harbour). Fresh context -> contracts rolled -> seed (pg_seed.js) -> reload.
OBS = open('/app/tests/pg_obs.js').read()
SEED = open('/app/tests/pg_seed.js').read()
GETSAVE = "async()=>{const r=await bridge.storage.get(['fishyland_save']);const v=Array.isArray(r)?r[0]:r;const d=typeof v==='string'?JSON.parse(v):v;return {story:d.h&&d.h.story, daily:d.h&&d.h.daily&&d.h.daily.quests.map(q=>q.id+':'+q.progress+'/'+q.target+':'+q.status), pearls:d.user.pearls, gold:d.user.gold, catches:d.catches.map(c=>c.name), ach:d.h&&d.h.ach, cos:d.user.cos, colour:d.user.name_colour, frame:d.user.frame, accepted:d.h&&d.h.contracts.accepted.map(k=>k.id+':'+(k.progress||0)+'/'+k.qty), total:d.h&&d.h.contracts.total}}"

async def seeded(page):
    await boot(page)
    await skip_tut(page)
    await open_spot(page, "contracts")
    await page.click('[data-testid=modal-close-btn]', force=True); await page.wait_for_timeout(800)
    await to_millbrook(page)
    print("seed:", await page.evaluate(SEED))
    await page.reload(); await boot(page)
    await page.evaluate(OBS)
