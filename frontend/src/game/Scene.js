import { useEffect, useRef } from "react";
import { Application, Assets, Sprite, Container, Graphics, Texture, TilingSprite, Text, DisplacementFilter, ColorMatrixFilter } from "pixi.js";
import { AdvancedBloomFilter, GodrayFilter, GlowFilter } from "pixi-filters";
import { fx } from "./fx";
import { useGame } from "../store";
import { gameReady } from "../portal";

const BG_W = 1264, BG_H = 848;
const FEET = { x: 470, y: 592 };
const ANGLER_H = 185;
const K = ANGLER_H / 250;
const WATER_POLY = [0, 470, 200, 380, 340, 290, 560, 250, 900, 250, 940, 300, 1040, 350, 1080, 400, 1264, 470, 1264, 848, 640, 848, 640, 560, 560, 460, 300, 440, 150, 500, 0, 560];
const FALLS = [[135, 50, 40, 150], [262, 215, 60, 105], [410, 95, 18, 110], [440, 215, 18, 85], [950, 222, 60, 110], [1115, 60, 45, 140]];
const MIST = [[290, 320], [450, 300], [985, 335], [160, 190], [1135, 200]];
const RARITY_GLOW = { legendary: 0xffd34d, mythic: 0xff3fa4, epic: 0xc06bff };

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

function buildScene(app, tex) {
  const world = new Container();
  app.stage.addChild(world);
  const soft = softTex(), star = starTex();

  // Layer 0-2: painted world, water shader, waterfalls
  const base = new Container();
  world.addChild(base);
  base.addChild(new Sprite(tex.bg));
  const dispSprite = new Sprite(dispTex());
  dispSprite.scale.set(2.2);
  dispSprite.alpha = 0;
  base.addChild(dispSprite);
  const water = new Sprite(tex.bg);
  const mask = new Graphics().poly(WATER_POLY).fill(0xffffff);
  base.addChild(mask);
  water.mask = mask;
  water.filters = [new DisplacementFilter({ sprite: dispSprite, scale: 16 })];
  base.addChild(water);
  const caustics = [];
  for (let i = 0; i < 9; i++) {
    const c = new Sprite(soft);
    c.anchor.set(0.5); c.blendMode = "add"; c.tint = 0x9ff7ff; c.alpha = 0.18;
    c.scale.set(3 + Math.random() * 3, 1 + Math.random());
    c.x = 300 + Math.random() * 600; c.y = 420 + Math.random() * 180; c._s = 0.2 + Math.random() * 0.4; c._p = Math.random() * 6;
    base.addChild(c); caustics.push(c);
  }
  const sTex = streakTex();
  const falls = FALLS.map(([x, y, w, h]) => {
    const ts = new TilingSprite({ texture: sTex, width: w, height: h });
    ts.x = x; ts.y = y; ts.alpha = 0.32; ts.blendMode = "add"; ts._sp = 3 + Math.random() * 2;
    base.addChild(ts);
    return ts;
  });
  const godray = new GodrayFilter({ angle: 25, gain: 0.42, lacunarity: 2.4, parallel: true, alpha: 0.55 });
  const grade = new ColorMatrixFilter();
  grade.saturate(0.18, true);

  // Layer 4: actors
  const actors = new Container();
  world.addChild(actors);
  const shadow = new Graphics().ellipse(FEET.x, FEET.y - 4, 70 * K, 16 * K).fill({ color: 0x0b1e33, alpha: 0.35 });
  actors.addChild(shadow);
  const wingGroup = new Container();
  wingGroup.x = FEET.x - 14 * K; wingGroup.y = FEET.y - ANGLER_H * 0.68;
  const wingGlow = new Sprite(tex.wings);
  const wings = new Sprite(tex.wings);
  for (const w of [wingGlow, wings]) { w.anchor.set(0.5, 0.55); w.scale.set(0.32 * K); wingGroup.addChild(w); }
  wingGlow.blendMode = "add"; wingGlow.alpha = 0.35; wingGlow.scale.set(0.345 * K);
  actors.addChild(wingGroup);
  const angler = new Sprite(tex.angler);
  angler.anchor.set(0.5, 1);
  angler.scale.set(ANGLER_H / tex.angler.height);
  angler.x = FEET.x; angler.y = FEET.y;
  actors.addChild(angler);
  const pet = new Sprite(tex.pet);
  pet.anchor.set(0.5); pet.scale.set((105 * K) / tex.pet.width); pet.x = FEET.x - 95 * K; pet.y = FEET.y - 40 * K;
  actors.addChild(pet);
  const rod = new Graphics();
  const line = new Graphics();
  actors.addChild(rod, line);
  const nameplate = new Text({
    text: "", style: { fontFamily: "Cinzel", fontWeight: "700", fontSize: 15, fill: 0xffe9a3, stroke: { color: 0x1a0d03, width: 4 }, align: "center",
      dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.8 } },
  });
  nameplate.anchor.set(0.5, 1); nameplate.x = FEET.x; nameplate.y = FEET.y - ANGLER_H - 8;
  const titleplate = new Text({ text: "", style: { fontFamily: "Cinzel", fontSize: 11, fill: 0x7ff3ff, stroke: { color: 0x02121c, width: 3 } } });
  titleplate.anchor.set(0.5, 1); titleplate.x = FEET.x; titleplate.y = FEET.y - ANGLER_H - 26;
  actors.addChild(nameplate, titleplate);

  // Layer 5: FX
  const fxLayer = new Container();
  world.addChild(fxLayer);
  const sparkles = [];
  for (let i = 0; i < 70; i++) {
    const s = new Sprite(star);
    s.anchor.set(0.5); s.blendMode = "add";
    s.x = 660 + Math.random() * 580; s.y = 300 + Math.random() * 520; s._p = Math.random() * 10; s._s = 1 + Math.random() * 3;
    s.scale.set(0.25 + Math.random() * 0.5);
    fxLayer.addChild(s); sparkles.push(s);
  }
  const mists = [];
  for (let i = 0; i < 26; i++) {
    const m = new Sprite(soft);
    m.anchor.set(0.5); m.alpha = 0; m._life = Math.random();
    m._home = MIST[i % MIST.length];
    fxLayer.addChild(m); mists.push(m);
  }
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const c = new Sprite(soft);
    c.anchor.set(0.5); c.alpha = 0.22; c.scale.set(5 + Math.random() * 4, 1.6 + Math.random());
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
  const petals = [];
  for (let i = 0; i < 14; i++) {
    const p = new Sprite(soft);
    p.anchor.set(0.5); p.tint = 0xffa6d8; p.scale.set(0.14, 0.09); p.alpha = 0.85;
    p.x = Math.random() * BG_W; p.y = Math.random() * BG_H; p._s = 10 + Math.random() * 20;
    front.addChild(p); petals.push(p);
  }

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

  const layout = () => {
    const sw = app.renderer.width / app.renderer.resolution, sh = app.renderer.height / app.renderer.resolution;
    const sc = Math.max(sw / BG_W, sh / BG_H);
    world.scale.set(sc);
    world._bx = Math.min(0, Math.max(sw - BG_W * sc, sw / 2 - 690 * sc)); // keep angler + fishing water in frame
    world._by = Math.min(0, Math.max(sh - BG_H * sc, sh * 0.78 - FEET.y * sc));
    world.x = world._bx; world.y = world._by;
  };
  layout();
  app.renderer.on("resize", layout);

  let time = 0;
  app.ticker.add((tk) => {
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
    petals.forEach((p) => { p.y += p._s * dt; p.x += Math.sin(time + p._s) * 0.4; p.rotation += dt; if (p.y > BG_H + 20) { p.y = -20; p.x = Math.random() * BG_W; } });

    // actors
    const flap = Math.sin(time * 2.6);
    wings.scale.set(0.32 * K * (1 + flap * 0.05), 0.32 * K * (1 - flap * 0.03));
    wingGlow.alpha = 0.25 + 0.15 * Math.sin(time * 3.1);
    wingGroup.y = FEET.y - ANGLER_H * 0.68 + flap * 2;
    pet.y = FEET.y - 45 * K + Math.sin(time * 2) * 5;
    pet.scale.x = Math.abs(pet.scale.x) * (Math.sin(time * 0.5) > 0.9 ? -1 : 1);
    nameplate.text = fx.username; titleplate.text = fx.title ? `« ${fx.title} »` : "";

    if (fx.phase !== lastPhase) {
      if (fx.phase === "cast") castFrom = time;
      if (fx.phase === "bite") splash(fx.target.x, fx.target.y, 22, 1.1);
      if (fx.phase === "landed") { celebrate = 1.6; flyFish = 0; splash(fx.target.x, fx.target.y, 40, 1.6); }
      if (fx.phase === "lost") splash(fx.target.x, fx.target.y, 12, 0.7);
      if (fx.phase === "fight" && fx.speciesImg !== fishTexUrl) {
        fishTexUrl = fx.speciesImg;
        Assets.load(fishTexUrl).then((t) => (fish.texture = t));
      }
      lastPhase = fx.phase;
    }
    const ph = fx.phase;
    const fighting = ph === "fight" || ph === "resolving";
    const tension = fighting ? fx.pos : 0.3;
    celebrate = Math.max(0, celebrate - dt);
    angler.y = FEET.y - (celebrate > 0 ? Math.abs(Math.sin(celebrate * 6)) * 14 : 0);
    angler.rotation = fighting ? (fx.pos - 0.5) * 0.06 : ph === "cast" ? Math.sin(Math.min(1, (time - castFrom) * 2.5) * Math.PI) * -0.05 : 0;

    // rod: butt -> tip, bending toward bobber with tension
    const butt = { x: FEET.x + 18 * K, y: FEET.y - ANGLER_H * 0.64 + (angler.y - FEET.y) };
    const baseTip = { x: butt.x + 75, y: butt.y - 150 };
    const bend = fighting ? 0.18 + tension * 0.35 : ph === "wait" || ph === "bite" ? 0.1 : 0;
    tip.x = baseTip.x + (fx.target.x - baseTip.x) * bend * 0.5;
    tip.y = baseTip.y + (fx.target.y - baseTip.y) * bend * 0.6;
    const mid = { x: (butt.x + tip.x) / 2 + 10 + bend * 40, y: (butt.y + tip.y) / 2 - 10 - bend * 30 };
    rod.clear();
    rod.moveTo(butt.x, butt.y).quadraticCurveTo(mid.x, mid.y, tip.x, tip.y).stroke({ width: 9, color: 0x4ff2ff, alpha: 0.25, cap: "round" });
    rod.moveTo(butt.x, butt.y).quadraticCurveTo(mid.x, mid.y, tip.x, tip.y).stroke({ width: 4, color: 0xf6c94b, cap: "round" });
    rod.moveTo(butt.x, butt.y).lineTo(butt.x + 12, butt.y - 24).stroke({ width: 6, color: 0x6b3d12, cap: "round" });
    rod.circle(tip.x, tip.y, 4).fill({ color: 0xbffcff, alpha: 0.9 });

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
      const shake = fx.trick ? 3 + Math.min(4, Math.abs(fx.trick) * 2) : fx.zone === 3 ? 2 : 0;
      world.x = world._bx + (Math.random() - 0.5) * shake; world.y = world._by + (Math.random() - 0.5) * shake;
    } else if (flyFish !== null && ph === "landed") {
      flyFish = Math.min(1, flyFish + dt * 1.4);
      fish.visible = fish.texture !== Texture.EMPTY; fishShadow.visible = false;
      fish.scale.set((w * (1 + flyFish * 0.6)) / Math.max(1, fish.texture.width));
      fish.x = fx.target.x + (FEET.x - fx.target.x) * flyFish; fish.y = fx.target.y + (FEET.y - ANGLER_H - 80 - fx.target.y) * flyFish - Math.sin(flyFish * Math.PI) * 120;
      fish.rotation = Math.sin(time * 12) * 0.2;
      auraRing.visible = !!aura;
      if (aura) { auraRing.x = fish.x; auraRing.y = fish.y; auraRing.scale.set(w / 30); }
      world.x = world._bx; world.y = world._by;
    } else {
      fish.visible = false; fishShadow.visible = false; auraRing.visible = false;
      world.x = world._bx; world.y = world._by;
    }

    // ambient leaping fish
    jumpAt -= dt;
    if (jumpAt <= 0 && !ambient && tex.ambient) {
      const s = new Sprite(tex.ambient);
      s.anchor.set(0.5); s.scale.set(34 / tex.ambient.width); s.alpha = 0.9;
      const x = 700 + Math.random() * 420, y = 400 + Math.random() * 340;
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
  });
}

export default function Scene() {
  const host = useRef(null);
  useEffect(() => {
    const app = new Application();
    let alive = true, unsub = null;
    const onVis = () => (document.hidden || useGame.getState().paused ? app.ticker?.stop() : app.ticker?.start());
    const ready = (async () => {
      await app.init({ resizeTo: host.current, backgroundColor: 0x062436, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true });
      if (!alive) return;
      host.current.appendChild(app.canvas);
      const data = useGame.getState().data;
      const [bg, angler, wings, pet, ambient] = await Promise.all(
        ["art/crystal_lagoon.jpg", "art/angler.png", "art/wings.png", "art/pet.png", "art/fish/glimmer_minnow.png"].map((u) => Assets.load(u))
      );
      if (!alive) return;
      buildScene(app, { bg, angler, wings, pet, ambient });
      gameReady();
      unsub = useGame.subscribe((s, prev) => { if (s.paused !== prev.paused) s.paused ? app.ticker.stop() : app.ticker.start(); });
      data?.species.forEach((s) => Assets.load(s.img));
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
            if (samples.length === 8 && !st.settings.low && !st.settings.autoChecked && samples.slice(2).reduce((a, b) => a + b, 0) / 6 < 30) {
              st.setSetting("low", true);
              st.pushSystem("Low graphics enabled automatically for smoother play (change in Settings).", "info");
            }
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
      document.removeEventListener("visibilitychange", onVis);
      ready.finally(() => { try { app.destroy(true, { children: true }); } catch (e) { /* already gone */ } });
    };
  }, []);
  return <div ref={host} className="absolute inset-0" data-testid="game-canvas" />;
}
