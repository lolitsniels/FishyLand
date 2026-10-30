/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, fmt, ago } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Gold, Empty } from "./ui-bits";
import { t as tt } from "../i18n";

function PerkRow({ p, canManage, bank, onBuy }) {
  return (
    <tr data-testid={`perk-${p.key}`}>
      <td>
        <div className="font-medium text-[#f4ead2]">{p.name} <span className="num text-[var(--muted)] text-[11px]">T{p.tier}/{p.max}</span></div>
        <div className="text-[11.5px] text-[var(--text-2)]">{p.current ? <span className="text-[var(--ok)]">{p.current}</span> : <span className="italic">{tt("not yet built")}</span>}{p.next && <span className="text-[var(--muted)]"> {tt("→ next:")} {p.next}</span>}</div>
        {p.reqs?.length > 0 && <div className="flex flex-wrap gap-1 mt-1" data-testid={`perk-reqs-${p.key}`}>{p.reqs.map((r) => <span key={r.key} className={`tag !text-[10px] ${r.met ? "text-[var(--ok)]" : "text-[#f0a5a3]"}`}>{r.met ? "✓" : "✗"} {r.have}/{r.need} {tt(r.label)}</span>)}</div>}
      </td>
      <td className="r whitespace-nowrap">
        {p.cost == null ? <span className="tag text-[var(--gold)]">{tt("maxed")}</span> : (
          <>
            <Gold n={p.cost} className="mr-2" />
            {canManage && <button className="btn btn-sm btn-gold" disabled={bank < p.cost || p.reqs?.some((r) => !r.met)} title={p.reqs?.some((r) => !r.met) ? tt("Requirements not met yet") : ""} onClick={() => onBuy(p)} data-testid={`buy-perk-${p.key}`}>{tt("Build")}</button>}
          </>
        )}
      </td>
    </tr>
  );
}

export default function CrewHall({ crew, canManage, member, onChanged, extra }) {
  const { user, setUser } = useGame();
  const [h, setH] = useState(null);
  const [amt, setAmt] = useState(100);
  const [motd, setMotd] = useState("");
  const load = () => api.get(`/crews/${crew.id}/hall`).then((r) => { setH(r.data); setMotd(r.data.motd || ""); }).catch(() => {});
  useEffect(() => { load(); }, [crew.id]); // eslint-disable-line
  const post = async (path, body, msg) => {
    try { const r = await api.post(path, body); if (r.data.user) setUser(r.data.user); if (r.data.hall) setH(r.data.hall); toast.success(msg); onChanged && onChanged(); } catch (e) { toast.error(errMsg(e)); }
  };
  if (!h) return null;
  const tier = h.hall_tier;
  return (
    <Panel icon="crews" title={<span>{tt("Crew hall ·")} {h.hall_name}</span>} right={h.bank != null && <span className="num">{tt("bank")} <Gold n={h.bank} data-testid="crew-bank" /></span>} bodyClass="!p-0" testId="crew-hall">
      {tier > 0 && (
        <div className="relative h-[120px] border-b border-[var(--border)] bg-cover bg-center" style={{ backgroundImage: `url(/art/hall/hall_${tier}.jpg)` }} data-testid="hall-banner">
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,9,8,.1), rgba(10,9,8,.85))" }} />
          <div className="absolute bottom-2 left-3 right-3 text-[12.5px]">
            <div className="label label-gold">{tt("Notice board")}</div>
            {canManage ? (
              <form className="flex gap-2 mt-1" onSubmit={(e) => { e.preventDefault(); post(`/crews/${crew.id}/hall/motd`, { text: motd }, "Notice board updated"); }}>
                <input className="input !py-1" value={motd} onChange={(e) => setMotd(e.target.value)} maxLength={300} placeholder={tt("Write a notice for your crew...")} data-testid="motd-input" />
                <button className="btn btn-sm" data-testid="motd-save">{tt("Post")}</button>
              </form>
            ) : <div className="text-[#f4ead2] italic" data-testid="motd-text">{h.motd || tt("The board is empty.")}</div>}
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-[1fr_260px]">
        <table className="table"><tbody>{h.defs.map((p) => <PerkRow key={p.key} p={p} canManage={canManage} bank={h.bank} onBuy={(perk) => post(`/crews/${crew.id}/hall/buy`, { perk: perk.key }, `${perk.name} tier ${perk.tier + 1} built`)} />)}</tbody></table>
        <div className="border-t md:border-t-0 md:border-l border-[var(--border)] p-3 text-[12px] space-y-2">
          {member ? (
            <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); post(`/crews/${crew.id}/hall/deposit`, { amount: Number(amt) }, `Deposited ${fmt(amt)} gold into the crew bank`); }} data-testid="deposit-form">
              <div className="label">{tt("Deposit into crew bank")}</div>
              <div className="flex gap-1">
                <input type="number" min={10} max={user.gold} className="input !py-1 num" value={amt} onChange={(e) => setAmt(e.target.value)} data-testid="deposit-input" />
                <button className="btn btn-sm btn-gold" disabled={Number(amt) < 10 || Number(amt) > user.gold} data-testid="deposit-button">{tt("Deposit")}</button>
              </div>
              <div className="flex gap-1">{[100, 1000, 10000].map((n) => <button type="button" key={n} className="btn btn-sm" onClick={() => setAmt(n)}>{fmt(n)}</button>)}</div>
              <div className="text-[var(--muted)]">{tt("Every member can chip in.")} {canManage ? tt("You decide what gets built.") : tt("The leader and officers decide what gets built.")} {tt("Perks apply to all")} {h.max_members}{tt("-max members.")}</div>
            </form>
          ) : <div className="text-[var(--muted)] italic">{tt("Only members can contribute to this hall.")}</div>}
          {extra}
          <div>
            <div className="label mb-1">{tt("Hall ledger")}</div>
            {h.log.length === 0 ? <Empty>{tt("Nothing yet.")}</Empty> : <ul className="space-y-0.5 text-[11.5px] text-[var(--text-2)] max-h-28 overflow-auto" data-testid="hall-log">{h.log.map((l, i) => <li key={i}><b className="text-[var(--text)]">{l.who}</b> {l.text} <span className="text-[var(--muted)]">· {ago(l.at)}</span></li>)}</ul>}
          </div>
        </div>
      </div>
    </Panel>
  );
}
