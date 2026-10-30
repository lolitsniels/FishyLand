import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Smartphone } from "lucide-react";
import Scene from "../game/Scene";
import { useFishing } from "../game/useFishing";
import { fx } from "../game/fx";
import { useGame } from "../store";
import { api, tokens } from "../lib/api";
import { t } from "../i18n";
import { PORTAL, onPause } from "../portal";
import { startMusic, applyAudio } from "../game/sfx";
import Tutorial from "../components/hud/Tutorial";
import PlayerPanel from "../components/hud/PlayerPanel";
import EventGrid from "../components/hud/EventGrid";
import { Minimap, Tracker } from "../components/hud/Minimap";
import LeftRail from "../components/hud/LeftRail";
import ChatBox from "../components/hud/ChatBox";
import ActionBar from "../components/hud/ActionBar";
import TensionBar from "../components/hud/TensionBar";
import CatchPopup from "../components/hud/CatchPopup";
import InventoryPanel from "../components/panels/InventoryPanel";
import GearPanel from "../components/panels/GearPanel";
import ShopPanel from "../components/panels/ShopPanel";
import FishdexPanel from "../components/panels/FishdexPanel";
import { WatersPanel, SettingsPanel, AccountPanel, ComingSoon } from "../components/panels/MiscPanels";

function useHudScale() {
  const calc = () => {
    const w = window.visualViewport?.width || window.innerWidth, h = window.visualViewport?.height || window.innerHeight, ar = w / h;
    const square = ar >= 0.8 && ar <= 1.25 && w < 1000;
    if (square) return { scale: Math.max(0.5, Math.min(w / 780, h / 720)), compact: true, square, vw: w, vh: h };
    const compact = h < 520;
    const sc = compact ? Math.min(w / 1100, h / 600)
      : PORTAL ? Math.min(1.15, w / 1000, h / 640)
      : Math.min(1.15, w / 1420, h / 790);
    return { scale: Math.max(0.45, sc), compact, square: false, vw: w, vh: h };
  };
  const [s, setS] = useState(calc);
  useEffect(() => {
    const r = () => setS(calc());
    window.addEventListener("resize", r); window.visualViewport?.addEventListener("resize", r); window.addEventListener("orientationchange", r);
    return () => { window.removeEventListener("resize", r); window.visualViewport?.removeEventListener("resize", r); window.removeEventListener("orientationchange", r); };
  }, []);
  return s;
}

function ModalHost() {
  const m = useGame((s) => s.modal);
  if (!m) return null;
  const map = { inventory: InventoryPanel, gear: GearPanel, shop: ShopPanel, fishdex: FishdexPanel, waters: WatersPanel, settings: SettingsPanel, account: AccountPanel };
  if (m.type === "soon") return <ComingSoon {...m} />;
  const C = map[m.type];
  return C ? <C /> : null;
}

const RotateOverlay = () => (
  <div className="rotate-overlay hidden fixed inset-0 z-[100] bg-[#04121c] flex-col items-center justify-center gap-4 text-center p-8" data-testid="rotate-overlay">
    <img src="art/logo.png" alt="" className="w-56" />
    <Smartphone size={48} className="text-amber-300 rotate-90 animate-pulse" />
    <div className="gold-text font-deco text-xl font-black">{t("rotate")}</div>
    <div className="text-sm text-amber-100/70">{t("rotateSub")}</div>
  </div>
);

function PauseOverlay() {
  const paused = useGame((s) => s.paused);
  const needTap = useGame((s) => s.needTap);
  if (!paused && !needTap) return null;
  const resume = () => { if (!paused) { useGame.setState({ needTap: false }); applyAudio(); } };
  return (
    <div className="absolute inset-0 z-[90] grid place-items-center bg-black/70 pointer-events-auto" onPointerDown={resume} data-testid="pause-overlay">
      <div className="flex flex-col items-center gap-3">
        <div className="gold-text font-deco text-3xl font-black">Paused</div>
        {!paused && <button type="button" className="fr-btn px-8 py-2 text-lg" data-testid="resume-btn">Tap to Continue</button>}
      </div>
    </div>
  );
}

function Hud() {
  const { cast, closeResult } = useFishing();
  const { scale, compact, square, vw, vh } = useHudScale();
  const showFps = useGame((s) => s.settings.fps);
  return (
    <div className="absolute top-0 left-0 origin-top-left pointer-events-none" style={{ width: vw / scale, height: vh / scale, transform: `scale(${scale})` }} data-testid="game-hud" data-layout={square ? "square" : compact ? "compact" : "full"}>
      <div className="absolute top-3 left-3 pointer-events-auto"><PlayerPanel /></div>
      <div className="absolute top-3 right-3 flex gap-3 items-start pointer-events-auto">
        {!PORTAL && <EventGrid compact={compact} />}
        <div className="flex flex-col gap-2"><Minimap />{!compact && <Tracker />}</div>
      </div>
      {!PORTAL && <div className={`absolute left-4 ${compact ? "top-[165px]" : "top-[200px]"} pointer-events-auto`}><LeftRail /></div>}
      <div className={`absolute left-3 pointer-events-auto ${square ? "bottom-[128px]" : "bottom-3"}`}><ChatBox compact={compact} /></div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto"><ActionBar cast={cast} /></div>
      <div className={`absolute -translate-x-1/2 ${square ? "bottom-[175px] left-1/2" : "bottom-[200px] left-[60%]"}`}><TensionBar /></div>
      <div id="fps-meter" className={`absolute top-1 left-1/2 -translate-x-1/2 fr-chip px-2 text-[11px] font-cinzel ${showFps ? "" : "hidden"}`} data-testid="fps-meter" />
      <div className="pointer-events-auto"><CatchPopup onClose={closeResult} /></div>
      <div className="pointer-events-auto"><ModalHost /></div>
      <Tutorial />
      <PauseOverlay />
    </div>
  );
}

export default function Game() {
  const nav = useNavigate();
  const player = useGame((s) => s.player);
  const data = useGame((s) => s.data);
  const { setPlayer, setData } = useGame.getState();

  useEffect(() => {
    if (!tokens.has()) { nav("/"); return; }
    Promise.all([api.get("/game/data"), api.get("/player")])
      .then(([d, p]) => { setData(d.data); setPlayer(p.data); if (!useGame.getState().system.length) useGame.getState().pushSystem("Welcome to Crystal Lagoon! Press FISH or Space to cast.", "info"); })
      .catch(() => { tokens.clear(); nav("/"); });
  }, [nav, setData, setPlayer]);

  useEffect(() => {
    let hadAd = false;
    const off = onPause((reasons) => {
      const paused = [...reasons].some((r) => r !== "audio");
      useGame.setState({ platformMuted: reasons.has("audio") });
      if (reasons.has("ad")) hadAd = true;
      const st = { paused };
      if (!paused && hadAd) { st.needTap = true; hadAd = false; }
      fx.hold = false;
      useGame.setState(st);
      applyAudio();
    });
    const first = () => startMusic();
    window.addEventListener("pointerdown", first, { once: true });
    window.addEventListener("keydown", first, { once: true });
    return () => { off(); window.removeEventListener("pointerdown", first); window.removeEventListener("keydown", first); };
  }, []);

  useEffect(() => {
    if (player) { fx.username = PORTAL ? player.username : `${player.username}  ·  VIP${player.vip_level}`; fx.title = player.equipped?.title || ""; }
  }, [player]);

  useEffect(() => {
    if (!player) return;
    const i = setInterval(() => { if (useGame.getState().phase === "idle") api.get("/player").then((r) => setPlayer(r.data)).catch(() => {}); }, 60000);
    return () => clearInterval(i);
  }, [player, setPlayer]);

  if (!player || !data) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-[#04121c]" data-testid="game-loading">
        <div className="flex flex-col items-center gap-3"><img src="art/logo.png" alt="" className="w-64 float-y" /><div className="font-cinzel text-amber-200 animate-pulse">Summoning the Realm…</div></div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 overflow-hidden select-none" data-testid="game-page">
      <Scene />
      <Hud />
      <RotateOverlay />
    </div>
  );
}
