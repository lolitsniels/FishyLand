/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PixelIcon } from "./PixelIcon";
import { api, wt, wtRange } from "../lib/api";
import { FishPlate } from "./FishPlate";
import { Rarity, Empty } from "./ui-bits";
import { t as tt } from "../i18n";

const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch { return "-"; } };
const VARIANT_LABEL = { normal: "Normal", scarred: "Scarred", giant: "Giant", albino: "Albino", golden: "Golden" };

export function SpeciesModal({ speciesId, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let m = true;
    setD(null); setErr(false);
    api.get(`/species/${speciesId}`).then((r) => m && setD(r.data)).catch(() => m && setErr(true));
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { m = false; window.removeEventListener("keydown", onKey); };
  }, [speciesId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,.72)] p-3 fade-in" onClick={onClose} data-testid="species-modal">
      <div className="panel panel-gold w-[720px] max-w-full" style={{ maxHeight: "calc(92vh / var(--zoom, 1))", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <header className="panel-head flex items-center justify-between">
          <span>{d ? d.name : tt("Species record")}</span>
          <button className="text-[var(--text-2)] hover:text-[var(--gold)]" onClick={onClose} data-testid="species-modal-close" aria-label={tt("Close")}><X size={16} /></button>
        </header>
        <div className="panel-body space-y-3">
          {err && <Empty>{tt("Could not load this species.")}</Empty>}
          {!d && !err && <div className="text-[var(--muted)] text-sm italic py-6 text-center">{tt("Consulting the journal…")}</div>}
          {d && (
            <>
              {/* Top: art + header */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                <FishPlate speciesId={d.id} name={d.name} className="w-full sm:w-[240px] h-[170px] shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-display text-[20px] leading-none rar-${d.rarity}`}>{d.name}</h3>
                    <Rarity r={d.rarity} tag />
                    {d.baitable && <span className="tag" title={tt("Small enough to use as live bait")}>{tt("baitable")}</span>}
                  </div>
                  <div className="text-[12px] text-[var(--text-2)] italic">"{d.blurb}"</div>
                  {d.bait_only?.length > 0 && <div className="text-[12px] text-[var(--ok)]" data-testid="species-bait-only">{tt("Fussy eater, takes only")} {d.bait_only.join(", ")}.</div>}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <div><div className="label">{tt("Range")}</div><div className="num text-[13px] whitespace-nowrap">{wtRange(d.min_kg, d.max_kg)}</div><div className="text-[10.5px] text-[var(--muted)] leading-tight" title={tt("Mastery Lv 5 adds +5% and Lv 10 +10% to the weight roll")} data-testid="species-mastery-max">{tt("up to")} {wt(d.max_kg * 1.1)} {tt("with mastery")}</div></div>
                    <div><div className="label">{tt("Landed")}</div><div className="num text-[13px]" data-testid="species-total-catches">{d.total_catches}</div></div>
                    <div><div className="label">{tt("Value ×")}</div><div className="num text-[13px]">×{d.value_mod.toFixed(2)}</div></div>
                  </div>
                </div>
              </div>

              {/* Habitat */}
              <section className="panel !border-[var(--border)]">
                <header className="panel-head has-icon"><PixelIcon name="waters" className="panel-head-icon" /><span>{tt("Habitat")}</span></header>
                <div className="panel-body space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div><span className="font-medium">{d.water.name}</span> · <span className="text-[var(--text-2)]">{d.water.type}</span></div>
                    <div className="text-[11.5px] text-[var(--muted)]">{tt("Level")} {d.water.level}+ · {d.water.salt ? tt("saltwater") : tt("freshwater")}</div>
                  </div>
                  <div className="text-[12px] text-[var(--text-2)] italic">{d.water.desc}</div>
                  {d.baits.length > 0 && (
                    <div className="pt-1"><span className="label">{tt("Best baits here:")} </span>
                      <span className="text-[12px]">
                        {d.baits.map((b, i) => (<span key={b.id}>{i > 0 && <span className="text-[var(--muted)]"> · </span>}<span className={b.crafted ? "text-[var(--gold)]" : ""}>{b.name}</span> <span className="text-[var(--muted)]">+{b.luck}</span></span>))}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Behaviour */}
              <section className="panel !border-[var(--border)]">
                <header className="panel-head has-icon"><PixelIcon name="fish" className="panel-head-icon" /><span>{tt("Behaviour")}</span></header>
                <div className="panel-body space-y-1">
                  <div><span className="uppercase text-[11px] tracking-wider text-[var(--gold)]">{d.behavior.key}</span>: <span className="text-[13px]">{d.behavior.desc}</span></div>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div><div className="label">{tt("Fight strength")}</div><div className="num text-[13px]">×{d.behavior.strength.toFixed(2)}</div></div>
                    <div><div className="label">{tt("Unpredictability")}</div><div className="num text-[13px]">×{d.behavior.erratic.toFixed(2)}</div></div>
                  </div>
                </div>
              </section>

              {/* Records + You */}
              <div className="grid md:grid-cols-2 gap-2">
                <section className="panel !border-[var(--border)]">
                  <header className="panel-head has-icon"><PixelIcon name="rankings" className="panel-head-icon" /><span>{tt("Record holders")}</span></header>
                  <div className="panel-body">
                    {d.records.length === 0 ? <Empty>{tt("No one has landed this species yet.")}</Empty> : (
                      <ol className="space-y-1" data-testid="species-records">
                        {d.records.map((r, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="flex items-center gap-1.5 min-w-0"><span className={`num w-4 ${i === 0 ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{i + 1}.</span><span className="truncate">{r.username}</span>{r.variant !== "normal" && <span className="tag tag-variant">{VARIANT_LABEL[r.variant] || r.variant}</span>}</span>
                            <span className="num shrink-0">{wt(r.weight)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </section>

                <section className="panel !border-[var(--border)]">
                  <header className="panel-head has-icon"><PixelIcon name="achievements" className="panel-head-icon" /><span>{tt("Your best")}</span></header>
                  <div className="panel-body">
                    {!d.you ? <Empty>{tt("Not yet in your journal.")}</Empty> : (
                      <div className="space-y-1 text-[13px]" data-testid="species-you">
                        <div className="flex items-center justify-between"><span className="label">{tt("Personal best")}</span><span className="num">{wt(d.you.best_kg)}</span></div>
                        <div className="flex items-center justify-between"><span className="label">{tt("Landed")}</span><span className="num">×{d.you.count}</span></div>
                        <div className="flex items-center justify-between"><span className="label">{tt("First caught")}</span><span className="num">{fmtDate(d.you.first_at)}</span></div>
                        {d.you.best_at && <div className="flex items-center justify-between"><span className="label">{tt("PB on")}</span><span className="num">{fmtDate(d.you.best_at)}</span></div>}
                        {d.you.variants.length > 0 && (
                          <div className="pt-1"><div className="label mb-0.5">{tt("Variants unlocked")}</div><div className="flex flex-wrap gap-1">{d.you.variants.map((v) => <span key={v} className={`tag ${v === "normal" ? "" : "tag-variant"}`}>{VARIANT_LABEL[v] || v}</span>)}</div></div>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
