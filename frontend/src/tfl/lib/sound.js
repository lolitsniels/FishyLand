import { getPrefs } from "./prefs";

// Soft, synthesized game sounds (Web Audio, no files). Respects the sound_on / sound_volume / sound_mention prefs.
let ctx = null;
const last = {};
const ac = () => {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};
if (typeof window !== "undefined") {
  const unlock = () => { ac(); window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
}

const out = (c, vol) => { const g = c.createGain(); g.gain.value = vol; g.connect(c.destination); return g; };

function bell(c, dest, freq, at, dur = 1.2, amp = 0.5) {
  [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => {
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq * m;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp * a, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur / m ** 0.5);
    o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.05);
  });
}

function noise(c, dest, at, dur, { f0 = 1800, f1 = 400, q = 0.8, amp = 0.6, attack = 0.01, type = "bandpass" } = {}) {
  const len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, at); f.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(dest); src.start(at); src.stop(at + dur + 0.02);
}

function tone(c, dest, at, dur, f0, f1, amp = 0.4, type = "sine") {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.02);
}

const SOUNDS = {
  cast: (c, o, t) => { noise(c, o, t, 0.35, { f0: 3000, f1: 900, q: 1.2, amp: 0.25, attack: 0.15 }); noise(c, o, t + 0.42, 0.45, { f0: 900, f1: 250, q: 0.7, amp: 0.55 }); },
  bite: (c, o, t) => { tone(c, o, t, 0.16, 520, 180, 0.5); tone(c, o, t + 0.2, 0.16, 480, 170, 0.4); noise(c, o, t + 0.02, 0.2, { f0: 1200, f1: 300, amp: 0.25 }); },
  reel: (c, o, t) => { noise(c, o, t, 0.035, { f0: 3500, f1: 2500, q: 4, amp: 0.22, attack: 0.002 }); },
  catch: (c, o, t) => { noise(c, o, t, 0.6, { f0: 1400, f1: 200, q: 0.6, amp: 0.6 }); bell(c, o, 784, t + 0.25, 1, 0.3); bell(c, o, 1047, t + 0.38, 1.2, 0.28); },
  rare: (c, o, t) => { [659, 880, 1109, 1319].forEach((f, i) => bell(c, o, f, t + 0.55 + i * 0.12, 1.6, 0.26)); },
  snap: (c, o, t) => { tone(c, o, t, 0.25, 900, 120, 0.35, "triangle"); noise(c, o, t, 0.12, { f0: 5000, f1: 1500, q: 2, amp: 0.4, attack: 0.002 }); },
  level: (c, o, t) => { [523, 659, 784, 1047].forEach((f, i) => bell(c, o, f, t + i * 0.11, 1.4, 0.3)); },
  achievement: (c, o, t) => { bell(c, o, 880, t, 1.2, 0.3); bell(c, o, 1319, t + 0.14, 1.4, 0.28); },
  boss: (c, o, t) => { tone(c, o, t, 1.6, 98, 82, 0.55); tone(c, o, t + 0.05, 1.5, 147, 123, 0.25, "triangle"); noise(c, o, t, 1.2, { f0: 300, f1: 80, q: 0.5, amp: 0.3, attack: 0.3, type: "lowpass" }); },
  pm: (c, o, t) => { bell(c, o, 988, t, 0.8, 0.28); bell(c, o, 740, t + 0.13, 1, 0.26); },
  mention: (c, o, t) => { bell(c, o, 1175, t, 0.9, 0.32); bell(c, o, 1568, t + 0.09, 1.1, 0.26); },
};

export function sfx(name, gapMs = 400) {
  const p = getPrefs();
  if (!p.sound_on || window.__flMuted || (name === "mention" && !p.sound_mention)) return;
  const now = Date.now();
  if (last[name] && now - last[name] < gapMs) return;
  last[name] = now;
  const c = ac(); if (!c || c.state !== "running") return;
  try { SOUNDS[name](c, out(c, Math.max(0, Math.min(1, Number(p.sound_volume) || 0)) * 0.6), c.currentTime + 0.01); } catch { /* audio unavailable */ }
}

export const sfxAchievements = (list) => { if (list && list.length) setTimeout(() => sfx("achievement"), 700); };
export const RARE_UP = ["epic", "legendary", "mythic"];
