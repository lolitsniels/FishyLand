p = '/app/frontend/src/tfl/components/TensionGame.js'
s = open(p).read()
a = s.index('      <div className={`fish-instrument ${danger ? "fi-danger" : ""}`} data-testid="fight-instrument">')
b = s.index('      <button\n        ref={btnRef}')
new = '''      <div className={`fr-fight ${danger ? "shake" : ""}`} data-testid="fight-instrument">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className={`font-deco font-black text-xl ${danger ? "text-red-400" : inZone ? "gold-text" : "text-cyan-100"} outline-text`} data-testid="fight-message">{enc.boss && <span className="text-xs font-cinzel mr-2 text-amber-300" data-testid="boss-phase">{tt("Boss · phase")} {view.phase}/2</span>}{view.msg}</span>
          <span className="font-cinzel font-bold text-amber-100 outline-text num">{Math.max(0, view.time).toFixed(1)}s</span>
        </div>
        <div className="fr-panel p-1.5 !rounded-full">
          <div className="relative h-7 rounded-full overflow-hidden border border-black/70" data-testid="tension-frame"
            style={{ background: `linear-gradient(90deg, #ff2d2d 0%, #ff8a1f ${Math.max(2, view.zc - zw / 2 - 14)}%, #ffd33b ${Math.max(3, view.zc - zw / 2 - 2)}%, #3dff7f ${view.zc - zw / 2}%, #3dff7f ${view.zc + zw / 2}%, #ffd33b ${Math.min(97, view.zc + zw / 2 + 2)}%, #ff8a1f ${Math.min(98, view.zc + zw / 2 + 14)}%, #ff2d2d 100%)` }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/35" />
            <div className="absolute top-0 bottom-0 border-x-2 border-white/80 shadow-[0_0_12px_#3dff7f]" style={{ left: `${view.zc - zw / 2}%`, width: `${zw}%` }} data-testid={view.needle ? "needle-zone" : "tension-zone-box"} />
            <div className="absolute top-[-4px] bottom-[-4px] w-[7px] -ml-[3.5px] bg-white rounded shadow-[0_0_10px_#fff,0_0_22px_#7ff3ff]" style={{ left: `${view.tension}%` }} data-testid="tension-needle" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className={`font-cinzel font-black text-sm outline-text w-28 ${danger ? "text-red-400" : inZone ? "text-emerald-300" : "text-amber-300"}`} data-testid="tension-zone">{danger ? "SNAPPING!" : inZone ? "PERFECT" : "DANGER"}</span>
          <div className="flex-1 fr-bar !h-3.5" data-testid="progress-frame"><i style={{ width: `${view.progress}%`, background: "linear-gradient(90deg,#1fd3ff,#3dff7f,#fff2a6)", transition: "none" }} data-testid="progress-fill" /></div>
          <span className="font-cinzel font-bold text-sm text-amber-100 outline-text w-12 text-right num">{Math.round(view.progress)}%</span>
        </div>
        {view.beat && <BeatLane b={view.beat} />}
        {view.hook && <HookBar h={view.hook} />}
      </div>
'''
s = s[:a] + new + s[b:]
open(p, 'w').write(s)
print("fight ok")
