/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "../lib/api";
import { GearIcon } from "./GearIcon";
import { Store, Coins } from "lucide-react";
import { t as tt } from "../i18n";

const LIST_BODY = { bait: (i) => ({ bait_id: i.id }), ingredient: (i) => ({ ingredient_id: i.id }), pass: (i) => ({ item_id: i.id }), potion: (i) => ({ item_id: i.id }), crate: (i) => ({ item_id: i.id }), gear: (i) => ({ item_id: i.id, copy: i.copy }), scrap: () => ({}) };

/* item: { kind, id, name, owned, hint (suggested market price per unit), stackable }. Vendor quote is fetched live. */
export function SellDialog({ item, onClose, onDone }) {
  const single = item.kind === "gear";
  const start = single ? 1 : Math.min(item.owned, item.kind === "bait" ? 10 : item.kind === "scrap" ? 50 : item.kind === "pass" || item.kind === "potion" || item.kind === "crate" ? 1 : 5);
  const [mode, setMode] = useState(null);
  const [qty, setQty] = useState(start);
  const [price, setPrice] = useState(Math.round(item.hint * start));
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/inventory/vendor-quotes").then((r) => {
      const q = r.data;
      setQuote(item.kind === "potion" ? q.potion : item.kind === "scrap" ? q.scrap : item.kind === "pass" || item.kind === "crate" ? 0 : item.copy != null ? (q.gear_copies?.[item.id] || [])[item.copy] ?? 0 : (q[item.kind] || {})[item.id] ?? 0);
    }).catch(() => setQuote(0));
  }, [item.kind, item.id]);
  const n = Number(qty);
  const valid = n >= 1 && n <= Math.min(item.owned, 500);
  const vendor = async () => {
    setBusy(true);
    try { const r = await api.post("/inventory/sell-item", { kind: item.kind, item_id: item.id, copy: item.copy, qty: n }); toast.success(tt("Sold {{v0}} × {{v1}} to the vendor for {{v2}} gold", { v0: r.data.qty, v1: r.data.name, v2: fmt(r.data.gold) })); onDone(r.data.user); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const list = async () => {
    setBusy(true);
    try { await api.post("/market/list", { kind: item.kind, ...LIST_BODY[item.kind](item), qty: n, price: Number(price) }); toast.success(tt("{{v0}} × {{v1}} listed for {{v2}} gold", { v0: n, v1: item.name, v2: fmt(price) })); onDone(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,.6)] p-3" onClick={onClose}>
      <div className="panel panel-gold w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()} role="dialog" data-testid="sell-dialog">
        <div className="font-display text-[15px]">{tt("Sell")} {item.name}</div>
        <div className="text-[13px] flex items-center gap-2"><GearIcon id={item.id} />{item.name}{!single && <> {tt("· you own ×")}{item.owned}</>}{item.detail && <span className="text-[11.5px] text-[var(--muted)]">· {item.detail}</span>}</div>
        {!single && (
          <div><label className="label block mb-1">{tt("Quantity")}</label><input type="number" min={1} max={Math.min(item.owned, 500)} className="input num" value={qty} onChange={(e) => { setQty(e.target.value); if (mode !== "market") setPrice(Math.round(item.hint * Number(e.target.value || 0))); }} data-testid="stack-qty-input" /></div>
        )}
        {mode === null && (
          <div className="grid grid-cols-2 gap-2" data-testid="sell-choice">
            <button className="btn flex flex-col items-center gap-1 py-3 !h-auto" disabled={busy || !valid || quote === null || quote === 0} onClick={vendor} data-testid="sell-vendor-button">
              <Coins size={16} className="text-[var(--gold)]" /><span>{tt("Sell to vendor")}</span>
              <span className="num text-[11.5px] text-[#ffcfa8]">{quote === null ? "…" : quote === 0 ? tt("not buying") : <>{fmt(quote * n)}g {tt("now")}</>}</span>
            </button>
            <button className="btn btn-gold flex flex-col items-center gap-1 py-3 !h-auto" disabled={busy || !valid || item.bound} onClick={() => setMode("market")} data-testid="sell-market-button">
              <Store size={16} /><span>{tt("List on market")}</span>
              <span className="num text-[11.5px] opacity-80">{item.bound ? tt("untradable") : tt("you set the price")}</span>
            </button>
          </div>
        )}
        {mode === "market" && (
          <div className="space-y-2" data-testid="sell-market-form">
            {single && <div className="text-[11.5px] text-[#ffcfa8]" data-testid="gear-fresh-note">{tt("The buyer gets a fresh copy: upgrades and wear are reset. Your upgrades on it are lost.")}</div>}
            <div><label className="label block mb-1">{tt("Total price (5% fee on sale)")}</label><input type="number" min={1} className="input num" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="stack-price-input" /><div className="text-[11px] text-[var(--muted)] mt-1 num">{n > 0 ? `${Math.round(Number(price) / n)}g each` : ""}{quote ? <> · {tt("vendor pays")} {fmt(quote)}g</> : null}</div></div>
            <div className="flex gap-2 justify-end"><button className="btn btn-sm" onClick={() => setMode(null)}>{tt("Back")}</button><button className="btn btn-sm btn-gold" disabled={busy || !(valid && Number(price) >= 1)} onClick={list} data-testid="stack-list-confirm">{tt("List it")}</button></div>
          </div>
        )}
        {mode === null && <div className="flex justify-end"><button className="btn btn-sm" onClick={onClose} data-testid="sell-cancel">{tt("Cancel")}</button></div>}
      </div>
    </div>
  );
}

export const gearMarketHint = (g) => Math.round((g?.price || 0) * 0.6);
