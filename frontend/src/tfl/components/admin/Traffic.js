/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api, ago, fmt } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";
import { GUIDES } from "../MarketingShell";
import { PlatformStats } from "./PlatformStats";

function GuideTable({ rows, days }) {
  const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
  const list = GUIDES.map((g) => ({ ...g, ...(by[g.slug] || { views: 0, accounts: 0, guests: 0 }) })).sort((a, b) => b.accounts - a.accounts || b.guests - a.guests || b.views - a.views);
  return (
    <Panel title={`Guide pages · last ${days} days`} bodyClass="!p-0" testId="traffic-guides">
      <div className="px-3 py-2 text-[12px] text-[var(--text-2)] border-b border-[var(--border)]">Views count once per guide per browser session. A sign-up is credited to the last guide that person read before creating their angler.</div>
      <div className="overflow-x-auto"><table className="table"><thead><tr><th>Guide</th><th className="r">Views</th><th className="r">Guests</th><th className="r">Accounts</th><th className="r" title="Full accounts ÷ views">Converts</th></tr></thead><tbody>
        {list.map((g) => (
          <tr key={g.slug} data-testid={`traffic-guide-${g.slug}`}>
            <td className="whitespace-nowrap"><a href={`/guides/${g.slug}`} target="_blank" rel="noreferrer" className="hover:underline">{g.title}</a></td>
            <td className="num r">{fmt(g.views)}</td>
            <td className="num r text-[var(--text-2)]">{fmt(g.guests)}</td>
            <td className="num r text-[var(--gold)]" data-testid={`traffic-guide-accounts-${g.slug}`}>{fmt(g.accounts)}</td>
            <td className="num r text-[var(--text-2)]">{g.views ? `${Math.round((g.accounts / g.views) * 100)}%` : "-"}</td>
          </tr>
        ))}
      </tbody></table></div>
    </Panel>
  );
}

const pct = (v) => (v == null ? "-" : `${v}%`);
const isUrl = (p) => /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/.test(p);
const SORTS = { visits: "Visits", guests: "Guests", accounts: "Accounts", back_7d: "Back after 7 days", avg_level: "Avg level" };

function PageName({ page, site }) {
  const rest = page.slice(site.length);
  const label = <><b className="text-[#f4ead2] font-normal">{site}</b><span className="text-[var(--muted)]">{rest}</span></>;
  return isUrl(page) ? <a href={`https://${page}`} target="_blank" rel="noreferrer" className="hover:underline">{label}</a> : label;
}

function TopCard({ title, rows, field, unit, testId }) {
  return (
    <div className="border border-[var(--border)] bg-[#121110] p-2.5 min-w-0" data-testid={testId}>
      <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-1.5">{title}</div>
      {rows.length === 0 ? <div className="text-[12px] text-[var(--muted)]">Not enough data yet</div> : rows.map((r, i) => (
        <div key={r.page} className="flex items-baseline gap-2 text-[12px] py-0.5" data-testid={`${testId}-${i + 1}`}>
          <span className={`num w-4 ${i === 0 ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{i + 1}</span>
          <span className="truncate flex-1 min-w-0" title={r.page}><PageName page={r.page} site={r.site} /></span>
          <span className="num text-[#f4ead2]">{fmt(r[field])}{unit}</span>
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ pages }) {
  const top = (f, ok = () => true) => [...pages].filter((p) => p[f] > 0 && ok(p)).sort((a, b) => b[f] - a[f]).slice(0, 3);
  return (
    <Panel title="Top sources" testId="traffic-leaderboard">
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <TopCard title="Most visits" rows={top("visits")} field="visits" unit="" testId="traffic-top-visits" />
        <TopCard title="Most guests" rows={top("guests")} field="guests" unit="" testId="traffic-top-guests" />
        <TopCard title="Most accounts" rows={top("accounts")} field="accounts" unit="" testId="traffic-top-accounts" />
        <TopCard title="Best at keeping players (5+)" rows={top("back_7d", (p) => p.d7_n >= 5)} field="back_7d" unit="%" testId="traffic-top-retention" />
      </div>
    </Panel>
  );
}

function PagesTable({ d, days, setDays }) {
  const [sort, setSort] = useState("visits");
  const rows = [...d.pages].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const right = (
    <div className="flex gap-1.5">
      <select className="input !w-auto !py-0.5 text-[11px]" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="traffic-sort">{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Sort: {v}</option>)}</select>
      <select className="input !w-auto !py-0.5 text-[11px]" value={days} onChange={(e) => setDays(Number(e.target.value))} data-testid="traffic-days">{[7, 30, 90, 365].map((n) => <option key={n} value={n}>{n} days</option>)}</select>
    </div>
  );
  return (
    <Panel title={`Where visitors came from · last ${d.days} days`} right={right} bodyClass="!p-0" testId="traffic-sources">
      <div className="px-3 py-2 text-[12px] text-[var(--text-2)] border-b border-[var(--border)]"><span className="num text-[#f4ead2]">{fmt(d.total)}</span> visits · <span className="num text-[#f4ead2]">{fmt(d.guests)}</span> guests started · <span className="num text-[#f4ead2]">{fmt(d.signups)}</span> full accounts. One row per page that sent them. Some sites only share their domain, so their row has no path. "Back after" counts players who came online again at least 1 or 7 days after they started.</div>
      {rows.length === 0 ? <Empty>No visits recorded yet.</Empty> : (
        <div className="overflow-x-auto"><table className="table"><thead><tr><th>Page</th><th className="r">Visits</th><th className="r">Guests</th><th className="r">Accounts</th><th className="r" title="Full accounts / visits">Converts</th><th className="r">Back 1d</th><th className="r">Back 7d</th><th className="r">Avg lvl</th><th className="r">Lvl 10+</th><th className="r">Mobile</th><th className="r">Last</th></tr></thead><tbody>
          {rows.map((s) => (
            <tr key={s.page} data-testid={`traffic-row-${s.page}`}>
              <td className="max-w-[340px] truncate" title={s.page}><PageName page={s.page} site={s.site} /></td>
              <td className="num r">{fmt(s.visits)}</td>
              <td className="num r text-[var(--text-2)]">{fmt(s.guests)}</td>
              <td className="num r text-[var(--gold)]" data-testid={`traffic-accounts-${s.page}`}>{fmt(s.accounts)}</td>
              <td className="num r text-[var(--text-2)]">{s.visits ? `${Math.round((s.accounts / s.visits) * 100)}%` : "-"}</td>
              <td className="num r" data-testid={`traffic-back1-${s.page}`}>{pct(s.back_1d)}</td>
              <td className="num r" data-testid={`traffic-back7-${s.page}`}>{pct(s.back_7d)}</td>
              <td className="num r" data-testid={`traffic-lvl-${s.page}`}>{s.avg_level ?? "-"}</td>
              <td className="num r text-[var(--text-2)]">{fmt(s.lvl10)}</td>
              <td className="num r text-[var(--text-2)]">{s.visits ? `${Math.round((s.mobile / s.visits) * 100)}%` : "-"}</td>
              <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{s.last ? ago(s.last) : "-"}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </Panel>
  );
}

export function Traffic() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/traffic", { params: { days } }).then((r) => setD(r.data)).catch(() => {}); }, [days]);
  if (!d) return <Empty>Loading...</Empty>;
  const max = Math.max(1, ...d.by_day.map((x) => x.visits));
  return (
    <div className="space-y-3" data-testid="admin-traffic">
      <PlatformStats />
      <Leaderboard pages={d.pages} />
      <PagesTable d={d} days={days} setDays={setDays} />
      <GuideTable rows={d.guides || []} days={d.days} />
      {d.by_day.length > 0 && (
        <Panel title="Visits per day" testId="traffic-days-chart">
          <div className="flex items-end gap-[2px] h-24">{d.by_day.map((x) => <div key={x.day} title={`${x.day}: ${x.visits}`} className="flex-1 bg-[#5aa0c8] hover:bg-[var(--gold)] min-w-[3px]" style={{ height: `${Math.max(3, Math.round((x.visits / max) * 100))}%` }} />)}</div>
          <div className="flex justify-between text-[10px] text-[var(--muted)] num mt-1"><span>{d.by_day[0].day}</span><span>{d.by_day[d.by_day.length - 1].day}</span></div>
        </Panel>
      )}
    </div>
  );
}
