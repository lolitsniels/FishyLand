/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { t as tt } from "../i18n";

export const GUIDES = [
  { slug: "fishao-alternatives",         title: "Fishao Alternatives",          blurb: "Where former Fishao players are casting now." },
  { slug: "games-like-fishao",           title: "Games Like Fishao",            blurb: "Six games that scratch the same 2D collect-em-up itch." },
  { slug: "best-browser-fishing-games",  title: "Best Browser Fishing Games",   blurb: "Play in a tab. No install, no launcher, no download." },
  { slug: "fishing-mmo",                 title: "Fishing MMO Guide",            blurb: "What actually makes a fishing MMO, not just a fishing game." },
  { slug: "online-fishing-games",        title: "Online Fishing Games",         blurb: "Multiplayer picks, from arcade to simulator to MMO." },
  { slug: "games-like-fishing-planet",   title: "Games Like Fishing Planet",    blurb: "Sims, open worlds and a free browser MMO for Fishing Planet fans." },
  { slug: "russian-fishing-4-alternatives", title: "Russian Fishing 4 Alternatives", blurb: "Where RF4 players go when the grind gets too much." },
  { slug: "call-of-the-wild-the-angler-alternatives", title: "Call of the Wild: The Angler Alternatives", blurb: "What to fish next once every reserve is done." },
];

export function GuideNav({ current }) {
  return (
    <nav aria-label={tt("Fishing game guides")} className="panel p-3 text-[12.5px]" data-testid="guide-nav">
      <div className="label mb-2">{tt("More guides")}</div>
      <ul className="space-y-1">
        {GUIDES.filter((g) => g.slug !== current).map((g) => (
          <li key={g.slug}>
            <Link to={`/guides/${g.slug}`} className="text-[#c8bfb5] hover:text-[var(--gold)] hover:underline">{g.title}</Link>
            <div className="text-[11px] text-[var(--muted)]">{g.blurb}</div>
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        <Link to="/" className="btn btn-gold btn-sm w-full text-center" data-testid="guide-nav-play">{tt("Play FishyLand free")}</Link>
      </div>
    </nav>
  );
}

export default function MarketingShell({ children, active }) {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)]" data-testid={`marketing-page-${active || "index"}`}>
      <header className="border-b border-[var(--border)] bg-[var(--bg)]" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" aria-label={tt("FishyLand home")}><Logo /></Link>
          <nav aria-label={tt("Primary")} className="hidden md:flex items-center gap-4 text-[12px] text-[var(--text-2)]">
            <Link to="/wiki" className={`hover:text-[var(--gold)] ${active === "wiki" ? "text-[var(--gold)]" : ""}`} data-testid="marketing-nav-wiki">{tt("Wiki")}</Link>
            <Link to="/guides" className={`hover:text-[var(--gold)] ${active === "index" ? "text-[var(--gold)]" : ""}`}>{tt("Guides")}</Link>
            <Link to="/about" className={`hover:text-[var(--gold)] ${active === "about" ? "text-[var(--gold)]" : ""}`} data-testid="marketing-nav-about">{tt("About")}</Link>
            <Link to="/" className="hover:text-[var(--gold)]">{tt("Home")}</Link>
            <Link to="/" className="btn btn-gold btn-sm">{tt("Play free")}</Link>
          </nav>
          <Link to="/" className="md:hidden btn btn-gold btn-sm">{tt("Play")}</Link>
        </div>
      </header>
      {children}
      <footer className="border-t border-[var(--border)] mt-8">
        <div className="max-w-6xl mx-auto px-6 py-8 grid sm:grid-cols-2 md:grid-cols-4 gap-6 text-[12.5px]">
          <div>
            <Logo />
            <p className="text-[var(--muted)] mt-2">{tt("A persistent browser fishing MMO. Twelve waters, 340+ species, one shared world.")}</p>
          </div>
          <div>
            <div className="label mb-2">{tt("Guides")}</div>
            <ul className="space-y-1">
              {GUIDES.map((g) => (
                <li key={g.slug}><Link to={`/guides/${g.slug}`} className="text-[#c8bfb5] hover:text-[var(--gold)]">{g.title}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="label mb-2">{tt("Play")}</div>
            <ul className="space-y-1">
              <li><Link to="/" className="text-[#c8bfb5] hover:text-[var(--gold)]">{tt("Create your angler")}</Link></li>
              <li><Link to="/" className="text-[#c8bfb5] hover:text-[var(--gold)]">{tt("Sign in")}</Link></li>
              <li><Link to="/wiki" className="text-[#c8bfb5] hover:text-[var(--gold)]" data-testid="footer-wiki">{tt("Game Wiki")}</Link></li>
              <li><a href="mailto:Support@TheFishingLands.com" className="text-[#c8bfb5] hover:text-[var(--gold)]">{tt("Support@TheFishingLands.com")}</a></li>
            </ul>
          </div>
          <div>
            <div className="label mb-2">{tt("Site")}</div>
            <ul className="space-y-1">
              <li><Link to="/about" className="text-[#c8bfb5] hover:text-[var(--gold)]" data-testid="footer-about">{tt("About us")}</Link></li>
              <li><Link to="/contact" className="text-[#c8bfb5] hover:text-[var(--gold)]" data-testid="footer-contact">{tt("Contact us")}</Link></li>
              <li><Link to="/privacy" className="text-[#c8bfb5] hover:text-[var(--gold)]" data-testid="footer-privacy">{tt("Privacy Policy")}</Link></li>
              <li><Link to="/terms" className="text-[#c8bfb5] hover:text-[var(--gold)]" data-testid="footer-terms">{tt("Terms of Service")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-6 text-[11px] text-[var(--muted)]">{tt("© FishyLand. All other game names are trademarks of their respective owners; used here for descriptive comparison only.")}</div>
      </footer>
    </div>
  );
}
