/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty, AdminBadge, ModBadge, SupporterBadge, PremiumBadge } from "../../components/ui-bits";
import { Avatar } from "../../components/Avatar";
import { t as tt } from "../../i18n";

function Row({ p, me, waters }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5 border-b border-[#221e1b] last:border-0 text-[12.5px]" data-testid={`player-row-${p.username}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${p.online ? "bg-[var(--ok)] shadow-[0_0_5px_var(--ok)]" : "bg-[#302b27]"}`} title={p.online ? tt("Online now") : `Last seen ${p.last_seen ? ago(p.last_seen) : "long ago"}`} />
      <Link to={`/game/profile/${p.username}`} className="shrink-0"><Avatar id={p.avatar} size="sm" frame={p.frame} /></Link>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 flex-wrap">
          {p.tag && <span className="text-[10.5px] text-[var(--gold-dim)]" style={p.tag_colour ? { color: p.tag_colour } : undefined}>[{p.tag}]</span>}
          <Link to={`/game/profile/${p.username}`} className={`font-medium hover:underline ${p.username === me ? "text-[var(--gold)]" : "text-[#e6dcc6]"}`} data-testid={`player-link-${p.username}`}>{p.username}</Link>
          {p.admin && <AdminBadge />}{p.mod && !p.admin && <ModBadge />}{p.supporter && <SupporterBadge />}{p.premium && <PremiumBadge />}
          <span className="num text-[11px] text-[var(--muted)]">{tt("Lv")} {p.level}</span>
        </span>
        <span className="block text-[11px] text-[var(--muted)] truncate">{p.title}{p.water && waters[p.water] ? ` · at ${waters[p.water]}` : ""}{!p.online && p.last_seen ? ` · seen ${ago(p.last_seen)}` : ""}</span>
      </span>
    </li>
  );
}

export default function Players() {
  const { user, lookups } = useGame();
  const [q, setQ] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [page, setPage] = useState(0);
  const [d, setD] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => api.get("/players", { params: { q, sort: onlyOnline ? "seen" : "level", online: onlyOnline, page } }).then((r) => setD(r.data)).catch(() => {}), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, onlyOnline, page]);
  useEffect(() => { setPage(0); }, [q, onlyOnline]);
  const waters = Object.fromEntries(Object.entries(lookups?.waterByKey || {}).map(([k, w]) => [k, w.name]));
  const pages = d ? Math.max(1, Math.ceil(d.total / d.per)) : 1;
  return (
    <div className="space-y-3" data-testid="players-page">
      <Panel icon="angler" title={<span className="flex items-center gap-1.5">{tt("Anglers of the Fishing Lands")}</span>} right={d && <span className="num">{d.total.toLocaleString()} {onlyOnline ? tt("online") : tt("registered")}</span>} testId="players-panel">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <label className="flex items-center gap-2 border border-[var(--border-2)] bg-[var(--bg-deep)] px-2 flex-1 min-w-[200px]">
            <Search size={13} className="text-[var(--muted)] shrink-0" />
            <input className="input !border-0 !bg-transparent min-w-0 w-full" placeholder={tt("Search anglers by name…")} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" data-testid="players-search" />
          </label>
          <div className="flex border border-[var(--border-2)] rounded-[2px] overflow-hidden" data-testid="players-filter">
            {[[false, "Everyone"], [true, "Online now"]].map(([v, lbl]) => <button key={lbl} type="button" className={`px-2.5 py-1 text-[12px] ${onlyOnline === v ? "bg-[var(--gold)] text-[#1a110c]" : "text-[var(--text-2)] hover:text-[var(--gold)]"}`} onClick={() => setOnlyOnline(v)} data-testid={`players-filter-${v ? "online" : "all"}`}>{lbl}</button>)}
          </div>
        </div>
        {!d ? <Empty>{tt("Looking around the harbour…")}</Empty>
          : d.players.length === 0 ? <Empty>{q ? `No angler called "${q}".` : onlyOnline ? tt("Nobody's on the water right now.") : tt("No anglers yet.")}</Empty>
          : <ul data-testid="players-list">{d.players.map((p) => <Row key={p.username} p={p} me={user.username} waters={waters} />)}</ul>}
        {d && pages > 1 && (
          <div className="flex items-center justify-between mt-3 text-[12px]">
            <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} data-testid="players-prev">{tt("‹ Previous")}</button>
            <span className="num text-[var(--muted)]">{tt("page")} {page + 1} / {pages}</span>
            <button className="btn btn-sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} data-testid="players-next">{tt("Next ›")}</button>
          </div>
        )}
      </Panel>
    </div>
  );
}
