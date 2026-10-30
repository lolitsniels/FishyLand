import { useEffect, useRef } from "react";
import { Application, Assets, Sprite, Container, Graphics, Texture, TilingSprite, Text, DisplacementFilter, ColorMatrixFilter, Rectangle } from "pixi.js";
import { AdvancedBloomFilter, GodrayFilter, GlowFilter } from "pixi-filters";
import { fx } from "./fx";
import { useGame } from "../store";
import { gameReady } from "../portal";
import { sceneFor, inPoly } from "./scenes";
import { lookSprite, parseLook, HAND } from "./look";
import ROD_META from "./rodMeta.json";

let BG_W = 1264;
const BG_H = 848;
const FEET = { x: 470, y: 592 };
const ANGLER_H = 185;
const K = ANGLER_H / 250;
const RARITY_GLOW = { legendary: 0xffd34d, mythic: 0xff3fa4, epic: 0xc06bff };
const NAME_STYLE = { fontFamily: "Cinzel", fontWeight: "700", fontSize: 15, fill: 0xffe9a3, stroke: { color: 0x1a0d03, width: 4 }, align: "center", dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.8 } };

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
// Rod angle (radians, 0 = pointing forward, negative = up) for a given activity.
const rodAngle = (mode, phase, moving, time, extra = 0) => {
  if (mode === "harbour") return -1.3 + (moving ? Math.sin(time * 11) * 0.05 : Math.sin(time * 1.3) * 0.02);
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
  c.addChild(shadow, a, rod);
  const st = { look: null, rodId: null, hand: [12, -110], nat: -Math.PI / 4 };
  const placeRod = () => rod.position.set(st.hand[0], st.hand[1] + a.y);
  return {
    c, a, rod,
    setLook(look) {
      if (look === st.look) return;
      st.look = look;
      Assets.load(lookSprite(look)).then((t) => {
        if (a.destroyed || st.look !== look) return;
        a.texture = t; a.scale.set(ANGLER_H / t.height);
        const h = HAND[parseLook(look).g];
        st.hand = [(h[0] - 0.5) * t.width * a.scale.x, -(1 - h[1]) * ANGLER_H];
        placeRod();
      });
    },
    setRod(id) {
      if (id === st.rodId) return;
      st.rodId = id;
      const m = ROD_META[id] || ROD_META.rod_cane;
      st.nat = Math.atan2(m[3] - m[1], m[2] - m[0]);
      Assets.load(`art/gear/${ROD_META[id] ? id : "rod_cane"}.webp`).then((t) => {
        if (rod.destroyed || st.rodId !== id) return;
        rod.texture = t; rod.anchor.set(m[0] / t.width, m[1] / t.height);
        rod.scale.set(ROD_LEN / Math.hypot(m[2] - m[0], m[3] - m[1]));
      });
    },
    setAngle(d) { placeRod(); rod.rotation = d - st.nat; },
    tip(d) { return { x: st.hand[0] + Math.cos(d) * ROD_LEN, y: st.hand[1] + a.y + Math.sin(d) * ROD_LEN }; },
  };
}

// Another online angler: their character + rod + nameplate, eased toward the last reported position.
function makePeer(p) {
  const c = new Container();
  const f = makeFigure();
  f.setLook(p.look); f.setRod(p.rod);
  const name = new Text({ text: `${p.username}  Lv.${p.level}`, style: { ...NAME_STYLE, fontSize: 13, fill: 0xcff6ff } });
  name.anchor.set(0.5, 1); name.y = -ANGLER_H - 6;
  const status = new Text({ text: "", style: { fontFamily: "Cinzel", fontSize: 11, fill: 0xffd35a, stroke: { color: 0x1a0d03, width: 3 } } });
  status.anchor.set(0.5, 1); status.y = -ANGLER_H - 24;
  c.addChild(f.c, name, status);
  c.x = p.x; c.y = p.y;
  return { c, fig: f.c, f, name, status, tx: p.x, ty: p.y, seen: 0 };
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
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      g._p = Math.random() * 6; g.x = Math.random() * BG_W; g.y = 60 + Math.random() * 180; g._s = 25 + Math.random() * 25;
      layer.addChild(g); gulls.push(g);
    }
  }
  const parts = [];
  const r = (a, b) => a + Math.random() * (b - a);
  const reset = (q, init) => {
    q.x = r(0, BG_W);
    q.y = P.water ? r(480, 840) : P.sky ? r(10, 320) : P.drift ? r(280, 440) : P.vy[0] < 0 ? (init ? r(0, BG_H) : BG_H + 10) : init ? r(0, BG_H) : -10;
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
      g.x += g._s * dt; if (g.x > BG_W + 40) { g.x = -40; g.y = 60 + Math.random() * 180; }
      const f = Math.sin(time * 8 + g._p) * 5;
      g.clear().moveTo(-10, f).quadraticCurveTo(-5, -3, 0, 0).quadraticCurveTo(5, -3, 10, f).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      g.y += Math.sin(time + g._p) * 0.2;
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

function buildScene(app, tex, key, bgTex) {
  const cfg = sceneFor(key);
  const mode = key === "harbour" ? "harbour" : "water";
  BG_W = bgTex.width;
  const world = new Container();
  app.stage.addChild(world);
  const soft = softTex(), star = starTex();
  const depth = (y) => cfg.scale * Math.max(0.7, Math.min(1.25, 0.78 + ((y - 470) / 240) * 0.3));

  // Layer 0-2: painted world, water shader, waterfalls
  const base = new Container();
  world.addChild(base);
  base.addChild(new Sprite(bgTex));
  const dispSprite = new Sprite(dispTex());
  dispSprite.scale.set(2.2);
  dispSprite.alpha = 0;
  base.addChild(dispSprite);
  const water = new Sprite(bgTex);
  const mask = new Graphics();
  cfg.water.forEach((p) => mask.poly(p).fill(0xffffff));
  base.addChild(mask);
  water.mask = mask;
  water.filters = [new DisplacementFilter({ sprite: dispSprite, scale: mode === "harbour" ? 9 : 16 })];
  base.addChild(water);
  const caustics = [];
  const [sx, sy, sw0, sh0] = cfg.sparkle;
  for (let i = 0; i < 9; i++) {
    const c = new Sprite(soft);
    c.anchor.set(0.5); c.blendMode = "add"; c.tint = 0x9ff7ff; c.alpha = 0.18;
    c.scale.set(3 + Math.random() * 3, 1 + Math.random());
    c.x = sx + Math.random() * sw0; c.y = sy + Math.random() * sh0; c._s = 0.2 + Math.random() * 0.4; c._p = Math.random() * 6;
    base.addChild(c); caustics.push(c);
  }
  const sTex = streakTex();
  const falls = cfg.falls.map(([x, y, w, h]) => {
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
      glow = new Graphics().ellipse(0, 0, 34, 10).fill({ color: 0xffd35a, alpha: 0.35 });
      const ring = new Graphics().circle(0, -40, 26).fill({ color: 0x1a0f06, alpha: 0.85 }).stroke({ width: 3, color: 0xf3c24d });
      ic = new Sprite(Texture.EMPTY); ic.anchor.set(0.5); ic.y = -42;
      Assets.load(`art/ui/${sp.img}.png`).then((t) => { if (!ic.destroyed) { ic.texture = t; ic.scale.set(52 / Math.max(t.width, t.height)); } });
      const lb = new Text({ text: sp.label, style: { fontFamily: "Cinzel", fontWeight: "700", fontSize: 12, fill: 0xffe9a3, stroke: { color: 0x1a0d03, width: 4 } } });
      lb.anchor.set(0.5, 0); lb.y = -10;
      c.addChild(glow, ring, ic, lb);
    }
    c.hitArea = sp.fish ? new Rectangle(-40, -16, 80, 32) : new Rectangle(-34, -70, 68, 80);
    c.on("pointertap", (e) => { e.stopPropagation(); fx.dest = { x: sp.x, y: sp.y + (sp.fish ? 0 : 12) }; fx.autoOpen = sp.fish ? null : sp.id; });
    spotLayer.addChild(c);
    return { sp, c, glow, ic };
  });
  world.eventMode = "static";
  world.hitArea = new Rectangle(0, 0, BG_W, BG_H);
  world.on("pointertap", (e) => { const p = world.toLocal(e.global); if (inPoly(p.x, p.y, cfg.walk)) { fx.dest = { x: p.x, y: p.y }; fx.autoOpen = null; } });
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
  const titleplate = new Text({ text: "", style: { fontFamily: "Cinzel", fontSize: 11, fill: 0x7ff3ff, stroke: { color: 0x02121c, width: 3 } } });
  titleplate.anchor.set(0.5, 1); titleplate.x = FEET.x; titleplate.y = FEET.y - ANGLER_H - 26;
  plates.addChild(nameplate, titleplate);
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
    s.scale.set(0.25 + Math.random() * 0.5);
    fxLayer.addChild(s); sparkles.push(s);
  }
  const mists = [];
  for (let i = 0; cfg.mist.length && i < 26; i++) {
    const m = new Sprite(soft);
    m.anchor.set(0.5); m.alpha = 0; m._life = Math.random();
    m._home = cfg.mist[i % cfg.mist.length];
    fxLayer.addChild(m); mists.push(m);
  }
  const clouds = [];
  for (let i = 0; i < 5; i++) {
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
    cam.sc = Math.max(sw / BG_W, sh / BG_H, small ? zoom : 0, mode === "harbour" ? sw / 1400 : 0);
    cam.sw = sw; cam.sh = sh; cam.small = small;
    world.scale.set(cam.sc);
    cam.x = null;
  };
  const camTarget = () => {
    const { sc, sw, sh, small } = cam;
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

    // walking (click/tap destination or WASD/arrow keys)
    const me = fx.me, idleFight = fx.phase === "idle";
    let vx = 0, vy = 0;
    if (idleFight) {
      if (fx.keys.has("left")) vx -= 1; if (fx.keys.has("right")) vx += 1; if (fx.keys.has("up")) vy -= 1; if (fx.keys.has("down")) vy += 1;
      if (vx || vy) { fx.dest = null; fx.autoOpen = null; }
      else if (fx.dest) { const dx = fx.dest.x - me.x, dy = fx.dest.y - me.y, d = Math.hypot(dx, dy); if (d < 4) { fx.dest = null; if (fx.autoOpen) { const id = fx.autoOpen; fx.autoOpen = null; fx.openSpot?.(id); } } else { vx = dx / d; vy = dy / d; } }
    } else fx.dest = null;
    const moving = !!(vx || vy);
    fx.moving = moving;
    if (moving) {
      const n = Math.hypot(vx, vy), sp = 230 * dt;
      const nx = me.x + (vx / n) * sp, ny = me.y + (vy / n) * sp * 0.8;
      if (inPoly(nx, ny, cfg.walk)) { me.x = nx; me.y = ny; } else if (inPoly(nx, me.y, cfg.walk)) me.x = nx; else if (inPoly(me.x, ny, cfg.walk)) me.y = ny; else fx.dest = null;
      if (Math.abs(vx) > 0.2) fx.flip = vx < 0;
    }
    if (!moving && mode === "water") fx.flip = false;
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
      if (ic) ic.y = -42 + Math.sin(time * 2 + sp.x) * 4;
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
      if (!v) { v = makePeer(p); peers.set(p.id, v); actors.addChild(v.c); }
      v.tx = p.x; v.ty = p.y; v.seen = now; v.phase = p.phase; v.f.setLook(p.look); v.f.setRod(p.rod);
    });
    peers.forEach((v, id) => {
      if (now - v.seen > 4000) { v.c.destroy({ children: true }); peers.delete(id); return; }
      const dx = v.tx - v.c.x, dy = v.ty - v.c.y, d = Math.hypot(dx, dy);
      const walking = d > 2;
      if (walking) { const st = Math.min(d, 230 * dt); v.c.x += (dx / d) * st; v.c.y += (dy / d) * st; if (Math.abs(dx) > 1) v.flip = dx < 0; }
      const pd = depth(v.c.y);
      v.fig.scale.set(v.flip ? -pd : pd, pd);
      v.fig.y = walking ? -Math.abs(Math.sin(time * 11 + v.c.x)) * 5 : 0;
      v.name.scale.set(pd); v.name.y = -ANGLER_H * pd - 6; v.status.y = -ANGLER_H * pd - 22;
      v.status.text = v.phase === "fight" ? "Reeling in!" : ["cast", "wait", "bite"].includes(v.phase) ? "Fishing…" : v.phase === "landed" ? "Caught one!" : "";
      v.f.setAngle(rodAngle(mode, v.phase, walking, time + v.c.x));
      v.c.zIndex = v.c.y;
    });

    // actors
    hero.setLook(fx.look); hero.setRod(fx.rod || "rod_cane");
    nameplate.text = fx.username; titleplate.text = fx.title ? `« ${fx.title} »` : "";

    if (fx.phase !== lastPhase) {
      if (fx.phase === "cast") castFrom = time;
      if (fx.phase === "bite") splash(fx.target.x, fx.target.y, 22, 1.1);
      if (fx.phase === "landed") { celebrate = 1.6; flyFish = 0; splash(fx.target.x, fx.target.y, 40, 1.6); }
      if (fx.phase === "lost") splash(fx.target.x, fx.target.y, 12, 0.7);
      if (fx.phase === "fight" && fx.speciesImg !== fishTexUrl) {
        fishTexUrl = fx.speciesImg;
        Assets.load(fishTexUrl).then((t) => { if (!fish.destroyed) fish.texture = t; });
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
    if (jumpAt <= 0 && !ambient && tex.ambient) {
      const s = new Sprite(tex.ambient);
      s.anchor.set(0.5); s.scale.set(34 / tex.ambient.width); s.alpha = 0.9;
      const [lx, ly, lw, lh] = cfg.leap;
      const x = lx + Math.random() * lw, y = ly + Math.random() * lh;
      ambient = { s, x, y, t: 0, dir: Math.random() > 0.5 ? 1 : -1 };
      if (ambient.dir < 0) s.scale.x *= -1;
      fxLayer.addChild(s);
      splash(x, y, 6, 0.4);
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

export default function Scene({ place = "harbour" }) {
  const host = useRef(null);
  const rig = useRef({ app: null, tex: null, teardown: null, place, seq: 0 });
  const mount = (r) => {
    const seq = ++r.seq, key = r.place;
    Assets.load(sceneFor(key).bg).then((bg) => {
      if (seq !== r.seq || !r.app) return;
      r.teardown?.(); r.teardown = buildScene(r.app, r.tex, key, bg);
    });
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
      gameReady();
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
  return <div ref={host} className="absolute inset-0" data-testid="game-canvas" />;
}
