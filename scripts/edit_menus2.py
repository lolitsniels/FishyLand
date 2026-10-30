import sys
sys.path.insert(0, "/app/scripts")
from edlib import edit, cut

edit("pages/game/Inventory.js", [('import { Fragment, useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";')])

J = "pages/game/Journal.js"
edit(J, [('import { LeviathanJournal } from "../../components/CrewBoss";', 'import { LeviathanJournal } from "../../components/CrewBoss";\nimport { GameTabs } from "../../components/GameUI";')])
cut(J, '      <div className="flex gap-1" data-testid="journal-tabs">', '      {tab === "leviathans" ?', '''      <GameTabs testid="journal-tab" value={tab} onChange={setTab} tabs={[["species", "Species", "fishdex"], ["leviathans", "Crew Bosses", "crew"], ["bosses", "Bosses", "guild"]]} />
''')
cut(J, '      <Panel icon="journal" title={tt("Fish journal")}', '      {openId != null && <SpeciesModal', '''      <div className="g-hero p-4 flex flex-col justify-end" style={{ backgroundImage: `url(/art/waters/${water === "all" ? user.water : water}.jpg)` }} data-testid="journal-hero">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label !text-[#cff6ff]">{water === "all" ? tt("All waters") : data?.waters.find((w) => w.key === water)?.name}</div>
            <div className="font-deco gold-text text-2xl" data-testid="journal-progress">{found} / {total} <span className="text-base">{tt("discovered")}</span>{secretsFound > 0 && <span className="text-[#c9a7f0] text-sm" data-testid="journal-secrets-found"> + {secretsFound} secret</span>}</div>
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
''')
print("journal ok")

W = "pages/game/Waters.js"
cut(W, '            <section key={w.key} className={`panel overflow-hidden ${here ? "panel-gold" : ""}`} data-testid={`water-card-${w.key}`}>', '              <div className="p-3">', '''            <section key={w.key} className={`panel g-map-card overflow-hidden ${here ? "panel-gold" : ""}`} data-testid={`water-card-${w.key}`}>
              <div className="relative overflow-hidden">
              <div className="art" style={{ backgroundImage: `url(/art/waters/${w.key}_thumb.jpg)`, filter: unlocked ? "none" : "grayscale(.75) brightness(.55)" }} />
                {!unlocked && <div className="absolute inset-0 grid place-items-center z-[1]"><div className="g-stat flex items-center gap-1.5 !bg-black/70 font-cinzel font-bold text-[#ffe9a3]"><Lock size={14} /> {tt("Lv")} {w.level}</div></div>}
                {here && <div className="absolute top-2 left-2 z-[2] fr-chip px-2 text-[10.5px] font-cinzel font-bold text-[#ffe9a3]">{tt("You are here")}</div>}
                {ev?.active?.water === w.key && <div className="absolute bottom-12 left-2 z-[2] text-[10.5px] uppercase tracking-widest bg-[rgba(10,9,8,.85)] text-[var(--energy)] px-2 py-0.5 rounded-full border border-[var(--energy)]" data-testid={`expedition-badge-${w.key}`}>{tt("Expedition active")}</div>}
                <div className="absolute top-2 right-2 z-[2]"><WaterMood w={w} /></div>
                <CageSlot water={w} here={here} unlocked={unlocked} st={cages} onChange={reloadCages} />
                {progress?.[w.key]?.complete && <div className="absolute top-9 right-2 z-[2] fr-chip px-2 text-[10.5px] font-cinzel text-[var(--gold)]" data-testid={`water-complete-${w.key}`}>{tt("Complete")}</div>}
                <div className="title"><div className="font-deco gold-text text-[17px] leading-tight">{w.name}</div><div className="text-[11px] text-[#cff6ff] font-cinzel">{w.type}</div></div>
              </div>
''')
edit(W, [
    ('''                <div className="flex items-baseline justify-between">
                  <div className="font-display text-[16px] text-[#f4ead2]">{w.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">{w.type}</div>
                </div>
                <p className="text-[12.5px] text-[var(--text-2)] mt-1">{w.desc}</p>''', '''                <p className="text-[12.5px] text-[var(--text-2)]">{w.desc}</p>'''),
    ('<div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10.5px] bg-[rgba(10,9,8,.85)] px-2 py-0.5 border"', '<div className="flex items-center gap-1.5 text-[10.5px] bg-[rgba(10,9,8,.85)] px-2 py-0.5 border rounded-full"'),
])
print("waters ok")

P = "pages/game/Profile.js"
cut(P, '      <div className="water-hero !min-h-[170px] !h-auto" style={{ backgroundImage: `url(${water?.image})` }}>', '        <div className="absolute inset-x-0 bottom-0 p-3', '''      <div className="g-hero !min-h-[210px] flex flex-col justify-end" style={{ backgroundImage: `url(/art/waters/${p.water}.jpg)` }} data-testid="profile-hero">
''')
edit(P, [
    ('        <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col md:flex-row md:items-end md:justify-between gap-3">', '        <div className="p-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">'),
    ('''              <Avatar id={p.avatar} name={p.avatar_name} size="lg" gold frame={p.frame} testId="profile-avatar" />''', '''              <div className="g-portrait" data-testid="profile-avatar"><img src="/art/angler.png" alt={p.username} /></div>
              <span className="absolute -top-1 -left-1 fr-chip px-2 text-[11px] font-cinzel font-black text-amber-200" data-testid="profile-level-badge">Lv.{p.level}</span>'''),
    ('className="font-display text-xl md:text-2xl text-[#f4ead2] truncate flex items-center gap-2"', 'className="font-deco gold-text text-2xl md:text-3xl truncate flex items-center gap-2"'),
    ('''          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <Stat label''', '''          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 profile-stats">
            <Stat label'''),
])
print("profile ok")
