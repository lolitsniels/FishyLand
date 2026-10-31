import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { createGuest } from "../tfl/lib/guest";
import { ss } from "../offline/bridge";

// itch.io embed: the game opens on a game-style start screen sized to the player frame instead of the website homepage.
const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();
if (framed && new URLSearchParams(window.location.search).get("src") === "itch") ss.setItem("fl_start", "itch");
export const ITCH = framed && ss.getItem("fl_start") === "itch";

function LoginPanel({ onClose }) {
  const { login } = useGame();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api.post("/auth/login", { username: name.trim(), password: pw }); login(r.data); nav("/game"); }
    catch (ex) { setErr(errMsg(ex)); setBusy(false); }
  };
  return (
    <form className="itch-login p-4 flex flex-col gap-2.5" onSubmit={submit} data-testid="itch-login-form">
      <div className="font-cinzel font-bold text-amber-200 text-center">Log in</div>
      <input className="fl-input" placeholder="Angler name or email" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus data-testid="itch-login-name" />
      <input className="fl-input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" data-testid="itch-login-password" />
      {err && <div className="text-red-300 text-xs" data-testid="itch-login-error">{err}</div>}
      <div className="flex gap-2">
        <button type="button" className="fr-btn fr-btn-dark flex-1 py-2" onClick={onClose} data-testid="itch-login-cancel">Back</button>
        <button className="fr-btn flex-1 py-2" disabled={busy || name.trim().length < 2 || !pw} data-testid="itch-login-submit">{busy ? "..." : "Log in"}</button>
      </div>
    </form>
  );
}

export default function ItchStart() {
  const { user, login } = useGame();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const play = async () => {
    if (user) { nav("/game"); return; }
    setBusy(true);
    try { const r = await createGuest("itch.io"); login(r); nav("/game"); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  return (
    <div className="itch-start" style={{ backgroundImage: "url(/art/landing.jpg)" }} data-testid="itch-start">
      <img src="/art/hud/logo_fishyland.webp" alt="FishyLand" className="itch-logo" data-testid="itch-logo" />
      {showLogin ? <LoginPanel onClose={() => setShowLogin(false)} /> : (
        <div className="itch-actions">
          <button type="button" className="itch-play" onClick={play} disabled={busy} data-testid="itch-play">{busy ? "Casting..." : user ? `Play as ${user.username}` : "Play"}</button>
          {!user && <button type="button" className="fr-btn fr-btn-dark px-8 py-2 text-base" onClick={() => setShowLogin(true)} data-testid="itch-login">Log in</button>}
          <p className="itch-note">Play free as a guest. Claim your account in Settings any time for a welcome gift.</p>
        </div>
      )}
      <img src="/art/hud/mascot.webp" alt="" className="itch-mascot" aria-hidden="true" />
    </div>
  );
}
