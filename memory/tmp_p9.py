def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'
patch(F + 'tfl/components/CrewTabs.js', [('  const shown = TABS.filter(([, , , need]) =>', '  const shown = TABS.filter(([key]) => !["contest", "contract", "hall", "leviathan"].includes(key)).filter(([, , , need]) =>')])
island = '''      {user.crew && <button type="button" className="btn btn-gold w-full" onClick={() => window.dispatchEvent(new CustomEvent("fr-mode", { detail: "crew" }))} data-testid="go-crew-island">{tt("Sail to your crew island")}</button>}
'''
patch(F + 'tfl/pages/game/Crews.js', [
    ('      <div className="space-y-3 fade-in" data-testid="crew-detail-page">\n', '      <div className="space-y-3 fade-in" data-testid="crew-detail-page">\n' + island),
    ('    <div className="space-y-3 fade-in" data-testid="crews-page">\n', '    <div className="space-y-3 fade-in" data-testid="crews-page">\n' + island),
])
# chat: no duplicate lines
patch(F + 'world/ChatBox.js', [
    ('setRows((old) => [...old, ...r.data].slice(-80));', 'setRows((old) => { const seen = new Set(old.map((m) => m.id)); return [...old, ...r.data.filter((m) => !seen.has(m.id))].slice(-80); });'),
    ('setRows((old) => [...old, r.data].slice(-80)); }', 'setRows((old) => (old.some((m) => m.id === r.data.id) ? old : [...old, r.data].slice(-80))); }'),
])
# travel map: no boat/shimmer/clouds, pins = round water thumbnails
patch(F + 'tfl/components/WorldMap.js', [
    ('      <div className="wm-shimmer" /><div className="wm-clouds" />\n      <Boat />\n', ''),
    ('            <img src="/art/hud/pin.webp" alt="" />', '            <span className="wm-dot"><img src={key === "harbour" ? "/art/hud/sail.webp" : `/art/waters/${key}_thumb.jpg`} alt="" /></span>'),
])
s = open(F + 'tfl/components/WorldMap.js').read()
a = s.index('function Boat() {'); b = s.index('export function WorldMap')
s = s[:a] + s[b:]
s = s.replace('import { useEffect, useRef, useState } from "react";', 'import { useState } from "react";')
s = s.replace('const ROUTE = [[56, 50], [60, 60], [52, 66], [40, 62], [30, 58], [22, 64], [28, 72], [45, 88], [62, 70], [70, 62], [82, 52], [92, 50], [80, 46], [66, 48], [56, 50]];\n', '')
open(F + 'tfl/components/WorldMap.js', 'w').write(s)
patch('/app/backend/world_presence.py', [('    loc = body.loc if body.loc == "harbour" or body.loc in WATER_BY_KEY else "harbour"', '    crew = (user.get("crew") or {}).get("id")\n    loc = f"crew:{crew}" if body.loc == "crew_island" and crew else body.loc if body.loc == "harbour" or body.loc in WATER_BY_KEY else "harbour"')])
c = open('/app/frontend/public/ui.css').read()
c += '''
.wm-dot { display: block; width: clamp(22px, 3vw, 42px); height: clamp(22px, 3vw, 42px); border-radius: 50%; overflow: hidden; border: 3px solid #e2b45a; box-shadow: 0 0 0 2px #3a240f, 0 4px 8px rgba(0, 0, 0, .6); background: #0a2a44; }
.wm-dot img { width: 100% !important; height: 100% !important; object-fit: cover; animation: none !important; filter: none !important; }
.wm-pin.locked .wm-dot { filter: grayscale(1) brightness(.6); }
.wm-pin.here .wm-dot { border-color: #7ff3ff; box-shadow: 0 0 0 2px #08303f, 0 0 14px #7ff3ff; }
'''
open('/app/frontend/public/ui.css', 'w').write(c)
print('ok')
