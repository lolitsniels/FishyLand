// Offline harbour buildings: story/daily/weekly quests, achievements, Pearl Shop, Anchor Café contracts and the Almanac.
import H from "./harbour.json";

const RANK = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const weekKey = (d = new Date()) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return dayKey(t); };
const seeded = (s) => { let x = [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 9); return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); };
const endOf = (days) => { const t = new Date(); t.setUTCHours(24, 0, 0, 0); t.setUTCDate(t.getUTCDate() + days - 1); return t.toISOString(); };

export function makeHarbour(ctx) {
  const { S, U, pub, save, levelOf, WATERS, BY_WATER, WATER, FISH } = ctx;
  const st = () => (S().h = S().h || { story: {}, daily: null, weekly: null, ach: [], contracts: { offers: [], accepted: [], day: null, done_today: 0, favour: {} }, done: 0 });
  const lvl = () => levelOf(U().xp)[0];
  const grant = (r) => { const u = U(); u.gold += r.gold || 0; u.xp += r.xp || 0; u.pearls += r.pearls || 0; };

  // ---- quests
  const DAILY = [["d_catch", "Busy Lines", "Land {n} fish anywhere.", "catch", [8, 12, 15], 1, {}],
    ["d_water", "Local Waters", "Land {n} fish at {w}.", "catch", [5, 8], 1.1, { water: 1 }], ["d_uncommon", "Better Stock", "Land {n} uncommon-or-better fish.", "catch", [3, 5], 1.2, { min_rarity: "uncommon" }],
    ["d_sell", "Market Day", "Sell {n} fish to the vendor.", "sell", [5, 10], 1, {}], ["d_cast", "Patience", "Cast your line {n} times.", "cast", [15, 25], 0.8, {}],
    ["d_contract", "Honest Work", "Fill a harbour contract for one of the dockside patrons.", "contract", [1], 1.2, {}], ["d_rare", "Something Special", "Land a rare-or-better fish.", "catch", [1], 1.5, { min_rarity: "rare" }]];
  const WEEKLY = [["w_catch", "Long Week on the Water", "Land {n} fish this week.", "catch", [50, 75], 1, {}], ["w_rare", "Rare Haul", "Land {n} rare-or-better fish.", "catch", [4, 6], 1.3, { min_rarity: "rare" }],
    ["w_water", "Far Waters", "Land {n} fish at {w}.", "catch", [25], 1.15, { water: 1 }], ["w_gold", "Coin Purse", "Earn {n} gold selling fish.", "sell", [0], 1, {}, "gold"]];
  function roll(kind) {
    const h = st(), key = kind === "daily" ? dayKey() : weekKey();
    if (h[kind]?.period === key) return h[kind];
    const r = seeded(key + kind), open = U().unlocked_waters, w = WATER[open[Math.floor(r() * open.length)]], L = lvl();
    const pool = (kind === "daily" ? DAILY : WEEKLY).slice().sort(() => r() - 0.5).slice(0, kind === "daily" ? 3 : 2);
    const quests = pool.map(([id, name, desc, event, ns, mult, flt, measure]) => {
      const n = measure === "gold" ? Math.round((300 + L * 60) / 10) * 10 : ns[Math.floor(r() * ns.length)];
      const base = kind === "daily" ? 1 : 4;
      return { id, kind, name, desc: desc.replace("{n}", n).replace("{w}", w.name), story: null, event, measure: measure || null, filter: { ...flt, ...(flt.water ? { water: w.key } : {}) },
        reward: { gold: Math.round((50 + L * 10) * mult * base), xp: Math.round((25 + L * 5) * mult * base), pearls: kind === "weekly" ? 3 : 1 }, progress: 0, target: n, status: "active", done_at: null };
    });
    h[kind] = { period: key, ends_at: endOf(kind === "daily" ? 1 : 7 - ((new Date().getUTCDay() + 6) % 7)), quests };
    return h[kind];
  }
  const storyStatus = (q, i) => {
    const s = st().story[q.id];
    if (s?.status === "done" || s?.status === "active") return s.status;
    const prev = i === 0 || st().story[H.story[i - 1].id]?.status === "done";
    return !prev ? "locked" : lvl() < q.level ? "level_locked" : "available";
  };
  const storyOut = () => H.story.map((q, i) => ({ id: q.id, kind: "story", name: q.name, level: q.level, story: q.story, desc: q.desc, reward: q.reward, target: q.target,
    progress: Math.min(q.target, st().story[q.id]?.progress || 0), status: storyStatus(q, i), done_at: st().story[q.id]?.done_at || null }));
  const questsOut = () => ({ guest: [], story: storyOut(), daily: roll("daily"), weekly: roll("weekly"), streak: { count: 0, today_done: false, days: 7, bonus: { gold: 0, xp: 0, pearls: 0 } }, completed: st().done });
  const matches = (flt, e) => (!flt.water || flt.water === e.water) && (!flt.min_rarity || RANK.indexOf(e.rarity) >= RANK.indexOf(flt.min_rarity))
    && (!flt.min_kg || e.weight >= flt.min_kg) && (!flt.new_species || e.first) && (!flt.variant || flt.variant === e.variant) && (!flt.period || flt.period === e.period);
  function advance(q, ev, e, amount) {
    if (q.status !== "active" || (q.event || q.objective?.event) !== ev || !matches(q.filter || q.objective?.filter || {}, e)) return false;
    q.progress = (q.progress || 0) + amount;
    return q.progress >= q.target;
  }
  function event(ev, e = {}) {
    const done = [], amount = (q) => ((q.measure || q.objective?.measure) === "gold" ? e.gold || 0 : (q.measure || q.objective?.measure) === "kg" ? e.weight || 0 : e.count || 1);
    for (const kind of ["daily", "weekly"]) for (const q of roll(kind).quests) if (advance(q, ev, e, amount(q))) { q.status = "done"; q.done_at = new Date().toISOString(); grant(q.reward); done.push({ name: q.name, kind, reward: q.reward }); }
    H.story.forEach((q) => {
      const s = st().story[q.id];
      if (!s || s.status !== "active") return;
      const tmp = { status: "active", objective: q.objective, target: q.target, progress: s.progress || 0 };
      if (advance(tmp, ev, e, amount(tmp))) { s.status = "done"; s.done_at = new Date().toISOString(); grant(q.reward); done.push({ name: q.name, kind: "story", reward: q.reward }); }
      s.progress = tmp.progress;
    });
    st().done += done.length;
    return { quests_done: done, new_achievements: checkAch() };
  }

  // ---- achievements
  function counters() {
    const u = U(), by = u.stats.by_rarity || {};
    return { ...u.stats, level: lvl(), gold: u.gold, waters: u.unlocked_waters.length, rare: by.rare || 0, epic: by.epic || 0, legendary: by.legendary || 0, mythic: by.mythic || 0,
      heaviest: u.stats.heaviest_kg || 0, contracts: st().contracts.total || 0, quests_done: st().done, secret_species: Object.keys(S().journal).filter((id) => FISH[id]?.secret).length };
  }
  function checkAch() {
    const c = counters(), have = new Set(st().ach), fresh = [];
    for (const a of H.achievements) if (!have.has(a.id) && (c[a.key] || 0) >= a.n) { st().ach.push(a.id); U().gold += a.reward; U().pearls += a.pearls || 0; fresh.push({ id: a.id, name: a.name, reward: a.reward, pearls: a.pearls }); }
    return fresh;
  }
  const achOut = () => { const have = new Set(st().ach); return { badges: [], all: H.achievements.map((a) => ({ ...a, unlocked: have.has(a.id) })), titles: [], active_title: null, new: [], user: pub() }; };

  // ---- Pearl Shop (pearls are earned in game, never bought)
  const own = () => (U().cos = U().cos || { avatars: [], colours: [], frames: [], walls: [] });
  const cosOut = () => { const o = own(), u = U(), m = (list, mine, cur) => list.map((x) => ({ ...x, owned: mine.includes(x.id) || x.price === 0 }));
    return { pearls: u.pearls, rename_cost: H.rename_cost, avatar: u.avatar, name_colour: u.name_colour || null, frame: u.frame || null, wall: u.wall || null, friend_slots: { have: 0, used: 0, pack: 0, cost: 0, max: 0 },
      avatars: m(H.cosmetics.avatars, o.avatars), colours: m(H.cosmetics.colours, o.colours), frames: m(H.cosmetics.frames, o.frames), walls: m(H.cosmetics.walls, o.walls) }; };
  function buy(kind, id) {
    const item = H.cosmetics[kind].find((x) => x.id === id), u = U(), o = own();
    if (!item) throw Object.assign(new Error("Unknown item"), { status: 404, detail: "Unknown item" });
    if (!o[kind].includes(id)) {
      if (u.pearls < item.price) throw Object.assign(new Error("x"), { status: 400, detail: `You need ${item.price - u.pearls} more Pearls` });
      u.pearls -= item.price; o[kind].push(id);
    }
    use(kind, id);
  }
  function use(kind, id) { const u = U(); if (kind === "avatars") u.avatar = id; if (kind === "colours") u.name_colour = id || null; if (kind === "frames") u.frame = id || null; if (kind === "walls") u.wall = id || null; save(); return { user: pub() }; }

  // ---- Anchor Café contracts
  const SLOTS = 3, DAILY_CAP = 8;
  function offers() {
    const c = st().contracts, key = dayKey();
    if (c.day !== key) { c.day = key; c.done_today = 0; c.offers = []; c.rerolls = 2; }
    while (c.offers.length < 6) c.offers.push(newOffer(c.offers.length + c.accepted.length + Date.now()));
    return c;
  }
  function newOffer(seed) {
    const r = seeded(String(seed)), open = U().unlocked_waters, w = WATER[open[Math.floor(r() * open.length)]];
    const pool = BY_WATER[w.key].filter((f) => ["common", "uncommon", "rare"].includes(f.rarity) && !f.bait_only), f = pool[Math.floor(r() * pool.length)];
    const p = H.patrons[Math.floor(r() * H.patrons.length)], qty = f.rarity === "rare" ? 1 : f.rarity === "uncommon" ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
    const mult = { common: 1, uncommon: 2.2, rare: 6 }[f.rarity], L = lvl();
    return { id: `k${Math.floor(r() * 1e9)}`, patron: p.id, patron_name: p.name, patron_short: p.short, portrait: p.portrait, kind: "count", species_id: f.id, species_name: f.name, rarity: f.rarity,
      water: w.key, water_name: w.name, qty, target: qty, target_kg: null, min_kg: null, min_rarity: null, tier: 1, special: false, gold: Math.round((20 + L * 4) * qty * mult), xp: Math.round((6 + L) * qty * mult),
      pearls: f.rarity === "rare" ? 1 : 0, favour: 4 * qty, status: "offered", progress: 0, text: `Deliver ${qty}× ${f.name}`, flavour: `${p.short} wants ${p.wants}.`, expires_at: endOf(1), deadline: endOf(1), accepted_at: null, done_at: null, delivered: [], paid_gold: null };
  }
  const have = (k) => { const n = S().catches.filter((x) => x.species_id === k.species_id).length; return { count: n, kg: 0, ready: n >= k.qty - (k.progress || 0) }; };
  function contractsOut() {
    const c = offers(), favour = (id) => c.favour[id] || 0;
    const rankOf = (f) => [0, 100, 300, 700, 1500].filter((x) => f >= x).length;
    const ranks = ["Stranger", "Acquaintance", "Trusted", "Friend", "Confidant"];
    return { patrons: H.patrons.map((p) => { const f = favour(p.id), rk = rankOf(f); return { ...p, favour: f, rank: rk, rank_name: ranks[rk - 1], rank_at: [0, 100, 300, 700, 1500][rk - 1], next_at: [100, 300, 700, 1500, null][rk - 1], perks: [], milestones: [] }; }),
      accepted: c.accepted.map((k) => ({ ...k, have: have(k), on_market: 0 })), offers: c.offers.map((k) => ({ ...k, have: have(k), on_market: 0 })), slots: { used: c.accepted.length, max: SLOTS },
      reroll_available: (c.rerolls || 0) > 0, rerolls_left: c.rerolls || 0, rerolls_max: 2, gold_mult: 1, recent: [], ranks, rank_at: [0, 100, 300, 700, 1500], done_today: c.done_today, daily_cap: DAILY_CAP, day_resets_at: endOf(1) };
  }
  const fail = (d) => { throw Object.assign(new Error(d), { status: 400, detail: d }); };
  function contractAct(id, act) {
    const c = offers(), o = c.offers.find((k) => k.id === id), a = c.accepted.find((k) => k.id === id);
    if (act === "accept") { if (!o) fail("That offer is gone"); if (c.accepted.length >= SLOTS) fail("Your contract slots are full"); c.offers = c.offers.filter((k) => k !== o); c.accepted.push({ ...o, status: "accepted", accepted_at: new Date().toISOString() }); save(); return contractsOut(); }
    if (act === "reroll") { if (!o || !(c.rerolls > 0)) fail("No rerolls left today"); c.rerolls -= 1; c.offers = c.offers.map((k) => (k === o ? newOffer(Date.now()) : k)); save(); return contractsOut(); }
    if (act === "dismiss") { c.offers = c.offers.filter((k) => k !== o); save(); return contractsOut(); }
    if (act === "abandon") { c.accepted = c.accepted.filter((k) => k !== a); save(); return { state: contractsOut(), favour_lost: 0 }; }
    if (!a) fail("No such contract");
    if (c.done_today >= DAILY_CAP) fail("The patrons have enough for today. Come back tomorrow");
    const left = a.qty - (a.progress || 0), fish = S().catches.filter((x) => x.species_id === a.species_id).slice(0, left);
    if (!fish.length) fail(`You need ${left} more ${a.species_name} in your keepnet`);
    const ids = new Set(fish.map((x) => x.id)), old = lvl();
    S().catches = S().catches.filter((x) => !ids.has(x.id));
    a.progress = (a.progress || 0) + fish.length;
    if (a.progress < a.qty) { save(); return { done: false, state: contractsOut(), user: pub() }; }
    c.accepted = c.accepted.filter((k) => k !== a); c.done_today += 1; c.total = (c.total || 0) + 1; c.favour[a.patron] = (c.favour[a.patron] || 0) + a.favour;
    grant({ gold: a.gold, xp: a.xp, pearls: a.pearls });
    const ev = event("contract", {});
    save();
    return { done: true, state: contractsOut(), user: pub(), patron: a.patron_short, gold: a.gold, xp: a.xp, pearls: a.pearls, favour: a.favour, rank_ups: [], level_up: lvl() > old ? lvl() : null, new_achievements: ev.new_achievements, quests_done: ev.quests_done };
  }

  // ---- Almanac (your own log; market prices need the online version)
  function almanacCatches() {
    const log = S().log || [], now = Date.now();
    const curve = Array.from({ length: 30 }, (_, i) => { const d = dayKey(new Date(now - (29 - i) * 864e5)); return { day: d, n: log.filter((x) => x.at.slice(0, 10) === d).length }; });
    const waters = WATERS.map((w) => { const xs = log.filter((x) => x.water === w.key); const rarity = {}; xs.forEach((x) => { rarity[x.rarity] = (rarity[x.rarity] || 0) + 1; }); return { key: w.key, name: w.name, total: xs.length, rarity }; }).filter((w) => w.total);
    const best = {}; log.forEach((x) => { if (!best[x.name] || best[x.name].weight < x.weight) best[x.name] = x; });
    return { total: log.length, curve, waters, heaviest: Object.values(best).sort((a, b) => b.weight - a.weight).slice(0, 8) };
  }
  function almanacConditions(sid) {
    const f = FISH[sid], xs = (S().log || []).filter((x) => x.species_id === sid), count = (k) => { const m = {}; xs.forEach((x) => { m[x[k]] = (m[x[k]] || 0) + 1; }); return Object.entries(m).map(([key, n]) => ({ key, n })); };
    return { species: { id: f.id, name: f.name, rarity: f.rarity, water_name: WATER[f.water].name }, samples: xs.length, enough: xs.length >= 5, period: count("period"), weather: count("weather"), tide: [],
      hours: Array.from({ length: 24 }, (_, h) => ({ h, n: xs.filter((x) => new Date(x.at).getUTCHours() === h).length })) };
  }
  const logCatch = (c, period, weather) => { const L = (S().log = S().log || []); L.push({ species_id: c.species_id, name: c.name, rarity: c.rarity, weight: c.weight, water: c.water, at: c.caught_at, period, weather }); if (L.length > 3000) L.shift(); };

  const ok = (fn) => (b, m) => { const r = fn(b, m); save(); return r; };
  const routes = [
    ["get", /^\/quests$/, () => questsOut()],
    ["post", /^\/quests\/([^/]+)\/accept$/, ok((b, m) => { const i = H.story.findIndex((q) => q.id === m[1]); if (i < 0 || storyStatus(H.story[i], i) !== "available") fail("You can't take that quest yet"); st().story[m[1]] = { status: "active", progress: 0 }; return { story: storyOut() }; })],
    ["get", /^\/achievements$/, () => achOut()],
    ["get", /^\/cosmetics$/, () => cosOut()],
    ["post", /^\/cosmetics\/buy-(avatar|colour|frame|wall)$/, ok((b, m) => { buy(`${m[1]}s`, b[`${m[1]}_id`]); return { user: pub() }; })],
    ["post", /^\/cosmetics\/(avatar|colour|frame|wall)$/, ok((b, m) => use(`${m[1]}s`, b[`${m[1]}_id`]))],
    ["get", /^\/contracts$/, ok(() => contractsOut())],
    ["post", /^\/contracts\/([^/]+)\/(accept|reroll|dismiss|abandon|deliver)$/, (b, m) => contractAct(m[1], m[2])],
    ["get", /^\/almanac$/, () => ({ active: true, until: null, selling: [], days: 7, waters: WATERS.map((w) => ({ key: w.key, name: w.name })) })],
    ["get", /^\/almanac\/prices/, () => ({ trades: 0, low: 0, high: 0, median: 0, series: [] })],
    ["get", /^\/almanac\/catches$/, () => almanacCatches()],
    ["get", /^\/almanac\/species$/, () => Object.entries(S().journal).map(([id, j]) => ({ id: Number(id), name: FISH[id]?.name, n: j.count })).filter((x) => x.name)],
    ["get", /^\/almanac\/conditions/, (b, m, cfg) => almanacConditions(Number(new URLSearchParams((cfg.url || "").split("?")[1] || "").get("species_id") || cfg.params?.species_id))],
  ];
  return { routes, event, logCatch };
}
