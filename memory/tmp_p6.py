def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:80]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/'
# A. objects never sit half in water: nudge onto dry land
patch(F + 'src/game/tilemap.js', [
    ('  const objects = map.objects.filter((o) => OBJ[o.k].wet || OBJ[o.k].ground || !isWater(o.x, o.y - 4));', '''  // Land props must stand fully on dry ground: if any base point is in water, nudge to the nearest dry spot.
  const settle = (o) => {
    const def = OBJ[o.k];
    if (def.wet || def.ground) return o;
    const w = o.w || def.w, half = w * 0.4;
    const dry = (x, y) => [[x, y], [x - half, y], [x + half, y], [x, y - w * 0.2], [x - half, y - w * 0.2], [x + half, y - w * 0.2]].every(([a, b]) => !isWater(a, b + 6) && !isWater(a, b + 24));
    if (dry(o.x, o.y)) return o;
    for (let r = 16; r <= 480; r += 16) for (let k = 0; k < 16; k++) {
      const x = o.x + Math.cos((k * Math.PI) / 8) * r, y = o.y + Math.sin((k * Math.PI) / 8) * r;
      if (dry(x, y)) return { ...o, x, y };
    }
    return null;
  };
  const objects = map.objects.map(settle).filter(Boolean);'''),
    ("reeds: { w: 150, fp: [0, 0], wet: true }", "reeds: { w: 150, fp: [0, 0] }"),
])
patch(F + 'src/game/maps.js', [('{ k: "guild_hall", x: 2000, y: 945, w: 470 }', '{ k: "guild_hall", x: 2000, y: 945, w: 470, fp: [0.92, 0.6] }')])
s = open(F + 'src/game/maps.js').read()
s = s.replace('{ id: "crews", label: "Crew HQ", img: "crew", x: 2000, y: 1000 }', '{ id: "crews", label: "Crew HQ", img: "crew", x: 2000, y: 1010 }')
open(F + 'src/game/maps.js', 'w').write(s)

# C. one reel control during a fight
patch(F + 'src/index.css', [('html body .reel-btn:not(.holding) { background: rgba(10, 9, 8, .86) !important; border: 1px solid var(--trim-hi) !important; color: #f1e4c4 !important; box-shadow: inset 0 1px 0 rgba(255, 240, 210, .08), 0 4px 14px rgba(0, 0, 0, .6) !important; }\n', '')])
patch(F + 'src/world/World.js', [
    ('className={`fish-btn fish-btn-img w-[96px] h-[96px] -mt-7 grid place-items-center ${!idle ? "busy" : ""}', 'className={`fish-btn fish-btn-img w-[96px] h-[96px] -mt-7 grid place-items-center ${ph === "fight" ? "invisible" : ""} ${!idle ? "busy" : ""}'),
    # E. water mode: essentials only
    ('const BAR_L = ["waters", "journal", "inventory"];\nconst BAR_R = ["shop", "profile"];', 'const BAR_L = ["waters", "journal", "inventory"];\nconst BAR_R = ["shop", "profile"];\nconst BAR_R_WATER = ["quests", "profile"];\n// Only reachable from harbour buildings, never from a water.\nconst HARBOUR_ONLY = new Set(["shop", "market", "crews", "pearl-shop", "contracts", "crafting", "tournaments", "leaderboards", "achievements", "almanac", "duel", "crew", "bosses", "boss"]);'),
    ('          {BAR_R.map((k) =>', '          {(mode === "water" ? BAR_R_WATER : BAR_R).map((k) =>'),
    ('{[...MORE, ...(user.is_admin ? ["admin"] : [])].map((k) =>', '{[...MORE, ...(user.is_admin ? ["admin"] : [])].filter((k) => mode !== "water" || !HARBOUR_ONLY.has(k)).map((k) =>'),
    ('  useEffect(() => {\n    const on = (e) => { goTo(e.detail); nav("/game", { replace: true }); };', '''  useEffect(() => {
    if (mode === "water" && page && HARBOUR_ONLY.has(page)) { toast("That's in the harbour. Sail back to visit it."); nav("/game", { replace: true }); }
  }, [mode, page, nav]);
  useEffect(() => {
    const on = (e) => { goTo(e.detail); nav("/game", { replace: true }); };'''),
    ('crews: ["Crew HQ", "crew"]', 'crews: ["Crew HQ", "crew"]'),
    ('<Coins size={15} color="#ffd34d" className="pcard-ic gold" />', '<img src="/art/hud/gold.webp" alt="Gold" className="pcard-ic gold" />'),
    ('<Gem size={14} color="#bff4ff" className="pcard-ic pearl" />', '<img src="/art/hud/pearl.webp" alt="Pearls" className="pcard-ic pearl" />'),
])
s = open(F + 'src/world/World.js').read()
s = s.replace('shop: ["Tackle Shop", "bait"]', 'shop: ["Tackle Shop", "/art/hud/tackle.webp"]')
if 'import { toast }' not in s: s = s.replace('import CatchCard from "./CatchCard";', 'import CatchCard from "./CatchCard";\nimport { toast } from "sonner";')
open(F + 'src/world/World.js', 'w').write(s)
patch(F + 'src/game/maps.js', [('label: "Tackle Shop", img: "bait"', 'label: "Tackle Shop", img: "/art/hud/tackle.webp"')])
# D. one gold + pearl graphic everywhere
patch(F + 'src/tfl/components/ui-bits.js', [
    ('    <Coins size={13} className="text-[var(--gold)]" />{fmt(n)}', '    <img src="/art/hud/gold.webp" alt="" aria-hidden className="w-[15px] h-[15px] object-contain" />{fmt(n)}'),
    ('''  <span aria-hidden className={`inline-block rounded-full shrink-0 ${className}`} style={{ width: size, height: size, background: "radial-gradient(circle at 35% 30%, #ffffff 0%, #f1e6f7 35%, #b9a8c9 75%, #7d6b8f 100%)", boxShadow: "0 0 0 1px rgba(255,255,255,.25), 0 0 4px rgba(214,196,234,.45)" }} />''',
     '''  <img src="/art/hud/pearl.webp" alt="" aria-hidden className={`inline-block shrink-0 object-contain ${className}`} style={{ width: size + 4, height: size + 4 }} />'''),
])
patch(F + 'src/tfl/components/ShopFrame.js', [
    ('<Purse icon={<Coins size={16} />} label="Gold"', '<Purse icon={<img src="/art/hud/gold.webp" alt="" className="w-5 h-5" />} label="Gold"'),
    ('<Purse icon={<Gem size={16} />} label="Pearls"', '<Purse icon={<img src="/art/hud/pearl.webp" alt="" className="w-5 h-5" />} label="Pearls"'),
    ('import { Coins, Gem } from "lucide-react";\n', ''),
])
# F. chat shows own line instantly, look dialog text, map pins
patch(F + 'src/world/ChatBox.js', [('try { await api.post(`/chat/${ch}`, { text: t }); setText("");', 'try { const r = await api.post(`/chat/${ch}`, { text: t }); setText(""); if (r.data?.id) { last.current = r.data.at || last.current; setRows((old) => [...old, r.data].slice(-80)); }')])
patch(F + 'src/world/LookEditor.js', [('Outfits, wings and pets will arrive in the Pearl Shop later.', 'Outfits, rod skins and pets will arrive in the Pearl Shop later.')])
patch(F + 'src/tfl/components/WorldMap.js', [('greyfell: [50, 13]', 'greyfell: [50, 17]'), ('frozen: [85.5, 15.5]', 'frozen: [85.5, 19]')])
print('ok')
