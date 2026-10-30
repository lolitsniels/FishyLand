/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, ago, wtText } from "../lib/api";
import { useGame } from "../context/GameContext";
import { usePrefs } from "../lib/prefs";
import { X } from "lucide-react";
import { LeapingFish } from "./LeapingFish";
import { t as tt } from "../i18n";
import { sfx } from "../lib/sound";

const HIDDEN_KEY = "owo_hidden_alerts";
const loadHidden = () => { try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); } };
const saveHidden = (h) => localStorage.setItem(HIDDEN_KEY, JSON.stringify([...h].slice(-200)));
const FADE_MS = 8000;
const CHEER_MS = 25000;  // catches stay up longer so anglers can watch the cheers roll in

function AutoFade({ onDone, children, ms = FADE_MS }) {
  const [hover, setHover] = useState(false);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (hover) { setOut(false); return undefined; }
    const t1 = setTimeout(() => setOut(true), ms);
    const t2 = setTimeout(onDone, ms + 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [hover, ms]);
  return <div className={`alert-fade ${out ? "alert-out" : ""}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onTouchStart={() => setHover(true)}>{children}</div>;
}

export default function AlertBanner() {
  const { user } = useGame();
  const nav = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const bossSeen = useRef(new Set());
  const [hidden, setHidden] = useState(loadHidden);
  const [expanded, setExpanded] = useState(null);
  const { legendary_alerts } = usePrefs();
  const hide = (a) => setHidden((h) => { const n = new Set([...h, `${a.id}:${a.status}`]); saveHidden(n); return n; });
  useEffect(() => {
    const load = () => api.get("/alerts/live").then((r) => {
      const fresh = r.data.filter((a) => a.status === "boss" && !bossSeen.current.has(a.id));
      if (fresh.length && bossSeen.current.init) sfx("boss", 5000);
      if (bossSeen.current.init && r.data.some((a) => (a.status === "crate" || a.status === "random") && !bossSeen.current.has(a.id))) sfx("level", 5000);
      r.data.forEach((a) => ["boss", "crate", "random"].includes(a.status) && bossSeen.current.add(a.id)); bossSeen.current.init = true;
      setAlerts(r.data);
    }).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);
  const cheer = async (a) => {
    try {
      const r = await api.post(`/alerts/${a.id}/cheer`);
      setAlerts((as) => as.map((x) => (x.id === a.id ? { ...x, cheers: r.data.cheers, cheered: true } : x)));
    } catch (e) { toast.error(errMsg(e)); }
  };
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const CATCH_NOTES = ["hooked", "landed", "lost", "boss_hooked", "boss_landed", "boss_lost", "random_done"];  // hidden on mobile: they cover the screen
  const crate = !mobile && alerts.find((a) => a.status === "crate" && !hidden.has(`${a.id}:${a.status}`));
  const randomEv = alerts.find((a) => a.status === "random" && !hidden.has(`${a.id}:${a.status}`));
  const visible = alerts.filter((a) => a.status !== "crate" && a.status !== "random" && !hidden.has(`${a.id}:${a.status}`) && (legendary_alerts || a.username === user.username || !["hooked", "landed", "lost"].includes(a.status)) && !(mobile && CATCH_NOTES.includes(a.status))
    && !(a.status === "duel" && (a.username === user.username || !user.duel_access))).slice(0, 2);
  if (visible.length === 0 && !crate && !randomEv) return null;
  return (
    <>
    {randomEv && !crate && <RandomEventBanner a={randomEv} canGo={!!randomEv.water_key && randomEv.water_key !== user.water && user.unlocked_waters.includes(randomEv.water_key)} onGo={() => nav("/game/waters")} onClose={() => hide(randomEv)} />}
    {crate && <CratePullBanner a={crate} me={crate.username === user.username} onCheer={() => cheer(crate)} onClose={() => hide(crate)} />}
    {visible.length > 0 && <div className="alert-float" data-testid="alert-banner">
      {visible.map((a) => (
        <AutoFade key={`${a.id}:${a.status}`} onDone={() => hide(a)} ms={["landed", "boss_landed"].includes(a.status) ? CHEER_MS : FADE_MS}>
        <div className={`alert-card pointer-events-auto flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-[12px] alert-in ${a.status === "lost" || a.status === "boss_lost" ? "alert-lost" : a.rarity === "mythic" ? "alert-mythic" : a.status.startsWith("boss") ? "alert-boss" : "alert-ember"}`} data-testid={`alert-${a.id}`}>
          <span className={`font-display text-[11px] tracking-widest uppercase ${a.status === "lost" || a.status === "boss_lost" ? "text-[#f0a5a3]" : a.rarity === "mythic" ? "rar-mythic" : "text-[var(--gold)]"}`}>{{ hooked: a.rarity === "mythic" ? "✦ Mythic hooked" : "◆ Legendary hooked", landed: a.rarity === "mythic" ? "✦ Mythic landed" : "◆ Legendary landed", event: "◆ Expedition", random_done: "★ Random event", announce: "◆ Harbourmaster's notice", boss: "☠ Boss stirring", duel: "⚔ Duel challenge", boss_hooked: "☠ Boss hooked", boss_landed: "☠ Boss slain", boss_lost: "☠ Boss escaped" }[a.status] || tt("◆ Lost")}</span>
          <span className={`text-[#f4ead2] flex-1 min-w-0 basis-full order-last cursor-pointer ${expanded === a.id ? "" : "line-clamp-1"}`} title={tt("Tap to expand")} onClick={() => setExpanded((x) => (x === a.id ? null : a.id))} data-testid="alert-text">{wtText(a.text)}{a.status === "landed" && a.variant !== "normal" && <span className="tag tag-variant ml-1.5">{a.variant}</span>}</span>
          {(a.status === "event" || a.status === "boss" || a.status === "announce") ? <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">{tt("ends in")} {Math.max(0, Math.ceil((new Date(a.end) - Date.now()) / 60000))}m</span> : <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">{ago(a.at)}</span>}
          {(a.status === "event" || a.status === "boss") && a.water_key !== user.water && user.unlocked_waters.includes(a.water_key) && <button className="btn btn-sm btn-gold" onClick={() => nav("/game/waters")} data-testid={`goto-${a.id}`}>{tt("Go")}</button>}
          {a.status === "duel" && a.username !== user.username && <button className="btn btn-sm btn-gold" onClick={() => { hide(a); nav("/game/duel"); }} data-testid={`duel-go-${a.id}`}>{tt("Go to Duels")}</button>}
          {a.username !== user.username && ["landed", "boss_landed"].includes(a.status) && (
            <button className={`btn btn-sm ${a.cheered ? "" : "btn-gold"}`} disabled={a.cheered} onClick={() => cheer(a)} data-testid={`cheer-${a.id}`}><LeapingFish size={13} /> {a.cheered ? tt("Cheered") : tt("Cheer")} · {a.cheers}</button>
          )}
          {a.username === user.username && ["landed", "boss_landed"].includes(a.status) && <span className="text-[11px] text-[var(--gold)] num">{a.cheers} {tt("cheers")}</span>}
          <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={() => hide(a)} data-testid={`dismiss-${a.id}`}><X size={13} /></button>
        </div>
        </AutoFade>
      ))}
    </div>}
    </>
  );
}

function CratePullBanner({ a, me, onCheer, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, CHEER_MS); return () => clearTimeout(t); }, [a.id]); // eslint-disable-line
  return (
    <div className={`crate-pull crate-pull-${a.rarity}`} data-testid="crate-pull-banner" role="status">
      <div className="crate-pull-rays" aria-hidden="true" />
      <img src={`/art/gear/${a.gear_id}.webp`} alt="" className="crate-pull-rod" draggable="false" />
      <div className="min-w-0 flex-1">
        <div className={`font-display text-[11px] tracking-[.2em] uppercase rar-${a.rarity}`}>{a.rarity === "mythic" ? "✦ Mythic crate pull ✦" : "◆ Legendary crate pull ◆"}</div>
        <div className="font-display text-[19px] sm:text-[22px] text-[#f4ead2] leading-tight" data-testid="crate-pull-title"><b className="text-[#ffcf8a]">{a.username}</b> pulled the <span className={`rar-${a.rarity}`}>{a.species}</span></div>
        <div className="text-[12px] text-[var(--text-2)]" data-testid="crate-pull-text">{a.text}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {!me && <button className={`btn btn-sm ${a.cheered ? "" : "btn-gold"}`} disabled={a.cheered} onClick={onCheer} data-testid="crate-pull-cheer">{a.cheered ? "Cheered" : "Cheer"} · {a.cheers}</button>}
        <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose} aria-label="Dismiss" data-testid="crate-pull-dismiss"><X size={15} /></button>
      </div>
    </div>
  );
}

const EV_ART = { goldfish: "/art/fish_v2/21.webp", salvage: "/art/gear/crate_silver.webp", quickdraw: "/art/gear/crate_gold.webp" };
const EV_TITLE = { goldfish: "Hidden Goldfish", salvage: "Shipwreck Salvage", quickdraw: "Chat Quick-Draw" };

function RandomEventBanner({ a, canGo, onGo, onClose }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []);
  const mins = Math.max(0, Math.ceil((new Date(a.end) - Date.now()) / 60000));
  return (
    <div className="crate-pull crate-pull-event" data-testid="random-event-banner" role="status">
      <div className="crate-pull-rays" aria-hidden="true" />
      <img src={EV_ART[a.kind] || EV_ART.salvage} alt="" className="crate-pull-rod" draggable="false" />
      <div className="min-w-0 flex-1">
        <div className="font-display text-[11px] tracking-[.2em] uppercase text-[#7fe0d0]" data-testid="random-event-label">★ {tt("Random event")} ★</div>
        <div className="font-display text-[19px] sm:text-[22px] text-[#f4ead2] leading-tight" data-testid="random-event-title">{tt(EV_TITLE[a.kind] || "Random event")}</div>
        <div className="text-[12px] text-[var(--text-2)]" data-testid="random-event-text">{a.text.replace(/^RANDOM EVENT: /, "")}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] text-[var(--muted)] whitespace-nowrap" data-testid="random-event-timer">{tt("ends in")} {mins}m</span>
        {canGo && <button className="btn btn-sm btn-gold" onClick={onGo} data-testid="random-event-go">{tt("Go")}</button>}
        <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose} aria-label="Dismiss" data-testid="random-event-dismiss"><X size={15} /></button>
      </div>
    </div>
  );
}
