import { useEffect, useRef, useState } from "react";
import { Application, Assets, Sprite, Container, Graphics, Texture, TilingSprite, Text, NineSliceSprite, DisplacementFilter, ColorMatrixFilter, Rectangle } from "pixi.js";
import { AdvancedBloomFilter, GodrayFilter, GlowFilter } from "pixi-filters";
import { fx } from "./fx";
import { useGame } from "../store";
import { gameReady } from "../offline/bridge";
import { sceneFor, inPoly } from "./scenes";
import { buildMap, placeObjects, auditMap } from "./tilemap";
import { TILED } from "./maps";
import { lookSprite, handSprite, parseLook, HAND } from "./look";
import ROD_META from "./rodMeta.json";

let BG_W = 1264;
let BG_H = 848;
let TILED_ON = false;
const FEET = { x: 470, y: 592 };
const ANGLER_H = 185;
const K = ANGLER_H / 250;
const RARITY_GLOW = { legendary: 0xffd34d, mythic: 0xff3fa4, epic: 0xc06bff };
const NAME_STYLE = { fontFamily: "Noto Sans", fontWeight: "800", fontSize: 15, fill: 0xffe9a3, stroke: { color: 0x1a0d03, width: 4 }, align: "center", dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.8 } };

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  return Texture.from(c);
}

const softTex = () => canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});

const starTex = () => canvasTex(32, 32, (g) => {
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(200,255,255,0.6)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(15, 2, 2, 28); g.fillRect(2, 15, 28, 2);
});

const dispTex = () => {
  const t = canvasTex(256, 256, (g) => {
    g.fillStyle = "rgb(128,128,128)"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, rad = 14 + Math.random() * 40;
      const c = `rgba(${Math.random() > 0.5 ? 200 : 60},${Math.random() > 0.5 ? 200 : 60},128,0.35)`;
      for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
        const r = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        r.addColorStop(0, c); r.addColorStop(1, "rgba(128,128,128,0)");
        g.fillStyle = r; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  });
  t.source.addressMode = "repeat";
  return t;
};

const streakTex = () => canvasTex(64, 256, (g) => {
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 64, w = 1 + Math.random() * 3, y = Math.random() * 256, h = 40 + Math.random() * 120;
    const lg = g.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,0.85)"); lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg; g.fillRect(x, y, w, h); g.fillRect(x, y - 256, w, h);
  }
});

const ROD_LEN = 150;
const GRIP = 0.22; // the fist holds the rod this far up from the butt; ROD_LEN is grip -> tip
// Rod angle (radians, 0 = pointing forward, negative = up) for a given activity.
const rodAngle = (mode, phase, moving, time, extra = 0) => {
  if (mode === "harbour" || mode === "clubhouse") return -1.3 + (moving ? Math.sin(time * 11) * 0.05 : Math.sin(time * 1.3) * 0.02);
  if (phase === "fight" || phase === "resolving") return -0.45 - extra;
  if (phase === "wait" || phase === "bite") return -0.62 + (phase === "bite" ? Math.sin(time * 30) * 0.04 : 0);
  return -0.95 + Math.sin(time * 1.3) * 0.02;
};

// A player character (look sprite + held rod sprite); feet at (0, 0), facing right.
function makeFigure() {
  const c = new Container();
  const shadow = new Graphics().ellipse(0, -4, 60 * K, 14 * K).fill({ color: 0x0b1e33, alpha: 0.35 });
  const a = new Sprite(Texture.EMPTY); a.anchor.set(0.5, 1);
  const rod = new Sprite(Texture.EMPTY);
  const fist = new Sprite(Texture.EMPTY); fist.anchor.set(0.5, 1);
  c.addChild(shadow, a, rod, fist);
  const st = { look: null, rodId: null, hand: [12, -110], nat: -Math.PI / 4 };
  const placeRod = () => { rod.position.set(st.hand[0], st.hand[1] + a.y); fist.y = a.y; };
  return {
    c, a, rod,
    setLook(look) {
      if (look === st.look) return;
      st.look = look;
      Assets.load(handSprite(look)).then((t) => { if (!fist.destroyed && st.look === look) { fist.texture = t; fist.scale.set(ANGLER_H / t.height); } }).catch(() => {});
      Assets.load(lookSprite(look)).then((t) => {
        if (a.destroyed || st.look !== look) return;
        a.texture = t; a.scale.set(ANGLER_H / t.height);
        const h = HAND[parseLook(look).g];
        st.hand = [(h[0] - 0.5) * t.width * a.scale.x, -(1 - h[1]) * ANGLER_H];
        placeRod();
      }).catch(() => {});
    },
    setRod(id) {
      if (id === st.rodId) return;
      st.rodId = id;
      const m = ROD_META[id] || ROD_META.rod_cane;
      st.nat = Math.atan2(m[3] - m[1], m[2] - m[0]);
      Assets.load(`art/gear/${ROD_META[id] ? id : "rod_cane"}.webp`).then((t) => {
        if (rod.destroyed || st.rodId !== id) return;
        rod.texture = t; rod.anchor.set((m[0] + (m[2] - m[0]) * GRIP) / t.width, (m[1] + (m[3] - m[1]) * GRIP) / t.height);
        rod.scale.set(ROD_LEN / ((1 - GRIP) * Math.hypot(m[2] - m[0], m[3] - m[1])));
      }).catch(() => {});
    },
    setAngle(d) { placeRod(); rod.rotation = d - st.nat; },
    tip(d) { return { x: st.hand[0] + Math.cos(d) * ROD_LEN, y: st.hand[1] + a.y + Math.sin(d) * ROD_LEN }; },
  };
}

// Chat speech bubble above an angler's head.
function makeBubble(maxLen = 90, wrap = 220) {
  const c = new Container(), bg = new Graphics();
  const t = new Text({ text: "", style: { fontFamily: "Noto Sans", fontWeight: "700", fontSize: 14, fill: 0x2a1a08, wordWrap: true, wordWrapWidth: wrap, align: "center" } });
  t.anchor.set(0.5, 1); c.addChild(bg, t); c.visible = false; c._txt = "";
  c.show = (txt) => {
    if (!txt) { c.visible = false; return; }
    c.visible = true;
    if (txt === c._txt) return;
    c._txt = txt; t.text = txt.length > maxLen ? `${txt.slice(0, maxLen - 2)}…` : txt; t.y = -12;
    const w = t.width + 22, h = t.height + 12;
    bg.clear().roundRect(-w / 2, -h - 6, w, h, 10).fill({ color: 0xfff6dc, alpha: 0.96 }).stroke({ width: 2, color: 0xb98a35 })
      .poly([-7, -7, 7, -7, 0, 2]).fill({ color: 0xfff6dc });
  };
  return c;
}

// Another online angler: their character + rod + nameplate, eased toward the last reported position.
function makePeer(p) {
  const c = new Container();
  const f = makeFigure();
  f.setLook(p.look); f.setRod(p.rod);
  const name = new Text({ text: `${p.username}  Lv.${p.level}`, style: { ...NAME_STYLE, fontSize: 13, fill: 0xcff6ff } });
  name.anchor.set(0.5, 1); name.y = -ANGLER_H - 6;
  const status = new Text({ text: "", style: { fontFamily: "Noto Sans", fontWeight: "700", fontSize: 11, fill: 0xffd35a, stroke: { color: 0x1a0d03, width: 3 } } });
  status.anchor.set(0.5, 1); status.y = -ANGLER_H - 24;
  const bubble = makeBubble(); bubble.y = -ANGLER_H - 30;
  c.addChild(f.c, name, status, bubble);
  c.x = p.x; c.y = p.y;
  c.eventMode = "static"; c.cursor = "pointer";
  c.hitArea = new Rectangle(-40, -ANGLER_H, 80, ANGLER_H + 10);
  c.on("pointertap", (e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("fr-profile", { detail: p.username })); });
  return { c, fig: f.c, f, name, status, bubble, uname: p.username, tx: p.x, ty: p.y, seen: 0 };
}

// Ambient particles per location: snow, embers, fireflies, petals, gulls…
function makeWeather(type, layer, soft) {
  const P = {
    snow: { n: 70, tint: 0xffffff, sc: [0.08, 0.16], vy: [25, 55], add: false },
    petals: { n: 16, tint: 0xffa6d8, sc: [0.12, 0.08], vy: [12, 28], spin: true },
    leaves: { n: 16, tint: 0x9ee06b, sc: [0.13, 0.07], vy: [12, 26], spin: true },
    embers: { n: 50, tint: 0xff8a3d, sc: [0.06, 0.12], vy: [-60, -25], add: true },
    fireflies: { n: 34, tint: 0xd8ff6b, sc: [0.1, 0.16], vy: [-6, 6], add: true, wander: true },
    stars: { n: 30, tint: 0xcfe8ff, sc: [0.05, 0.1], vy: [0, 0], add: true, wander: true, sky: true },
    bubbles: { n: 26, tint: 0xe6ffff, sc: [0.05, 0.1], vy: [-30, -14], add: true, water: true },
    spray: { n: 18, tint: 0xffffff, sc: [0.5, 1.2], vy: [-20, -8], add: true, water: true, fade: true },
    mist: { n: 10, tint: 0xdfe9f2, sc: [4, 7], vy: [0, 0], drift: true },
  }[type];
  const gulls = [];
  if (type === "gulls" || type === "spray") {
    for (let i = 0; i < (type === "gulls" ? 9 : 4); i++) {
      const g = new Graphics();
      g._p = Math.random() * 6; g.x = Math.random() * BG_W; g.y = TILED_ON ? Math.random() * BG_H : 50 + Math.random() * 220; g._d = Math.random() < 0.35 ? -1 : 1;
      g._k = 0.7 + Math.random() * 0.9; g._s = (22 + Math.random() * 30) * g._d * g._k; g.scale.set(g._k);
      layer.addChild(g); gulls.push(g);
    }
  }
  const parts = [];
  const r = (a, b) => a + Math.random() * (b - a);
  const reset = (q, init) => {
    q.x = r(0, BG_W);
    q.y = TILED_ON && (P.water || P.sky || P.drift) ? r(0, BG_H) : P.water ? r(480, 840) : P.sky ? r(10, 320) : P.drift ? r(280, 440) : P.vy[0] < 0 ? (init ? r(0, BG_H) : BG_H + 10) : init ? r(0, BG_H) : -10;
    q._life = 0; q._max = r(2, 5); q._vy = r(P.vy[0], P.vy[1]); q._vx = P.drift ? r(4, 12) : r(-8, 8); q._p = Math.random() * 6;
  };
  for (let i = 0; P && i < P.n; i++) {
    const q = new Sprite(soft);
    q.anchor.set(0.5); q.tint = P.tint; if (P.add) q.blendMode = "add";
    const k = r(P.sc[0], P.sc[1]);
    q.scale.set(P.spin ? P.sc[0] : k, P.spin ? P.sc[1] : P.drift ? k * 0.35 : k);
    q.alpha = P.drift ? 0.14 : 0.85;
    reset(q, true); layer.addChild(q); parts.push(q);
  }
  return (dt, time) => {
    gulls.forEach((g) => {
      g.x += g._s * dt;
      const gy = () => (TILED_ON ? Math.random() * BG_H : 50 + Math.random() * 220);
      if (g.x > BG_W + 40 && g._d > 0) { g.x = -40; g.y = gy(); } else if (g.x < -40 && g._d < 0) { g.x = BG_W + 40; g.y = gy(); }
      const glide = Math.sin(time * 0.7 + g._p) > 0.3, f = glide ? -1.5 : Math.sin(time * 8 + g._p) * 6;
      g.clear().moveTo(-12, f).quadraticCurveTo(-6, -4, 0, 0).quadraticCurveTo(6, -4, 12, f).stroke({ width: 2.4, color: 0xffffff, alpha: 0.95 })
        .ellipse(0, 1, 3, 1.6).fill({ color: 0xffffff, alpha: 0.95 });
      g.y += Math.sin(time * 1.3 + g._p) * 0.25;
    });
    parts.forEach((q) => {
      q._life += dt;
      q.y += q._vy * dt;
      q.x += (P.wander ? Math.sin(time * 0.8 + q._p) * 12 : P.drift ? q._vx : Math.sin(time + q._p) * 10 + q._vx) * dt;
      if (P.spin) q.rotation += dt * 1.5;
      if (P.wander) q.alpha = 0.3 + 0.7 * Math.max(0, Math.sin(time * 2 + q._p));
      if (type === "embers") q.alpha = 0.5 + 0.5 * Math.sin(time * 9 + q._p);
      if (P.fade) { q.alpha = Math.sin(Math.min(1, q._life / q._max) * Math.PI) * 0.35; if (q._life > q._max) reset(q); }
      if (P.drift && q.x > BG_W + 200) q.x = -200;
      if (P.water && q._life > q._max) reset(q);
      if (q.y > BG_H + 20 || q.y < -20) reset(q);
    });
  };
}

// Derive fountain jets, lantern glows and chimney smoke from placed map objects.
function lifeFromObjects(base, views) {
  const L = { ...base, fountain: [], lanterns: [], chimneys: [] };
  views.forEach(({ o, def, w, h }) => {
    const at = (fx0, fy0) => [o.x + (o.flip ? 0.5 - fx0 : fx0 - 0.5) * w, o.y - (1 - fy0) * h];
    if (def.glow) L.lanterns.push([...at(...def.glow), 0.9]);
    if (def.smoke) L.chimneys.push(at(...def.smoke));
    if (def.jet) { const [jx, jy] = at(def.jet[0], def.jet[1]), [bx, by] = at(def.jet[2], def.jet[3]); L.fountain.push([jx, jy]); L.basin = [bx, by, w * 0.28, w * 0.07]; }
  });
  return L;
}

// "Living map" props: fountain jets, bobbing boats, water rings, lantern flicker, chimney smoke.
function makeLife(L, back, front, soft, bgTex) {
  if (!L) return () => {};
  const r = (a, b) => a + Math.random() * (b - a);
  const boats = (L.boats || []).map(([x, y, w, h, amp]) => {
    const s = new Sprite(new Texture({ source: bgTex.source, frame: new Rectangle(x, y, w, h) }));
    s.anchor.set(0.5, 1); s.x = x + w / 2; s.y = y + h; s._y = s.y; s._a = amp; s._p = Math.random() * 6;
    back.addChild(s); return s;
  });
  const drops = [];
  const [bx, by, bw, bh] = L.basin || [0, 0, 0, 0];
  (L.fountain || []).forEach(([x, y]) => {
    for (let i = 0; i < 14; i++) {
      const d = new Sprite(soft); d.anchor.set(0.5); d.blendMode = "add"; d.tint = 0xd8fbff; d.scale.set(r(0.06, 0.12));
      d._o = [x, y]; d._t = Math.random(); d.alpha = 0; back.addChild(d); drops.push(d);
    }
  });
  const rings = new Graphics(); back.addChild(rings);
  const ringPts = [...(L.rings || []).map(([x, y]) => ({ x, y, w: 1, t: Math.random() * 2 }))];
  if (L.basin) for (let i = 0; i < 4; i++) ringPts.push({ x: bx, y: by, w: 0.45, basin: true, t: Math.random() * 2 });
  const lamps = (L.lanterns || []).map(([x, y, k = 1]) => {
    const g = new Sprite(soft); g.anchor.set(0.5); g.blendMode = "add"; g.tint = 0xffb547; g.x = x; g.y = y; g._k = k; g._p = Math.random() * 9;
    front.addChild(g); return g;
  });
  const smoke = [];
  (L.chimneys || []).forEach(([x, y]) => {
    for (let i = 0; i < 9; i++) {
      const m = new Sprite(soft); m.anchor.set(0.5); m.tint = 0xcfc8c0; m._o = [x, y]; m._t = i / 9; front.addChild(m); smoke.push(m);
    }
  });
  return (dt, time) => {
    boats.forEach((b) => { b.y = b._y + Math.sin(time * 1.1 + b._p) * b._a; b.rotation = Math.sin(time * 0.8 + b._p) * 0.006 * b._a; });
    drops.forEach((d) => {
      d._t += dt * 0.9;
      if (d._t >= 1) { d._t = 0; d._vx = r(-38, 38); d._vy = r(-30, -5); }
      const t = d._t * 0.9;
      d.x = d._o[0] + (d._vx || 0) * t; d.y = d._o[1] + (d._vy || 0) * t + 170 * t * t;
      d.alpha = d.y > by + 4 ? 0 : 0.85 * Math.sin(Math.min(1, d._t * 1.4) * Math.PI);
    });
    rings.clear();
    ringPts.forEach((p) => {
      p.t += dt * (p.basin ? 0.7 : 0.45);
      if (p.t > 1) { p.t = 0; if (p.basin) { p.x = bx + r(-bw, bw) * 0.6; p.y = by + r(-bh, bh) * 0.5; } }
      const rad = (8 + p.t * 46) * p.w;
      rings.ellipse(p.x, p.y, rad, rad * 0.3).stroke({ width: 1.6, color: 0xeaffff, alpha: (1 - p.t) * 0.55 });
    });
    lamps.forEach((g) => {
      const f = 0.75 + 0.15 * Math.sin(time * 9 + g._p) + 0.1 * Math.sin(time * 23 + g._p * 2) + (Math.random() < 0.02 ? -0.25 : 0);
      g.alpha = 0.55 * f; g.scale.set(1.5 * g._k * (0.92 + f * 0.12));
    });
    smoke.forEach((m) => {
      m._t += dt * 0.12; if (m._t > 1) m._t -= 1;
      const t = m._t;
      m.x = m._o[0] + t * 60 + Math.sin(time * 0.9 + t * 6) * 8; m.y = m._o[1] - t * 120;
      m.scale.set(0.45 + t * 1.6); m.alpha = Math.sin(t * Math.PI) * 0.28;
    });
  };
}

function buildScene(app, tex, key, bgTex, mt) {
  const cfg = sceneFor(key);
  const mode = key === "harbour" ? "harbour" : "water";
  TILED_ON = !!cfg.tiled;
  BG_W = cfg.tiled ? cfg.W : bgTex.width; BG_H = cfg.tiled ? cfg.H : 848;
  const tm = cfg.tiled ? cachedMap(key, cfg, mt) : null;
  if (tm && QS.has("mapcheck")) window.__mapAudit = { key, ...auditMap(cfg, tm) };
  const canWalk = (x, y) => (tm ? tm.nav.walk(x, y) : inPoly(x, y, cfg.walk));
  const world = new Container();
  app.stage.addChild(world);
  const soft = softTex(), star = starTex();
  const depth = (y) => cfg.tiled ? cfg.scale : cfg.scale * Math.max(0.7, Math.min(1.25, 0.78 + ((y - 470) / 240) * 0.3));

  // Layer 0-2: painted world, water shader, waterfalls
  const base = new Container();
  world.addChild(base);
  const dispSprite = new Sprite(dispTex());
  dispSprite.scale.set(2.2);
  dispSprite.alpha = 0;
  let waterTile = null;
  if (tm) {
    waterTile = new TilingSprite({ texture: mt.img_tex[cfg.water_tex || "water"], width: BG_W, height: BG_H });
    waterTile.tileScale.set(0.38);
    base.addChild(dispSprite, waterTile);
    waterTile.filters = [new DisplacementFilter({ sprite: dispSprite, scale: 9 })];
    tm.chunks.forEach((c) => { const sp = new Sprite(c.tex); sp.x = c.x; sp.y = c.y; base.addChild(sp); });
  } else {
    base.addChild(new Sprite(bgTex));
    base.addChild(dispSprite);
    const water = new Sprite(bgTex);
    const mask = new Graphics();
    cfg.water.forEach((p) => mask.poly(p).fill(0xffffff));
    base.addChild(mask);
    water.mask = mask;
    water.filters = [new DisplacementFilter({ sprite: dispSprite, scale: mode === "harbour" ? 9 : 16 })];
    base.addChild(water);
  }
  const caustics = [];
  const [sx, sy, sw0, sh0] = cfg.sparkle;
  for (let i = 0; i < (cfg.indoor ? 0 : 9); i++) {
    const c = new Sprite(soft);
    c.anchor.set(0.5); c.blendMode = "add"; c.tint = 0x9ff7ff; c.alpha = 0.18;
    c.scale.set(3 + Math.random() * 3, 1 + Math.random());
    c.x = sx + Math.random() * sw0; c.y = sy + Math.random() * sh0; c._s = 0.2 + Math.random() * 0.4; c._p = Math.random() * 6;
    base.addChild(c); caustics.push(c);
  }
  const sTex = streakTex();
  const falls = (cfg.falls || []).map(([x, y, w, h]) => {
    const ts = new TilingSprite({ texture: sTex, width: w, height: h });
    ts.x = x; ts.y = y; ts.alpha = 0.32; ts.blendMode = "add"; ts._sp = 3 + Math.random() * 2;
    base.addChild(ts);
    return ts;
  });
  const godray = new GodrayFilter({ angle: 25, gain: mode === "harbour" ? 0.3 : 0.42, lacunarity: 2.4, parallel: true, alpha: mode === "harbour" ? 0.35 : 0.55 });
  const grade = new ColorMatrixFilter();
  grade.saturate(0.18, true);

  // Layer 4: actors (depth-sorted by feet y)
  const actors = new Container();
  actors.sortableChildren = true;
  world.addChild(actors);
  const body = new Container();
  body.pivot.set(FEET.x, FEET.y);
  const plates = new Container();
  plates.pivot.set(FEET.x, FEET.y);
  plates.zIndex = 20000;
  const spotLayer = new Container();
  spotLayer.zIndex = -1;
  actors.addChild(spotLayer);
  const groundLayer = new Container();
  base.addChild(groundLayer);
  const objViews = tm ? placeObjects(tm.objects, mt.obj, groundLayer, actors) : [];
  // Harbour patrons: walk close or tap them and they share a hint in a speech bubble.
  const npcViews = (cfg.npcs || []).map((n) => {
    const c = new Container(); c.x = n.x; c.y = n.y; c.zIndex = n.y;
    const sh = new Graphics().ellipse(0, 0, 34, 10).fill({ color: 0x000000, alpha: 0.25 });
    const s = new Sprite(Texture.EMPTY); s.anchor.set(0.5, 1);
    Assets.load(`art/npc/body_${n.id}.webp`).then((t) => { if (!s.destroyed) { s.texture = t; s.scale.set((ANGLER_H * 1.02) / t.height); } }).catch(() => {});
    const name = new Text({ text: n.name, style: { ...NAME_STYLE, fontSize: 13, fill: 0xffe7a8 } }); name.anchor.set(0.5, 1); name.y = -ANGLER_H - 8;
    const bubble = makeBubble(170, 270); bubble.y = -ANGLER_H - 30;
    c.addChild(sh, s, name, bubble);
    c.eventMode = "static"; c.cursor = "pointer"; c.hitArea = new Rectangle(-45, -ANGLER_H, 90, ANGLER_H + 10);
    const v = { c, s, bubble, n, i: -1, until: 0, near: false };
    v.say = () => { v.i = (v.i + 1) % n.lines.length; v.until = Date.now() + 8000; };
    c.on("pointertap", (e) => { e.stopPropagation(); v.say(); });
    actors.addChild(c);
    return v;
  });
  window.__npcs = npcViews.map((v) => v.n.id);
  const leapTex = [];
  if (tm) [...new Set(fx.leapArt || [])].slice(0, 8).forEach((u) => Assets.load(u).then((t) => leapTex.push(t)).catch(() => {}));
  const spotViews = cfg.spots.map((sp) => {
    const c = new Container(); c.x = sp.x; c.y = sp.y; c.eventMode = "static"; c.cursor = "pointer";
    let glow, ic = null;
    if (sp.fish) {
      glow = new Sprite(soft); glow.anchor.set(0.5); glow.tint = 0x6ff7ff; glow.blendMode = "add"; glow.scale.set(2.6, 0.9);
      const beam = new Sprite(soft); beam.anchor.set(0.5, 1); beam.tint = 0x8ffcff; beam.blendMode = "add"; beam.scale.set(0.9, 3.2); beam.alpha = 0.45;
      const base0 = new Graphics().ellipse(0, 0, 38, 13).fill({ color: 0x3fe8ff, alpha: 0.22 }).stroke({ width: 3, color: 0xbffcff, alpha: 1 });
      const ring = new Graphics().ellipse(0, 0, 38, 13).stroke({ width: 2.5, color: 0x9ffcff, alpha: 0.9 });
      c.addChild(glow, beam, base0, ring);
      c._ring = ring; c._beam = beam;
    } else {
      // painted signboard: icon + building name on a navy and gold plank
      glow = new Graphics().ellipse(0, 0, 34, 10).fill({ color: 0xffd35a, alpha: 0.35 });
      const lb = new Text({ text: sp.label, style: { fontFamily: "Lilita One, Noto Sans", fontSize: 17, fill: 0xffe9a3, stroke: { color: 0x0b1a33, width: 4 }, letterSpacing: 0.3 } });
      const bw = Math.round(lb.width + 72), bh = 44;
      const plank = new NineSliceSprite({ texture: Texture.EMPTY, leftWidth: 46, rightWidth: 46, topHeight: 20, bottomHeight: 20 });
      plank.width = bw; plank.height = bh; plank.x = -bw / 2; plank.y = -bh - 14;
      Assets.load("art/hud/sign_banner.webp").then((t) => { if (!plank.destroyed) { plank.texture = t; plank.width = bw; plank.height = bh; } }).catch(() => {});
      const post = new Graphics().rect(-3, -16, 6, 16).fill({ color: 0x5a3a1a });
      ic = new Sprite(Texture.EMPTY); ic.anchor.set(0.5); ic.x = -bw / 2 + 30; ic.y = -14 - bh / 2;
      Assets.load(sp.img.includes("/") ? sp.img : `art/ui/${sp.img}.png`).then((t) => { if (!ic.destroyed) { ic.texture = t; ic.scale.set(30 / Math.max(t.width, t.height)); } }).catch(() => {});
      lb.anchor.set(0, 0.5); lb.x = -bw / 2 + 50; lb.y = -14 - bh / 2;
      c.addChild(glow, post, plank, ic, lb);
      c._bw = bw;
    }
    c.hitArea = sp.fish ? new Rectangle(-40, -16, 80, 32) : new Rectangle(-c._bw / 2, -64, c._bw, 74);
    c.on("pointertap", (e) => { e.stopPropagation(); walkTo(sp.x, sp.y + (sp.fish ? 0 : 12), sp.fish ? null : sp.id); });
    if (cfg.tiled) { c.zIndex = sp.fish ? sp.y - 60 : sp.y + 4; actors.addChild(c); } else spotLayer.addChild(c);
    return { sp, c, glow, ic };
  });
  world.eventMode = "static";
  world.hitArea = new Rectangle(0, 0, BG_W, BG_H);
  const walkTo = (x, y, autoOpen = null) => {
    fx.autoOpen = autoOpen;
    if (!tm) { fx.path = []; fx.dest = { x, y }; return; }
    const p = tm.nav.path(fx.me, { x, y });
    if (!p) { fx.dest = null; fx.autoOpen = null; return; }
    fx.path = p; fx.dest = fx.path.shift();
  };
  world.on("pointertap", (e) => { const p = world.toLocal(e.global); if (tm || inPoly(p.x, p.y, cfg.walk)) walkTo(p.x, p.y); });
  actors.addChild(body);
  const hero = makeFigure();
  hero.c.position.set(FEET.x, FEET.y);
  body.addChild(hero.c);
  const angler = hero.a;
  const line = new Graphics();
  line.zIndex = 15000;
  actors.addChild(line);
  const nameplate = new Text({ text: "", style: NAME_STYLE });
  nameplate.anchor.set(0.5, 1); nameplate.x = FEET.x; nameplate.y = FEET.y - ANGLER_H - 8;
  const myBubble = makeBubble();
  const titleplate = new Text({ text: "", style: { fontFamily: "Noto Sans", fontWeight: "700", fontSize: 11, fill: 0x7ff3ff, stroke: { color: 0x02121c, width: 3 } } });
  titleplate.anchor.set(0.5, 1); titleplate.x = FEET.x; titleplate.y = FEET.y - ANGLER_H - 26;
  plates.addChild(nameplate, titleplate, myBubble);
  actors.addChild(plates);
  const peers = new Map();

  // Layer 5: FX
  const fxLayer = new Container();
  world.addChild(fxLayer);
  const sparkles = [];
  for (let i = 0; i < 70; i++) {
    const s = new Sprite(star);
    s.anchor.set(0.5); s.blendMode = "add";
    s.x = sx + Math.random() * sw0; s.y = sy + Math.random() * sh0; s._p = Math.random() * 10; s._s = 1 + Math.random() * 3;
    for (let k = 0; tm && k < 10 && !tm.nav.isWater(s.x, s.y); k++) { s.x = sx + Math.random() * sw0; s.y = sy + Math.random() * sh0; }
    if (tm && !tm.nav.isWater(s.x, s.y)) s.visible = false;
    s.scale.set(0.25 + Math.random() * 0.5);
    fxLayer.addChild(s); sparkles.push(s);
  }
  const mists = [];
  for (let i = 0; cfg.mist?.length && i < 26; i++) {
    const m = new Sprite(soft);
    m.anchor.set(0.5); m.alpha = 0; m._life = Math.random();
    m._home = cfg.mist[i % cfg.mist.length];
    fxLayer.addChild(m); mists.push(m);
  }
  const clouds = [];
  for (let i = 0; i < (cfg.indoor ? 0 : 5); i++) {
    const c = new Sprite(soft);
    c.anchor.set(0.5); c.alpha = mode === "harbour" ? 0.14 : 0.22; c.scale.set(5 + Math.random() * 4, 1.6 + Math.random());
    c.x = Math.random() * BG_W; c.y = 40 + Math.random() * 200; c._s = 4 + Math.random() * 6;
    fxLayer.addChild(c); clouds.push(c);
  }
  const ripples = new Graphics();
  fxLayer.addChild(ripples);
  const bobber = new Graphics().circle(0, 0, 6).fill(0xff4d4d).circle(0, -2, 3).fill(0xffffff);
  bobber.visible = false;
  const bobberGlow = new Sprite(soft);
  bobberGlow.anchor.set(0.5); bobberGlow.tint = 0xffd34d; bobberGlow.blendMode = "add"; bobberGlow.scale.set(0.7);
  bobber.addChild(bobberGlow);
  fxLayer.addChild(bobber);
  const fishShadow = new Graphics().ellipse(0, 0, 40, 12).fill({ color: 0x021a2a, alpha: 0.5 });
  fishShadow.visible = false;
  fxLayer.addChild(fishShadow);
  const fish = new Sprite(Texture.EMPTY);
  fish.anchor.set(0.5); fish.visible = false;
  const auraRing = new Sprite(soft);
  auraRing.anchor.set(0.5); auraRing.blendMode = "add"; auraRing.visible = false;
  fxLayer.addChild(auraRing, fish);
  const bang = new Text({ text: "!", style: { fontFamily: "Cinzel Decorative", fontWeight: "900", fontSize: 54, fill: 0xffe14d, stroke: { color: 0x8a1b00, width: 6 } } });
  bang.anchor.set(0.5, 1); bang.visible = false;
  fxLayer.addChild(bang);
  const drops = [];
  for (let i = 0; i < 60; i++) {
    const d = new Sprite(soft);
    d.anchor.set(0.5); d.blendMode = "add"; d.tint = 0xcffbff; d.visible = false; d.scale.set(0.18);
    fxLayer.addChild(d); drops.push(d);
  }
  const bloom = new AdvancedBloomFilter({ threshold: 0.35, bloomScale: 1.1, brightness: 1.05, blur: 6, quality: 4 });
  const glow = new GlowFilter({ distance: 14, outerStrength: 3, innerStrength: 0.5, color: 0xffd34d, quality: 0.25 });

  // Layer 6: foreground drifting petals
  const front = new Container();
  world.addChild(front);
  const weather = makeWeather(cfg.weather, front, soft);
  const lifeBack = new Container(), lifeFront = new Container();
  base.addChild(lifeBack); fxLayer.addChild(lifeFront);
  const life = makeLife(tm ? lifeFromObjects(cfg.life, objViews) : cfg.life, lifeBack, lifeFront, soft, bgTex);

  const ripplesList = [];
  const addRipple = (x, y, big = 1) => ripplesList.push({ x, y, t: 0, big });
  const splash = (x, y, n = 16, power = 1) => {
    for (let i = 0, k = 0; i < drops.length && k < n; i++) {
      const d = drops[i];
      if (d.visible) continue;
      d.visible = true; d.x = x; d.y = y; k++;
      d._vx = (Math.random() - 0.5) * 160 * power; d._vy = -(80 + Math.random() * 180) * power; d._life = 0.6 + Math.random() * 0.4;
    }
    addRipple(x, y, power);
  };

  let low = null;
  const applyQuality = (isLow) => {
    if (isLow === low) return;
    low = isLow;
    base.filters = isLow ? [] : [godray, grade];
    fxLayer.filters = isLow ? [] : [bloom];
    sparkles.forEach((s, i) => (s.visible = !isLow || i % 4 === 0));
  };

  let lastPhase = "idle", jumpAt = 3, ambient = null, castFrom = null, celebrate = 0, flyFish = null, fishTexUrl = null;
  const tip = { x: 0, y: 0 };

  // Camera: harbour follows the angler, waters keep angler + open water in frame.
  const cam = { sc: 1, sw: 1, sh: 1, x: null, y: null };
  const layout = () => {
    const sw = app.screen.width, sh = app.screen.height;
    const small = Math.min(sw, sh) < 560;
    const zoom = mode === "harbour" ? Math.min(sw / 900, sh / 560) : Math.min(sw / 760, sh / 470);
    cam.sc = cfg.tiled ? (fx.mapView ? Math.min(sw / BG_W, sh / BG_H) : Math.max(0.5, Math.min(1.1, Math.min(sw, sh * 1.4) / 820))) : Math.max(sw / BG_W, sh / BG_H, small ? zoom : 0, mode === "harbour" ? sw / 1400 : 0);
    cam.sw = sw; cam.sh = sh; cam.small = small;
    world.scale.set(cam.sc);
    cam.x = null;
  };
  const camTarget = () => {
    const { sc, sw, sh, small } = cam;
    if (cfg.tiled) {
      if (fx.mapView) return [(sw - BG_W * sc) / 2, (sh - BG_H * sc) / 2];
      const cx = BG_W * sc <= sw ? (sw - BG_W * sc) / 2 : Math.min(0, Math.max(sw - BG_W * sc, sw / 2 - fx.me.x * sc));
      const cy = BG_H * sc <= sh ? (sh - BG_H * sc) / 2 : Math.min(0, Math.max(sh - BG_H * sc, sh * 0.55 - (fx.me.y - 60) * sc));
      return [cx, cy];
    }
    const vis = sw / sc, fxX = mode === "harbour" ? fx.me.x : vis >= 900 ? 690 : Math.min(690, fx.me.x + vis * 0.22), fyY = mode === "harbour" ? fx.me.y - 60 : FEET.y;
    const tx = Math.min(0, Math.max(sw - BG_W * sc, sw / 2 - fxX * sc));
    const ty = Math.min(0, Math.max(sh - BG_H * sc, (mode === "harbour" ? sh * 0.6 : sh * (small ? 0.72 : 0.78)) - fyY * sc));
    return [tx, ty];
  };
  layout();
  app.renderer.on("resize", layout);

  let time = 0;
  const tick = (tk) => {
    if (app.screen.width !== cam.sw || app.screen.height !== cam.sh) layout();
    const dt = Math.min(0.05, tk.deltaMS / 1000);
    time += dt;
    applyQuality(useGame.getState().settings.low);
    dispSprite.x += dt * 22; dispSprite.y += dt * 9;
    godray.time = time * 0.35;
    caustics.forEach((c) => { c.alpha = 0.1 + 0.1 * Math.sin(time * c._s + c._p); c.x += Math.sin(time * 0.2 + c._p) * 0.15; });
    falls.forEach((f) => (f.tilePosition.y += f._sp * dt * 60));
    sparkles.forEach((s) => (s.alpha = Math.max(0, Math.sin(time * s._s + s._p)) ** 3));
    mists.forEach((m) => {
      m._life += dt * 0.35;
      if (m._life > 1) { m._life = 0; m.x = m._home[0] + (Math.random() - 0.5) * 50; m.y = m._home[1]; m._sc = 1 + Math.random() * 1.5; }
      m.y -= dt * 18; m.alpha = Math.sin(m._life * Math.PI) * 0.18; m.scale.set((m._sc || 1) * (0.6 + m._life * 0.6));
    });
    clouds.forEach((c) => { c.x += c._s * dt; if (c.x > BG_W + 200) c.x = -200; });
    weather(dt, time);
    life(dt, time);
    // the water art stays put (corals, rocks); only the refraction ripple drifts over it
    if (waterTile) { dispSprite.x = Math.sin(time * 0.5) * 26; dispSprite.y = Math.cos(time * 0.4) * 20; }
    objViews.forEach((v) => { if (v.def.bob) { v.s.y = v.o.y + Math.sin(time * 1.1 + v.o.x) * v.def.bob; v.s.rotation = Math.sin(time * 0.8 + v.o.x) * 0.004 * v.def.bob; } });

    // walking (click/tap destination or WASD/arrow keys)
    const me = fx.me, idleFight = fx.phase === "idle";
    let vx = 0, vy = 0;
    if (idleFight) {
      if (fx.keys.has("left")) vx -= 1; if (fx.keys.has("right")) vx += 1; if (fx.keys.has("up")) vy -= 1; if (fx.keys.has("down")) vy += 1;
      if (vx || vy) { fx.dest = null; fx.autoOpen = null; }
      else if (fx.dest) { const dx = fx.dest.x - me.x, dy = fx.dest.y - me.y, d = Math.hypot(dx, dy); if (d < Math.max(4, 240 * dt)) { if (canWalk(fx.dest.x, fx.dest.y)) { me.x = fx.dest.x; me.y = fx.dest.y; } fx.dest = fx.path?.length ? fx.path.shift() : null; if (!fx.dest && fx.autoOpen) { const id = fx.autoOpen; fx.autoOpen = null; fx.openSpot?.(id); } } else { vx = dx / d; vy = dy / d; } }
    } else fx.dest = null;
    const moving = !!(vx || vy);
    fx.moving = moving;
    if (moving) {
      const n = Math.hypot(vx, vy), sp = Math.min(230 * dt, fx.dest ? Math.hypot(fx.dest.x - me.x, fx.dest.y - me.y) / 0.8 + 0.5 : 1e9);
      const ky = cfg.tiled ? 1 : 0.8, nx = me.x + (vx / n) * sp, ny = me.y + (vy / n) * sp * ky;
      const ox = me.x, oy = me.y;
      if (canWalk(nx, ny)) { me.x = nx; me.y = ny; } else if (canWalk(nx, me.y) && Math.abs(nx - me.x) > 0.3) me.x = nx; else if (canWalk(me.x, ny) && Math.abs(ny - me.y) > 0.3) me.y = ny;
      else if (cfg.tiled) {
        // slide along diagonal edges (bridges, coasts): try the heading turned 45 degrees either way
        for (const t of [0.785, -0.785]) {
          const c = Math.cos(t), si = Math.sin(t), dx = ((vx * c - vy * si) / n) * sp, dy = ((vx * si + vy * c) / n) * sp;
          if (canWalk(me.x + dx, me.y + dy)) { me.x += dx; me.y += dy; break; }
        }
      }
      if (fx.dest && Math.hypot(me.x - ox, me.y - oy) < 0.5) { fx.path = []; const id = Math.hypot(fx.dest.x - me.x, fx.dest.y - me.y) < 40 ? fx.autoOpen : null; fx.dest = null; fx.autoOpen = null; if (id) fx.openSpot?.(id); }
      if (Math.abs(vx) > 0.2) fx.flip = vx < 0;
    }
    if (!moving && mode === "water") fx.flip = cfg.tiled ? (fx.phase !== "idle" ? fx.target.x < me.x : fx.flip) : false;
    const ds = depth(me.y);
    body.scale.set(fx.flip ? -ds : ds, ds);
    body.x = me.x; body.y = me.y - (moving ? Math.abs(Math.sin(time * 11)) * 5 : 0);
    body.zIndex = me.y;
    plates.x = me.x; plates.y = me.y; plates.scale.set(ds);
    fx.near = null; fx.atSpot = null;
    spotViews.forEach(({ sp, c, glow, ic }) => {
      const dist = Math.hypot(sp.x - me.x, sp.y - me.y);
      if (sp.fish) {
        const on = dist < 40;
        glow.alpha = (on ? 0.9 : 0.45) + Math.sin(time * 3 + sp.x) * 0.15;
        const k = (time * 0.8 + sp.y * 0.01) % 1;
        c._ring.scale.set(1 + k * 0.6); c._ring.alpha = 1 - k;
        c._beam.alpha = on ? 0.15 : 0.35 + Math.sin(time * 2.4 + sp.x) * 0.15;
        if (on) { fx.atSpot = sp.id; fx.fishSpot = sp; }
        return;
      }
      if (ic) ic.rotation = Math.sin(time * 2 + sp.x) * 0.06;
      const near = dist < 75;
      glow.alpha = near ? 0.75 : 0.3;
      if (near) fx.near = sp.id;
    });
    if (grade._hue !== fx.hue) { grade._hue = fx.hue; grade.reset(); grade.hue(fx.hue, false); grade.saturate(0.18, true); }

    // other online anglers in this location
    const list = fx.others || [];
    const now = performance.now();
    list.forEach((p) => {
      let v = peers.get(p.id);
      if (!v) { v = makePeer(p); v.c.x = p.x; v.c.y = p.y; v.wp = []; v.seed = Math.random() * 6; peers.set(p.id, v); actors.addChild(v.c); }
      if (p.x !== v.tx || p.y !== v.ty) {
        // walk peers along the walk grid (never straight across water); far jumps or off-grid positions snap
        const far = Math.hypot(p.x - v.c.x, p.y - v.c.y) > 1400 || (tm && !canWalk(v.c.x, v.c.y)) || (tm && !canWalk(p.x, p.y));
        const wp = far ? null : tm ? tm.nav.path({ x: v.c.x, y: v.c.y }, { x: p.x, y: p.y }) : [{ x: p.x, y: p.y }];
        if (!wp) { v.c.x = p.x; v.c.y = p.y; v.wp = []; } else v.wp = wp;
      }
      v.tx = p.x; v.ty = p.y; v.seen = now; v.phase = p.phase; v.f.setLook(p.look); v.f.setRod(p.rod);
    });
    peers.forEach((v, id) => {
      if (now - v.seen > 4000) { v.c.destroy({ children: true }); peers.delete(id); return; }
      while (v.wp.length > 1 && Math.hypot(v.wp[0].x - v.c.x, v.wp[0].y - v.c.y) < 4) v.wp.shift();
      const goal = v.wp[0] || { x: v.tx, y: v.ty };
      const dx = goal.x - v.c.x, dy = goal.y - v.c.y, d = Math.hypot(dx, dy);
      const walking = d > 2;
      // a little faster than our own walk when behind, so peers glide instead of stop-starting between updates
      const left = v.wp.reduce((acc, q, i) => acc + Math.hypot(q.x - (i ? v.wp[i - 1].x : v.c.x), q.y - (i ? v.wp[i - 1].y : v.c.y)), 0);
      if (walking) { const st = Math.min(d, 230 * (left > 120 ? 1.3 : 1) * dt); v.c.x += (dx / d) * st; v.c.y += (dy / d) * st; if (Math.abs(dx) > 1) v.flip = dx < 0; }
      const pd = depth(v.c.y);
      v.fig.scale.set(v.flip ? -pd : pd, pd);
      v.fig.y = walking ? -Math.abs(Math.sin(time * 11 + v.seed)) * 5 : 0;
      v.name.scale.set(pd); v.name.y = -ANGLER_H * pd - 6; v.status.y = -ANGLER_H * pd - 22;
      { const b = fx.bubbles?.[v.uname]; v.bubble.show(b && b.until > Date.now() ? b.text : ""); v.bubble.y = -ANGLER_H * pd - 26; }
      v.status.text = v.phase === "fight" ? "Reeling in!" : ["cast", "wait", "bite"].includes(v.phase) ? "Fishing…" : v.phase === "landed" ? "Caught one!" : "";
      v.f.setAngle(rodAngle(mode, v.phase, walking, time + v.seed));
      v.c.zIndex = v.c.y;
    });
    if (QS.has("debugpeers")) window.__peerPos = [...peers.values()].map((v) => ({ x: v.c.x, y: v.c.y, onLand: canWalk(v.c.x, v.c.y) }));

    // actors
    hero.setLook(fx.look); hero.setRod(fx.rod || "rod_cane");
    for (const v of npcViews) {
      v.c.scale.set(depth(v.n.y));
      const near = Math.hypot(fx.me.x - v.n.x, fx.me.y - v.n.y) < 160;
      if (near && !v.near) v.say();
      v.near = near;
      v.bubble.show(Date.now() < v.until ? v.n.lines[v.i] : "");
      if (v.s.texture !== Texture.EMPTY) v.s.scale.x = Math.abs(v.s.scale.x) * (fx.me.x < v.n.x ? -1 : 1);
    }
    { const b = fx.bubbles?.[fx.username]; myBubble.show(b && b.until > Date.now() ? b.text : ""); myBubble.x = nameplate.x; myBubble.y = nameplate.y - 24; }
    nameplate.text = fx.username; titleplate.text = fx.title ? `« ${fx.title} »` : "";

    if (fx.phase !== lastPhase) {
      if (fx.phase === "cast") castFrom = time;
      if (fx.phase === "bite") splash(fx.target.x, fx.target.y, 22, 1.1);
      if (fx.phase === "landed") { celebrate = 1.6; flyFish = 0; splash(fx.target.x, fx.target.y, 40, 1.6); }
      if (fx.phase === "lost") splash(fx.target.x, fx.target.y, 12, 0.7);
      if (fx.phase === "fight" && fx.speciesImg !== fishTexUrl) {
        fishTexUrl = fx.speciesImg;
        Assets.load(fishTexUrl).then((t) => { if (!fish.destroyed) fish.texture = t; }).catch(() => {});
      }
      lastPhase = fx.phase;
    }
    const ph = fx.phase;
    const fighting = ph === "fight" || ph === "resolving";
    const tension = fighting ? fx.pos : 0.3;
    celebrate = Math.max(0, celebrate - dt);
    angler.y = -(celebrate > 0 ? Math.abs(Math.sin(celebrate * 6)) * 14 : 0);
    angler.rotation = fighting ? (fx.pos - 0.5) * 0.06 : ph === "cast" ? Math.sin(Math.min(1, (time - castFrom) * 2.5) * Math.PI) * -0.05 : 0;

    // held rod; the line runs from its tip
    const facing = fx.flip ? -1 : 1;
    line.visible = mode === "water";
    let ang = rodAngle(mode, ph, moving, time, tension * 0.35);
    if (ph === "cast") { const k = Math.min(1, (time - castFrom) * 2.2); ang = -2.1 + k * 1.45; }
    hero.setAngle(ang);
    const tl = hero.tip(ang);
    tip.x = body.x + tl.x * ds * facing; tip.y = body.y + tl.y * ds;

    // bobber & line
    let bob = null;
    if (ph === "cast") {
      const k = Math.min(1, (time - castFrom) / 0.6);
      bob = { x: tip.x + (fx.target.x - tip.x) * k, y: tip.y + (fx.target.y - tip.y) * k - Math.sin(k * Math.PI) * 120 };
      if (k >= 1 && !bobber._landed) { bobber._landed = true; splash(fx.target.x, fx.target.y, 10, 0.6); }
    } else if (ph === "wait") {
      bob = { x: fx.target.x, y: fx.target.y + Math.sin(time * 3) * 2 };
      if (Math.random() < dt * 0.6) addRipple(bob.x, bob.y, 0.4);
    } else if (ph === "bite" || fighting) {
      const sway = fighting ? (fx.pos - 0.5) * 90 : 0;
      bob = { x: fx.target.x + sway, y: fx.target.y + 4 + Math.sin(time * 14) * 3 };
    }
    if (ph !== "cast") bobber._landed = false;
    bobber.visible = !!bob && !fighting;
    line.clear();
    if (bob) {
      bobber.x = bob.x; bobber.y = bob.y;
      const sag = fighting ? 10 * (1 - tension) : 40;
      const lc = fighting && fx.zone === 3 ? 0xff3b3b : fighting && fx.zone === 2 ? 0xffa53b : 0xffffff;
      const cx = (tip.x + bob.x) / 2, cy = (tip.y + bob.y) / 2 + sag;
      if (fighting && fx.zone >= 2) line.moveTo(tip.x, tip.y).quadraticCurveTo(cx, cy, bob.x, bob.y).stroke({ width: 5, color: lc, alpha: 0.35 });
      line.moveTo(tip.x, tip.y).quadraticCurveTo(cx, cy, bob.x, bob.y).stroke({ width: 1.5, color: lc, alpha: 0.95 });
    }
    bang.visible = ph === "bite";
    if (bang.visible) { bang.x = fx.target.x; bang.y = fx.target.y - 30 - Math.abs(Math.sin(time * 10)) * 10; bang.scale.set(1 + Math.sin(time * 20) * 0.08); }

    // camera
    const [tx, ty] = camTarget();
    if (cam.x === null) { cam.x = tx; cam.y = ty; }
    cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 5);
    let shake = 0;

    // hooked fish
    const w = Math.max(70, Math.min(260, 70 + 45 * Math.log10(1 + fx.weight)));
    const aura = RARITY_GLOW[fx.rarity];
    if (fighting && bob) {
      const cyc = (time % 1.7) / 1.7;
      const leaping = cyc < 0.42;
      const k = cyc / 0.42;
      fish.visible = leaping && fish.texture !== Texture.EMPTY;
      fishShadow.visible = !leaping;
      fish.scale.set(w / Math.max(1, fish.texture.width));
      fish.scale.x *= fx.pos > 0.5 ? -1 : 1;
      fish.x = bob.x + (k - 0.5) * 40; fish.y = bob.y - Math.sin(k * Math.PI) * (50 + w * 0.3);
      fish.rotation = (k - 0.5) * 1.2 * (fx.pos > 0.5 ? 1 : -1);
      fishShadow.x = bob.x; fishShadow.y = bob.y + 6; fishShadow.scale.set(w / 80);
      if (leaping && k < 0.06 && !fish._sp) { splash(bob.x, bob.y, 14, 0.9 + w / 260); fish._sp = true; }
      if (!leaping) fish._sp = false;
      if (Math.random() < dt * 3) addRipple(bob.x + (Math.random() - 0.5) * 30, bob.y, 0.5);
      fish.filters = aura && !low ? [glow] : [];
      if (aura) glow.color = aura;
      auraRing.visible = !!aura && fish.visible;
      if (auraRing.visible) { auraRing.tint = aura; auraRing.x = fish.x; auraRing.y = fish.y; auraRing.scale.set((w / 40) * (1 + 0.1 * Math.sin(time * 8))); auraRing.alpha = 0.5; }
      shake = fx.trick ? 3 + Math.min(4, Math.abs(fx.trick) * 2) : fx.zone === 3 ? 2 : 0;
    } else if (flyFish !== null && ph === "landed") {
      flyFish = Math.min(1, flyFish + dt * 1.4);
      fish.visible = fish.texture !== Texture.EMPTY; fishShadow.visible = false;
      fish.scale.set((w * (1 + flyFish * 0.6)) / Math.max(1, fish.texture.width));
      fish.x = fx.target.x + (me.x - fx.target.x) * flyFish; fish.y = fx.target.y + (me.y - ANGLER_H - 80 - fx.target.y) * flyFish - Math.sin(flyFish * Math.PI) * 120;
      fish.rotation = Math.sin(time * 12) * 0.2;
      auraRing.visible = !!aura;
      if (aura) { auraRing.x = fish.x; auraRing.y = fish.y; auraRing.scale.set(w / 30); }
    } else {
      fish.visible = false; fishShadow.visible = false; auraRing.visible = false;
    }
    world.x = cam.x + (Math.random() - 0.5) * shake; world.y = cam.y + (Math.random() - 0.5) * shake;

    // ambient leaping fish
    jumpAt -= dt;
    const leapT = tm ? leapTex[Math.floor(Math.random() * leapTex.length)] : tex.ambient;
    if (jumpAt <= 0 && !ambient && leapT && cfg.leap) {
      const s = new Sprite(leapT);
      s.anchor.set(0.5); s.scale.set(34 / leapT.width); s.alpha = 0.9;
      const [lx, ly, lw, lh] = cfg.leap, dir = Math.random() > 0.5 ? 1 : -1;
      // the whole arc must be over open water: never from grass, never over a bridge or pier
      const open = (x, y) => !tm || [0, 0.25, 0.5, 0.75, 1].every((k) => tm.nav.isWater(x + k * 50 * dir, y) && !tm.nav.walk(x + k * 50 * dir, y) && !tm.nav.walk(x + k * 50 * dir, y - 45) && tm.nav.isWater(x + k * 50 * dir, y + 20));
      let x = lx + Math.random() * lw, y = ly + Math.random() * lh;
      for (let i = 0; i < 20 && !open(x, y); i++) { x = lx + Math.random() * lw; y = ly + Math.random() * lh; }
      if (!open(x, y)) { jumpAt = 1; s.destroy(); } else {
      ambient = { s, x, y, t: 0, dir };
      if (ambient.dir < 0) s.scale.x *= -1;
      fxLayer.addChild(s);
      splash(x, y, 6, 0.4);
      }
    }
    if (ambient) {
      ambient.t += dt * 1.6;
      const a = ambient;
      a.s.x = a.x + a.t * 50 * a.dir; a.s.y = a.y - Math.sin(a.t * Math.PI) * 45; a.s.rotation = (a.t - 0.5) * 1.4 * a.dir;
      if (a.t >= 1) { splash(a.s.x, a.y, 6, 0.4); a.s.destroy(); ambient = null; jumpAt = 4 + Math.random() * 6; }
    }

    // particles & ripples
    drops.forEach((d) => {
      if (!d.visible) return;
      d._life -= dt; d._vy += 420 * dt; d.x += d._vx * dt; d.y += d._vy * dt; d.alpha = Math.max(0, d._life);
      if (d._life <= 0) d.visible = false;
    });
    ripples.clear();
    for (let i = ripplesList.length - 1; i >= 0; i--) {
      const r = ripplesList[i];
      r.t += dt;
      if (r.t > 1.2) { ripplesList.splice(i, 1); continue; }
      const rad = 6 + r.t * 40 * r.big;
      ripples.ellipse(r.x, r.y, rad, rad * 0.32).stroke({ width: 2, color: 0xe6ffff, alpha: (1 - r.t / 1.2) * 0.7 });
    }
  };
  app.ticker.add(tick);
  return () => {
    app.ticker.remove(tick);
    app.renderer.off("resize", layout);
    world.destroy({ children: true });
  };
}

const QS = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
// Built maps are kept for the last few places visited; older ones release their GPU textures.
const MAP_CACHE = new Map();
const KEEP = 4;
function cachedMap(key, cfg, mt) {
  let tm = MAP_CACHE.get(key);
  if (!tm) tm = buildMap(cfg, mt.img, mt.obj);
  MAP_CACHE.delete(key); MAP_CACHE.set(key, tm);
  while (MAP_CACHE.size > KEEP) {
    const [old, otm] = MAP_CACHE.entries().next().value;
    MAP_CACHE.delete(old); otm.chunks.forEach((c) => c.tex.destroy(true));
  }
  return tm;
}
const texKeys = (cfg) => [...new Set([cfg.base || "grass", ...(cfg.ground || []).map((g) => g.tex), ...cfg.water.map((w) => w.bank || "sand"), cfg.water_tex || "water", "planks", "post"])];
async function loadMapArt(cfg) {
  const keys = texKeys(cfg), kinds = [...new Set(cfg.objects.map((o) => o.k))];
  const [tx, ob] = await Promise.all([
    Promise.all(keys.map((k) => Assets.load(`art/map/t_${k}.webp`))),
    Promise.all(kinds.map((k) => Assets.load(`art/map/${k}.webp`))),
  ]);
  const img = {}, img_tex = {}, obj = {};
  keys.forEach((k, i) => { tx[i].source.addressMode = "repeat"; img_tex[k] = tx[i]; img[k] = tx[i].source.resource; });
  kinds.forEach((k, i) => (obj[k] = ob[i]));
  return { mt: { img, img_tex, obj } };
}

// While idle: download every map's art, and pre-build the harbour so the trip back is instant.
let warming = false;
async function prewarm() {
  if (warming) return;
  warming = true;
  const idle = () => new Promise((res) => (window.requestIdleCallback || setTimeout)(res, { timeout: 1500 }));
  // fetch only fills the HTTP cache (no decoding), so phones don't hold every map in memory
  for (const cfg of Object.values(TILED)) {
    await idle();
    const urls = [...texKeys(cfg).map((k) => `art/map/t_${k}.webp`), ...new Set(cfg.objects.map((o) => `art/map/${o.k}.webp`))];
    await Promise.all(urls.map((u) => fetch(u).catch(() => {})));
  }
  if (!MAP_CACHE.has("harbour")) { await idle(); const { mt } = await loadMapArt(TILED.harbour); if (!MAP_CACHE.has("harbour")) cachedMap("harbour", TILED.harbour, mt); }
  warming = false;
}
const nextFrame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));

function LoadingVeil({ place }) {
  const thumb = TILED[place] && !["harbour", "crew_island", "duel_pier"].includes(place) ? `/art/waters/${place}_thumb.jpg` : "/art/waters/millbrook_thumb.jpg";
  return (
    <div className="absolute inset-0 z-[5] grid place-items-center bg-[#04121c]/90 transition-opacity" data-testid="map-loading">
      <div className="flex flex-col items-center gap-3">
        <img src={thumb} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-[#c9a35a] shadow-xl animate-pulse" />
        <div className="font-deco gold-text text-xl" data-testid="map-loading-text">Setting sail…</div>
      </div>
    </div>
  );
}

export default function Scene({ place = "harbour" }) {
  const host = useRef(null);
  const rig = useRef({ app: null, tex: null, teardown: null, place, seq: 0 });
  const [loading, setLoading] = useState(null);
  const mount = (r) => {
    const seq = ++r.seq, key = (fx.mapView && QS.get("map")) || r.place;
    const cfg = sceneFor(key);
    const slow = cfg.tiled && !MAP_CACHE.has(key);
    if (slow) setLoading(key);
    const get = () => (cfg.tiled ? loadMapArt(cfg) : Assets.load(cfg.bg).then((bg) => ({ bg })));
    const load = get().catch(() => new Promise((res) => setTimeout(res, 1500)).then(get));
    load.then(async ({ bg, mt }) => {
      if (slow) await nextFrame();
      if (seq !== r.seq || !r.app) return;
      r.teardown?.(); r.teardown = buildScene(r.app, r.tex, key, bg, mt);
      setLoading(null);
      requestAnimationFrame(() => gameReady());
      setTimeout(prewarm, 2500);
    }).catch(() => setLoading(null));
  };

  useEffect(() => {
    const r = rig.current;
    r.place = place;
    if (r.app && r.tex) mount(r);
  }, [place]);

  useEffect(() => {
    const app = new Application();
    const r = rig.current;
    let alive = true, unsub = null, ro = null, offFit = null;
    const onVis = () => (document.hidden || useGame.getState().paused ? app.ticker?.stop() : app.ticker?.start());
    const ready = (async () => {
      await app.init({ resizeTo: host.current, backgroundColor: 0x062436, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      if (!alive) return;
      app.canvas.style.width = "100%"; app.canvas.style.height = "100%"; app.canvas.style.display = "block";
      host.current.querySelectorAll("canvas").forEach((c) => c.remove());
      host.current.appendChild(app.canvas);
      const fit = () => { const el = host.current; if (el && el.clientWidth && el.clientHeight) app.renderer.resize(el.clientWidth, el.clientHeight); };
      ro = new ResizeObserver(fit); ro.observe(host.current);
      window.visualViewport?.addEventListener("resize", fit);
      window.addEventListener("orientationchange", fit);
      offFit = () => { ro.disconnect(); window.visualViewport?.removeEventListener("resize", fit); window.removeEventListener("orientationchange", fit); };
      const ambient = await Assets.load("art/fish/glimmer_minnow.png");
      if (!alive) return;
      r.app = app; r.tex = { ambient };
      mount(r);
      unsub = useGame.subscribe((s, prev) => { if (s.paused !== prev.paused) s.paused ? app.ticker.stop() : app.ticker.start(); });
      let frames = 0, last = performance.now(), samples = [];
      app.ticker.add(() => {
        frames++;
        const now = performance.now();
        if (now - last > 500) {
          const el = document.getElementById("fps-meter");
          const f = Math.round((frames * 1000) / (now - last));
          if (el) el.textContent = `${f} FPS`;
          if (samples.length < 8) {
            samples.push(f);
            const st = useGame.getState();
            if (samples.length === 8 && !st.settings.low && !st.settings.autoChecked && samples.slice(2).reduce((a, b) => a + b, 0) / 6 < 30) st.setSetting("low", true);
            if (samples.length === 8) st.setSetting("autoChecked", true);
          }
          frames = 0; last = now;
        }
      });
      document.addEventListener("visibilitychange", onVis);
    })();
    return () => {
      alive = false;
      unsub?.();
      offFit?.();
      document.removeEventListener("visibilitychange", onVis);
      ready.finally(() => {
        const mine = r.app === app;
        try { if (mine) r.teardown?.(); app.destroy(true, { children: true }); } catch (e) { /* already gone */ }
        if (mine) { r.app = null; r.tex = null; r.teardown = null; }
      });
    };
  }, []);
  return (
    <>
      <div ref={host} className="absolute inset-0" data-testid="game-canvas" />
      {loading && <LoadingVeil place={loading} />}
    </>
  );
}
