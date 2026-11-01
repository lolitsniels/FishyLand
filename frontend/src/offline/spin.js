// Offline Wheel of Fortune: mirrors backend/login_chest.py (one spin per UTC day, 7-day streak, golden wheel on day 7).
const WHEEL = [
  ["gold_s", "gold", 150, 28, "common"], ["bait", "bait", 8, 18, "common"], ["gold_m", "gold", 400, 18, "uncommon"], ["crafted", "crafted", 3, 12, "uncommon"],
  ["pearls_s", "pearls", 1, 8, "uncommon"], ["gold_l", "gold", 900, 8, "rare"], ["pearls_m", "pearls", 3, 4, "rare"], ["fish_rare", "fish", 1, 4, "rare"],
];
const BETTER = [
  ["gold_l", "gold", 1500, 20, "uncommon"], ["pearls_5", "pearls", 5, 18, "rare"], ["crafted", "crafted", 10, 14, "rare"], ["pearls_10", "pearls", 10, 12, "epic"],
  ["gold_xl", "gold", 4000, 10, "epic"], ["fish_epic", "fish", 1, 10, "epic"], ["pearls_20", "pearls", 20, 5, "legendary"], ["fish_legendary", "fish", 1, 5, "legendary"],
  ["skin", "skin", 1, 3, "legendary"], ["jackpot", "mythic", 1, 3, "mythic"],
];
const SKINS = { skin_kraken: "Krakenjaw Rod Skin", skin_inferno: "Inferno Wyrm Rod Skin", skin_galleon: "Ghost Galleon Rod Skin" };
const BONUS_PEARLS = 5;
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

const label = (s) => {
  if (s.kind === "gold") return `${s.qty.toLocaleString()} gold`;
  if (s.kind === "pearls") return s.qty === 1 ? "1 Pearl" : `${s.qty} Pearls`;
  if (s.kind === "mythic") return "Mythic jackpot";
  return s.qty > 1 ? `${s.qty}× ${s.name}` : s.name;
};

export function makeSpin({ S, U, save, level, baitName, craftedBaits, grantFish }) {
  const segment = ([id, kind, amt, weight, rarity], lvl, i) => {
    const out = { id, kind, weight, rarity, qty: amt };
    if (kind === "gold") out.qty = Math.floor((amt * (1 + lvl / 25)) / 5) * 5;
    else if (kind === "bait") Object.assign(out, { item: "bait_live", name: baitName("bait_live") });
    else if (kind === "crafted") { const b = craftedBaits[(Number(dayKey().replace(/-/g, "")) + i) % craftedBaits.length]; Object.assign(out, { item: b.id, name: b.name }); }
    else if (kind === "fish") out.name = `Mystery ${rarity} fish`;
    else if (kind === "skin") Object.assign(out, { item: "skin_galleon", name: "Rare rod skin" });
    else if (kind === "mythic") out.name = "Mythic fish (rare variant)";
    out.label = label(out);
    return out;
  };
  const state = () => {
    const lc = S().spin || { day: 0, last: null }, today = dayKey(), yesterday = dayKey(new Date(Date.now() - 864e5));
    const claimed = lc.last === today;
    const day = claimed ? lc.day : lc.last === yesterday ? (lc.day % 7) + 1 : 1;
    const better = day === 7, lvl = level();
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
    return { day, better, claimed_today: claimed, resets_at: tomorrow.toISOString(), segments: (better ? BETTER : WHEEL).map((s, i) => segment(s, lvl, i)), last: claimed ? lc.result : null, level: lvl };
  };
  const spin = () => {
    const s = state(), u = U();
    if (s.claimed_today) return { spun: false, message: "You already spun today. Come back after the reset.", state: s };
    let r = Math.random() * 100, idx = 0;
    while (idx < s.segments.length - 1 && (r -= s.segments[idx].weight) > 0) idx += 1;
    const seg = s.segments[idx];
    const result = { index: idx, id: seg.id, label: seg.label, rarity: seg.rarity, better: s.better, day: s.day };
    if (seg.kind === "gold") u.gold += seg.qty;
    else if (seg.kind === "pearls") u.pearls = (u.pearls || 0) + seg.qty;
    else if (seg.kind === "bait" || seg.kind === "crafted") u.bait[seg.item] = (u.bait[seg.item] || 0) + seg.qty;
    else if (seg.kind === "fish" || seg.kind === "mythic") { const f = grantFish(seg.kind === "mythic" ? "mythic" : seg.rarity); result.fish = f; result.label = `${f.name} (${f.variant}, ${f.weight} kg)`; }
    else if (seg.kind === "skin") {
      const owned = new Set(u.owned_rod_skins || []), left = Object.keys(SKINS).filter((k) => !owned.has(k));
      if (!left.length) { u.pearls += 25; result.label = "25 Pearls (you own every wheel skin)"; }
      else { const k = left[Math.floor(Math.random() * left.length)]; u.owned_rod_skins = [...owned, k]; result.label = SKINS[k]; }
    }
    if (s.better) { u.pearls = (u.pearls || 0) + BONUS_PEARLS; result.bonus_pearls = BONUS_PEARLS; }
    u.stats.spins = (u.stats.spins || 0) + 1;
    S().spin = { day: s.day, last: dayKey(), result };
    save();
    return { spun: true, result, state: state() };
  };
  return { state, spin };
}
