/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { GuideLayout, H2, H3, GameCard } from "./GuideShared";

export default function FishingMMO() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is a fishing MMO?",
        acceptedAnswer: { "@type": "Answer", text: "A fishing MMO is an online fishing game with a shared, persistent world: one server, many players, a common economy and rankings, where fishing is the main activity rather than a side skill in a larger MMO." },
      },
      {
        "@type": "Question",
        name: "Is there a free fishing MMO?",
        acceptedAnswer: { "@type": "Answer", text: "Yes. FishyLand is a free browser-based fishing MMO with a shared player market and 300+ species. RuneScape has a free-to-play tier with fishing as one of its skills. Fishao, previously the best-known free browser fishing MMO, has shut down." },
      },
      {
        "@type": "Question",
        name: "Do fishing MMOs work on mobile?",
        acceptedAnswer: { "@type": "Answer", text: "Browser-based fishing MMOs like FishyLand work on modern mobile browsers with a touch-friendly layout. Client MMOs with fishing as a skill (RuneScape, Final Fantasy XIV) also have mobile or handheld versions." },
      },
    ],
  };
  return (
    <GuideLayout
      slug="fishing-mmo"
      title="Fishing MMO: what actually counts, and which ones are worth your time"
      description="A fishing MMO isn't just any online fishing game. Here's the working definition, plus the browser MMOs, the fishing sub-skills, and the honest verdicts for each."
      updated="2026-02-15"
      jsonLd={faqLd}
    >
      <p>
        "Fishing MMO" gets thrown around loosely. Some of what people call a fishing MMO is really a lobby-based multiplayer fishing game; some of it is a giant
        MMO where fishing happens to be one of the skills. Both are valid, and both are covered here, but it helps to be honest about which is which so you
        don't install the wrong thing.
      </p>

      <H2>What counts as a fishing MMO</H2>
      <p>A useful working definition:</p>
      <ul className="list-disc pl-5 space-y-1 text-[13.5px] text-[var(--text-2)]">
        <li><b>One shared, persistent world.</b> If you and your friend log in tomorrow, your gold, gear and journal are still where you left them, and so are everyone else's.</li>
        <li><b>Fishing is the main verb.</b> Not a side hobby, not a mini-game, the loop is cast → fight → land → sell → improve.</li>
        <li><b>The world matters.</b> Player-driven economy, rankings, chat, alerts. Other anglers should visibly change your game.</li>
      </ul>

      <H2>Dedicated fishing MMOs</H2>
      <GameCard name="FishyLand" tag="Browser · Free · Persistent" verdict="The dedicated fishing MMO experience without an install.">
        <p>Runs in any modern browser. Twelve waters, 340+ species, a live player-driven market, crews, seasonal bosses and a shared world feed. Your account
          persists forever, and every catch shows up on the same server everyone else is fishing on.</p>
        <p className="mt-2 text-[12px] text-[var(--gold-dim)]">Free at <Link to="/" className="underline">thefishinglands.com</Link>.</p>
      </GameCard>

      <GameCard name="Fishao" tag="Browser · Shut down">
        The 2D grandfather of the browser fishing MMO, big collection book, seasonal events, town chat. The game has now closed for good, which is why
        our <Link to="/guides/fishao-alternatives" className="text-[var(--gold)] underline">Fishao alternatives</Link> page exists.
      </GameCard>

      <H2>MMOs with strong fishing sub-skills</H2>
      <p>
        These aren't fishing MMOs, but they're often what people mean when they ask for one. If you enjoy them for the fishing specifically, you're a
        strong candidate for one of the dedicated games above.
      </p>

      <div className="grid md:grid-cols-2 gap-3 not-prose">
        <GameCard name="Old School RuneScape" tag="MMO · Free tier">
          Fishing is a full 1-99 skill with dozens of spots, tools and minigames (Tempoross, Fishing Trawler, Aerial fishing). Free-to-play covers a decent
          slice of it.
        </GameCard>
        <GameCard name="Final Fantasy XIV" tag="MMO · Subscription">
          Fishing is a Disciple of the Land class with its own progression, big fish log and seasonal ocean fishing events. Beautiful, deep, but you pay to play.
        </GameCard>
        <GameCard name="World of Warcraft" tag="MMO · Subscription">
          Fishing is a secondary profession, best played casually while you queue for other content. The fish list is enormous by now.
        </GameCard>
        <GameCard name="Sea of Thieves" tag="Shared-world · Paid">
          Not really an MMO, but it is a shared world with dedicated fishing (10 species, cook-and-sell loop). Great on a Friday with friends.
        </GameCard>
      </div>

      <H2>Server-based multiplayer, not quite MMO</H2>
      <p>
        <b>Fishing Planet</b> and <b>Fishing Sim World</b> have online play but not shared persistent worlds. You fish in your own instance and compare
        results on leaderboards. If realism is the point, either is a strong pick; if you want <em>other anglers on your dock</em>, they aren't it.
      </p>

      <H2>How to choose</H2>
      <H3>You want browser convenience</H3>
      <p><Link to="/" className="text-[var(--gold)] underline">FishyLand</Link>. See also our <Link to="/guides/best-browser-fishing-games" className="text-[var(--gold)] underline">best browser fishing games</Link>.</p>
      <H3>You want fishing tucked inside a huge world</H3>
      <p>Old School RuneScape (free), FFXIV (paid).</p>
      <H3>You want a realistic sim with online play</H3>
      <p>Fishing Planet (free) or Fishing Sim World (paid).</p>

      <H2>Fishing MMO FAQ</H2>
      <H3>Is there a free fishing MMO?</H3>
      <p>Yes: FishyLand is free and runs in a browser. RuneScape's free tier includes fishing as one of its 1-99 skills. Fishao, once the go-to answer to this question, has shut down.</p>
      <H3>Do fishing MMOs work on mobile?</H3>
      <p>Browser-based ones do. FishyLand runs on iOS and Android browsers with a touch-friendly fight bar.</p>
      <H3>Is fishing PvP a thing?</H3>
      <p>Not directly. The competition in every fishing MMO worth playing is over records, rankings and market prices, not knocking each other into the water.</p>

      <H2>Related reading</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li><Link to="/guides/games-like-fishao" className="text-[var(--gold)] underline">Games like Fishao</Link></li>
        <li><Link to="/guides/online-fishing-games" className="text-[var(--gold)] underline">Online fishing games</Link></li>
        <li><Link to="/guides/best-browser-fishing-games" className="text-[var(--gold)] underline">Best browser fishing games</Link></li>
      </ul>
    </GuideLayout>
  );
}
