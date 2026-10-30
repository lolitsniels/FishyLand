import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useGame } from "../store";
import { fx, setPhase as setFxPhase } from "./fx";
import { FightSim } from "./sim";
import { sfx } from "./sfx";
import { t } from "../i18n";
import { showInterstitial } from "../portal";

const TICK_MS = 1000 / 30;
const phase = (p) => { setFxPhase(p); useGame.getState().setPhase(p); };

export function useFishing() {
  const timers = useRef([]);
  const raf = useRef(0);
  const s = useGame;

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const finish = useCallback(async (enc, holds, clientOutcome) => {
    if (!holds.length) {
      const st = s.getState();
      phase("lost");
      sfx("snap");
      st.setLostMsg(t(clientOutcome === "snapped" ? "snapped" : "escaped"));
      st.pushSystem("You never reeled — the fish got away.", "lost");
      later(() => { st.setLostMsg(null); phase("idle"); showInterstitial(); }, 1600);
      return;
    }
    phase("resolving");
    try {
      const { data } = await api.post("/fish/land", { encounter_id: enc.encounter_id, holds });
      const st = s.getState();
      st.setPlayer(data.player);
      if (data.outcome === "landed") {
        phase("landed");
        const f = data.fish;
        sfx(["legendary", "mythic"].includes(f.rarity) ? "legendary" : "land");
        st.pushSystem(`Landed ${f.variant ? f.variant + " " : ""}${f.name} (${f.weight} kg) · +${data.xp} XP`, f.rarity);
        data.drops.forEach((d) => st.pushSystem(`Drop: ${st.data.items[d.item_id]?.name} x${d.qty}`, "drop"));
        if (data.level_ups) { st.pushSystem(`LEVEL UP! You reached Lv.${data.player.level} · stamina refilled`, "level"); toast.success(`Level up! Lv.${data.player.level}`); }
        st.setResult(data);
      } else {
        phase("lost");
        sfx("snap");
        st.setLostMsg(t(data.outcome));
        st.pushSystem(t(data.outcome), "lost");
        later(() => { st.setLostMsg(null); phase("idle"); showInterstitial(); }, 1600);
      }
    } catch (e) {
      toast.error(errMsg(e));
      s.getState().pushSystem(errMsg(e), "lost");
      phase("idle");
    }
  }, [s]);

  const startFight = useCallback((enc) => {
    const sim = new FightSim(enc.params);
    const holds = [];
    let start = null;
    let t0 = performance.now(), last = t0;
    fx.limit = enc.params.limit_ticks;
    phase("fight");
    const loop = () => {
      const nowMs = performance.now();
      if (nowMs - last > 250 || s.getState().paused) t0 += nowMs - last; // freeze the fight while paused / tab hidden
      last = nowMs;
      const target = Math.floor((nowMs - t0) / TICK_MS);
      while (sim.tick < target && !sim.outcome) {
        const h = fx.hold;
        if (h && start === null) start = sim.tick;
        if (!h && start !== null) { holds.push([start, sim.tick]); start = null; }
        sim.step(h);
      }
      fx.pos = sim.pos; fx.fill = sim.fill; fx.zone = sim.zone; fx.red = sim.red; fx.tick = sim.tick; fx.trick = sim.tf;
      if (sim.outcome) {
        if (start !== null) holds.push([start, sim.tick]);
        finish(enc, holds, sim.outcome);
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, [finish]);

  const cast = useCallback(async () => {
    const st = s.getState();
    if (st.phase !== "idle" || st.modal || st.result || st.paused || st.needTap) return;
    if (st.player.stamina < 1) { toast.error(t("noStamina")); return; }
    phase("cast");
    sfx("cast");
    fx.target = { x: 720 + Math.random() * 340, y: 470 + Math.random() * 190 };
    let enc;
    try {
      ({ data: enc } = await api.post("/fish/cast", { bait: st.bait }));
    } catch (e) {
      toast.error(errMsg(e));
      phase("idle");
      return;
    }
    const sp = st.data.species.find((x) => x.id === enc.species_id);
    fx.speciesImg = sp.img; fx.rarity = enc.rarity; fx.weight = enc.weight;
    fx.pos = 0.5; fx.fill = 0.15; fx.zone = 0; fx.tick = 0;
    const items = { ...st.player.items };
    if (st.bait !== "worm") items[st.bait] = Math.max(0, (items[st.bait] || 0) - 1);
    st.patchPlayer({ stamina: enc.stamina, items });
    if (st.bait !== "worm" && !items[st.bait]) st.setBait("worm");
    later(() => phase("wait"), 650);
    later(() => { phase("bite"); sfx("bite"); }, Math.max(700, enc.bite_delay_ms));
    later(() => startFight(enc), Math.max(700, enc.bite_delay_ms) + enc.fight_delay_ms);
  }, [s, startFight]);

  const closeResult = useCallback(() => { s.getState().setResult(null); phase("idle"); showInterstitial(); }, [s]);

  useEffect(() => {
    const down = (e) => {
      if (e.code !== "Space" || e.target.tagName === "INPUT") return;
      e.preventDefault();
      if (e.repeat) return;
      fx.hold = true;
      if (s.getState().phase === "idle") cast();
    };
    const up = (e) => { if (e.code === "Space") fx.hold = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const tm = timers.current;
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      tm.forEach(clearTimeout);
      cancelAnimationFrame(raf.current);
    };
  }, [cast, s]);

  return { cast, closeResult };
}
