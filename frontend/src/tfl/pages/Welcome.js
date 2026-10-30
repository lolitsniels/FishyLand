/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import Seo, { SITE_URL } from "../components/Seo";
import { LoginDrop } from "../components/landing/LoginDrop";
import { SignupForm } from "../components/landing/SignupForm";
import { ShotColumn } from "../components/landing/ShotColumn";
import { NewsBoard } from "../components/landing/NewsBoard";
import { PixelSea } from "../components/landing/PixelSea";
import { CatchPops, CatchTicker, useLandingCatches } from "../components/landing/CatchPops";
import { AboutFold } from "../components/landing/AboutFold";
import "../landing.css";
import { bmmVisit } from "../lib/bmmTracker";
import { START_SCREEN } from "../lib/portal";
import { PortalStart } from "../components/landing/PortalStart";

(() => { try { const c = new URLSearchParams(window.location.search).get("ref"); if (c) localStorage.setItem("owo_ref", c.toUpperCase()); } catch {} })();

const Person = ({ className }) => (
  <svg viewBox="0 0 16 16" className={className} aria-hidden="true"><circle cx="8" cy="4.2" r="3.2" /><path d="M1.6 15.5c0-3.9 2.9-6.4 6.4-6.4s6.4 2.5 6.4 6.4z" /></svg>
);

function TopBar({ stats, user }) {
  const nav = useNavigate();
  return (
    <header className="lp-top" data-testid="lp-topbar">
      <div className="lp-top-in">
        <div className="lp-top-stats num" data-testid="lp-top-stats">
          {stats && <><span className="lp-stat" title="Online now"><Person className="lp-person on" /><b data-testid="lp-online">{fmt(stats.online)}</b> online</span><span className="lp-stat" title="Registered anglers"><Person className="lp-person" /><b data-testid="lp-players">{fmt(stats.players)}</b> anglers</span></>}
        </div>
        <nav className="lp-top-links">
          <Link to="/wiki" data-testid="lp-nav-wiki">Wiki</Link>
          <Link to="/guides" data-testid="lp-nav-guides">Guides</Link>
          <a href="https://discord.gg/FHCVrbj4kJ" target="_blank" rel="noreferrer" data-testid="lp-nav-discord">Discord</a>
        </nav>
        {user ? <button type="button" className="lp-login-btn on" onClick={() => nav("/game")} data-testid="lp-continue">Continue</button> : <LoginDrop />}
      </div>
    </header>
  );
}

function WelcomeBack({ user }) {
  const nav = useNavigate();
  return (
    <div className="lp-form lp-form-back" data-testid="lp-welcome-back">
      <div className="lp-back-name">Welcome back, {user.username}</div>
      <p className="lp-back-sub">Your gear, gold and journal are right where you left them.</p>
      <button type="button" className="lp-cta" onClick={() => nav("/game")} data-testid="lp-continue-big">Back to the water</button>
    </div>
  );
}

export default function Welcome() {
  const { user } = useGame();
  const [stats, setStats] = useState(null);
  useEffect(() => { bmmVisit(); }, []);
  useEffect(() => {
    const load = () => api.get("/game/stats").then((r) => setStats(r.data)).catch(() => {});
    load(); const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  const catches = useLandingCatches();
  if (START_SCREEN) return <PortalStart />;
  return (
    <div className="lp-page" data-testid="welcome-page">
      <Seo title="The Fishing Lands, Free Fishing MMO in Your Browser" description="Play The Fishing Lands free in your browser. Hundreds of fish, real players, a live economy and legendary catches. Free to play, no pay to win, no download." path="/" type="website"
        jsonLd={{ "@context": "https://schema.org", "@type": "VideoGame", name: "The Fishing Lands", url: SITE_URL + "/", genre: ["MMO", "Fishing", "Browser game"], gamePlatform: ["Web browser", "iOS", "Android"], applicationCategory: "Game", operatingSystem: "Any (web browser)", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, description: "A persistent browser-based fishing MMO with hundreds of species and a shared player-driven economy." }} />
      <div className="lp-bg" aria-hidden="true"><div className="lp-bg-town" style={{ backgroundImage: "url(/art/landing_water.webp)" }} /><PixelSea /><CatchPops list={catches} /></div>
      <TopBar stats={stats} user={user} />

      <main className="lp-stage">
        <CatchTicker list={catches} />
        <div className="lp-intro">
          <h1 className="lp-logo-wrap"><img src="/art/landing_logo.webp" alt="The Fishing Lands" className="lp-logo" data-testid="lp-logo" /></h1>
          <p className="lp-plate" data-testid="lp-tagline">Grab a rod and join thousands of anglers in one shared world. Catch hundreds of species, fight legendary bosses, trade on the Market and become the most famous angler in the Lands.<span className="lp-p2w" data-testid="lp-no-p2w">Free to play, never pay to win.</span><button type="button" className="lp-watch" onClick={() => window.dispatchEvent(new Event("lp-trailer"))} data-testid="lp-watch-trailer"><span className="lp-tri right" />Watch the trailer</button></p>
        </div>

        <section className="lp-board" data-testid="lp-board">
          <div className="lp-mascot-wrap" aria-hidden="true"><img src="/art/landing_mascot.webp" alt="" className="lp-mascot" data-testid="lp-mascot" /></div>
          <div className="lp-board-head" style={{ backgroundImage: "linear-gradient(180deg, rgba(40,33,29,.92), rgba(24,20,18,.96)), url(/art/header_band.jpg)" }}><h2>{user ? "Ready to cast?" : "Sign up now!"}</h2></div>
          <div className="lp-board-body">
            {user ? <WelcomeBack user={user} /> : <SignupForm />}
            <ShotColumn />
          </div>
        </section>

        {stats && (
          <div className="lp-facts num" data-testid="lp-facts">
            <span><b>{fmt(stats.active_today)}</b> fished today</span>
            <span><b>{fmt(stats.catches)}</b> fish landed</span>
            <span>Phone and desktop</span>
            <span>No download</span>
          </div>
        )}

        <NewsBoard />
        <AboutFold />
      </main>

      <footer className="lp-footer" data-testid="lp-footer">
        <div className="lp-footer-in">
          <span className="lp-footer-brand">© The Fishing Lands</span>
          <nav>
            <Link to="/about" data-testid="wl-footer-about">About</Link>
            <Link to="/contact" data-testid="wl-footer-contact">Contact</Link>
            <Link to="/privacy" data-testid="wl-footer-privacy">Privacy</Link>
            <Link to="/terms" data-testid="wl-footer-terms">Terms</Link>
            <Link to="/wiki" data-testid="wl-footer-wiki">Wiki</Link>
            <Link to="/guides" data-testid="wl-footer-guides">Guides</Link>
            <a href="https://discord.gg/FHCVrbj4kJ" target="_blank" rel="noreferrer">Discord</a>
            <a href="mailto:Support@TheFishingLands.com">Support@TheFishingLands.com</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
