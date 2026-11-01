import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogIn, ChevronLeft, ChevronRight } from "lucide-react";
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

const GUIDES = [["Fishao Alternatives", "fishao-alternatives"], ["Games Like Fishao", "games-like-fishao"], ["Best Browser Fishing Games", "best-browser-fishing-games"], ["Fishing MMO Guide", "fishing-mmo"], ["Online Fishing Games", "online-fishing-games"], ["Game wiki", null]];

const SLIDES = [
  ["/art/shots/harbour.jpg", "The harbour", "Walk the docks with other anglers, visit the shops and take on quests."],
  ["/art/shots/river.jpg", "Rivers, ponds and the open sea", "Every water has its own fish, weather and secrets to find."],
  ["/art/shots/map.jpg", "Sail to new waters", "Twelve waters to unlock, from Millbrook Pond to the Cinder Trench."],
  ["/art/shots/shop.jpg", "Better rods, bigger fish", "Upgrade your rod and tackle to land rarer and heavier catches."],
];
const MEDIA = [...SLIDES.map((x) => x[0]), "/art/waters/willow.jpg", "/art/waters/coral.jpg", "/art/waters/frozen.jpg", "/art/waters/ghostlight.jpg", "/art/waters/cinder.jpg", "/art/waters/sunken.jpg"];
const TABS = [["home", "Home"], ["news", "News"], ["wiki", "Wiki"], ["media", "Media"]];
const CLOUDS = [[8, 6, 1, 70], [62, 4, 1.3, 95], [30, 22, 0.8, 60], [82, 26, 1.1, 80], [-6, 40, 1.2, 110], [48, 48, 0.7, 75], [90, 58, 0.9, 100], [15, 68, 1, 85]];

const Clouds = () => (
  <div className="fl2-clouds" aria-hidden>
    {CLOUDS.map(([x, y, sc, dur], i) => <span key={i} className="fl2-cloud" style={{ left: `${x}%`, top: `${y}%`, "--sc": sc, animationDuration: `${dur}s`, animationDelay: `-${((i * 3) % 8) / 8 * dur}s` }}><i /><i /><i /></span>)}
  </div>
);

function Slider() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 6000); return () => clearInterval(t); }, []);
  const go = (d) => setI((n) => (n + d + SLIDES.length) % SLIDES.length);
  const [src, title, text] = SLIDES[i];
  return (
    <div className="fl2-slider" data-testid="lp-slider">
      <img key={src} src={src} alt={title} className="fl2-slide" data-testid="lp-slide-img" />
      <div className="fl2-cap"><b>{title}</b><span>{text}</span></div>
      <button type="button" className="fl2-arrow l" onClick={() => go(-1)} aria-label="Previous" data-testid="lp-slide-prev"><ChevronLeft size={26} /></button>
      <button type="button" className="fl2-arrow r" onClick={() => go(1)} aria-label="Next" data-testid="lp-slide-next"><ChevronRight size={26} /></button>
      <div className="fl2-dots">{SLIDES.map((_, n) => <i key={n} className={n === i ? "on" : ""} onClick={() => setI(n)} />)}</div>
    </div>
  );
}

function AuthCard({ user, go, mode, setMode }) {
  if (user) return (
    <div className="fl2-join" data-testid="lp-board">
      <h2 className="fl-h">Ready to cast?</h2>
      <div className="flex flex-col items-center gap-3 text-center" data-testid="lp-welcome-back">
        <div className="text-lg font-bold">Welcome back, {user.username}</div>
        <button type="button" className="btn btn-gold" onClick={go} data-testid="lp-continue-big">Back to the harbour</button>
      </div>
    </div>
  );
  return (
    <div className="fl2-join" data-testid="lp-board">
      <div className="fl2-auth-tabs">
        <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")} data-testid="lp-auth-signup">Sign up</button>
        <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")} data-testid="lp-auth-login">Log in</button>
      </div>
      {mode === "login" ? <LoginBox onDone={go} /> : <SignupBox go={go} />}
    </div>
  );
}

function HomeTab() {
  return (
    <div className="fl2-home">
      <Slider />
      <div className="fl2-text">
        <h2 className="fl2-h">Explore the world of FishyLand!</h2>
        <p>FishyLand is a free fishing MMO you play right in your browser. Sail between twelve waters, from quiet ponds and rivers to frozen lakes and the deep sea. Every water has its own fish, weather and secrets.</p>
        <p>Walk the harbour with real players, chat, trade on the Market, join a crew with your own island and challenge other anglers to live duels.</p>
        <p>Over 350 fish to find. Some are so rare that the whole server hears about it when one is caught!</p>
      </div>
    </div>
  );
}

function OtherTab({ tab }) {
  if (tab === "news") return <div className="fl2-empty" data-testid="lp-news">No news yet. Check back soon, angler!</div>;
  if (tab === "wiki") return (
    <div className="fl2-wiki" data-testid="lp-wiki">
      <h2 className="fl2-h">The FishyLand Wiki</h2>
      <p>Everything about fish, waters, rods, bait, quests and more, written for new and experienced anglers.</p>
      <Link to="/wiki" className="btn btn-gold inline-block mt-2" data-testid="lp-wiki-open">Open the wiki</Link>
      <div className="fl2-guides">{GUIDES.filter(([, slug]) => slug).map(([t, slug]) => <Link key={slug} to={`/${slug}`} data-testid={`lp-guide-${slug}`}>{t}</Link>)}</div>
    </div>
  );
  return <div className="fl2-media" data-testid="lp-media">{MEDIA.map((src) => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="FishyLand screenshot" loading="lazy" /></a>)}</div>;
}

export default function Landing() {
  if (ITCH) return <ItchStart />;
  return <Home />;
}

function Home() {
  const { user } = useGame();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [mode, setMode] = useState("signup");
  const [tab, setTab] = useState("home");
  const go = () => nav("/game");
  useEffect(() => {
    const load = () => api.get("/game/stats").then((r) => setStats(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  return (
    <div className="fl2" data-testid="welcome-page">
      <Seo title="FishyLand · Free Online Fishing MMO in Your Browser" type="website" path="/" jsonLd={HOME_LD}
        description="FishyLand is a free online fishing MMO you play in your browser. Walk the harbour with real players, fish 12 waters, catch hundreds of species, fill your Fishdex, join a crew and win live fishing duels." />
      <Clouds />
      <div className="fl2-wrap">
        <header className="fl2-bar fl2-wood" data-testid="lp-topbar">
          <span className="fl2-tag">Free fishing MMO</span>
          {stats && <span className="fl2-online" data-testid="lp-online"><i />{fmt(stats.online)} online</span>}
          <div className="flex items-center gap-2">
            {!user && <button type="button" className="fl2-btn dark" onClick={() => { setMode("login"); window.scrollTo({ top: 0, behavior: "smooth" }); }} data-testid="lp-login-toggle"><LogIn size={14} />Log in</button>}
            <button type="button" className="fl2-btn" onClick={user ? go : () => { setMode("signup"); window.scrollTo({ top: 0, behavior: "smooth" }); }} data-testid="lp-continue">Play</button>
          </div>
        </header>
        <div className="fl2-hero">
          <div className="fl2-intro">
            <img src="/art/hud/logo_fishyland.webp" alt="FishyLand" className="fl2-logo" data-testid="lp-logo" />
            <div className="fl2-mascot-row">
              <img src="/art/hud/mascot.webp" alt="The Harbourmaster" className="fl2-mascot" data-testid="lp-mascot" />
              <div className="fl2-bubble">Ahoy! FishyLand is a free fishing MMO right in your browser. Pick your angler and come fish with us!</div>
            </div>
          </div>
          <AuthCard user={user} go={go} mode={mode} setMode={setMode} />
        </div>
        <nav className="fl2-tabs fl2-wood" data-testid="lp-tabs">
          {TABS.map(([k, label]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)} data-testid={`lp-tab-${k}`}>{label}</button>)}
        </nav>
        <main className="fl2-panel" data-testid={`lp-panel-${tab}`}>
          {tab === "home" ? <HomeTab /> : <OtherTab tab={tab} />}
        </main>
        <footer className="fl2-foot fl2-wood" data-testid="lp-footer">
          <span>© FishyLand · Free fishing MMO</span>
          <div className="flex gap-2">
            <Link to="/terms" data-testid="wl-footer-terms">Terms &amp; Conditions</Link>
            <Link to="/privacy" data-testid="wl-footer-privacy">Privacy Policy</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
