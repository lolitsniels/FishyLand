/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Wrench, Coins } from "lucide-react";
import { api, errMsg, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { t as tt } from "../i18n";

export const MAX_DUR = 100;
const REPAIR_BANDS = { 1: 0, 2: 5, 3: 10, 4: 10, 5: 20, 6: 20, 7: 35, 8: 35, 9: 50 };
export const repairPerPoint = (g) => (!g || g.price === 0 ? 0 : REPAIR_BANDS[g.tier] ?? 50);
export const durColor = (d) => (d <= 0 ? "var(--danger)" : d < 25 ? "#f59a5c" : d < 60 ? "#b0a69b" : "var(--ok)");

// Compact durability readout used in tackle tables.
export const Durability = ({ id, className = "" }) => {
  const { user } = useGame();
  const d = user.durability?.[id] ?? MAX_DUR;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`} title={d <= 0 ? tt("Worn out: performs at 70% until repaired") : d < 25 ? tt("Getting worn, repair soon") : tt("Condition")} data-testid={`durability-${id}`}>
      <span className="bar w-12 !h-[6px]"><span className="block h-full" style={{ width: `${(d / MAX_DUR) * 100}%`, background: durColor(d) }} /></span>
      <span className="num text-[11px]" style={{ color: durColor(d) }}>{d}/{MAX_DUR}</span>
    </span>
  );
};

// Quote for the given gear ids (defaults to everything owned).
export const useRepairQuote = (ids) => {
  const { user, lookups } = useGame();
  const list = ids || user.owned_gear;
  const disc = user.repair_discount || 0;
  const items = list.map((id) => ({ id, points: MAX_DUR - (user.durability?.[id] ?? MAX_DUR), per: repairPerPoint(lookups?.gearById[id]) })).filter((i) => i.points > 0);
  const priced = (i) => { const full = i.points * i.per; return full ? Math.max(1, Math.ceil((full * (100 - disc)) / 100)) : 0; };
  return { items, total: items.reduce((a, i) => a + priced(i), 0), worn: items.length > 0, discount: disc };
};

// One-click repair. gearId=null repairs everything owned. compact=true renders a small wrench-only button for a single item.
export const RepairButton = ({ gearId = null, label = "Repair all", className = "", testId = "repair-all-button", compact = false }) => {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const q = useRepairQuote(gearId ? [gearId] : null);
  if (!q.worn) return null;
  const go = async () => {
    setBusy(true);
    try {
      const r = await api.post("/inventory/repair", gearId ? { gear_id: gearId } : {});
      setUser(r.data.user);
      toast.success(r.data.cost > 0 ? `Tackle repaired for ${fmt(r.data.cost)} gold` : "Tackle repaired, no charge");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const pts = q.items.reduce((a, i) => a + i.points, 0);
  const poor = user.gold < q.total;
  const click = () => (poor ? toast.error(tt("Not enough gold, repairing costs {{v0}} gold", { v0: fmt(q.total) })) : go());
  const price = q.total > 0
    ? <span className={`num inline-flex items-center gap-1 ${poor ? "text-[#f0a5a3]" : "text-[#ffcfa8]"} ${compact ? "text-[10.5px]" : "text-[11.5px]"}`} title={poor ? tt("Not enough gold") : ""} data-testid={`${testId}-price`}><Coins size={compact ? 11 : 13} className={poor ? "text-[#f0a5a3]" : "text-[var(--gold)]"} />{fmt(q.total)}</span>
    : <span className={`text-[var(--ok)] ${compact ? "text-[10.5px]" : ""}`}>{tt("free")}</span>;
  if (compact) {
    return (
      <button className={`btn btn-sm inline-flex items-center gap-1 !px-1.5 ${poor ? "!border-[#6b2b2b]" : ""} ${className}`} disabled={busy} onClick={click} title={poor ? tt("Not enough gold") : `Repair this item: +${pts} durability for ${q.total > 0 ? `${fmt(q.total)} gold` : "free"}`} data-testid={testId}>
        <Wrench size={11} /> {price}
      </button>
    );
  }
  return (
    <button className={`btn btn-sm inline-flex items-center gap-1.5 ${poor ? "!border-[#6b2b2b]" : ""} ${className}`} disabled={busy} onClick={click} title={poor ? tt("Not enough gold") : `Restore ${pts} durability points`} data-testid={testId}>
      <Wrench size={12} /> {label} · {price}
    </button>
  );
};
