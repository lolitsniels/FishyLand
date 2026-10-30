def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:80]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/'
patch(F + 'src/world/World.js', [('crews: ["Guild Hall", "crew"]', 'crews: ["Crew HQ", "crew"]')])
patch(F + 'src/world/ChatBox.js', [('["crew", "Guild"]', '["crew", "Crew"]'), ('Join a guild at the Guild Hall to use guild chat.', 'Join a crew at the Crew HQ to use crew chat.')])
patch(F + 'src/game/scenes.js', [('label: "Guild Hall"', 'label: "Crew HQ"')])
patch(F + 'src/game/maps.js', [('label: "Guild Hall"', 'label: "Crew HQ"'), ('"Anchor Tavern · Contracts"', '"Anchor Café · Contracts"'), ('"Bait Hut · Crafting"', '"Workshop · Crafting"')])
s = open(F + 'src/game/tilemap.js').read()
s = s.replace('house: { rect: true, w: 300, fp: [0.88, 0.62], smoke: [0.73, 0.1] }', 'house: { rect: true, w: 300, fp: [0.88, 0.62] }')
s = s.replace('smoke: [0.5, 0.04] }', 'smoke: [0.66, 0.04] }')
s = s.replace('jet: [0.47, 0.24, 0.5, 0.6]', 'jet: [0.66, 0.2, 0.62, 0.72]')
s = s.replace('lantern: { w: 56, fp: [0.5, 0.12], glow: [0.22, 0.31] }', 'lantern: { w: 60, fp: [0.5, 0.12], glow: [0.5, 0.13] }')
open(F + 'src/game/tilemap.js', 'w').write(s)
s = open(F + 'src/game/Scene.js').read()
s = s.replace('fontFamily: "Cinzel", fontWeight: "700"', 'fontFamily: "Noto Sans", fontWeight: "800"').replace('fontFamily: "Cinzel", fontSize', 'fontFamily: "Noto Sans", fontWeight: "700", fontSize')
open(F + 'src/game/Scene.js', 'w').write(s)
h = open(F + 'public/index.html').read()
if 'Lilita' not in h: h = h.replace('family=Noto+Sans:wght@500;600;700;800', 'family=Noto+Sans:wght@500;600;700;800&family=Lilita+One', 1)
open(F + 'public/index.html', 'w').write(h)
c = open(F + 'public/ui.css').read()
c = c.replace('.modal-banner *, .sf-banner-t, .wm-pop-t, .font-deco { font-family: "Cinzel", serif !important; }', '.modal-banner *, .sf-banner-t, .wm-pop-t, .font-deco, .font-display, h1, h2 { font-family: "Lilita One", var(--ui-font) !important; font-weight: 400 !important; letter-spacing: .04em !important; }')
c = c.replace('html body .fr-modal .panel { background: linear-gradient(180deg, rgba(48, 36, 24, .55), rgba(10, 8, 6, .78)) !important; border: 1px solid rgba(214, 172, 92, .5) !important;',
              'html body .fr-modal .panel { background: linear-gradient(180deg, rgba(22, 48, 86, .7), rgba(6, 14, 30, .85)) !important; border: 1px solid rgba(226, 180, 90, .5) !important;')
c = c.replace('background: linear-gradient(180deg, rgba(255, 248, 235, .05), rgba(0, 0, 0, .25)); border: 1px solid rgba(214, 172, 92, .3); padding: 8px; margin-bottom: 6px; }',
              'background: linear-gradient(180deg, rgba(40, 80, 130, .35), rgba(4, 12, 26, .5)); border: 1px solid rgba(226, 180, 90, .3); padding: 8px; margin-bottom: 6px; }')
c += '''
.fr-modal .overflow-y-auto { background: radial-gradient(ellipse at top, rgba(40, 90, 150, .25), transparent 60%); }
.g-card, .sf-item { background: linear-gradient(180deg, rgba(36, 74, 124, .45), rgba(6, 14, 28, .75)) !important; }
.sf-body { background: rgba(6, 16, 32, .5) !important; }
.sf-side, .sf-deal { background: rgba(10, 26, 50, .6) !important; }
.sf-tab:not(.on) { color: #e6f1ff !important; }
.wm-pin img { width: clamp(14px, 1.9vw, 26px); }
html body .panel-head, .sf-side-h { color: #ffd27a !important; }
'''
open(F + 'public/ui.css', 'w').write(c)
print('ok')
