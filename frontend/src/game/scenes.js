// Per-location layout: background art, walkable floor, animated water, signposts, fishing spots and weather.
const HARBOUR = {
  bg: "art/harbour.jpg",
  scale: 0.6,
  spawn: { x: 450, y: 620 },
  walk: [20, 520, 150, 500, 250, 462, 420, 432, 600, 455, 800, 482, 900, 392, 995, 392, 1000, 610, 820, 612, 770, 650, 740, 848, 120, 848, 20, 760],
  water: [[800, 650, 1000, 625, 1170, 685, 1264, 620, 1264, 848, 820, 848], [1225, 300, 1264, 300, 1264, 620, 1232, 620]],
  falls: [], mist: [],
  sparkle: [800, 620, 464, 228],
  leap: [830, 680, 360, 130],
  weather: "gulls",
  spots: [
    { id: "shop", label: "Tackle Shop", img: "bait", x: 170, y: 505 },
    { id: "market", label: "Market", img: "market", x: 360, y: 470 },
    { id: "crews", label: "Guild Hall", img: "crew", x: 600, y: 468 },
    { id: "quests", label: "Quest Board", img: "quests", x: 748, y: 492 },
    { id: "boat", label: "Sea Serpent · Travel", img: "rod", x: 985, y: 520 },
    { id: "pearl-shop", label: "Pearl Shop", img: "pass", x: 200, y: 625 },
    { id: "tournaments", label: "Tournaments", img: "rankings", x: 400, y: 722 },
    { id: "duel", label: "Duel Pier", img: "guild", x: 875, y: 590 },
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
