// Per-location layout: background art, walkable floor, animated water, signposts, fishing spots and weather.
// The harbour is two screens wide: the original docks (shifted right by X0) plus a new west quarter.
const X0 = 1264;
const sx = (pts) => pts.map((v, i) => (i % 2 ? v : v + X0));
const HARBOUR = {
  bg: "art/harbour_wide.jpg",
  scale: 0.6,
  spawn: { x: 1700, y: 620 },
  walk: [
    20, 600, 60, 500, 200, 480, 310, 470, 440, 472, 600, 488, 740, 470, 900, 458, 1000, 468, 1100, 505, 1210, 505, 1240, 485, 1300, 505,
    ...sx([150, 500, 250, 462, 420, 432, 600, 455, 800, 482, 900, 392, 995, 392, 1000, 610, 820, 612, 770, 650, 740, 800]),
    1440, 800, 760, 800, 720, 762, 520, 762, 480, 800, 380, 800, 330, 760, 300, 740, 150, 700, 60, 650,
  ],
  water: [sx([800, 650, 1000, 625, 1170, 685, 1264, 620, 1264, 848, 820, 848]), sx([1225, 300, 1264, 300, 1264, 620, 1232, 620]), [0, 715, 150, 760, 300, 848, 0, 848], [0, 250, 120, 250, 190, 330, 0, 330]],
  falls: [], mist: [],
  sparkle: [X0 + 800, 620, 464, 228],
  leap: [X0 + 830, 680, 360, 130],
  weather: "gulls",
  spots: [
    { id: "shop", label: "Tackle Shop", img: "bait", x: X0 + 170, y: 505 },
    { id: "market", label: "Market", img: "market", x: X0 + 360, y: 470 },
    { id: "crews", label: "Guild Hall", img: "crew", x: X0 + 600, y: 468 },
    { id: "quests", label: "Quest Board", img: "quests", x: X0 + 748, y: 492 },
    { id: "boat", label: "Sea Serpent · Travel", img: "map", x: X0 + 985, y: 520 },
    { id: "pearl-shop", label: "Pearl Shop", img: "pass", x: X0 + 200, y: 625 },
    { id: "tournaments", label: "Tournaments", img: "rankings", x: X0 + 400, y: 722 },
    { id: "duel", label: "Duel Pier", img: "guild", x: X0 + 875, y: 590 },
    { id: "contracts", label: "Anchor Tavern · Contracts", img: "daily", x: 1060, y: 500 },
    { id: "leaderboards", label: "Fountain of Fame", img: "rankings", x: 800, y: 510 },
    { id: "achievements", label: "Achievements", img: "skills", x: 600, y: 520 },
    { id: "crafting", label: "Bait Hut · Crafting", img: "craft", x: 390, y: 500 },
    { id: "almanac", label: "Old Salt's Almanac", img: "fishdex", x: 200, y: 630 },
  ],
};

const PIER = {
  scale: 1,
  spawn: { x: 360, y: 610 },
  walk: [170, 600, 300, 480, 540, 465, 610, 560, 560, 650, 470, 705, 330, 705, 210, 665],
  water: [[0, 330, 1264, 330, 1264, 848, 650, 848, 650, 560, 570, 450, 300, 430, 150, 480, 0, 560]],
  falls: [], mist: [],
  sparkle: [660, 340, 580, 480],
  leap: [700, 420, 420, 320],
  spots: [
    { id: "harbour", label: "Back to Harbour", img: "crew", x: 230, y: 610 },
    { id: "fish-1", fish: true, label: "Fishing Spot", x: 545, y: 508 },
    { id: "fish-2", fish: true, label: "Fishing Spot", x: 575, y: 585 },
    { id: "fish-3", fish: true, label: "Fishing Spot", x: 470, y: 668 },
  ],
};

const WEATHER = {
  millbrook: "petals", willow: "leaves", greyfell: "mist", saltmarsh: "gulls", harrow: "spray", coral: "bubbles",
  blackwater: "fireflies", frozen: "snow", sunken: "stars", ghostlight: "fireflies", temple: "leaves", cinder: "embers",
};

export const sceneFor = (key) => (key === "harbour" ? HARBOUR : { ...PIER, bg: `art/waters/${key}.jpg`, weather: WEATHER[key] || "petals" });

export const inPoly = (x, y, p) => {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c;
  }
  return c;
};
