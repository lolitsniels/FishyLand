import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { sfx } from "../lib/sound";

// Main pages only, never deep pages (a player's profile, a crew page, admin, settings...).
const PAGES = new Set(["/game", "/game/fish", "/game/waters", "/game/quests", "/game/contracts", "/game/journal", "/game/inventory", "/game/shop", "/game/pearl-shop",
  "/game/crafting", "/game/market", "/game/leaderboards", "/game/tournaments", "/game/crews", "/game/achievements", "/game/duel", "/game/halloween", "/game/vote", "/game/recruit"]);
const spot = () => ({ left: `${8 + Math.random() * 80}%`, top: `${28 + Math.random() * 56}%` });

export function HiddenPumpkin({ active }) {
  const { pathname } = useLocation();
  const { setUser } = useGame();
  const [p, setP] = useState(null);
  const [pos, setPos] = useState(spot);
  const [busy, setBusy] = useState(false);
  const page = PAGES.has(pathname.replace(/\/$/, "") || "/game");
  const check = useCallback(() => { if (active && page) api.get("/halloween/pumpkin").then((r) => setP(r.data.pumpkin)).catch(() => {}); }, [active, page]);
  useEffect(() => { setPos(spot()); check(); const t = setInterval(check, 60000); return () => clearInterval(t); }, [pathname, check]);
  useEffect(() => { if (!p) return; const t = setTimeout(() => setP(null), Math.max(0, new Date(p.expires) - Date.now())); return () => clearTimeout(t); }, [p]);
  if (!active || !page || !p) return null;
  const smash = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.post("/halloween/pumpkin", { token: p.token });
      setUser(r.data.user); setP(null); sfx("achievement", 0);
      toast.success(`You found a hidden pumpkin! +${r.data.candles} Soul Candles (${r.data.found}/${r.data.cap} today)`);
    } catch (e) { toast.error(errMsg(e)); setP(null); } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={smash} className="hidden-pumpkin" style={pos} title="A hidden pumpkin! Click it" aria-label="Hidden pumpkin" data-testid="hidden-pumpkin">
      <img src="/art/pumpkin.webp" alt="" draggable={false} />
    </button>
  );
}
