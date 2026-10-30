import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import PublicWiki, { PublicWikiShell, WIKI_TITLE, WIKI_DESC } from "../src/pages/PublicWiki";
import { WikiView } from "../src/pages/game/Wiki";
import Privacy from "../src/pages/legal/Privacy";
import Terms from "../src/pages/legal/Terms";
import About from "../src/pages/legal/About";
import Contact from "../src/pages/legal/Contact";
import { GuidesIndex } from "../src/pages/guides/GuideShared";
import FishaoAlternatives from "../src/pages/guides/FishaoAlternatives";
import GamesLikeFishao from "../src/pages/guides/GamesLikeFishao";
import BestBrowserFishingGames from "../src/pages/guides/BestBrowserFishingGames";
import FishingMMO from "../src/pages/guides/FishingMMO";
import OnlineFishingGames from "../src/pages/guides/OnlineFishingGames";
import FishingPlanetAlternatives from "../src/pages/guides/FishingPlanetAlternatives";
import RussianFishing4Alternatives from "../src/pages/guides/RussianFishing4Alternatives";
import CotwAnglerAlternatives from "../src/pages/guides/CotwAnglerAlternatives";

export const ROUTES = {
  "/wiki": { title: WIKI_TITLE, description: WIKI_DESC, el: (s) => (s ? <PublicWikiShell><WikiView w={s.wiki} data={s.data} /></PublicWikiShell> : <PublicWiki />) },
  "/privacy": { title: "Privacy Policy", description: "How The Fishing Lands collects, uses and protects your data: accounts, cookies, advertising (Google AdSense), payments, reCAPTCHA, push notifications and your rights.", el: () => <Privacy /> },
  "/terms": { title: "Terms of Service", description: "The rules for playing The Fishing Lands: accounts, fair play, virtual currency and purchases, user content, and what happens if the rules are broken.", el: () => <Terms /> },
  "/about": { title: "About The Fishing Lands", description: "Who makes The Fishing Lands, why it exists, how the game is funded and what we believe a browser fishing MMO should be.", el: () => <About /> },
  "/contact": { title: "Contact Us", description: "Reach The Fishing Lands team by email at Support@TheFishingLands.com or on Discord for support, account recovery, purchases, press and partnerships.", el: () => <Contact /> },
  "/guides": { title: "Fishing Game Guides", description: "Honest guides comparing the best fishing games: browser MMOs, Fishao alternatives, sims and cozy multiplayer picks — updated by anglers, not marketers.", el: () => <GuidesIndex /> },
  "/guides/fishao-alternatives": { title: "Fishao Alternatives", description: "Where former Fishao players are casting now: the best Fishao alternatives you can play in a browser today.", el: () => <FishaoAlternatives /> },
  "/guides/games-like-fishao": { title: "Games Like Fishao", description: "Six games that scratch the same 2D collect-em-up fishing itch as Fishao.", el: () => <GamesLikeFishao /> },
  "/guides/best-browser-fishing-games": { title: "Best Browser Fishing Games", description: "The best fishing games you can play in a browser tab: no install, no launcher, no download.", el: () => <BestBrowserFishingGames /> },
  "/guides/fishing-mmo": { title: "Fishing MMO Guide", description: "What actually makes a fishing MMO, not just a fishing game — and which ones are worth your time.", el: () => <FishingMMO /> },
  "/guides/online-fishing-games": { title: "Online Fishing Games", description: "Multiplayer fishing game picks, from arcade to simulator to MMO.", el: () => <OnlineFishingGames /> },
  "/guides/games-like-fishing-planet": { title: "Games like Fishing Planet: 6 alternatives for 2026", description: "Love Fishing Planet but want something new? Six honest alternatives, from hardcore sims to a free browser fishing MMO you can play in a tab.", el: () => <FishingPlanetAlternatives /> },
  "/guides/russian-fishing-4-alternatives": { title: "Russian Fishing 4 alternatives: 6 games for RF4 players", description: "Burnt out on the Russian Fishing 4 grind? Six alternatives for RF4 players, from other sims to a free fishing MMO that runs in your browser.", el: () => <RussianFishing4Alternatives /> },
  "/guides/call-of-the-wild-the-angler-alternatives": { title: "Call of the Wild: The Angler alternatives: 6 games to try", description: "Finished every reserve in Call of the Wild: The Angler? Six alternatives, from free simulators to an online fishing MMO you can play in your browser.", el: () => <CotwAnglerAlternatives /> },
};

export function render(path, state) {
  const r = ROUTES[path];
  return renderToStaticMarkup(<StaticRouter location={path}>{r.el(state)}</StaticRouter>);
}
