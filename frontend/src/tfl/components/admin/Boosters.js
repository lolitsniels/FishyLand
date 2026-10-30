/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";
import { fmtLeft } from "../../pages/game/Support";

const STATUS_CLS = { active: "text-[var(--gold)] border-[var(--gold-dim)]", queued: "text-[#8fd0f0]", done: "text-[var(--muted)]", pending: "text-[#ffcfa8]", failed: "text-[#f0a5a3]", refunded: "text-[#f0a5a3]" };
const when = (iso) => (iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

function Stat({ label, value, testId }) {
  return <div className="border border-[var(--border)] rounded-[2px] px-3 py-2 bg-[rgba(255,255,255,0.02)]"><div className="label">{label}</div><div className="num text-[16px] text-[#f4ead2]" data-testid={testId}>{value}</div></div>;
}

function LiveRow({ b, onEnd, busy }) {
  const left = b.status === "active" ? Math.max(0, Math.round((new Date(b.ends_at).getTime() - Date.now()) / 1000)) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 border border-[#3a1d10] bg-[#1a110c] px-2 py-1.5 rounded-[2px]" data-testid={`admin-boost-live-${b.id}`}>
      <span className={`tag ${STATUS_CLS[b.status]}`}>{b.status.toUpperCase()}</span>
      <span className="text-[var(--gold)]">{b.buyer}</span>
      <span className="text-[var(--muted)]">{b.hours}h {b.name} · {b.via === "admin" ? "admin grant" : `$${b.price}`}</span>
      {left !== null && <span className="num text-[11px] text-[var(--text-2)] ml-auto">ends in {fmtLeft(left)}</span>}
      {b.status === "queued" && <span className="text-[11px] text-[var(--muted)] ml-auto">starts {when(b.starts_at)}</span>}
      <button className="btn btn-sm !border-[#6b2b2b] !text-[#f0a5a3]" disabled={busy} onClick={() => onEnd(b)} data-testid={`admin-boost-end-${b.id}`}>{b.status === "active" ? "End now" : "Remove"}</button>
    </div>
  );
}

function GrantForm({ options, onDone }) {
  const [option, setOption] = useState("xp3");
  const [username, setUsername] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const grant = async () => {
    setBusy(true);
    try { await api.post("/admin/support/grant", { option, anonymous, username: username.trim() || null }); toast.success("Booster queued (free grant)"); setUsername(""); onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><label className="label block mb-1">Booster</label>
        <select className="input" value={option} onChange={(e) => setOption(e.target.value)} data-testid="admin-boost-option-select">{options.map((o) => <option key={o.id} value={o.id}>{o.kind === "luck" ? "Lucky Tide" : "Harbour Lantern"} · {o.hours} hours</option>)}</select></div>
      <div><label className="label block mb-1">Credit to (blank = you)</label><input className="input !w-40" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} data-testid="admin-boost-username-input" /></div>
      <label className="flex items-center gap-1.5 text-[12px] pb-2 cursor-pointer"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} data-testid="admin-boost-anonymous" /> anonymous</label>
      <button className="btn btn-gold" disabled={busy} onClick={grant} data-testid="admin-boost-grant-button">Grant free booster</button>
    </div>
  );
}

export function Boosters({ onPickPlayer }) {
  const [d, setD] = useState(null);
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/support/events").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); api.get("/support/state").then((r) => setOptions(r.data.options)).catch(() => {}); const t = setInterval(load, 15000); return () => clearInterval(t); }, []); // eslint-disable-line
  const end = async (b) => {
    if (!window.confirm(`${b.status === "active" ? "End" : "Remove"} ${b.buyer}'s ${b.hours}h ${b.name}? ${b.via !== "admin" ? "The player paid for this, refund them in PayPal/Tebex separately if needed." : ""}`)) return;
    setBusy(true);
    try { await api.post(`/admin/support/${b.id}/end`); toast.success("Booster ended"); load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!d) return <Empty>Loading…</Empty>;
  const live = d.boosts.filter((b) => b.status === "active" || b.status === "queued").sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : (a.starts_at || "").localeCompare(b.starts_at || "")));
  const s = d.summary;
  return (
    <div className="space-y-3" data-testid="admin-boosters">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Revenue (USD)" value={`$${s.revenue_usd.toFixed(2)}`} testId="admin-boost-revenue" />
        <Stat label="Paid boosters" value={s.paid_count} testId="admin-boost-paid" />
        <Stat label="Hours gifted" value={s.hours_gifted} testId="admin-boost-hours" />
        <Stat label="Refunded" value={s.refunded} testId="admin-boost-refunded" />
        <Stat label="Supporters" value={s.supporters} testId="admin-boost-supporters" />
      </div>
      <Panel title="Live & queued" testId="admin-boost-live">
        <div className="space-y-2 text-[12px]">
          {live.length ? live.map((b) => <LiveRow key={b.id} b={b} onEnd={end} busy={busy} />) : <Empty>No booster running or queued.</Empty>}
          <div className="pt-2 border-t border-[var(--border)]"><GrantForm options={options} onDone={load} /></div>
          <p className="text-[11px] text-[var(--muted)]">Free grants behave exactly like paid boosters (announcement, queue, supporter heart) but count $0 in revenue.</p>
        </div>
      </Panel>
      <Panel title="Purchases" bodyClass="!p-0" testId="admin-boost-purchases">
        {d.boosts.length === 0 ? <Empty>No purchases yet.</Empty> : (
          <div className="overflow-x-auto"><table className="table text-[11.5px]"><thead><tr><th>When</th><th>Buyer</th><th>Booster</th><th className="r">Paid</th><th>Status</th><th>Via</th><th>Txn</th><th>Notes</th></tr></thead><tbody>
            {d.boosts.map((b) => (
              <tr key={b.id} data-testid={`admin-boost-row-${b.id}`}>
                <td className="num whitespace-nowrap text-[var(--muted)]">{when(b.created_at)}</td>
                <td><button className="text-[var(--gold)] hover:underline" onClick={() => onPickPlayer?.(b.buyer)}>{b.buyer}</button>{b.anonymous && <span className="tag ml-1">anon</span>}</td>
                <td className="whitespace-nowrap">{b.hours}h {b.name}</td>
                <td className="num r">{b.via === "admin" ? "free" : `$${Number(b.price).toFixed(2)}`}</td>
                <td><span className={`tag ${STATUS_CLS[b.status] || ""}`}>{b.status === "pending" ? (b.declined ? "declined" : "unpaid") : b.status}</span></td>
                <td className="text-[var(--muted)]">{b.via || "-"}</td>
                <td className="num text-[var(--muted)] truncate max-w-[140px]" title={b.txn_id || b.ident || ""}>{b.txn_id || (b.ident ? `basket ${b.ident.slice(0, 8)}…` : "-")}</td>
                <td className="text-[var(--muted)] max-w-[220px] truncate" title={b.error || b.revoked || b.declined || ""}>{b.error || (b.revoked && `revoked: ${b.revoked}`) || (b.declined && `declined: ${b.declined}`) || (b.ended_by && `ended by ${b.ended_by}`) || (b.granted_by && `granted by ${b.granted_by}`) || (b.email || "")}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Panel>
      <Panel title={`Payment webhook log · ${d.provider === "paypal" ? "PayPal IPN active" : "Tebex active"}`} bodyClass="!p-0" testId="admin-boost-events">
        {d.events.length === 0 ? <Empty>No payment notifications received yet. Every PayPal IPN / Tebex webhook lands here.</Empty> : (
          <table className="table text-[11.5px]"><tbody>
            {d.events.map((e) => <tr key={e.event_id}><td className="num whitespace-nowrap text-[var(--muted)]">{when(e.at)}</td><td>{e.type}</td><td className="num text-[var(--muted)]">{e.txn || "-"}</td><td className="text-[var(--muted)]">{e.result || ""}</td></tr>)}
          </tbody></table>
        )}
      </Panel>
    </div>
  );
}
