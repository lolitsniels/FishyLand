/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useMemo, useState } from "react";
import { api, wt, wtRange, RARITIES } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Rarity, Bar } from "../../components/ui-bits";
import { FishPlate } from "../../components/FishPlate";
import { SpeciesModal } from "../../components/SpeciesModal";
import { BossJournal } from "../../components/Boss";
import { t as tt } from "../../i18n";
import { LeviathanJournal } from "../../components/CrewBoss";
import { GameTabs } from "../../components/GameUI";

export function MasteryBar({ m, count, testId }) {
  const max = m.level >= 10;
  const pct = max ? 100 : Math.round((count / m.next) * 100);
  const title = max ? `Mastered · ${m.perks.join(" · ")}` : `Mastery ${m.level}/10 · ${count}/${m.next} caught${m.perks.length ? ` · ${m.perks.join(" · ")}` : ""}`;
  return (
    <div className="mt-1 flex items-center gap-1.5" title={title} data-testid={testId}>
      <span className={`text-[10px] uppercase tracking-wider ${max ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{max ? tt("Mastered") : `Mastery ${m.level}`}</span>
      <div className="flex-1 h-[5px] bg-[#121110] border border-[#2c2724] max-w-[140px]"><div className={`h-full ${max ? "bg-[var(--gold)]" : "bg-[#5aa0c8]"}`} style={{ width: `${pct}%` }} /></div>
      {!max && <span className="num text-[10px] text-[var(--muted)]">{count}/{m.next}</span>}
    </div>
  );
}

export default function Journal() {
  const { data, user, lookups } = useGame();
  const [journal, setJournal] = useState({});
  const [water, setWater] = useState(user.water);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState(() => { const t = new URLSearchParams(window.location.search).get("tab"); return ["bosses", "leviathans"].includes(t) ? t : "species"; });
  useEffect(() => { api.get("/journal").then((r) => setJournal(r.data)).catch(() => {}); }, []);

  const regular = useMemo(() => data?.fish.filter((f) => !f.secret) || [], [data]);
  const total = regular.length;
  const found = regular.filter((f) => journal[f.id]).length;
  const secretsFound = data?.fish.filter((f) => f.secret && journal[f.id]).length || 0;
  const list = useMemo(() => {
    if (!data) return [];
    return data.fish.filter((f) => (!f.secret || journal[f.id]) && (water === "all" || q || f.water === water) && (filter === "all" || f.rarity === filter) && (!q || f.name.toLowerCase().includes(q.toLowerCase())));  // a search looks across every water
  }, [data, journal, water, filter, q]);
  const byRarity = (r) => ({ have: regular.filter((f) => f.rarity === r && journal[f.id]).length, all: regular.filter((f) => f.rarity === r).length });

  return (
    <div className="space-y-3 fade-in" data-testid="journal-page">
      <GameTabs testid="journal-tab" value={tab} onChange={setTab} tabs={[["species", "Species", "fishdex"], ["leviathans", "Crew Bosses", "crew"], ["bosses", "Bosses", "guild"]]} />
      {tab === "leviathans" ? <LeviathanJournal /> : tab === "bosses" ? <BossJournal /> : <>
      <div className="g-hero p-4 flex flex-col justify-end" style={{ backgroundImage: `url(/art/waters/${water === "all" ? user.water : water === "crew_pond" ? "millbrook" : water}.jpg)` }} data-testid="journal-hero">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label !text-[#cff6ff]">{water === "all" ? tt("All waters") : (water === "crew_pond" ? "Crew Pond" : data?.waters.find((w) => w.key === water)?.name)}</div>
            <div className="font-deco gold-text text-2xl" data-testid="journal-progress">{found} / {total} <span className="text-base">{tt("discovered")}</span>{secretsFound > 0 && <span className="text-[#c9a7f0] text-sm" data-testid="journal-secrets-found"> + {secretsFound} secret</span>}</div>
            {(() => { const w = water === "all" ? user.water : water, here = regular.filter((f) => f.water === w), left = here.filter((f) => !journal[f.id]).length, nm = w === "crew_pond" ? "the Crew Pond" : data?.waters.find((x) => x.key === w)?.name;
              return here.length > 0 && <div className="text-[13px] font-bold text-[#9fe0ff] mt-0.5" data-testid="journal-left-here">{left ? `${left} of ${here.length} fish still hiding in ${nm}. Go find them!` : `You found every fish in ${nm}!`}</div>; })()}
          </div>
          <div className="flex gap-2 flex-wrap">
            {RARITIES.map((r) => { const s = byRarity(r); return <div key={r} className={`g-stat rc-${r} !py-1 text-center min-w-[62px]`} style={{ borderColor: "var(--rc)" }}><div className={`num rar-${r} text-[15px]`}>{s.have}<span className="text-[var(--muted)] text-[11px]">/{s.all}</span></div><div className="k !text-[8.5px]">{r}</div></div>; })}
          </div>
        </div>
        <Bar value={found} max={total} color="linear-gradient(90deg,#f6c445,#fff3b0)" className="!h-2.5 mt-3" />
      </div>
      <div className="g-chips" data-testid="journal-water-filter">
        <button type="button" className={`g-chip !bg-[#2a190c] ${water === "all" ? "on" : ""}`} onClick={() => setWater("all")} data-testid="journal-water-all"><span className="!static !bg-none h-full grid place-items-center">{tt("All waters")}</span></button>
        {data?.waters.map((w) => { const open = user.unlocked_waters.includes(w.key); return (
          <button key={w.key} type="button" disabled={!open} className={`g-chip ${water === w.key ? "on" : ""} ${open ? "" : "locked"}`} style={{ backgroundImage: `url(/art/waters/${w.key}_thumb.jpg)` }} onClick={() => setWater(w.key)} title={open ? w.name : `${w.name} (locked)`} data-testid={`journal-water-${w.key}`}><span>{w.name}</span></button>
        ); })}
        <button type="button" className={`g-chip ${water === "crew_pond" ? "on" : ""}`} style={{ backgroundImage: "url(/art/waters/millbrook_thumb.jpg)" }} onClick={() => setWater("crew_pond")} title="Crew Pond" data-testid="journal-water-crew_pond"><span>Crew Pond</span></button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="journal-rarity-filter">
          <option value="all">{tt("All rarities")}</option>
          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="input !w-48" placeholder={tt("Search species...")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="journal-search" />
        <span className="text-[12px] text-[var(--muted)] ml-auto">{list.length} {tt("entries")}{q && water !== "all" ? tt(" · all waters") : ""}</span>
      </div>
      <div className="g-grid-sm" data-testid="journal-grid">
        {list.map((f) => {
          const j = journal[f.id];
          return (
            <div key={f.id} className={`g-card rc-${j ? f.rarity : "common"} !p-2 !gap-1 ${j ? "cursor-pointer" : "opacity-80 !border-dashed"}`}
                 onClick={j ? () => setOpenId(f.id) : undefined} role={j ? "button" : undefined} tabIndex={j ? 0 : undefined}
                 onKeyDown={j ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(f.id); } } : undefined}
                 data-testid={`journal-entry-${f.id}`}>
              {j && f.secret && <span className="badge !text-[#c9a7f0] !border-[#6b4f9a]" data-testid={`journal-secret-${f.id}`}>{tt("secret")}</span>}
              {j && <span className="tier !text-[9px]">×{j.count}</span>}
              <div className="art !h-[70px]"><FishPlate speciesId={f.id} name={f.name} silhouette={!j} className="w-full h-[64px] !border-0 !bg-transparent" /></div>
              <div className={`name !text-[12px] truncate ${j ? `rar-${f.rarity}` : "!text-[var(--muted)]"}`}>{j ? f.name : "???"}</div>
              <Rarity r={f.rarity} tag className={`self-start !text-[9px] ${j ? "" : "opacity-50"}`} />
              {j ? (
                <div className="text-[10.5px] text-[var(--text-2)]">
                  <div className="num">{tt("best")} {wt(j.best_kg)}{j.variants.filter((v) => v !== "normal").length > 0 && <span className="tag tag-variant ml-1 !text-[9px]">{j.variants.filter((v) => v !== "normal").join(", ")}</span>}</div>
                  {j.mastery && <MasteryBar m={j.mastery} count={j.count} testId={`mastery-${f.id}`} />}
                  {f.bait_only && <div className="mt-0.5 text-[var(--ok)] truncate" title={f.bait_only.map((b) => lookups?.baitById[b]?.name || b).join(", ")} data-testid={`journal-bait-${f.id}`}>{tt("Takes only:")} {f.bait_only.map((b) => lookups?.baitById[b]?.name || b).join(", ")}</div>}
                </div>
              ) : (
                <div className="text-[10.5px] text-[var(--muted)] truncate">{f.behavior} · {wtRange(f.min_kg, f.max_kg)}</div>
              )}
            </div>
          );
        })}
      </div>
      {openId != null && <SpeciesModal speciesId={openId} onClose={() => setOpenId(null)} />}
      </>}
    </div>
  );
}
