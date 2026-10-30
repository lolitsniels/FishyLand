import { useEffect, useState } from "react";
import { Lock, User } from "lucide-react";
import { api, fmt } from "../lib/api";

// Pin positions on art/hud/world_map.webp (1264x848), in %.
const PINS = {
  harbour: [54.6, 42.5], millbrook: [43.5, 34], willow: [26, 22.5], greyfell: [50, 17], saltmarsh: [34, 52], harrow: [15, 47],
  coral: [42.7, 75.5], blackwater: [85.5, 39], frozen: [85.5, 19], sunken: [71, 55.5], ghostlight: [88.6, 66], temple: [75, 81.5], cinder: [15, 80],
};
const goMode = (m) => window.dispatchEvent(new CustomEvent("fr-mode", { detail: m }));

export function WorldMap({ waters, user, mode, onTravel, expedition }) {
  const [sel, setSel] = useState(null);
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => api.get("/world/counts").then((r) => alive && setCounts(r.data.counts || {})).catch(() => {});
    load(); const iv = setInterval(load, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  const info = (w) => {
    const unlocked = w.premium ? !!user.premium && user.level >= w.level : user.unlocked_waters.includes(w.key);
    const can = w.premium ? !!user.premium && user.level >= w.level : user.level >= w.level && user.gold >= w.fee;
    return { unlocked, can };
  };
  const pick = sel === "harbour" ? null : waters.find((w) => w.key === sel);
  return (
    <div className="wm" data-testid="world-map" onClick={() => setSel(null)}>
      <img src="/art/hud/world_map.webp" alt="World map" className="wm-art" draggable={false} />
      {[["harbour", "The Harbour"], ...waters.map((w) => [w.key, w.name])].map(([key, name]) => {
        const w = waters.find((x) => x.key === key), st = w ? info(w) : { unlocked: true };
        const here = key === "harbour" ? mode === "harbour" : mode !== "harbour" && user.water === key;
        return (
          <button key={key} type="button" className={`wm-pin ${st.unlocked ? "" : "locked"} ${here ? "here" : ""} ${sel === key ? "on" : ""}`} style={{ left: `${PINS[key][0]}%`, top: `${PINS[key][1]}%` }}
            onClick={(e) => { e.stopPropagation(); setSel(key); }} data-testid={`map-pin-${key}`}>
            <span className="wm-dot"><img src={key === "harbour" ? "/art/hud/sail.webp" : `/art/waters/${key}_thumb.jpg`} alt="" /></span>
            {counts[key] > 0 && (
              <span className="absolute -top-1 -right-2 z-10 flex items-center gap-0.5 rounded-full bg-gradient-to-b from-[#5fe36a] to-[#1f9a2c] border-2 border-[#0d4d14] px-1.5 py-[1px] text-[11px] font-black text-white shadow-md [text-shadow:0_1px_0_#0a3a0f]" data-testid={`map-players-${key}`}>
                <User size={11} strokeWidth={3} />{counts[key]}
              </span>
            )}
            {expedition === key && <span className="wm-exp" data-testid={`map-expedition-${key}`}>Expedition</span>}
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
