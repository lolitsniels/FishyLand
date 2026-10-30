/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { t as tt } from "../i18n";

export const useWaterProgress = (deps = []) => {
  const [p, setP] = useState(null);
  useEffect(() => { api.get("/waters/progress").then((r) => setP(r.data)).catch(() => {}); }, deps); // eslint-disable-line
  return p;
};

// Compact two-line progress: species recorded + variants caught, with a gold "Complete" stamp.
export const WaterProgress = ({ p, compact = false, stamp = true, testId }) => {
  if (!p) return null;
  const pct = p.total ? (p.species / p.total) * 100 : 0;
  const vt = p.variants_total ?? p.total;
  const vpct = vt ? (p.variants / vt) * 100 : 0;
  return (
    <div className={`text-[11px] ${compact ? "space-y-0.5" : "space-y-1"}`} data-testid={testId}>
      <div className="flex items-center gap-2">
        <span className="label !text-[9.5px] w-14 shrink-0">{tt("Species")}</span>
        <span className="bar flex-1 !h-[6px]"><span className="block h-full" style={{ width: `${pct}%`, background: p.complete ? "var(--gold)" : "var(--ok)" }} /></span>
        <span className="num w-12 text-right text-[var(--text-2)]" data-testid={testId ? `${testId}-species` : undefined}>{p.species}/{p.total}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="label !text-[9.5px] w-14 shrink-0" title={tt("Species caught as a scarred, giant, golden or other variant")}>{tt("Variants")}</span>
        <span className="bar flex-1 !h-[6px]"><span className="block h-full" style={{ width: `${vpct}%`, background: "#b9a8c9" }} /></span>
        <span className="num w-12 text-right text-[var(--text-2)]" data-testid={testId ? `${testId}-variants` : undefined}>{p.variants}/{vt}</span>
      </div>
      {stamp && p.complete && <div className="inline-block text-[10px] uppercase tracking-widest text-[var(--gold)] border border-[var(--gold-dim)] px-1.5 py-px" data-testid={testId ? `${testId}-complete` : undefined}>{tt("Complete")}</div>}
      {stamp && p.variants_complete && <div className="inline-block text-[10px] uppercase tracking-widest text-[#e0c8f0] border border-[#8a6ea6] px-1.5 py-px ml-1" data-testid={testId ? `${testId}-wildlife` : undefined}>{tt("Wildlife")}</div>}
    </div>
  );
};
