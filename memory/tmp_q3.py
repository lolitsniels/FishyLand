def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'
patch(F + 'game/Scene.js', [
    ('import { buildMap, placeObjects } from "./tilemap";', 'import { buildMap, placeObjects } from "./tilemap";\nimport { TILED } from "./maps";'),
    ('''      r.teardown?.(); r.teardown = buildScene(r.app, r.tex, key, bg, mt);
    });''', '''      r.teardown?.(); r.teardown = buildScene(r.app, r.tex, key, bg, mt);
      setTimeout(prewarm, 1200);
    });'''),
    ('export default function Scene(', '''// Build the other walkable maps in the background so switching maps is instant.
let warming = false;
async function prewarm() {
  if (warming) return;
  warming = true;
  for (const [k, cfg] of Object.entries(TILED)) {
    if (MAP_CACHE.has(k)) continue;
    const { mt } = await loadMapArt(cfg).catch(() => ({}));
    if (!mt) continue;
    await new Promise((res) => (window.requestIdleCallback || setTimeout)(res, { timeout: 800 }));
    if (!MAP_CACHE.has(k)) MAP_CACHE.set(k, buildMap(cfg, mt.img));
  }
  warming = false;
}

export default function Scene('''),
])
c = open('/app/frontend/public/ui.css').read()
c += '''
/* live duel */
.duel-board { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 8; display: flex; align-items: center; gap: 10px; padding: 4px 8px; border: 16px solid transparent; border-image: url(/art/hud/panel.webp) 195 fill / 16px / 0 stretch; }
.duel-side { display: flex; flex-direction: column; align-items: flex-start; min-width: 120px; font-family: var(--ui-font); }
.duel-side.right { align-items: flex-end; }
.duel-side b { font-size: 13px; color: #fff3cf; text-shadow: 0 1px 2px #000; }
.duel-side.lead b { color: #ffd23f; }
.duel-kg { font: 400 22px "Lilita One", var(--ui-font); color: #fff; text-shadow: 0 2px 0 #000; line-height: 1.1; }
.duel-side small { font-size: 10.5px; color: #a9c1e0; }
.duel-clock { font: 400 26px "Lilita One", var(--ui-font); color: #ffd23f; min-width: 110px; text-align: center; text-shadow: 0 2px 0 #000, 0 0 10px rgba(255, 210, 63, .5); }
.duel-result { width: min(92vw, 420px); padding: 14px; }
.duel-result-t { font: 400 40px "Lilita One", var(--ui-font); text-shadow: 0 3px 0 #000; }
.duel-result-t.win { color: #ffd23f; } .duel-result-t.lose { color: #ff8a7a; } .duel-result-t.draw { color: #bfe3ff; }
.duel-final { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
.duel-final > div { display: flex; flex-direction: column; padding: 8px; border-radius: 6px; background: rgba(6, 16, 32, .6); border: 1px solid rgba(226, 180, 90, .35); }
.duel-final > div.me { border-color: #ffd23f; }
.duel-final b { color: #fff3cf; font-size: 13px; } .duel-final span { font: 400 22px "Lilita One", var(--ui-font); color: #fff; } .duel-final small { color: #a9c1e0; font-size: 10.5px; }
.duel-reward { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font: 400 22px "Lilita One", var(--ui-font); color: #ffd23f; }
.duel-reward img { width: 26px; height: 26px; }
@media (max-width: 640px) { .duel-board { top: 180px; gap: 4px; } .duel-side { min-width: 84px; } .duel-kg { font-size: 17px; } .duel-clock { font-size: 20px; min-width: 76px; } }
img.px-icon { display: inline-block; vertical-align: middle; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .6)); }
'''
open('/app/frontend/public/ui.css', 'w').write(c)
print('ok')
