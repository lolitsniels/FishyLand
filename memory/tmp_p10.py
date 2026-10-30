def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'
patch(F + 'game/tilemap.js', [('return cx >= 0 && cy >= 0 && cx < gw0 && cy < gh0 && wpx[(cy * gw0 + cx) * 4] < 128; };', 'return cx < 0 || cy < 0 || cx >= gw0 || cy >= gh0 || wpx[(cy * gw0 + cx) * 4] < 128; };')])
patch(F + 'game/maps.js', [
    ('    { k: "lantern", x: 2850, y: 1612 }, { k: "lantern", x: 3250, y: 1612 }, { k: "lantern", x: 1630, y: 2140 },\n', '    { k: "lantern", x: 2640, y: 1560 }, { k: "lantern", x: 1420, y: 1690 },\n'),
    ('{ k: "barrels", x: 2730, y: 1745, w: 100 }, ', ''),
])
patch(F + 'world/World.js', [
    ('<div className="pcard-bar"><i style=', '<Zap size={14} className="pcard-zap" fill="#ffd23f" color="#8a5a00" strokeWidth={1.5} /><div className="pcard-bar energy"><i style='),
])
c = open('/app/frontend/public/ui.css').read()
c += '''
.pcard-bars { padding-left: 16px; }
.pcard-zap { position: absolute; left: 168px; top: 79px; filter: drop-shadow(0 0 4px rgba(255, 210, 63, .8)); z-index: 1; }
.pcard-bar.energy { height: 11px; border: 1px solid rgba(255, 210, 63, .6); }
.pcard-bar.energy i { background: linear-gradient(180deg, #ffe66b, #ffb31a 60%, #e88a00); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .6); }
.pcard-bar.energy span { line-height: 9px; font-size: 8.5px; color: #2a1503; text-shadow: 0 1px 0 rgba(255, 255, 255, .5); }
'''
open('/app/frontend/public/ui.css', 'w').write(c)
print('ok')
