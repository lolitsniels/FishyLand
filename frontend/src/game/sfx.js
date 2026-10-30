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
  if (!useGame.getState().settings.sound) return;
  try { SOUNDS[name]?.(); } catch (e) { /* audio blocked */ }
}
