// Seeds an offline save: Casting Off 2/3, 2 Bluegill + 1 minnow in keepnet, contracts (1x Bluegill ready, 5x Bluegill short), 10 pearls. Evaluate in page, then reload.
async () => {
  const r = await window.bridge.storage.get(['fishyland_save']);
  const v = Array.isArray(r) ? r[0] : r;
  const d = typeof v === 'string' ? JSON.parse(v) : JSON.parse(JSON.stringify(v));
  const now = new Date().toISOString();
  const fish = (id, sid, name, w) => ({ id, user_id: 'offline', username: 'Angler', species_id: sid, name, rarity: 'common', weight: w, length_cm: 20, variant: 'normal', value: 7, water: 'millbrook', caught_at: now, listed: false, mounted: false });
  d.catches = [fish('c901', 1, 'Bluegill', 0.2), fish('c902', 1, 'Bluegill', 0.25), fish('c903', 4, 'Fathead Minnow', 0.02)];
  d.seq = 1000;
  d.user.pearls = 10; d.user.tutorial = { step: 10, done: true, rewarded: true };
  d.h = d.h || { story: {}, daily: null, weekly: null, ach: [], contracts: { offers: [], accepted: [], day: null, done_today: 0, favour: {} }, done: 0 };
  d.h.story = { casting_off: { status: 'active', progress: 2 } };
  const base = d.h.contracts.offers[0];
  d.h.contracts.accepted = [
    { ...base, id: 'kseed1', species_id: 1, species_name: 'Bluegill', qty: 1, target: 1, text: 'Deliver 1× Bluegill', status: 'accepted', accepted_at: now, gold: 50, xp: 20, pearls: 1 },
    { ...base, id: 'kseed5', species_id: 1, species_name: 'Bluegill', qty: 5, target: 5, text: 'Deliver 5× Bluegill', status: 'accepted', accepted_at: now },
  ];
  await window.bridge.storage.set(['fishyland_save'], [JSON.stringify(d)]);
  return { gold: d.user.gold, offers: d.h.contracts.offers.length };
}
