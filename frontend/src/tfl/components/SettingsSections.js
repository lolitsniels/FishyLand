/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { pushSupported, currentSubscription, enablePush, disablePush, isIosBrowser } from "../lib/push";
import { usePrefs, setPref, autoScale } from "../lib/prefs";
import { sfx } from "../lib/sound";
import { useGame } from "../context/GameContext";
import { t as tt } from "../i18n";

const Toggle = ({ label, hint, checked, onChange, disabled, testId }) => (
  <label className={`flex items-start gap-2.5 cursor-pointer ${disabled ? "opacity-60 cursor-default" : ""}`}>
    <input type="checkbox" className="mt-0.5 accent-[var(--gold)]" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} data-testid={testId} />
    <span className="min-w-0"><span className="block text-[12.5px] text-[#e6dcc6]">{label}</span>{hint && <span className="block text-[11px] text-[var(--muted)]">{hint}</span>}</span>
  </label>
);

export function NotificationSettings() {
  const { user } = useGame();
  const supported = pushSupported();
  const [prefs, setPrefs] = useState({ boss: false, expedition: false, energy: false, events: false, tournaments: false, random: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supported) return;
    Promise.all([api.get("/push/status"), currentSubscription()]).then(([r, sub]) => {
      if (sub && r.data.subscribed) setPrefs(r.data.prefs);
    }).catch(() => {});
  }, [supported]);

  const change = async (k, v) => {
    const next = { ...prefs, [k]: v };
    setBusy(true);
    try {
      if (!next.boss && !next.expedition && !next.energy && !next.events && !next.tournaments && !next.random) { await disablePush(); setPrefs(next); toast.success(tt("Browser alerts off")); return; }
      const sub = await currentSubscription();
      if (!sub) {
        const r = await enablePush(next);
        if (!r.ok) {
          toast.error(r.reason === "denied" ? "Notifications are blocked for this site in your browser settings." : r.reason === "unsupported" ? "This browser can't show notifications." : "Could not enable alerts.");
          return;
        }
      } else await api.post("/push/prefs", next);
      setPrefs(next); toast.success(tt("Alerts updated"));
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-2" data-testid="settings-notifications">
      <div className="font-display text-[13px] text-[#f4ead2]">{tt("Browser notifications")}</div>
      {!supported ? <div className="text-[11.5px] text-[var(--muted)]" data-testid="settings-push-unsupported">{tt("This browser can't show notifications from Fishing Realms.")}</div>
      : user.is_guest ? <div className="text-[11.5px] text-[#f59a5c]">{tt("Claim your account first to receive alerts.")}</div>
      : (
        <>
          <div className="text-[11.5px] text-[var(--muted)]">{tt("Get a notification even when the game tab is closed. Your browser will ask for permission the first time you turn one on.")}</div>
          <Toggle label={tt("Boss spawns")} hint={tt("One ping when a legendary boss starts stirring a water (~every 8 hours).")} checked={prefs.boss} onChange={(v) => change("boss", v)} disabled={busy} testId="settings-push-boss" />
          <Toggle label={tt("Expeditions")} hint={tt("One ping when a rare-fish expedition begins.")} checked={prefs.expedition} onChange={(v) => change("expedition", v)} disabled={busy} testId="settings-push-expedition" />
          <Toggle label={tt("Random events")} hint={tt("A ping when a surprise Hidden Goldfish, Shipwreck Salvage or Chat Quick-Draw starts (a few times a day, crates to win).")} checked={prefs.random} onChange={(v) => change("random", v)} disabled={busy} testId="settings-push-random" />
          <Toggle label={tt("Tournament buy-in open")} hint={tt("A ping every time a tournament opens for buy-in (about every 3 hours, one hour before it starts).")} checked={prefs.tournaments} onChange={(v) => change("tournaments", v)} disabled={busy} testId="settings-push-tournaments" />
          <Toggle label={tt("Tournaments & duels")} hint={tt("A ping 10 minutes before a tournament you entered starts, when it goes live, and when a duel opponent is found.")} checked={prefs.events} onChange={(v) => change("events", v)} disabled={busy} testId="settings-push-events" />
          <Toggle label={tt("Energy full")} hint={tt("One ping each time your energy has refilled to the maximum.")} checked={prefs.energy} onChange={(v) => change("energy", v)} disabled={busy} testId="settings-push-energy" />
          <div className="text-[11px] text-[var(--muted)]">{tt("Phones: works on Android in Chrome/Edge/Firefox.")} {isIosBrowser() ? <span className="text-[#f59a5c]">{tt("On iPhone/iPad you must first add the game to your Home Screen (Share → Add to Home Screen) and open it from there.")}</span> : tt("On iPhone/iPad it only works from the Home Screen app.")}</div>
        </>
      )}
    </div>
  );
}

export function DisplaySettings() {
  const p = usePrefs();
  const { user } = useGame();
  return (
    <div className="space-y-2" data-testid="settings-display">
      <div className="font-display text-[13px] text-[#f4ead2]">{tt("Display")}</div>
      <div className="flex items-start gap-2.5" data-testid="settings-theme">
        <span className="min-w-0 flex-1"><span className="block text-[12.5px] text-[#e6dcc6]">{tt("Colour theme")}</span><span className="block text-[11px] text-[var(--muted)]">{tt("Dark harbour at night, or light parchment for bright rooms.")}</span></span>
        <div className="flex border border-[var(--border-2)] rounded-[2px] overflow-hidden shrink-0">
          {[["dark", tt("Dark")], ["light", tt("Light")]].map(([v, lbl]) => <button key={v} type="button" className={`px-2.5 py-1 text-[12px] ${(p.theme || "dark") === v ? "bg-[var(--gold)] text-[#1a110c]" : "text-[var(--text-2)] hover:text-[var(--gold)]"}`} onClick={() => setPref("theme", v)} data-testid={`settings-theme-${v}`}>{lbl}</button>)}
        </div>
      </div>
      <Toggle label={tt("Chat timestamps")} hint={tt("Show the HH:MM time in front of every chat line.")} checked={p.chat_timestamps} onChange={(v) => setPref("chat_timestamps", v)} testId="settings-chat-timestamps" />
      <Toggle label={tt("Legendary & mythic catch alerts")} hint={tt("Show the banner up top when anyone on the server hooks, lands or loses a legendary or mythic. Turning it off still records the catch. It just stops the banner covering your screen.")} checked={p.legendary_alerts} onChange={(v) => setPref("legendary_alerts", v)} testId="settings-legendary-alerts" />
      <Toggle label={tt("Catch share buttons")} hint={tt("Show the small social share buttons on the catch card after you land a fish.")} checked={p.share_buttons} onChange={(v) => setPref("share_buttons", v)} testId="settings-share-buttons" />
      <Toggle label={tt("Game sounds")} hint={tt("Soft sounds for casting, bites, reeling, catches, level ups, bosses and messages.")} checked={p.sound_on} onChange={(v) => { setPref("sound_on", v); if (v) setTimeout(() => sfx("achievement", 0), 50); }} testId="settings-sound-on" />
      <label className={`flex items-center gap-3 pl-6 ${p.sound_on ? "" : "opacity-50"}`}>
        <span className="text-[12px] text-[var(--text-2)] w-14">{tt("Volume")}</span>
        <input type="range" min="0.05" max="1" step="0.05" value={p.sound_volume} disabled={!p.sound_on} onChange={(e) => setPref("sound_volume", Number(e.target.value))} onMouseUp={() => sfx("catch", 0)} onTouchEnd={() => sfx("catch", 0)} className="flex-1 accent-[var(--gold)]" data-testid="settings-sound-volume" />
        <span className="num text-[11px] text-[var(--muted)] w-9 text-right" data-testid="settings-sound-volume-value">{Math.round(p.sound_volume * 100)}%</span>
      </label>
      <Toggle label={tt("Chat mention sound")} hint={tt("A soft bell when someone writes @yourname in chat.")} checked={p.sound_mention} onChange={(v) => { setPref("sound_mention", v); if (v) setTimeout(() => sfx("mention", 0), 50); }} disabled={!p.sound_on} testId="settings-sound-mention" />
      <div className="flex items-start gap-2.5" data-testid="settings-toasts">
        <span className="min-w-0 flex-1"><span className="block text-[12.5px] text-[#e6dcc6]">{tt("Pop-up messages")}</span><span className="block text-[11px] text-[var(--muted)]">{tt("The small notes that slide in after an action (\"Landed\", \"Sold\", \"Not enough gold\"…). \"Errors only\" keeps just the red ones.")}</span></span>
        <div className="flex border border-[var(--border-2)] rounded-[2px] overflow-hidden shrink-0">
          {[["all", tt("All")], ["errors", tt("Errors only")], ["off", tt("Off")]].map(([v, lbl]) => <button key={v} type="button" className={`px-2 py-1 text-[12px] ${(p.toasts || "all") === v ? "bg-[var(--gold)] text-[#1a110c]" : "text-[var(--text-2)] hover:text-[var(--gold)]"}`} onClick={() => setPref("toasts", v)} data-testid={`settings-toasts-${v}`}>{lbl}</button>)}
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <span className="min-w-0 flex-1"><span className="block text-[12.5px] text-[#e6dcc6]">{tt("Units")}</span><span className="block text-[11px] text-[var(--muted)]">{tt("kg & cm, or lb & inches, for every fish weight and length in the game. Picked from your region by default.")}</span></span>
        <div className="flex border border-[var(--border-2)] rounded-[2px] overflow-hidden shrink-0" data-testid="settings-weight-unit">
          {[["kg", "kg · cm"], ["lb", "lb · in"]].map(([u, lbl]) => <button key={u} type="button" className={`px-2.5 py-1 text-[12px] num ${p.weight_unit === u ? "bg-[var(--gold)] text-[#1a110c]" : "text-[var(--text-2)] hover:text-[var(--gold)]"}`} onClick={() => setPref("weight_unit", u)} data-testid={`settings-weight-${u}`}>{lbl}</button>)}
        </div>
      </div>
      <div className="space-y-1.5">
        <span className="block"><span className="block text-[12.5px] text-[#e6dcc6]">{tt("Interface size")}</span><span className="block text-[11px] text-[var(--muted)]">{tt("Scales the whole game. Auto picks by screen width (currently")} {Math.round(autoScale() * 100)}{tt("%) so big monitors don't get a small strip in the middle.")}</span></span>
        <div className="inline-flex border border-[var(--border-2)] rounded-[2px] overflow-hidden flex-wrap" data-testid="settings-ui-scale">
          {[["auto", "Auto"], ["1", "100%"], ["1.1", "110%"], ["1.2", "120%"], ["1.35", "135%"], ["1.5", "150%"]].map(([v, lbl]) => <button key={v} type="button" className={`px-2 py-1 text-[12px] num ${String(p.ui_scale) === v ? "bg-[var(--gold)] text-[#1a110c]" : "text-[var(--text-2)] hover:text-[var(--gold)]"}`} onClick={() => setPref("ui_scale", v)} data-testid={`settings-ui-scale-${v}`}>{lbl}</button>)}
        </div>
      </div>
    </div>
  );
}

export function TutorialSettings({ onClose }) {
  const { setUser } = useGame();
  const nav = useNavigate();
  const replay = async () => {
    try { const r = await api.post("/tutorial/restart"); setUser(r.data.user); onClose?.(); nav("/game"); toast.message(tt("The Harbourmaster clears his throat…")); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-2" data-testid="settings-tutorial">
      <div className="font-display text-[13px] text-[#f4ead2]">{tt("Tutorial")}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11.5px] text-[var(--muted)]">{tt("Walk through the harbour with Aldous Crane again: fishing, keepnet, market, quests.")}</div>
        <button className="btn btn-sm shrink-0" onClick={replay} data-testid="settings-replay-tutorial">{tt("Replay tutorial")}</button>
      </div>
    </div>
  );
}
