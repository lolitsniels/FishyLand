def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'
# World: duel mode
s = open(F + 'world/World.js').read()
s = s.replace('const placeOf = (m, user) => (m === "harbour" ? "harbour" : m === "crew" ? "crew_island" : user?.water || "millbrook");', 'const placeOf = (m, user) => (m === "harbour" ? "harbour" : m === "crew" ? "crew_island" : m === "duel" ? "duel_pier" : user?.water || "millbrook");')
s = s.replace('  const canFish = mode === "water" && !!atSpot;', '  const wet = mode === "water" || mode === "duel";\n  const canFish = wet && !!atSpot;')
s = s.replace('const fishLabel = mode !== "water" ? "SAIL"', 'const fishLabel = !wet ? "SAIL"')
s = s.replace('const onFish = () => { if (mode !== "water") nav', 'const onFish = () => { if (!wet) nav')
s = s.replace('{mode === "water" && idle && !nearSpot && !page && <Hint', '{wet && idle && !nearSpot && !page && <Hint')
s = s.replace('disabled={mode === "water" && (!canFish || !idle)}', 'disabled={wet && (!canFish || !idle)}')
s = s.replace('        <ChatBox />\n', '        <ChatBox />\n        {mode === "duel" && <DuelHud />}\n')
s = s.replace('import { ChatBox } from "./ChatBox";', 'import { ChatBox } from "./ChatBox";\nimport { DuelHud } from "./DuelLive";')
s = s.replace('place={mode === "harbour" ? "The Harbour" : mode === "crew"', 'place={mode === "harbour" ? "The Harbour" : mode === "duel" ? "Duel Pier" : mode === "crew"')
s = s.replace('    if (mode !== "harbour" && page && HARBOUR_ONLY.has(page)', '    if (mode === "duel" && page && page !== "inventory" && page !== "journal") { nav("/game", { replace: true }); return; }\n    if (mode !== "harbour" && page && HARBOUR_ONLY.has(page)')
s = s.replace('{(mode !== "harbour" ? BAR_R_WATER : BAR_R).map((k) =>', '{(mode !== "harbour" ? BAR_R_WATER : BAR_R).filter((k) => mode !== "duel" || k === "profile").map((k) =>')
# relog starts in the harbour
s = s.replace('const [mode, setMode] = useState(() => {', 'const [mode, setMode] = useState(() => {\n    if (sessionStorage.getItem("fr_mode") === "duel") sessionStorage.setItem("fr_mode", "harbour");', 1)
open(F + 'world/World.js', 'w').write(s)
patch(F + 'tfl/context/GameContext.js', [('    localStorage.setItem("owo_token", payload.token);', '    localStorage.setItem("owo_token", payload.token);\n    sessionStorage.setItem("fr_mode", "harbour");')])
a = open(F + 'App.js').read()
a = a.replace('["duel", Duel]', '["duel", DuelLive]', 1)
a = a.replace('import ', 'import DuelLive from "./world/DuelLive";\nimport ', 1)
open(F + 'App.js', 'w').write(a)
# Duel map
patch(F + 'game/maps.js', [('export const TILED = { harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP, crew_island: CREW_ISLAND_MAP };', '''// Duel Pier arena: one round pond, a pier from each side, scoreboard stand at the top.
export const DUEL_MAP = {
  tiled: true, W: 2200, H: 1500, scale: 0.74, spawn: { x: 1100, y: 1230 }, weather: "gulls", water_tex: "river",
  base: "grass",
  ground: [{ tex: "cobble", circle: [1100, 720, 640, 430] }, { tex: "cobble", line: [1100, 1140, 1100, 1400], width: 130 }],
  water: [{ circle: [1100, 720, 460, 280], bankW: 40, bank: "cobble" }],
  docks: [
    { poly: [560, 660, 860, 660, 860, 780, 560, 780], posts: [[860, 660], [860, 780], [740, 780]] },
    { poly: [1340, 660, 1640, 660, 1640, 780, 1340, 780], posts: [[1340, 660], [1340, 780], [1460, 780]] },
  ],
  objects: [
    { k: "quest_board", x: 1100, y: 250, w: 220 },
    ...[[300, 300], [1900, 300], [260, 1200], [1940, 1200]].map(([x, y]) => ({ k: "oak", x, y })),
    { k: "lantern", x: 980, y: 1200 }, { k: "lantern", x: 1220, y: 1200 }, { k: "lantern", x: 520, y: 600 }, { k: "lantern", x: 1680, y: 600 },
    { k: "bush", x: 700, y: 300 }, { k: "bush", x: 1500, y: 300 }, { k: "barrels", x: 470, y: 900, w: 100 }, { k: "barrels", x: 1730, y: 900, w: 100 },
  ],
  spots: [
    { id: "fish-1", fish: true, label: "West Pier", x: 840, y: 725, cast: [1000, 740] },
    { id: "fish-2", fish: true, label: "East Pier", x: 1360, y: 725, cast: [1200, 740] },
    { id: "fish-3", fish: true, label: "South Bank", x: 1100, y: 1060, cast: [1100, 900] },
    { id: "fish-4", fish: true, label: "North Bank", x: 1100, y: 390, cast: [1100, 540] },
  ],
  sparkle: [640, 440, 920, 560], leap: [700, 500, 800, 450], life: {},
};

export const TILED = { harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP, crew_island: CREW_ISLAND_MAP, duel_pier: DUEL_MAP };'''),
    # Sea Serpent faces the sea; no posts hidden behind it
    ('{ k: "ship", x: 3060, y: 1590, w: 620 }', '{ k: "ship", x: 3060, y: 1590, w: 620, flip: true }'),
    ('posts: [...posts(2840, 3380, 1735), ...posts(2840, 3380, 1598)] }', 'posts: posts(2840, 3380, 1735) }'),
])
patch('/app/backend/world_presence.py', [('else body.loc if body.loc == "harbour" or body.loc in WATER_BY_KEY else "harbour"', 'else body.loc if body.loc in ("harbour", "duel_pier") or body.loc in WATER_BY_KEY else "harbour"')])
print('ok')
