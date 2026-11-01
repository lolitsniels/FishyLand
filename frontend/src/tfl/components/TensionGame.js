/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { t as tt } from "../i18n";
import { sfx } from "../lib/sound";
import { fx } from "../../game/fx";

// One-bar fight: HOLD pushes the needle right, LET GO and it drifts back left. The fish shoves it around;
// keep it inside the green middle to fill the progress bar. Pinned right = line snaps, pinned left = fish shakes loose.
const REEL_BG = { backgroundImage: "url(/art/fight/reel_sheet.png)" };
const TRICK_MSG = { dive: "IT DIVES! It drags the needle left, hold on!", run: "LONG RUN! It drags the needle right, ease off!", leap: "IT LEAPS! The line whips both ways!" };
const MOVE_MSG = { left: ["It gives slack!", "It swims toward you!"], right: ["It jerks the line!", "It pulls hard!"], diver: "It dives for the bottom!", runner: "It runs!" };

export default function TensionGame({ enc, onFinish }) {
  const [view, setView] = useState({ pos: 50, progress: 0, time: enc.time_limit, msg: enc.hint || "Fish on!", zw: enc.zone_width });
  const [hold, setHoldState] = useState(false);
  const holding = useRef(false), holdStart = useRef(null), holds = useRef([]), reelTick = useRef(null);
  const startedAt = useRef(0), done = useRef(false), btnRef = useRef(null);
  useEffect(() => () => clearInterval(reelTick.current), []);
  useEffect(() => {
    const el = btnRef.current, block = (e) => { if (e.cancelable) e.preventDefault(); };
    el?.addEventListener("touchstart", block, { passive: false }); el?.addEventListener("touchend", block, { passive: false });
    document.body.classList.add("fighting");
    return () => { el?.removeEventListener("touchstart", block); el?.removeEventListener("touchend", block); document.body.classList.remove("fighting"); };
  }, []);

  const setHold = (v) => {
    if (done.current) return;
    setHoldState(v);
    const t = (performance.now() - startedAt.current) / 1000;
    if (v && !holding.current) { holding.current = true; holdStart.current = t; sfx("reel", 0); clearInterval(reelTick.current); reelTick.current = setInterval(() => sfx("reel", 0), 120); }
    else if (!v && holding.current) { holding.current = false; clearInterval(reelTick.current); if (holdStart.current != null) holds.current.push([holdStart.current, t]); holdStart.current = null; }
  };

  useEffect(() => {
    const tricks = enc.tricks || [];
    const schedule = tricks.filter((x) => ["dive", "run", "leap"].includes(x)).flatMap((t) => [{ t, at: 22 + Math.random() * 25 }, ...(enc.trick_repeat ? [{ t, at: 62 + Math.random() * 18 }] : [])]).sort((a, b) => a.at - b.at);
    const jerkScale = enc.erratic <= 1 ? enc.erratic : Math.min(1.6, 1 + 0.35 * (enc.erratic - 1));
    const s = { pos: 50, vel: 0, progress: enc.start_progress || 0, time: enc.time_limit, push: 0, pushT: 0, jerk: 0, nextEvent: 1.4, over: 0, slack: 0, msg: enc.hint || "Fish on!", msgT: 3,
      trick: null, trickT: 0, windDone: false, windT: 0, sm: 1, panicOn: false, phase: 1 };
    const started = performance.now();
    startedAt.current = started;
    let last = started, gameTime = 0, raf;
    const say = (m, t = 1.4) => { s.msg = m; s.msgT = t; };
    const finish = (ok, why) => {
      if (done.current) return;
      done.current = true;
      const elapsed = (performance.now() - started) / 1000;
      if (holding.current && holdStart.current != null) { holds.current.push([holdStart.current, elapsed]); holding.current = false; clearInterval(reelTick.current); }
      onFinish(ok, elapsed, why, holds.current, gameTime, s.progress);
    };
    const tick = (t) => {
      if (done.current) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t; gameTime += dt; s.time -= dt; s.nextEvent -= dt; s.msgT -= dt;
      // the fish's own moves: a shove left or right for a moment, or a sharp jerk
      if (s.nextEvent <= 0 && !s.trick) {
        s.nextEvent = (0.9 + Math.random() * (2.6 / Math.max(0.3, enc.erratic))) * (s.panicOn ? 0.5 : 1);
        const dir = Math.random() < 0.5 ? -1 : 1, r = Math.random();
        if (r < 0.5) { s.jerk = dir * (10 + Math.random() * 14) * jerkScale; say(MOVE_MSG[dir < 0 ? "left" : "right"][Math.floor(Math.random() * 2)]); }
        else { const cap = 0.6 * Math.min(11 + enc.strength * 20, Math.max(8, 34 * enc.recovery - enc.strength * 6)); s.push = dir * Math.min(cap, (8 + Math.random() * 10) * Math.max(0.6, enc.erratic)); s.pushT = 1 + Math.random() * 1.4; say(enc.behavior === "diver" ? MOVE_MSG.diver : enc.behavior === "runner" ? MOVE_MSG.runner : MOVE_MSG[dir < 0 ? "left" : "right"][0]); }
      }
      if (schedule.length && s.progress >= schedule[0].at && !s.trick) {
        const { t: tr } = schedule.shift();
        s.trick = tr; s.trickT = tr === "leap" ? 1.4 : 2.6; say(TRICK_MSG[tr], 2.4);
        if (tr === "leap") s.jerk = 22 * jerkScale;
      }
      if (s.trick) {
        s.trickT -= dt;
        if (s.trick === "dive") s.pos -= 16 * dt; else if (s.trick === "run") s.pos += 16 * dt;
        else if (s.trickT < 0.6 && s.trickT > 0.55) s.jerk = -24 * jerkScale;
        if (s.trickT <= 0) s.trick = null;
      }
      if (tricks.includes("second_wind") && !s.windDone && s.progress >= 60) { s.windDone = true; s.windT = 5; s.sm = 1.25; say("SECOND WIND! It rallies and pulls harder!", 3); }
      if (s.windT > 0) { s.windT -= dt; if (s.windT <= 0) s.sm = 1; }
      if (tricks.includes("panic") && !s.panicOn && s.progress >= 80) { s.panicOn = true; say("It panics near the surface!", 2); s.nextEvent = Math.min(s.nextEvent, 0.4); }
      if (enc.boss && s.phase === 1 && s.progress >= (enc.phase2_at || 50)) { s.phase = 2; s.sm = enc.phase2_strength || 1.35; say("PHASE 2. IT RALLIES!", 3); }
      let zw = enc.zone_width;
      if (tricks.includes("tiring")) zw *= 1 - (1 - (enc.tiring_min || 0.75)) * (s.progress / 100);
      if (s.windT > 0) zw *= 0.85;
      if (enc.boss && s.phase === 2) zw *= enc.phase2_zone || 0.65;
      // the needle: holding pushes right, letting go drifts left (reel level = how fast it comes back)
      const up = 11 + enc.strength * s.sm * 20, down = Math.max(8, 34 * enc.recovery - enc.strength * 6);
      s.pos += (holding.current ? up : -down) * dt;
      if (s.pushT > 0) { s.pushT -= dt; s.pos += s.push * dt; }
      if (Math.abs(s.jerk) > 0.5) { const step = Math.sign(s.jerk) * Math.min(Math.abs(s.jerk) * 3, 45) * dt; s.pos += step; s.jerk -= step; } else s.jerk = 0;
      const inZone = Math.abs(s.pos - 50) <= zw / 2;
      s.progress = Math.max(0, s.progress + (inZone ? (100 / enc.stamina) * dt : -5 * dt));
      if (s.pos >= 100) { s.pos = 100; s.over += dt; } else s.over = Math.max(0, s.over - dt * 2);
      if (s.pos <= 0) { s.pos = 0; s.slack += dt; } else s.slack = Math.max(0, s.slack - dt);
      if (s.over > 0.45 * enc.tolerance) return finish(false, "Your line snapped under the strain.");
      if (s.slack > 1.4) return finish(false, "Too much slack, the fish shook the hook.");
      if (s.time <= 0) return enc.pull ? finish(true, "Time! It gives ground.") : finish(false, "The fish outlasted you and slipped away.");
      if (s.progress >= 100) return finish(true, "Landed!");
      fx.pos = s.pos / 100; fx.fill = s.progress / 100;
      setView({ pos: s.pos, progress: s.progress, time: s.time, zw, msg: s.msgT > 0 ? s.msg : inZone ? "Steady... keep it in the middle." : s.pos > 50 ? "Too tight! Let go a little." : "Too slack! Hold to reel in." });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const typing = (e) => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName) || e.target?.isContentEditable;
    const down = (e) => { if (e.code === "Space" && !typing(e)) { e.preventDefault(); setHold(true); } };
    const upK = (e) => { if (e.code === "Space" && !typing(e)) setHold(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", upK);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", down); window.removeEventListener("keyup", upK); };
  }, [enc, onFinish]); // eslint-disable-line

  const { pos, zw } = view;
  const inZone = Math.abs(pos - 50) <= zw / 2;
  const danger = pos > 90 || pos < 10;
  const lo = 50 - zw / 2, hi = 50 + zw / 2;
  return (
    <div className="space-y-3 fade-in" data-testid="tension-game">
      <div className={`fr-fight ${danger ? "shake" : ""}`} data-testid="fight-instrument">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="fight-msg" style={{ color: danger ? "#ff7a6b" : inZone ? "#ffe27a" : "#e6faff" }} data-testid="fight-message">{view.msg}</span>
          <span className="font-cinzel font-bold text-amber-100 outline-text num">{Math.max(0, view.time).toFixed(1)}s</span>
        </div>
        <div className="fr-panel p-1.5 !rounded-full">
          <div className="relative h-8 rounded-full overflow-hidden border border-black/70" data-testid="tension-frame"
            style={{ background: `linear-gradient(90deg, #ff2d2d 0%, #ff8a1f ${Math.max(4, lo - 16)}%, #ffd33b ${Math.max(5, lo - 3)}%, #3dff7f ${lo}%, #3dff7f ${hi}%, #ffd33b ${Math.min(95, hi + 3)}%, #ff8a1f ${Math.min(96, hi + 16)}%, #ff2d2d 100%)` }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/35" />
            <div className="absolute top-0 bottom-0 border-x-2 border-white/85 shadow-[0_0_12px_#3dff7f]" style={{ left: `${lo}%`, width: `${zw}%` }} data-testid="tension-zone-box" />
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/50" />
            <div className="absolute top-[-4px] bottom-[-4px] w-[8px] -ml-[4px] bg-white rounded shadow-[0_0_10px_#fff,0_0_22px_#7ff3ff]" style={{ left: `${pos}%` }} data-testid="tension-needle" />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/85 outline-text">SLACK</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/85 outline-text">SNAP</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className={`font-cinzel font-black text-sm outline-text w-28 ${danger ? "text-red-400" : inZone ? "text-emerald-300" : "text-amber-300"}`} data-testid="tension-zone">{danger ? (pos > 50 ? "SNAPPING!" : "SLIPPING!") : inZone ? "PERFECT" : "CAREFUL"}</span>
          <div className="flex-1 fr-bar !h-3.5" data-testid="progress-frame"><i style={{ width: `${view.progress}%`, background: "linear-gradient(90deg,#1fd3ff,#3dff7f,#fff2a6)", transition: "none" }} data-testid="progress-fill" /></div>
          <span className="font-cinzel font-bold text-sm text-amber-100 outline-text w-12 text-right num">{Math.round(view.progress)}%</span>
        </div>
      </div>
      <button ref={btnRef} type="button" className={`btn btn-lg w-full reel-btn ${hold ? "btn-gold holding" : ""}`}
        onDoubleClick={(e) => e.preventDefault()}
        onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ } if (e.pointerType === "touch") navigator.vibrate?.(12); setHold(true); }}
        onPointerUp={() => setHold(false)} onPointerCancel={() => setHold(false)} onLostPointerCapture={() => setHold(false)}
        onContextMenu={(e) => e.preventDefault()} data-testid="reel-button">
        <span className={`reel-spin reel-spin-sm ${hold ? "on" : ""}`} style={REEL_BG} aria-hidden />{hold ? tt("Reeling...") : tt("Hold to reel")}<span className="hidden lg:inline"> {tt("(or Space)")}</span>
      </button>
    </div>
  );
}
