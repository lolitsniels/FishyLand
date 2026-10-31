// Big explorable tile maps: painted ground layers + placed objects. Coordinates are world px.
const posts = (x0, x1, y, step = 140) => { const o = []; for (let x = x0; x <= x1; x += step) o.push([x, y]); return o; };

// Town row faces the high street; tavern + pearl shop face the beach promenade; piers run off the promenade.
export const HARBOUR_NPCS = [
  { id: "harbourmaster", name: "Harbourmaster Crane", x: 1400, y: 1560, lines: [
    "Ahoy, young angler! Every fish you land goes in my big ledger. Fill your Fishdex and you'll be famous!",
    "A riddle for you: before the baker lights his ovens, the quiet pond catches fire, but no smoke rises. Be at Millbrook when it burns.",
    "Some fish only come out at special times. Watch the clock, not just the water!",
  ] },
  { id: "baitseller", name: "Nettie the Bait Seller", x: 450, y: 1240, lines: [
    "Worms for the pond, shiny lures for the sea! Better bait means bigger bites, sweetie.",
    "Riddle time! When the sky blushes red and the frogs start to sing, something long and slippery slides through Blackwater's roots.",
    "Mix bait at the Workshop. The Angler's Secret recipe makes fish go wild!",
  ] },
  { id: "sailor", name: "Old Tobias", x: 2560, y: 1470, lines: [
    "Back in my day I hooked a fish as big as a boat! The mythic ones are out there, I promise you.",
    "Listen close: when the sun goes to bed and the stars blink awake, a ray made of night glides over the coral. Few have seen it.",
    "Take the Sea Serpent to new waters. Each one hides fish you've never seen!",
  ] },
  { id: "cook", name: "Cook Marisol", x: 760, y: 1225, lines: [
    "Bring me fish for my contracts and I'll pay you well! Check the Contracts page.",
    "Did you know? Rare fish sell for loads more at the Market than to the vendor.",
    "A little secret: luck from your rod, bait and crew stacks up. More luck, more shiny fish!",
  ] },
];
const npcBlocks = (list) => list.map(({ x, y }) => [x - 30, y - 18, x + 30, y - 18, x + 30, y + 4, x - 30, y + 4]);

export const HARBOUR_MAP = {
  npcs: HARBOUR_NPCS, blocks: npcBlocks(HARBOUR_NPCS),
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
    { k: "guild_hall", x: 2000, y: 945, w: 470, fp: [0.92, 0.72] }, { k: "house", x: 2440, y: 945, flip: true },
    { k: "fountain", x: 1550, y: 1310, w: 250, plaza: true }, { k: "quest_board", x: 1830, y: 1175, w: 140 }, { k: "quest_board", x: 1270, y: 1175, w: 140 },
    { k: "tavern", x: 900, y: 1585, w: 400 }, { k: "pearl_shop", x: 2120, y: 1585, w: 350 }, { k: "house", x: 300, y: 1585, w: 260 },
    { k: "ship", x: 3060, y: 1590, w: 620, flip: true }, { k: "rowboat", x: 1760, y: 2120, w: 210 },
    ...[400, 900, 1350, 1750, 2200, 2650].map((x) => ({ k: "lantern", x, y: 1125 })),
    ...[500, 1150, 1750, 2350].map((x) => ({ k: "lantern", x, y: 1785 })),
    { k: "lantern", x: 2640, y: 1560 },
    { k: "barrels", x: 1360, y: 950, w: 110 }, { k: "barrels", x: 2660, y: 950, w: 110 }, { k: "barrels", x: 1100, y: 1590, w: 100 },
    ...[[180, 560], [620, 520], [1000, 600], [1380, 560], [1780, 520], [2250, 560], [2600, 600]].map(([x, y]) => ({ k: "oak", x, y })),
    ...[[90, 900], [400, 380], [1200, 350], [1600, 330], [2050, 380], [2450, 330], [140, 1300]].map(([x, y]) => ({ k: "pine", x, y })),
    { k: "oak", x: 1000, y: 1400, w: 240 }, { k: "oak", x: 2050, y: 1420, w: 240 }, { k: "oak", x: 300, y: 1400, w: 240 },
    { k: "bush", x: 1300, y: 1420 }, { k: "bush", x: 1800, y: 1420 }, { k: "bush", x: 2650, y: 1380 }, { k: "bush", x: 800, y: 1380 },
    { k: "rocks", x: 2582, y: 1812, w: 150 }, { k: "rocks", x: 382, y: 1856, w: 150 }, { k: "rocks", x: 2687, y: 855, w: 160 },
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
    { k: "bush", x: 900, y: 1380 }, { k: "bush", x: 2150, y: 800 }, { k: "bush", x: 2600, y: 1300 }, { k: "bush", x: 300, y: 1450 },
    { k: "lantern", x: 1110, y: 1300 }, { k: "lantern", x: 1910, y: 850 }, { k: "lantern", x: 594, y: 1465 },
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
    { k: "guild_hall", x: 1200, y: 650, w: 440, fp: [0.92, 0.72], plaza: true },
    { k: "rowboat", x: 1370, y: 1760, w: 200 },
    ...[[520, 520], [800, 420], [1600, 420], [1880, 520], [420, 1150], [1980, 1150], [700, 1400], [1700, 1400]].map(([x, y], i) => ({ k: i % 3 === 1 ? "pine" : "oak", x, y })),
    { k: "bush", x: 860, y: 760 }, { k: "bush", x: 1540, y: 760 }, { k: "bush", x: 900, y: 1300 }, { k: "bush", x: 1500, y: 1300 },
    { k: "lantern", x: 1080, y: 1300 }, { k: "lantern", x: 1320, y: 1300 }, { k: "lantern", x: 1080, y: 720 }, { k: "lantern", x: 1320, y: 720 },
    { k: "rocks", x: 380, y: 900, w: 150 }, { k: "rocks", x: 2000, y: 880, w: 150 }, { k: "barrels", x: 1330, y: 1540, w: 100 },
  ],
  spots: [
    { id: "clubhouse", label: "Enter the Crew Clubhouse", img: "crew", x: 1200, y: 705 },
    { id: "crew-pond", label: "Crew Pond · not stocked", img: "fishdex", x: 1200, y: 1215 },
    { id: "harbour", label: "Boat to Harbour", img: "map", x: 1200, y: 1740 },
  ],
  sparkle: [0, 0, 2400, 1800], leap: null, life: {},
};

// Duel Pier arena: one round pond, a pier from each side, scoreboard stand at the top.
// Inside the crew clubhouse (yacht club): every crew function is a piece of furniture to walk up to.
export const CLUBHOUSE_MAP = {
  tiled: true, indoor: true, W: 2000, H: 1300, scale: 0.74, spawn: { x: 1000, y: 990 }, weather: null,
  base: "clubfloor",
  ground: [{ tex: "clubwall", poly: [0, 0, 2000, 0, 2000, 410, 0, 410] }],
  water: [],
  blocks: [[0, 0, 2000, 0, 2000, 465, 0, 465]],
  objects: [
    { k: "club_rug", x: 1000, y: 930, w: 290 },
    { k: "club_notice", x: 520, y: 520 }, { k: "club_portraits", x: 1000, y: 530 }, { k: "club_trophies", x: 1480, y: 530 },
    { k: "club_desk", x: 1600, y: 920 }, { k: "club_mailbox", x: 360, y: 920 },
    { k: "club_sofa", x: 600, y: 1090 }, { k: "club_plant", x: 170, y: 540 }, { k: "club_plant", x: 1830, y: 540 }, { k: "club_plant", x: 1860, y: 1100, w: 140 },
  ],
  spots: [
    { id: "club-notice", label: "Notice Board", img: "quests", x: 520, y: 590 },
    { id: "club-portraits", label: "Member Portraits", img: "crew", x: 1000, y: 600 },
    { id: "club-trophies", label: "Trophy Shelf", img: "rankings", x: 1480, y: 600 },
    { id: "club-desk", label: "Captain's Desk · Settings", img: "settings", x: 1600, y: 980 },
    { id: "club-mail", label: "Mailbox · Join requests", img: "pass", x: 360, y: 980 },
    { id: "crew-island", label: "Back to the island", img: "map", x: 1000, y: 1065 },
  ],
  sparkle: [0, 0, 0, 0], leap: null, life: {},
};

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
    { k: "lantern", x: 980, y: 1200 }, { k: "lantern", x: 1220, y: 1200 }, { k: "lantern", x: 420, y: 600 }, { k: "lantern", x: 1780, y: 600 },
    { k: "bush", x: 700, y: 300 }, { k: "bush", x: 1500, y: 300 }, { k: "barrels", x: 400, y: 900, w: 100 }, { k: "barrels", x: 1800, y: 900, w: 100 },
  ],
  spots: [
    { id: "fish-1", fish: true, label: "West Pier", x: 840, y: 725, cast: [1000, 740] },
    { id: "fish-2", fish: true, label: "East Pier", x: 1360, y: 725, cast: [1200, 740] },
    { id: "fish-3", fish: true, label: "South Bank", x: 1100, y: 1060, cast: [1100, 900] },
    { id: "fish-4", fish: true, label: "North Bank", x: 1100, y: 390, cast: [1100, 540] },
  ],
  sparkle: [640, 440, 920, 560], leap: [700, 500, 800, 450], life: {},
};


const home = (x, y) => ({ id: "harbour", label: "Back to Harbour", img: "map", x, y });
const fish = (n, label, x, y, cast) => ({ id: `fish-${n}`, fish: true, label, x, y, cast });
const many = (k, pts, w) => pts.map(([x, y], i) => ({ k: Array.isArray(k) ? k[i % k.length] : k, x, y, ...(w ? { w } : {}) }));

// Willow River: a slow river across the middle, footbridge, a jetty and cottages on both banks.
export const WILLOW_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 340, y: 800 }, weather: "leaves", water_tex: "river",
  base: "grass",
  ground: [
    { tex: "dirt", line: [300, 780, 800, 830, 1300, 860, 1600, 950], width: 100 },
    { tex: "dirt", line: [1100, 850, 1050, 600], width: 90 },
    { tex: "dirt", line: [1600, 950, 2000, 1000, 2445, 1060], width: 90 },
    { tex: "dirt", line: [1600, 1450, 1650, 1750, 2200, 1950, 2900, 1900], width: 100 },
  ],
  water: [{ line: [-100, 1300, 500, 1150, 1000, 1350, 1600, 1200, 2200, 1400, 2700, 1250, 3300, 1350], width: 320, bankW: 80 }],
  docks: [{ poly: [2400, 1060, 2490, 1060, 2490, 1300, 2400, 1300], posts: [[2400, 1300], [2490, 1300], [2400, 1190], [2490, 1190]] }],
  bridges: [{ a: [1600, 950], b: [1600, 1450], w: 96 }],
  objects: [
    { k: "house", x: 1050, y: 540, w: 280 }, { k: "barrels", x: 1230, y: 570, w: 100 }, { k: "house", x: 2500, y: 1880, w: 280, flip: true },
    { k: "rowboat", x: 2660, y: 1330, w: 200 },
    ...many("willow", [[550, 560], [1700, 620], [2800, 650], [3000, 1000], [800, 1750], [1250, 1950], [2000, 2200], [2900, 2150]]),
    ...many("oak", [[200, 400], [1500, 300], [2300, 380], [3000, 400], [300, 2100], [1600, 2250]]),
    ...many("pine", [[800, 250], [2700, 250], [1950, 420], [3050, 1950], [500, 2250]]),
    ...many("reeds", [[700, 980], [1305, 1042], [2088, 1140], [1300, 1490], [2700, 1460]], 120),
    ...many("bush", [[1400, 700], [2100, 800], [600, 1600], [2216, 1600]]),
    { k: "lantern", x: 1485, y: 996 }, { k: "lantern", x: 1720, y: 1500 },
    { k: "rocks", x: 2150, y: 900, w: 150 }, { k: "rocks", x: 400, y: 1700, w: 150 }, { k: "rocks", x: 3050, y: 1650, w: 140 },
  ],
  spots: [
    home(240, 780),
    fish(1, "Willow Bridge", 1600, 1200, [1780, 1240]),
    fish(2, "North Bend", 1000, 1110, [1000, 1330]),
    fish(3, "Jetty End", 2445, 1280, [2540, 1400]),
    fish(4, "Gravel Run", 2900, 1510, [2900, 1300]),
    fish(5, "West Shallows", 500, 1390, [500, 1170]),
  ],
  sparkle: [0, 1000, 3200, 600], leap: [800, 1100, 2000, 350], life: {},
};

// Greyfell Lake: a deep glacial lake under the fells, boathouse jetty on the south shore.
export const GREYFELL_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 380, y: 2040 }, weather: "mist", water_tex: "lake",
  base: "moss",
  ground: [
    { tex: "dirt", line: [300, 2050, 900, 2000, 1700, 2020, 2500, 1980, 2900, 1700, 2900, 900], width: 100 },
    { tex: "dirt", line: [1700, 2020, 1700, 1640], width: 90 },
  ],
  water: [{ smooth: [800, 1000, 880, 720, 1120, 540, 1480, 470, 1850, 530, 2150, 480, 2460, 630, 2610, 900, 2540, 1220, 2280, 1430, 1950, 1510, 1700, 1530, 1400, 1480, 1100, 1380, 880, 1220], bankW: 60, bank: "rock" }],
  docks: [{ poly: [1650, 1380, 1750, 1380, 1750, 1640, 1650, 1640], posts: [[1650, 1380], [1750, 1380], [1650, 1500], [1750, 1500]] }],
  objects: [
    { k: "boathouse", x: 1300, y: 1955, w: 360 }, { k: "stone_cottage", x: 2150, y: 1940, w: 290 }, { k: "barrels", x: 1520, y: 1955, w: 100 },
    { k: "rowboat", x: 1900, y: 1440, w: 200 },
    ...many("cairn", [[1000, 300], [2300, 280], [600, 1500]]),
    ...many("pine", [[300, 300], [500, 700], [250, 1200], [2900, 300], [3050, 700], [3050, 1300], [800, 2250], [2600, 2250]]),
    { k: "rocks", x: 1100, y: 200, w: 170 }, { k: "rocks", x: 2600, y: 1450, w: 150 },
    { k: "cliff_rock", x: 2000, y: 250, w: 230 }, { k: "cliff_rock", x: 450, y: 1800, w: 200 },
    { k: "lantern", x: 1600, y: 1720 }, { k: "lantern", x: 1800, y: 1720 },
  ],
  spots: [
    home(220, 2000),
    fish(1, "Boathouse Jetty", 1700, 1400, [1700, 1150]),
    fish(2, "West Shingle", 700, 1000, [950, 1000]),
    fish(3, "East Point", 2670, 900, [2400, 900]),
    fish(4, "North Crag", 1700, 390, [1700, 650]),
  ],
  sparkle: [800, 480, 1800, 1040], leap: [1000, 600, 1400, 800], life: {},
};

// Saltmarsh Estuary: a tidal channel and a side creek, boardwalks and stilt huts.
export const SALTMARSH_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 360, y: 1500 }, weather: "gulls", water_tex: "estuary",
  base: "marsh",
  ground: [
    { tex: "planks", line: [300, 1500, 1000, 1300, 1000, 1010], width: 90 },
    { tex: "planks", line: [1000, 1300, 1700, 1500], width: 90 },
    { tex: "planks", line: [2100, 1500, 2700, 1600, 2950, 1600], width: 90 },
    { tex: "planks", line: [1000, 480, 1500, 470, 2050, 490], width: 90 },
  ],
  water: [
    { line: [-100, 600, 600, 800, 1300, 700, 2000, 1000, 2700, 900, 3300, 1100], width: 340, bankW: 80 },
    { line: [2000, 1000, 1900, 1500, 2100, 2000, 2000, 2500], width: 200, bankW: 70 },
  ],
  bridges: [{ a: [1000, 480], b: [1000, 1010], w: 96 }, { a: [1700, 1500], b: [2100, 1500], w: 96 }],
  objects: [
    { k: "stilt_hut", x: 650, y: 1340, w: 300 }, { k: "stilt_hut", x: 1800, y: 425, w: 300, flip: true }, { k: "stilt_hut", x: 2550, y: 1490, w: 300 },
    { k: "rowboat", x: 1320, y: 730, w: 200 },
    ...many("marsh_grass", [[400, 1010], [1400, 1000], [2350, 1250], [700, 2000], [1500, 2100], [2600, 2100], [1300, 300], [2500, 300], [3000, 700]]),
    ...many("reeds", [[200, 1050], [1250, 1060], [2950, 1350], [1650, 1750]], 120),
    ...many("bush", [[500, 1900], [1200, 1800], [2800, 1900], [600, 300]]),
    { k: "lantern", x: 900, y: 1070 }, { k: "lantern", x: 890, y: 430 }, { k: "lantern", x: 1660, y: 1610 }, { k: "lantern", x: 2140, y: 1610 },
  ],
  spots: [
    home(230, 1500),
    fish(1, "Channel Bridge", 1000, 745, [1200, 760]),
    fish(2, "Creek Crossing", 1900, 1500, [1975, 1700]),
    fish(3, "Mudflat Point", 2500, 1170, [2500, 950]),
    fish(4, "North Reach", 1600, 590, [1600, 820]),
    fish(5, "Creek Mouth", 1930, 2000, [2100, 2000]),
  ],
  sparkle: [0, 500, 3200, 700], leap: [1100, 600, 1600, 400], life: {},
};

// Harrow Point: wind-beaten cliffs, a lighthouse headland and a sea pier.
export const HARROW_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 340, y: 1000 }, weather: "spray", water_tex: "lake",
  base: "grass",
  ground: [
    { tex: "rock", smooth: [1900, 1150, 2400, 1050, 2800, 1250, 2500, 1500, 2000, 1450] },
    { tex: "dirt", line: [300, 1000, 900, 1100, 1500, 1150, 2000, 1300, 2300, 1430], width: 100 },
    { tex: "dirt", line: [1500, 1150, 1250, 1550, 1200, 1830], width: 90 },
  ],
  water: [{ smooth: [2400, -200, 3500, -200, 3500, 2700, -200, 2700, -200, 1900, 600, 1850, 1200, 1950, 1700, 1800, 2000, 1550, 2600, 1600, 2900, 1350, 2700, 1050, 2300, 950, 2350, 500, 2450, 0], bankW: 90, bank: "rock" }],
  docks: [{ poly: [1150, 1820, 1250, 1820, 1250, 2250, 1150, 2250], posts: [[1150, 2250], [1250, 2250], [1150, 2050], [1250, 2050]] }],
  objects: [
    { k: "lighthouse", x: 2500, y: 1360, w: 250 }, { k: "coast_hut", x: 1000, y: 1045, w: 300 },
    { k: "charter_boat", x: 1760, y: 2260, w: 460 },
    { k: "cliff_rock", x: 600, y: 500 }, { k: "cliff_rock", x: 1700, y: 400 }, { k: "cliff_rock", x: 1600, y: 1650, w: 220 }, { k: "cliff_rock", x: 2050, y: 700, w: 220 },
    { k: "rocks", x: 400, y: 1500, w: 160 }, { k: "rocks", x: 1900, y: 1000, w: 150 },
    ...many("pine", [[300, 300], [800, 250], [1400, 300], [2000, 250]]),
    ...many("bush", [[700, 1300], [1700, 1350], [300, 1600]]),
    { k: "lantern", x: 1080, y: 1790 },
  ],
  spots: [
    home(220, 1000),
    fish(1, "Harrow Pier", 1200, 2230, [1350, 2160]),
    fish(2, "Lighthouse Point", 2790, 1350, [3050, 1350]),
    fish(3, "Kelp Gully", 600, 1760, [600, 2050]),
    fish(4, "North Rocks", 2230, 800, [2500, 800]),
    fish(5, "Breaker Ledge", 2300, 1490, [2300, 1750]),
  ],
  sparkle: [0, 1800, 3200, 600], leap: [2400, 1500, 700, 700], life: {},
};

// Coral Shoals: a sandy reef island with a palm-grove heart, dive shop and a reef pier.
export const CORAL_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 1600, y: 1900 }, weather: "bubbles", water_tex: "lagoon",
  base: "sand",
  ground: [
    { tex: "jungle", smooth: [900, 700, 1800, 600, 2500, 900, 2400, 1400, 1600, 1550, 900, 1400] },
    { tex: "planks", line: [1600, 1990, 1600, 1700], width: 90 },
    { tex: "planks", line: [900, 1700, 2400, 1700], width: 90 },
  ],
  water: [{ invert: [420, 560, 800, 380, 1250, 330, 1700, 390, 2150, 320, 2600, 480, 2950, 760, 3010, 1150, 2850, 1550, 2650, 1880, 2200, 2020, 1750, 2110, 1300, 2030, 850, 2060, 450, 1800, 280, 1450, 300, 1000], bankW: 60 }],
  docks: [{ poly: [1550, 1980, 1650, 1980, 1650, 2330, 1550, 2330], posts: [[1550, 2330], [1650, 2330], [1550, 2180], [1650, 2180]] }],
  objects: [
    { k: "beach_hut", x: 1250, y: 1650, w: 330 }, { k: "beach_hut", x: 2050, y: 1650, w: 330, flip: true },
    { k: "parasol", x: 1000, y: 1850 }, { k: "parasol", x: 2250, y: 1850 },
    { k: "rowboat", x: 1370, y: 2250, w: 200 },
    ...many("palm", [[600, 900], [1100, 650], [1500, 520], [2000, 520], [2500, 800], [2700, 1300], [500, 1300], [2550, 1650]]),
    ...many("jungle_tree", [[1500, 1100], [1900, 1000], [1200, 1000]]),
    ...many("bush", [[2200, 1250], [1000, 1250], [1750, 1350]]),
    { k: "lantern", x: 1480, y: 1940 },
  ],
  spots: [
    home(1720, 1900),
    fish(1, "Reef Pier", 1600, 2310, [1800, 2250]),
    fish(2, "West Flats", 360, 1200, [130, 1200]),
    fish(3, "Turtle Point", 2870, 1300, [3110, 1300]),
    fish(4, "North Drop-off", 1700, 470, [1700, 200]),
  ],
  sparkle: [0, 0, 3200, 2400], leap: [200, 1950, 2800, 400], life: {},
};

// Blackwater Mangroves: two dark channels split the land into three banks joined by root bridges.
export const BLACKWATER_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 360, y: 430 }, weather: "fireflies", water_tex: "swamp",
  base: "mud",
  ground: [
    { tex: "dirt", line: [300, 420, 700, 520, 700, 690], width: 90 },
    { tex: "dirt", line: [700, 520, 1500, 420, 2300, 450, 2700, 520, 2700, 600], width: 90 },
    { tex: "dirt", line: [700, 1110, 800, 1350, 1300, 1450, 1300, 1570], width: 90 },
    { tex: "dirt", line: [2700, 1010, 2600, 1400, 2300, 1700, 2500, 2100], width: 90 },
    { tex: "dirt", line: [2600, 1400, 2950, 1480], width: 80 },
    { tex: "dirt", line: [1300, 2030, 1000, 2200, 500, 2150], width: 90 },
  ],
  water: [
    { line: [-100, 700, 700, 900, 1400, 700, 2100, 1000, 2700, 800, 3300, 950], width: 260, bankW: 60, bank: "dirt" },
    { line: [2100, 1000, 1900, 1500, 1300, 1800, 700, 1700, -100, 1900], width: 240, bankW: 60, bank: "dirt" },
  ],
  bridges: [{ a: [700, 690], b: [700, 1110], w: 96 }, { a: [1300, 1570], b: [1300, 2030], w: 96 }, { a: [2700, 600], b: [2700, 1010], w: 96 }],
  objects: [
    { k: "swamp_shack", x: 1150, y: 1320, w: 300 }, { k: "swamp_shack", x: 2950, y: 1400, w: 300, flip: true },
    { k: "rowboat", x: 1050, y: 810, w: 190 },
    ...many("mangrove", [[300, 1300], [1600, 1350], [2000, 200], [1100, 250], [2900, 300], [500, 2260], [2900, 2000], [2050, 2200]]),
    ...many("ghost_tree", [[1900, 300], [250, 2150]]),
    ...many("reeds", [[412, 1030], [1700, 590], [2400, 1160], [985, 1574]], 120),
    { k: "lantern", x: 600, y: 640 }, { k: "lantern", x: 810, y: 1150 }, { k: "lantern", x: 2590, y: 1060 },
  ],
  spots: [
    home(230, 420),
    fish(1, "Root Bridge", 700, 900, [900, 860]),
    fish(2, "Junction Pool", 1750, 1250, [1990, 1250]),
    fish(3, "Black Bend", 2300, 1160, [2300, 950]),
    fish(4, "Heron Bank", 700, 1900, [700, 1700]),
    fish(5, "North Shallows", 1500, 520, [1500, 720]),
  ],
  sparkle: [0, 500, 3200, 1500], leap: [800, 600, 1600, 600], life: {},
};

// The Frozen Reach: a frozen bay you can walk on, fishing holes cut through the ice, open sea to the north.
const hole = (x, y) => ({ circle: [x, y, 70, 40], bankW: 14, bank: "snow" });
export const FROZEN_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 420, y: 2100 }, weather: "snow", water_tex: "lake",
  base: "snow",
  ground: [{ tex: "ice", smooth: [600, 500, 1800, 350, 2800, 600, 2900, 1400, 2200, 1900, 1000, 1850, 500, 1300] }],
  water: [
    { smooth: [-200, -200, 3400, -200, 3400, 250, 2400, 300, 1600, 220, 800, 300, -200, 250], bankW: 50, bank: "ice" },
    hole(1100, 900), hole(1700, 700), hole(2300, 1000), hole(1500, 1400), hole(2400, 1550),
  ],
  objects: [
    { k: "ice_shack", x: 1330, y: 960 }, { k: "ice_shack", x: 1950, y: 760 }, { k: "ice_shack", x: 2580, y: 1060, flip: true }, { k: "ice_shack", x: 1250, y: 1460 },
    ...many("snow_pine", [[200, 500], [400, 900], [250, 1400], [500, 1800], [3000, 500], [3050, 1000], [3000, 1700], [2700, 2100], [1800, 2200], [1000, 2200]]),
    { k: "snowman", x: 560, y: 2050 }, { k: "cairn", x: 2900, y: 2150 },
  ],
  spots: [
    home(300, 2100),
    fish(1, "Hole One", 1100, 985, [1100, 900]),
    fish(2, "Shack Hole", 1700, 785, [1700, 700]),
    fish(3, "Deep Hole", 2300, 1085, [2300, 1000]),
    fish(4, "South Hole", 1500, 1485, [1500, 1400]),
    fish(5, "Far Hole", 2400, 1635, [2400, 1550]),
    fish(6, "Floe Edge", 2000, 390, [2000, 140]),
  ],
  sparkle: [0, 0, 3200, 300], leap: [0, 0, 3200, 260], life: {},
};

// The Sunken Deep: a lone rock in the open ocean with a research station and charter pier.
export const SUNKEN_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 2150, y: 1300 }, weather: "stars", water_tex: "deep",
  base: "rock",
  ground: [
    { tex: "planks", line: [1500, 1210, 1500, 1650], width: 90 },
    { tex: "planks", line: [1500, 1300, 2000, 1220, 2400, 1205], width: 90 },
  ],
  water: [{ invert: [700, 820, 1000, 680, 1450, 640, 1850, 700, 2250, 780, 2480, 1000, 2500, 1300, 2250, 1560, 1900, 1700, 1500, 1760, 1100, 1700, 760, 1530, 600, 1250], bankW: 60, bank: "sand" }],
  docks: [
    { poly: [2380, 1150, 3050, 1150, 3050, 1260, 2380, 1260], posts: posts(2560, 3050, 1265, 160) },
    { poly: [1450, 1650, 1550, 1650, 1550, 2150, 1450, 2150], posts: [[1450, 2150], [1550, 2150], [1450, 1950], [1550, 1950]] },
  ],
  objects: [
    { k: "research_hut", x: 1500, y: 1150 }, { k: "barrels", x: 2300, y: 1120, w: 100 },
    { k: "charter_boat", x: 2760, y: 1130 }, { k: "charter_boat", x: 500, y: 2000, w: 460, flip: true },
    { k: "cliff_rock", x: 900, y: 1000, w: 220 }, { k: "cliff_rock", x: 2100, y: 900, w: 220 },
    { k: "rocks", x: 1000, y: 1500, w: 150 }, { k: "rocks", x: 2000, y: 1550, w: 150 }, { k: "bush", x: 1200, y: 1300 },
    { k: "lantern", x: 2340, y: 1320 }, { k: "lantern", x: 1380, y: 1600 },
  ],
  spots: [
    { ...home(2250, 1300), label: "Boat to Harbour" },
    fish(1, "Charter Pier End", 3030, 1205, [3100, 1400]),
    fish(2, "South Jetty", 1500, 2130, [1500, 2300]),
    fish(3, "West Rocks", 730, 1100, [450, 1100]),
    fish(4, "North Ledge", 1500, 740, [1500, 450]),
  ],
  sparkle: [0, 0, 3200, 2400], leap: [100, 100, 3000, 2200], life: {},
};

// Ghostlight Cavern: an underground lake lit by glowing fungus, crossed by a long causeway.
export const GHOSTLIGHT_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 420, y: 2100 }, weather: "fireflies", water_tex: "cavewater",
  base: "cave",
  ground: [
    { tex: "dirt", line: [400, 2100, 1000, 2050, 1600, 1960], width: 100 },
    { tex: "dirt", line: [1600, 420, 2200, 300, 2800, 350], width: 90 },
  ],
  water: [{ smooth: [800, 600, 1600, 500, 2500, 700, 2700, 1300, 2200, 1800, 1300, 1850, 700, 1400], bankW: 50, bank: "rock" }],
  bridges: [{ a: [1600, 1960], b: [1600, 420], w: 96 }],
  objects: [
    { k: "cave_camp", x: 900, y: 1985 },
    ...many("glow_shroom", [[500, 600], [300, 1300], [1100, 2250], [2400, 2000], [2900, 1800], [3000, 700], [2200, 200]]),
    ...many("stalagmite", [[200, 400], [1000, 300], [2900, 300], [3000, 1200], [2600, 2200], [200, 1700]]),
    ...many("crystal", [[1300, 2200], [2800, 1600], [700, 300]]),
    { k: "lantern", x: 1700, y: 2010 }, { k: "lantern", x: 1490, y: 400 },
  ],
  spots: [
    home(300, 2100),
    fish(1, "Causeway", 1600, 1150, [1850, 1150]),
    fish(2, "Glow Shore", 590, 1000, [850, 1000]),
    fish(3, "East Grotto", 2790, 1300, [2500, 1300]),
    fish(4, "Crystal Beach", 2100, 1900, [2100, 1650]),
  ],
  sparkle: [700, 500, 2000, 1350], leap: [900, 700, 1600, 900], life: {},
};

// The Drowned Temple: a jungle temple whose stone plaza steps down into a jade lake.
export const TEMPLE_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 340, y: 610 }, weather: "leaves", water_tex: "jade",
  base: "jungle",
  ground: [
    { tex: "flag", circle: [1600, 900, 420, 120] },
    { tex: "flag", line: [300, 600, 800, 680, 1190, 880], width: 100 },
    { tex: "flag", line: [2010, 880, 2400, 680, 2900, 600], width: 100 },
  ],
  water: [{ smooth: [520, 1250, 850, 1080, 1200, 1030, 1600, 990, 2000, 1030, 2350, 1060, 2700, 1250, 2820, 1550, 2700, 1850, 2350, 2080, 1900, 2150, 1400, 2120, 950, 2080, 600, 1880, 470, 1550], bankW: 60, bank: "flag" }],
  docks: [{ poly: [1550, 1850, 1650, 1850, 1650, 2250, 1550, 2250], posts: [[1550, 1850], [1650, 1850], [1550, 1990], [1650, 1990]] }],
  objects: [
    { k: "temple", x: 1600, y: 760 }, { k: "pillar", x: 1150, y: 760 }, { k: "pillar", x: 2050, y: 760 },
    { k: "statue", x: 2900, y: 1100 }, { k: "statue", x: 400, y: 1000 },
    ...many("jungle_tree", [[130, 480], [700, 500], [2500, 500], [3060, 480], [250, 1500], [200, 2050], [3000, 1500], [3000, 2100]]),
    ...many("bush", [[1000, 550], [2200, 550], [2600, 2300], [1000, 2310]]),
  ],
  spots: [
    home(220, 600),
    fish(1, "Temple Steps", 1600, 935, [1600, 1200]),
    fish(2, "West Koi Pool", 380, 1500, [650, 1500]),
    fish(3, "East Bank", 2880, 1500, [2600, 1500]),
    fish(4, "Jade Pier", 1600, 1870, [1600, 1650]),
  ],
  sparkle: [500, 1000, 2300, 1150], leap: [600, 1100, 2100, 1000], life: {},
};

// The Cinder Trench: a black basalt coast over glowing vents, two piers and a monitoring outpost.
export const CINDER_MAP = {
  tiled: true, W: 3200, H: 2400, scale: 0.74, spawn: { x: 360, y: 710 }, weather: "embers", water_tex: "vent",
  base: "ash",
  ground: [
    { tex: "rock", line: [300, 700, 900, 900, 1000, 1450], width: 100 },
    { tex: "rock", line: [900, 900, 1700, 800, 2300, 600, 2550, 500], width: 90 },
  ],
  water: [{ smooth: [-200, 1500, 300, 1470, 700, 1430, 1000, 1540, 1300, 1600, 1700, 1530, 2000, 1380, 2250, 1150, 2380, 900, 2620, 700, 2650, 420, 2780, 150, 2800, -200, 3400, -200, 3400, 2600, -200, 2600], bankW: 70, bank: "ash" }],
  docks: [
    { poly: [950, 1450, 1050, 1450, 1050, 1900, 950, 1900], posts: [[950, 1900], [1050, 1900], [950, 1720], [1050, 1720]] },
    { poly: [2550, 450, 2950, 450, 2950, 550, 2550, 550], posts: [[2950, 450], [2950, 550], [2800, 555]] },
  ],
  objects: [
    { k: "vent_hut", x: 1300, y: 780 },
    ...many("basalt", [[500, 1200], [1500, 1200], [2000, 1000], [700, 300], [1900, 300]]),
    ...many("dead_tree", [[300, 1100], [1100, 300], [2100, 200], [400, 400], [1750, 1150]]),
    { k: "cliff_rock", x: 1700, y: 450, w: 220 },
    { k: "lantern", x: 870, y: 1430 },
  ],
  spots: [
    home(230, 700),
    fish(1, "Vent Pier", 1000, 1880, [1000, 2150]),
    fish(2, "Ember Jetty", 2930, 500, [3050, 700]),
    fish(3, "Obsidian Shore", 1600, 1470, [1600, 1750]),
    fish(4, "Ash Point", 2250, 960, [2500, 1000]),
    fish(5, "Black Sand", 300, 1390, [300, 1700]),
  ],
  sparkle: [0, 1500, 3200, 900], leap: [200, 1700, 2800, 600], life: {},
};

export const TILED = {
  harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP, crew_island: CREW_ISLAND_MAP, clubhouse: CLUBHOUSE_MAP, duel_pier: DUEL_MAP,
  willow: WILLOW_MAP, greyfell: GREYFELL_MAP, saltmarsh: SALTMARSH_MAP, harrow: HARROW_MAP, coral: CORAL_MAP, blackwater: BLACKWATER_MAP,
  frozen: FROZEN_MAP, sunken: SUNKEN_MAP, ghostlight: GHOSTLIGHT_MAP, temple: TEMPLE_MAP, cinder: CINDER_MAP,
};
