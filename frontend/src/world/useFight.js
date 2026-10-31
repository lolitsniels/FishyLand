import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { useGame } from "../store";
import { fx, setPhase as setFxPhase } from "../game/fx";
import { sfx } from "../game/sfx";

const FISH_ART = {
  common: ["glimmer_minnow", "azure_perch"], uncommon: ["lagoon_carp", "coral_snapper"], rare: ["moonfin_trout", "prism_koi"],
  epic: ["stormscale_pike", "crystal_angelfish"], legendary: ["golden_sunray"], mythic: ["starwhale"],
};
export const standInArt = (rarity, seed = 0) => { const a = FISH_ART[rarity] || FISH_ART.rare; return `art/fish/${a[Math.abs(seed) % a.length]}.png`; };
// every species has its own painting in art/fish_v2; the stand-ins cover hidden bites and missing files
export const fishArt = (rarity, seed = 0, speciesId = null) => (speciesId != null ? `art/fish_v2/${speciesId}.webp` : standInArt(rarity, seed));
const phase = (p) => { setFxPhase(p); useGame.getState().setPhase(p); };

// Cast -> bite -> TensionGame (FishyLand rules) -> land, all decided by the FishyLand server.
export function useFight() {
  const { setUser } = useTfl();
  const encRef = useRef(null);
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const cast = useCallback(async () => {
    const st = useGame.getState();
    if (fx.phase !== "idle" || (fx.mode !== "water" && fx.mode !== "duel") || !fx.atSpot || st.result) return;
    if (fx.mode === "duel" && fx.duelPhase === "countdown") { toast("Wait for the duel to start!"); return; }
    phase("cast"); sfx("cast");
    const sp = fx.fishSpot || { x: 560, y: 560 };
    fx.target = sp.cast ? { x: sp.cast[0] + (Math.random() - 0.5) * 60, y: sp.cast[1] + (Math.random() - 0.5) * 30 } : { x: Math.max(690, sp.x + 170 + Math.random() * 220), y: Math.min(760, Math.max(420, sp.y - 50 + Math.random() * 130)) };
    try {
      const { data: r } = await api.post("/fish/cast");
      if (r.user) setUser(r.user);
      later(() => phase("wait"), 650);
      if (r.result !== "hooked") {
        later(() => { phase("idle"); toast(r.message || (r.trash ? `Reeled in junk: ${r.trash.name}` : "Nothing bites.")); }, 1600 + Math.random() * 900);
        return;
      }
      const enc = r.encounter;
      encRef.current = enc;
      fx.speciesImg = fishArt(enc.rarity_hint || "rare", enc.id.charCodeAt(enc.id.length - 1));
      fx.rarity = enc.rarity_hint || "rare";
      later(() => { phase("bite"); sfx("bite"); }, 1400 + Math.random() * 1800);
      later(() => { phase("fight"); useGame.setState({ fightEnc: enc }); }, 2500 + Math.random() * 1800);
    } catch (e) {
      phase("idle"); toast.error(errMsg(e));
    }
  }, [setUser]);

  const finish = useCallback(async (ok, elapsed, why, holds, gameTime) => {
    const enc = encRef.current;
    useGame.setState({ fightEnc: null });
    phase("resolving");
    try {
      const { data: r } = await api.post("/fish/land", { encounter_id: enc.id, success: ok, elapsed, holds, game_time: gameTime });
      if (r.user) setUser(r.user);
      if (r.success) {
        const c = r.catch || {};
        fx.speciesImg = fishArt(c.rarity, (c.species_id || 0), c.species_id);
        phase("landed"); sfx("land");
        useGame.setState({ result: { ...r, img: fx.speciesImg } });
      } else {
        phase("lost"); sfx("snap");
        toast(why || r.message || "It got away.");
        later(() => phase("idle"), 1500);
      }
    } catch (e) {
      phase("idle"); toast.error(errMsg(e));
    }
  }, [setUser]);

  const closeResult = useCallback(() => { useGame.setState({ result: null }); phase("idle"); }, []);
  return { cast, finish, closeResult };
}
