import sys
sys.path.insert(0, "/app/scripts")
from edlib import edit, cut

I = "pages/game/Inventory.js"
edit(I, [
    ('import { LinkChatBtn } from "../../components/ChatItem";', 'import { LinkChatBtn } from "../../components/ChatItem";\nimport { GameTabs, Slot, tierRarity } from "../../components/GameUI";'),
    ('const INV_TABS = [["fish", "Keepnet", Fish], ["bait", "Bait box", Package], ["tackle", "Tackle box", Wrench], ["ingredients", "Ingredients", FlaskConical], ["other", "Crates & more", Recycle]];',
     'const INV_TABS = [["fish", "Keepnet", "gear/bait_live.webp"], ["bait", "Bait box", "gear/bait_worm.webp"], ["tackle", "Tackle box", "inventory"], ["ingredients", "Ingredients", "gear/craft_salted.webp"], ["other", "Crates & more", "pass"]];'),
    ('import { Recycle, Fish, Package, Wrench, FlaskConical, Info } from "lucide-react";', 'import { Recycle, Info } from "lucide-react";'),
])

# Loadout bar + game tabs
cut(I, '      <div className="panel">\n        <div className="flex flex-wrap gap-1 px-3 pt-2 border-b border-[var(--border)]" data-testid="inventory-tabs">', '      {tab === "fish" && (', '''      <Loadout user={user} lookups={lookups} onInfo={setRodInfo} onBait={() => setTab("bait")} />
      <GameTabs testid="inventory-tab" value={tab} onChange={setTab} tabs={INV_TABS.map(([id, label, img]) => [id, label, img, fmt((id === "fish" ? (inv?.total ?? inv?.fish.length) : id === "bait" ? baitRows.reduce((a, [, n]) => a + n, 0) : id === "tackle" ? user.owned_gear.length : id === "ingredients" ? ingRows.reduce((a, [, n]) => a + n, 0) : null) ?? "") || null])} />
''')

# keepnet table -> tiles
cut(I, '            <table className="table" data-testid="inventory-table">', '          {pages > 1 && <Pager', '''            <div className="g-grid-sm" data-testid="inventory-table">
              {pageFish.map((f) => (
                <div key={f.id} className={`g-card rc-${f.rarity} !p-2 !gap-1 cursor-pointer ${sel.has(f.id) ? "sel" : ""}`} onClick={() => toggle(f.id)} data-testid={`inv-row-${f.id}`}>
                  <input type="checkbox" className="absolute top-2 left-2 z-[1]" checked={sel.has(f.id)} onChange={() => toggle(f.id)} onClick={(e) => e.stopPropagation()} data-testid={`inv-check-${f.id}`} />
                  {f.variant !== "normal" && <span className="badge !text-[#f0a35b] !border-[#f0a35b]">{f.variant}</span>}
                  <div className="art !h-[64px]"><FishPlate speciesId={f.species_id} name={f.name} className="w-full h-[60px] !border-0 !bg-transparent" /></div>
                  <div className={`name !text-[12px] truncate rar-${f.rarity}`}>{f.name}</div>
                  <div className="text-[10.5px] text-[var(--text-2)] truncate">{lookups?.waterByKey[f.water]?.name}</div>
                  <div className="flex items-center justify-between text-[11px] num"><span>{wt(f.weight)}</span><FishWorth f={f} /></div>
                  {(lookups?.fishById[f.species_id]?.baitable || wantedFor(wanted, f)) && <div className="flex flex-wrap gap-1">{lookups?.fishById[f.species_id]?.baitable && <span className="text-[9.5px] text-[#8fd0f0]">{tt("crafting/bait")}</span>}{wantedFor(wanted, f) && <WantedTag c={wantedFor(wanted, f)} />}</div>}
                  <div className="flex gap-1 justify-center mt-0.5" onClick={(e) => e.stopPropagation()}>
                    {!isHallow(f.species_id) && <button className="btn btn-sm !px-2" onClick={() => setListing(f)} data-testid={`list-fish-${f.id}`}>{tt("List")}</button>}
                    <button className="btn btn-sm !px-2" title={tt("Mount on trophy wall")} disabled={inv.mounted >= inv.max_trophies} onClick={() => mount(f)} data-testid={`mount-fish-${f.id}`}>{tt("Mount")}</button>
                    <LinkChatBtn item={{ kind: "fish", ref: f.id }} label={`${f.name} ${wt(f.weight)}`} testId={`link-chat-fish-${f.id}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
''')

# loadout component
edit(I, [('const PAGE_SIZE = 50;', '''const PAGE_SIZE = 50;

function Loadout({ user, lookups, onInfo, onBait }) {
  const slots = ["rod", "reel", "line"].map((k) => [k, lookups?.gearById[user.gear?.[k]]]);
  const bait = lookups?.baitById[user.active_bait];
  return (
    <div className="g-hero !min-h-0 p-3 flex flex-wrap items-end justify-center gap-3 sm:gap-5" style={{ backgroundImage: `url(/art/waters/${user.water}_thumb.jpg)` }} data-testid="loadout-bar">
      <div className="g-portrait !w-[86px] !h-[86px] hidden sm:block"><img src="/art/angler.png" alt="" /></div>
      {slots.map(([k, g]) => <Slot key={k} cap={tt(k)} id={g?.id} name={g ? enhName(g.name, user.enhance?.[g.id]) : ""} rarity={g?.legendary ? "legendary" : tierRarity(g?.tier)} onClick={() => g && onInfo(g)} testid={`loadout-${k}`}><Durability id={g?.id} /></Slot>)}
      <Slot cap={tt("bait")} id={bait?.id} name={bait ? `${bait.name} ×${user.bait[bait.id] || 0}` : ""} rarity={tierRarity(Math.ceil((bait?.luck || 0) / 3) + 1)} onClick={onBait} testid="loadout-bait" />
    </div>
  );
}''')])

# tackle tab: rows -> cards
cut(I, '          <table className="table"><tbody>\n            {user.owned_gear.map((id) =>', '          <div className="text-[11px] text-[var(--muted)] mt-2">{tt("Every fish fought', '''          <div className="g-grid">
            {user.owned_gear.flatMap((id) => { const g = lookups?.gearById[id]; const slot = id.split("_")[0]; const eq = user.gear[slot] === id; const rc = g?.legendary ? "legendary" : tierRarity(g?.tier); return [
              <div key={id} className={`g-card rc-${rc}`} data-testid={`tackle-card-${id}`}>
                <span className="tier">T{g?.tier}</span>{eq && <span className="badge">{tt("Equipped")}</span>}
                <button type="button" className="art" onClick={g ? () => setRodInfo(g) : undefined} data-testid={`inv-rod-info-${id}`}><img src={`/art/gear/${id}.webp`} alt={g?.name} /></button>
                <div className="name"><span className="label !text-[9.5px] mr-1">{slot}</span>{enhName(g?.name, user.enhance?.[id])}{g?.bound && <span className="tag tag-bound !text-[9.5px] ml-1.5" data-testid={`inv-untradable-${id}`}>{tt("Untradable")}</span>}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Durability id={id} /><RepairButton gearId={id} compact testId={`repair-${id}`} /></div>
                <div className="flex flex-wrap justify-end gap-1 mt-auto">{eq ? null : <><button className="btn btn-sm btn-gold" onClick={() => equip(id)} data-testid={`equip-${id}`}>{tt("Equip")}</button>{g?.price > 0 && !g.bound && !user.is_guest && <button className="btn btn-sm" onClick={() => setStack({ kind: "gear", id, name: enhName(g.name, user.enhance?.[id]), owned: 1, bound: g.bound, hint: gearMarketHint(g), detail: `T${g.tier} · ${user.durability?.[id] ?? 100}/100` })} data-testid={`sell-gear-${id}`}>{tt("Sell")}</button>}</>}<LinkChatBtn item={{ kind: "gear", ref: id }} label={enhName(g?.name, user.enhance?.[id])} testId={`link-chat-gear-${id}`} /></div>
              </div>,
              ...(user.spare_copies?.[id] || []).map((c, n) => (
                <div key={`${id}-${n}`} className={`g-card rc-${rc}`} data-testid={`inv-gear-copy-${id}-${n}`}>
                  <span className="tier">T{g?.tier}</span><span className="badge !border-[#8fd0f0] !text-[#cff6ff]">{tt("Spare")}</span>
                  <button type="button" className="art" onClick={g ? () => setRodInfo(g) : undefined}><img src={`/art/gear/${id}.webp`} alt={g?.name} /></button>
                  <div className="name">{enhName(g?.name, c.enhance)}</div>
                  <div className="flex items-center gap-2"><span className="inline-block w-14 h-1.5 bg-[#2a2420] rounded-full overflow-hidden"><span className="block h-full" style={{ width: `${c.durability}%`, background: c.durability > 50 ? "#5ad07f" : c.durability > 20 ? "#e0b341" : "#e0645a" }} /></span><span className="num text-[11px] text-[var(--text-2)]">{c.durability}/100</span></div>
                  <div className="flex flex-wrap justify-end gap-1 mt-auto"><button className="btn btn-sm btn-gold" onClick={() => equip(id, n)} data-testid={`equip-copy-${id}-${n}`}>{tt("Equip")}</button>{!user.is_guest && <button className="btn btn-sm" onClick={() => setStack({ kind: "gear", id, copy: n, name: enhName(g?.name, c.enhance), owned: 1, hint: gearMarketHint(g), detail: `T${g?.tier} · ${c.durability}/100` })} data-testid={`sell-gear-copy-${id}-${n}`}>{tt("Sell")}</button>}<LinkChatBtn item={{ kind: "gear", ref: id, copy_idx: n }} label={enhName(g?.name, c.enhance)} testId={`link-chat-gear-copy-${id}-${n}`} /></div>
                </div>
              )),
            ]; })}
          </div>
''')
print("inventory ok")
