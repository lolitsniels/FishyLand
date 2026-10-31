import { useGame } from "../store";

let ctx = null;
const ac = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
// Recorded effects (public/audio/sfx/<name>.mp3), decoded once and played through Web Audio.
const VOLS = { cast: 0.5, splash: 0.55, bite: 0.6, land: 0.55, legendary: 0.55, snap: 0.55, click: 0.35, coin: 0.5 };
const bufs = {};
const load = (name) => (bufs[name] = bufs[name] || fetch(`audio/sfx/${name}.mp3`).then((r) => r.arrayBuffer()).then((d) => ac().decodeAudioData(d)).catch(() => { delete bufs[name]; return null; }));

export function sfx(name) {
  const g = useGame.getState();
  if (!VOLS[name] || !g.settings.sound || g.paused || g.platformMuted || window.__flMuted) return;
  try {
    const a = ac();
    if (a.state === "suspended") a.resume();
    load(name).then((buf) => {
      if (!buf) return;
      const src = a.createBufferSource(), gain = a.createGain();
      src.buffer = buf; gain.gain.value = VOLS[name];
      src.connect(gain).connect(a.destination); src.start();
    });
  } catch (e) { /* audio blocked */ }
}

// One looping soundtrack per map (public/audio/<map>.mp3), cross-faded on travel.
const TRACK = { duel_pier: "harrow", clubhouse: "crew_island" };
const VOL = 0.32;
let track = null, place = "harbour", unlocked = false;

const fade = (el, to, ms, done) => {
  const from = el.volume, t0 = performance.now();
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); el.volume = from + (to - from) * k; k < 1 ? requestAnimationFrame(step) : done?.(); };
  step();
};
const wanted = () => { const st = useGame.getState(); return unlocked && st.settings.music && !st.paused && !st.platformMuted && !window.__flMuted; };

function play() {
  const src = `/audio/${TRACK[place] || place}.mp3`;
  if (!wanted()) { track?.pause(); return; }
  if (track && track.dataset.src === src) { if (track.paused) track.play().catch(() => {}); return; }
  const old = track;
  if (old) fade(old, 0, 900, () => { old.pause(); old.src = ""; });
  track = new Audio(src); track.dataset.src = src; track.loop = true; track.volume = 0;
  track.play().then(() => fade(track, VOL, 1400)).catch(() => {});
}

export function setMusicPlace(key) { place = key; play(); }
export function startMusic() { unlocked = true; play(); }
export function applyAudio() { play(); }
useGame.subscribe((s, p) => { if (s.paused !== p.paused || s.settings.music !== p.settings.music || s.platformMuted !== p.platformMuted) play(); });
