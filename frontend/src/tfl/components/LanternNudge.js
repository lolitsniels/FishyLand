/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lamp, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useCountdown, fmtShort } from "../pages/game/Support";
import { t as tt } from "../i18n";
import { NO_IAP } from "../lib/portal";

/* One slim line on the fishing page: lantern status + the cheapest booster price, linking to the Donate page. */
export function LanternNudge(props) {
  return NO_IAP ? null : <Nudge {...props} />;
}

function Nudge({ compact = false }) {
  const [st, setSt] = useState(null);
  useEffect(() => { api.get("/support/state").then((r) => setSt(r.data)).catch(() => {}); }, []);
  const active = st?.lanes?.xp?.active;
  const left = useCountdown(active?.ends_at);
  if (!st) return null;
  return (
    <Link to="/game/support" className={`relative overflow-hidden flex items-center ${compact ? "gap-1.5 px-2 py-1 max-w-[210px] lantern-compact" : "gap-2.5 px-3 py-2"} rounded-[3px] border border-[var(--gold-dim)] bg-[linear-gradient(100deg,#3a1d10_0%,#5a2414_45%,#3a1d10_100%)] shadow-[inset_0_1px_0_rgba(255,230,170,.18),0_0_12px_rgba(240,194,122,.18)] hover:shadow-[inset_0_1px_0_rgba(255,230,170,.25),0_0_18px_rgba(240,194,122,.4)] hover:border-[var(--gold)] transition-[box-shadow,border-color] group`} data-testid="lantern-nudge">
      <span className="absolute inset-y-0 -left-1/2 w-1/2 bg-[linear-gradient(100deg,transparent,rgba(255,240,200,.18),transparent)] group-hover:animate-[nudge-shine_1.2s_ease-in-out] pointer-events-none" />
      <Lamp size={16} className={`shrink-0 text-[#ffcfa8] ${active ? "boost-live" : ""}`} />
      <span className="flex-1 min-w-0 leading-tight">
        {active && left > 0
          ? <><span className="font-display text-[13px] text-[#ffe2cc] tracking-wide">{tt("Double XP is live!")}</span><span className="block text-[11px] text-[#f0b48a]">{tt("Lit by")} <span className="text-[#ffcfa8]">{active.buyer}</span> · <span className="num">{fmtShort(left)}</span> {tt("left, queue the next booster")}</span></>
          : <><span className="font-display text-[13px] text-[#ffe2cc] tracking-wide">{tt("Buy a booster")}</span><span className="block text-[11px] text-[#f0b48a]">{tt("Double XP · 1.5× gold · faster energy, for everyone online")}</span></>}
      </span>
      <ChevronRight size={14} className="shrink-0 text-[#ffcfa8] group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
