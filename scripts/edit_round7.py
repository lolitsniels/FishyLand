import re
import subprocess
S = "/app/frontend/src/"


def edit(p, pairs):
    s = open(S + p).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b)
    open(S + p, "w").write(s)


# 1. remove scrolling ticker
edit("pages/Landing.js", [("      <CatchTicker catches={catches} />\n", "")])

# 2. rename everywhere in UI strings
out = subprocess.run(["grep", "-rl", "Fishing Lands", S, "/app/frontend/public/index.html"], capture_output=True, text=True).stdout.split()
for f in out:
    s = open(f).read()
    s2 = s.replace("The Fishing Lands", "Fishing Realms").replace("Fishing Lands", "Fishing Realms")
    if s2 != s:
        open(f, "w").write(s2)
print("renamed in", len(out), "files")

# 3. living harbour: animated fountain spouts + mist
edit("game/scenes.js", [("  falls: [], mist: [],\n  sparkle: [X0 + 800, 620, 464, 228],",
                         "  falls: [[790, 385, 22, 58], [764, 400, 16, 42], [838, 400, 16, 42]], mist: [[805, 445], [780, 448], [835, 448]],\n  sparkle: [X0 + 800, 620, 464, 228],")])

# 4. sleek dark glass skin for panels, menus and tiles
css = '''
/* ===== Sleek dark glass theme (menus, HUD, tiles) ===== */
.fr-panel { background: linear-gradient(180deg, rgba(16, 26, 40, .78), rgba(6, 12, 20, .86)) !important; border: 1px solid rgba(255, 255, 255, .12) !important; border-radius: 14px !important;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .5), inset 0 1px 0 rgba(255, 255, 255, .10), 0 18px 40px rgba(0, 0, 0, .55) !important; backdrop-filter: blur(18px) saturate(1.3); -webkit-backdrop-filter: blur(18px) saturate(1.3); }
.fr-panel::before, .fr-panel::after, .fr-corner { display: none !important; }
.fr-modal { border-top: 1px solid rgba(246, 196, 69, .55) !important; }
.modal-banner { background: none !important; border: 0 !important; box-shadow: none !important; }
.modal-banner * { font-family: "Cinzel", serif !important; letter-spacing: .22em; text-transform: uppercase; font-size: 15px !important; color: #f3e2b0 !important; -webkit-text-fill-color: #f3e2b0 !important; }
.modal-banner::after { content: ""; display: block; height: 1px; margin: 8px auto 0; width: 70%; background: linear-gradient(90deg, transparent, #f6c445, transparent); }
html body .panel { background: rgba(255, 255, 255, .035) !important; border: 1px solid rgba(255, 255, 255, .09) !important; border-radius: 12px !important; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06) !important; }
html body .panel-head { background: transparent !important; border-bottom: 1px solid rgba(255, 255, 255, .08) !important; box-shadow: none !important; letter-spacing: .18em; font-weight: 700; color: #f3e2b0; text-shadow: none; }
html body .btn { background: rgba(255, 255, 255, .06) !important; border: 1px solid rgba(255, 255, 255, .16) !important; color: #eef3f8 !important; box-shadow: none !important; backdrop-filter: blur(6px); }
html body .btn:hover:not(:disabled) { background: rgba(255, 255, 255, .12) !important; border-color: rgba(246, 196, 69, .6) !important; box-shadow: 0 0 14px rgba(246, 196, 69, .25) !important; }
html body .btn-gold { background: linear-gradient(180deg, #f8d77a, #d9a232) !important; color: #1d1204 !important; border-color: #ffe7a3 !important; text-shadow: none !important; }
html body .input { background: rgba(0, 0, 0, .35) !important; border: 1px solid rgba(255, 255, 255, .14) !important; }
html body .table td { background: rgba(255, 255, 255, .03) !important; border-color: rgba(255, 255, 255, .06) !important; }
.g-card { background: linear-gradient(180deg, rgba(255, 255, 255, .06), rgba(255, 255, 255, .02)) !important; border: 1px solid color-mix(in srgb, var(--rc, #ffffff) 45%, transparent) !important; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08) !important; }
.g-tab { background: rgba(255, 255, 255, .04) !important; border: 1px solid rgba(255, 255, 255, .1) !important; }
.g-tab.on { background: rgba(246, 196, 69, .12) !important; border-color: rgba(246, 196, 69, .7) !important; box-shadow: 0 0 16px rgba(246, 196, 69, .25) !important; }
.g-hero { border: 1px solid rgba(255, 255, 255, .14) !important; box-shadow: 0 10px 30px rgba(0, 0, 0, .5) !important; }
.fr-btn { border-radius: 10px !important; }
.fr-btn-dark { background: rgba(255, 255, 255, .07) !important; border: 1px solid rgba(255, 255, 255, .18) !important; color: #eef3f8 !important; }
.fr-chip { background: rgba(0, 0, 0, .35) !important; border: 1px solid rgba(255, 255, 255, .12) !important; }
.fr-tile { background-image: none !important; border-radius: 12px; background: linear-gradient(180deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .02)) !important; border: 1px solid rgba(255, 255, 255, .16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .15), 0 6px 14px rgba(0, 0, 0, .5); }
.fr-tile-btn:hover .fr-tile { border-color: rgba(246, 196, 69, .8); }
.fr-tile-label { background: none !important; border: 0 !important; box-shadow: none !important; font-weight: 700 !important; letter-spacing: .06em; color: #e9eef4 !important; }
.fish-btn { border-radius: 16px !important; }
'''
open(S + "index.css", "a").write(css)
print("ok")
