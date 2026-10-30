def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:80]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
patch('/app/frontend/src/world/World.js', [
    ('import CatchCard from "./CatchCard";', 'import CatchCard from "./CatchCard";\nimport { ChatBox } from "./ChatBox";\nimport { QuickTackle } from "./QuickTackle";'),
    ('        <div ref={barRef} className="absolute bottom-2 left-1/2', '        <ChatBox />\n        <QuickTackle />\n        <div ref={barRef} className="absolute bottom-2 left-1/2'),
    ('className={`fish-btn w-[92px] h-[92px] -mt-6 grid place-items-center ${!idle ? "busy" : ""}', 'style={{ backgroundImage: `url(/art/hud/${mode === "harbour" ? "sail" : "fishbtn"}.webp)` }}\n            className={`fish-btn fish-btn-img w-[96px] h-[96px] -mt-7 grid place-items-center ${!idle ? "busy" : ""}'),
    ('<span className={`font-deco font-black text-[#3a1c02] ${fishLabel.length > 5 ? "text-[11px] leading-tight text-center" : "text-lg"}`}>{fishLabel}</span>', '<span className="fish-btn-label">{fishLabel}</span>'),
])
patch('/app/frontend/src/game/fx.js', [('  path: [],\n', '  path: [],\n  bubbles: {},\n')])
print('ok')
