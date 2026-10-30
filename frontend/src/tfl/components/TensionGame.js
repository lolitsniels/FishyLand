/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { t as tt } from "../i18n";
import { sfx } from "../lib/sound";
import { fx } from "../../game/fx";

// Real-time tension fight. Hold to reel (tension rises), release to give line (tension falls).
const REEL_BG = { backgroundImage: "url(/art/fight/reel_sheet.png)" };
const WATER_BG = { backgroundImage: "url(/art/fight/water.png)" };
// inlined so the bobber and hook are on screen from the very first frame (no image fetch/decode flash)
const BOBBER_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAWCAYAAAAW5GZjAAAAwUlEQVR4nGNgQAMC3Jz/P7y581+Am/M/uhwTugA+QDvFWAE292I1WYCb8/8lfWWsGpjQFb7vrmRgYGBgmCEuiKGBEd1EGDj24h0DAwMDQ8bL9wwfvn5nhJuMrpCBgYHBSkIIwwbSgg6bqegAZjoLAwMDg8iOPVgVyZw5g+D4htIyuj98/c4oJamIV5GPbyjDh6/fGUl3BjbTz0E9BzMVQ6cAN+f/b59e/P/26cX/I/u2YM0AWDXQJqe4eUUQrxgXAAAYGEqzWf4thgAAAABJRU5ErkJggg==";
const HOOK_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAQCAYAAAAiYZ4HAAAAnklEQVR4nGNgQAMC3Jz/m3pm/G/qmfFfgJvzP7o8VsUC3Jz/kdlEaSJKMbKma/deYNXERJQJVNNAjJvhGgS4Of8fu3yfoCYmdJOLGvvx2sAiwM35v6ixnyEkKIDBSleRkIsYmD58/c7YV18IF/jw9TsjQV0wZ1279wIeyzA2hpOQOWvWbWA4dvk+AwMDA4OVriJh24hOP+iaiFZMDAAAdNVPKUX+RjMAAAAASUVORK5CYII=";

export default function TensionGame({ enc, onFinish }) {
  const [view, setView] = useState({ tension: 40, progress: 0, zc: 50, time: enc.time_limit, msg: "Fish on!", zw: enc.zone_width, phase: 1 });
  const [hold, setHoldState] = useState(false);
  const holding = useRef(false);
  const holdStart = useRef(null);
  const holds = useRef([]);
  const reelTick = useRef(null);
  useEffect(() => () => clearInterval(reelTick.current), []);
  const startedAt = useRef(0);
  const state = useRef(null);
  const done = useRef(false);
  const btnRef = useRef(null);
  const pressRef = useRef(null);  // rhythm / hook set: every new press is a strike
  // iOS Safari: a fast double-tap selects nearby text even with user-select:none. React's touch handlers are passive,
  // so block the native gesture with non-passive listeners and make the whole page unselectable while the fight is on.
  useEffect(() => {
    const el = btnRef.current;
    const block = (e) => { if (e.cancelable) e.preventDefault(); };
    el?.addEventListener("touchstart", block, { passive: false });
    el?.addEventListener("touchend", block, { passive: false });
    document.body.classList.add("fighting");
    return () => { el?.removeEventListener("touchstart", block); el?.removeEventListener("touchend", block); document.body.classList.remove("fighting"); };
  }, []);

  const setHold = (v) => {
    if (done.current) return;
    setHoldState(v);
    if (v && !holding.current) {
      holding.current = true;
      pressRef.current?.();
      sfx("reel", 0); clearInterval(reelTick.current); reelTick.current = setInterval(() => sfx("reel", 0), 120);
      holdStart.current = (performance.now() - startedAt.current) / 1000;
    } else if (!v && holding.current) {
      holding.current = false; clearInterval(reelTick.current);
      if (holdStart.current != null) {
        holds.current.push([holdStart.current, (performance.now() - startedAt.current) / 1000]);
        holdStart.current = null;
      }
    }
  };

  useEffect(() => {
    const tricks = enc.tricks || [];
    const schedule = [];  // progress thresholds at which behaviour tricks fire
    for (const t of tricks.filter((x) => ["dive", "run", "leap"].includes(x))) {
      schedule.push({ t, at: 22 + Math.random() * 25 });
      if (enc.trick_repeat) schedule.push({ t, at: 62 + Math.random() * 18 });
    }
    schedule.sort((a, b) => a.at - b.at);
    const mech = enc.mechanics || [];
    // how hard sudden line jerks hit: grows with how erratic the fish is, but softly and capped so the bobber never teleports across the bar
    const jerkScale = enc.erratic <= 1 ? enc.erratic : Math.min(1.6, 1 + 0.35 * (enc.erratic - 1));
    const s = { tension: 40, progress: enc.start_progress || 0, needleAt: mech.includes("needle") ? 55 + Math.random() * 7 : 999, needleT: 0, beat: null, hook: null,
      rhythmAt: mech.includes("rhythm") ? 22 + Math.random() * 8 : 999, hookAt: mech.includes("hookset") ? 40 + Math.random() * 8 : 999,
      zc: 50, drift: 0, time: enc.time_limit, jerk: 0, run: 0, nextEvent: 1.2, over: 0, slack: 0, msg: "Fish on!", msgT: 0, zw: enc.zone_width, phase: 1, sm: 1,
      trickT: 0, trick: null, leapT: 0, windDone: false, windT: 0, panicOn: false, zwBase: enc.zone_width };
    const TRICK_MSG = { dive: "IT DIVES, ease off, the sweet spot drops!", run: "LONG RUN, keep the pressure on!", leap: "IT LEAPS, take up the slack!" };
    state.current = s;
    const started = performance.now();
    startedAt.current = started;
    let last = started;
    let gameTime = 0;  // simulated seconds (dt is capped, so this lags wall-clock on slow phones / after a screen lock)
    const finish = (ok, why) => {
      if (done.current) return;
      done.current = true;
      const elapsed = (performance.now() - started) / 1000;
      // close any in-flight hold interval
      if (holding.current && holdStart.current != null) {
        holds.current.push([holdStart.current, elapsed]);
        holdStart.current = null;
        holding.current = false; clearInterval(reelTick.current);
      }
      onFinish(ok, elapsed, why, holds.current, gameTime, state.current?.progress || 0);
    };
    const startBeat = () => {
      const gap = 0.62;
      const notes = Array.from({ length: 6 }, (_, i) => ({ t: 1.4 + i * gap + (i % 3 === 2 ? gap * 0.5 : 0), st: 0 }));
      s.beat = { clock: 0, notes, hits: 0, perfect: 0, misses: 0 };
      s.msg = "RHYTHM STRIKE! Press when each note is inside the box."; s.msgT = 2.5;
    };
    const startHook = () => {
      s.hook = { ready: 1.1, x: 0, dir: 1, speed: 75, mark: 25 + Math.random() * 50, hits: 0, misses: 0, fx: null, fxT: 0 };
      s.msg = "GET READY... it's turning to run! Set the hook."; s.msgT = 1.1;
    };
    const strikeHook = () => {
      const h = s.hook;
      if (h.ready > 0) return;
      const good = Math.abs(h.x - h.mark) <= 6;
      if (good) { h.hits++; h.speed *= 1.25; h.mark = 12 + Math.random() * 76; navigator.vibrate?.(30); } else { h.misses++; navigator.vibrate?.([10, 40, 10]); }
      h.fx = good ? "hit" : "miss"; h.fxT = 0.35;
      s.msg = good ? `Hook bites deeper! ${h.hits}/3` : `Missed! ${3 - h.misses} left before it shakes loose.`; s.msgT = 1;
      if (h.misses >= 3) return finish(false, "It shook the hook loose.");
      if (h.hits >= 3) { s.hook = null; s.progress += 6; s.msg = "Hook set! Back to the fight."; s.msgT = 1.6; }
    };
    pressRef.current = () => {
      if (s.hook) return strikeHook();
      const b = s.beat;
      if (!b) return;
      const n = b.notes.find((x) => !x.st && Math.abs(x.t - b.clock) <= 0.16);
      if (!n) {
        // off the beat: a press close to a note burns that note; in a paused rhythm round any stray press costs a little
        const near = b.notes.find((x) => !x.st && Math.abs(x.t - b.clock) <= 0.45);
        if (near) { near.st = -1; b.misses++; b.fx = "miss"; b.fxAt = b.clock; }
        else s.progress = Math.max(0, s.progress - 1);
        return;
      }
      const perfect = Math.abs(n.t - b.clock) <= 0.07;
      n.st = perfect ? 2 : 1; b.hits++; if (perfect) b.perfect++;
      b.fx = perfect ? "perfect" : "good"; b.fxAt = b.clock;
      navigator.vibrate?.(perfect ? 25 : 10);
    };
    const beatTick = (dt) => {
      const b = s.beat;
      b.clock += dt;
      for (const n of b.notes) if (!n.st && b.clock - n.t > 0.16) { n.st = -1; b.misses++; b.fx = "miss"; b.fxAt = b.clock; }
      if (b.endT != null) { b.endT -= dt; if (b.endT <= 0) s.beat = null; return; }  // brief tail so the last note's feedback shows
      if (b.notes.every((n) => n.st)) {
        const all = b.misses === 0;
        s.progress = Math.max(0, s.progress + b.hits * 2 + b.perfect - b.misses * 5 + (all ? 5 : 0));
        s.msg = all ? `PERFECT RUN! ${b.hits}/${b.notes.length} on the beat.` : `${b.hits}/${b.notes.length} on the beat.`; s.msgT = 2;
        b.endT = 0.45;
      }
    };
    const beatView = () => s.beat && { ...s.beat, notes: s.beat.notes.map((n) => ({ ...n })) };
    const tick = (t) => {
      if (done.current) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      gameTime += dt;
      const free = !s.beat && !s.hook && s.needleT <= 0;
      if (free && s.progress >= s.rhythmAt) { s.rhythmAt = 999; startBeat(); }
      else if (free && s.progress >= s.hookAt) { s.hookAt = 999; startHook(); }
      if (s.hook) {  // the fish turns to run: the fight pauses while you set the hook
        const h = s.hook;
        if (h.ready > 0) h.ready -= dt;
        else { h.x += h.dir * h.speed * dt; if (h.x >= 100) { h.x = 100; h.dir = -1; } if (h.x <= 0) { h.x = 0; h.dir = 1; } }
        h.fxT -= dt; s.msgT -= dt;
        setView((v) => ({ ...v, msg: s.msgT > 0 ? s.msg : "Strike when the marker crosses the gold mark!", hook: s.hook && { ...s.hook }, progress: s.progress }));
        requestAnimationFrame(tick);
        return;
      }
      if (s.beat) {  // the fish thrashes at the surface: the fight pauses while you strike
        beatTick(dt);
        s.msgT -= dt;
        setView((v) => ({ ...v, msg: s.msgT > 0 ? s.msg : "Tap on the beat!", beat: beatView(), progress: s.progress }));
        requestAnimationFrame(tick);
        return;
      }
      if (s.beat) beatTick(dt);
      s.time -= dt;
      s.nextEvent -= dt;
      if (s.nextEvent <= 0 && s.needleT <= 0) {
        const panicMult = s.panicOn ? 0.5 : 1;
        s.nextEvent = (0.9 + Math.random() * (2.6 / Math.max(0.3, enc.erratic))) * panicMult;
        const r = Math.random();
        if (r < 0.55) { s.jerk = (Math.random() < 0.65 ? 1 : -1) * (12 + Math.random() * 18) * jerkScale; s.msg = s.jerk > 0 ? "It jerks the line!" : "It gives slack!"; }
        else if (r < 0.85) { s.run = 1.2 + Math.random() * 1.5; s.msg = enc.behavior === "diver" ? "It dives!" : "It runs!"; }
        else { s.drift = (Math.random() - 0.5) * 70 * Math.max(0.6, enc.erratic); s.msg = "It changes direction."; }
        s.msgT = 1.2;
      }
      // --- fish tricks (server-assigned per encounter) ---
      if (schedule.length && s.progress >= schedule[0].at && !s.trick) {
        const { t } = schedule.shift();
        s.trick = t; s.trickT = t === "leap" ? 1.6 : 3; s.leapT = 0; s.msg = TRICK_MSG[t]; s.msgT = 2.5;
        if (t === "leap") s.jerk = 28 * jerkScale;
      }
      if (s.trick) {
        s.trickT -= dt;
        if (s.trick === "dive") s.zc += (20 - s.zc) * Math.min(1, dt * 2.5);
        else if (s.trick === "run") s.zc += (80 - s.zc) * Math.min(1, dt * 2.5);
        else if (s.trick === "leap") { s.leapT += dt; if (s.leapT > 0.9 && s.leapT < 1.0) s.jerk = -30 * jerkScale; }
        if (s.trickT <= 0) { s.trick = null; s.drift = 0; }
      }
      if (tricks.includes("second_wind") && !s.windDone && s.progress >= 60) {
        s.windDone = true; s.windT = 5; s.sm = 1.25; s.msg = "SECOND WIND, it rallies! Sweet spot narrows, it pulls harder."; s.msgT = 3;
      }
      if (s.windT > 0) { s.windT -= dt; if (s.windT <= 0) s.sm = 1; }
      if (tricks.includes("panic") && !s.panicOn && s.progress >= 80) { s.panicOn = true; s.msg = "It panics near the surface!"; s.msgT = 2; s.nextEvent = Math.min(s.nextEvent, 0.4); }
      if (!enc.boss) {
        let zw = s.zwBase;
        if (tricks.includes("tiring")) zw *= 1 - (1 - (enc.tiring_min || 0.75)) * (s.progress / 100);
        if (s.windT > 0) zw *= 0.85;
        if (!s.beat && s.progress >= s.needleAt) { s.needleAt = 999; s.needleT = 4.5; s.needleIn = 0; s.msg = "NEEDLE! The sweet spot is a thread, hold it there!"; s.msgT = 2.5; }
        if (s.needleT > 0) {
          s.needleT -= dt; zw = 10; s.drift = 0; s.jerk = 0; s.run = 0;
          if (s.needleT <= 0) { const good = s.needleIn >= 2.5; s.progress = Math.max(0, s.progress + (good ? 12 : -6)); s.msg = good ? "Threaded the needle! Big gain." : "It slipped the needle."; s.msgT = 2; }
        }
        s.zw = zw;
      }
      s.msgT -= dt;
      if (s.run > 0) s.run -= dt;
      const runMult = s.run > 0 ? 1.8 : 1;
      if (enc.boss && s.phase === 1 && s.progress >= (enc.phase2_at || 50)) {
        s.phase = 2; s.zw = enc.zone_width * (enc.phase2_zone || 0.65); s.sm = enc.phase2_strength || 1.35;
        s.jerk = 30 * enc.erratic; s.msg = "PHASE 2. IT RALLIES! Second wind: the sweet spot narrows and it pulls harder."; s.msgT = 4;
      }
      const zw = s.zw;
      // needle: the line goes fine and slow, so small taps steer the bobber (the zone holds still)
      const fine = s.needleT > 0 ? 0.32 : 1;
      const pull = (11 + enc.strength * s.sm * 20) * runMult;
      if (holding.current) s.tension += pull * dt * fine;
      else s.tension -= (34 * enc.recovery - enc.strength * 6) * dt * fine;
      // jerks shove at most 50/s so holding or letting go can always fight back
      if (Math.abs(s.jerk) > 0.5) { const step = Math.sign(s.jerk) * Math.min(Math.abs(s.jerk) * 3, 50) * dt; s.tension += step; s.jerk -= step; } else s.jerk = 0;
      // sweet-spot wander
      if (fine === 1) {
        s.drift += (Math.random() - 0.5) * 60 * enc.erratic * dt;
        s.drift *= 0.985;
        s.zc += s.drift * dt;
      }
      const lo = zw / 2 + 4, hi = 100 - zw / 2 - 4;
      if (s.zc < lo) { s.zc = lo; s.drift = Math.abs(s.drift); }
      if (s.zc > hi) { s.zc = hi; s.drift = -Math.abs(s.drift); }
      // progress
      const inZone = s.tension >= s.zc - zw / 2 && s.tension <= s.zc + zw / 2;
      const needle = s.needleT > 0;
      if (needle && inZone) s.needleIn += dt;
      // needle: normal gain, harsh slip; the reward comes at the end if you held it ~3 of the 4.5 seconds
      s.progress += inZone ? (100 / enc.stamina) * dt * (needle ? 0.6 : 1) : (needle ? -9 : -5) * dt;
      if (s.beat || needle || s.hookAt < 999 && s.progress > s.hookAt) s.progress = Math.min(s.progress, 95);  // can't land mid-mechanic
      s.progress = Math.max(0, s.progress);
      // fail states
      if (s.tension >= 100) { s.tension = 100; s.over += dt; } else s.over = Math.max(0, s.over - dt * 2);
      if (s.tension <= 0) { s.tension = 0; s.slack += dt; } else s.slack = Math.max(0, s.slack - dt);
      if (s.over > 0.45 * enc.tolerance) return finish(false, "Your line snapped under the strain.");
      if (s.slack > 1.4) return finish(false, "Too much slack, the fish shook the hook.");
      if (s.time <= 0) return enc.pull ? finish(true, "Time! The leviathan gives ground.") : finish(false, "The fish outlasted you and slipped away.");
      if (s.progress >= 100) return finish(true, enc.pull ? "A perfect haul!" : "Landed!");
      fx.pos = s.tension / 100; fx.fill = s.progress / 100;
      setView({ tension: s.tension, progress: s.progress, zc: s.zc, time: s.time, zw: s.zw, phase: s.phase, needle, beat: beatView(), hook: null, msg: s.msgT > 0 ? s.msg : (inZone ? "Steady... keep it there." : holding.current ? "Tension rising." : "Line going slack.") });
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    const typing = (e) => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName) || e.target?.isContentEditable;
    const down = (e) => { if (e.code === "Space" && !typing(e)) { e.preventDefault(); setHold(true); } };
    const up = (e) => { if (e.code === "Space" && !typing(e)) setHold(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { cancelAnimationFrame(id); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [enc, onFinish]);

  const zw = view.zw;
  const inZone = view.tension >= view.zc - zw / 2 && view.tension <= view.zc + zw / 2;
  const danger = view.tension > 88 || view.tension < 6;
  return (
    <div className="space-y-3 fade-in" data-testid="tension-game">
      <div className={`fish-instrument ${danger ? "fi-danger" : ""}`} data-testid="fight-instrument">
        <span className="fi-bolt tl" /><span className="fi-bolt tr" /><span className="fi-bolt bl" /><span className="fi-bolt br" />
        <div className="fi-plate">
          <span className={`fi-msg ${danger ? "text-[#f0a5a3]" : inZone ? "text-[var(--ok)]" : "text-[var(--text-2)]"}`} data-testid="fight-message">{enc.boss && <span className={`tag mr-2 ${view.phase === 2 ? "text-[#f0a5a3] border-[#d9534f] shake" : "text-[var(--r-legendary)]"}`} data-testid="boss-phase">{tt("Boss · phase")} {view.phase}/2{view.phase === 2 && tt(" · RALLYING")}</span>}{view.msg}</span>
          <span className="fi-dial num">{Math.max(0, view.time).toFixed(1)}s</span>
        </div>
        <div className="fi-body">
          <div className="fi-reel" aria-hidden><span className={`reel-spin ${hold ? "on" : ""} ${danger ? "strain" : ""}`} style={REEL_BG} data-testid="fight-reel" /></div>
          <div className="fi-gauges">
            <div className="fi-row">
              <div className="fi-label"><span>{tt("Line tension")}</span><span className="num">{Math.round(view.tension)}</span></div>
              <div className={`fi-track ${danger ? "shake" : ""}`} style={WATER_BG} data-testid="tension-frame">
                <span className="fi-line" aria-hidden />
                <div className="tension-ticks" aria-hidden />
                <div className={`fi-zone ${view.needle ? "fi-zone-needle" : ""}`} style={{ left: `${view.zc - zw / 2}%`, width: `${zw}%` }} data-testid={view.needle ? "needle-zone" : undefined} />
                <div className="fi-zone-danger" />
                <img src={BOBBER_SRC} alt="" className="fi-bobber" style={{ left: `${view.tension}%` }} draggable="false" decoding="sync" data-testid="tension-needle" />
              </div>
            </div>
            <div className="fi-row">
              <div className="fi-label"><span>{enc.pull ? tt("Haul, every % is a fathom gained") : tt("Landing progress")}</span><span className="num">{Math.round(view.progress)}%</span></div>
              <div className="fi-track fi-track-slim" style={WATER_BG} data-testid="progress-frame">
                <div className="tension-ticks" aria-hidden />
                <div className={`fi-fill ${enc.boss && view.phase === 2 ? "legendary" : ""}`} style={{ width: `${view.progress}%` }} data-testid="progress-fill" />
                <img src={HOOK_SRC} alt="" className="fi-hook" style={{ left: `${view.progress}%` }} draggable="false" decoding="sync" />
                {enc.boss && <div className="progress-marker" style={{ left: `${enc.phase2_at || 50}%` }} title={tt("Phase 2 begins here")} />}
              </div>
            </div>
          </div>
        </div>
        {view.beat && <BeatLane b={view.beat} />}
        {view.hook && <HookBar h={view.hook} />}
        {enc.boss && <div className="fi-note" data-testid="boss-fight-note">{view.phase === 1 ? `It rallies at ${enc.phase2_at || (enc.pull ? 60 : 50)}%.` : "It rallies: hold on."}</div>}
      </div>
      <button
        ref={btnRef}
        type="button"
        className={`btn btn-lg w-full reel-btn ${hold ? "btn-gold holding" : ""}`}
        onDoubleClick={(e) => e.preventDefault()}
        onPointerDown={(e) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} if (e.pointerType === "touch") navigator.vibrate?.(12); setHold(true); }}
        onPointerUp={() => setHold(false)} onPointerCancel={() => setHold(false)} onLostPointerCapture={() => setHold(false)}
        onContextMenu={(e) => e.preventDefault()}
        data-testid="reel-button">
        <span className={`reel-spin reel-spin-sm ${hold ? "on" : ""}`} style={REEL_BG} aria-hidden />{view.hook ? (view.hook.ready > 0 ? tt("Get ready...") : tt("Strike!")) : view.beat ? tt("Strike in the box!") : hold ? tt("Reeling...") : tt("Hold to reel")}<span className="hidden lg:inline"> {tt("(or Space)")}</span>
      </button>
    </div>
  );
}

const TRAVEL = 1.3;  // seconds a note takes to cross the lane
const HIT_X = 16, SPAN = 80;  // hit point and travel distance in % of the lane
const BOX = (0.16 / TRAVEL) * SPAN, CORE = (0.07 / TRAVEL) * SPAN;  // matches the good / perfect timing windows
const FX_TEXT = { perfect: "PERFECT!", good: "GOOD", miss: "MISS" };
function BeatLane({ b }) {
  const fx = b.fx && b.clock - b.fxAt < 0.45 ? b.fx : null;
  return (
    <div className={`beat-lane ${fx ? `fx-${fx}` : ""}`} data-testid="beat-lane">
      <span className="beat-box" style={{ left: `${HIT_X - BOX}%`, width: `${BOX * 2}%` }} data-testid="beat-box">
        <span className="beat-core" style={{ left: `${50 - (CORE / BOX) * 50}%`, width: `${(CORE / BOX) * 100}%` }} />
      </span>
      {fx && <span key={b.fxAt} className={`beat-pop ${fx}`} data-testid="beat-feedback">{FX_TEXT[fx]}</span>}
      {b.notes.filter((n) => n.t - b.clock < TRAVEL && b.clock - n.t < 0.3).map((n) => (
        <span key={n.t} className={`beat-note ${n.st === 2 ? "perfect" : n.st === 1 ? "hit" : n.st === -1 ? "miss" : ""}`}
          style={{ left: `${HIT_X + ((n.t - b.clock) / TRAVEL) * SPAN}%` }}><FishNote /></span>
      ))}
      <span className="beat-score num" data-testid="beat-score">{b.hits}/{b.notes.length}</span>
    </div>
  );
}

const FISH_ROWS = ["...#####....", ".#######..##", "#e#######.#.", "#########.#.", ".#######..##", "...#####...."];
const FISH_D = (ch) => FISH_ROWS.flatMap((r, y) => [...r].map((c, x) => (c === ch ? `M${x} ${y}h1v1h-1z` : ""))).join("");
const FISH_BODY = FISH_D("#"), FISH_EYE = FISH_D("e");
// rhythm note: a little pixel fish swimming at you
function FishNote() {
  return (
    <svg viewBox="0 0 12 6" width="24" height="12" shapeRendering="crispEdges" aria-hidden="true">
      <path d={FISH_BODY} fill="currentColor" /><path d={FISH_EYE} fill="#1b120a" />
    </svg>
  );
}

function HookBar({ h }) {
  return (
    <div className="px-3 pb-3" data-testid="hookset-game">
      <div className={`hookset-bar ${h.fxT > 0 ? h.fx : ""} ${h.ready > 0 ? "ready" : ""}`} data-testid="hookset-bar">
        {h.ready > 0 ? <span className="hookset-ready" data-testid="hookset-ready">{tt("GET READY")}</span> : <>
          <span className="hookset-mark" style={{ left: `${h.mark}%` }} />
          <span className="hookset-marker" style={{ left: `${h.x}%` }} />
        </>}
        <span className="beat-score num" data-testid="hookset-score">{h.hits}/3 · ✕{h.misses}</span>
      </div>
    </div>
  );
}
