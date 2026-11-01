import { useEffect, useRef, useState } from "react";
import { api } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { OFFLINE } from "../offline/bridge";

// Server-wide announcement: a gold banner slides across the top of everyone's screen whenever a mythic is landed.
export const announceMythic = (text) => window.dispatchEvent(new CustomEvent("fr-mythic", { detail: { id: `me-${Date.now()}`, text } }));

export function MythicBanner() {
  const { user } = useGame();
  const [queue, setQueue] = useState([]);
  const seen = useRef(new Set());
  const add = (a) => { if (seen.current.has(a.id)) return; seen.current.add(a.id); setQueue((q) => [...q, a]); };
  useEffect(() => {
    const on = (e) => add(e.detail);
    window.addEventListener("fr-mythic", on);
    if (OFFLINE) return () => window.removeEventListener("fr-mythic", on);
    let first = true;
    const pull = () => api.get("/alerts/live").then((r) => {
      r.data.filter((a) => a.rarity === "mythic" && a.status === "landed" && a.username !== user?.username).forEach((a) => (first ? seen.current.add(a.id) : add({ id: a.id, text: a.text })));
      first = false;
    }).catch(() => {});
    pull();
    const t = setInterval(pull, 8000);
    return () => { clearInterval(t); window.removeEventListener("fr-mythic", on); };
  }, [user?.username]); // eslint-disable-line
  const cur = queue[0];
  if (!cur) return null;
  return (
    <div className="mythic-banner" key={cur.id} data-testid="mythic-banner" onAnimationEnd={() => setQueue((q) => q.slice(1))}>
      <div className="mythic-banner-track">
        <img src="/art/hud/star_gold.webp" alt="" /><b>MYTHIC CATCH!</b><span data-testid="mythic-banner-text">{cur.text}</span><img src="/art/hud/star_gold.webp" alt="" />
      </div>
    </div>
  );
}
