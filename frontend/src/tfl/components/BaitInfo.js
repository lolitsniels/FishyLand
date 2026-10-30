/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Gold, Pearls } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { X } from "lucide-react";
import { t as tt } from "../i18n";

const VARIANT_ODDS = [["Scarred", 3.5], ["Giant", 2], ["Albino", 1.2], ["Golden", 0.6]];
const pct1 = (v) => (Math.round(v * 100) / 100).toString();

export const SIZE_WORDS = ["standard", "a little bigger", "bigger", "big", "very big", "giants"];

export function SizePips({ n = 0, className = "", testId }) {
  return (
    <span className={`inline-flex items-center gap-[3px] align-middle ${className}`} title={tt("Bigger fish: {{v0}}/5, better bait skews the weight roll toward big specimens and raises Giant / Albino / Golden odds", { v0: n })} data-testid={testId}>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`inline-block w-[7px] h-[7px] rounded-full ${i < n ? "bg-[#8fd0f0] shadow-[0_0_4px_rgba(143,208,240,.7)]" : "bg-[var(--border)]"}`} />)}
    </span>
  );
}

export function useBaitValue(deps = []) {
  const [v, setV] = useState(null);
  useEffect(() => { api.get("/shop/bait-value").then((r) => setV(r.data)).catch(() => {}); }, deps);
  return v;
}

export function ProfitChip({ v, className = "", testId }) {
  if (!v) return null;
  const good = v.net > 0;
  return (
    <span className={`num text-[11px] px-1.5 py-px rounded-full border whitespace-nowrap ${good ? "text-[var(--ok)] border-[rgba(120,200,140,.4)] bg-[rgba(120,200,140,.08)]" : "text-[#f0a5a3] border-[rgba(240,165,163,.35)] bg-[rgba(240,165,163,.06)]"} ${className}`}
      title={tt("Expected vendor gold per cast over a bare hook at your current water, minus what the bait costs per cast")} data-testid={testId}>
      {good ? "+" : ""}{fmt(v.net)}g/{tt("cast")}
    </span>
  );
}

export function BaitInfoDialog({ bait: b, value, onClose }) {
  const { user, lookups, data } = useGame();
  if (!b) return null;
  const v = value?.baits?.[b.id];
  const each = b.price ? (user.bait_discount ? Math.max(1, Math.ceil(b.price * (100 - user.bait_discount) / 100)) : b.price) : 0;
  const perCast = b.pack ? Math.round(each / b.pack) : each;
  const unlocksAll = (data?.fish || []).filter((f) => f.bait_only?.includes(b.id));
  const here = !b.waters || b.waters.includes(user.water);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,.6)] p-3" onClick={onClose}>
      <div className="panel panel-gold w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" data-testid="bait-info-dialog">
        <div className="flex items-start gap-3">
          <GearIcon id={b.id} name={b.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[16px] text-[#f4ead2]" data-testid="bait-info-name">{b.name} {b.crafted && <span className="label !text-[9.5px] ml-1">{tt("crafted")}</span>}{b.duel && <span className="label !text-[9.5px] ml-1">{tt("duel marks")}</span>}</div>
            <div className="text-[12px] text-[var(--muted)] italic">{b.desc}</div>
          </div>
          <button className="btn btn-sm !px-1.5" onClick={onClose} aria-label={tt("Close")} data-testid="bait-info-close"><X size={13} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label={tt("Luck")} testId="bait-info-luck">{b.ground ? <span className="text-[#8fd0f0] text-[12px]">{tt("ignored")}</span> : `+${b.luck}`}</Stat>
          <Stat label={tt("Bite")} testId="bait-info-bite">+{b.bite}%</Stat>
          <Stat label={tt("Bigger fish")} testId="bait-info-size"><SizePips n={b.size || 0} /><div className="text-[10.5px] text-[var(--text-2)] mt-0.5">{tt(SIZE_WORDS[b.size || 0])}</div></Stat>
        </div>
        <div className="text-[12px] text-[var(--text-2)] space-y-1.5">
          <div><b className="text-[var(--text)]">{tt("Best at:")}</b> {b.waters ? b.waters.map((w) => lookups.waterByKey[w]?.name).join(", ") : tt("All waters")}{!here && <span className="text-[#f59a5c]"> · {tt("only ⅓ luck at your current water")}</span>}</div>
          {b.ground && <div className="text-[#8fd0f0]">{tt("Groundbait mode: your luck is ignored, common & uncommon fish are twice as likely. Rare and up still bite at base odds.")}</div>}
          {unlocksAll.length > 0 && <div data-testid="bait-info-unlocks"><b className="text-[var(--ok)]">{tt("Only bites on this bait:")}</b> {unlocksAll.map((f) => <span key={f.id} className={`rar-${f.rarity} mr-1.5`}>{f.name} <span className="text-[var(--muted)] text-[10.5px]">({lookups.waterByKey[f.water]?.name})</span></span>)}</div>}
          <div><b className="text-[var(--text)]">{tt("Bigger fish:")}</b> {tt("grade {{v0}}/5, the weight roll leans toward heavy specimens (more \"big\" and \"monstrous\" fights, more record catches).", { v0: b.size || 0 })}
            {(b.size || 0) > 0 && <div className="text-[11.5px] text-[var(--muted)] mt-0.5" data-testid="bait-info-variants">{tt("Variant odds per catch with this bait:")} {VARIANT_ODDS.map(([name, base]) => `${tt(name)} ${pct1(base)}% → ${pct1(base * (1 + 0.15 * b.size))}%`).join(" · ")}</div>}
          </div>
          {b.bite > 0 && <div><b className="text-[var(--text)]">{tt("Bite +{{v0}}%:", { v0: b.bite })}</b> {tt("fewer empty casts, so less energy wasted per fish.")}</div>}
        </div>
        <div className="border-t border-[var(--border)] pt-2 text-[12px] space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[var(--muted)]">{b.price ? (b.pack ? tt("Price per pack of {{v0}}", { v0: b.pack }) : tt("Price each")) : b.crafted ? tt("Crafted, no gold cost") : tt("Not sold in the shop")}</span>
            {b.price ? <span className="whitespace-nowrap"><Gold n={each} />{b.pearls ? <> + <Pearls n={b.pearls} /></> : null}{b.pack ? <span className="text-[var(--muted)] ml-1">(≈{perCast}g/{tt("cast")})</span> : null}</span> : null}
          </div>
          {v && (b.ground ? (
            <div className="text-[#8fd0f0]" data-testid="bait-info-profit">{tt("Worth it? Not in gold. Groundbait trades luck for numbers: twice the everyday fish for contracts, journal gaps and crafting.")}</div>
          ) : (
            <div className="flex items-center justify-between gap-2" data-testid="bait-info-profit">
              <span className="text-[var(--muted)]">{tt("Worth it at {{v0}}? Bare hook ≈ {{v1}}g/cast at the vendor; this bait adds ≈ +{{v2}}g of fish per cast", { v0: value.water_name, v1: value.base, v2: v.gain })}{!v.here && <span className="text-[#f59a5c]"> ({tt("off-water, ⅓ luck")})</span>}</span>
              <ProfitChip v={v} testId="bait-info-profit-chip" />
            </div>
          ))}
          <div className="text-[11px] text-[var(--muted)]">{tt("Estimates use vendor prices; market sales, reel tier and species mastery pay more. Legendaries, trophies and bait-only species are on top.")}</div>
          <div className="text-[11.5px] num text-[var(--text-2)]">{tt("You own")} ×{user.bait[b.id] || 0}{b.crafted && <> · <Link to="/game/crafting" className="underline">{tt("Bait Crafting")}</Link></>}</div>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, children, testId }) => (
  <div className="rounded border border-[var(--border)] bg-[rgba(0,0,0,.2)] py-1.5 px-1" data-testid={testId}>
    <div className="label !text-[9.5px] mb-0.5">{label}</div>
    <div className="num text-[14px] text-[#f4ead2]">{children}</div>
  </div>
);
