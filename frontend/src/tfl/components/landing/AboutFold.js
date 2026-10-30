import { Link } from "react-router-dom";
import { GUIDES } from "../MarketingShell";

const POINTS = [
  ["Hundreds of species", "Every water has its own fish, from pond carp to deep-sea sharks. Weather, tide and time of day decide what bites."],
  ["A real fight on the line", "Hooked fish pull back. Reel in, ease off and keep the tension out of the red or the line snaps."],
  ["One shared world", "Everyone fishes on the same server. Trade on the player Market, join a crew, duel other anglers and chase the rankings."],
  ["Bosses and legends", "Legendary bosses surface at set waters. Mythic fish are so rare that most anglers never see one."],
  ["Gear that matters", "Better rods, reels and lines change how fights feel. Upgrade, repair and grind for milestone rods."],
  ["No pay to win", "Skill and time on the water decide who tops the rankings, not your wallet."],
  ["Free in your browser", "No download, no install. Works on phone and desktop. Start as a guest and keep your progress when you sign up."],
];

export function AboutFold() {
  return (
    <details className="lp-about" data-testid="lp-about">
      <summary data-testid="lp-about-toggle">About The Fishing Lands</summary>
      <div className="lp-about-body">
        <p>The Fishing Lands is a free multiplayer fishing game you play in your browser. You start with a cheap rod at Millbrook Pond and work your way out to twelve waters, each with its own species, conditions and bosses.</p>
        <div className="lp-about-grid">{POINTS.map(([h, t]) => <div key={h}><h3>{h}</h3><p>{t}</p></div>)}</div>
        <div className="lp-about-guides">
          <span>Guides:</span> {GUIDES.map((g, i) => <span key={g.slug}>{i > 0 && " · "}<Link to={`/guides/${g.slug}`}>{g.title}</Link></span>)} · <Link to="/wiki">Game wiki</Link>
        </div>
      </div>
    </details>
  );
}
