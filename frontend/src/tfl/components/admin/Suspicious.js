import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ago, errMsg, fmt } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

const STATE = {
  limited: ["Limited", "text-[#f0a5a3] border-[#8a3b39]"], suspect: ["Suspect", "text-[#ffcf8a] border-[#8a6a2a]"], watch: ["Watching", "text-[#9fd3ff] border-[#2f5d80]"],
  new: ["New", "text-[var(--text-2)] border-[var(--border)]"], trusted: ["Trusted", "text-[var(--ok)] border-[#3f7a55]"], gone: ["Deleted", "text-[var(--muted)] border-[var(--border)]"],
};
const FILTERS = [["active", "Needs a look"], ["all", "Everyone"], ["watch", "Watching"], ["limited", "Limited"], ["trusted", "Trusted"], ["banned", "Banned"]];
const pass = (f, a) => f === "all" || (f === "banned" ? a.banned : !a.banned && (f === "active" ? ["limited", "suspect"].includes(a.state) || (a.state === "new" && a.score7 > 0) : a.state === f));

function StateTag({ a }) {
  const [label, cls] = STATE[a.state] || STATE.new;
  return <span className={`tag border ${cls}`} data-testid={`bot-state-${a.username}`}>{a.banned ? "Banned" : label}</span>;
}

function Actions({ a, act, busy, can }) {
  const b = (status, label, title) => can.includes(status) && <button className="btn btn-sm" disabled={busy} title={title} onClick={(e) => { e.stopPropagation(); act(a, status); }} data-testid={`bot-${status}-${a.username}`}>{label}</button>;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {a.state !== "watch" && b("watch", "Watch", "Suspect rules (smaller rewards on long days) but trading stays open")}
      {a.state !== "limited" && b("limited", "Limit", "Suspect rules plus no Market trading or crew bank deposits")}
      {a.state !== "trusted" && b("trusted", "Trust", "Real player: the detector stops treating them as a suspect")}
      {a.state !== "new" && b("clear", "Clear", "Remove the status and forget the hits so far")}
      {!a.banned && b("ban", "Ban", "Ban this account")}
      {!a.gone && can.includes("check") && <button className="btn btn-sm" disabled={busy} title="Deal a human check now, blocks casting until solved" onClick={async (e) => { e.stopPropagation(); try { await api.post(`/admin/humancheck/${a.user_id}`); toast.success(`${a.username} gets a human check on their next cast`); } catch (err) { toast.error(errMsg(err)); } }} data-testid={`suspicious-check-${a.username}`}>Check</button>}
    </div>
  );
}

function Detail({ a, label, onPickPlayer }) {
  return (
    <div className="px-3 py-3 bg-[rgba(0,0,0,.2)] text-[11.5px] grid md:grid-cols-3 gap-4" data-testid={`bot-detail-${a.username}`}>
      <div className="space-y-1">
        <div className="label">Play</div>
        <div>Fished today: <b className="num">{a.hours_today} h</b> across <b className="num">{a.active_hours}</b> hours of the day</div>
        <div>Last 24 h: <b className="num">{a.catches24}</b> catches, <b className="num">{a.rare24}</b> epic or better</div>
        <div>All time: <span className="num">{fmt(a.casts)}</span> casts, <span className="num">{fmt(a.catches)}</span> catches, <span className="num">{fmt(a.gold)}g</span></div>
        <div>Reward now: <b className={`num ${a.reward_pct < 100 ? "text-[#ffcf8a]" : ""}`}>{a.reward_pct}%</b>{a.withheld > 0 && <> · <span className="num">{fmt(a.withheld)}g</span> held back so far</>}</div>
        <div>Trading: {a.limited ? <span className="text-[#f0a5a3]">paused</span> : "open"} · Human check <span className="text-[var(--ok)] num">✓{a.humancheck.passed}</span> <span className="text-[#f0a5a3] num">✗{a.humancheck.failed}</span>{a.humancheck.pending && " · waiting"}</div>
        <div className="text-[var(--muted)]">Account {ago(a.created_at)} · seen {ago(a.last_seen)}{a.status_by && <> · status by {a.status_by} {ago(a.status_at)}</>}</div>
      </div>
      <div className="space-y-1">
        <div className="label">Same connection ({a.linked.length})</div>
        {a.linked.length === 0 ? <div className="text-[var(--muted)]">No other accounts share an IP.</div> : <div className="flex flex-wrap gap-1">{a.linked.map((l) => <button key={l.username} className={`tag ${l.banned ? "text-[#f0a5a3]" : ""}`} onClick={() => onPickPlayer(l.username)} data-testid={`bot-linked-${l.username}`}>{l.username}{l.guest && " · guest"}{l.banned && " · banned"}</button>)}</div>}
      </div>
      <div className="space-y-0.5">
        <div className="label">Hits ({a.events.length})</div>
        {a.events.length === 0 ? <div className="text-[var(--muted)]">None since the last clear.</div> : a.events.map((e, i) => <div key={i} className="flex gap-2"><span className="text-[var(--muted)] whitespace-nowrap num">{ago(e.at)}</span><span className="text-[var(--gold)] whitespace-nowrap">{label(e.code)}</span><span className="text-[var(--text-2)]">{e.detail}</span></div>)}
      </div>
    </div>
  );
}

function Row({ a, d, open, setOpen, act, busy, onPickPlayer }) {
  const label = (code) => d.signals[code]?.label || code;
  return [
    <tr key={a.user_id} className={`cursor-pointer ${a.score24 >= d.rules.suspect_score && !a.banned ? "bg-[rgba(217,83,79,.10)]" : ""}`} onClick={() => setOpen(open ? "" : a.user_id)} data-testid={`suspicious-${a.username}`}>
      <td className={`num r text-[15px] ${a.score24 >= d.rules.suspect_score ? "text-[#f0a5a3]" : "text-[var(--gold)]"}`} title={`7 days: ${a.score7} · all time: ${a.score_all}`}>{a.score24}<div className="text-[10px] text-[var(--muted)]">7d {a.score7}</div></td>
      <td className="whitespace-nowrap"><button className="underline decoration-dotted" onClick={(e) => { e.stopPropagation(); onPickPlayer(a.username); }} data-testid={`suspicious-open-${a.username}`}>{a.username}</button>{a.guest && <span className="tag ml-1">guest</span>}{a.linked.length > 0 && <span className="tag ml-1" title="Other accounts on the same connection">+{a.linked.length} linked</span>}<div className="text-[10.5px] text-[var(--muted)]">Lv {a.level ?? "-"} · {a.water}</div></td>
      <td><StateTag a={a} /></td>
      <td className="text-[11px] text-[var(--text-2)]">{Object.entries(a.reasons).map(([k, n]) => <span key={k} className="tag mr-1 mb-0.5">{label(k)}{n > 1 && <span className="num text-[var(--muted)]"> ×{n}</span>}</span>)}</td>
      <td className="num r text-[var(--text-2)]">{a.hours_today} h</td>
      <td className="num r text-[var(--text-2)]">{a.catches24}</td>
      <td className={`num r ${a.reward_pct < 100 ? "text-[#ffcf8a]" : "text-[var(--text-2)]"}`}>{a.reward_pct}%</td>
      <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{ago(a.last_at)}</td>
      <td><Actions a={a} act={act} busy={busy} can={d.can} /></td>
    </tr>,
    open && <tr key={a.user_id + "-d"}><td colSpan={9} className="!p-0"><Detail a={a} label={label} onPickPlayer={onPickPlayer} /></td></tr>,
  ];
}

const REPORT_COLS = [["suspect", "New suspects"], ["watch", "Watched"], ["limited", "Limited"], ["trusted", "Trusted"], ["clear", "Cleared"], ["ban", "Banned"]];

function Report({ rows }) {
  const day = (k, i) => i === 0 ? "Today" : i === 1 ? "Yesterday" : new Date(k + "T12:00:00Z").toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const total = (k) => rows.reduce((n, r) => n + r[k], 0);
  return (
    <Panel title="Daily bot report" right={<span className="text-[11px] text-[var(--muted)]">last 7 days, UTC</span>} bodyClass="!p-0" testId="bot-report">
      <div className="overflow-x-auto"><table className="table text-[12px]"><thead><tr><th>Day</th>{REPORT_COLS.map(([k, l]) => <th key={k} className="r">{l}</th>)}</tr></thead><tbody>
        {rows.map((r, i) => <tr key={r.day} className={i === 0 ? "bg-[rgba(240,194,122,.06)]" : ""} data-testid={`bot-report-${r.day}`}><td className="whitespace-nowrap">{day(r.day, i)}</td>{REPORT_COLS.map(([k]) => <td key={k} className={`num r ${r[k] ? (k === "ban" || k === "limited" ? "text-[#f0a5a3]" : "text-[var(--text)]") : "text-[var(--muted)]"}`}>{r[k]}</td>)}</tr>)}
        <tr className="border-t border-[var(--border)]"><td className="text-[var(--muted)]">7 days</td>{REPORT_COLS.map(([k]) => <td key={k} className="num r font-semibold" data-testid={`bot-report-total-${k}`}>{total(k)}</td>)}</tr>
      </tbody></table></div>
    </Panel>
  );
}

export function Suspicious({ onPickPlayer }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState("");
  const [filter, setFilter] = useState("active");
  useEffect(() => { api.get("/admin/suspicious").then((r) => setD(r.data)).catch(() => {}); }, []);
  const act = async (a, status) => {
    if (status === "ban") {
      const reason = window.prompt(`Ban ${a.username}? Reason (shown in the log):`, "Botting");
      if (reason === null) return;
      setBusy(true);
      try { await api.post("/admin/ban", { username: a.username, reason }); setD((await api.get("/admin/suspicious")).data); toast.success(`${a.username} banned`); }
      catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try { setD((await api.post(`/admin/suspicious/${a.user_id}/status`, { status })).data); toast.success(`${a.username}: ${status === "clear" ? "cleared" : status}`); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!d) return <Empty>Loading...</Empty>;
  const rows = d.anglers.filter((a) => pass(filter, a));
  const r = d.rules;
  return (
    <div className="space-y-3" data-testid="admin-suspicious">
      <Report rows={d.report} />
      <Panel title="Bot catcher" right={<span className="text-[11px] text-[var(--muted)]">score = signal weights in the last 24 h · click a row for details</span>} bodyClass="!p-0" testId="suspicious-list">
        <div className="p-3 pb-2 text-[12px] text-[var(--text-2)] space-y-2">
          <p>Anyone scoring <b>{r.suspect_score}+</b> in 24 h becomes a <b>Suspect</b> for {r.auto_hours} h. Suspects quietly earn less after {r.taper_start} h of fishing in a day (down to {r.taper_floor}% at {r.taper_end} h), but keep trading. Normal players never see any of this. Nobody is banned automatically: <b>Watch</b> marks them for review, <b>Limit</b> pauses their Market trading and crew deposits{d.can.includes("trusted") ? <>, <b>Trust</b> marks a real player, <b>Clear</b> forgets the hits.</> : <>. Trusting, clearing and banning are up to the owner.</>}</p>
          <div className="flex flex-wrap gap-1.5">{Object.entries(d.signals).map(([k, v]) => <span key={k} className="tag" data-testid={`signal-${k}`}>{v.label} <span className="num text-[var(--muted)]">+{v.weight}</span></span>)}</div>
          <div className="flex flex-wrap gap-1" data-testid="bot-filters">{FILTERS.map(([k, l]) => <button key={k} className={`btn btn-sm ${filter === k ? "btn-gold" : ""}`} onClick={() => setFilter(k)} data-testid={`bot-filter-${k}`}>{l} <span className="num opacity-70">{d.anglers.filter((a) => pass(k, a)).length}</span></button>)}</div>
        </div>
        {rows.length === 0 ? <Empty>Nobody here. Clean docks.</Empty> : (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th className="r">Score</th><th>Angler</th><th>Status</th><th>Signals</th><th className="r">Today</th><th className="r">24h catches</th><th className="r">Reward</th><th className="r">Last hit</th><th></th></tr></thead><tbody>
            {rows.map((a) => <Row key={a.user_id} a={a} d={d} open={open === a.user_id} setOpen={setOpen} act={act} busy={busy} onPickPlayer={onPickPlayer} />)}
          </tbody></table></div>
        )}
      </Panel>
    </div>
  );
}
