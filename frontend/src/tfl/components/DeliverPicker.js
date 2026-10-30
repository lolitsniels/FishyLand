/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { api, fmt, wt, wtText, errMsg } from "../lib/api";
import { Gold } from "./ui-bits";
import { t as tt } from "../i18n";

// What an automatic hand-in would take: cheapest fish first, only as many as the line still needs.
const autoPick = (fish, isKg, need) => {
  const out = new Set(); let tot = 0;
  for (const f of fish) {
    if (isKg ? tot >= need - 1e-9 : out.size >= Math.ceil(need)) break;
    out.add(f.id); tot += f.weight;
  }
  return out;
};

const Row = ({ f, on, toggle }) => (
  <label className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer border-b border-[#221e1b] ${on ? "bg-[#2a1d14]" : ""}`} data-testid={`deliver-pick-${f.id}`}>
    <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="accent-[var(--gold)]" />
    <img src={`/art/fish_v2/${f.species_id}.webp`} alt="" className="w-10 h-7 object-contain" style={{ imageRendering: "pixelated" }} />
    <span className="flex-1 min-w-0 truncate text-[12.5px]"><span className={`rar-${f.rarity}`}>{f.name}</span>{f.variant !== "normal" && <span className="text-[10.5px] text-[#f2c744] ml-1">{f.variant}</span>}</span>
    <span className="num text-[11.5px] text-[var(--text-2)]">{wt(f.weight)}</span>
    <span className="w-16 text-right"><Gold n={f.value} /></span>
  </label>
);

export default function DeliverPicker({ crewId, it, onClose, onDeliver }) {
  const isKg = it.kind === "water_kg";
  const need = Math.max(0, it.target - it.progress);
  const [fish, setFish] = useState(null);
  const [sel, setSel] = useState(new Set());
  useEffect(() => {
    api.get(`/crews/${crewId}/order/candidates`, { params: { item: it.index } })
      .then((r) => { setFish(r.data.fish); setSel(autoPick(r.data.fish, isKg, need)); }).catch((e) => { onClose(); import("sonner").then(({ toast }) => toast.error(errMsg(e))); });
  }, [crewId, it.index]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const chosen = (fish || []).filter((f) => sel.has(f.id));
  const kg = chosen.reduce((a, f) => a + f.weight, 0);
  const over = isKg ? kg - need > 0 && chosen.length > 1 && kg - chosen[chosen.length - 1].weight >= need : chosen.length > Math.ceil(need);
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-3 px-ui" onClick={onClose} data-testid="deliver-picker">
      <div className="panel panel-gold w-full max-w-[560px] max-h-[86vh] flex flex-col fade-in" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head"><span>{tt("Choose fish to hand in")}</span>
          <button className="ml-auto p-2 -m-2 text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose} aria-label={tt("Close")} data-testid="deliver-picker-close"><X size={16} /></button></header>
        <div className="px-3 py-2 text-[12px] text-[var(--text-2)]">{wtText(it.text)} · {tt("still needed:")} <b className="num text-[#f4ead2]">{isKg ? wt(need) : Math.ceil(need)}</b>. {tt("The cheapest fish are ticked for you; untick any you want to keep.")}</div>
        <div className="overflow-y-auto flex-1 min-h-[120px] border-y border-[#2e2722]">
          {!fish ? <div className="p-3 text-[12px] text-[var(--muted)]">{tt("Loading your inventory…")}</div> : fish.map((f) => <Row key={f.id} f={f} on={sel.has(f.id)} toggle={toggle} />)}
        </div>
        <div className="p-3 flex items-center gap-2 flex-wrap">
          <span className="text-[12px] text-[var(--text-2)] flex-1" data-testid="deliver-picker-summary">{chosen.length} {tt("fish")}{isKg ? ` · ${wt(kg)}` : ""} · {tt("worth")} {fmt(chosen.reduce((a, f) => a + f.value, 0))}g
            {over && <span className="block text-[11px] text-[var(--muted)]">{tt("Only what the line still needs is taken; extra fish stay in your inventory.")}</span>}</span>
          <button className="btn btn-sm" onClick={() => setSel(new Set())} data-testid="deliver-picker-clear">{tt("Untick all")}</button>
          <button className="btn btn-gold" disabled={!chosen.length} onClick={() => onDeliver(chosen.map((f) => f.id))} data-testid="deliver-picker-confirm">{tt("Hand in")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
