import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { createGuest } from "../../lib/guest";
import { PORTAL_SOURCE, portalPlay } from "../../lib/portal";
import { LoginDrop } from "./LoginDrop";

// Game-style start screen for embedded builds (GameDistribution runs the pre-roll on Play; itch.io just starts): one Play click, optional login.
export function PortalStart() {
  const { user, login } = useGame();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const play = () => {
    setBusy(true);
    portalPlay(async () => {
      if (user) { nav("/game"); return; }
      try { const r = await createGuest(PORTAL_SOURCE || "itch.io"); login(r); nav("/game"); }
      catch (e) { toast.error(errMsg(e)); setBusy(false); }
    });
  };
  return (
    <div className="lp-page portal-start" data-testid="portal-start">
      <div className="lp-bg" aria-hidden="true"><div className="lp-bg-town" style={{ backgroundImage: "url(/art/landing_water.webp)" }} /></div>
      <div className="portal-start-in">
        <img src="/art/landing_logo.webp" alt="FishyLand" className="portal-logo" data-testid="portal-logo" />
        <p className="portal-tag">A free fishing MMO. Catch 400+ fish with players from all over the world.</p>
        <button type="button" className="lp-cta gd-play" onClick={play} disabled={busy} data-testid="portal-play">{busy ? "Casting..." : user ? `Continue as ${user.username}` : "Play"}</button>
        {!user && <div className="portal-login"><span>Have an account?</span><LoginDrop /></div>}
      </div>
      <img src="/art/landing_mascot.webp" alt="" className="portal-mascot" aria-hidden="true" />
    </div>
  );
}
