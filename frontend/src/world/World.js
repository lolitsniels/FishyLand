import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Coins, Zap, Gem, Users, LogOut } from "lucide-react";
import Scene from "../game/Scene";
import { sceneFor } from "../game/scenes";
import { fx } from "../game/fx";
import { useGame } from "../store";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { api } from "../tfl/lib/api";
import TensionGame from "../tfl/components/TensionGame";
import Modal from "../components/panels/Modal";
import { Ring, Bar } from "../components/fr";
import { useFight } from "./useFight";
import { startMusic } from "../game/sfx";
import CatchCard from "./CatchCard";

export const PAGES = {
  inventory: ["Tackle Box", "inventory"], journal: ["Fishdex", "fishdex"], shop: ["Tackle Shop", "bait"], waters: ["Travel Map", "rod"], profile: ["My Angler", "skills"],
  quests: ["Quests", "quests"], contracts: ["Contracts", "daily"], market: ["Market", "market"], crews: ["Guild Hall", "crew"], tournaments: ["Tournaments", "rankings"],
  duel: ["Duel Pier", "guild"], leaderboards: ["Leaderboards", "rankings"], achievements: ["Achievements", "daily"], crafting: ["Bait Crafting", "craft"],
  messages: ["Messages", "pass"], almanac: ["Almanac", "fishdex"], wiki: ["Wiki", "skills"], "pearl-shop": ["Pearl Shop", "pass"], admin: ["Admin", "settings"],
};
const BAR_L = ["waters", "journal", "inventory"];
const BAR_R = ["shop", "profile"];
const MORE = ["pearl-shop", "quests", "contracts", "market", "crews", "tournaments", "duel", "leaderboards", "achievements", "crafting", "messages", "almanac", "wiki"];

function useScale() {
  const calc = () => { const w = window.visualViewport?.width || window.innerWidth, h = window.visualViewport?.height || window.innerHeight; return { s: Math.max(0.55, Math.min(1.15, w / 1000, h / 640)), w, h }; };
  const [v, setV] = useState(calc);
  useEffect(() => { const r = () => setV(calc()); window.addEventListener("resize", r); window.visualViewport?.addEventListener("resize", r); return () => { window.removeEventListener("resize", r); window.visualViewport?.removeEventListener("resize", r); }; }, []);
  return v;
}

function TopBar({ u, place, here }) {
  return (
    <div className="fr-panel flex items-center gap-3 px-3 py-2 pointer-events-auto" data-testid="player-panel">
      <div className="w-14 h-14 rounded-full overflow-hidden border-[3px] border-amber-300 bg-gradient-to-b from-cyan-700 to-slate-900 shrink-0">
        <img src="art/angler.png" alt="" className="w-[150%] max-w-none -ml-[12%]" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2"><span className="font-cinzel font-bold text-amber-50 outline-text" data-testid="player-name">{u.username}</span><span className="fr-chip px-2 text-[11px] font-cinzel font-black text-amber-200" data-testid="player-level">Lv.{u.level}</span></div>
        <div className="flex gap-2 text-xs font-cinzel font-bold flex-wrap">
          <span className="fr-chip px-2 flex items-center gap-1" data-testid="gold-value"><Coins size={12} color="#ffd34d" />{(u.gold ?? 0).toLocaleString()}</span>
          <span className="fr-chip px-2 flex items-center gap-1" title="Pearls are earned in game and only buy cosmetics" data-testid="pearls-value"><Gem size={12} color="#bff4ff" />{(u.pearls ?? 0).toLocaleString()}</span>
          <span className="fr-chip px-2 text-emerald-300" data-testid="location-chip">{place}</span>
          <span className="fr-chip px-2 flex items-center gap-1 text-cyan-200" title="Anglers here right now" data-testid="here-count"><Users size={12} />{here}</span>
        </div>
        <div className="flex items-center gap-1 w-[220px]"><Zap size={12} color="#7ff3ff" /><Bar value={u.energy} max={u.max_energy} className="flex-1" testid="energy-bar" /><span className="text-[10px] font-cinzel w-12 text-right" data-testid="energy-value">{Math.floor(u.energy)}/{u.max_energy}</span></div>
        <Bar value={u.xp_into_level ?? 0} max={u.xp_next || 1} color="linear-gradient(90deg,#b44dff,#ff8af0)" testid="xp-bar" />
      </div>
    </div>
  );
}

// Reports our position every 1.5 s and receives everyone else standing in the same harbour / water.
function usePresence(loc) {
  const [here, setHere] = useState(1);
  useEffect(() => {
    let alive = true;
    const send = () => api.post("/world/pos", { loc, x: fx.me.x, y: fx.me.y, phase: fx.phase }).then((r) => { if (alive) { fx.others = r.data.players; setHere(r.data.here); } }).catch(() => {});
    fx.others = [];
    send();
    const iv = setInterval(send, 1500);
    return () => { alive = false; clearInterval(iv); fx.others = []; };
  }, [loc]);
  return here;
}

function Hint({ children, testid = "walk-hint" }) {
  return <div className="absolute left-1/2 -translate-x-1/2 bottom-[150px] fr-chip px-4 py-1 text-xs font-cinzel text-amber-100 whitespace-nowrap" data-testid={testid}>{children}</div>;
}

export default function World() {
  const { user, data, logout } = useTfl();
  const nav = useNavigate();
  const loc = useLocation();
  const { s, w, h } = useScale();
  const { cast, finish, closeResult } = useFight();
  const fightEnc = useGame((st) => st.fightEnc);
  const result = useGame((st) => st.result);
  const ph = useGame((st) => st.phase);
  const [mode, setMode] = useState(fx.mode);
  const [near, setNear] = useState(null);
  const [atSpot, setAtSpot] = useState(null);
  const [more, setMore] = useState(false);
  const prevWater = useRef(null);
  const page = loc.pathname.replace(/^\/game\/?/, "").split("/")[0];
  const water = data?.waters?.find((x) => x.key === user?.water);
  const here = usePresence(mode === "harbour" ? "harbour" : user?.water || "harbour");

  const goTo = (m) => { fx.mode = m; fx.me = { ...sceneFor(m === "harbour" ? "harbour" : "water").spawn }; fx.dest = null; fx.autoOpen = null; fx.flip = false; setMode(m); };

  useEffect(() => { if (page === "fish") { goTo("water"); nav("/game", { replace: true }); } }, [page, nav]);
  useEffect(() => {
    if (!user?.water) return;
    if (prevWater.current && prevWater.current !== user.water) { goTo("water"); nav("/game", { replace: true }); }
    prevWater.current = user.water;
  }, [user?.water, nav]);
  useEffect(() => { fx.username = user?.username || ""; fx.title = user?.active_title || ""; }, [user]);
  useEffect(() => {
    fx.openSpot = (id) => {
      if (id === "boat") nav("/game/waters");
      else if (id === "harbour") goTo("harbour");
      else nav(`/game/${id}`);
    };
    const iv = setInterval(() => { setNear(fx.near); setAtSpot(fx.atSpot); }, 150);
    const map = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down" };
    const typing = (e) => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName);
    const down = (e) => {
      if (typing(e)) return;
      startMusic();
      if (map[e.code]) { fx.keys.add(map[e.code]); e.preventDefault(); }
      if (e.code === "KeyE" && fx.near && fx.phase === "idle") fx.openSpot(fx.near);
      if (e.code === "Space" && !e.repeat && fx.phase === "idle" && fx.atSpot) { e.preventDefault(); cast(); }
    };
    const up = (e) => map[e.code] && fx.keys.delete(map[e.code]);
    const blur = () => fx.keys.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { clearInterval(iv); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [nav, cast]);

  if (!user || !data) return <div className="fixed inset-0 grid place-items-center bg-[#04121c] gold-text font-deco text-2xl" data-testid="game-loading">Loading the harbour…</div>;
  const nearSpot = sceneFor(mode === "harbour" ? "harbour" : "water").spots.find((x) => x.id === near && !x.fish);
  const canFish = mode === "water" && !!atSpot;
  const title = PAGES[page]?.[0] || page;
  const idle = ph === "idle" && !result && !fightEnc;
  const fishLabel = mode !== "water" ? "SAIL" : ph === "fight" ? "REEL" : !idle ? "WAIT" : canFish ? "FISH" : "FIND SPOT";
  const onFish = () => { if (mode !== "water") nav("/game/waters"); else if (fx.phase === "idle" && fx.atSpot) cast(); };

  return (
    <div className="fixed inset-0 overflow-hidden select-none" data-testid="game-page" data-mode={mode} onPointerDown={() => startMusic()}>
      <Scene place={mode === "harbour" ? "harbour" : user.water || "millbrook"} />
      <div className="absolute top-0 left-0 origin-top-left pointer-events-none" style={{ width: w / s, height: h / s, transform: `scale(${s})` }} data-testid="game-hud">
        <div className="absolute top-3 left-3"><TopBar u={user} place={mode === "harbour" ? "The Harbour" : water?.name} here={here} /></div>
        {mode === "water" && idle && !page && (
          <button type="button" className="fr-btn fr-btn-dark absolute top-3 right-3 px-4 py-2 pointer-events-auto text-sm" onClick={() => goTo("harbour")} data-testid="back-harbour-button">Back to Harbour</button>
        )}
        {nearSpot && idle && !page && (
          <button type="button" className="fr-btn absolute left-1/2 -translate-x-1/2 bottom-[150px] px-6 py-2 pointer-events-auto pop" onClick={() => fx.openSpot(nearSpot.id)} data-testid="spot-prompt">
            {nearSpot.label} <span className="opacity-70 text-xs">[E]</span>
          </button>
        )}
        {mode === "harbour" && !nearSpot && idle && !page && <Hint>Tap to walk or use WASD · visit a signpost · board the Sea Serpent to travel</Hint>}
        {mode === "water" && idle && !nearSpot && !page && <Hint testid={canFish ? "cast-hint" : "walk-hint"}>{canFish ? "You're on a fishing spot · press FISH or Space" : "Walk onto a glowing fishing spot to cast"}</Hint>}
        {fightEnc && <div className="absolute left-1/2 -translate-x-1/2 bottom-[130px] w-[560px] max-w-[94%] pointer-events-auto tfl-skin" data-testid="fight-panel"><TensionGame enc={fightEnc} onFinish={finish} /></div>}
        {result && <div className="pointer-events-auto"><CatchCard res={result} onClose={closeResult} /></div>}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-auto fr-panel flex items-end gap-2.5 px-3 pt-1.5 pb-1" data-testid="action-bar">
          {BAR_L.map((k) => <Ring key={k} img={PAGES[k][1]} label={PAGES[k][0]} size={46} testid={`menu-${k}`} onClick={() => nav(`/game/${k}`)} />)}
          <button type="button" data-testid="cast-fish-button" disabled={mode === "water" && (!canFish || !idle)}
            onPointerDown={(e) => { e.preventDefault(); onFish(); }}
            className={`fish-btn w-[92px] h-[92px] -mt-6 grid place-items-center ${!idle ? "busy" : ""} ${mode === "water" && !canFish && idle ? "opacity-60 grayscale" : ""}`}>
            <span className={`font-deco font-black text-[#3a1c02] ${fishLabel.length > 5 ? "text-[11px] leading-tight text-center" : "text-lg"}`}>{fishLabel}</span>
          </button>
          {BAR_R.map((k) => <Ring key={k} img={PAGES[k][1]} label={PAGES[k][0]} size={46} testid={`menu-${k}`} onClick={() => nav(`/game/${k}`)} />)}
          <Ring img="settings" label="More" size={46} testid="menu-more" onClick={() => setMore(true)} />
        </div>
        {more && (
          <div className="pointer-events-auto"><Modal title="Menu" testid="more-modal" width={620} onClose={() => setMore(false)}>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-3 gap-y-4 py-2 justify-items-center">
              {[...MORE, ...(user.is_admin ? ["admin"] : [])].map((k) => <Ring key={k} img={PAGES[k][1]} label={PAGES[k][0]} size={52} testid={`more-${k}`} onClick={() => { setMore(false); nav(`/game/${k}`); }} />)}
            </div>
            <div className="flex justify-center mt-3">
              <button type="button" className="fr-btn fr-btn-dark px-5 py-1.5 text-sm flex items-center gap-2" onClick={async () => { await logout(); nav("/"); }} data-testid="logout-button"><LogOut size={14} /> Log out</button>
            </div>
          </Modal></div>
        )}
        {page && page !== "fish" && (
          <div className="pointer-events-auto"><Modal title={title} testid="page-modal" width={980} onClose={() => nav("/game")}>
            <div className="tfl-skin"><Outlet /></div>
          </Modal></div>
        )}
      </div>
    </div>
  );
}
