// Real in-game art for a reward (spin wheel, duel ladder).
const GEAR = { gold: "coins", pearls: "pearl", potion: "potion_energy", scrap: "scrap", seal: "seal" };

export function prizeArt({ kind, item, species_id }) {
  if (kind === "fish") return `/art/fish_v2/${species_id}.webp`;
  if (kind === "mythic") return "/art/fish_v2/358.webp";
  if (kind === "xp") return "/art/boost/xp6.webp";
  if (kind.startsWith("crate_")) return `/art/gear/${kind}.webp`;
  if (GEAR[kind]) return `/art/gear/${GEAR[kind]}.webp`;
  return `/art/gear/${item}.webp`;
}
