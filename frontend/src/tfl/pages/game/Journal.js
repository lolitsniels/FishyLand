/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { api, wt, wtRange, RARITIES } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { FishPlate } from "../../components/FishPlate";
import { SpeciesModal } from "../../components/SpeciesModal";
import { t as tt } from "../../i18n";

export function MasteryBar({ m, count, testId }) {
  const max = m.level >= 10;
  const pct = max ? 100 : Math.round((count / m.next) * 100);
  return (
    <div className="dex-mastery" title={max ? `Mastered · ${m.perks.join(" · ")}` : `Mastery ${m.level}/10 · ${count}/${m.next} caught`} data-testid={testId}>
      <span>{max ? tt("Mastered") : `M${m.level}`}</span><i><b style={{ width: `${pct}%` }} /></i>
    </div>
  );
}

const PER_PAGE = 9;

function LeftPage({ water, setWater, data, user, journal, regular, filter, setFilter, q, setQ }) {
  const w = water === "all" ? user.water : water;
  const nm = water === "all" ? tt("All waters") : water === "crew_pond" ? "Crew Pond" : data.waters.find((x) => x.key === water)?.name;
  const pool = water === "all" ? regular : regular.filter((f) => f.water === w);
  const found = pool.filter((f) => journal[f.id]).length, left = pool.length - found;
  const secrets = data.fish.filter((f) => f.secret && journal[f.id]).length;
  return (
    <div className="dex-page dex-left" data-testid="journal-hero">
      <div className="dex-kicker">{tt("The Angler's Fishdex")}</div>
      <h2 className="dex-title">{nm}</h2>
      <div className="dex-photo" style={{ backgroundImage: `url(/art/waters/${w === "crew_pond" ? "millbrook" : w}.jpg)` }} />
      <div className="dex-count" data-testid="journal-progress">{found} / {pool.length} <span>{tt("discovered")}</span>{secrets > 0 && <em data-testid="journal-secrets-found"> + {secrets} secret</em>}</div>
      <div className="dex-bar"><i style={{ width: `${pool.length ? (found / pool.length) * 100 : 0}%` }} /></div>
      <p className="dex-note" data-testid="journal-left-here">{pool.length === 0 ? "" : left ? `${left} fish still hiding here. Go find them!` : "You found every fish here!"}</p>
      <div className="dex-rar">
        {RARITIES.map((r) => { const all = pool.filter((f) => f.rarity === r); return all.length ? <span key={r} className={`rar-${r}`}><b>{all.filter((f) => journal[f.id]).length}</b>/{all.length} {r}</span> : null; })}
      </div>
      <div className="dex-tools">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="journal-rarity-filter">
          <option value="all">{tt("All rarities")}</option>
          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="dex-search"><Search size={13} /><input placeholder={tt("Search species...")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="journal-search" /></label>
      </div>
      <select className="dex-water-select" value={water} onChange={(e) => setWater(e.target.value)} data-testid="journal-water-select">
        <option value="all">{tt("All waters")}</option>
        {data.waters.map((x) => <option key={x.key} value={x.key} disabled={!user.unlocked_waters.includes(x.key)}>{x.name}</option>)}
        <option value="crew_pond">Crew Pond</option>
      </select>
    </div>
  );
}

function Entry({ f, j, onOpen, lookups }) {
  return (
    <button type="button" className={`dex-entry ${j ? `got rc-${f.rarity}` : "unknown"}`} disabled={!j} onClick={() => onOpen(f.id)} data-testid={`journal-entry-${f.id}`}>
      {j && <span className="dex-n">×{j.count}</span>}
      {j && f.secret && <span className="dex-secret" data-testid={`journal-secret-${f.id}`}>{tt("secret")}</span>}
      <div className="dex-art"><FishPlate speciesId={f.id} name={f.name} silhouette={!j} className="w-full h-full !border-0 !bg-transparent" /></div>
      <div className={`dex-name ${j ? `rar-${f.rarity}` : ""}`}>{j ? f.name : "???"}</div>
      <div className="dex-sub">{j ? <>{tt("best")} {wt(j.best_kg)}</> : <>{f.rarity} · {wtRange(f.min_kg, f.max_kg)}</>}</div>
      {j?.mastery && <MasteryBar m={j.mastery} count={j.count} testId={`mastery-${f.id}`} />}
      {j && f.bait_only && <div className="dex-bait" data-testid={`journal-bait-${f.id}`}>{tt("Takes only:")} {f.bait_only.map((b) => lookups?.baitById[b]?.name || b).join(", ")}</div>}
    </button>
  );
}

export default function Journal() {
  const { data, user, lookups } = useGame();
  const [journal, setJournal] = useState({});
  const [water, setWater] = useState(user.water);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [flip, setFlip] = useState("");
  const [openId, setOpenId] = useState(null);
  const tabsRef = useRef(null);
  useEffect(() => { api.get("/journal").then((r) => setJournal(r.data)).catch(() => {}); }, []);
  useEffect(() => { setPage(0); }, [water, filter, q]);
  const regular = useMemo(() => data?.fish.filter((f) => !f.secret) || [], [data]);
  const list = useMemo(() => (data ? data.fish.filter((f) => (!f.secret || journal[f.id]) && (water === "all" || q || f.water === water) && (filter === "all" || f.rarity === filter) && (!q || (journal[f.id] && f.name.toLowerCase().includes(q.toLowerCase())))) : []), [data, journal, water, filter, q]);
  if (!data) return null;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const turn = (d) => { setFlip(d > 0 ? "next" : "prev"); setPage((p) => Math.max(0, Math.min(pages - 1, p + d))); };
  const shown = list.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  return (
    <div className="dex fade-in" data-testid="journal-page">
      <div className="dex-tabs-wrap">
      <button type="button" className="dex-scroll" onClick={() => tabsRef.current?.scrollBy({ left: -260, behavior: "smooth" })} aria-label="Scroll left" data-testid="journal-tabs-left"><ChevronLeft size={15} /></button>
      <div className="dex-tabs" ref={tabsRef} onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY; }} data-testid="journal-water-filter">
        <button type="button" className={water === "all" ? "on" : ""} onClick={() => setWater("all")} data-testid="journal-water-all">{tt("All")}</button>
        {data.waters.map((w) => { const open = user.unlocked_waters.includes(w.key); return (
          <button key={w.key} type="button" disabled={!open} className={`${water === w.key ? "on" : ""} ${open ? "" : "locked"}`} onClick={() => setWater(w.key)} title={open ? w.name : `${w.name} (locked)`} data-testid={`journal-water-${w.key}`}>
            <img src={`/art/waters/${w.key}_thumb.jpg`} alt="" /><span>{w.name}</span>
          </button>
        ); })}
        <button type="button" className={water === "crew_pond" ? "on" : ""} onClick={() => setWater("crew_pond")} data-testid="journal-water-crew_pond"><img src="/art/waters/millbrook_thumb.jpg" alt="" /><span>Crew Pond</span></button>
      </div>
      <button type="button" className="dex-scroll" onClick={() => tabsRef.current?.scrollBy({ left: 260, behavior: "smooth" })} aria-label="Scroll right" data-testid="journal-tabs-right"><ChevronRight size={15} /></button>
      </div>
      <div className="dex-book">
        <LeftPage {...{ water, setWater, data, user, journal, regular, filter, setFilter, q, setQ }} />
        <div className={`dex-page dex-right ${flip ? `flip-${flip}` : ""}`} key={`${water}-${page}`} onAnimationEnd={() => setFlip("")}>
          <div className="dex-grid" data-testid="journal-grid">
            {shown.map((f) => <Entry key={f.id} f={f} j={journal[f.id]} onOpen={setOpenId} lookups={lookups} />)}
            {shown.length === 0 && <p className="dex-note">{tt("No fish match.")}</p>}
          </div>
          <div className="dex-foot">
            <button type="button" disabled={page === 0} onClick={() => turn(-1)} data-testid="journal-page-prev"><ChevronLeft size={16} /></button>
            <span data-testid="journal-page-label">{tt("Page")} {page + 1} / {pages} · {list.length} {tt("entries")}</span>
            <button type="button" disabled={page >= pages - 1} onClick={() => turn(1)} data-testid="journal-page-next"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
      {openId != null && <SpeciesModal speciesId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
