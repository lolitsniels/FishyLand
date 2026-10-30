/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { t as tt } from "../i18n";
import { SizePips, SIZE_WORDS } from "./BaitInfo";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

export function LuckOdds({ deps = [] }) {
  const [odds, setOdds] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);
  const closeT = useRef(null);
  const show = () => { clearTimeout(closeT.current); setOpen(true); };
  const hide = () => { clearTimeout(closeT.current); closeT.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => {
    const load = () => api.get("/fish/odds").then((r) => setOdds(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, deps); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!odds) return null;
  const cls = odds.luck > 0 ? "text-[var(--ok)]" : "text-[var(--muted)]";
  const rect = open && ref.current ? ref.current.getBoundingClientRect() : null;
  const top = rect ? rect.bottom + 6 : 0, right = rect ? Math.max(8, window.innerWidth - rect.right) : 0;
  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button type="button" className={`luck-chip ${open ? "open" : ""}`} onClick={() => setOpen(true)} aria-expanded={open} data-testid="luck-odds-button">
        <span className="text-[var(--muted)]">{tt("luck")}</span> <span className={cls}>{sign(odds.luck)}</span><span className="luck-chip-caret">▾</span>
      </button>
      {open && createPortal(<OddsCard odds={odds} top={top} right={right} popRef={popRef} onEnter={show} onLeave={hide} />, document.body)}
    </span>
  );
}

const pct = (v) => (v > 0 && v < 1 ? v.toFixed(2) : v.toFixed(1));

function OddsCard({ odds, top, right, popRef, onEnter, onLeave }) {
  const max = Math.max(...RARITIES.map((r) => odds.odds[r] || 0));
  return (
    <div ref={popRef} onMouseEnter={onEnter} onMouseLeave={onLeave} className="luck-pop text-left" style={{ "--pop-top": `${top}px`, "--pop-right": `${right}px` }} role="dialog" data-testid="luck-odds-popover">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="label label-gold !text-[10px]">{tt("Your next cast")}</div>
        <div className="text-[10.5px] text-[var(--muted)]">{tt("now ·")} <span className="opacity-70">{tt("at luck 0")}</span></div>
      </div>
      <table className="w-full text-[12px]" data-testid="luck-odds-table">
        <tbody>
          {RARITIES.map((r) => {
            const now = odds.odds[r] ?? 0, base = odds.base[r] ?? 0, gone = odds.missing.includes(r);
            return (
              <tr key={r} className={gone ? "opacity-40" : ""} data-testid={`luck-odds-row-${r}`}>
                <td className={`rar-${r} capitalize pr-2 py-px whitespace-nowrap`}>{r}</td>
                <td className="w-full py-px"><div className="luck-bar"><div className={`bg-[var(--r-${r})]`} style={{ width: `${max ? Math.max(1.5, (now / max) * 100) : 0}%` }} /></div></td>
                <td className="num r pl-2 py-px whitespace-nowrap" title={gone ? tt("No such species at this water") : undefined}>{pct(now)}%</td>
                <td className="num r pl-2 py-px text-[var(--muted)] whitespace-nowrap">{pct(base)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1.5 pt-1.5 border-t border-[var(--border)] text-[11px] text-[var(--text-2)] leading-snug" data-testid="luck-odds-parts">
        {odds.groundbait ? <span className="text-[#8fd0f0]">{tt("Groundbait: luck ignored, common & uncommon doubled.")}</span>
          : odds.parts.length ? odds.parts.map((p, i) => <span key={p.key}>{i > 0 && <span className="text-[var(--muted)]"> · </span>}<span className={p.luck > 0 ? "text-[var(--ok)]" : "text-[#f0a5a3]"}>{sign(p.luck)}</span> {p.label}</span>)
          : <span className="text-[var(--muted)]">{tt("No luck bonuses right now: bait, night, weather, friends, crew perks and rod tier all add up.")}</span>}
        {odds.size > 0 && <div className="mt-1 flex items-center gap-1.5" data-testid="luck-odds-size"><span className="text-[var(--muted)]">{tt("Bigger fish")}</span> <SizePips n={odds.size} /> <span className="text-[#8fd0f0]">{tt(SIZE_WORDS[odds.size])}</span> <span className="text-[var(--muted)]">· {tt("bait")}</span></div>}
        {odds.missing.length > 0 && !odds.groundbait && <div className="text-[var(--muted)] mt-1">{tt("Faded rows: no such species here, that share falls to the rest.")}</div>}
      </div>
    </div>
  );
}
