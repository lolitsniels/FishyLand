// Big explorable tile maps: painted ground layers + placed objects. Coordinates are world px.
const posts = (x0, x1, y, step = 140) => { const o = []; for (let x = x0; x <= x1; x += step) o.push([x, y]); return o; };

export const HARBOUR_MAP = {
  tiled: true, W: 3600, H: 2400, scale: 0.74, spawn: { x: 1500, y: 1400 }, weather: "gulls",
  base: "grass",
  ground: [
    { tex: "cobble", smooth: [1030, 900, 1500, 830, 1970, 900, 2170, 1150, 1970, 1430, 1500, 1510, 1030, 1430, 860, 1150] },
    { tex: "cobble", line: [1720, 880, 1760, 600, 1740, 250], width: 120 },
    { tex: "cobble", line: [900, 1160, 600, 1190, 300, 1260, 120, 1320], width: 110 },
    { tex: "cobble", line: [2100, 1160, 2400, 1160, 2650, 1160], width: 130 },
    { tex: "cobble", line: [1380, 1480, 1260, 1760, 1180, 2000], width: 110 },
    { tex: "cobble", line: [2050, 1350, 2120, 1560], width: 100 },
  ],
  water: [{ smooth: [2760, -200, 3800, -200, 3800, 2600, -200, 2600, -200, 2160, 500, 2090, 1000, 2140, 1600, 2070, 2200, 1960, 2560, 1700, 2710, 1300, 2660, 800, 2730, 300], bankW: 110 }],
  docks: [
    { poly: [2560, 1090, 3300, 1090, 3300, 1235, 2560, 1235], posts: [...posts(2700, 3300, 1240), ...posts(2840, 3300, 1088)] },
    { poly: [1105, 1985, 1255, 1985, 1255, 2335, 1105, 2335], posts: [[1105, 2335], [1255, 2335], [1105, 2200], [1255, 2200]] },
  ],
  objects: [
    { k: "tackle_shop", x: 1080, y: 860 }, { k: "market_stall", x: 1460, y: 770 }, { k: "guild_hall", x: 1990, y: 870 },
    { k: "fountain", x: 1500, y: 1215 }, { k: "quest_board", x: 1810, y: 1200 }, { k: "quest_board", x: 1180, y: 1330, w: 130 },
    { k: "pearl_shop", x: 2130, y: 1520, w: 360 }, { k: "tavern", x: 930, y: 1570, w: 420 }, { k: "bait_hut", x: 450, y: 1030, w: 360 },
    { k: "house", x: 700, y: 720 }, { k: "house", x: 2380, y: 680, flip: true }, { k: "house", x: 420, y: 1720, w: 280, flip: true }, { k: "house", x: 1250, y: 470, w: 260 },
    { k: "ship", x: 3020, y: 1086, w: 640, z: -400 }, { k: "rowboat", x: 1420, y: 2300, w: 220 },
    { k: "lantern", x: 1250, y: 1010 }, { k: "lantern", x: 1760, y: 1010 }, { k: "lantern", x: 1250, y: 1430 }, { k: "lantern", x: 1760, y: 1440 },
    { k: "lantern", x: 2700, y: 1100 }, { k: "lantern", x: 2980, y: 1100 }, { k: "lantern", x: 3260, y: 1100 }, { k: "lantern", x: 1690, y: 560 },
    { k: "lantern", x: 720, y: 1140 }, { k: "lantern", x: 1290, y: 1990 },
    { k: "barrels", x: 1300, y: 870 }, { k: "barrels", x: 2250, y: 890 }, { k: "barrels", x: 2620, y: 1232, w: 110 }, { k: "barrels", x: 740, y: 1600 },
    { k: "oak", x: 220, y: 300 }, { k: "oak", x: 520, y: 230 }, { k: "oak", x: 900, y: 300 }, { k: "oak", x: 2080, y: 280 }, { k: "oak", x: 2420, y: 330 },
    { k: "oak", x: 160, y: 1560 }, { k: "oak", x: 2350, y: 1820, w: 260 },
    { k: "pine", x: 320, y: 560 }, { k: "pine", x: 140, y: 820 }, { k: "pine", x: 1000, y: 470 }, { k: "pine", x: 1540, y: 330 }, { k: "pine", x: 2580, y: 190 }, { k: "pine", x: 250, y: 1950 },
    { k: "bush", x: 1160, y: 1040 }, { k: "bush", x: 1860, y: 1040 }, { k: "bush", x: 1330, y: 1500 }, { k: "bush", x: 1680, y: 1500 }, { k: "bush", x: 610, y: 1050 }, { k: "bush", x: 2300, y: 1450 },
    { k: "rocks", x: 2600, y: 520 }, { k: "rocks", x: 2520, y: 1820, w: 160 }, { k: "rocks", x: 760, y: 2060, w: 150 },
  ],
  spots: [
    { id: "shop", label: "Tackle Shop", img: "bait", x: 1080, y: 905 },
    { id: "market", label: "Market", img: "market", x: 1460, y: 810 },
    { id: "crews", label: "Guild Hall", img: "crew", x: 1990, y: 915 },
    { id: "leaderboards", label: "Fountain of Fame", img: "rankings", x: 1500, y: 1260 },
    { id: "quests", label: "Quest Board", img: "quests", x: 1810, y: 1240 },
    { id: "tournaments", label: "Tournaments", img: "rankings", x: 1180, y: 1370 },
    { id: "pearl-shop", label: "Pearl Shop", img: "pass", x: 2130, y: 1565 },
    { id: "contracts", label: "Anchor Tavern · Contracts", img: "daily", x: 930, y: 1615 },
    { id: "crafting", label: "Bait Hut · Crafting", img: "craft", x: 450, y: 1075 },
    { id: "almanac", label: "Old Salt's Almanac", img: "fishdex", x: 640, y: 1290 },
    { id: "achievements", label: "Achievements", img: "skills", x: 2260, y: 1020 },
    { id: "boat", label: "Sea Serpent · Travel", img: "map", x: 3120, y: 1165 },
    { id: "duel", label: "Duel Pier", img: "guild", x: 1180, y: 2280 },
  ],
  sparkle: [2700, 0, 900, 2400], leap: [2800, 1350, 700, 900],
  life: { rings: [[2700, 1250], [2980, 1250], [3260, 1250], [3300, 1095], [1105, 2345], [1255, 2345], [2760, 1060], [3260, 1070]] },
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
  walkways: [{ line: [1212, 1200, 1788, 943], width: 76 }],
  objects: [
    { k: "bridge", x: 1500, y: 1264, w: 640 },
    { k: "house", x: 520, y: 930, w: 300 }, { k: "barrels", x: 700, y: 950, w: 110 }, { k: "house", x: 2420, y: 360, w: 280, flip: true },
    { k: "rowboat", x: 930, y: 1890, w: 200 },
    { k: "reeds", x: 410, y: 1730, w: 130 }, { k: "reeds", x: 1000, y: 1720, w: 130 }, { k: "reeds", x: 560, y: 2030, w: 120 },
    { k: "reeds", x: 1170, y: 990, w: 120 }, { k: "reeds", x: 1950, y: 1290, w: 120 }, { k: "reeds", x: 2380, y: 1960, w: 120 }, { k: "reeds", x: 840, y: 420, w: 120 },
    { k: "willow", x: 1080, y: 1060 }, { k: "willow", x: 1880, y: 1560 }, { k: "willow", x: 980, y: 400 }, { k: "willow", x: 2520, y: 1800 },
    { k: "oak", x: 200, y: 350 }, { k: "oak", x: 230, y: 1700 }, { k: "oak", x: 1500, y: 1900 }, { k: "oak", x: 2900, y: 700 }, { k: "oak", x: 2950, y: 1500 }, { k: "oak", x: 1750, y: 420 },
    { k: "pine", x: 140, y: 800 }, { k: "pine", x: 1300, y: 2250 }, { k: "pine", x: 3050, y: 1100 }, { k: "pine", x: 2700, y: 300 }, { k: "pine", x: 1900, y: 2200 },
    { k: "rocks", x: 2650, y: 1000, w: 170 }, { k: "rocks", x: 380, y: 540, w: 150 }, { k: "rocks", x: 1200, y: 1650, w: 140 },
    { k: "bush", x: 900, y: 1300 }, { k: "bush", x: 2150, y: 800 }, { k: "bush", x: 2600, y: 1300 }, { k: "bush", x: 300, y: 1450 },
    { k: "lantern", x: 1170, y: 1270 }, { k: "lantern", x: 1830, y: 900 }, { k: "lantern", x: 600, y: 1450 },
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

export const TILED = { harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP };
