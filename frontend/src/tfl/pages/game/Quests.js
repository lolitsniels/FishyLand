/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Lock, Scroll, Flame } from "lucide-react";
import { api, errMsg, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Bar, Empty, Pearls } from "../../components/ui-bits";
import GuestQuests from "../../components/GuestQuests";
import { t as tt } from "../../i18n";

export const untilText = (isoStr) => {
  const s = Math.max(0, (new Date(isoStr).getTime() - Date.now()) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const Reward = ({ r, className = "" }) => (
  <span className={`text-[11.5px] sm:whitespace-nowrap ${className}`}><span className="label">{tt("Reward:")}</span> <Gold n={r.gold} className="text-[11.5px]" /> <span className="text-[var(--xp)] num">+{fmt(r.xp)} {tt("XP")}</span>{r.pearls > 0 && <> · <Pearls n={r.pearls} className="text-[11.5px]" /></>}{r.title && <span className="text-[#f59a5c]"> {tt("+ title \"")}{r.title}"</span>}</span>
);

export const QuestRow = ({ q, compact = false }) => {
  const done = q.status === "done";
  return (
    <li className={`flex gap-2 items-start py-1.5 border-b border-[#221e1b] last:border-0 ${done ? "opacity-60" : ""}`} data-testid={`quest-${q.id.split(":")[0]}`}>
      <div className={`w-5 h-5 mt-0.5 shrink-0 border flex items-center justify-center ${done ? "border-[var(--ok)] text-[var(--ok)]" : "border-[var(--border)] text-[var(--muted)]"}`}>{done ? <Check size={12} /> : <Scroll size={11} />}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2"><span className={`font-medium text-[12.5px] ${done ? "line-through" : "text-[#f4ead2]"}`}>{q.name}</span>{!compact && <Reward r={q.reward} />}</div>
        <div className="text-[11.5px] text-[var(--text-2)]">{q.desc}</div>
        <div className="flex items-center gap-2 mt-1"><Bar value={q.progress} max={q.target} color={done ? "var(--ok)" : "var(--gold)"} className="flex-1 !h-1.5" /><span className="num text-[10.5px] text-[var(--muted)]" data-testid={`quest-progress-${q.id.split(":")[0]}`}>{fmt(q.progress)} / {fmt(q.target)}</span></div>
      </div>
    </li>
  );
};

export const Streak = ({ s }) => (
  <div className="flex items-center gap-2 text-[11.5px]" data-testid="quest-streak">
    <Flame size={13} className={s.count > 0 ? "text-[#f0a35b]" : "text-[var(--muted)]"} />
    <span className="num">{s.count}{tt("-day streak")}</span>
    <div className="flex gap-0.5">{Array.from({ length: s.days }).map((_, i) => <span key={i} className={`w-3 h-2 border ${i < s.count % s.days || (s.count > 0 && s.count % s.days === 0) ? "bg-[#f0a35b] border-[#f0a35b]" : "border-[var(--border)]"}`} />)}</div>
    <span className="text-[var(--muted)]">{tt("Complete all dailies")} {s.days} {tt("days running for")} <Gold n={s.bonus.gold} className="text-[11px]" />{s.bonus.pearls > 0 && <> + <Pearls n={s.bonus.pearls} className="text-[11px]" data-testid="streak-pearls" /></>}</span>
  </div>
);

const StoryQuest = ({ q, onAccept, busy }) => {
  const dim = q.status === "locked" || q.status === "level_locked" || q.status === "done";
  return (
    <div className={`journal-cell ${dim ? "undiscovered" : "discovered"} ${q.status === "active" ? "!border-[var(--gold-dim)]" : ""}`} data-testid={`story-quest-${q.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`font-medium text-[13px] ${q.status === "done" ? "text-[var(--muted)] line-through" : "text-[#f4ead2]"}`}>{q.status === "done" && <Check size={12} className="inline mr-1 text-[var(--ok)]" />}{q.status === "locked" && <Lock size={11} className="inline mr-1" />}{q.name}</div>
          {q.status !== "locked" && <p className="text-[12px] text-[var(--text-2)] mt-0.5 italic">{q.story}</p>}
          <div className="text-[12px] mt-1">{q.status === "locked" ? <span className="text-[var(--muted)]">{tt("Complete the previous quest to read this entry.")}</span> : q.desc}</div>
          <div className="mt-1"><Reward r={q.reward} /></div>
        </div>
        <div className="shrink-0 text-right text-[11.5px] w-32">
          {q.status === "available" && <button className="btn btn-gold btn-sm" onClick={() => onAccept(q.id)} disabled={busy} data-testid={`accept-quest-${q.id}`}>{tt("Accept")}</button>}
          {q.status === "level_locked" && <span className="text-[var(--muted)]">{tt("Requires level")} {q.level}</span>}
          {q.status === "active" && <div><span className="tag text-[var(--gold)]">{tt("In progress")}</span><div className="num mt-1">{fmt(q.progress)} / {fmt(q.target)}</div><Bar value={q.progress} max={q.target} color="var(--gold)" className="mt-1 !h-1.5" /></div>}
          {q.status === "done" && <span className="text-[var(--ok)]">{tt("Completed")}</span>}
        </div>
      </div>
    </div>
  );
};

export default function Quests() {
  const { refresh } = useGame();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get("/quests").then((r) => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); window.addEventListener("quests-changed", load); return () => window.removeEventListener("quests-changed", load); }, [load]);
  const accept = async (id) => {
    setBusy(true);
    try { const r = await api.post(`/quests/${id}/accept`); setD((x) => ({ ...x, story: r.data.story })); toast.success(tt("Quest accepted. The Harbourmaster nods.")); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  useEffect(() => { if (d) refresh().catch(() => {}); }, [d?.completed]); // eslint-disable-line
  if (!d) return null;
  const storyDone = d.story.filter((q) => q.status === "done").length;
  return (
    <div className="space-y-3 fade-in" data-testid="quests-page">
      <GuestQuests />
      <div className="grid md:grid-cols-2 gap-3">
        <Panel icon="quests" title={tt("Daily quests")} right={<span>{tt("Resets in")} <span className="num" data-testid="daily-reset">{untilText(d.daily.ends_at)}</span></span>} testId="daily-quests">
          <ul>{d.daily.quests.map((q) => <QuestRow key={q.id} q={q} />)}</ul>
          <div className="divider my-2" />
          <Streak s={d.streak} />
        </Panel>
        <Panel icon="quests" title={tt("Weekly quests")} right={<span>{tt("Resets in")} <span className="num" data-testid="weekly-reset">{untilText(d.weekly.ends_at)}</span></span>} testId="weekly-quests">
          <ul>{d.weekly.quests.map((q) => <QuestRow key={q.id} q={q} />)}</ul>
          {d.weekly.quests.length === 0 && <Empty>{tt("No weekly quests posted.")}</Empty>}
        </Panel>
      </div>
      <Panel icon="journal" title={tt("The Harbourmaster's Ledger")} right={<span className="num" data-testid="story-progress">{storyDone} / {d.story.length} {tt("chapters")}</span>} testId="story-quests">
        <p className="text-[12px] text-[var(--text-2)] mb-2">{tt("Long-standing requests from the folk of Fishing Realms. Each entry unlocks the next once completed.")}</p>
        <div className="space-y-1.5">{d.story.map((q) => <StoryQuest key={q.id} q={q} onAccept={accept} busy={busy} />)}</div>
      </Panel>
    </div>
  );
}
