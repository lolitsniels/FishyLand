/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useMemo, useState } from "react";
import { fmt, wt, RARITIES } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { FishPlate } from "../../components/FishPlate";
import { Pager } from "./Inventory";
import { t as tt } from "../../i18n";

const PER = 50;
const SORTS = {
  cheapest: (a, b) => (a.variant !== "normal") - (b.variant !== "normal") || a.value - b.value,
  heaviest: (a, b) => b.weight - a.weight,
  newest: (a, b) => b.caught_at.localeCompare(a.caught_at),
  name: (a, b) => a.name.localeCompare(b.name) || a.value - b.value,
  rarity: (a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity),
};

// Keepnet-style table for choosing which bait-grade fish a recipe consumes.
export function CraftFishPicker({ fish, sel, toggle, max, onPick }) {
  const { lookups } = useGame();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("cheapest");
  const [rf, setRf] = useState("all");
  const [variants, setVariants] = useState("all");
  const [page, setPage] = useState(1);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return fish.filter((f) => (!n || f.name.toLowerCase().includes(n)) && (rf === "all" || f.rarity === rf) && (variants === "all" || (variants === "plain" ? f.variant === "normal" : f.variant !== "normal"))).sort(SORTS[sort]);
  }, [fish, q, sort, rf, variants]);
  useEffect(() => { setPage(1); }, [q, sort, rf, variants]);
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const cur = Math.min(page, pages);
  const rows = list.slice((cur - 1) * PER, cur * PER);
  const rarities = RARITIES.filter((r) => fish.some((f) => f.rarity === r));
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <input className="input !w-40" placeholder={tt("Search fish…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tt("Search fish")} data-testid="craft-search" />
        <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="craft-sort">
          <option value="cheapest">{tt("Cheapest first")}</option><option value="heaviest">{tt("Heaviest first")}</option><option value="newest">{tt("Newest")}</option><option value="name">A → Z</option><option value="rarity">{tt("Rarity")}</option>
        </select>
        <select className="input !w-auto" value={rf} onChange={(e) => setRf(e.target.value)} data-testid="craft-rarity-filter"><option value="all">{tt("All rarities")}</option>{rarities.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <select className="input !w-auto" value={variants} onChange={(e) => setVariants(e.target.value)} data-testid="craft-variant-filter"><option value="all">{tt("Plain & variants")}</option><option value="plain">{tt("Plain only")}</option><option value="variant">{tt("Variants only")}</option></select>
        <button className="btn btn-sm" disabled={!max} onClick={() => onPick(list.slice(0, max).map((f) => f.id))} title={tt("Selects the fish in this list, in this order, up to the most you can craft")} data-testid="craft-select-shown">{tt("Select shown")}</button>
        <span className="text-[11.5px] text-[var(--muted)] ml-auto">{fmt(list.length)} {tt("fish")}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="table" data-testid="craft-fish-table">
          <thead><tr><th></th><th>{tt("Fish")}</th><th>{tt("Water")}</th><th className="r">{tt("Weight")}</th><th className="r">{tt("Value")}</th></tr></thead>
          <tbody>
            {rows.map((f) => {
              const on = sel.has(f.id), full = !on && sel.size >= max;
              return (
                <tr key={f.id} className={`${on ? "bg-[#1f1714]" : ""} ${full ? "opacity-50" : "cursor-pointer"}`} onClick={() => !full && toggle(f.id)} data-testid={`craft-fish-${f.id}`}>
                  <td><input type="checkbox" checked={on} disabled={full} onChange={() => toggle(f.id)} onClick={(e) => e.stopPropagation()} data-testid={`craft-check-${f.id}`} /></td>
                  <td><span className="inline-flex items-center gap-1.5"><FishPlate speciesId={f.species_id} name={f.name} className="w-9 h-5" /><span className={`rar-${f.rarity} font-medium`}>{f.name}</span></span>{f.variant !== "normal" && <span className="tag tag-variant ml-1.5" data-testid={`craft-fish-variant-${f.id}`}>{f.variant}</span>}</td>
                  <td className="text-[var(--text-2)] text-xs">{lookups?.waterByKey[f.water]?.name}</td>
                  <td className="num r">{wt(f.weight)}</td>
                  <td className="num r text-[var(--gold)]">{fmt(f.value)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && <Pager cur={cur} pages={pages} total={list.length} onPage={setPage} />}
    </>
  );
}
