// Iteration 28 extra seed (after pg_seed.js): contracts total 9, sold 99, d_cast daily at 0/1, story done through tide_tables, level 15. Evaluate in page, then reload.
async () => {
  const r = await window.bridge.storage.get(['fishyland_save']);
  const v = Array.isArray(r) ? r[0] : r;
  const d = typeof v === 'string' ? JSON.parse(v) : JSON.parse(JSON.stringify(v));
  const xpFor = (l) => Math.floor(80 * l ** 1.55);
  let xp = 0; for (let l = 1; l < 15; l++) xp += xpFor(l);
  d.user.xp = xp + 10;
  d.user.stats.sold = 99;
  d.user.pearls = 30;
  d.h.contracts.total = 9;
  d.h.ach = Array.from(new Set([...(d.h.ach || []), 'first_catch', 'level_10']));
  const ids = ['casting_off', 'millers_complaint', 'fair_price', 'down_the_willow', 'river_colours', 'something_in_reeds', 'missing_catch', 'night_watch', 'salt_on_wind', 'tide_tables'];
  d.h.story = {}; ids.forEach((id) => { d.h.story[id] = { status: 'done', progress: 1, done_at: new Date().toISOString() }; });
  if (d.h.daily) {
    d.h.daily.quests = d.h.daily.quests.filter((q) => q.id !== 'd_cast');
    d.h.daily.quests.push({ id: 'd_cast', kind: 'daily', name: 'Patience', desc: 'Cast your line 1 times.', story: null, event: 'cast', measure: null, filter: {}, reward: { gold: 100, xp: 50, pearls: 1 }, progress: 0, target: 1, status: 'active', done_at: null });
  }
  await window.bridge.storage.set(['fishyland_save'], [JSON.stringify(d)]);
  return { xp: d.user.xp, daily: d.h.daily && d.h.daily.quests.map((q) => q.id) };
}
