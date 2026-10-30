import { Texture, Sprite } from "pixi.js";

// Object catalogue: art file, default width, footprint [w, h] as fraction of width, extras (glow/smoke/jet offsets as fractions of sprite size).
export const OBJ = {
  tackle_shop: { rect: true, w: 400, fp: [0.9, 0.62], smoke: [0.66, 0.04] },
  tavern: { rect: true, w: 430, fp: [0.9, 0.62] },
  guild_hall: { rect: true, w: 500, fp: [0.92, 0.62] },
  pearl_shop: { rect: true, w: 380, fp: [0.9, 0.62] },
  market_stall: { rect: true, w: 330, fp: [0.9, 0.5] },
  bait_hut: { rect: true, w: 370, fp: [0.86, 0.5] },
  house: { rect: true, w: 300, fp: [0.88, 0.62] },
  quest_board: { w: 150, fp: [0.9, 0.16], rect: true },
  fountain: { w: 270, fp: [0.94, 0.5], rect: true, jet: [0.66, 0.2, 0.62, 0.72] },
  lantern: { w: 60, fp: [0.5, 0.12], glow: [0.5, 0.13] },
  oak: { w: 300, fp: [0.22, 0.08] },
  willow: { w: 300, fp: [0.24, 0.08] },
  pine: { w: 120, fp: [0.3, 0.1] },
  bush: { w: 130, fp: [0.8, 0.3] },
  rocks: { w: 180, fp: [0.86, 0.36] },
  barrels: { w: 130, fp: [0.9, 0.42], rect: true },
  reeds: { w: 150, fp: [0, 0] },
  rowboat: { w: 230, fp: [0, 0], bob: 1.2, wet: true },
  ship: { w: 820, fp: [0, 0], bob: 2, wet: true },
  bridge: { w: 700, fp: [0, 0], ground: true },
};
export const TERRAIN = ["grass", "sand", "dirt", "planks", "cobble"];

const CELL = 16;
const CHUNK = 1024;

const TEX_K = { grass: 0.45, sand: 0.4, dirt: 0.4, planks: 0.35, cobble: 0.26 };
const pattern = (ctx, img, k = 0.5) => { const p = ctx.createPattern(img, "repeat"); p.setTransform(new DOMMatrix().scale(k)); return p; };
const pathPoly = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); };
const pathLine = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); };
// Smooth closed shape (Catmull-Rom through the points) so coasts and plazas look organic.
const smoothPoly = (ctx, pts) => {
  const n = pts.length / 2, P = (i) => [pts[((i + n) % n) * 2], pts[((i + n) % n) * 2 + 1]];
  ctx.beginPath(); ctx.moveTo(...P(0));
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  ctx.closePath();
};
const smoothLine = (ctx, pts) => {
  const n = pts.length / 2, P = (i) => [pts[Math.max(0, Math.min(n - 1, i)) * 2], pts[Math.max(0, Math.min(n - 1, i)) * 2 + 1]];
  ctx.beginPath(); ctx.moveTo(...P(0));
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
};
const shape = (ctx, s) => (s.invert ? (smoothPoly(ctx, s.invert), ctx.rect(-5000, -5000, 20000, 20000)) : s.line ? smoothLine(ctx, s.line) : s.smooth ? smoothPoly(ctx, s.smooth) : s.poly ? pathPoly(ctx, s.poly) : (ctx.beginPath(), ctx.ellipse(s.circle[0], s.circle[1], s.circle[2], s.circle[3] ?? s.circle[2], 0, 0, Math.PI * 2)));
const paint = (ctx, s) => { shape(ctx, s); if (s.line) { ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); } else ctx.fill("evenodd"); };

// Paint the ground (land textures, sea/river cut-outs, docks) and build the walk grid.
export function buildMap(map, img) {
  const { W, H } = map;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = pattern(ctx, img[map.base || "grass"], TEX_K[map.base || "grass"]); ctx.fillRect(0, 0, W, H);
  // soft edge shadow for every ground shape first, then all fills, so overlapping paths merge without seams
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = "rgba(30,22,10,.22)"; ctx.filter = "blur(6px)"; ctx.translate(0, 6);
  for (const s of map.ground || []) { if (s.line) { shape(ctx, s); ctx.lineWidth = s.width + 10; ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(); } else { shape(ctx, s); ctx.lineWidth = 10; ctx.fill(); ctx.stroke(); } }
  ctx.restore();
  for (const s of map.ground || []) { ctx.fillStyle = ctx.strokeStyle = pattern(ctx, img[s.tex], TEX_K[s.tex]); paint(ctx, s); }
  // banks under the water edge, then cut the water out so the animated water layer shows through
  for (const s of map.water) {
    ctx.save(); ctx.strokeStyle = pattern(ctx, img[s.bank || "sand"], TEX_K.sand); ctx.fillStyle = ctx.strokeStyle;
    if (s.line) { shape(ctx, s); ctx.lineWidth = s.width + (s.bankW ?? 90); ctx.lineCap = ctx.lineJoin = "round"; ctx.stroke(); }
    else { shape(ctx, s); ctx.lineWidth = (s.bankW ?? 90) * 2; ctx.lineJoin = "round"; ctx.stroke(); }
    ctx.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = ctx.fillStyle = "#000";
  for (const s of map.water) paint(ctx, s);
  ctx.restore();
  // wet edge + foam
  ctx.save(); ctx.globalCompositeOperation = "source-atop";
  ctx.strokeStyle = "rgba(40,30,15,.28)"; ctx.lineCap = ctx.lineJoin = "round";
  for (const s of map.water) { shape(ctx, s); ctx.lineWidth = (s.line ? s.width : 0) + 26; ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = "source-atop"; ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineCap = ctx.lineJoin = "round";
  for (const s of map.water) { shape(ctx, s); ctx.lineWidth = (s.line ? s.width : 0) + 8; ctx.stroke(); }
  ctx.restore();
  // docks / piers over the water
  for (const d of map.docks || []) {
    ctx.save();
    pathPoly(ctx, d.poly);
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 12;
    ctx.fillStyle = pattern(ctx, img.planks, TEX_K.planks); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.lineWidth = 6; ctx.strokeStyle = "#3a2412"; ctx.stroke();
    ctx.fillStyle = "#4a2e16";
    for (const [px, py] of d.posts || []) ctx.drawImage(img.post, px - 22, py - 40, 44, 65);
    ctx.restore();
  }

  for (const b of map.bridges || []) {
    const [ax, ay] = b.a, [bx, by] = b.b, L = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax), hw = b.w / 2;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 12;
    ctx.fillStyle = pattern(ctx, img.planks, TEX_K.planks); ctx.fillRect(-20, -hw, L + 40, b.w);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#3a2412"; ctx.fillRect(-20, -hw - 6, L + 40, 8); ctx.fillRect(-20, hw - 2, L + 40, 8);
    ctx.restore();
    for (let d = 0; d <= L + 20; d += 130) for (const side of [-1, 1]) {
      const px = ax + Math.cos(ang) * d - Math.sin(ang) * side * (hw + 2), py = ay + Math.sin(ang) * d + Math.cos(ang) * side * (hw + 2);
      ctx.drawImage(img.post, px - 16, py - 34, 32, 47);
    }
  }

  // walk grid: land minus water, plus docks/bridges, minus object footprints and the map rim
  const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
  const m = document.createElement("canvas"); m.width = gw; m.height = gh;
  const g = m.getContext("2d");
  g.scale(1 / CELL, 1 / CELL);
  g.fillStyle = g.strokeStyle = "#fff"; g.fillRect(0, 0, W, H);
  g.fillStyle = g.strokeStyle = "#000"; g.lineCap = g.lineJoin = "round";
  for (const s of map.water) { shape(g, s); if (s.line) { g.lineWidth = s.width + 30; g.stroke(); } else { g.lineWidth = 30; g.fill("evenodd"); if (!s.invert) g.stroke(); } }
  const gw0 = Math.ceil(W / CELL), gh0 = Math.ceil(H / CELL), wpx = g.getImageData(0, 0, gw0, gh0).data;
  const isWater = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= gw0 || cy >= gh0 || wpx[(cy * gw0 + cx) * 4] < 128; };
  // Land props must stand fully on dry ground: if any base point is in water, nudge to the nearest dry spot.
  const settle = (o) => {
    const def = OBJ[o.k];
    if (def.wet || def.ground) return o;
    const w = o.w || def.w, half = w * 0.4;
    const deck = (x, y) => (map.docks || []).some((d) => { const xs = d.poly.filter((_, i) => i % 2 === 0), ys = d.poly.filter((_, i) => i % 2); return x > Math.min(...xs) - 30 && x < Math.max(...xs) + 30 && y > Math.min(...ys) - 30 && y < Math.max(...ys) + 40; })
      || (map.bridges || []).some((b) => { const [ax, ay] = b.a, [bx, by] = b.b, L2 = (bx - ax) ** 2 + (by - ay) ** 2, t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2)); return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)) < b.w / 2 + 40; });
    const dry = (x, y) => !deck(x, y) && !deck(x - half, y) && !deck(x + half, y) && [[x, y], [x - half, y], [x + half, y], [x, y - w * 0.2], [x - half, y - w * 0.2], [x + half, y - w * 0.2]].every(([a, b]) => !isWater(a, b + 6) && !isWater(a, b + 24));
    if (dry(o.x, o.y)) return o;
    for (let r = 16; r <= 480; r += 16) for (let k = 0; k < 16; k++) {
      const x = o.x + Math.cos((k * Math.PI) / 8) * r, y = o.y + Math.sin((k * Math.PI) / 8) * r;
      if (dry(x, y)) return { ...o, x, y };
    }
    return null;
  };
  const objects = map.objects.map(settle).filter(Boolean);
  g.fillStyle = g.strokeStyle = "#fff";
  for (const d of map.docks || []) { pathPoly(g, d.poly); g.fill(); }
  for (const b of map.bridges || []) { pathLine(g, [...b.a, ...b.b]); g.lineWidth = b.w - 18; g.stroke(); }
  for (const b of map.walkways || []) { pathLine(g, b.line); g.lineWidth = b.width; g.stroke(); }
  g.fillStyle = "#000";
  for (const o of objects) {
    const def = OBJ[o.k], w = o.w || def.w, [fw, fh] = o.fp || def.fp;
    if (!fw) continue;
    const rx = Math.max(16, (w * fw) / 2), ry = Math.max(14, (w * fh) / 2);
    if (def.rect) g.fillRect(o.x - rx, o.y - 2 * ry, 2 * rx, 2 * ry + 6);
    else { g.beginPath(); g.ellipse(o.x, o.y - ry, rx, ry, 0, 0, 7); g.fill(); }
  }
  for (const b of map.blocks || []) { pathPoly(g, b); g.fill(); }
  g.fillRect(0, 0, W, 40); g.fillRect(0, H - 40, W, 40); g.fillRect(0, 0, 40, H); g.fillRect(W - 40, 0, 40, H);
  const px = g.getImageData(0, 0, gw, gh).data;
  const grid = new Uint8Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = px[i * 4] > 127 ? 1 : 0;

  const chunks = [];
  for (let y = 0; y < H; y += CHUNK) for (let x = 0; x < W; x += CHUNK) {
    const c = document.createElement("canvas"); c.width = Math.min(CHUNK, W - x); c.height = Math.min(CHUNK, H - y);
    c.getContext("2d").drawImage(cv, -x, -y);
    chunks.push({ x, y, tex: Texture.from(c) });
  }
  return { chunks, nav: { ...makeNav(grid, gw, gh), isWater }, objects };
}

function makeNav(grid, gw, gh) {
  const ok = (cx, cy) => cx >= 0 && cy >= 0 && cx < gw && cy < gh && grid[cy * gw + cx] === 1;
  const walk = (x, y) => ok(Math.floor(x / CELL), Math.floor(y / CELL));
  const nearest = (cx, cy) => {
    for (let r = 0; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (ok(cx + dx, cy + dy)) return [cx + dx, cy + dy];
    }
    return null;
  };
  const sight = (ax, ay, bx, by) => {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / (CELL / 2));
    for (let i = 1; i <= n; i++) if (!walk(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
    return true;
  };
  // A* over the walk grid, then string-pulled to a few straight segments
  const path = (from, to) => {
    const s = [Math.floor(from.x / CELL), Math.floor(from.y / CELL)];
    let t = [Math.floor(to.x / CELL), Math.floor(to.y / CELL)];
    if (!ok(...t)) { t = nearest(...t); if (!t) return null; to = { x: t[0] * CELL + CELL / 2, y: t[1] * CELL + CELL / 2 }; }
    if (!ok(...s)) return [to];
    const N = gw * gh, gS = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const si = s[1] * gw + s[0], ti = t[1] * gw + t[0];
    const h = (i) => Math.hypot((i % gw) - t[0], Math.floor(i / gw) - t[1]);
    const open = [[h(si), si]]; gS[si] = 0;
    let found = false, iter = 0;
    while (open.length && iter++ < 60000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (closed[cur]) continue; closed[cur] = 1;
      if (cur === ti) { found = true; break; }
      const cx = cur % gw, cy = Math.floor(cur / gw);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!ok(nx, ny) || (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy)))) continue;
        const ni = ny * gw + nx, ng = gS[cur] + (dx && dy ? 1.414 : 1);
        if (ng < gS[ni]) { gS[ni] = ng; came[ni] = cur; open.push([ng + h(ni), ni]); }
      }
    }
    if (!found) return null;
    const cells = []; for (let i = ti; i !== -1; i = came[i]) cells.push({ x: (i % gw) * CELL + CELL / 2, y: Math.floor(i / gw) * CELL + CELL / 2 });
    cells.reverse(); cells[cells.length - 1] = to;
    const out = []; let a = from;
    for (let i = 1; i < cells.length; i++) if (!sight(a.x, a.y, cells[i].x, cells[i].y)) { out.push(cells[i - 1]); a = cells[i - 1]; }
    out.push(to);
    return out;
  };
  return { walk, path };
}

// Place map objects: ground ones (bridges) go in `ground`, the rest are depth-sorted with the actors.
export function placeObjects(objects, tex, ground, actors) {
  const views = [];
  for (const o of objects) {
    const def = OBJ[o.k], t = tex[o.k];
    if (!t) continue;
    const s = new Sprite(t); s.anchor.set(0.5, 1);
    const w = o.w || def.w; s.scale.set(((o.flip ? -1 : 1) * w) / t.width, w / t.width);
    s.x = o.x; s.y = o.y; s.zIndex = o.y + (o.z || 0);
    (def.ground ? ground : actors).addChild(s);
    views.push({ o, def, s, w, h: (t.height * w) / t.width });
  }
  return views;
}
