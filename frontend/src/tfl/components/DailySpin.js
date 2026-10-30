/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Panel } from "./ui-bits";
import { Wheel } from "./SpinWheel";
import SpinModal from "./SpinModal";
import { untilText } from "../pages/game/Quests";
import { t as tt } from "../i18n";

const DayLadder = ({ s }) => (
  <div className="flex gap-1 flex-wrap" data-testid="spin-days">
    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
      const st = d < s.day || (d === s.day && s.claimed_today) ? "done" : d === s.day ? "today" : "locked";
      return <span key={d} className={`spin-day spin-day-${st} ${d === 7 ? "spin-day-better" : ""}`} data-testid={`spin-day-${d}`} data-state={st}>{d === 7 ? tt("7 ✦") : d}</span>;
    })}
  </div>
);

export default function DailySpin() {
  const [s, setS] = useState(null);
  const [open, setOpen] = useState(false);
  const load = () => api.get("/daily-spin").then((r) => setS(r.data)).catch(() => {});
  useEffect(() => { load(); window.addEventListener("quests-changed", load); return () => window.removeEventListener("quests-changed", load); }, []);
  if (!s) return null;
  return (
    <Panel icon="admin" title={tt("Daily Spin")} right={<span className="num">{s.claimed_today ? `${tt("next spin in")} ${untilText(s.resets_at)}` : `${tt("day")} ${s.day} ${tt("of 7")}`}</span>} testId="daily-spin">
      <div className="flex items-center gap-3">
        <button className={`shrink-0 ${s.claimed_today ? "opacity-70" : "spin-thumb-ready"}`} onClick={() => setOpen(true)} aria-label={tt("Open the Daily Spin")} data-testid="spin-thumb">
          <Wheel segments={s.segments} better={s.better} size={78} />
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <DayLadder s={s} />
          <div className="text-[12px] text-[var(--text-2)]">
            {s.claimed_today ? <span className="text-[var(--ok)]" data-testid="spin-claimed">{tt("✓ Spun today")}{s.last && <>: <b style={{ color: `var(--r-${s.last.rarity})` }}>{s.last.label}</b></>}</span>
              : s.better ? tt("Day 7: the Better Wheel is ready, with Pearls, crates and a mythic jackpot.") : tt("Spin once a day. Come back every day to reach the Better Wheel on day 7.")}
          </div>
          <div className="text-[11.5px] text-[var(--muted)]">{tt("Miss a day and it resets to day 1.")}</div>
        </div>
        <button className="btn btn-gold shrink-0" onClick={() => setOpen(true)} data-testid="open-spin-button">{s.claimed_today ? tt("View") : tt("Spin")}</button>
      </div>
      {open && <SpinModal state={s} onClose={() => setOpen(false)} onDone={setS} />}
    </Panel>
  );
}
