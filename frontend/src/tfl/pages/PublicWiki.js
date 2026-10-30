/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import Seo, { SITE_URL } from "../components/Seo";
import MarketingShell from "../components/MarketingShell";
import { Empty } from "../components/ui-bits";
import { WikiView } from "./game/Wiki";

export const WIKI_TITLE = "Game Wiki: Rules, Odds, Fish & Rewards";
export const WIKI_DESC = "The complete rulebook for Fishing Realms, read live from the game: bite and luck odds, rarity tables, every water and fish, tackle, bait recipes, economy, quests, bosses, crews, duels, tournaments and Pearls.";

const embedded = () => {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("__WIKI_DATA__");
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch { return null; }
};

export function PublicWikiShell({ children }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: WIKI_TITLE,
    url: SITE_URL + "/wiki",
    description: WIKI_DESC,
    isPartOf: { "@type": "WebSite", name: "Fishing Realms", url: SITE_URL },
  };
  return (
    <MarketingShell active="wiki">
      <Seo title={WIKI_TITLE} description={WIKI_DESC} path="/wiki" type="website" jsonLd={jsonLd} />
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8" data-testid="public-wiki">
        <p className="label label-gold mb-2">Wiki</p>
        <h1 className="font-display text-3xl md:text-4xl text-[#f4ead2]">Fishing Realms Wiki</h1>
        <p className="mt-3 mb-6 text-[14px] text-[var(--text-2)] max-w-3xl">Every rule of the game in one place. The numbers below are read straight from the live server, so drop rates, prices, energy, quest rewards and event timers are always what the game is actually using right now.</p>
        {children}
      </div>
    </MarketingShell>
  );
}

export default function PublicWiki() {
  const [state, setState] = useState(embedded);
  useEffect(() => {
    if (state) return;
    Promise.all([api.get("/wiki"), api.get("/game/data?lang=en")]).then(([a, b]) => setState({ wiki: a.data, data: b.data })).catch(() => {});
  }, [state]);
  return (
    <PublicWikiShell>
      {state ? <WikiView w={state.wiki} data={state.data} /> : <Empty>Opening the wiki...</Empty>}
    </PublicWikiShell>
  );
}
