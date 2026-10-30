import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { TrendingUp, Fish, CloudSun, Lock, Package } from "lucide-react";
import { api, errMsg, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty, PassIcon } from "../../components/ui-bits";
import { t as tt } from "../../i18n";
import { CRATE_COL } from "../../components/Crates";
import { NO_IAP } from "../../lib/portal";

const TABS = [["selling", "What's selling", TrendingUp], ["prices", "Price history", TrendingUp], ["crates", "Crates", Package], ["catches", "My catches", Fish], ["conditions", "Best conditions", CloudSun]];

// Tiny dependency-free charts.
function Sparkline({ points, height = 70, testId }) {
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (vals.length < 1) return <Empty>{tt("No sales recorded in the last 30 days.")}</Empty>;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1, w = 600, step = w / Math.max(1, points.length - 1);
  const path = points.map((p, i) => p.v == null ? null : `${i === 0 || points[i - 1].v == null ? "M" : "L"}${(i * step).toFixed(1)},${(height - 6 - ((p.v - lo) / span) * (height - 12)).toFixed(1)}`).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-[70px]" data-testid={testId}>
      <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2" />
      {points.map((p, i) => p.v != null && <circle key={p.day} cx={i * step} cy={height - 6 - ((p.v - lo) / span) * (height - 12)} r="2.5" fill="#f4ead2"><title>{p.day}: {fmt(p.v)}g ({p.n})</title></circle>)}
    </svg>
  );
}

function Bars({ rows, max, colour = "var(--gold)", testId }) {
  const m = max || Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-1" data-testid={testId}>
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-2 text-[11.5px]">
          <span className="w-24 shrink-0 text-[var(--text-2)] capitalize truncate">{r.label ?? r.key}</span>
          <div className="flex-1 h-2.5 bg-[rgba(255,255,255,0.05)] overflow-hidden"><div className="h-full" style={{ width: `${(r.n / m) * 100}%`, background: colour }} /></div>
          <span className="num w-16 text-right text-[var(--text)]">{r.pct != null ? `${r.pct}%` : fmt(r.n)}</span>
        </div>
      ))}
    </div>
  );
}

function Selling({ home }) {
  if (!home.selling.length) return <Empty>{tt("No trades on the Market in the last seven days.")}</Empty>;
  return (
    <table className="table text-[12px]" data-testid="almanac-selling">
      <thead><tr><th>{tt("Item")}</th><th className="r">{tt("Trades · 7 d")}</th><th className="r">{tt("Avg. price / unit")}</th></tr></thead>
      <tbody>{home.selling.map((s) => <tr key={s.kind + s.name}><td><span className={`rar-${s.rarity}`}>{s.name}</span> <span className="text-[var(--muted)] text-[11px]">· {s.kind}</span></td><td className="r num">{s.trades}</td><td className="r num text-[#ffcfa8]">{fmt(s.avg)}g</td></tr>)}</tbody>
    </table>
  );
}

function Prices({ home }) {
  const { data } = useGame();
  const names = useMemo(() => Array.from(new Set([...(data?.fish || []).map((f) => f.name), ...(data?.baits || []).map((b) => b.name), ...(data?.ingredients || []).map((i) => i.name), ...[...(data?.rods || []), ...(data?.reels || []), ...(data?.lines || [])].filter((g) => g.price).map((g) => g.name), "Energy Potion", "Tackle Scrap", "Bronze Crate", "Silver Crate", "Gold Crate", "Angler Pass · Week", "Angler Pass · Month"])).sort(), [data]);
  const [name, setName] = useState(home.selling[0]?.name || "Tackle Scrap");
  const [q, setQ] = useState("");
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/almanac/prices", { params: { name } }).then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [name]);
  const hits = q ? names.filter((n) => n.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  return (
    <div className="space-y-2 text-[12.5px]">
      <div className="relative max-w-sm">
        <input className="input w-full" placeholder={tt("Search a fish, bait, ingredient…")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="almanac-price-search" />
        {hits.length > 0 && <div className="absolute z-10 left-0 right-0 panel mt-1 max-h-56 overflow-auto">{hits.map((n) => <button key={n} type="button" className="block w-full text-left px-2 py-1 text-[12px] hover:bg-[rgba(255,255,255,0.05)]" onClick={() => { setName(n); setQ(""); }} data-testid={`almanac-price-pick-${n}`}>{n}</button>)}</div>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1"><span className="font-display text-[15px] text-[#f4ead2]" data-testid="almanac-price-name">{name}</span>
        {d && d.trades > 0 && <span className="text-[11.5px] text-[var(--text-2)]">{tt("30 d:")} <b className="num text-[#ffcfa8]">{fmt(d.median)}g</b> {tt("median")} · {tt("low")} <span className="num">{fmt(d.low)}g</span> · {tt("high")} <span className="num">{fmt(d.high)}g</span> · <span className="num">{d.trades}</span> {tt("sales")}</span>}</div>
      {d && <Sparkline points={d.series.map((s) => ({ day: s.day, v: s.median, n: s.n }))} testId="almanac-price-chart" />}
      <p className="text-[11px] text-[var(--muted)]">{tt("Daily median of player-to-player sales per unit. Vendor sales are not included.")}</p>
    </div>
  );
}

const CRATE_NAMES = [["crate_bronze", "Bronze Crate"], ["crate_silver", "Silver Crate"], ["crate_gold", "Gold Crate"]];
function CratePrices() {
  const [d, setD] = useState({});
  useEffect(() => { CRATE_NAMES.forEach(([id, n]) => api.get("/almanac/prices", { params: { name: n } }).then((r) => setD((x) => ({ ...x, [id]: r.data }))).catch(() => {})); }, []);
  return (
    <div className="grid md:grid-cols-3 gap-3 text-[12.5px]" data-testid="almanac-crates">
      {CRATE_NAMES.map(([id, n]) => { const p = d[id]; return (
        <div key={id} className="crate-card !text-left" data-testid={`almanac-crate-${id}`}>
          <div className="flex items-center gap-2"><img src={`/art/gear/${id}.webp`} alt="" className="w-10 h-10 object-contain" style={{ imageRendering: "pixelated" }} /><span className="font-display text-[14px]" style={{ color: CRATE_COL[id] }}>{n}</span></div>
          {p && p.trades > 0 ? <div className="text-[11.5px] text-[var(--text-2)] mt-1">{tt("30 d:")} <b className="num text-[#ffcfa8]">{fmt(p.median)}g</b> {tt("median")} · <span className="num">{fmt(p.low)}g</span>{tt(" to ")}<span className="num">{fmt(p.high)}g</span> · <span className="num">{p.trades}</span> {tt("sales")}</div> : null}
          {p && <Sparkline points={p.series.map((s) => ({ day: s.day, v: s.median, n: s.n }))} height={56} testId={`almanac-crate-chart-${id}`} />}
        </div>
      ); })}
      <p className="md:col-span-3 text-[11px] text-[var(--muted)]">{tt("Daily median Market sale price per crate. Crate-only rods are in Price history.")}</p>
    </div>
  );
}

function Catches() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/almanac/catches").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  if (!d) return <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div>;
  if (!d.total) return <Empty>{tt("Nothing in your log yet, land a fish and come back.")}</Empty>;
  const mx = Math.max(1, ...d.curve.map((c) => c.n));
  return (
    <div className="grid lg:grid-cols-2 gap-4 text-[12.5px]" data-testid="almanac-catches">
      <div>
        <div className="label mb-1">{tt("Last 30 days")} · <span className="num">{d.curve.reduce((a, c) => a + c.n, 0)}</span> {tt("landed")}</div>
        <div className="flex items-end gap-px h-16" data-testid="almanac-catch-curve">{d.curve.map((c) => <div key={c.day} className="flex-1 bg-[var(--gold)]" style={{ height: `${Math.max(2, (c.n / mx) * 100)}%`, opacity: c.n ? 1 : 0.15 }} title={`${c.day}: ${c.n}`} />)}</div>
        <div className="label mt-3 mb-1">{tt("Heaviest on record")}</div>
        <table className="table text-[11.5px]"><tbody>{d.heaviest.map((h) => <tr key={h.name}><td><span className={`rar-${h.rarity}`}>{h.name}</span></td><td className="r num">{h.weight.toFixed(2)} kg</td></tr>)}</tbody></table>
      </div>
      <div className="space-y-3">
        {d.waters.map((w) => (
          <div key={w.key} data-testid={`almanac-water-${w.key}`}>
            <div className="flex items-baseline justify-between"><span className="font-display text-[13.5px] text-[#f4ead2]">{w.name}</span><span className="num text-[11.5px] text-[var(--text-2)]">{fmt(w.total)} {tt("fish")}</span></div>
            <div className="flex h-2 overflow-hidden mt-1 bg-[rgba(255,255,255,0.05)]">{["common", "uncommon", "rare", "epic", "legendary", "mythic"].map((r) => w.rarity[r] ? <div key={r} className={`bg-current rar-${r}`} style={{ width: `${(w.rarity[r] / w.total) * 100}%` }} title={`${r}: ${w.rarity[r]}`} /> : null)}</div>
            <div className="text-[10.5px] text-[var(--muted)] mt-0.5">{["rare", "epic", "legendary", "mythic"].filter((r) => w.rarity[r]).map((r) => `${w.rarity[r]} ${r}`).join(" · ") || tt("commons and uncommons so far")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Conditions() {
  const [list, setList] = useState(null);
  const [sid, setSid] = useState(null);
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/almanac/species").then((r) => { setList(r.data); if (r.data[0]) setSid(r.data[0].id); }).catch((e) => toast.error(errMsg(e))); }, []);
  useEffect(() => { if (sid) api.get("/almanac/conditions", { params: { species_id: sid } }).then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [sid]);
  if (!list) return <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div>;
  const hmax = d ? Math.max(1, ...d.hours.map((h) => h.n)) : 1;
  return (
    <div className="space-y-3 text-[12.5px]">
      <select className="input !w-auto max-w-full" value={sid || ""} onChange={(e) => setSid(Number(e.target.value))} data-testid="almanac-species-select">
        {list.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.n} {tt("landed")}</option>)}
      </select>
      {d && (
        <div data-testid="almanac-conditions">
          <div className="text-[var(--text-2)]"><span className={`rar-${d.species.rarity}`}>{d.species.name}</span> · {d.species.water_name} · <span className="num">{d.samples}</span> {tt("landings server-wide")}{!d.enough && <span className="text-[#f0a5a3]"> · {tt("few samples yet, treat with care")}</span>}</div>
          <div className="grid sm:grid-cols-3 gap-4 mt-2">
            <div><div className="label mb-1">{tt("Time of day")}</div><Bars rows={d.period} testId="almanac-period" /></div>
            <div><div className="label mb-1">{tt("Weather")}</div><Bars rows={d.weather} colour="#9fb8d9" testId="almanac-weather" /></div>
            <div><div className="label mb-1">{tt("Tide")}</div>{d.tide.length ? <Bars rows={d.tide} colour="#7fc7c1" testId="almanac-tide" /> : <div className="text-[11.5px] text-[var(--muted)]">{tt("Fresh water, no tides.")}</div>}</div>
          </div>
          <div className="label mt-3 mb-1">{tt("By hour (UTC)")}</div>
          <div className="flex items-end gap-px h-12" data-testid="almanac-hours">{d.hours.map((h) => <div key={h.h} className="flex-1 bg-[var(--gold)]" style={{ height: `${Math.max(2, (h.n / hmax) * 100)}%`, opacity: h.n ? 1 : 0.15 }} title={`${h.h}:00: ${h.n}`} />)}</div>
          <div className="flex justify-between text-[10px] text-[var(--muted)] num"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
          <p className="text-[11px] text-[var(--muted)] mt-2">{tt("Where fish were actually landed says as much about when anglers fish as about the fish, but a species that only ever shows at dusk or on a rising tide will stand out here.")}</p>
        </div>
      )}
    </div>
  );
}

export default function Almanac() {
  const [home, setHome] = useState(null);
  const [tab, setTab] = useState("selling");
  useEffect(() => { api.get("/almanac").then((r) => setHome(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  return (
    <div className="space-y-3" data-testid="almanac-page">
      <Panel icon="almanac" title={<span className="flex items-center gap-2">{tt("The Angler's Almanac")}</span>} right={home?.active ? <span className="font-sans normal-case tracking-normal text-[11.5px] text-[#f08a45] inline-flex items-center gap-1"><PassIcon size={12} /> {tt("Angler Pass")}</span> : null} testId="almanac-header">
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Thirty days of Market prices, your own catch record water by water, and server-wide tables of when and in what weather each species has been landed. Information only, the Almanac never changes a roll.")}</p>
      </Panel>
      {!home ? <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div> : !home.active ? (
        <Panel testId="almanac-locked">
          <div className="flex items-start gap-3 text-[12.5px]">
            <Lock size={18} className="text-[#f08a45] shrink-0 mt-0.5" />
            <div><div className="font-display text-[15px] text-[#f4ead2]">{tt("Open to Angler Pass holders")}</div>
              <p className="text-[var(--text-2)] mt-0.5">{NO_IAP ? tt("Activate an Angler Pass from your Inventory to read the Almanac. Passes can be bought from other anglers on the Market.") : tt("Activate an Angler Pass from your Inventory to read the Almanac. Passes are bought on the Donate page or from other anglers on the Market.")}</p>
              {!NO_IAP && <Link to="/game/support" className="btn btn-sm btn-gold mt-2 inline-flex" data-testid="almanac-get-pass">{tt("Get an Angler Pass")}</Link>}</div>
          </div>
        </Panel>
      ) : (
        <div className="panel" data-testid="almanac-body">
          <div className="tab-strip flex flex-wrap gap-1 border-b border-[var(--border)] px-2 pt-1">
            {TABS.map(([id, label, Icon]) => <button key={id} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setTab(id)} data-testid={`almanac-tab-${id}`}><Icon size={13} />{tt(label)}</button>)}
          </div>
          <div className="panel-body">
            {tab === "selling" ? <Selling home={home} /> : tab === "prices" ? <Prices home={home} /> : tab === "crates" ? <CratePrices /> : tab === "catches" ? <Catches /> : <Conditions />}
          </div>
        </div>
      )}
    </div>
  );
}
