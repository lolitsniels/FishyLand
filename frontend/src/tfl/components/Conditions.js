/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { CloudRain, Cloud, Sun, CloudLightning, CloudFog, Wind, Waves } from "lucide-react";
import { t as tt } from "../i18n";

const ICON = { clear: Sun, overcast: Cloud, rain: CloudRain, storm: CloudLightning, fog: CloudFog, wind: Wind };
const mod = (n) => (n > 0 ? <span className="text-[var(--ok)]">+{n}</span> : n < 0 ? <span className="text-[#f0a5a3]">{n}</span> : <span className="text-[var(--muted)]">0</span>);

export const ConditionLine = ({ c, compact = false, luck = null }) => {
  if (!c) return null;
  const Icon = ICON[c.weather] || Sun;
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? "text-[11px]" : "text-[12.5px]"}`} data-testid={`conditions-${c.water}`}>
      <Icon size={compact ? 12 : 14} className="text-[var(--text-2)]" /><span className="capitalize">{c.weather}</span><span className="text-[var(--muted)]">·</span><span className="capitalize">{c.period}</span>
      {c.tide && <><span className="text-[var(--muted)]">·</span><Waves size={12} className="text-[var(--energy)]" /><span className="capitalize">{c.tide} {tt("tide")}</span></>}
      {!compact && <><span className="text-[var(--muted)] ml-1">{tt("bite")} {mod(c.bite)}%</span>{luck || <span className="text-[var(--muted)]">{tt("luck")} {mod(c.luck)}</span>}</>}
    </span>
  );
};

export function useConditions() {
  const [cond, setCond] = useState({});
  useEffect(() => {
    const load = () => api.get("/waters/conditions").then((r) => setCond(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  return cond;
}
