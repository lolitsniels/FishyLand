// Portal (Playgama Bridge) integration: covers Playgama and GameDistribution with one SDK.
const qs = new URLSearchParams(window.location.search);
export const PORTAL = process.env.REACT_APP_PORTAL === "1" || qs.get("portal") === "1";
const BRIDGE_SRC = "https://bridge.playgama.com/v1/stable/playgama-bridge.js";
const KEYS = ["fr_save", "fr_settings", "fr_tutorial"];

const cache = {};
let bridge = null;
const listeners = { pause: new Set() };

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

export async function initPortal() {
  if (!PORTAL) return;
  try {
    if (!window.bridge) await loadScript(BRIDGE_SRC);
    bridge = window.bridge;
    await bridge.initialize();
    const vals = await bridge.storage.get(KEYS);
    KEYS.forEach((k, i) => { if (vals?.[i] != null) cache[k] = typeof vals[i] === "string" ? vals[i] : JSON.stringify(vals[i]); });
    bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (p) => emitPause("platform", p));
    bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (on) => emitPause("audio", !on));
    bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (st) => {
      if (st === "opened") emitPause("ad", true);
      if (st === "closed" || st === "failed") emitPause("ad", false);
    });
    if (bridge.platform.isAudioEnabled === false) emitPause("audio", true);
  } catch (e) {
    bridge = null; // SDK unavailable (local testing) - game still runs
  }
}

// Pause reasons: ad / platform (tab hidden) / audio (platform muted)
const reasons = new Set();
function emitPause(reason, on) {
  on ? reasons.add(reason) : reasons.delete(reason);
  listeners.pause.forEach((fn) => fn(new Set(reasons)));
}
export const onPause = (fn) => { listeners.pause.add(fn); return () => listeners.pause.delete(fn); };
document.addEventListener("visibilitychange", () => emitPause("hidden", document.hidden));

export const kv = {
  get: (k) => (PORTAL ? cache[k] ?? null : localStorage.getItem(k)),
  set: (k, v) => {
    if (!PORTAL) return localStorage.setItem(k, v);
    cache[k] = v;
    bridge?.storage.set([k], [v]).catch(() => {});
  },
};

export function gameReady() {
  try { bridge?.platform.sendMessage("game_ready"); } catch (e) { /* noop */ }
}

// Natural pause points only; Bridge decides whether an ad really shows.
export function showInterstitial() {
  try { bridge?.advertisement.showInterstitial(); } catch (e) { /* noop */ }
}

export const portalLanguage = () => bridge?.platform.language || navigator.language?.slice(0, 2) || "en";
