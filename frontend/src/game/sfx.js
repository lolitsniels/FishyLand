import { useGame } from "../store";

let ctx = null;
const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());

function tone(freq, dur, type = "sine", vol = 0.15, delay = 0, slide = 0) {
  const a = ac();
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.2, freq = 1200) {
  const a = ac();
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  f.type = "lowpass";
  f.frequency.value = freq;
  g.gain.value = vol;
  src.buffer = buf;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

const SOUNDS = {
  cast: () => noise(0.35, 0.12, 2500),
  splash: () => noise(0.5, 0.25, 900),
  bite: () => { tone(880, 0.15, "triangle", 0.2); tone(1320, 0.2, "triangle", 0.15, 0.1); },
  land: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, "triangle", 0.14, i * 0.09)),
  legendary: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, "sawtooth", 0.07, i * 0.08)),
  snap: () => { tone(220, 0.4, "square", 0.12, 0, -150); noise(0.2, 0.2, 400); },
  click: () => tone(660, 0.06, "triangle", 0.08),
  coin: () => { tone(1200, 0.08, "square", 0.06); tone(1600, 0.12, "square", 0.06, 0.07); },
};

export function sfx(name) {
  const g = useGame.getState();
  if (!g.settings.sound || g.paused || g.platformMuted) return;
  try { SOUNDS[name]?.(); } catch (e) { /* audio blocked */ }
}

// Procedural looping fantasy soundtrack (self-contained, no external files).
const PROG = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
let musicGain = null, musicTimer = null, beat = 0;

function scheduleBar() {
  const a = ac(), t = a.currentTime + 0.05, chord = PROG[beat % PROG.length];
  chord.forEach((f) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = f / 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + 3.9);
    o.connect(g).connect(musicGain); o.start(t); o.stop(t + 4);
  });
  [0, 1, 2, 1, 2, 0, 2, 1].forEach((n, i) => {
    const o = a.createOscillator(), g = a.createGain(), st = t + i * 0.5;
    o.type = "triangle"; o.frequency.value = chord[n] * 2;
    g.gain.setValueAtTime(0.045, st); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.45);
    o.connect(g).connect(musicGain); o.start(st); o.stop(st + 0.5);
  });
  beat++;
}

export function startMusic() {
  try {
    const a = ac();
    if (a.state === "suspended") a.resume();
    if (musicTimer) return;
    musicGain = a.createGain();
    musicGain.connect(a.destination);
    applyAudio();
    scheduleBar();
    musicTimer = setInterval(scheduleBar, 4000);
  } catch (e) { /* audio blocked */ }
}

export function applyAudio() {
  const st = useGame.getState();
  if (musicGain) musicGain.gain.value = st.settings.music ? 1 : 0;
  if (!ctx) return;
  if (st.paused || st.platformMuted) ctx.suspend().catch(() => {});
  else if (musicTimer) ctx.resume().catch(() => {});
}
