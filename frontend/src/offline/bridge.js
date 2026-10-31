// Playgama Bridge glue for the offline build: storage, pause/audio, game_ready, interstitial + rewarded ads.
export const OFFLINE = process.env.REACT_APP_OFFLINE === "1";
const SAVE_KEY = "fishyland_save", KV_KEY = "fishyland_prefs";
const b = () => (OFFLINE ? window.bridge : null);
let saved = { [SAVE_KEY]: null, [KV_KEY]: null };
const pauseFns = new Set();
const reasons = new Set();
const emit = () => pauseFns.forEach((fn) => fn(reasons.has("platform") || reasons.has("ad") || reasons.has("hidden"), reasons.has("audio")));
const setReason = (r, on) => { if (on) reasons.add(r); else reasons.delete(r); emit(); };
export const onPlatformPause = (fn) => { pauseFns.add(fn); fn(reasons.has("platform") || reasons.has("ad"), reasons.has("audio")); return () => pauseFns.delete(fn); };

export async function initBridge() {
  const br = b();
  if (!br) return;
  await br.initialize();
  // English is the game's only language; platform.language is read once at start as the source language
  const lang = br.platform.language || "en";
  document.documentElement.lang = lang.startsWith("en") ? lang : "en";
  const vals = await br.storage.get([SAVE_KEY, KV_KEY]);
  const parse = (v) => { if (v == null) return null; try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return null; } };
  saved = { [SAVE_KEY]: parse(vals?.[0]), [KV_KEY]: parse(vals?.[1]) };
  Object.assign(kvData, saved[KV_KEY] || {});
  const E = br.EVENT_NAME;
  br.platform.on(E.PAUSE_STATE_CHANGED, (p) => setReason("platform", !!p));
  br.platform.on(E.AUDIO_STATE_CHANGED, (on) => setReason("audio", !on));
  const adState = (st) => { if (st === "opened") setReason("ad", true); if (st === "closed" || st === "failed") setReason("ad", false); };
  br.advertisement.on(E.INTERSTITIAL_STATE_CHANGED, adState);
  br.advertisement.on(E.REWARDED_STATE_CHANGED, adState);
  if (br.platform.isAudioEnabled === false) setReason("audio", true);
  document.addEventListener("visibilitychange", () => setReason("hidden", document.hidden));
}

export const loadSave = async () => saved[SAVE_KEY];
let tSave = null, pendingState = null;
// coalesced: one write per burst of progress (a catch, a sale, a purchase)
export function saveSoon(state) {
  pendingState = state;
  clearTimeout(tSave);
  tSave = setTimeout(() => { const v = JSON.stringify(pendingState); b()?.storage.set([SAVE_KEY], [v]).catch(() => {}); }, 1500);
}

// localStorage/sessionStorage stand-ins: prefs persist through Bridge storage, session keys stay in memory
const kvData = {};
const sessionData = {};
let tKv = null;
const flushKv = () => { clearTimeout(tKv); tKv = setTimeout(() => b()?.storage.set([KV_KEY], [JSON.stringify(kvData)]).catch(() => {}), 800); };
const mk = (data, persist) => ({
  getItem: (k) => (k in data ? data[k] : null),
  setItem: (k, v) => { if (data[k] === String(v)) return; data[k] = String(v); if (persist) flushKv(); },
  removeItem: (k) => { if (!(k in data)) return; delete data[k]; if (persist) flushKv(); },
  clear: () => { Object.keys(data).forEach((k) => delete data[k]); if (persist) flushKv(); },
  key: (i) => Object.keys(data)[i] ?? null,
  get length() { return Object.keys(data).length; },
});
export const ls = OFFLINE ? mk(kvData, true) : window.localStorage;
export const ss = OFFLINE ? mk(sessionData, false) : window.sessionStorage;

let readySent = false;
export function gameReady() { if (readySent || !b()) return; readySent = true; b().platform.sendMessage("game_ready").catch?.(() => {}); }
export function interstitial(placement) { try { b()?.advertisement.showInterstitial(placement); } catch { /* ads unavailable */ } }
export const rewardedSupported = () => !!b()?.advertisement?.isRewardedSupported;
// resolves true only when the ad reached the "rewarded" state
export function showRewarded(placement) {
  const br = b();
  if (!br) return Promise.resolve(false);
  return new Promise((res) => {
    let got = false, done = false;
    const on = (st) => {
      if (st === "rewarded") got = true;
      if (!done && (st === "closed" || st === "failed")) { done = true; br.advertisement.off?.(br.EVENT_NAME.REWARDED_STATE_CHANGED, on); res(got); }
    };
    br.advertisement.on(br.EVENT_NAME.REWARDED_STATE_CHANGED, on);
    try { br.advertisement.showRewarded(placement); } catch { res(false); }
  });
}
