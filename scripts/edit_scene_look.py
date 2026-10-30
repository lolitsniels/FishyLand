S = "/app/frontend/src/game/Scene.js"
s = open(S).read()


def rep(a, b):
    global s
    assert a in s, a[:80]
    s = s.replace(a, b, 1)


rep('import { sceneFor, inPoly } from "./scenes";', '''import { sceneFor, inPoly } from "./scenes";
import { lookSprite, parseLook, HAND } from "./look";
import ROD_META from "./rodMeta.json";''')

a = s.index('// Another online angler: sprite + wings + nameplate')
b = s.index('function buildScene(') if False else s.index('// Ambient particles per location')
s = s[:a] + '''const ROD_LEN = 150;
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

''' + s[b:]

a = s.index('  const shadow = new Graphics().ellipse(FEET.x, FEET.y - 4, 70 * K, 16 * K)')
b = s.index('  const line = new Graphics();')
s = s[:a] + '''  const me = makeFigure();
  me.c.position.set(FEET.x, FEET.y);
  body.addChild(me.c);
  const angler = me.a;
''' + s[b:]
rep('  rod.zIndex = line.zIndex = 15000;\n  actors.addChild(rod, line);', '  line.zIndex = 15000;\n  actors.addChild(line);')
rep('      if (!v) { v = makePeer(tex, p); peers.set(p.id, v); actors.addChild(v.c); }\n      v.tx = p.x; v.ty = p.y; v.seen = now; v.phase = p.phase;',
    '      if (!v) { v = makePeer(p); peers.set(p.id, v); actors.addChild(v.c); }\n      v.tx = p.x; v.ty = p.y; v.seen = now; v.phase = p.phase; v.f.setLook(p.look); v.f.setRod(p.rod);')
rep('      v.c.zIndex = v.c.y;\n    });', '      v.f.setAngle(rodAngle(mode, v.phase, walking, time + v.c.x));\n      v.c.zIndex = v.c.y;\n    });')
rep('''    const flap = Math.sin(time * 2.6);
    wings.scale.set(0.32 * K * (1 + flap * 0.05), 0.32 * K * (1 - flap * 0.03));
    wingGlow.alpha = 0.25 + 0.15 * Math.sin(time * 3.1);
    wingGroup.y = FEET.y - ANGLER_H * 0.68 + flap * 2;
    pet.y = FEET.y - 45 * K + Math.sin(time * 2) * 5;
    pet.scale.x = Math.abs(pet.scale.x) * (Math.sin(time * 0.5) > 0.9 ? -1 : 1);
''', '''    me.setLook(fx.look); me.setRod(fx.rod || "rod_cane");
''')
rep('    angler.y = FEET.y - (celebrate > 0 ? Math.abs(Math.sin(celebrate * 6)) * 14 : 0);', '    angler.y = -(celebrate > 0 ? Math.abs(Math.sin(celebrate * 6)) * 14 : 0);')

a = s.index('    // rod: butt -> tip, bending toward bobber with tension')
b = s.index('    // bobber & line')
s = s[:a] + '''    // held rod; the line runs from its tip
    const facing = fx.flip ? -1 : 1;
    line.visible = mode === "water";
    let ang = rodAngle(mode, ph, moving, time, tension * 0.35);
    if (ph === "cast") { const k = Math.min(1, (time - castFrom) * 2.2); ang = -2.1 + k * 1.45; }
    me.setAngle(ang);
    const tl = me.tip(ang);
    tip.x = body.x + tl.x * ds * facing; tip.y = body.y + tl.y * ds;

''' + s[b:]
rep('''      const [angler, wings, pet, ambient] = await Promise.all(["art/angler.png", "art/wings.png", "art/pet.png", "art/fish/glimmer_minnow.png"].map((u) => Assets.load(u)));
      if (!alive) return;
      r.app = app; r.tex = { angler, wings, pet, ambient };''', '''      const ambient = await Assets.load("art/fish/glimmer_minnow.png");
      if (!alive) return;
      r.app = app; r.tex = { ambient };''')
open(S, "w").write(s)
print("ok")
