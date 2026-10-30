import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { fmt } from "../lib/api";

// Pin positions on art/hud/world_map.webp (1264x848), in %.
const PINS = {
  harbour: [54.6, 42.5], millbrook: [43.5, 34], willow: [26, 22.5], greyfell: [50, 13], saltmarsh: [34, 52], harrow: [15, 47],
  coral: [42.7, 75.5], blackwater: [85.5, 39], frozen: [85.5, 15.5], sunken: [71, 55.5], ghostlight: [88.6, 66], temple: [75, 81.5], cinder: [15, 80],
};
const ROUTE = [[56, 50], [60, 60], [52, 66], [40, 62], [30, 58], [22, 64], [28, 72], [45, 88], [62, 70], [70, 62], [82, 52], [92, 50], [80, 46], [66, 48], [56, 50]];
const goMode = (m) => window.dispatchEvent(new CustomEvent("fr-mode", { detail: m }));

function Boat() {
  const ref = useRef(null);
  useEffect(() => {
    let raf, t0 = performance.now();
    const step = (now) => {
      const k = ((Math.max(0, now - t0) / 1000) * 0.035) % 1, f = k * (ROUTE.length - 1), i = Math.floor(f), u = f - i;
      const [ax, ay] = ROUTE[i], [bx, by] = ROUTE[i + 1];
      if (ref.current) { ref.current.style.left = `${ax + (bx - ax) * u}%`; ref.current.style.top = `${ay + (by - ay) * u}%`; ref.current.style.transform = `translate(-50%,-80%) scaleX(${bx < ax ? -1 : 1})`; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <img ref={ref} src="/art/hud/boat.webp" alt="" className="wm-boat" />;
}

export function WorldMap({ waters, user, mode, onTravel }) {
  const [sel, setSel] = useState(null);
  const info = (w) => {
    const unlocked = w.premium ? !!user.premium && user.level >= w.level : user.unlocked_waters.includes(w.key);
    const can = w.premium ? !!user.premium && user.level >= w.level : user.level >= w.level && user.gold >= w.fee;
    return { unlocked, can };
  };
  const pick = sel === "harbour" ? null : waters.find((w) => w.key === sel);
  return (
    <div className="wm" data-testid="world-map" onClick={() => setSel(null)}>
      <img src="/art/hud/world_map.webp" alt="World map" className="wm-art" draggable={false} />
      <div className="wm-shimmer" /><div className="wm-clouds" />
      <Boat />
      {[["harbour", "The Harbour"], ...waters.map((w) => [w.key, w.name])].map(([key, name]) => {
        const w = waters.find((x) => x.key === key), st = w ? info(w) : { unlocked: true };
        const here = key === "harbour" ? mode === "harbour" : mode !== "harbour" && user.water === key;
        return (
          <button key={key} type="button" className={`wm-pin ${st.unlocked ? "" : "locked"} ${here ? "here" : ""} ${sel === key ? "on" : ""}`} style={{ left: `${PINS[key][0]}%`, top: `${PINS[key][1]}%` }}
            onClick={(e) => { e.stopPropagation(); setSel(key); }} data-testid={`map-pin-${key}`}>
            <img src="/art/hud/pin.webp" alt="" />
            <span className="wm-label">{name}{!st.unlocked && <Lock size={10} className="inline ml-1 -mt-0.5" />}</span>
          </button>
        );
      })}
      {sel && (
        <div className="wm-pop" style={{ left: `${Math.min(78, Math.max(22, PINS[sel][0]))}%`, top: `${PINS[sel][1] > 55 ? PINS[sel][1] - 4 : PINS[sel][1] + 6}%`, transform: `translate(-50%, ${PINS[sel][1] > 55 ? "-100%" : "0"})` }}
          onClick={(e) => e.stopPropagation()} data-testid="map-popover">
          {sel === "harbour" ? (
            <>
              <div className="wm-pop-t">The Harbour</div>
              <p className="wm-pop-s">Shops, guild hall, market and the Sea Serpent. No fishing here.</p>
              {mode === "harbour" ? <div className="wm-pop-s mt-2">You are here</div> : <button type="button" className="btn btn-gold btn-sm mt-2" onClick={() => goMode("harbour")} data-testid="map-go-harbour">Sail to the Harbour</button>}
            </>
          ) : (() => {
            const st = info(pick), here = user.water === pick.key;
            return (
              <>
                <img src={`/art/waters/${pick.key}_thumb.jpg`} alt="" className="wm-pop-img" />
                <div className="wm-pop-t">{pick.name}</div>
                <p className="wm-pop-s">Level {pick.level}{!st.unlocked && !pick.premium ? ` · passage ${fmt(pick.fee)} gold` : ""}{pick.premium ? " · Angler Pass" : ""}</p>
                {here ? <button type="button" className="btn btn-gold btn-sm mt-2" onClick={() => goMode("water")} data-testid="map-fish-here">{mode === "harbour" ? "Sail here and fish" : "You are here"}</button>
                  : <button type="button" className="btn btn-gold btn-sm mt-2" disabled={!st.unlocked && !st.can} onClick={() => onTravel(pick.key)} data-testid="map-travel">{st.unlocked ? "Travel" : st.can ? "Pay passage & travel" : user.level < pick.level ? `Needs level ${pick.level}` : "Not enough gold"}</button>}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
