// Offline game engine for portal builds (no external server allowed). Mirrors backend/game.py endpoints.
import D from "./gameData.json";
import { FightSim, DT } from "./sim";
import { kv } from "../portal";

const SP = Object.fromEntries(D.species.map((s) => [s.id, s]));
const SLOTS = ["rod", "reel", "line"];
const gdef = (slot, tier) => D.gear[slot][tier - 1];
const xpNeed = (l) => Math.floor(80 * l ** 1.6);
const now = () => Date.now() / 1000;
const fail = (detail, status = 400) => { const e = new Error(detail); e.response = { status, data: { detail } }; throw e; };
let uid = 0;

function newSave() {
  const t = now();
  return {
    user: {
      username: `Angler${Math.floor(1000 + Math.random() * 90000)}`, level: 1, xp: 0, gold: 1000,
      stamina: D.base_stamina, stamina_at: t, gear: { rod: 1, reel: 1, line: 1 },
      owned_gear: Object.fromEntries(SLOTS.map((s) => [s, { 1: { enh: 0, dur: gdef(s, 1).dur } }])),
      items: { glow_shrimp: 10, stamina_potion: 2, enhance_stone: 5 },
      equipped: { wings: "seraph_wings", pet: "tide_fox", title: "Novice Angler" },
      stats: { casts: 0, catches: 0, lost: 0 }, last_cast_at: 0,
    },
    fish: [], dex: {}, enc: null,
  };
}

let S = null;
const load = () => { if (!S) { try { S = JSON.parse(kv.get("fr_save")) || newSave(); } catch { S = newSave(); } } return S; };
const save = () => kv.set("fr_save", JSON.stringify({ ...S, enc: null }));

function stamina(u, t = now()) {
  const mx = D.base_stamina;
  if (u.stamina >= mx) return [u.stamina, t];
  const regen = Math.floor((t - u.stamina_at) / D.regen_sec);
  const st = Math.min(mx, u.stamina + regen);
  return [st, st < mx ? u.stamina_at + regen * D.regen_sec : t];
}

function gearInfo(u, slot) {
  const tier = u.gear[slot], g = gdef(slot, tier), o = u.owned_gear[slot][tier];
  const broken = o.dur <= 0;
  return { ...g, slot, enh: o.enh, cur_dur: o.dur, broken, effective: +(g.stat * (1 + 0.03 * o.enh) * (broken ? 0.5 : 1)).toFixed(4), br_value: Math.floor(g.br * (1 + 0.12 * o.enh)) };
}

function player() {
  const u = load().user, fd = Object.keys(S.dex).length, [st] = stamina(u), mx = D.base_stamina;
  const parts = { level: u.level * D.br.level, gear: SLOTS.reduce((a, s) => a + gearInfo(u, s).br_value, 0), wings: D.br.wings, pet: D.br.pet, fishdex: fd * D.br.fishdex };
  return {
    id: "local", username: u.username, email: null, is_guest: true, role: "player", level: u.level, xp: u.xp, xp_need: xpNeed(u.level),
    gold: u.gold, stamina: st, stamina_max: mx,
    stamina_next_sec: st >= mx ? 0 : Math.floor(D.regen_sec - ((now() - u.stamina_at) % D.regen_sec)),
    br: Object.values(parts).reduce((a, b) => a + b, 0), br_parts: parts, gear: Object.fromEntries(SLOTS.map((s) => [s, gearInfo(u, s)])),
    owned_gear: u.owned_gear, items: u.items, equipped: u.equipped, fishdex_count: fd, stats: u.stats,
  };
}

function addXp(u, n) {
  u.xp += n;
  let g = 0;
  while (u.level < D.max_level && u.xp >= xpNeed(u.level)) { u.xp -= xpNeed(u.level); u.level++; g++; u.stamina = Math.min(2 * D.base_stamina, u.stamina + D.base_stamina); }
  return g;
}

const pick = (arr, w) => { let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; } return arr[arr.length - 1]; };
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function cast({ bait = "worm" }) {
  const u = load().user, t = now(), it = D.items[bait];
  if (!it || it.kind !== "bait") fail("Unknown bait");
  if (t - u.last_cast_at < 1.5) fail("Casting too fast", 429);
  const [st, at] = stamina(u, t);
  if (st < 1) fail("Out of stamina");
  if (bait !== "worm") { if ((u.items[bait] || 0) < 1) fail("No bait left"); u.items[bait]--; }
  const pool = D.species;
  const w = pool.map((s) => {
    let x = D.rarity_weight[s.rarity] / pool.filter((p) => p.rarity === s.rarity).length;
    if (!["common", "uncommon"].includes(s.rarity)) x *= 1 + (it.luck || 0);
    return s.bait === bait ? x * 1.5 : x;
  });
  const sp = pick(pool, w);
  let r = Math.random(), acc = 0, variant = null;
  for (const v of D.variants) { acc += v.chance; if (r < acc) { variant = v; break; } }
  const wf = Math.random() ** 2;
  let weight = sp.weight[0] + (sp.weight[1] - sp.weight[0]) * wf;
  if (variant?.id === "giant") weight *= 1.8;
  const limit = D.rarity_time[sp.rarity] * 30, n = { common: 0, uncommon: 1, rare: 1, epic: 2, legendary: 3, mythic: 4 }[sp.rarity];
  const kinds = D.behavior_tricks[sp.behavior];
  const [rod, reel, line] = SLOTS.map((s) => gearInfo(u, s));
  const params = {
    seed: rint(1, 2 ** 32 - 1), strength: +Math.min(1.1, sp.strength * (1 + 0.15 * wf)).toFixed(4), erratic: sp.erratic,
    power: rod.effective, control: reel.effective, line: line.effective, green_w: 0.09, limit_ticks: limit,
    tricks: Array.from({ length: n }, () => ({ at: rint(60, Math.floor(limit * 0.8)), dur: rint(18, 42), kind: kinds[rint(0, kinds.length - 1)] })).sort((a, b) => a.at - b.at),
  };
  const bite = (2 + Math.random() * 6) / rod.effective;
  S.enc = { id: `e${++uid}`, sp: sp.id, weight: +weight.toFixed(2), variant: variant?.id || null, params, created: t, bite_at: t + bite + 0.6 };
  u.stamina = st - 1; u.stamina_at = at; u.last_cast_at = t; u.stats.casts++;
  save();
  return { encounter_id: S.enc.id, bite_delay_ms: Math.floor(bite * 1000), fight_delay_ms: 600, params, species_id: sp.id, rarity: sp.rarity, weight: S.enc.weight, variant: S.enc.variant, stamina: u.stamina };
}

function land({ encounter_id, holds }) {
  const e = load().enc, u = S.user;
  if (!e || e.id !== encounter_id) fail("Encounter invalid or already used");
  S.enc = null;
  if (!holds.length) fail("No reel input - fight rejected");
  const held = new Array(e.params.limit_ticks).fill(false);
  holds.forEach(([a, b]) => { for (let i = a; i < b; i++) held[i] = true; });
  const sim = new FightSim(e.params);
  while (!sim.step(held[sim.tick] || false));
  if (now() < e.bite_at + sim.tick * DT - 1) fail("Fight finished faster than possible - rejected");
  const outcome = sim.outcome;
  SLOTS.forEach((s) => { const o = u.owned_gear[s][u.gear[s]]; o.dur = Math.max(0, o.dur - 1 - (s === "line" && outcome === "snapped" ? 4 : 0)); });
  const sp = SP[e.sp], res = { outcome, end_tick: sim.tick, fish: null, xp: 2, level_ups: 0, drops: [] };
  if (outcome === "landed") {
    const v = D.variants.find((x) => x.id === e.variant), span = sp.weight[1] - sp.weight[0];
    const frac = Math.min(1, Math.max(0, (e.weight - sp.weight[0]) / span));
    const fish = { id: `f${Date.now()}${++uid}`, species_id: sp.id, name: sp.name, rarity: sp.rarity, weight: e.weight, variant: e.variant,
      value: Math.floor(sp.value * (0.6 + 0.8 * frac) * (v ? v.mult : 1)), caught_at: new Date().toISOString(), img: sp.icon };
    S.fish.unshift(fish);
    const isNew = !S.dex[sp.id];
    S.dex[sp.id] = { species_id: sp.id, count: (S.dex[sp.id]?.count || 0) + 1, best_weight: Math.max(S.dex[sp.id]?.best_weight || 0, e.weight) };
    res.xp = Math.floor(D.rarity_xp[sp.rarity] * (1 + frac * 0.5) * (v ? 1.5 : 1));
    u.stats.catches++;
    if (Math.random() < 0.12) res.drops.push({ item_id: "enhance_stone", qty: 1 });
    if (Math.random() < 0.05) res.drops.push({ item_id: "glow_shrimp", qty: 3 });
    res.drops.forEach((d) => (u.items[d.item_id] = (u.items[d.item_id] || 0) + d.qty));
    res.fish = { ...fish, img: sp.img, lore: sp.lore, new_species: isNew };
  } else u.stats.lost++;
  res.level_ups = addXp(u, res.xp);
  save();
  return { ...res, player: player() };
}

const enhCost = (tier, enh) => [200 * (enh + 1) ** 2 * tier, 1 + Math.floor(enh / 3)];
const repCost = (s, tier, cur) => { const g = gdef(s, tier); return (g.dur - cur) * Math.max(2, Math.floor(g.price / (g.dur * 5))); };
const spend = (u, g) => { if (u.gold < g) fail("Not enough gold"); u.gold -= g; };

const POST = {
  "/fish/cast": cast,
  "/fish/land": land,
  "/inventory/sell": ({ ids = [], all }) => {
    const sel = all ? S.fish : S.fish.filter((f) => ids.includes(f.id));
    if (!sel.length) fail("Nothing to sell");
    const gold = sel.reduce((a, f) => a + f.value, 0);
    S.fish = S.fish.filter((f) => !sel.includes(f)); S.user.gold += gold; save();
    return { sold: sel.length, gold, player: player() };
  },
  "/shop/buy": ({ item_id, qty = 1 }) => {
    const it = D.items[item_id]; if (!it || it.price <= 0) fail("Item not for sale");
    spend(S.user, it.price * qty); S.user.items[item_id] = (S.user.items[item_id] || 0) + qty; save();
    return { player: player() };
  },
  "/items/use": ({ item_id }) => {
    const u = S.user, mx = D.base_stamina, [st, at] = stamina(u);
    if (item_id !== "stamina_potion" || !(u.items.stamina_potion > 0)) fail("No potions left");
    if (st >= 3 * mx) fail("Stamina already overflowing");
    u.items.stamina_potion--; u.stamina = Math.min(3 * mx, st + 30); u.stamina_at = st + 30 >= mx ? now() : at; save();
    return { player: player() };
  },
  "/gear/buy": ({ slot, tier }) => {
    const u = S.user, g = gdef(slot, tier);
    if (u.owned_gear[slot][tier]) fail("Already owned");
    if (u.level < g.level) fail(`Requires level ${g.level}`);
    spend(u, g.price); u.owned_gear[slot][tier] = { enh: 0, dur: g.dur }; u.gear[slot] = tier; save();
    return { player: player() };
  },
  "/gear/equip": ({ slot, tier }) => { if (!S.user.owned_gear[slot][tier]) fail("Not owned"); S.user.gear[slot] = tier; save(); return { player: player() }; },
  "/gear/enhance": ({ slot, protect }) => {
    const u = S.user, tier = u.gear[slot], o = u.owned_gear[slot][tier];
    if (o.enh >= D.enhance_max) fail("Already at max enhance");
    const [g, stones] = enhCost(tier, o.enh);
    if ((u.items.enhance_stone || 0) < stones) fail("Not enough Enhance Stones");
    if (protect && !(u.items.protection_scroll > 0)) fail("No Protection Scroll");
    spend(u, g); u.items.enhance_stone -= stones; if (protect) u.items.protection_scroll--;
    const success = Math.random() < D.enhance_chance[o.enh];
    let dropped = false;
    if (success) o.enh++; else if (o.enh >= 5 && !protect) { o.enh--; dropped = true; }
    save();
    return { success, dropped, enh: o.enh, player: player() };
  },
  "/gear/repair": ({ slot }) => {
    const u = S.user, tier = u.gear[slot], o = u.owned_gear[slot][tier], cost = repCost(slot, tier, o.dur);
    if (cost <= 0) fail("Already fully repaired");
    spend(u, cost); o.dur = gdef(slot, tier).dur; save();
    return { cost, player: player() };
  },
  "/auth/logout": () => ({ ok: true }),
};

const GET = {
  "/game/data": () => D,
  "/player": player,
  "/auth/me": () => ({ player: player() }),
  "/inventory/fish": () => S.fish,
  "/fishdex": () => S.dex,
  "/world/feed": () => [],
  "/gear/costs": () => Object.fromEntries(SLOTS.map((s) => {
    const u = S.user, tier = u.gear[s], o = u.owned_gear[s][tier], [g, st] = enhCost(tier, o.enh);
    return [s, { enhance_gold: g, enhance_stones: st, chance: o.enh < D.enhance_max ? D.enhance_chance[o.enh] : 0, repair_gold: repCost(s, tier, o.dur) }];
  })),
};

const run = (table, path, body) => {
  load();
  const fn = table[path];
  if (!fn) return Promise.reject(Object.assign(new Error("Not available offline"), { response: { status: 404, data: { detail: "Not available" } } }));
  try { return Promise.resolve({ data: JSON.parse(JSON.stringify(fn(body || {}))) }); } catch (e) { return Promise.reject(e); }
};

export const localApi = { get: (p) => run(GET, p), post: (p, b) => run(POST, p, b) };
