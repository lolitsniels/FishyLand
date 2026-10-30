/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
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
      <div className="flex gap-1" data-testid="journal-tabs">
        <button className={`btn btn-sm ${tab === "species" ? "btn-gold" : ""}`} onClick={() => setTab("species")} data-testid="journal-tab-species">{tt("Species")}</button>
        <button className={`btn btn-sm ${tab === "leviathans" ? "btn-gold" : ""}`} onClick={() => setTab("leviathans")} data-testid="journal-tab-leviathans">{tt("Crew Bosses")}</button>
        <button className={`btn btn-sm ${tab === "bosses" ? "btn-gold" : ""}`} onClick={() => setTab("bosses")} data-testid="journal-tab-bosses">{tt("☠ Bosses")}</button>
      </div>
      {tab === "leviathans" ? <LeviathanJournal /> : tab === "bosses" ? <BossJournal /> : <>
      <Panel icon="journal" title={tt("Fish journal")} right={<span className="num" data-testid="journal-progress">{found} / {total} {tt("discovered")}{secretsFound > 0 && <span className="text-[#c9a7f0]" data-testid="journal-secrets-found"> + {secretsFound} secret</span>}</span>}>
        <Bar value={found} max={total} color="var(--gold)" className="!h-2" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3 text-center">
          {RARITIES.map((r) => { const s = byRarity(r); return <div key={r}><div className={`num rar-${r}`}>{s.have}<span className="text-[var(--muted)]">/{s.all}</span></div><div className="label !text-[9.5px]">{r}</div></div>; })}
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input !w-auto" value={water} onChange={(e) => setWater(e.target.value)} data-testid="journal-water-filter">
          <option value="all">{tt("All waters")}</option>
          {data?.waters.map((w) => <option key={w.key} value={w.key} disabled={!user.unlocked_waters.includes(w.key)}>{w.name}{!user.unlocked_waters.includes(w.key) ? tt(" (locked)") : ""}</option>)}
        </select>
        <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="journal-rarity-filter">
          <option value="all">{tt("All rarities")}</option>
          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input className="input !w-48" placeholder={tt("Search species...")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="journal-search" />
        <span className="text-[12px] text-[var(--muted)] ml-auto">{list.length} {tt("entries")}{q && water !== "all" ? tt(" · all waters") : ""}</span>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-1.5" data-testid="journal-grid">
        {list.map((f) => {
          const j = journal[f.id];
          return (
            <div key={f.id}
                 className={`journal-cell flex gap-2 ${j ? "discovered cursor-pointer hover:border-[var(--gold)]" : "undiscovered"}`}
                 onClick={j ? () => setOpenId(f.id) : undefined}
                 role={j ? "button" : undefined}
                 tabIndex={j ? 0 : undefined}
                 onKeyDown={j ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(f.id); } } : undefined}
                 data-testid={`journal-entry-${f.id}`}>
              <FishPlate speciesId={f.id} name={f.name} silhouette={!j} className="w-[84px] h-[60px] shrink-0" />
              <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium truncate ${j ? `rar-${f.rarity}` : ""}`}>{j ? f.name : "???"}</span>
                <span className="inline-flex items-center gap-1 shrink-0">{j && f.secret && <span className="tag text-[#c9a7f0] border-[#6b4f9a]" title={tt("Secret catch: only bites during its own quiet hours")} data-testid={`journal-secret-${f.id}`}>{tt("secret")}</span>}<Rarity r={f.rarity} tag className={j ? "" : "opacity-50"} /></span>
              </div>
              {j ? (
                <div className="text-[11.5px] text-[var(--text-2)] mt-0.5">
                  <span className="italic">{f.blurb}</span>
                  <div className="num mt-0.5">{tt("best")} {wt(j.best_kg)} {tt("· caught ×")}{j.count}{j.variants.filter((v) => v !== "normal").length > 0 && <span className="tag tag-variant ml-1">{j.variants.filter((v) => v !== "normal").join(", ")}</span>}</div>
                  {j.mastery && <MasteryBar m={j.mastery} count={j.count} testId={`mastery-${f.id}`} />}
                  {f.bait_only && <div className="mt-0.5 text-[var(--ok)]" title={tt("This species only takes these baits")} data-testid={`journal-bait-${f.id}`}>{tt("Takes only:")} {f.bait_only.map((b) => lookups?.baitById[b]?.name || b).join(", ")}</div>}
                </div>
              ) : (
                <div className="text-[11.5px] mt-0.5">{data.waters.find((w) => w.key === f.water)?.name} · {f.behavior} · {wtRange(f.min_kg, f.max_kg)}</div>
              )}
              </div>
            </div>
          );
        })}
      </div>
      {openId != null && <SpeciesModal speciesId={openId} onClose={() => setOpenId(null)} />}
      </>}
    </div>
  );
}
