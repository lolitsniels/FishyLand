// Big explorable tile maps: painted ground layers + placed objects. Coordinates are world px.
const posts = (x0, x1, y, step = 140) => { const o = []; for (let x = x0; x <= x1; x += step) o.push([x, y]); return o; };

// Town row faces the high street; tavern + pearl shop face the beach promenade; piers run off the promenade.
export const HARBOUR_MAP = {
  tiled: true, W: 3600, H: 2400, scale: 0.74, spawn: { x: 1550, y: 1460 }, weather: "gulls",
  base: "grass",
  ground: [
    { tex: "cobble", poly: [260, 960, 2700, 960, 2700, 1110, 260, 1110] },
    { tex: "cobble", circle: [1550, 1260, 250, 170] },
    { tex: "cobble", poly: [200, 1600, 2760, 1600, 2760, 1730, 200, 1730] },
    { tex: "cobble", poly: [1490, 1100, 1610, 1100, 1610, 1610, 1490, 1610] },
    { tex: "cobble", poly: [2350, 1100, 2450, 1100, 2450, 1610, 2350, 1610] },
    { tex: "cobble", poly: [560, 1100, 650, 1100, 650, 1610, 560, 1610] },
  ],
  water: [{ smooth: [2780, -200, 3800, -200, 3800, 2600, -200, 2600, -200, 1980, 600, 1900, 1200, 1940, 1800, 1890, 2400, 1880, 2700, 1820, 2790, 1500, 2760, 900, 2800, 300], bankW: 110 }],
  docks: [
    { poly: [2700, 1600, 3380, 1600, 3380, 1730, 2700, 1730], posts: posts(2840, 3380, 1735) },
    { poly: [1480, 1720, 1620, 1720, 1620, 2160, 1480, 2160], posts: [[1480, 2160], [1620, 2160], [1480, 2010], [1620, 2010]] },
  ],
  objects: [
    { k: "bait_hut", x: 430, y: 945, w: 340 }, { k: "house", x: 800, y: 945 }, { k: "tackle_shop", x: 1160, y: 945 }, { k: "market_stall", x: 1560, y: 945 },
    { k: "guild_hall", x: 2000, y: 945, w: 470, fp: [0.92, 0.6] }, { k: "house", x: 2440, y: 945, flip: true },
    { k: "fountain", x: 1550, y: 1310, w: 250 }, { k: "quest_board", x: 1830, y: 1175, w: 140 }, { k: "quest_board", x: 1270, y: 1175, w: 140 },
    { k: "tavern", x: 900, y: 1585, w: 400 }, { k: "pearl_shop", x: 2120, y: 1585, w: 350 }, { k: "house", x: 300, y: 1585, w: 260 },
    { k: "ship", x: 3060, y: 1590, w: 620, flip: true }, { k: "rowboat", x: 1760, y: 2120, w: 210 },
    ...[400, 900, 1350, 1750, 2200, 2650].map((x) => ({ k: "lantern", x, y: 1125 })),
    ...[500, 1150, 1750, 2350].map((x) => ({ k: "lantern", x, y: 1745 })),
    { k: "lantern", x: 2640, y: 1560 }, { k: "lantern", x: 1420, y: 1690 },
    { k: "barrels", x: 1360, y: 950, w: 110 }, { k: "barrels", x: 2660, y: 950, w: 110 }, { k: "barrels", x: 1100, y: 1590, w: 100 },
    ...[[180, 560], [620, 520], [1000, 600], [1380, 560], [1780, 520], [2250, 560], [2600, 600]].map(([x, y]) => ({ k: "oak", x, y })),
    ...[[90, 900], [400, 380], [1200, 350], [1600, 330], [2050, 380], [2450, 330], [140, 1300]].map(([x, y]) => ({ k: "pine", x, y })),
    { k: "oak", x: 1000, y: 1400, w: 240 }, { k: "oak", x: 2050, y: 1420, w: 240 }, { k: "oak", x: 300, y: 1400, w: 240 },
    { k: "bush", x: 1300, y: 1420 }, { k: "bush", x: 1800, y: 1420 }, { k: "bush", x: 2650, y: 1380 }, { k: "bush", x: 800, y: 1380 },
    { k: "rocks", x: 2650, y: 1880, w: 150 }, { k: "rocks", x: 400, y: 1900, w: 150 }, { k: "rocks", x: 2820, y: 800, w: 160 },
  ],
  spots: [
    { id: "crafting", label: "Workshop · Crafting", img: "craft", x: 430, y: 1000 },
    { id: "almanac", label: "Old Salt's Almanac", img: "fishdex", x: 800, y: 1000 },
    { id: "shop", label: "Tackle Shop", img: "/art/hud/tackle.webp", x: 1160, y: 1000 },
    { id: "market", label: "Market", img: "market", x: 1560, y: 1000 },
    { id: "crews", label: "Crew HQ", img: "crew", x: 2000, y: 1010 },
    { id: "achievements", label: "Hall of Achievements", img: "skills", x: 2440, y: 1000 },
    { id: "tournaments", label: "Tournament Board", img: "rankings", x: 1270, y: 1215 },
    { id: "quests", label: "Quest Board", img: "quests", x: 1830, y: 1215 },
    { id: "leaderboards", label: "Fountain of Fame", img: "rankings", x: 1550, y: 1350 },
    { id: "contracts", label: "Anchor Café · Contracts", img: "daily", x: 900, y: 1640 },
    { id: "pearl-shop", label: "Pearl Shop", img: "pass", x: 2120, y: 1640 },
    { id: "boat", label: "Sea Serpent · Travel", img: "map", x: 3260, y: 1665 },
    { id: "duel", label: "Duel Pier", img: "guild", x: 1550, y: 2040 },
  ],
  sparkle: [0, 1850, 3600, 550], leap: [2900, 1800, 600, 500],
  life: { rings: [[2840, 1745], [3120, 1745], [3380, 1745], [1480, 2170], [1620, 2170], [2900, 1590], [3300, 1590]] },
};

export const MILLBROOK_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 380, y: 1180 }, weather: "petals", water_tex: "river",
  base: "grass",
  ground: [
    { tex: "sand", line: [380, 1180, 800, 1230, 1212, 1200], width: 100 },
    { tex: "sand", line: [1788, 943, 2150, 1100, 2300, 1520], width: 100 },
    { tex: "sand", line: [800, 1230, 720, 1480], width: 90 },
    { tex: "sand", line: [1788, 943, 1900, 600, 2350, 420], width: 90 },
  ],
  water: [
    { line: [300, -100, 700, 450, 1300, 900, 1700, 1250, 2100, 1700, 2500, 2150, 2780, 2550], width: 300, bankW: 80 },
    { circle: [700, 1820, 340, 230], bankW: 70 },
  ],
  docks: [{ poly: [652, 1470, 748, 1470, 748, 1770, 652, 1770], posts: [[652, 1770], [748, 1770], [652, 1640], [748, 1640]] }],
  bridges: [{ a: [1170, 1215], b: [1830, 925], w: 96 }],
  objects: [
    { k: "house", x: 520, y: 930, w: 300 }, { k: "barrels", x: 700, y: 950, w: 110 }, { k: "house", x: 2420, y: 360, w: 280, flip: true },
    { k: "rowboat", x: 930, y: 1890, w: 200 },
    { k: "reeds", x: 410, y: 1730, w: 130 }, { k: "reeds", x: 1000, y: 1720, w: 130 }, { k: "reeds", x: 560, y: 2030, w: 120 },
    { k: "reeds", x: 1170, y: 990, w: 120 }, { k: "reeds", x: 1950, y: 1290, w: 120 }, { k: "reeds", x: 2380, y: 1960, w: 120 }, { k: "reeds", x: 840, y: 420, w: 120 },
    { k: "willow", x: 1000, y: 1120 }, { k: "willow", x: 2450, y: 1080 }, { k: "willow", x: 1100, y: 330 }, { k: "willow", x: 2620, y: 1720 },
    { k: "oak", x: 200, y: 350 }, { k: "oak", x: 230, y: 1700 }, { k: "oak", x: 1500, y: 1900 }, { k: "oak", x: 2900, y: 700 }, { k: "oak", x: 2950, y: 1500 }, { k: "oak", x: 1750, y: 420 },
    { k: "pine", x: 140, y: 800 }, { k: "pine", x: 1300, y: 2250 }, { k: "pine", x: 3050, y: 1100 }, { k: "pine", x: 2700, y: 300 }, { k: "pine", x: 1900, y: 2200 },
    { k: "rocks", x: 2650, y: 1000, w: 170 }, { k: "rocks", x: 380, y: 540, w: 150 }, { k: "rocks", x: 1200, y: 1650, w: 140 },
    { k: "bush", x: 900, y: 1300 }, { k: "bush", x: 2150, y: 800 }, { k: "bush", x: 2600, y: 1300 }, { k: "bush", x: 300, y: 1450 },
    { k: "lantern", x: 1110, y: 1300 }, { k: "lantern", x: 1910, y: 850 }, { k: "lantern", x: 600, y: 1450 },
  ],
  spots: [
    { id: "harbour", label: "Back to Harbour", img: "crew", x: 300, y: 1180 },
    { id: "fish-1", fish: true, label: "Bridge", x: 1520, y: 1065, cast: [1690, 1260] },
    { id: "fish-2", fish: true, label: "North Bank", x: 1150, y: 480, cast: [960, 680] },
    { id: "fish-3", fish: true, label: "Pond Pier", x: 700, y: 1740, cast: [760, 1920] },
    { id: "fish-4", fish: true, label: "South Bank", x: 2290, y: 1560, cast: [2110, 1720] },
  ],
  sparkle: [300, 0, 2500, 2400], leap: [1300, 900, 900, 800],
  life: {},
};

// Every crew gets its own island: clubhouse, round pond (not stocked yet), dock with the boat back to the harbour.
export const CREW_ISLAND_MAP = {
  tiled: true, W: 2400, H: 1800, scale: 0.74, spawn: { x: 1200, y: 1450 }, weather: "gulls",
  base: "grass",
  ground: [
    { tex: "cobble", line: [1200, 1570, 1200, 1240], width: 110 },
    { tex: "cobble", circle: [1200, 1000, 360, 250] },
    { tex: "cobble", line: [1200, 760, 1200, 660], width: 140 },
  ],
  water: [{ invert: [320, 320, 1200, 190, 2080, 320, 2240, 900, 2080, 1500, 1200, 1620, 320, 1500, 160, 900], bankW: 100 }, { circle: [1200, 1000, 250, 160], bankW: 40, bank: "cobble" }],
  docks: [{ poly: [1140, 1560, 1260, 1560, 1260, 1790, 1140, 1790], posts: [[1140, 1790], [1260, 1790], [1140, 1680], [1260, 1680]] }],
  objects: [
    { k: "guild_hall", x: 1200, y: 650, w: 440, fp: [0.92, 0.6] },
    { k: "rowboat", x: 1370, y: 1760, w: 200 },
    ...[[520, 520], [800, 420], [1600, 420], [1880, 520], [420, 1150], [1980, 1150], [700, 1400], [1700, 1400]].map(([x, y], i) => ({ k: i % 3 === 1 ? "pine" : "oak", x, y })),
    { k: "bush", x: 860, y: 760 }, { k: "bush", x: 1540, y: 760 }, { k: "bush", x: 900, y: 1300 }, { k: "bush", x: 1500, y: 1300 },
    { k: "lantern", x: 1080, y: 1300 }, { k: "lantern", x: 1320, y: 1300 }, { k: "lantern", x: 1080, y: 720 }, { k: "lantern", x: 1320, y: 720 },
    { k: "rocks", x: 380, y: 900, w: 150 }, { k: "rocks", x: 2000, y: 880, w: 150 }, { k: "barrels", x: 1330, y: 1540, w: 100 },
  ],
  spots: [
    { id: "crews", label: "Crew Clubhouse", img: "crew", x: 1200, y: 705 },
    { id: "crew-pond", label: "Crew Pond · not stocked", img: "fishdex", x: 1200, y: 1215 },
    { id: "harbour", label: "Boat to Harbour", img: "map", x: 1200, y: 1740 },
  ],
  sparkle: [0, 0, 2400, 1800], leap: null, life: {},
};

// Duel Pier arena: one round pond, a pier from each side, scoreboard stand at the top.
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

export const TILED = { harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP, crew_island: CREW_ISLAND_MAP, duel_pier: DUEL_MAP };
