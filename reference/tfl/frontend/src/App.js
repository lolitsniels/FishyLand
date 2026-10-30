/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "sonner";


import { api, IS_TOUCH } from "./lib/api";
import { getPrefs } from "./lib/prefs";
import { OLD_LANG_PATHS } from "./i18n";
import ServerStatus from "./components/ServerStatus";
import { GameProvider, useGame } from "./context/GameContext";
import Welcome from "./pages/Welcome";
import GameShell from "./pages/GameShell";
import Harbor from "./pages/game/Harbor";
import Fishing from "./pages/game/Fishing";
import Waters from "./pages/game/Waters";
import Journal from "./pages/game/Journal";
import Inventory from "./pages/game/Inventory";
import Shop from "./pages/game/Shop";
import Market from "./pages/game/Market";
import Leaderboards from "./pages/game/Leaderboards";
import Profile from "./pages/game/Profile";
import Tournaments from "./pages/game/Tournaments";
import Admin from "./pages/game/Admin";
import ModPanel from "./pages/game/ModPanel";
import TestWater from "./pages/game/TestWater";
import Duel from "./pages/game/Duel";
import Achievements from "./pages/game/Achievements";
import Messages from "./pages/game/Messages";
import Crews from "./pages/game/Crews";
import Crafting from "./pages/game/Crafting";
import Quests from "./pages/game/Quests";
import Wiki from "./pages/game/Wiki";
import PearlShop from "./pages/game/PearlShop";
import Support from "./pages/game/Support";
import Almanac from "./pages/game/Almanac";
import Recruit from "./pages/game/Recruit";
import Vote from "./pages/game/Vote";
import Halloween from "./pages/game/Halloween";
import Contracts from "./pages/game/Contracts";
import Play from "./pages/Play";
import Players from "./pages/game/Players";
import FishArtPreview from "./pages/FishArtPreview";
import ResetPassword from "./pages/ResetPassword";
import { GuidesIndex } from "./pages/guides/GuideShared";
import FishaoAlternatives from "./pages/guides/FishaoAlternatives";
import GamesLikeFishao from "./pages/guides/GamesLikeFishao";
import BestBrowserFishingGames from "./pages/guides/BestBrowserFishingGames";
import FishingMMO from "./pages/guides/FishingMMO";
import OnlineFishingGames from "./pages/guides/OnlineFishingGames";
import FishingPlanetAlternatives from "./pages/guides/FishingPlanetAlternatives";
import RussianFishing4Alternatives from "./pages/guides/RussianFishing4Alternatives";
import CotwAnglerAlternatives from "./pages/guides/CotwAnglerAlternatives";
import PublicWiki from "./pages/PublicWiki";
import Privacy from "./pages/legal/Privacy";
import Terms from "./pages/legal/Terms";
import About from "./pages/legal/About";
import Contact from "./pages/legal/Contact";
import { InstallPrompt } from "./components/InstallPrompt";
import { PORTAL, PORTAL_BLOCKED, PORTAL_SOURCE, START_SCREEN } from "./lib/portal";
import { t as tt } from "./i18n";

// Pop-up messages preference (Settings → Display): "all" | "errors" (only errors) | "off". Patched once, so every toast.* call honours it.
const _orig = { success: toast.success, info: toast.info, message: toast.message, warning: toast.warning, error: toast.error, plain: toast };
const _gate = (kind, fn) => (...a) => { const m = getPrefs().toasts || "all"; if (m === "off" || (m === "errors" && kind !== "error")) return undefined; return fn(...a); };
toast.success = _gate("success", _orig.success); toast.info = _gate("info", _orig.info); toast.message = _gate("message", _orig.message); toast.warning = _gate("warning", _orig.warning); toast.error = _gate("error", _orig.error);

function Protected({ children }) {
  const { user } = useGame();
  if (user === null) return <div className="min-h-screen flex items-center justify-center text-[var(--muted)]">{tt("Checking the tide...")}</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function useVisitTracking() {
  useEffect(() => {
    if (PORTAL) { localStorage.setItem("owo_source", PORTAL_SOURCE); localStorage.setItem("owo_source_page", `${PORTAL_SOURCE} · portal`); return; }
    if (sessionStorage.getItem("owo_visit")) return;
    sessionStorage.setItem("owo_visit", "1");
    const p = new URLSearchParams(window.location.search);
    if (!localStorage.getItem("owo_source")) {
      const host = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      const own = /thefishinglands\.com|localhost|emergentagent\.com|emergent\.sh/.test(host);
      localStorage.setItem("owo_source", (p.get("utm_source") || p.get("ref_site") || (own ? "" : host) || "direct / typed").toLowerCase());
      const utm = p.get("utm_source") || p.get("ref_site"), camp = p.get("utm_campaign");
      const path = document.referrer && !own ? new URL(document.referrer).pathname.replace(/\/+$/, "") : "";
      localStorage.setItem("owo_source_page", (utm ? (camp ? `${utm} · ${camp}` : utm) : host && !own ? host + path : "direct / typed").toLowerCase().slice(0, 300));
    }
    api.post("/track/visit", { referrer: document.referrer || "", path: window.location.pathname, utm_source: p.get("utm_source") || p.get("ref_site") || undefined, utm_campaign: p.get("utm_campaign") || undefined }).catch(() => {});
  }, []);
}

const isHalloween = (d = new Date()) => { const m = d.getUTCMonth(), day = d.getUTCDate(); return d.getUTCFullYear() === 2026 ? m >= 5 && m <= 9 : m === 9 && day >= 15; };

function App() {
  useVisitTracking();
  useEffect(() => { document.documentElement.classList.toggle("ev-halloween", isHalloween()); }, []);
  return (
    <GameProvider>
      <ServerStatus />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          {OLD_LANG_PATHS.map((c) => <Route key={c} path={`/${c}`} element={<Navigate to="/" replace />} />)}
          <Route path="/play" element={<Play />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
          <Route path="/guides" element={<GuidesIndex />} />
          <Route path="/guides/games-like-fishing-planet" element={<FishingPlanetAlternatives />} />
          <Route path="/guides/russian-fishing-4-alternatives" element={<RussianFishing4Alternatives />} />
          <Route path="/guides/call-of-the-wild-the-angler-alternatives" element={<CotwAnglerAlternatives />} />
          <Route path="/guides/fishao-alternatives" element={<FishaoAlternatives />} />
          <Route path="/guides/games-like-fishao" element={<GamesLikeFishao />} />
          <Route path="/guides/best-browser-fishing-games" element={<BestBrowserFishingGames />} />
          <Route path="/guides/fishing-mmo" element={<FishingMMO />} />
          <Route path="/guides/online-fishing-games" element={<OnlineFishingGames />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/wiki" element={<PublicWiki />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/preview/fish-art" element={<FishArtPreview />} />
          <Route path="/game" element={<Protected><GameShell /></Protected>}>
            {PORTAL && PORTAL_BLOCKED.map((p) => <Route key={p} path={p.replace("/game/", "")} element={<Navigate to="/game" replace />} />)}
            <Route index element={<Harbor />} />
            <Route path="fish" element={<Fishing />} />
            <Route path="waters" element={<Waters />} />
            <Route path="journal" element={<Journal />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="shop" element={<Shop />} />
            <Route path="market" element={<Market />} />
            <Route path="leaderboards" element={<Leaderboards />} />
            <Route path="profile/:username?" element={<Profile />} />
            <Route path="tournaments" element={<Tournaments />} />
            <Route path="contests" element={<Tournaments />} />
            <Route path="admin" element={<Admin />} />
            <Route path="mod" element={<ModPanel />} />
            <Route path="testwater" element={<TestWater />} />
            <Route path="duel" element={<Duel />} />
            <Route path="achievements" element={<Achievements />} />
            <Route path="messages/:username?" element={<Messages />} />
            <Route path="crews/:id?" element={<Crews />} />
            <Route path="crafting" element={<Crafting />} />
            <Route path="quests" element={<Quests />} />
            <Route path="wiki" element={<Wiki />} />
            <Route path="pearl-shop" element={<PearlShop />} />
            <Route path="support" element={<Support />} />
            <Route path="almanac" element={<Almanac />} />
            <Route path="recruit" element={<Recruit />} />
            <Route path="vote" element={<Vote />} />
            <Route path="halloween" element={<Halloween />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="players" element={<Players />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position={IS_TOUCH ? "top-center" : "bottom-right"} offset={IS_TOUCH ? undefined : 64} theme="dark" duration={4000} visibleToasts={3} closeButton toastOptions={{ style: { background: "#141211", border: "1px solid #3d3630", color: "#ece6df", borderRadius: 2 } }} />
      {!START_SCREEN && <InstallPrompt />}
    </GameProvider>
  );
}

export default App;
