// Iteration 28 seed B (after daily rolled): d_cast Patience at 0/1, sold 99, gold 9990, 30 pearls, 2 extra minnows. Evaluate in page, then reload.
async () => {
  const r = await window.bridge.storage.get(['fishyland_save']);
  const v = Array.isArray(r) ? r[0] : r;
  const d = typeof v === 'string' ? JSON.parse(v) : JSON.parse(JSON.stringify(v));
  const now = new Date().toISOString();
  const fish = (id) => ({ id, user_id: 'offline', username: 'Angler', species_id: 4, name: 'Fathead Minnow', rarity: 'common', weight: 0.02, length_cm: 5, variant: 'normal', value: 3, water: 'millbrook', caught_at: now, listed: false, mounted: false });
  d.catches = [fish('c951'), fish('c952')]; d.seq = 2000;
  d.user.stats.sold = 99; d.user.gold = 9990; d.user.pearls = 30; d.user.energy = 100;
  d.user.tutorial = { step: 10, done: true, rewarded: true };
  d.h.ach = Array.from(new Set([...(d.h.ach || []), 'first_catch']));
  d.h.daily.quests = d.h.daily.quests.filter((q) => q.id !== 'd_cast').slice(0, 2);
  d.h.daily.quests.push({ id: 'd_cast', kind: 'daily', name: 'Patience', desc: 'Cast your line 1 times.', story: null, event: 'cast', measure: null, filter: {}, reward: { gold: 100, xp: 50, pearls: 1 }, progress: 0, target: 1, status: 'active', done_at: null });
  await window.bridge.storage.set(['fishyland_save'], [JSON.stringify(d)]);
  return { daily: d.h.daily.quests.map((q) => q.id) };
}
