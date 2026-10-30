/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Waves } from "lucide-react";
import { t as tt } from "../i18n";

export function useExpedition() {
  const [ev, setEv] = useState(null);
  useEffect(() => {
    const load = () => api.get("/events").then((r) => setEv(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  return ev;
}

export const countdown = (isoStr) => {
  const s = Math.max(0, (new Date(isoStr) - Date.now()) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

// Compact expedition status block used on fishing, waters and harbour pages.
export const ExpeditionPanel = ({ ev, waterKey }) => {
  const { user, setUser } = useGame();
  const nav = useNavigate();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  if (!ev) return null;
  const here = ev.active && ev.active.water === waterKey;
  const travel = async () => { try { const r = await api.post("/waters/travel", { water: ev.active.water }); setUser(r.data); nav("/game/fish"); } catch {} };
  if (ev.active) {
    return (
      <div className={`border px-3 py-2 text-[12.5px] flex items-center gap-3 ${here ? "border-[var(--energy)] bg-[#2a1a10]" : "border-[var(--border-2)] bg-[var(--bg-2)]"}`} data-testid="expedition-panel">
        <Waves size={15} className="text-[var(--energy)] shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-display text-[11px] tracking-widest uppercase text-[var(--energy)] mr-2">{ev.active.name}</span>
          <span className="text-[#e2dbd3]">{here ? tt("Rare fish are flooding this water") : `Rare fish are flooding ${ev.active.water_name}`} {tt("· luck +")}{ev.luck}{tt(", bite +")}{ev.bite}{tt("% · ends in")} <span className="num">{countdown(ev.active.end)}</span></span>
        </div>
        {!here && user.unlocked_waters.includes(ev.active.water) && <button className="btn btn-sm btn-gold" onClick={travel} data-testid="expedition-travel-button">{tt("Travel there")}</button>}
        {!here && !user.unlocked_waters.includes(ev.active.water) && <span className="text-[11px] text-[var(--muted)]">{tt("locked for you")}</span>}
      </div>
    );
  }
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-[12px] text-[var(--text-2)]" data-testid="expedition-panel">
      <Waves size={13} className="text-[var(--muted)] inline-block align-[-2px] mr-1.5" />{tt("Next expedition:")} <b className="text-[var(--text)]">{ev.next.name}</b> {tt("at")} <b className="text-[var(--text)]">{ev.next.water_name}</b> {tt("in")} <span className="num">{countdown(ev.next.start)}</span>{tt(". One hour of rare fish for everyone there.")}
    </div>
  );
};
