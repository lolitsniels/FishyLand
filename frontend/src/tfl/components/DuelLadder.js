/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { Panel } from "./ui-bits";
import { Avatar } from "./Avatar";
import { prizeArt } from "../lib/prizeArt";
import { untilText } from "../pages/game/Quests";
import { t as tt } from "../i18n";

const canHover = () => window.matchMedia("(hover: hover)").matches;

const RewardArt = ({ m, small }) => <img src={prizeArt(m.kind === "crate" ? { kind: m.item } : m)} alt="" className={small ? "ladder-art-sm" : "ladder-art"} draggable="false" />;

function Track({ l }) {
  const [open, setOpen] = useState(null);
  const ms = l.milestones.map((m) => m.points), n = ms.length;
  const pct = (v) => {
    const i = ms.findIndex((p) => v < p);
    if (i === -1) return "100%";
    const lo = i === 0 ? 0 : ms[i - 1];
    return `${((i + (v - lo) / (ms[i] - lo)) / n) * 100}%`;
  };
  return (
    <div className="flex items-center gap-2 mt-3 mb-1" onClick={() => setOpen(null)}>
      <div className="relative flex-1 h-1.5 bg-[var(--bg-deep)] border border-[var(--border)] mx-1.5" data-testid="ladder-track">
        <div className="absolute inset-y-0 left-0 bg-[var(--gold)] transition-[width] duration-500" style={{ width: pct(l.points) }} />
        {l.milestones.map((m) => {
          const reached = m.claimed || l.points >= m.points, p = parseFloat(pct(m.points));
          const align = p < 30 ? "left-0 -ml-1.5" : p > 70 ? "right-0 -mr-1.5" : "left-1/2 -translate-x-1/2";
          return (
            <span key={m.n} className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2" style={{ left: pct(m.points) }} onMouseEnter={() => canHover() && setOpen(m.n)} onMouseLeave={() => canHover() && setOpen(null)}>
              <button type="button" className={`block w-3 h-3 rounded-full border ${reached ? "bg-[var(--gold)] border-[var(--gold)]" : "bg-[var(--bg-deep)] border-[var(--gold-dim)]"} hover:scale-125 transition-transform`}
                onClick={(e) => { e.stopPropagation(); setOpen((o) => (canHover() || o !== m.n ? m.n : null)); }} aria-label={`Milestone ${m.n} at ${m.points} points`} data-testid={`ladder-dot-${m.n}`} />
              {open === m.n && (
                <div className={`absolute bottom-full pb-2 ${align} w-[min(210px,calc(100vw-40px))] z-30`} data-testid={`ladder-pop-${m.n}`}>
                  <div className="border border-[var(--gold-dim)] bg-[var(--bg-deep)] p-2 text-[11px] shadow-lg flex items-center gap-2">
                    <RewardArt m={m} small />
                    <div className="min-w-0"><div style={{ color: `var(--r-${m.rarity})` }}>{m.label}</div><div className="num text-[var(--muted)]">#{m.n} · {m.points} {tt("pts")}{m.claimed ? ` · ${tt("claimed")}` : ""}</div></div>
                  </div>
                </div>
              )}
            </span>
          );
        })}
      </div>
      <span className="num text-[10.5px] text-[var(--muted)] whitespace-nowrap">{l.points} / {l.milestones[l.milestones.length - 1].points} {tt("pts")}</span>
    </div>
  );
}

export function DuelLadder({ l }) {
  return (
    <Panel icon="tournaments" title={tt("This week's Duel Ladder")} right={<span className="num">{tt("resets in")} {untilText(l.ends_at)}</span>} testId="duel-ladder">
      <div className="flex items-end justify-between gap-2 mb-2">
        <div><span className="num text-[26px] text-[var(--gold)] leading-none" data-testid="ladder-points">{l.points}</span> <span className="text-[12px] text-[var(--muted)]">{tt("ladder points")}</span></div>
        <div className="text-[11.5px] text-[var(--text-2)] num text-right">{tt("win")} +{l.points_for.win} · {tt("losses never move you back")}</div>
      </div>
      <Track l={l} />
      <div className="ladder-grid mt-4" data-testid="ladder-rewards">
        {l.milestones.map((m) => (
          <div key={m.n} className={`ladder-reward ${m.claimed ? "ladder-reward-done" : ""} ${m.kind === "seal" ? "ladder-reward-seal" : ""}`} data-testid={`ladder-milestone-${m.n}`} data-claimed={m.claimed}>
            <div className="flex items-center justify-between gap-1 text-[10px] text-[var(--muted)] num"><span>#{m.n}</span><span className="inline-flex items-center gap-1">{m.points} {tt("pts")}{m.claimed ? <Check size={11} className="text-[var(--ok)]" /> : l.points < m.points && <Lock size={10} className="opacity-60" />}</span></div>
            <div className="h-9 flex items-center justify-center my-1"><RewardArt m={m} /></div>
            <div className="text-[11px] leading-tight text-center" style={{ color: `var(--r-${m.rarity})` }}>{m.label}</div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-[var(--muted)] mt-3">{tt("Rewards pay out the moment you cross a milestone and only once a week, so a loss can push you back but never takes a reward away. New rewards every Monday.")}</p>
    </Panel>
  );
}

export function DuelBoard({ l, me }) {
  return (
    <Panel icon="rankings" title={tt("Weekly duel board")} right={<span className="num">{tt("most wins")}</span>} testId="duel-board" bodyClass="!p-0">
      {l.leaderboard.length === 0 ? <div className="p-3 text-[12px] text-[var(--muted)]">{tt("No wins on the pier yet this week. The first win puts you on top.")}</div> : (
        <ol>
          {l.leaderboard.map((r) => (
            <li key={r.id} className={`flex items-center gap-2 px-3 py-1.5 text-[12.5px] ${r.id === me ? "bg-[#2a1d14]" : ""}`} data-testid={`duel-board-row-${r.rank}`}>
              <span className={`num w-5 ${r.rank <= 3 ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{r.rank}</span>
              <Avatar id={r.avatar} name={r.username} size="xs" />
              <span className="truncate flex-1">{r.username}</span>
              <span className="num text-[var(--ok)]">{r.wins}W</span><span className="num text-[var(--muted)] text-[11px]">{r.points} {tt("pts")}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="p-3 border-t-2 border-dotted border-[#2e2722] space-y-1 text-[11.5px]" data-testid="duel-podium">
        <div className="label">{tt("Paid when the week ends")}</div>
        {l.podium.map((p, i) => <div key={i} className="flex gap-2"><span className="num text-[var(--gold)] w-5">#{i + 1}</span><span className="text-[var(--text-2)]">{p}</span></div>)}
        {l.last_week?.top?.length > 0 && <div className="text-[var(--muted)] pt-1" data-testid="duel-last-week">{tt("Last week's winner:")} <b className="text-[#f4ead2]">{l.last_week.top[0].username}</b> ({l.last_week.top[0].wins}W)</div>}
      </div>
    </Panel>
  );
}
