import DuelLive from "./world/DuelLive";
import "@/App.css";
import "./tfl/tfl.css";
import "./tfl/game-skin.css";
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { OFFLINE } from "./offline/bridge";
import { Toaster } from "sonner";
import { GameProvider, useGame } from "./tfl/context/GameContext";
import Landing from "./pages/Landing";
import World from "./world/World";
import PublicWiki from "./tfl/pages/PublicWiki";
import ResetPassword from "./tfl/pages/ResetPassword";
import Privacy from "./tfl/pages/legal/Privacy";
import Terms from "./tfl/pages/legal/Terms";
import About from "./tfl/pages/legal/About";
import Contact from "./tfl/pages/legal/Contact";
import Waters from "./tfl/pages/game/Waters";
import Journal from "./tfl/pages/game/Journal";
import Inventory from "./tfl/pages/game/Inventory";
import Shop from "./tfl/pages/game/Shop";
import PearlShop from "./world/PearlShopSoon";
import Profile from "./tfl/pages/game/Profile";
import Quests from "./tfl/pages/game/Quests";
import Contracts from "./tfl/pages/game/Contracts";
import Market from "./tfl/pages/game/Market";
import Crews from "./tfl/pages/game/Crews";
import Tournaments from "./tfl/pages/game/Tournaments";
import Leaderboards from "./tfl/pages/game/Leaderboards";
import Achievements from "./tfl/pages/game/Achievements";
import Crafting from "./tfl/pages/game/Crafting";
import Messages from "./tfl/pages/game/Messages";
import Almanac from "./tfl/pages/game/Almanac";
import Wiki from "./tfl/pages/game/Wiki";
import Admin from "./tfl/pages/game/Admin";

function Protected({ children }) {
  const { user } = useGame();
  if (user === null) return <div className="fixed inset-0 grid place-items-center bg-[#04121c] gold-text font-deco text-2xl" data-testid="auth-checking">Checking the tide…</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

const GAME_PAGES = [
  ["waters", Waters], ["journal", Journal], ["inventory", Inventory], ["shop", Shop], ["pearl-shop", PearlShop], ["profile/:username?", Profile],
  ["quests", Quests], ["contracts", Contracts], ["market", Market], ["crews/:id?", Crews], ["tournaments", Tournaments], ["duel", DuelLive],
  ["leaderboards", Leaderboards], ["achievements", Achievements], ["crafting", Crafting], ["messages/:username?", Messages], ["almanac", Almanac], ["wiki", Wiki], ["admin", Admin],
];
// offline (portal) build: solo pages only, everything multiplayer waits for the online version
const OFFLINE_PAGES = new Set(["waters", "journal", "inventory", "shop", "profile/:username?"]);
const PAGES = OFFLINE ? GAME_PAGES.filter(([p]) => OFFLINE_PAGES.has(p)) : GAME_PAGES;
const Router = ({ children }) => (OFFLINE ? <MemoryRouter initialEntries={["/game"]}>{children}</MemoryRouter> : <BrowserRouter>{children}</BrowserRouter>);

function App() {
  return (
    <GameProvider>
      <Router>
        <Routes>
          <Route path="/" element={OFFLINE ? <Navigate to="/game" replace /> : <Landing />} />
          <Route path="/wiki" element={<PublicWiki />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/play" element={<Navigate to="/game" replace />} />
          <Route path="/game" element={<Protected><World /></Protected>}>
            <Route index element={null} />
            <Route path="fish" element={null} />
            {PAGES.map(([p, C]) => <Route key={p} path={p} element={<C />} />)}
          </Route>
          <Route path="*" element={<Navigate to={OFFLINE ? "/game" : "/"} replace />} />
        </Routes>
      </Router>
      <Toaster position="top-center" richColors theme="dark" toastOptions={{ style: { fontFamily: "Cinzel, serif", border: "1px solid #c8961f", background: "#1a0f07", color: "#fdf1cf" } }} />
    </GameProvider>
  );
}

export default App;
