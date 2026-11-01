// Real in-game art for a reward (spin wheel, duel ladder).
const GEAR = { potion: "potion_energy", scrap: "scrap", seal: "seal" };

export function prizeArt({ kind, item, species_id }) {
  if (kind === "fish") return species_id ? `/art/fish_v2/${species_id}.webp` : "/art/spin/mystery_fish.webp";
  if (kind === "gold") return "/art/hud/gold.webp";
  if (kind === "pearls") return "/art/hud/pearl.webp";
  if (kind === "mythic") return "/art/fish_v2/331.webp";
  if (kind === "xp") return "/art/boost/xp6.webp";
  if (kind.startsWith("crate_")) return `/art/gear/${kind}.webp`;
  if (GEAR[kind]) return `/art/gear/${GEAR[kind]}.webp`;
  return `/art/gear/${item}.webp`;
}
