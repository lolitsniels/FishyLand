// Offline build: the FishyLand server rules, run in the browser. State is saved through the Playgama Bridge storage.
import G from "./gamedata.json";
import { loadSave, saveSoon } from "./bridge";
import { makeHarbour } from "./harbour";

const C = G.c;
const DATA = { ...G.data, fish: G.data.fish.filter((f) => !f.pond && f.water !== "hallow") };
const WATERS = DATA.waters.filter((w) => !w.premium);
const WATER = Object.fromEntries(DATA.waters.map((w) => [w.key, w]));
const FISH = Object.fromEntries(DATA.fish.map((f) => [f.id, f]));
const BY_WATER = Object.fromEntries(DATA.waters.map((w) => [w.key, DATA.fish.filter((f) => f.water === w.key && !f.secret)]));
const GEAR = Object.fromEntries([...DATA.rods, ...DATA.reels, ...DATA.lines].map((g) => [g.id, g]));
const BAIT = Object.fromEntries(DATA.baits.map((b) => [b.id, b]));
const MAX_ENERGY = 100, REGEN_SEC = 60, CAST_COST = 2, VENDOR_RATE = 0.7, MAX_DUR = 100, WORN = 0.7, SIZE_EXP = 2.2, SIZE_VARIANT = 0.15, MAX_LEVEL = 250;
export const AD_ENERGY = 30;

const nowIso = () => new Date().toISOString();
const rnd = Math.random;
const pick = (arr, w) => { const tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot; for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const fail = (status, detail) => { const e = new Error(detail); e.status = status; e.detail = detail; throw e; };

export const xpFor = (l) => Math.floor(80 * l ** 1.55);
export function levelOf(xp) { let l = 1; while (xp >= xpFor(l) && l < MAX_LEVEL) { xp -= xpFor(l); l += 1; } return [l, xp]; }

let S = null; // { user, catches: [], journal: {}, pending, seq }
function fresh() {
  return {
    seq: 1, pending: null, catches: [], journal: {},
    user: {
      id: "offline", username: "Angler", gold: 120, xp: 0, pearls: 0, avatar: "look:m_1_1",
      durability: { rod_cane: MAX_DUR, reel_spool: MAX_DUR, line_cotton: MAX_DUR }, energy: MAX_ENERGY, energy_at: nowIso(),
      water: "millbrook", unlocked_waters: ["millbrook"], gear: { rod: "rod_cane", reel: "reel_spool", line: "line_cotton" },
      owned_gear: ["rod_cane", "reel_spool", "line_cotton"], bait: { bait_worm: 15 }, active_bait: "bait_worm",
      stats: { casts: 0, catches: 0, escaped: 0, heaviest_kg: 0, heaviest_name: null, gold_earned: 0, species: 0, legendary: 0, sold: 0 },
      tutorial: { step: 0, done: false }, created_at: nowIso(),
    },
  };
}
export async function boot() { S = (await loadSave()) || fresh(); }
const save = () => saveSoon(S);
const U = () => S.user;

function energyTick(u) {
  if (u.energy >= MAX_ENERGY) { u.energy_at = nowIso(); return; }
  const dt = (Date.now() - Date.parse(u.energy_at)) / 1000, gained = Math.floor(dt / REGEN_SEC);
  if (gained > 0) { u.energy = Math.min(MAX_ENERGY, u.energy + gained); u.energy_at = u.energy >= MAX_ENERGY ? nowIso() : new Date(Date.parse(u.energy_at) + gained * REGEN_SEC * 1000).toISOString(); }
}
const dur = (u, g) => u.durability?.[g] ?? MAX_DUR;
const tier = (u, s) => GEAR[u.gear[s]]?.tier || 1;
const rareSet = (u) => { const t = new Set(Object.values(u.gear).map((g) => GEAR[g]?.tier)); return t.size === 1 && !t.has(undefined); };
function bonuses(u) {
  const perk = (s, b) => (dur(u, u.gear[s]) <= 0 ? Math.floor(b * WORN) : b);
  return { luck: perk("rod", tier(u, "rod") - 1 + (GEAR[u.gear.rod]?.luck_bonus || 0)), value_pct: perk("reel", (tier(u, "reel") - 1) * 2), xp_pct: perk("line", (tier(u, "line") - 1) * 2),
    set: rareSet(u), worn: ["rod", "reel", "line"].filter((s) => dur(u, u.gear[s]) <= 0), enhance: { rod: 0, reel: 0, line: 0 } };
}
function title(l, st) {
  return l >= 250 ? "Living Myth" : l >= 200 ? "Fathom Lord" : l >= 150 ? "Tidecaller" : l >= 100 ? "Centurion of the Deep" : (st.legendary || 0) >= 3 ? "Living Legend"
    : l >= 70 ? "Grand Angler" : l >= 45 ? "Master Angler" : l >= 30 ? "Deepwater Captain" : l >= 20 ? "Sea Hand" : l >= 10 ? "River Warden" : l >= 5 ? "Pond Regular" : "Greenhorn";
}
export function pub() {
  const u = U(); energyTick(u);
  const [level, into] = levelOf(u.xp);
  return {
    ...u, level, xp_into_level: into, xp_next: xpFor(level), max_energy: MAX_ENERGY, energy_cap: MAX_ENERGY * 2, premium: false, energy_regen_sec: REGEN_SEC,
    energy_progress_sec: u.energy < MAX_ENERGY ? Math.max(0, (Date.now() - Date.parse(u.energy_at)) / 1000) : 0, cast_cost: CAST_COST, repair_discount: 0, bait_discount: 0, market_fee: 0.05,
    durability: Object.fromEntries(u.owned_gear.map((g) => [g, dur(u, g)])), ingredients: {}, ingredient_buys: {}, title: title(level, u.stats), is_admin: false, is_mod: false,
    test_water: false, duel_access: false, duel_level: 10, duel: { wins: 0, losses: 0, draws: 0, streak: 0, best_streak: 0 }, potion: { have: 0, next_at: null, energy: 0, cooldown_h: 0 },
    enhance: {}, scrap: 0, seals: 0, passes: 0, salvage_count: 0, is_guest: false, pending_setup: false, offline: true, rare_set: rareSet(u), gear_bonuses: bonuses(u),
    achievements: [], titles: [], active_title: null, crew: null, crates: {}, spare_copies: {}, share_reward: 0, seen_flags: u.seen_flags || [], owned_avatars: [], owned_rod_skins: [],
  };
}

function conditions(key) {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const period = h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night";
  const block = Math.floor(Date.now() / 10800000);
  let r = [...`${key}:${block}`].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % 100;
  const weather = ["clear", "overcast", "rain", "storm", "fog", "wind"].find((k, i) => (r -= [30, 22, 18, 7, 12, 11][i]) < 0) || "clear";
  const W = { clear: [0, 0], overcast: [4, 1], rain: [8, 2], storm: [-6, 5], fog: [-2, 4], wind: [-3, 0] };
  let bite = W[weather][0] + { dawn: 6, day: 0, dusk: 6, night: -4 }[period];
  return { period, weather, bite, wluck: W[weather][1] };
}
function castLuck(u, water) {
  const b = u.active_bait && (u.bait[u.active_bait] || 0) > 0 ? BAIT[u.active_bait] : null;
  const cond = conditions(water.key);
  let luck = { dawn: 2, day: 0, dusk: 2, night: 4 }[cond.period] + cond.wluck + bonuses(u).luck, bite = cond.bite + (GEAR[u.gear.rod]?.bite_bonus || 0);
  if (b) { if (!b.waters || b.waters.includes(water.key)) { luck += b.luck; bite += b.bite; } else luck += Math.floor(b.luck / 3); }
  return { luck: Math.max(0, luck), bite, bait: b, period: cond.period };
}
function weights(luck, baitId) {
  if (baitId && BAIT[baitId]?.ground) return Object.fromEntries(Object.entries(C.RARITY_WEIGHT).map(([k, v]) => [k, v * (C.GROUNDBAIT_MULT[k] || 1)]));
  const w = { ...C.RARITY_WEIGHT }, s = luck * 5;
  w.common = Math.max(300, w.common - s * 2.5); w.uncommon += s * 0.8; w.rare += s * 0.5; w.epic += s * 0.3; w.legendary += s * 0.07; w.mythic += s * 0.012;
  return w;
}
const PERIODS = ["dawn", "day", "dusk", "night"];
const activePeriod = (f) => (["legendary", "mythic"].includes(f.rarity) || f.behavior === "sluggish" ? "night" : PERIODS[f.id % 4]);
function pickSpecies(key, luck, period, baitId) {
  const w = weights(luck, baitId), pool = BY_WATER[key];
  const r = pick(Object.keys(w), Object.values(w));
  const cand = pool.filter((f) => f.rarity === r).length ? pool.filter((f) => f.rarity === r) : pool;
  return pick(cand, cand.map((f) => (activePeriod(f) === period ? 2.2 : 1) * (f.bait_only && !f.bait_only.includes(baitId) ? C.BAIT_ONLY_OTHER : 1)));
}
function secretOpen(key) {
  const h = new Date().getUTCHours();
  return DATA.fish.find((f) => f.secret && f.water === key && (([a, b]) => (a < b ? a <= h && h < b : h >= a || h < b))(C.SECRET_HOURS[f.id] || [0, 0]));
}
const rollWeight = (f, size) => r3(f.min_kg + (f.max_kg - f.min_kg) * rnd() ** (SIZE_EXP * 0.8 ** size));
function rollVariant(boost) { const r = rnd(); let acc = 0; for (const [n, ch, m] of C.VARIANTS.slice(1)) { acc += ch * boost; if (r < acc) return [n, m]; } return ["normal", 1]; }
const pressure = (key) => { const i = Math.max(0, DATA.waters.findIndex((w) => w.key === key)); return Math.round((i / (DATA.waters.length - 1)) * 1000) / 1000; };
const RP = { common: 0.3, uncommon: 0.45, rare: 0.7, epic: 1.0, legendary: 1.3, mythic: 1.6 };
const RS = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
const softCap = (raw, cap) => (raw <= cap ? raw : cap + (raw - cap) * 0.35);
function encounter(f, weight, u, variant, key) {
  const ratio = (weight - f.min_kg) / Math.max(0.001, f.max_kg - f.min_kg), b = C.BEHAVIORS[f.behavior], p = pressure(key);
  const rm = { common: 0.72, uncommon: 0.88, rare: 1.12, epic: 1.35, legendary: 1.65, mythic: 1.95 }[f.rarity];
  const w = (g) => (dur(u, g.id) <= 0 ? WORN : 1);
  const rod = GEAR[u.gear.rod], reel = GEAR[u.gear.reel], line = GEAR[u.gear.line];
  const power = rod.power * w(rod) * (rareSet(u) ? 1.05 : 1), control = rod.control * w(rod);
  const base = 6 + { common: 0, uncommon: 2, rare: 4, epic: 7, legendary: 11, mythic: 16 }[f.rarity] + ratio * 3, e = p * RP[f.rarity];
  const raw = base / power, floor = base * (0.3 + 0.25 * e), stamina = raw >= floor ? raw : floor - (floor - raw) * 0.4;
  const tk = 3.2 - 0.6 * e, tb = 12 - 3 * e;
  const words = ["tiny", "small", "decent", "big", "monstrous"];
  let idx = weight < 0.4 ? 0 : weight < 1.5 ? 1 : weight < 6 ? 2 : weight < 25 ? 3 : 4; idx += ratio < 0.25 ? -1 : ratio >= 0.85 ? 1 : 0;
  const score = RS[f.rarity] + (ratio >= 0.6) + (ratio >= 0.85) + (variant !== "normal") + Math.round(2 * p * RP[f.rarity]);
  const tricks = [];
  if (score >= 2) tricks.push(C.BEHAVIOR_TRICK[f.behavior]); if (score >= 4) tricks.push("tiring"); if (score >= 6) tricks.push("panic");
  if (["legendary", "mythic"].includes(f.rarity) && !tricks.includes("second_wind")) tricks.push("second_wind");
  return {
    strength: r3(b.strength * (0.85 + ratio * 0.45) * rm * (1 + 0.3 * e)), erratic: r3(b.erratic * rm * (1 + 0.45 * e)), stamina: Math.round(stamina * 100) / 100,
    zone_width: Math.round(softCap(30 * control, 58 - 22 * e + 8 * (control - 1)) * 10) / 10, recovery: r3(reel.recovery * w(reel)), tolerance: r3(line.tolerance * w(line)),
    time_limit: Math.round((stamina * tk + tb) * 10) / 10, time_k: tk, time_base: tb, hint: `Something ${words[Math.max(0, Math.min(4, idx))]} is on the line. It ${b.desc}.`,
    size_note: ratio >= 0.85 ? "A giant of its kind." : ratio < 0.15 ? "A runt of its kind." : "", behavior: f.behavior,
    tricks, trick_score: score, tiring_min: score >= 6 ? 0.6 : 0.75, trick_repeat: score >= 5, trick_names: tricks.map((t) => C.TRICK_INFO[t].name),
  };
}
const fishValue = (f, wgt, vm) => Math.max(1, Math.round(C.RARITY_BASE_VALUE[f.rarity] * f.value_mod * (0.7 + ((wgt - f.min_kg) / Math.max(0.001, f.max_kg - f.min_kg)) * 1.3) * vm));
const SHAPES = [[["eel", "moray", "lamprey", "oarfish", "ribbonfish", "serpent", "wyrm"], 0.0018], [["pike", "gar", "garfish", "barracuda", "needlefish", "muskie", "muskellunge", "zander", "pickerel", "wahoo", "marlin", "sailfish", "swordfish", "trumpetfish", "sturgeon", "catfish", "shark"], 0.0075],
  [["bluegill", "sunfish", "crappie", "pumpkinseed", "bream", "carp", "koi", "piranha", "pomfret", "angelfish", "tang", "discus", "butterflyfish", "opah", "pacu", "grouper", "puffer", "boxfish", "batfish", "turbot", "halibut", "flounder", "ray", "manta", "skate", "moonfish", "mola"], 0.028]];
function lengthCm(f, wgt) {
  const words = (f.name || "").toLowerCase().match(/[a-z]+/g) || [];
  const a = (SHAPES.find(([keys]) => words.some((w) => keys.some((k) => w === k || w.endsWith(k)))) || [0, 0.013])[1];
  return Math.round(((Math.max(wgt, 0.001) * 1000) / a) ** (1 / 3) * 10) / 10;
}
const vendor = (u, c) => ({ vendor: Math.round(c.value * VENDOR_RATE * (1 + bonuses(u).value_pct / 100)), vendor_bonus_pct: bonuses(u).value_pct });

function cast() {
  const u = U(); energyTick(u);
  if (u.energy < CAST_COST) fail(400, "You are exhausted. Rest a while before casting again.");
  const water = WATER[u.water], { luck, bite, bait, period } = castLuck(u, water);
  if (u.energy >= MAX_ENERGY) u.energy_at = nowIso();
  if (!(rnd() < (GEAR[u.gear.rod]?.free_cast || 0))) u.energy -= CAST_COST;
  u.stats.casts += 1;
  if (bait) u.bait[bait.id] -= 1;
  HB.event("cast", {});
  const t = u.tutorial || {};
  const guaranteed = !t.done && t.step === 2 && !t.guaranteed && !u.stats.catches;
  if (guaranteed) t.guaranteed = true;
  S.pending = null;
  if (!guaranteed && Math.floor(rnd() * 100) + 1 > 72 + bite) {
    save();
    return { result: "nothing", encounter: null, user: pub(), message: pick(["The line drifts. Nothing bites.", "A nibble... then nothing.", "Your bait comes back untouched.", "Ripples spread and fade. The water keeps its secrets."], [1, 1, 1, 1]) };
  }
  let f;
  if (guaranteed) { const plain = BY_WATER[water.key].filter((x) => x.rarity === "common" && !x.bait_only); f = plain[Math.floor(rnd() * plain.length)]; }
  else { const sec = secretOpen(water.key); f = sec && rnd() < C.SECRET_CHANCE ? sec : pickSpecies(water.key, luck, period, bait?.id); }
  const wb = 1 + (GEAR[u.gear.rod]?.weight_bonus || 0);
  const weight = Math.min(r3(f.max_kg * 1.1 * wb), r3(rollWeight(f, bait?.size || 0) * wb));
  const [variant, vmult] = guaranteed ? ["normal", 1] : rollVariant(1 + SIZE_VARIANT * (bait?.size || 0));
  const params = encounter(f, weight, u, variant, water.key);
  const id = `e${S.seq++}`;
  S.pending = { id, species_id: f.id, weight, variant, vmult, water: water.key, created: Date.now(), params, period, weather: conditions(water.key).weather };
  save();
  return { result: "hooked", encounter: { id, ...params }, message: "Fish on!", user: pub() };
}

function land(body) {
  const u = U(), enc = S.pending;
  if (!enc || enc.id !== body.encounter_id) fail(404, "No fish on the line");
  S.pending = null;
  for (const g of Object.values(u.gear)) if (!GEAR[g]?.no_wear && dur(u, g) > 0 && !(rareSet(u) && rnd() < 0.5)) u.durability[g] = dur(u, g) - 1;
  const f = FISH[enc.species_id];
  if (!body.success || (Date.now() - enc.created) / 1000 > enc.params.time_limit + 60) { u.stats.escaped += 1; save(); return { success: false, species: f.name, rarity: f.rarity, message: `The ${f.name} got away.` }; }
  const hard = 1 + 0.2 * pressure(enc.water), gb = bonuses(u);
  const value = Math.round(fishValue(f, enc.weight, enc.vmult) * hard);
  const xp = Math.round((C.RARITY_XP[f.rarity] + Math.floor(enc.weight ** 0.5 * 3)) * (1 + gb.xp_pct / 100) * (1 + (GEAR[u.gear.rod]?.xp_bonus || 0)) * hard);
  const c = { id: `c${S.seq++}`, user_id: u.id, username: u.username, species_id: f.id, name: f.name, rarity: f.rarity, weight: enc.weight, length_cm: lengthCm(f, enc.weight), variant: enc.variant,
    value, water: enc.water, caught_at: nowIso(), listed: false, mounted: false };
  S.catches.unshift(c);
  const j = S.journal[f.id], first = !j;
  S.journal[f.id] = first ? { count: 1, best_kg: enc.weight, first_at: nowIso(), variants: [enc.variant] }
    : { ...j, count: j.count + 1, best_kg: Math.max(j.best_kg, enc.weight), variants: [...new Set([...j.variants, enc.variant])] };
  const old = levelOf(u.xp)[0];
  u.xp += xp; u.stats.catches += 1;
  if (first) u.stats.species += 1;
  if (f.rarity === "legendary" || f.rarity === "mythic") u.stats.legendary += 1;
  u.stats.by_rarity = { ...(u.stats.by_rarity || {}), [f.rarity]: ((u.stats.by_rarity || {})[f.rarity] || 0) + 1 };
  if (enc.weight > (u.stats.heaviest_kg || 0)) { u.stats.heaviest_kg = enc.weight; u.stats.heaviest_name = f.name; }
  HB.logCatch(c, enc.period, enc.weather);
  const ev = HB.event("catch", { water: enc.water, rarity: f.rarity, weight: enc.weight, first, variant: enc.variant, period: enc.period });
  const lvl = levelOf(u.xp)[0];
  if (lvl > old) { energyTick(u); u.energy = Math.min(MAX_ENERGY * 2, u.energy + MAX_ENERGY); u.energy_at = nowIso(); }
  save();
  return { success: true, catch: { ...c, ...vendor(u, c) }, xp, first_discovery: first, level_up: lvl > old ? lvl : null, blurb: f.blurb, baitable: f.baitable, user: pub(), new_achievements: ev.new_achievements, quests_done: ev.quests_done };
}

function sell(body) {
  const u = U(), ids = new Set(body.catch_ids || []), rows = S.catches.filter((c) => ids.has(c.id));
  if (!rows.length) fail(404, "Nothing to sell");
  const total = rows.reduce((a, c) => a + vendor(u, c).vendor, 0) * (body.double && rows.length === 1 ? 2 : 1);
  S.catches = S.catches.filter((c) => !ids.has(c.id));
  u.gold += total; u.stats.gold_earned += total; u.stats.sold += rows.length;
  const ev = HB.event("sell", { count: rows.length, gold: total });
  save();
  return { gold: total, candles: 0, count: rows.length, user: pub(), new_achievements: ev.new_achievements, quests_done: ev.quests_done };
}

function buyGear(body) {
  const u = U(), g = GEAR[body.gear_id];
  if (!g) fail(404, "Unknown item");
  if (g.event || g.crate || g.milestones || g.pearls) fail(400, "That item is only in the online version");
  if (u.owned_gear.includes(g.id)) fail(400, "You already own that");
  if (levelOf(u.xp)[0] < (g.level || 1)) fail(400, `The ${g.name} needs level ${g.level}`);
  if (u.gold < g.price) fail(400, "Not enough gold");
  u.gold -= g.price; u.owned_gear.push(g.id); u.gear[g.id.split("_")[0]] = g.id; u.durability[g.id] = MAX_DUR;
  save(); return pub();
}
function buyBait(body) {
  const u = U(), b = BAIT[body.bait_id], qty = Math.max(1, Math.min(500, body.qty | 0));
  if (!b || b.price == null || b.pearls) fail(404, "That bait is not sold here");
  if (levelOf(u.xp)[0] < (b.level || 1)) fail(400, `${b.name} needs level ${b.level}`);
  const cost = Math.max(1, b.price) * qty;
  if (u.gold < cost) fail(400, "Not enough gold");
  u.gold -= cost; u.bait[b.id] = (u.bait[b.id] || 0) + qty * (b.pack || 1);
  save(); return pub();
}
function equip(body) {
  const u = U();
  if (body.gear_id) {
    if (!u.owned_gear.includes(body.gear_id)) fail(400, "You don't own that");
    const need = GEAR[body.gear_id]?.level || 1;
    if (levelOf(u.xp)[0] < need) fail(400, `You need level ${need} to use the ${GEAR[body.gear_id].name}`);
    u.gear[body.gear_id.split("_")[0]] = body.gear_id;
  }
  if (body.bait_id !== undefined) u.active_bait = body.bait_id || null;
  save(); return pub();
}
function repair() {
  const u = U(); let cost = 0;
  for (const g of Object.values(u.gear)) { const it = GEAR[g]; if (!it.price) { u.durability[g] = MAX_DUR; continue; } cost += Math.max(1, Math.round(it.price * 0.006)) * (MAX_DUR - dur(u, g)); }
  if (u.gold < cost) fail(400, `Repairs cost ${cost} gold`);
  u.gold -= cost; Object.values(u.gear).forEach((g) => { u.durability[g] = MAX_DUR; });
  save(); return { cost, user: pub() };
}
function travel(body) {
  const u = U(), w = WATER[body.water];
  if (!w || w.premium) fail(404, "Unknown water");
  if (!u.unlocked_waters.includes(w.key)) {
    if (levelOf(u.xp)[0] < w.level) fail(400, `You need level ${w.level} to fish ${w.name}`);
    if (u.gold < w.fee) fail(400, `The passage to ${w.name} costs ${w.fee} gold`);
    u.gold -= w.fee; u.unlocked_waters.push(w.key);
  }
  u.water = w.key; S.pending = null;
  const ev = HB.event("travel", { water: w.key });
  save(); return { ...pub(), quests_done: ev.quests_done };
}
function tutorial(kind, body) {
  const t = (U().tutorial = U().tutorial || { step: 0, done: false });
  if (kind === "step" && !t.done) t.step = Math.max(body.step, t.step || 0);
  if (kind === "skip") Object.assign(t, { done: true, skipped: true });
  if (kind === "restart") Object.assign(t, { step: 0, done: false, skipped: false });
  let reward = null;
  if (kind === "complete") {
    if (!t.rewarded) { const u = U(); u.pearls += 10; u.bait.bait_worm = (u.bait.bait_worm || 0) + 10; u.bait.bait_bread = (u.bait.bait_bread || 0) + 10; reward = { bait_worm: 10, bait_bread: 10, pearls: 10 }; }
    Object.assign(t, { done: true, rewarded: true, step: 10 });
  }
  save(); return { user: pub(), reward };
}
export const tutorialDone = () => !!S?.user?.tutorial?.done;
export function adEnergy() { const u = U(); energyTick(u); u.energy = Math.min(MAX_ENERGY * 2, u.energy + AD_ENERGY); save(); return pub(); }

function species(id) {
  const f = FISH[id]; if (!f) fail(404, "No such species");
  const w = WATER[f.water], j = S.journal[id], beh = C.BEHAVIORS[f.behavior];
  return { ...f, bait_only: (f.bait_only || []).map((b) => BAIT[b]?.name).filter(Boolean), water: { key: w.key, name: w.name, type: w.type, salt: w.salt, level: w.level, desc: w.desc },
    behavior: { key: f.behavior, desc: beh.desc, strength: beh.strength, erratic: beh.erratic }, baits: DATA.baits.filter((b) => !b.waters || b.waters.includes(f.water)).sort((a, b) => b.luck - a.luck).slice(0, 6).map((b) => ({ id: b.id, name: b.name, luck: b.luck })),
    records: [], total_catches: j?.count || 0, you: j ? { ...j, best_variant: "normal", best_at: null } : null };
}
function progress() {
  return Object.fromEntries(WATERS.map((w) => { const pool = BY_WATER[w.key], got = pool.filter((f) => S.journal[f.id]).length, v = pool.filter((f) => (S.journal[f.id]?.variants || []).some((x) => x !== "normal")).length;
    return [w.key, { species: got, total: pool.length, variants: v, variants_total: pool.length, complete: got === pool.length, variants_complete: v === pool.length }]; }));
}
function profile() {
  const u = pub();
  return { ...u, username: u.username, online: true, friends: [], trophies: [], unlocked_waters: u.unlocked_waters.length, badges: [], recent: S.catches.slice(0, 10), species_count: u.stats.species, guestbook: [], is_self: true,
    contest_wins: [], boss_trophies: [], max_boss_mounts: 0, last_seen: nowIso(), supporter: false, name_colour_hex: null, avatar_name: null };
}

const HB = makeHarbour({ S: () => S, U, pub, save: () => save(), levelOf, WATERS, BY_WATER, WATER, FISH });

const ROUTES = [
  ...HB.routes,
  ["get", /^\/auth\/me$/, () => pub()],
  ["get", /^\/game\/data/, () => ({ ...DATA, waters: WATERS })],
  ["post", /^\/auth\/logout$/, () => ({ ok: true })],
  ["post", /^\/fish\/cast$/, () => cast()],
  ["post", /^\/fish\/land$/, (b) => land(b)],
  ["get", /^\/inventory$/, () => ({ fish: S.catches.map((c) => ({ ...c, ...vendor(U(), c) })), total: S.catches.length, shown: S.catches.length, bait: U().bait, gear: U().gear, owned_gear: U().owned_gear, mounted: 0, max_trophies: 0 })],
  ["get", /^\/inventory\/vendor-quotes/, () => Object.fromEntries(S.catches.map((c) => [c.id, vendor(U(), c)]))],
  ["post", /^\/inventory\/sell$/, (b) => sell(b)],
  ["post", /^\/inventory\/repair$/, () => repair()],
  ["get", /^\/shop\/milestones$/, () => ({})],
  ["post", /^\/shop\/buy-gear$/, (b) => buyGear(b)],
  ["post", /^\/shop\/buy-bait$/, (b) => buyBait(b)],
  ["post", /^\/shop\/equip$/, (b) => equip(b)],
  ["post", /^\/waters\/travel$/, (b) => travel(b)],
  ["get", /^\/waters\/progress$/, () => progress()],
  ["get", /^\/waters\/conditions$/, () => Object.fromEntries(WATERS.map((w) => { const c = conditions(w.key); return [w.key, { water: w.key, period: c.period, weather: c.weather, tide: null, bite: c.bite, luck: c.wluck, text: "", next_change_min: 60 }]; }))],
  ["get", /^\/journal$/, () => S.journal],
  ["get", /^\/species\/(\d+)$/, (b, m) => species(Number(m[1]))],
  ["post", /^\/tutorial\/(step|skip|restart|complete)$/, (b, m) => tutorial(m[1], b)],
  ["post", /^\/me\/look$/, (b) => { U().avatar = b.look || b.avatar || U().avatar; save(); return { user: pub(), ...pub() }; }],
  ["get", /^\/players\/[^/]+$/, () => profile()],
  ["post", /^\/world\/pos$/, () => ({ peers: [] })],
  ["get", /^\/world\/counts$/, () => ({})],
  ["get", /^\/npcs$/, () => []],
];

// axios adapter: every /api call is answered here instead of the network
export async function offlineAdapter(cfg) {
  const url = (cfg.url || "").replace(/^https?:\/\/[^/]+/, "").replace(/^\/?api/, "").replace(/^([^/])/, "/$1");
  const path = url.split("?")[0], method = (cfg.method || "get").toLowerCase();
  const body = typeof cfg.data === "string" ? JSON.parse(cfg.data || "{}") : cfg.data || {};
  const reply = (status, data) => ({ data, status, statusText: String(status), headers: {}, config: cfg, request: {} });
  for (const [m, re, fn] of ROUTES) {
    const mm = method === m && path.match(re);
    if (!mm) continue;
    try { return reply(200, JSON.parse(JSON.stringify(fn(body, mm, cfg)))); }
    catch (e) {
      if (!e.status) throw e;
      const err = new Error(e.detail); err.response = reply(e.status, { detail: e.detail }); err.config = cfg; err.isAxiosError = true;
      throw err;
    }
  }
  const err = new Error("Not available offline"); err.response = reply(404, { detail: "That's part of the online version" }); err.config = cfg;
  throw err;
}
