def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'

# --- Scene: species-true leaping fish that only jump in open water; map build cache
patch(F + 'game/Scene.js', [
    ('''    if (jumpAt <= 0 && !ambient && tex.ambient) {
      const s = new Sprite(tex.ambient);
      s.anchor.set(0.5); s.scale.set(34 / tex.ambient.width); s.alpha = 0.9;
      const [lx, ly, lw, lh] = cfg.leap;
      let x = lx + Math.random() * lw, y = ly + Math.random() * lh;
      for (let i = 0; tm && i < 12 && !tm.nav.isWater(x, y); i++) { x = lx + Math.random() * lw; y = ly + Math.random() * lh; }
      if (tm && !tm.nav.isWater(x, y)) { jumpAt = 1; s.destroy(); } else {
      ambient = { s, x, y, t: 0, dir: Math.random() > 0.5 ? 1 : -1 };''', '''    const leapT = tm ? leapTex[Math.floor(Math.random() * leapTex.length)] : tex.ambient;
    if (jumpAt <= 0 && !ambient && leapT && cfg.leap) {
      const s = new Sprite(leapT);
      s.anchor.set(0.5); s.scale.set(34 / leapT.width); s.alpha = 0.9;
      const [lx, ly, lw, lh] = cfg.leap, dir = Math.random() > 0.5 ? 1 : -1;
      // the whole arc must be over open water: never from grass, never over a bridge or pier
      const open = (x, y) => !tm || [0, 0.25, 0.5, 0.75, 1].every((k) => tm.nav.isWater(x + k * 50 * dir, y) && !tm.nav.walk(x + k * 50 * dir, y) && !tm.nav.walk(x + k * 50 * dir, y - 45) && tm.nav.isWater(x + k * 50 * dir, y + 20));
      let x = lx + Math.random() * lw, y = ly + Math.random() * lh;
      for (let i = 0; i < 20 && !open(x, y); i++) { x = lx + Math.random() * lw; y = ly + Math.random() * lh; }
      if (!open(x, y)) { jumpAt = 1; s.destroy(); } else {
      ambient = { s, x, y, t: 0, dir };'''),
    ('  const objViews = tm ? placeObjects(tm.objects, mt.obj, groundLayer, actors) : [];', '''  const objViews = tm ? placeObjects(tm.objects, mt.obj, groundLayer, actors) : [];
  const leapTex = [];
  if (tm) [...new Set(fx.leapArt || [])].slice(0, 8).forEach((u) => Assets.load(u).then((t) => leapTex.push(t)).catch(() => {}));'''),
    ('  const tm = cfg.tiled ? buildMap(cfg, mt.img) : null;', '  const tm = cfg.tiled ? (MAP_CACHE.get(key) || MAP_CACHE.set(key, buildMap(cfg, mt.img)).get(key)) : null;'),
    ('const TEX_KEYS = [', 'const MAP_CACHE = new Map();\nconst TEX_KEYS = ['),
])

# --- tilemap: even-odd fills (islands), shadows under all ground first, props never on bridges/piers
s = open(F + 'game/tilemap.js').read()
s = s.replace('''const shape = (ctx, s) => (s.line ? smoothLine(ctx, s.line) : s.smooth ? smoothPoly(ctx, s.smooth) :''', '''const shape = (ctx, s) => (s.invert ? (smoothPoly(ctx, s.invert), ctx.rect(-5000, -5000, 20000, 20000)) : s.line ? smoothLine(ctx, s.line) : s.smooth ? smoothPoly(ctx, s.smooth) :''')
s = s.replace('const paint = (ctx, s) => { shape(ctx, s); if (s.line) { ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); } else ctx.fill(); };', 'const paint = (ctx, s) => { shape(ctx, s); if (s.line) { ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); } else ctx.fill("evenodd"); };')
old = '''  for (const s of map.ground || []) {
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = "rgba(30,22,10,.22)"; ctx.filter = "blur(6px)"; ctx.translate(0, 6);
    if (s.line) { shape(ctx, s); ctx.lineWidth = s.width + 10; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(); } else { shape(ctx, s); ctx.lineWidth = 10; ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = ctx.strokeStyle = pattern(ctx, img[s.tex], TEX_K[s.tex]); paint(ctx, s);
  }'''
assert old in s
s = s.replace(old, '''  // soft edge shadow for every ground shape first, then all fills, so overlapping paths merge without seams
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = "rgba(30,22,10,.22)"; ctx.filter = "blur(6px)"; ctx.translate(0, 6);
  for (const s of map.ground || []) { if (s.line) { shape(ctx, s); ctx.lineWidth = s.width + 10; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(); } else { shape(ctx, s); ctx.lineWidth = 10; ctx.fill(); ctx.stroke(); } }
  ctx.restore();
  for (const s of map.ground || []) { ctx.fillStyle = ctx.strokeStyle = pattern(ctx, img[s.tex], TEX_K[s.tex]); paint(ctx, s); }''')
s = s.replace('for (const s of map.water) { shape(g, s); if (s.line) { g.lineWidth = s.width + 30; g.stroke(); } else { g.lineWidth = 30; g.fill(); g.stroke(); } }', 'for (const s of map.water) { shape(g, s); if (s.line) { g.lineWidth = s.width + 30; g.stroke(); } else { g.lineWidth = 30; g.fill("evenodd"); if (!s.invert) g.stroke(); } }')
s = s.replace('''    const dry = (x, y) =>''', '''    const deck = (x, y) => (map.docks || []).some((d) => { const xs = d.poly.filter((_, i) => i % 2 === 0), ys = d.poly.filter((_, i) => i % 2); return x > Math.min(...xs) - 30 && x < Math.max(...xs) + 30 && y > Math.min(...ys) - 30 && y < Math.max(...ys) + 40; })
      || (map.bridges || []).some((b) => { const [ax, ay] = b.a, [bx, by] = b.b, L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2)); return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) < b.w / 2 + 40; });
    const dry = (x, y) => !deck(x, y) && !deck(x - half, y) && !deck(x + half, y) &&''')
open(F + 'game/tilemap.js', 'w').write(s)

# --- maps: lamps off the bridge, crew island
patch(F + 'game/maps.js', [
    ('{ k: "lantern", x: 1170, y: 1270 }, { k: "lantern", x: 1830, y: 900 }', '{ k: "lantern", x: 1110, y: 1300 }, { k: "lantern", x: 1910, y: 850 }'),
    ('export const TILED = { harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP };', '''// Every crew gets its own island: clubhouse, round pond (not stocked yet), dock with the boat back to the harbour.
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

export const TILED = { harbour: HARBOUR_MAP, millbrook: MILLBROOK_MAP, crew_island: CREW_ISLAND_MAP };'''),
])
print('ok')
