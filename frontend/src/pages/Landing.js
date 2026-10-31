import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, LogIn } from "lucide-react";
import { api, errMsg, fmt } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { createGuest } from "../tfl/lib/guest";
import { CharacterPicker } from "../world/CharacterPicker";
import { DEFAULT_LOOK } from "../game/look";
import Seo from "../tfl/components/Seo";
import { ls } from "../offline/bridge";
import ItchStart, { ITCH } from "./ItchStart";

const HOME_LD = { "@context": "https://schema.org", "@type": "VideoGame", name: "FishyLand", url: window.location.origin, image: `${window.location.origin}/art/og.jpg`,
  description: "Free online fishing MMO in your browser: walk the harbour with real players, fish 12 waters, catch hundreds of species and win live fishing duels.",
  genre: ["Fishing", "MMO", "Casual"], gamePlatform: ["Web browser", "Mobile browser"], playMode: "MultiPlayer", applicationCategory: "Game", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } };

const Motes = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {Array.from({ length: 24 }).map((_, i) => (
      <span key={i} className="mote" style={{ left: `${(i * 37) % 100}%`, bottom: `-${(i * 13) % 20}px`, animationDuration: `${8 + (i % 7) * 2}s`, animationDelay: `${(i % 9) * 0.9}s` }} />
    ))}
  </div>
);

const Field = ({ label, hint, ...p }) => (
  <label className="flex flex-col gap-1">
    <span className="font-cinzel text-xs font-bold text-amber-200 tracking-wide">{label} {hint && <span className="text-amber-100/50 font-normal">{hint}</span>}</span>
    <input className="lp2-input" {...p} />
  </label>
);

function LoginBox({ onDone }) {
  const { login } = useGame();
  const [f, setF] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api.post("/auth/login", { username: f.username.trim(), password: f.password }); login(r.data); onDone(); }
    catch (ex) { setErr(errMsg(ex)); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="lp-login-form">
      <Field label="Name or email" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" data-testid="lp-login-username" />
      <Field label="Password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" data-testid="lp-login-password" />
      {err && <div className="text-red-300 text-xs" data-testid="lp-login-error">{err}</div>}
      <button className="fr-btn py-2" disabled={busy || !f.username || !f.password} data-testid="lp-login-submit">{busy ? "Docking…" : "Log in"}</button>
    </form>
  );
}

function SignupBox({ go }) {
  const { login } = useGame();
  const [f, setF] = useState({ username: "", password: "", email: "" });
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const register = async (e) => {
    e.preventDefault(); setBusy("signup"); setErr("");
    const body = { username: f.username.trim(), password: f.password, avatar: look, ...(f.email.trim() ? { email: f.email.trim() } : {}) };
    const guestToken = ls.getItem("owo_guest_token");
    try {
      const r = guestToken
        ? await api.post("/auth/complete-signup", body, { headers: { Authorization: `Bearer ${guestToken}` } }).catch((ex) => { if ([401, 403].includes(ex?.response?.status)) { ls.removeItem("owo_guest_token"); return api.post("/auth/register", body); } throw ex; })
        : await api.post("/auth/register", body);
      login(r.data); toast.success(`Welcome to the harbour, ${r.data.user.username}!`); go();
    } catch (ex) { setErr(errMsg(ex)); setBusy(""); }
  };
  const guest = async () => {
    setBusy("guest");
    try { const r = await createGuest("welcome", ""); login(r); go(); }
    catch (ex) { toast.error(errMsg(ex)); setBusy(""); }
  };
  return (
    <form onSubmit={register} className="flex flex-col gap-3" data-testid="lp-signup-form">
      <CharacterPicker value={look} onChange={setLook} testid="lp-char" />
      <Field label="Angler name" placeholder="3 to 16 letters, numbers or _" value={f.username} onChange={set("username")} autoComplete="username" data-testid="lp-signup-username" />
      <Field label="Password" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" data-testid="lp-signup-password" />
      <Field label="Email" hint="optional, for password resets" type="email" placeholder="you@example.com" value={f.email} onChange={set("email")} autoComplete="email" data-testid="lp-signup-email" />
      {err && <div className="text-red-300 text-xs" data-testid="lp-signup-error">{err}</div>}
      <button className="fr-btn py-2.5 text-base" disabled={!!busy || !f.username || !f.password} data-testid="lp-signup-submit">{busy === "signup" ? "Rigging your boat…" : "Register"}</button>
      <button type="button" className="fr-btn fr-btn-dark py-2 flex flex-col items-center leading-tight" onClick={guest} disabled={!!busy} data-testid="lp-guest-button">
        <span className="font-deco">{busy === "guest" ? "Casting…" : "Play now"}</span><span className="text-[10px] opacity-70 font-cinzel">no account needed</span>
      </button>
      <p className="text-[11px] text-amber-100/50 text-center">By signing up you agree to our <Link className="underline" to="/terms">Terms</Link> and <Link className="underline" to="/privacy">Privacy Policy</Link>.</p>
    </form>
  );
}

const SHOTS = [
  ["art/waters/willow.jpg", "A real catch: hold to reel and keep the needle in the green"],
  ["art/waters/cinder.jpg", "Twelve waters, from Millbrook Pond to the Cinder Trench"],
  ["art/harbour.jpg", "The harbour: shops, guilds and the people of the docks"],
  ["art/waters/coral.jpg", "Rods, reels and lines to upgrade"],
  ["art/waters/ghostlight.jpg", "Fill your journal, species by species"],
  ["art/waters/frozen.jpg", "Climb the weekly, monthly and all-time rankings"],
];
const ABOUT = [
  ["fishdex", "Hundreds of species", "Every water has its own fish, from pond carp to deep-sea sharks. Weather, tide and time of day decide what bites."],
  ["gear/_rod_t7.webp", "A real fight on the line", "Hooked fish pull back. Reel in, ease off and keep the tension out of the red or the line snaps."],
  ["crew", "One shared world", "Walk the harbour with everyone else. Trade on the player Market, join a crew, duel other anglers and chase the rankings."],
  ["guild", "Bosses and legends", "Legendary bosses surface at set waters. Mythic fish are so rare that most anglers never see one."],
  ["gear/_reel_t9.webp", "Gear that matters", "Better rods, reels and lines change how fights feel, and how your angler looks on the docks."],
  ["rankings", "No pay to win", "Skill and time on the water decide who tops the rankings. Pearls are earned, never bought, and only buy looks."],
  ["map", "Free in your browser", "No download, no install. Works on phone and desktop. Start as a guest and keep your progress when you sign up."],
];
const GUIDES = [["Fishao Alternatives", "fishao-alternatives"], ["Games Like Fishao", "games-like-fishao"], ["Best Browser Fishing Games", "best-browser-fishing-games"], ["Fishing MMO Guide", "fishing-mmo"], ["Online Fishing Games", "online-fishing-games"], ["Game wiki", null]];
const icon = (i) => (i.includes("/") ? `art/${i}` : `art/ui/${i}.png`);

const HOME_SHOTS = [["harbour", "Walk the harbour with other anglers"], ["river", "Fish rivers, ponds and the open sea"], ["map", "Sail to new waters"], ["shop", "Upgrade your tackle"]];

export default function Landing() {
  if (ITCH) return <ItchStart />;
  return <Home />;
}

function Home() {
  const { user } = useGame();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const go = () => nav("/game");
  useEffect(() => {
    const load = () => api.get("/game/stats").then((r) => setStats(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  return (
    <div className="fl-home" data-testid="welcome-page">
      <Seo title="FishyLand · Free Online Fishing MMO in Your Browser" type="website" path="/" jsonLd={HOME_LD}
        description="FishyLand is a free online fishing MMO you play in your browser. Walk the harbour with real players, fish 12 waters, catch hundreds of species, fill your Fishdex, join a crew and win live fishing duels." />
      <header className="fl-top" data-testid="lp-topbar">
        <img src="/art/hud/logo_fishyland.webp" alt="FishyLand" className="fl-logo-sm" />
        <div className="flex items-center gap-3">
          {stats && <span className="fl-online" data-testid="lp-online"><i />{fmt(stats.online)} online</span>}
          {user ? <button type="button" className="btn btn-gold" onClick={go} data-testid="lp-continue">Play</button>
            : <button type="button" className="btn" onClick={() => setShowLogin(true)} data-testid="lp-login-toggle"><LogIn size={14} className="inline -mt-0.5 mr-1" />Log in</button>}
        </div>
      </header>
      <main className="fl-main">
        <div className="fl-grid">
          <img src="/art/hud/logo_fishyland.webp" alt="FishyLand" className="fl-logo" data-testid="lp-logo" />
          <div className="fl-side">
            <div className="fl-mascot-row">
              <img src="/art/hud/mascot.webp" alt="The Harbourmaster" className="fl-mascot" data-testid="lp-mascot" />
              <div className="fl-bubble">Ahoy! Grab a rod, pick your angler and come fish with us. It's free, right in your browser.</div>
            </div>
            <section className="panel fl-card" data-testid="lp-board">
              <h2 className="fl-h">{user ? "Ready to cast?" : "Sign up now!"}</h2>
              {user ? (
                <div className="flex flex-col items-center gap-3 text-center" data-testid="lp-welcome-back">
                  <div className="text-lg font-bold">Welcome back, {user.username}</div>
                  <button type="button" className="btn btn-gold" onClick={go} data-testid="lp-continue-big">Back to the harbour</button>
                </div>
              ) : <SignupBox go={go} />}
            </section>
          </div>
          <section className="fl-shots" data-testid="lp-shots">
            {HOME_SHOTS.map(([k, t]) => (
              <figure key={k} className="fl-shot" data-testid={`lp-shot-${k}`}><img src={`/art/shots/${k}.jpg`} alt={t} loading="lazy" /><figcaption>{t}</figcaption></figure>
            ))}
          </section>
        </div>
      </main>
      <footer className="fl-foot" data-testid="lp-footer">
        <span>© FishyLand</span>
        <Link to="/privacy" data-testid="wl-footer-privacy">Privacy</Link>
        <Link to="/terms" data-testid="wl-footer-terms">Terms</Link>
        <Link to="/wiki" data-testid="wl-footer-wiki">Wiki</Link>
      </footer>
      {showLogin && !user && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60" onClick={(e) => e.target === e.currentTarget && setShowLogin(false)} data-testid="lp-login-modal">
          <div className="panel fl-login"><h2 className="fl-h">Log in</h2><LoginBox onDone={go} /></div>
        </div>
      )}
    </div>
  );
}
