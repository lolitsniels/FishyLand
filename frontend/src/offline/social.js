// Offline build: the multiplayer buildings open and work, but nobody else is online (chat stays local, duels wait in the queue).
import SOC from "./social.json";
import WIKI from "./wiki.json";

const MAX_TACKLE = 10, TACKLE_COSTS = [3, 5, 8, 12, 16, 20, 25, 30, 40];
export const TACKLE_INFO = { max_level: MAX_TACKLE, costs: TACKLE_COSTS, tracks: {
  reel: { name: "Reel", stat: "recovery", base: 1.0, step: 0.12, perk: "sell value", desc: "Lets the needle drift back faster when you let go." },
  line: { name: "Line", stat: "tolerance", base: 1.0, step: 0.11, perk: "XP", desc: "Holds longer at the edge of the bar before it snaps." } } };
export const tackleLevel = (u, slot) => Math.max(1, Math.min(MAX_TACKLE, (u.tackle || {})[slot] || 1));
export const tackleStat = (u, slot) => Math.round((1 + TACKLE_INFO.tracks[slot].step * (tackleLevel(u, slot) - 1)) * 1000) / 1000;
export const tacklePct = (u, slot) => (tackleLevel(u, slot) - 1) * 2;
export const tackleView = (u) => Object.fromEntries(["reel", "line"].map((s) => { const lv = tackleLevel(u, s);
  return [s, { level: lv, max: MAX_TACKLE, stat: tackleStat(u, s), perk_pct: tacklePct(u, s), next_cost: lv < MAX_TACKLE ? TACKLE_COSTS[lv - 1] : null }]; }));

export function makeSocial({ S, U, pub, save, fail, levelOf, FISH, BAIT, DATA, nowIso }) {
  const ING = Object.fromEntries(DATA.ingredients.map((i) => [i.id, i]));
  const today = () => new Date().toISOString().slice(0, 10);
  const chat = (ch) => { const s = S(); s.chat = s.chat || {}; return (s.chat[ch] = s.chat[ch] || []); };
  const lbRow = (value, extra = {}) => { const u = pub(); return { username: u.username, level: u.level, value, avatar: u.avatar, frame: u.frame || null, ...extra }; };
  const duelView = () => { const s = S(); return { ...SOC.duel, queue: s.duelQ ? { waiting: Math.floor((Date.now() - s.duelQ) / 1000), others: 0 } : null, user: pub() }; };

  function post(ch, body) {
    const t = String(body.text || "").trim().slice(0, 240);
    if (!t) fail(400, "Say something first");
    const u = pub(), s = S();
    const m = { channel: ch, username: u.username, level: u.level, text: t, at: nowIso(), id: `m${s.seq++}`, tag: null, colour: null, avatar: u.avatar, frame: null };
    chat(ch).push(m); s.chat[ch] = chat(ch).slice(-80); save(); return m;
  }
  function upgrade(body) {
    const u = U(), slot = body.slot;
    if (!TACKLE_INFO.tracks[slot]) fail(400, "Only the reel and line can be upgraded");
    const lv = tackleLevel(u, slot);
    if (lv >= MAX_TACKLE) fail(400, `Your ${slot} is already at max level`);
    const cost = TACKLE_COSTS[lv - 1];
    if ((u.pearls || 0) < cost) fail(400, `You need ${cost} Pearls for this upgrade`);
    u.pearls -= cost; u.tackle = { ...(u.tackle || {}), [slot]: lv + 1 };
    save(); return { user: pub() };
  }
  function buyIng(body) {
    const u = U(), ing = ING[body.ingredient_id], qty = Math.max(1, body.qty | 0);
    if (!ing) fail(404, "Unknown ingredient");
    const b = u.ing_buys?.date === today() ? u.ing_buys.counts : {};
    if (qty > ing.daily_cap - (b[ing.id] || 0)) fail(400, `The vendor only has ${Math.max(0, ing.daily_cap - (b[ing.id] || 0))} more ${ing.name} for you today`);
    if (u.gold < ing.price * qty) fail(400, "Not enough gold");
    u.gold -= ing.price * qty; u.ingredients = { ...(u.ingredients || {}), [ing.id]: (u.ingredients?.[ing.id] || 0) + qty };
    u.ing_buys = { date: today(), counts: { ...b, [ing.id]: (b[ing.id] || 0) + qty } };
    save(); return pub();
  }
  function craft(body) {
    const u = U(), s = S(), r = DATA.recipes.find((x) => x.id === body.recipe_id);
    if (!r) fail(404, "Unknown recipe");
    const ids = new Set(body.catch_ids || []), k = Math.floor(ids.size / r.fish);
    if (!k || ids.size % r.fish) fail(400, `Pick a multiple of ${r.fish} small fish`);
    const rows = s.catches.filter((c) => ids.has(c.id));
    if (rows.length !== ids.size || !rows.every((c) => FISH[c.species_id]?.baitable)) fail(400, "Only small bait-grade fish can be used");
    for (const [i, n] of Object.entries(r.ingredients)) if ((u.ingredients?.[i] || 0) < n * k) fail(400, `You need ${n * k} × ${ING[i].name}`);
    for (const [i, n] of Object.entries(r.ingredients)) u.ingredients[i] -= n * k;
    s.catches = s.catches.filter((c) => !ids.has(c.id));
    const made = r.yield * k; u.bait[r.id] = (u.bait[r.id] || 0) + made;
    save(); return { made, batches: k, bait: BAIT[r.id]?.name || r.id, bonus: 0, user: pub() };
  }

  const routes = [
    ["get", /^\/chat\/(\w+)$/, (b, m, cfg) => { const after = cfg.params?.after || ""; return chat(m[1]).filter((x) => !after || x.at > after); }],
    ["post", /^\/chat\/(\w+)$/, (b, m) => post(m[1], b)],
    ["get", /^\/alerts\/live$/, () => []],
    ["get", /^\/market$/, () => []],
    ["get", /^\/market\/mine$/, () => []],
    ["post", /^\/market\/.*$/, () => fail(400, "No other anglers are trading right now. Check back soon!")],
    ["get", /^\/crews$/, () => ({ ...SOC.crews, crews: [] })],
    ["get", /^\/crews\/inbox$/, () => ({ invites: [], requests: [], count: 0 })],
    ["get", /^\/crew-colours$/, () => SOC.crew_colours],
    ["post", /^\/crews.*$/, () => fail(400, `Crews need at least two anglers. Founding one opens at level ${SOC.crews.min_level}, and you can join any crew that's recruiting.`)],
    ["get", /^\/tournaments$/, () => ({ ...SOC.tournaments, user: pub() })],
    ["post", /^\/tournaments\/.*$/, () => fail(400, "Not enough anglers have signed up for this tournament yet")],
    ["get", /^\/duel\/state$/, () => { if (levelOf(U().xp)[0] < 10) fail(403, "The duelling pier opens at level 10"); return duelView(); }],
    ["post", /^\/duel\/queue$/, () => { const s = S(); if (s.duelQ) fail(400, "You're already waiting for an opponent"); s.duelQ = Date.now(); save(); return duelView(); }],
    ["delete", /^\/duel\/queue$/, () => { S().duelQ = null; save(); return duelView(); }],
    ["post", /^\/duel\/dismiss$/, () => duelView()],
    ["get", /^\/duel\/live\/state$/, () => ({ state: S().duelQ ? "queued" : "idle" })],
    ["post", /^\/duel\/live\/queue$/, () => { S().duelQ = Date.now(); save(); return { state: "queued" }; }],
    ["post", /^\/duel\/live\/leave$/, () => { S().duelQ = null; save(); return { state: "idle" }; }],
    ["get", /^\/leaderboards\/period$/, () => { const u = U(), st = u.stats; return { wealth: [lbRow(u.gold)], level: [lbRow(levelOf(u.xp)[0])], mastery: [], duels: [], tournaments: [], mentors: [],
      catches: [lbRow(st.catches)], collection: [lbRow(st.species)], heaviest: st.heaviest_kg ? [lbRow(st.heaviest_kg, { name: st.heaviest_name })] : [], period: { ends: null } }; }],
    ["get", /^\/leaderboards\/me$/, () => { const st = U().stats; return { catches: { rank: 1, value: st.catches }, collection: { rank: 1, value: st.species }, heaviest: { rank: 1, value: st.heaviest_kg, name: st.heaviest_name } }; }],
    ["get", /^\/messages$/, () => []],
    ["get", /^\/messages\/.*$/, () => []],
    ["get", /^\/wiki$/, () => WIKI],
    ["post", /^\/tackle\/upgrade$/, (b) => upgrade(b)],
    ["post", /^\/shop\/buy-ingredient$/, (b) => buyIng(b)],
    ["post", /^\/craft$/, (b) => craft(b)],
  ];
  return { routes };
}
