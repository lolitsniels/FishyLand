/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Avatar } from "./Avatar";
import { t as tt } from "../i18n";
import { PixelIcon } from "./PixelIcon";

// Follows a duellist around the game: shows the queue pill on any page and the "opponent found" popup with its accept timer.
export const DUEL_WATCH_KEY = "owo_duel_watch";
export const setDuelWatch = (on) => { if (on) localStorage.setItem(DUEL_WATCH_KEY, "1"); else localStorage.removeItem(DUEL_WATCH_KEY); window.dispatchEvent(new Event("duel-watch")); };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function DuelWatcher() {
  const { user, setUser } = useGame();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [on, setOn] = useState(() => !!localStorage.getItem(DUEL_WATCH_KEY));
  const [s, setS] = useState(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const readyRef = useRef(false);
  useEffect(() => { const f = () => setOn(!!localStorage.getItem(DUEL_WATCH_KEY)); window.addEventListener("duel-watch", f); return () => window.removeEventListener("duel-watch", f); }, []);
  const poll = useCallback(async () => {
    try {
      const r = await api.get("/duel/state"); const d = r.data; setS(d);
      if (d.user) setUser(d.user);
      (d.notices || []).forEach((n) => toast.message(n));
      if (d.match?.status === "live" && readyRef.current) { readyRef.current = false; nav("/game/duel"); }
      if (!d.queue && !d.match) setDuelWatch(false);
    } catch (e) { if ([401, 403].includes(e?.response?.status)) setDuelWatch(false); }  // a dropped request must not silence the popup
  }, [setUser, nav]);
  const paused = pathname === "/game/duel" && s?.match?.status === "live";  // the pier page drives a live duel itself; stay out of its way
  useEffect(() => {
    if (!on || !user?.duel_access || paused) return undefined;
    poll(); const t = setInterval(poll, 2000);
    const wake = () => { if (document.visibilityState === "visible") poll(); };  // phones pause timers in the background
    document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [on, user?.duel_access, paused, poll]);
  // Fresh tab / other device: ask the server once whether this angler is queued or matched, so the popup can't be missed for lack of a local flag.
  useEffect(() => { if (!user?.duel_access || on) return; api.get("/duel/state").then((r) => { if (r.data.queue || (r.data.match && r.data.match.status !== "done")) setDuelWatch(true); }).catch(() => {}); }, [user?.duel_access]); // eslint-disable-line
  useEffect(() => { if (s?.match?.status === "pending") setLeft(s.match.accept_seconds); }, [s?.match?.status, s?.match?.accept_seconds]);
  useEffect(() => { if (s?.match?.status !== "pending") return undefined; const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000); return () => clearInterval(t); }, [s?.match?.status]);
  if (!on || !s || !user?.duel_access) return null;
  const m = s.match;
  const onPier = pathname === "/game/duel";
  const act = async (path) => { setBusy(true); try { const r = await api.post(path); setS(r.data); if (r.data.user) setUser(r.data.user); if (path === "/duel/accept") readyRef.current = r.data.match?.status === "pending"; if (r.data.match?.status === "live") nav("/game/duel"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };

  if (m?.status === "pending") {
    const opp = m.players[m.opponent]; const mineAccepted = m.accepted.includes(m.me);
    return (
      <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" data-testid="duel-accept-modal" role="dialog" aria-modal="true">
        <div className="panel panel-gold max-w-md w-full p-5 duel-pop">
          <div className="font-display text-[11px] uppercase tracking-[.2em] text-[var(--gold)] flex items-center gap-2"><PixelIcon name="duel" size={13} /> {tt("Opponent found")}</div>
          <div className="flex items-center gap-3 mt-3">
            <Avatar id={opp.avatar} name={opp.username} size="md" frame={opp.frame} />
            <div className="min-w-0"><div className="font-display text-[16px] text-[#f4ead2] truncate">{opp.username}</div><div className="text-[12px] text-[var(--text-2)] num">{tt("Level")} {opp.level} · {m.water_name}</div></div>
            <div className={`ml-auto num text-[30px] leading-none ${left <= 5 ? "text-[#f0a5a3]" : "text-[#f4ead2]"}`} data-testid="duel-accept-timer">{left}</div>
          </div>
          <p className="text-[12px] text-[var(--muted)] mt-3">{mineAccepted ? tt("You're ready, waiting for your opponent to accept…") : `Accept within ${left}s or the entry fee is forfeit. Declining also forfeits the ${s.cost} energy.`}</p>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-gold btn-lg flex-1" disabled={busy || mineAccepted} onClick={() => act("/duel/accept")} data-testid="duel-accept-button">{mineAccepted ? tt("Ready ✓") : tt("Accept duel")}</button>
            {!mineAccepted && <button className="btn" disabled={busy} onClick={() => act("/duel/decline")} data-testid="duel-decline-button">{tt("Decline")}</button>}
          </div>
        </div>
      </div>
    );
  }
  if (m?.status === "live" && !onPier) {
    return <button className="duel-pill duel-pill-live" onClick={() => nav("/game/duel")} data-testid="duel-live-pill"><PixelIcon name="duel" size={13} /> {tt("Duel in progress ·")} {mmss(m.seconds_left)} {tt("left, return to the pier")}</button>;
  }
  if (s.queue && !onPier) {
    return (
      <div className="duel-pill" data-testid="duel-queue-pill">
        <Timer size={13} className="duel-spin" /> {tt("In duel queue ·")} <span className="num">{mmss(s.queue.waiting)}</span>
        <button className="underline ml-2 hover:text-[var(--gold)]" disabled={busy} onClick={async () => { setBusy(true); try { const r = await api.delete("/duel/queue"); setS(r.data); if (r.data.user) setUser(r.data.user); setDuelWatch(false); toast.message(tt("Left the queue, {{v0}} energy returned", { v0: s.cost })); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } }} data-testid="duel-queue-pill-leave">{tt("leave")}</button>
      </div>
    );
  }
  return null;
}
