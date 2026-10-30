import { useEffect, useRef } from "react";
import { useGame } from "../../store";
import { fx } from "../../game/fx";
import { t } from "../../i18n";

const ZONE_TXT = ["PERFECT", "GOOD", "DANGER", "SNAPPING!"];
const ZONE_COL = ["#3dff7f", "#fff06a", "#ffa53b", "#ff3b3b"];

export default function TensionBar() {
  const phase = useGame((s) => s.phase);
  const lostMsg = useGame((s) => s.lostMsg);
  const needle = useRef(null), fill = useRef(null), zone = useRef(null), timer = useRef(null), wrap = useRef(null);
  const active = phase === "fight" || phase === "bite" || phase === "resolving";

  useEffect(() => {
    if (!active) return;
    let id;
    const loop = () => {
      if (needle.current) needle.current.style.left = `${fx.pos * 100}%`;
      if (fill.current) fill.current.style.width = `${fx.fill * 100}%`;
      if (zone.current) { zone.current.textContent = ZONE_TXT[fx.zone]; zone.current.style.color = ZONE_COL[fx.zone]; }
      if (timer.current) timer.current.textContent = `${Math.max(0, (fx.limit - fx.tick) / 30).toFixed(1)}s`;
      if (wrap.current) wrap.current.classList.toggle("shake", fx.zone === 3 || Math.abs(fx.trick) > 0.5);
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(id);
  }, [active]);

  if (lostMsg) {
    return <div className="pop font-deco text-3xl font-black text-red-400 outline-text" data-testid="fight-lost-message">{lostMsg}</div>;
  }
  if (phase === "wait") return <div className="font-cinzel text-lg text-cyan-100 outline-text animate-pulse" data-testid="waiting-message">Waiting for a bite…</div>;
  if (!active) return null;
  return (
    <div className="flex flex-col items-center gap-1.5 pop" data-testid="tension-minigame">
      <div className="font-deco font-black text-2xl gold-text" data-testid="tension-callout">{phase === "bite" ? t("bite") : t("keepGreen")}</div>
      <div ref={wrap} className="relative w-[min(560px,60vw)]">
        <div className="fr-panel p-1.5 !rounded-full">
          <div className="tension-track relative h-6 rounded-full overflow-hidden border border-black/70 shadow-inner" data-testid="tension-bar">
            <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/30" />
            <div ref={needle} className="absolute top-[-6px] bottom-[-6px] w-[6px] -ml-[3px] bg-white rounded shadow-[0_0_10px_#fff,0_0_20px_#7ff3ff]" style={{ left: "50%" }} data-testid="tension-bar-needle" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 w-[min(480px,52vw)]">
        <span ref={zone} className="font-cinzel font-black text-sm outline-text w-24" data-testid="tension-zone">PERFECT</span>
        <div className="flex-1 fr-bar !h-3" data-testid="catch-meter"><i ref={fill} style={{ width: "15%", background: "linear-gradient(90deg,#1fd3ff,#3dff7f,#fff2a6)", transition: "none" }} /></div>
        <span ref={timer} className="font-cinzel font-bold text-sm text-amber-100 outline-text w-12 text-right" data-testid="fight-timer">--</span>
      </div>
      <div className="text-[11px] text-amber-100/80 outline-text">{t("hold")}</div>
    </div>
  );
}
