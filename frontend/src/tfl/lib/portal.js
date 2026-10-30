// Portal mode (GameDistribution "gd", Smaz Games "smaz", Playgama "pg"): only when the game runs inside an iframe opened with ?portal=gd|smaz.
export const GD_GAME_ID = "6125e447803340d2badcf321ad44ec4b";
const KEY = "fl_portal", REF_KEY = "fl_gd_ref", PORTALS = ["gd", "smaz", "pg"];
const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
const params = new URLSearchParams(window.location.search);
if (framed && PORTALS.includes(params.get("portal"))) localStorage.setItem(KEY, params.get("portal"));
if (params.get("gd_sdk_referrer_url")) sessionStorage.setItem(REF_KEY, params.get("gd_sdk_referrer_url"));

export const PORTAL = framed && PORTALS.includes(localStorage.getItem(KEY)) ? localStorage.getItem(KEY) : null;
export const PORTAL_SOURCE = { gd: "gamedistribution", smaz: "smazgames", pg: "playgama" }[PORTAL] || null;
// itch.io build: same full game, but opens on a game-style start screen instead of the website homepage.
if (framed && params.get("portal") === "itch") sessionStorage.setItem("fl_start", "itch");
export const START_SCREEN = PORTAL || (framed && sessionStorage.getItem("fl_start") === "itch" ? "itch" : null);
export const PORTAL_BLOCKED = ["/game/support", "/game/vote", "/game/recruit"];
// Playgama forbids any real-money purchase prompt (Angler Pass, boosters, cosmetics).
export const NO_IAP = PORTAL === "pg";

let started = false, onStart = null;

// Portal mode: keeps outgoing links and pop-ups from leaving the game; GameDistribution also loads its SDK, Smaz Games talks to the wrapper's SDK.
export function initPortal() {
  if (!PORTAL) return;
  document.documentElement.classList.add("portal-gd");
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest?.("a[href]");
    if (a && a.origin !== window.location.origin) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  window.open = () => null;
  // sandboxed portal frames can't show browser dialogs (confirm() silently returns false), so the in-game warnings stand on their own
  window.confirm = () => true;
  if (PORTAL !== "gd") {
    // the wrapper page (Smaz / Playgama SDK) relays pause / mute to us, and keeps the login token in the platform's save storage
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent) return;
      if (e.data?.fl === "host") window.__flMuted = !!(e.data.muted || e.data.paused);
      if (e.data?.fl === "restore" && e.data.token && !localStorage.getItem("owo_token")) { localStorage.setItem("owo_token", e.data.token); window.location.reload(); }
    });
    let last = null;
    const sync = () => { const t = localStorage.getItem("owo_token"); if (t !== last) { last = t; portalSignal("save", { token: t || "" }); } };
    setInterval(sync, 3000);
    portalSignal("ready");
    return;
  }
  const ref = sessionStorage.getItem(REF_KEY);
  if (ref && !params.get("gd_sdk_referrer_url")) {
    const u = new URL(window.location.href); u.searchParams.set("gd_sdk_referrer_url", ref); window.history.replaceState(null, "", u);
  }
  window.GD_OPTIONS = {
    gameId: GD_GAME_ID,
    onEvent: (e) => {
      if (e.name === "SDK_GAME_PAUSE") window.__flMuted = true;
      if (e.name === "SDK_GAME_START") { window.__flMuted = false; if (onStart) { const f = onStart; onStart = null; f(); } }
    },
  };
  const s = document.createElement("script"); s.id = "gamedistribution-jssdk"; s.src = "https://html5.api.gamedistribution.com/main.min.js";
  document.head.appendChild(s);
}

// Tells the Smaz Games wrapper the player has started playing (it forwards gameplayStart to the SDK).
export const portalSignal = (what, extra) => { if (PORTAL && PORTAL !== "gd") try { window.parent.postMessage({ fl: what, ...extra }, "*"); } catch { /* ignore */ } };

// Plays the GameDistribution pre-roll once per session (on the player's Play click), then runs next(). Falls back to next() if no ad can show.
export function portalPlay(next) {
  portalSignal("play");
  if (PORTAL !== "gd" || started || !window.gdsdk?.showAd) { started = true; next(); return; }
  started = true; onStart = next;
  const done = () => { if (onStart) { const f = onStart; onStart = null; window.__flMuted = false; f(); } };
  setTimeout(done, 45000);
  Promise.resolve(window.gdsdk.showAd()).catch(done);
}
