import { useEffect, useState } from "react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { initPortal, showInterstitial } from "../portal";
import { useGame, loadSettings } from "../store";
import { startMusic, applyAudio } from "../game/sfx";
import Game from "./Game";

function Start() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initPortal().then(() => { useGame.setState({ settings: loadSettings() }); applyAudio(); setReady(true); });
  }, []);
  // Play is the natural pre-roll point; the platform decides if an ad shows.
  const play = () => { startMusic(); showInterstitial(); nav("/play"); };
  return (
    <div className="fixed inset-0 overflow-hidden" data-testid="portal-start">
      <img src="art/landing.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(4,10,20,0.35)_0%,rgba(4,10,20,0.85)_80%)]" />
      <div className="relative h-full flex flex-col items-center justify-center gap-5 p-4">
        <img src="art/logo.png" alt="Fishing Realm" className="w-[min(420px,60vw)] max-h-[45vh] object-contain drop-shadow-[0_0_30px_rgba(255,200,60,0.5)] rise" />
        <button type="button" disabled={!ready} onClick={play} data-testid="portal-play-btn"
          className="fr-btn px-12 py-3 text-2xl flex items-center gap-3 rise disabled:opacity-60">
          <Play size={26} fill="#2a1503" /> {ready ? "PLAY" : "LOADING…"}
        </button>
      </div>
    </div>
  );
}

export default function PortalApp() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/play" element={<Game />} />
      </Routes>
    </MemoryRouter>
  );
}
