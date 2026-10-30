/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmt, wt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel } from "../../components/ui-bits";
import { Avatar } from "../../components/Avatar";
import { t as tt } from "../../i18n";

const BOARDS = [["wealth", "Wealthiest anglers", (v) => `${fmt(v)}g`], ["collection", "Largest journals", (v) => `${v} species`], ["heaviest", "Heaviest catch", (v) => wt(v)], ["level", "Most experienced", (v) => `${fmt(v)} xp`], ["catches", "Most fish landed", (v) => fmt(v)], ["mastery", "Fish masters", (v) => `${fmt(v)} mastery`], ["mentors", "Top mentors", (v) => `${fmt(v)} recruits`], ["duels", "Duel champions", (v) => `${fmt(v)} wins`], ["tournaments", "Tournament winners", (v) => `${fmt(v)} wins`]];

const PERIODS = [["all", "All time"], ["month", "This month"], ["week", "This week"]];
const PERIOD_TITLES = { wealth: "Most gold earned", collection: "Most species caught", level: "Most XP gained", catches: "Most fish landed", heaviest: "Heaviest catch", mastery: "Mastery gained", mentors: "Top mentors", duels: "Duel wins", tournaments: "Tournament wins" };

function resetsIn(iso) {
  const ms = new Date(iso) - Date.now();
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.max(0, Math.floor((ms % 3600000) / 60000))}m`;
}

function PeriodTabs({ period, setPeriod, ends }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="leaderboard-period-tabs">
      {PERIODS.map(([k, label]) => (
        <button key={k} className={`btn btn-sm ${period === k ? "btn-gold" : ""}`} onClick={() => setPeriod(k)} data-testid={`leaderboard-period-${k}`}>{label}</button>
      ))}
      {ends && <span className="text-[11.5px] text-[var(--muted)] ml-1" data-testid="leaderboard-resets-in">Resets in {resetsIn(ends)} (UTC)</span>}
    </div>
  );
}

function MyRow({ r, f, user, testId }) {
  return (
    <>
      <tr><td colSpan={4} className="!py-0 text-center text-[var(--muted)] leading-none">...</td></tr>
      <tr className="bg-[#1f1714]" data-testid={testId}>
        <td className="num text-[var(--gold)] w-8">{fmt(r.rank)}</td>
        <td className="w-full lg:max-w-0"><span className="flex items-center gap-2"><Avatar id={user.avatar} size="xs" frame={user.frame} /><span className="truncate">{user.username} <span className="text-[11px] text-[var(--muted)]">(you)</span></span></span>{r.name && <div className="text-[11px] text-[var(--muted)] truncate">{r.name}</div>}</td>
        <td className="num text-[var(--muted)] r whitespace-nowrap board-lv">{tt("Lv")} {user.level}</td>
        <td className="num r text-[#ffcfa8] whitespace-nowrap">{f(r.value)}</td>
      </tr>
    </>
  );
}

export default function Leaderboards() {
  const { user } = useGame();
  const nav = useNavigate();
  const [lb, setLb] = useState(null);
  const [period, setPeriod] = useState("all");
  const [me, setMe] = useState({});
  useEffect(() => {
    setLb(null); setMe({});
    api.get(`/leaderboards/period?period=${period}`).then((r) => setLb(r.data)).catch(() => {});
    api.get(`/leaderboards/me?period=${period}`).then((r) => setMe(r.data)).catch(() => {});
  }, [period]);
  return (
    <div className="space-y-3 fade-in" data-testid="leaderboards-page">
      <Panel icon="rankings" title={tt("Server rankings")}>
        <div className="space-y-2">
          <p className="text-[12.5px] text-[var(--text-2)]">{period === "all" ? tt("Rankings update the moment anything changes. Your own row is highlighted.") : `Only what anglers achieved ${period === "week" ? "since Monday" : "since the 1st of the month"} counts. Your own row is highlighted.`}</p>
          <PeriodTabs period={period} setPeriod={setPeriod} ends={period !== "all" && lb?.period?.ends} />
        </div>
      </Panel>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {lb && BOARDS.map(([key, allTitle, f]) => { const title = period === "all" ? allTitle : PERIOD_TITLES[key]; return (
          <Panel key={key} icon="rankings" title={title} bodyClass="!p-0" className="board" testId={`board-${key}`}>
            {lb[key].length === 0 ? (
              <div className="p-3 text-[12.5px] text-[var(--muted)]">{period !== "all" ? "Nothing yet this " + period + ". Be the first!" : key === "mentors" ? tt("No mentors have brought in recruits yet, share your recruit link to be the first.") : tt("No entries yet.")}</div>
            ) : (
            <table className="table">
              <tbody>
                {lb[key].map((r, i) => (
                  <tr key={r.username} className={r.username === user.username ? "bg-[#1f1714]" : ""}>
                    <td className="num text-[var(--muted)] w-8">{i + 1}</td>
                    <td className="w-full lg:max-w-0"><button className="hover:text-[var(--gold)] flex items-center gap-2 max-w-full" onClick={() => nav(`/game/profile/${r.username}`)}>{r.avatar && <Avatar id={r.avatar} size="xs" frame={r.frame} />}<span className="truncate">{r.username}</span></button>{r.name && <div className="text-[11px] text-[var(--muted)] truncate">{r.name}</div>}{typeof r.completed === "number" && r.completed > 0 && <div className="text-[11px] text-[var(--muted)] truncate">{r.completed} {tt("reached the top")}</div>}</td>
                    <td className="num text-[var(--muted)] r whitespace-nowrap board-lv">{tt("Lv")} {r.level}</td>
                    <td className="num r text-[#ffcfa8] whitespace-nowrap">{f(r.value)}</td>
                  </tr>
                ))}
                {me[key] && !lb[key].some((r) => r.username === user.username) && <MyRow key="me" r={me[key]} f={f} user={user} testId={`board-${key}-me`} />}
              </tbody>
            </table>
            )}
          </Panel>
        ); })}
      </div>
    </div>
  );
}
