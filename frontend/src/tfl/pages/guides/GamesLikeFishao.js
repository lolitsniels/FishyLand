/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { GuideLayout, H2, H3, GameCard } from "./GuideShared";

export default function GamesLikeFishao() {
  return (
    <GuideLayout
      slug="games-like-fishao"
      title="Games like Fishao: what the vibe was, and where to find it now"
      description="Fishao wasn't just a fishing game, it was a 2D, cartoony, town-hopping collector with strangers hanging around chat. Here are the closest matches, ranked by feel."
      updated="2026-02-15"
    >
      <p>
        Ask ten former Fishao players what made the game special and you'll get ten different answers: the pixelated fish, the maps, the trade chat, the seasonal
        events, the way the town filled up on a Sunday afternoon. Fishao itself has shut down, but the <em>feel</em> is what people miss, and that's what
        this list ranks candidates by, rather than by species count or budget.
      </p>

      <H2>1. Fishing Realms</H2>
      <p>
        Yes, we're biased. But if you liked Fishao because of the journal, the shared server and the persistent economy, this is the closest thing to it
        available in a browser today.
      </p>
      <ul className="list-disc pl-5 space-y-1 text-[13.5px] text-[var(--text-2)]">
        <li>340+ species split across twelve waters, from village pond to a volcanic sea trench.</li>
        <li>A shared server with global chat, trade chat, crews, and a live world feed.</li>
        <li>A real player market, every fish and every crafted bait can be listed.</li>
        <li>A tension-bar fight for each bite, plus rare "legendary" catches announced to the whole server.</li>
      </ul>
      <p>Play for free at <Link to="/" className="text-[var(--gold)] underline">thefishinglands.com</Link>.</p>

      <H2>2. Webfishing (2024)</H2>
      <p>
        A tiny indie release from 2024 that quietly became the year's cozy hit. Everyone stands around one pond, casts, chats and fishes together. It doesn't
        try to be a persistent MMO. It's the "Sunday afternoon in Fishao town chat" bit, cranked up. Great for playing with friends who don't normally play games.
      </p>

      <H2>3. Cat Goes Fishing</H2>
      <p>
        A 2D single-player physics fishing sandbox. You buy better rods, unlock new bays, catch bigger fish, and slowly discover a huge illustrated catalogue.
        It's Fishao's collection loop, minus the multiplayer, plus the physics of a bass launching itself sideways at your line. Runs on a toaster.
      </p>

      <H2>4. Stardew Valley (fishing focus)</H2>
      <p>
        You wouldn't buy Stardew just for the fishing minigame, but a lot of Fishao veterans did anyway. The catch mechanic is snappy, the seasonal fish
        list is generous, and there's a lifetime of side content around it. Best played on the couch.
      </p>

      <H2>5. Legendary Fishing / Reel Fishing</H2>
      <p>
        Console-first arcade fishing sims. Not multiplayer, not persistent, but if you spent half your Fishao evenings tuning gear and reeling in bigger and
        bigger fish, these hit that same "one more cast" nerve.
      </p>

      <H2>6. Fishing Clash / Ace Fishing</H2>
      <p>
        Mobile picks. Both have huge species catalogues and tournament formats that echo Fishao's competition boards. Both also have loot-box economies that
        will chase you around with pop-ups, set a spend limit before you install.
      </p>

      <H2>What's <em>not</em> on this list, and why</H2>
      <H3>Fishing Planet & Fishing Sim World</H3>
      <p>
        Excellent games, but the vibe is different: these are simulator-first. If you want that side, we cover them properly in <Link to="/guides/online-fishing-games" className="text-[var(--gold)] underline">Online fishing games</Link>.
      </p>
      <H3>RuneScape / WoW / FFXIV fishing</H3>
      <p>
        Fishing skills inside a bigger MMO. Great, but you're really playing the MMO. Our <Link to="/guides/fishing-mmo" className="text-[var(--gold)] underline">Fishing MMO guide</Link> untangles which is which.
      </p>

      <H2>Quick picks</H2>
      <div className="grid md:grid-cols-2 gap-3 not-prose">
        <GameCard name="Closest to Fishao's shared world" verdict="Fishing Realms">Browser, persistent, shared economy.</GameCard>
        <GameCard name="Closest to Fishao's collection book" verdict="Cat Goes Fishing / Fishing Realms">Both track a big illustrated catalogue.</GameCard>
        <GameCard name="Closest to Fishao's town chat" verdict="Webfishing">Cozy multiplayer pond hangout.</GameCard>
        <GameCard name="Closest to Fishao's minigames" verdict="Stardew Valley">Snappy, skill-based cast timing.</GameCard>
      </div>
    </GuideLayout>
  );
}
