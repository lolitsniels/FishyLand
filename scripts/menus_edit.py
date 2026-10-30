import re
B = "/app/frontend/src/tfl/"


def edit(path, pairs):
    p = B + path
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (path, a[:90])
        s = s.replace(a, b)
    open(p, "w").write(s)


def cut(path, start, end, new):
    p = B + path
    s = open(p).read()
    a = s.index(start)
    b = s.index(end, a)
    s = s[:a] + new + s[b:]
    open(p, "w").write(s)


edit("components/GameUI.js", [('<img src={`/art/ui/${img}.png`} alt="" />', '<img src={img.includes("/") ? `/art/${img}` : `/art/ui/${img}.png`} alt="" />')])

S = "pages/game/Shop.js"
edit(S, [
    ('import { t as tt } from "../../i18n";', 'import { t as tt } from "../../i18n";\nimport { GameTabs, tierRarity } from "../../components/GameUI";'),
    ('''  ["rod", "Rods", Wand], ["reel", "Reels", Disc3], ["line", "Lines", Spline], ["bait", "Bait", Fish], ["cages", "Crab Cages", Box], ["enhance", "Enhance", Hammer],''',
     '''  ["rod", "Rods", "gear/_rod_t5.webp"], ["reel", "Reels", "gear/_reel_t5.webp"], ["line", "Lines", "gear/_line_t3.webp"], ["bait", "Bait", "gear/bait_worm.webp"], ["cages", "Crab Cages", "gear/bait_cricket.webp"], ["enhance", "Enhance", "craft"],'''),
    ('import { Hammer, Fish, Wand, Disc3, Spline, Info, Box } from "lucide-react";', 'import { Info } from "lucide-react";'),
    ('''  const narrow = useNarrow();
  const busy = useRef(false);
  const [ms, setMs]''', '''  const busy = useRef(false);
  const [ms, setMs]'''),
    ('''  const { user, setUser, data, lookups } = useGame();
  const narrow = useNarrow();''', '''  const { user, setUser, data, lookups } = useGame();
  const narrow = false;'''),
])
cut(S, "function GearCard(", "function GearTable(", '''function GearCard({ g, slot, statKeys, user, act }) {
  const eq = user.gear[slot] === g.id;
  return (
    <div className={`g-card rc-${g.legendary ? "legendary" : tierRarity(g.tier)}`} data-testid={`shop-item-${g.id}`}>
      <span className="tier">T{g.tier}</span>
      {eq ? <span className="badge">{tt("Equipped")}</span> : user.owned_gear.includes(g.id) ? <span className="badge !border-[#8fd0f0] !text-[#cff6ff]">{tt("Owned")}</span> : null}
      <button type="button" className="art" onClick={() => act.setInfo(g)} data-testid={`rod-info-open-${g.id}`}><img src={`/art/gear/${g.id}.webp`} alt={g.name} loading="lazy" /></button>
      <div className="min-w-0"><GearName g={g} user={user} /></div>
      <div className="shop-card-stats">
        {statKeys.map((k) => <Stat key={k} k={tt(k)}>×{g[k]}</Stat>)}
        <Stat k={tt(PERK_HEAD[slot])}><span className="text-[#8fd0f0]" data-testid={`perk-${g.id}`}>{perkText(slot, g.tier, g.luck_bonus || 0)}</span></Stat>
        <Stat k={tt("Repair")}>{repairPerPoint(g) ? `${repairPerPoint(g)}g/pt` : tt("free")}</Stat>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto"><span className="whitespace-nowrap"><GearPrice g={g} /></span><GearAction g={g} slot={slot} user={user} miles={act.ms[g.id] || []} buy={act.buy} setInfo={act.setInfo} /></div>
    </div>
  );
}

''')
cut(S, '      {narrow ? <div className="shop-cards">{sorted.map(', '      {info && <RodInfoDialog', '''      <div className="g-grid p-3">{sorted.map((g) => <GearCard key={g.id} g={g} slot={slot} statKeys={statKeys} user={user} act={act} />)}</div>
''')
cut(S, '      {narrow ? (\n        <div className="shop-cards">', '      <p className="text-[11.5px] text-[var(--muted)] mt-2 px-3 pb-2">', '''      <div className="g-grid p-3">
        {baits.map((b) => { const r = baitRow(b, user, qty); return (
          <div key={b.id} className={`g-card rc-${tierRarity(Math.ceil((b.luck || 0) / 3) + 1)}`} data-testid={`shop-bait-${b.id}`}>
            <span className="badge">×{user.bait[b.id] || 0}</span>
            <button type="button" className="art" onClick={() => setInfo(b)} data-testid={`bait-art-${b.id}`}><img src={`/art/gear/${b.id}.webp`} alt={b.name} loading="lazy" /></button>
            <BaitName b={b} user={user} lookups={lookups} onClick={() => setInfo(b)} />
            <div className="shop-card-stats">
              <Stat k={tt("Luck")}><BaitLuck b={b} /></Stat><Stat k={tt("Bite")}>+{b.bite}%</Stat>
              <span className="shop-stat"><span>{tt("Size")}</span><SizePips n={b.size || 0} testId={`bait-size-${b.id}`} /></span>
              <Stat k={tt("Each")}><BaitEach b={b} r={r} user={user} /></Stat>
            </div>
            <div className="flex items-center justify-end gap-2 mt-auto"><BaitQty b={b} qty={qty} setQty={setQty} /><BaitBuy b={b} r={r} buyBait={buyBait} /></div>
          </div>
        ); })}
      </div>
''')
cut(S, '        <div className="flex flex-wrap gap-1 mb-2 border-b border-[var(--border)]" data-testid="shop-tabs">', '        <p className="text-[12.5px] text-[var(--text-2)] m-clamp" data-testid="shop-intro">',
    '''        <GameTabs tabs={TABS} value={tab} onChange={setTab} testid="shop-tab" />
''')
print("shop ok")
