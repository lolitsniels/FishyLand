/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, fmt, wt, wtText, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Gold, Pearls, Bar } from "./ui-bits";
import { untilText } from "../pages/game/Quests";
import DeliverPicker from "./DeliverPicker";
import { t as tt } from "../i18n";

function Line({ it, member, busy, onDeliver, orderDone, closed }) {
  const isKg = it.kind === "water_kg";
  const need = Math.max(0, it.target - it.progress);
  // Only what the line still needs leaves your keepnet (lowest-value fish first), never your whole stock.
  const handIn = it.have ? (isKg ? wt(Math.min(it.have.kg, need)) : Math.min(it.have.count, Math.ceil(need))) : null;
  const spare = it.have ? (isKg ? it.have.kg > need : it.have.count > Math.ceil(need)) : false;
  return (
    <li className="py-1.5 border-b border-[#221e1b] last:border-0" data-testid={`crew-order-item-${it.index}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-[12.5px] ${it.done ? "text-[var(--ok)]" : "text-[#f4ead2]"}`}>{it.done ? "✓ " : ""}{wtText(it.text)}</span>
        <span className="num text-[10.5px] text-[var(--muted)]" data-testid={`crew-order-progress-${it.index}`}>{isKg ? `${wt(it.progress)} / ${wt(it.target)}` : `${it.progress} / ${it.target}`}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Bar value={it.progress} max={it.target} color={it.done ? "var(--ok)" : "var(--gold)"} className="flex-1 !h-1.5" />
        {member && !it.done && !orderDone && !closed && (
          <button className={`btn btn-sm ${it.have?.count > 0 ? "btn-gold" : ""}`} disabled={busy || !it.have || it.have.count === 0} onClick={() => onDeliver(it)} data-testid={`crew-order-deliver-${it.index}`}
            title={spare ? `You have ${isKg ? wt(it.have.kg) : it.have.count} that fit, choose which ${handIn} to hand in` : undefined}>
            {it.have?.count > 0 ? `${tt("Choose fish")} (${handIn})` : tt("None in your inventory")}
          </button>
        )}
      </div>
    </li>
  );
}

export default function CrewOrder({ crewId }) {
  const { user, setUser } = useGame();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(null);
  const load = useCallback(() => api.get(`/crews/${crewId}/order`).then((r) => setD(r.data)).catch(() => {}), [crewId]);
  useEffect(() => { load(); const t = setInterval(load, 60000); window.addEventListener("inventory-changed", load); return () => { clearInterval(t); window.removeEventListener("inventory-changed", load); }; }, [load]);
  if (!d) return null;
  const o = d.order;
  const closed = new Date(o.ends_at).getTime() <= Date.now();
  const deliver = async (ids) => {
    const idx = picking.index;
    setBusy(true);
    try {
      const r = await api.post(`/crews/${crewId}/order/deliver`, { item: idx, catch_ids: ids });
      setPicking(null);
      setD((x) => ({ ...x, order: r.data.order })); setUser(r.data.user);
      window.dispatchEvent(new CustomEvent("inventory-changed"));
      if (r.data.done) toast.success(tt("The crew filled this week's order! Check your messages for your share."), { duration: 8000 });
      else toast.message(tt("Handed in {{v0}} fish for the crew", { v0: r.data.delivered }));
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const me = o.mine;
  return (
    <Panel icon="contracts" title={<span className="flex items-center gap-1.5">{tt("Weekly crew order ·")} {o.patron_name}</span>}
      right={<span className="num">{o.status === "done" ? tt("filled ✓") : closed ? tt("closed") : `closes in ${untilText(o.ends_at)}`}</span>} testId="crew-order">
      <div className="flex gap-3">
        <img src={o.portrait} alt="" className="w-[64px] h-[64px] object-cover border border-[var(--gold-dim)] shrink-0 hidden sm:block" style={{ objectPosition: "center 20%" }} />
        <div className="min-w-0 flex-1 text-[12.5px]">
          <p className="text-[var(--text-2)]">{tt("One big order for the whole crew, sized to your roster. Every member hands fish in from their own inventory;")} <b>{tt("all four lines must be filled before the week ends")}</b> {tt("or nobody is paid. On completion")} <Gold n={o.pool} className="text-[12.5px]" /> {tt("is paid out:")} <b>{d.bank_share_pct}%</b> {tt("to the crew bank, the rest split among everyone who delivered by share of the work, plus XP,")} {o.pearls[0]}–{o.pearls[1]} {tt("Pearls (≥")}{o.big_share_pct}{tt("% share) and +")}{o.favour} {tt("favour with")} {o.patron_name.split(" ")[0]}.</p>
          <ul className="mt-2" data-testid="crew-order-items">{o.items.map((it) => <Line key={it.index} it={it} member={d.member} busy={busy} onDeliver={setPicking} orderDone={o.status === "done"} closed={closed} />)}</ul>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
            <span className="text-[var(--text-2)]">{tt("Members' pool")} <Gold n={o.members_pool} className="text-[11.5px]" /> {tt("· bank")} <Gold n={o.bank_cut} className="text-[11.5px]" /></span>
            {me && <span className="text-[var(--ok)]" data-testid="crew-order-mine">{tt("You:")} {me.fish} {tt("fish ·")} {Math.round(me.share * 100)}% → <Gold n={me.gold} className="text-[11.5px]" /> + <Pearls n={me.pearls} className="text-[11.5px]" /> {tt("if filled")}</span>}
            {!me && d.member && <span className="text-[var(--muted)]">{tt("You haven't delivered anything yet.")}</span>}
          </div>
          {o.contributors.length > 0 && (
            <div className="mt-1.5 text-[11px] text-[var(--muted)]" data-testid="crew-order-contributors">
              {tt("Delivered by:")} {o.contributors.map((c) => <span key={c.username} className={c.username === user.username ? "text-[var(--gold)]" : ""}>{c.username} ({c.fish}, {Math.round(c.share * 100)}%)</span>).reduce((acc, x, i) => (i === 0 ? [x] : [...acc, ", ", x]), [])}
            </div>
          )}
          {d.last && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{tt("Last week:")} {d.last.patron_name}{tt("'s order")} {d.last.status === "done" ? `filled, ${fmt(d.last.pool)} gold paid out` : tt("was not completed")}.</div>}
        </div>
      </div>
      {picking && <DeliverPicker crewId={crewId} it={picking} onClose={() => setPicking(null)} onDeliver={deliver} />}
    </Panel>
  );
}
