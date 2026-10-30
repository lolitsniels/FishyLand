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
import { fishArt } from "./useFight";
import { toast } from "sonner";
import { ChatBox } from "./ChatBox";
import { QuickTackle } from "./QuickTackle";
import { lookFace } from "../game/look";

export const PAGES = {
  inventory: ["Tackle Box", "inventory"], journal: ["Fishdex", "fishdex"], shop: ["Tackle Shop", "/art/hud/tackle.webp"], waters: ["Travel Map", "map"], profile: ["My Angler", "skills"],
  quests: ["Quests", "quests"], contracts: ["Contracts", "daily"], market: ["Market", "market"], crews: ["Crew HQ", "crew"], tournaments: ["Tournaments", "rankings"],
  duel: ["Duel Pier", "guild"], leaderboards: ["Leaderboards", "rankings"], achievements: ["Achievements", "daily"], crafting: ["Bait Crafting", "craft"],
  messages: ["Messages", "pass"], almanac: ["Almanac", "fishdex"], wiki: ["Wiki", "skills"], "pearl-shop": ["Pearl Shop", "pass"], admin: ["Admin", "settings"],
};
const BAR_L = ["waters", "journal", "inventory"];
const BAR_R = ["shop", "profile"];
const BAR_R_WATER = ["quests", "profile"];
const placeOf = (m, user) => (m === "harbour" ? "harbour" : m === "crew" ? "crew_island" : user?.water || "millbrook");
// Only reachable from harbour buildings, never from a water.
const HARBOUR_ONLY = new Set(["shop", "market", "crews", "pearl-shop", "contracts", "crafting", "tournaments", "leaderboards", "achievements", "almanac", "duel", "crew", "bosses", "boss"]);
const MORE = ["pearl-shop", "quests", "contracts", "market", "crews", "tournaments", "duel", "leaderboards", "achievements", "crafting", "messages", "almanac", "wiki"];

function useScale() {
  const calc = () => { const w = window.visualViewport?.width || window.innerWidth, h = window.visualViewport?.height || window.innerHeight; return { s: Math.max(w < 600 ? 0.74 : 0.55, Math.min(1.15, w / 1000, h / 640)), w, h }; };
  const [v, setV] = useState(calc);
  useEffect(() => { const r = () => setV(calc()); window.addEventListener("resize", r); window.visualViewport?.addEventListener("resize", r); return () => { window.removeEventListener("resize", r); window.visualViewport?.removeEventListener("resize", r); }; }, []);
  return v;
}

const compact = (n = 0) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${Math.floor(n / 1e3)}K` : (n || 0).toLocaleString());

function TopBar({ u, place, here }) {
  return (
    <div className="pcard pointer-events-auto" data-testid="player-panel">
      <div className="pcard-face"><img src={lookFace(u.avatar)} alt="" data-testid="player-portrait" /></div>
      <span className="pcard-lv" data-testid="player-level">{u.level}</span>
      <div className="pcard-name" data-testid="player-name">{u.username}</div>
      <div className="pcard-place" data-testid="location-chip">{place} · <Users size={10} className="inline -mt-0.5" /> <span data-testid="here-count">{here}</span></div>
      <div className="pcard-bars" title={`Energy ${Math.floor(u.energy)}/${u.max_energy}`}>
        <Zap size={14} className="pcard-zap" fill="#ffd23f" color="#8a5a00" strokeWidth={1.5} /><div className="pcard-bar energy"><i style={{ width: `${Math.min(100, (u.energy / u.max_energy) * 100)}%` }} data-testid="energy-bar" /><span data-testid="energy-value">{Math.floor(u.energy)}/{u.max_energy}</span></div>
        <div className="pcard-bar xp"><i style={{ width: `${Math.min(100, ((u.xp_into_level ?? 0) / (u.xp_next || 1)) * 100)}%` }} data-testid="xp-bar" /></div>
      </div>
      <img src="/art/hud/gold.webp" alt="Gold" className="pcard-ic gold" /><b className="pcard-v gold" data-testid="gold-value">{compact(u.gold)}</b>
      <img src="/art/hud/pearl.webp" alt="Pearls" className="pcard-ic pearl" /><b className="pcard-v pearl" title="Pearls are earned in game and only buy cosmetics" data-testid="pearls-value">{compact(u.pearls)}</b>
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
  const [mode, setMode] = useState(() => { fx.mode = sessionStorage.getItem("fr_mode") || fx.mode; fx.me = { ...sceneFor(placeOf(fx.mode, user)).spawn }; return fx.mode; });
  const [near, setNear] = useState(null);
  const [atSpot, setAtSpot] = useState(null);
  const [more, setMore] = useState(false);
  const prevWater = useRef(null);
  const page = loc.pathname.replace(/^\/game\/?/, "").split("/")[0];
  const water = data?.waters?.find((x) => x.key === user?.water);
  const here = usePresence(placeOf(mode, user));
  useEffect(() => { fx.leapArt = mode === "water" && data ? data.fish.filter((f) => f.water === user?.water).map((f) => fishArt(f.rarity, f.species_id ?? f.id)) : []; }, [mode, data, user?.water]);

  const goTo = (m) => { fx.mode = m; sessionStorage.setItem("fr_mode", m); fx.me = { ...sceneFor(placeOf(m, user)).spawn }; fx.dest = null; fx.path = []; fx.autoOpen = null; fx.flip = false; setMode(m); };

  useEffect(() => {
    if (mode !== "harbour" && page && HARBOUR_ONLY.has(page) && !(mode === "crew" && page === "crews")) { toast("That's in the harbour. Sail back to visit it.", { id: "harbour-only" }); nav("/game", { replace: true }); }
  }, [mode, page, nav]);
  useEffect(() => {
    const on = (e) => { goTo(e.detail); nav("/game", { replace: true }); };
    window.addEventListener("fr-mode", on);
    return () => window.removeEventListener("fr-mode", on);
  });
  useEffect(() => { if (page === "fish") { goTo("water"); nav("/game", { replace: true }); } }, [page, nav]);
  useEffect(() => {
    if (!user?.water) return;
    if (prevWater.current && prevWater.current !== user.water) { goTo("water"); nav("/game", { replace: true }); }
    if (!prevWater.current && fx.mode === "water") fx.me = { ...sceneFor(user.water).spawn };
    prevWater.current = user.water;
  }, [user?.water, nav]);
  useEffect(() => { fx.username = user?.username || ""; fx.title = user?.active_title || ""; fx.look = user?.avatar; fx.rod = user?.gear?.rod || "rod_cane"; }, [user]);
  useEffect(() => {
    fx.openSpot = (id) => {
      if (id === "boat") nav("/game/waters");
      else if (id === "harbour") goTo("harbour");
      else if (id === "crew-pond") toast("The crew pond has no fish yet. Your crew can stock it soon.", { id: "crew-pond" });
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

  const barRef = useRef(null);
  const [barK, setBarK] = useState(1);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return undefined;
    const fit = () => setBarK(Math.min(1, (w / s - 12) / el.offsetWidth));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [w, s, user, data]);
  if (!user || !data) return <div className="fixed inset-0 grid place-items-center bg-[#04121c] gold-text font-deco text-2xl" data-testid="game-loading">Loading the harbour…</div>;
  const nearSpot = sceneFor(placeOf(mode, user)).spots.find((x) => x.id === near && !x.fish);
  const canFish = mode === "water" && !!atSpot;
  const title = PAGES[page]?.[0] || page;
  const idle = ph === "idle" && !result && !fightEnc;
  const fishLabel = mode !== "water" ? "SAIL" : ph === "fight" ? "REEL" : !idle ? "WAIT" : canFish ? "FISH" : "FIND SPOT";
  const onFish = () => { if (mode !== "water") nav("/game/waters"); else if (fx.phase === "idle" && fx.atSpot) cast(); };

  return (
    <div className="fixed inset-0 overflow-hidden select-none" data-testid="game-page" data-mode={mode} onPointerDown={() => startMusic()}>
      <Scene place={placeOf(mode, user)} />
      <div className="absolute top-0 left-0 origin-top-left pointer-events-none" style={{ width: w / s, height: h / s, transform: `scale(${s})` }} data-testid="game-hud">
        <div className="absolute top-3 left-3"><TopBar u={user} place={mode === "harbour" ? "The Harbour" : mode === "crew" ? `${user.crew?.name || "Crew"} Island` : water?.name} here={here} /></div>
        {mode === "water" && idle && !page && (
          <button type="button" className="fr-btn fr-btn-dark absolute right-3 px-4 py-2 pointer-events-auto text-sm" style={{ top: w < 700 ? 120 : 12 }} onClick={() => goTo("harbour")} data-testid="back-harbour-button">Back to Harbour</button>
        )}
        {nearSpot && idle && !page && (
          <div className="absolute inset-x-0 bottom-[150px] flex justify-center">
            <button type="button" className="fr-btn px-6 py-2 pointer-events-auto pop whitespace-nowrap" onClick={() => fx.openSpot(nearSpot.id)} data-testid="spot-prompt">
              {nearSpot.label} <span className="opacity-70 text-xs">[E]</span>
            </button>
          </div>
        )}
        {mode === "harbour" && !nearSpot && idle && !page && <Hint>Tap to walk or use WASD · visit a signpost · board the Sea Serpent to travel</Hint>}
        {mode === "water" && idle && !nearSpot && !page && <Hint testid={canFish ? "cast-hint" : "walk-hint"}>{canFish ? "You're on a fishing spot · press FISH or Space" : "Walk onto a glowing fishing spot to cast"}</Hint>}
        {fightEnc && <div className="absolute left-1/2 -translate-x-1/2 bottom-[130px] w-[560px] max-w-[94%] pointer-events-auto tfl-skin" data-testid="fight-panel"><TensionGame enc={fightEnc} onFinish={finish} /></div>}
        {result && <div className="pointer-events-auto"><CatchCard res={result} onClose={closeResult} /></div>}
        <ChatBox />
        <QuickTackle />
        <div ref={barRef} className="absolute bottom-2 left-1/2 pointer-events-auto fr-panel flex items-end gap-2.5 px-3 pt-1.5 pb-1" style={{ transform: `translateX(-50%) scale(${barK})`, transformOrigin: "50% 100%" }} data-testid="action-bar">
          {BAR_L.map((k) => <Ring key={k} img={PAGES[k][1]} label={PAGES[k][0]} size={w < 600 ? 36 : 46} testid={`menu-${k}`} onClick={() => nav(`/game/${k}`)} />)}
          <button type="button" data-testid="cast-fish-button" disabled={mode === "water" && (!canFish || !idle)}
            onPointerDown={(e) => { e.preventDefault(); onFish(); }}
            style={{ backgroundImage: `url(/art/hud/${mode === "harbour" ? "sail" : "fishbtn"}.webp)` }}
            className={`fish-btn fish-btn-img w-[96px] h-[96px] -mt-7 grid place-items-center ${ph === "fight" ? "invisible" : ""} ${!idle ? "busy" : ""} ${mode === "water" && !canFish && idle ? "opacity-60 grayscale" : ""}`}>
            <span className="fish-btn-label">{fishLabel}</span>
          </button>
          {(mode !== "harbour" ? BAR_R_WATER : BAR_R).map((k) => <Ring key={k} img={k === "profile" ? lookFace(user.avatar) : PAGES[k][1]} label={PAGES[k][0]} size={w < 600 ? 36 : 46} testid={`menu-${k}`} onClick={() => nav(`/game/${k}`)} />)}
          <Ring img="settings" label="More" size={w < 600 ? 36 : 46} testid="menu-more" onClick={() => setMore(true)} />
        </div>
      </div>
      {more && (
        <Modal title="Menu" testid="more-modal" width={620} onClose={() => setMore(false)}>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-3 gap-y-4 py-2 justify-items-center">
            {[...MORE, ...(user.is_admin ? ["admin"] : [])].filter((k) => mode === "harbour" || !HARBOUR_ONLY.has(k)).map((k) => <Ring key={k} img={PAGES[k][1]} label={PAGES[k][0]} size={52} testid={`more-${k}`} onClick={() => { setMore(false); nav(`/game/${k}`); }} />)}
          </div>
          <div className="flex justify-center mt-3">
            <button type="button" className="fr-btn fr-btn-dark px-5 py-1.5 text-sm flex items-center gap-2" onClick={async () => { await logout(); nav("/"); }} data-testid="logout-button"><LogOut size={14} /> Log out</button>
          </div>
        </Modal>
      )}
      {page && page !== "fish" && (
        <Modal title={title} testid="page-modal" width={980} onClose={() => nav("/game")}>
          <div className="tfl-skin"><Outlet /></div>
        </Modal>
      )}
    </div>
  );
}
