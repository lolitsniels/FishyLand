/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { LegalLayout, H2, UL, Mail, DISCORD_URL } from "./LegalShared";

export default function About() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "The Fishing Lands",
    url: "https://thefishinglands.com",
    logo: "https://thefishinglands.com/icon-512.png",
    email: "Support@TheFishingLands.com",
    sameAs: [DISCORD_URL],
    description: "A free, persistent browser fishing MMO: hundreds of species, twelve waters, a real tension-bar fight, a live player market, crews and legendary bosses.",
  };
  return (
    <LegalLayout slug="about" title="About The Fishing Lands" type="AboutPage" jsonLd={jsonLd}
      description="Who makes The Fishing Lands, why it exists, how the game is funded and what we believe a browser fishing MMO should be.">
      <p><b className="text-[#f4ead2]">The Fishing Lands</b> is a persistent, free-to-play fishing MMO that runs in your browser: no download, no launcher, no install. Every angler shares one world: the same twelve waters, the same market, the same chat, the same weather and the same legendary bosses surfacing at the same moment for everyone.</p>

      <H2 id="why">Why we built it</H2>
      <p>We grew up on browser fishing games where you could cast a line during a break, trade a rare catch with a friend and log off knowing the world would still be there tomorrow. Most of those games have closed. The Fishing Lands is our attempt to build the game we wanted to keep playing: slow where it should be slow, generous with its secrets, and honest about how its numbers work.</p>

      <H2 id="what">What makes it different</H2>
      <UL>
        <li><b>A real fight.</b> Landing a fish is a tension-bar minigame, not a dice roll. Every species has its own fighting style, and every fight is verified on the server.</li>
        <li><b>A living economy.</b> Fish, bait and tackle trade on a player-run market with real supply and demand, contract patrons and crew orders.</li>
        <li><b>Shared events.</b> Expeditions, legendary bosses, crew leviathans, tournaments and weekly contests happen on a server-wide clock.</li>
        <li><b>Open rules.</b> Our <Link to="/wiki" className="text-[var(--gold)] hover:underline">Wiki</Link> reads its numbers straight from the live game rules, drop rates, luck tables, prices and rewards are all published.</li>
        <li><b>Fair by design.</b> Anti-bot checks, duplicate-account detection and a market fee keep the world honest. Paying players get convenience, never exclusive fish.</li>
      </UL>

      <H2 id="funding">How the game is funded</H2>
      <p>The Fishing Lands is free. The servers are paid for by unobtrusive advertising and by optional purchases: the Angler Pass, server-wide boosters that benefit everyone online, and cosmetic portraits and titles. We will never sell power, and we will never sell your data.</p>

      <H2 id="team">Who runs it</H2>
      <p>The game is designed, drawn, coded and moderated by a small independent team of anglers and hobby developers. We answer our own support mail, read every suggestion in the Discord and patch the game most weeks. New fish, waters and systems ship regularly; the in-game news feed keeps a running changelog.</p>

      <H2 id="contact">Get in touch</H2>
      <p>Bug reports, partnership requests, press enquiries and fishing stories are all welcome at <Mail />, or join the community on <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="text-[var(--gold)] hover:underline">Discord</a>. See the <Link to="/contact" className="text-[var(--gold)] hover:underline">Contact page</Link> for details.</p>
    </LegalLayout>
  );
}
