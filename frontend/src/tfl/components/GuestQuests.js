/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { api, fmt } from "../lib/api";
import { Panel, Bar, Gold } from "./ui-bits";
import { t as tt } from "../i18n";

export default function GuestQuests() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.get("/quests").then((r) => setRows(r.data.guest || [])).catch(() => {}), []);
  useEffect(() => {
    load();
    window.addEventListener("quests-changed", load);
    return () => window.removeEventListener("quests-changed", load);
  }, [load]);
  if (!rows || rows.length === 0) return null;
  const allDone = rows.every((q) => q.status === "done");
  if (allDone) return null;

  return (
    <Panel icon="quests" title={tt("Welcome to The Fishing Lands")}
      right={<span className="text-[11px] text-[var(--muted)]">{rows.filter((q) => q.status === "done").length} / {rows.length} {tt("steps")}</span>}
      testId="guest-quests">
      <p className="text-[12px] text-[var(--text-2)] mb-2">
        {tt("Three tiny steps from the Harbourmaster to teach you the ropes. Complete them for a warm bag of gold and a starting title.")}
      </p>
      <ul className="space-y-2">
        {rows.map((q) => {
          const done = q.status === "done";
          const locked = q.status === "locked";
          const active = q.status === "active";
          return (
            <li key={q.id} className={`flex gap-3 items-start p-2 border ${active ? "border-[var(--gold-dim)] bg-[var(--panel-2)]" : "border-[var(--border)]"} ${done ? "opacity-60" : ""}`}
                data-testid={`guest-quest-${q.id}`}>
              <div className={`w-6 h-6 shrink-0 border flex items-center justify-center num text-[11px] ${done ? "border-[var(--ok)] text-[var(--ok)]" : active ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--muted)]"}`}>
                {done ? <Check size={13} /> : locked ? <Lock size={11} /> : q.step}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-medium text-[12.5px] ${done ? "line-through text-[var(--muted)]" : "text-[#f4ead2]"}`}>{q.name}</span>
                  <span className="text-[11px] whitespace-nowrap"><span className="label">{tt("Reward:")}</span> <Gold n={q.reward.gold} className="text-[11px]" /> <span className="text-[var(--xp)] num">+{fmt(q.reward.xp)} {tt("XP")}</span>{q.reward.title && <span className="text-[#f59a5c]"> + "{q.reward.title}"</span>}</span>
                </div>
                {!locked && <p className="text-[11.5px] text-[var(--text-2)] italic mt-0.5">{q.story}</p>}
                <div className="text-[12px] mt-1">{locked ? <span className="text-[var(--muted)]">{tt("Complete the previous step to reveal this one.")}</span> : q.desc}</div>
                {active && (
                  <div className="flex items-center gap-2 mt-1">
                    <Bar value={q.progress} max={q.target} color="var(--gold)" className="flex-1 !h-1.5" />
                    <span className="num text-[10.5px] text-[var(--muted)]">{fmt(q.progress)} / {fmt(q.target)}</span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
