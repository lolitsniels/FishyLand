/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X } from "lucide-react";
import { api } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Empty } from "../../components/ui-bits";
import * as S from "./wikiSections";
import { t as tt } from "../../i18n";
import { PixelIcon } from "../../components/PixelIcon";

const TOC = [
  ["guide", "New player guide"], ["basics", "Getting started"], ["fishing", "Casting & the fight"], ["conditions", "Time, weather & tides"], ["waters", "Waters"], ["fish", "Fish & rarity"], ["mastery", "Fish mastery"],
  ["tackle", "Tackle"], ["crates", "Crates"], ["enhance", "Salvage & enhancement"], ["bait", "Bait & crafting"], ["economy", "Economy & market"], ["levels", "Levels & titles"], ["quests", "Quests & streaks"],
  ["harbour", "Harbour: daily spin & dockside"], ["contracts", "Contract Board & favour"], ["events", "Expeditions & alerts"], ["bosses", "Legendary bosses"], ["secrets", "Secret catches"], ["crews", "Crews & crew hall"], ["duel", "Fishing duels & Duel Ladder"],
  ["social", "Friends & chat"], ["contests", "Tournaments"], ["achievements", "Achievements"], ["pearls", "Pearls & portraits"], ["recruit", "Recruit an Angler"], ["vote", "Vote for the game"],
];

export default function Wiki() {
  const { data } = useGame();
  const [w, setW] = useState(null);
  useEffect(() => { api.get("/wiki").then((r) => setW(r.data)).catch(() => {}); }, []);
  if (!w || !data) return <Empty>{tt("Opening the wiki...")}</Empty>;
  return <WikiView w={w} data={data} />;
}

export const WikiFooterLinks = () => (
  <div className="text-[11.5px] text-[var(--muted)] px-1 pt-1 flex flex-wrap gap-x-3 gap-y-1" data-testid="wiki-legal-links">
    <Link to="/about" className="hover:text-[var(--gold)]">About</Link><Link to="/contact" className="hover:text-[var(--gold)]">Contact</Link>
    <Link to="/privacy" className="hover:text-[var(--gold)]">Privacy Policy</Link><Link to="/terms" className="hover:text-[var(--gold)]">Terms of Service</Link>
  </div>
);

export function WikiView({ w, data }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const body = useRef(null);
  // Keyword search: hide sections without a match, count matches, highlight via the CSS Custom Highlight API where available.
  useEffect(() => {
    if (!body.current) return;
    const term = q.trim().toLowerCase();
    const secs = Array.from(body.current.querySelectorAll("section[id]"));
    if (!term) { secs.forEach((el) => { el.style.display = ""; }); setHits(null); window.CSS?.highlights?.delete("wiki-hit"); return; }
    let total = 0; const ranges = [];
    secs.forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n, found = 0;
      while ((n = walker.nextNode())) {
        const t = n.textContent.toLowerCase(); let i = t.indexOf(term);
        while (i !== -1) { const r = new Range(); r.setStart(n, i); r.setEnd(n, i + term.length); ranges.push(r); found++; i = t.indexOf(term, i + term.length); }
      }
      el.style.display = found ? "" : "none"; total += found;
    });
    setHits(total);
    if (window.CSS?.highlights && window.Highlight) window.CSS.highlights.set("wiki-hit", new window.Highlight(...ranges));
  }, [q, w, data]);
  useEffect(() => { const id = window.location.hash.slice(1); if (id && w) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 450); }, [w]);
  const visible = (id) => !hits || body.current?.querySelector(`#${id}`)?.style.display !== "none";
  return (
    <div className="grid lg:grid-cols-[200px_1fr] gap-3 items-start" data-testid="wiki-page">
      <aside className="panel lg:sticky lg:top-3" data-testid="wiki-toc">
        <header className="panel-head has-icon"><PixelIcon name="wiki" className="panel-head-icon" /><span>{tt("Wiki")}</span></header>
        <div className="px-2 pt-2">
          <div className="relative">
            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            <input className="input !pl-7 !pr-7" placeholder={tt("Search the wiki...")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tt("Search the wiki")} data-testid="wiki-search-input" />
            {q && <button className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setQ("")} aria-label={tt("Clear search")} data-testid="wiki-search-clear"><X size={13} /></button>}
          </div>
          {hits !== null && <div className="text-[11px] mt-1 px-1 text-[var(--muted)]" data-testid="wiki-search-count">{hits === 0 ? tt("No matches. Try another word.") : `${hits} match${hits === 1 ? "" : "es"} · sections without a match are hidden`}</div>}
        </div>
        <nav className="p-2 flex lg:flex-col flex-wrap gap-x-3 gap-y-0.5 text-[12px]">
          {TOC.map(([id, label], i) => <a key={id} href={`#${id}`} className={`py-0.5 whitespace-nowrap ${visible(id) ? "text-[var(--text-2)] hover:text-[var(--gold)]" : "text-[var(--muted)] opacity-40 line-through"}`} data-testid={`wiki-toc-${id}`}><span className="num text-[var(--muted)] mr-1.5">{i + 1}</span>{tt(label)}</a>)}
        </nav>
        <div className="px-3 pb-3 text-[11px] text-[var(--muted)]">{tt("Numbers on this page are read live from the game rules, so they are always current.")}</div>
      </aside>
      <div className="space-y-3 min-w-0" ref={body}>
        <S.NewPlayerGuide w={w} />
        <S.Basics w={w} />
        <S.FishingRules w={w} data={data} />
        <S.Conditions w={w} />
        <S.WatersSec data={data} />
        <S.FishSec w={w} data={data} />
        <S.MasterySec w={w} />
        <S.Tackle data={data} w={w} />
        <S.CratesSec w={w} />
        {w.enhance && <S.EnhanceSec w={w} data={data} />}
        <S.BaitSec data={data} w={w} />
        <S.Economy w={w} />
        <S.Levels w={w} />
        <S.QuestsSec w={w} />
        <S.HarbourSec w={w} data={data} />
        <S.ContractsSec w={w} />
        <S.Events w={w} />
        <S.BossesSec w={w} data={data} />
        <S.SecretsSec w={w} />
        <S.CrewsSec w={w} />
        {w.duel && <S.DuelSec w={w} />}
        <S.Social w={w} />
        <S.Contests w={w} />
        <S.AchievementsSec w={w} />
        <S.PearlsSec w={w} />
        <S.RecruitSec w={w} />
        <S.VoteSec w={w} />
        <WikiFooterLinks />
      </div>
    </div>
  );
}
