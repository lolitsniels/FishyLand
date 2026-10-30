/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCountdown, fmtLeft, fmtShort, boostIcon } from "../pages/game/Support";
import { t as tt } from "../i18n";
import { NO_IAP } from "../lib/portal";

export function BoostBadge({ boost, className = "" }) {
  const left = useCountdown(boost?.ends_at);
  const [hover, setHover] = useState(false);
  if (!boost || left <= 0) return null;
  const Tag = NO_IAP ? "span" : Link;
  const luck = boost.kind === "luck";
  const tone = luck ? "border-[#3f7a55] bg-[rgba(120,220,150,0.08)] text-[#9fe3b8] hover:bg-[rgba(120,220,150,0.16)]" : "border-[var(--gold-dim)] bg-[rgba(240,194,122,0.08)] text-[var(--gold)] hover:bg-[rgba(240,194,122,0.16)]";
  return (
    <div className={`relative inline-flex ${className}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
      <Tag {...(NO_IAP ? {} : { to: "/game/support" })} className={`inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-[2px] border text-[11px] whitespace-nowrap transition-colors overflow-visible ${tone} ${className.includes("w-full") ? "w-full justify-center" : ""}`}
        aria-label={`${boost.name} active, ${fmtLeft(left)} left`} data-testid={`hud-boost-badge-${boost.kind}`}>
        <img src={boostIcon(boost)} alt="" className="w-4 h-4 object-contain shrink-0 boost-live" draggable="false" /> {boost.name} <span className="num text-[#f4ead2]" data-testid={`hud-boost-left-${boost.kind}`}>{hover ? fmtLeft(left) : fmtShort(left)}</span>
      </Tag>
      {hover && (
        <div className="absolute left-0 top-full mt-1.5 z-30 panel panel-gold px-2.5 py-2 text-[11px] whitespace-nowrap shadow-[0_6px_18px_rgba(0,0,0,.5)]" data-testid={`boost-tooltip-${boost.kind}`}>
          <div className="text-[#ffcfa8] mb-1">{boost.name} {tt("· server-wide ·")} <span className="num">{fmtLeft(left)}</span> {tt("left")}</div>
          <ul className="space-y-0.5 text-[var(--text-2)]">
            {luck ? <>
              <li><span className="font-serif text-[#9fe3b8]">+{boost.luck}</span> {tt("luck on every cast")}</li>
              <li>{tt("about twice the legendary & mythic odds")}</li>
              <li className="text-[var(--muted)]">{tt("Groundbait ignores luck, as always")}</li>
            </> : <>
              <li><span className="font-serif text-[var(--gold)]">{boost.mult}×</span> {tt("XP on every fish landed")}</li>
              <li><span className="font-serif text-[var(--gold)]">{boost.sell_mult}×</span> {tt("gold when selling fish to the vendor")}</li>
              <li><span className="font-serif text-[var(--gold)]">{boost.energy_mult || 1.5}×</span> {tt("faster energy regen")}</li>
            </>}
          </ul>
          <div className="text-[var(--muted)] mt-1">{tt("Courtesy of")} <span className="text-[var(--gold)]">{boost.buyer}</span> {tt("· click for details")}</div>
        </div>
      )}
    </div>
  );
}
