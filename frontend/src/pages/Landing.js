import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, LogIn } from "lucide-react";
import { api, errMsg, fmt } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { createGuest } from "../tfl/lib/guest";
import { CharacterPicker } from "../world/CharacterPicker";
import { DEFAULT_LOOK } from "../game/look";

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
    <form onSubmit={submit} className="fr-panel absolute right-0 top-12 w-72 p-4 flex flex-col gap-3 z-30 rise" data-testid="lp-login-form">
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
    const guestToken = localStorage.getItem("owo_guest_token");
    try {
      const r = guestToken
        ? await api.post("/auth/complete-signup", body, { headers: { Authorization: `Bearer ${guestToken}` } }).catch((ex) => { if ([401, 403].includes(ex?.response?.status)) { localStorage.removeItem("owo_guest_token"); return api.post("/auth/register", body); } throw ex; })
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

const FISH_ART = ["azure_perch", "coral_snapper", "crystal_angelfish", "glimmer_minnow", "golden_sunray", "lagoon_carp", "moonfin_trout", "prism_koi", "starwhale", "stormscale_pike"];

function CatchTicker({ catches }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (catches.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % catches.length), 4000);
    return () => clearInterval(t);
  }, [catches.length]);
  if (!catches.length) return null;
  const c = catches[i % catches.length];
  return (
    <div className="lp2-catchbar relative z-20 flex justify-center items-center h-10" data-testid="lp-catch-ticker">
      <span key={i} className="lp2-catch-fade flex items-center gap-2 font-cinzel text-sm text-amber-50 whitespace-nowrap" data-testid="lp-catch-current">
        <img src={`/art/fish/${FISH_ART[c.species_id % 10]}.png`} alt="" className="h-7 w-auto drop-shadow" />
        <b className="text-amber-300">{c.username}</b> landed <b className={`rar-${c.rarity}`}>{c.lb} lb {c.name}</b>
      </span>
    </div>
  );
}

function Hero({ user, go, setShots }) {
  const [look] = useState(() => ["look:f_1_3", "look:m_2_0"]);
  return (
    <section className="relative" data-testid="lp-hero">
      <img src="art/logo_tfl.webp" alt="Fishing Realms" className="lp2-logo w-[min(640px,92%)] h-auto mx-auto lg:mx-0 drop-shadow-[0_10px_30px_rgba(0,0,0,.8)]" data-testid="lp-logo" />
      <p className="mt-4 text-base sm:text-lg max-w-xl text-amber-50/95 leading-relaxed text-center lg:text-left [text-shadow:0_2px_6px_#000]" data-testid="lp-tagline">
        Grab a rod and join thousands of anglers in one shared world. Walk the harbour, catch hundreds of species, fight legendary bosses, trade on the Market and become the most famous angler in the Lands.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4 justify-center lg:justify-start">
        <span className="font-deco font-black text-emerald-300 text-lg [text-shadow:0_2px_6px_#000]" data-testid="lp-no-p2w">Free to play, never pay to win.</span>
        <button type="button" className="fr-btn fr-btn-dark px-5 py-2 flex items-center gap-2" onClick={() => setShots(0)} data-testid="lp-trailer">▶ Watch the trailer</button>
      </div>
      <div className="hidden xl:flex absolute -left-[330px] top-12 items-end gap-0 pointer-events-none" aria-hidden="true">
        <img src={`art/chars/${look[1].slice(5)}.webp`} alt="" className="lp2-mascot h-[300px] w-auto -mr-10" style={{ animationDelay: ".6s" }} />
        <img src={`art/chars/${look[0].slice(5)}.webp`} alt="" className="lp2-mascot h-[340px] w-auto" data-testid="lp-mascot" />
      </div>
    </section>
  );
}

function Shots({ open, setOpen }) {
  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-3 scroll-gold snap-x" data-testid="lp-shots">
        {SHOTS.map(([src, cap], i) => (
          <button key={src} type="button" onClick={() => setOpen(i)} className="lp2-shot snap-start shrink-0 w-[300px] sm:w-[340px] text-left" data-testid={`lp-shot-${i}`}>
            <span className="block aspect-[16/10] overflow-hidden rounded-lg"><img src={src.replace(".jpg", "_thumb.jpg").replace("harbour_thumb", "harbour")} alt={cap} className="w-full h-full object-cover" loading="lazy" /></span>
            <span className="block text-xs text-amber-50/85 mt-2 px-1 font-cinzel">{cap}</span>
          </button>
        ))}
      </div>
      {open != null && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-4" onClick={() => setOpen(null)} data-testid="lp-shot-viewer">
          <figure className="fr-panel p-2 max-w-5xl w-full rise" onClick={(e) => e.stopPropagation()}>
            <img src={SHOTS[open][0]} alt="" className="w-full rounded" />
            <figcaption className="flex items-center justify-between gap-3 p-2 font-cinzel text-sm text-amber-100">
              <button type="button" className="fr-btn fr-btn-dark px-3 py-1" onClick={() => setOpen((open + SHOTS.length - 1) % SHOTS.length)} data-testid="lp-shot-prev">‹</button>
              <span className="text-center">{SHOTS[open][1]}</span>
              <button type="button" className="fr-btn fr-btn-dark px-3 py-1" onClick={() => setOpen((open + 1) % SHOTS.length)} data-testid="lp-shot-next">›</button>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

function News({ items }) {
  if (!items.length) return null;
  return (
    <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 mt-14" data-testid="lp-news">
      <h2 className="font-deco gold-text text-2xl sm:text-3xl mb-5 lp2-h">Game news</h2>
      <div className="grid md:grid-cols-3 gap-5">
        {items.map((n, i) => (
          <article key={n.id} className="fr-panel overflow-hidden flex flex-col lp2-lift" data-testid={`lp-news-${i}`}>
            <div className="h-36 bg-cover bg-center" style={{ backgroundImage: `url(${/^https?:/.test(n.image || "") ? n.image : `art/waters/${["temple", "saltmarsh", "harrow"][i % 3]}_thumb.jpg`})` }} />
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="text-[11px] text-cyan-200 font-cinzel">{new Date(n.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · {n.author}</div>
              <h3 className="font-cinzel font-bold text-amber-100 text-base leading-snug">{n.title}</h3>
              <p className="text-xs text-amber-50/70 leading-relaxed line-clamp-4">{(n.body || "").replace(/[#*_>-]/g, "").slice(0, 260)}…</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useGame();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [catches, setCatches] = useState([]);
  const [news, setNews] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const [shot, setShot] = useState(null);
  const go = () => nav("/game");
  useEffect(() => {
    const load = () => api.get("/game/stats").then((r) => setStats(r.data)).catch(() => {});
    load();
    api.get("/news/landing-catches").then((r) => setCatches(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    api.get("/news/public").then((r) => setNews(r.data.items || [])).catch(() => {});
    const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden text-amber-50" data-testid="welcome-page">
      <div className="fixed inset-0 lp2-bg" style={{ backgroundImage: "url(art/harbour_wide.jpg)" }} aria-hidden="true" />
      <div className="fixed inset-0 bg-gradient-to-b from-[#04121c]/55 via-[#04121c]/25 to-[#04121c]/95" aria-hidden="true" />
      <div className="fixed inset-0 lp2-rays pointer-events-none" aria-hidden="true" />
      <Motes />
      <CatchTicker catches={catches} />
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-8 py-3" data-testid="lp-topbar">
        <div className="flex gap-4 text-xs font-cinzel font-bold" data-testid="lp-top-stats">
          {stats && <><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /><b data-testid="lp-online">{fmt(stats.online)}</b> online</span>
            <span className="flex items-center gap-1"><Users size={13} /><b data-testid="lp-players">{fmt(stats.players)}</b> anglers</span></>}
        </div>
        <div className="relative flex items-center gap-4 font-cinzel text-sm">
          <Link to="/wiki" className="hover:text-amber-300 transition-colors" data-testid="lp-nav-wiki">Wiki</Link>
          {user ? <button type="button" className="fr-btn px-4 py-1.5" onClick={go} data-testid="lp-continue">Continue</button>
            : <button type="button" className="fr-btn fr-btn-dark px-4 py-1.5 flex items-center gap-1.5" onClick={() => setShowLogin((v) => !v)} data-testid="lp-login-toggle"><LogIn size={14} /> Log in</button>}
          {showLogin && !user && <LoginBox onDone={go} />}
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-2 pb-6 grid lg:grid-cols-[1.35fr_1fr] gap-10 items-start">
        <Hero user={user} go={go} setShots={setShot} />
        <section className="fr-panel fr-modal p-5 sm:p-6 rise relative lp2-board" style={{ animationDelay: ".15s" }} data-testid="lp-board">
          {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`fr-corner ${c}`} />)}
          <h2 className="font-deco gold-text text-2xl text-center mb-4">{user ? "Ready to cast?" : "Sign up now!"}</h2>
          {user ? (
            <div className="flex flex-col items-center gap-3 text-center" data-testid="lp-welcome-back">
              <div className="font-cinzel font-bold text-xl">Welcome back, {user.username}</div>
              <p className="text-sm text-amber-50/70">Your gear, gold and journal are right where you left them.</p>
              <button type="button" className="fr-btn px-8 py-2.5 text-base" onClick={go} data-testid="lp-continue-big">Back to the harbour</button>
            </div>
          ) : <SignupBox go={go} />}
        </section>
      </main>

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 mt-8">
        <Shots open={shot} setOpen={setShot} />
        {stats && (
          <div className="flex flex-wrap gap-3 font-cinzel text-sm mt-4 justify-center" data-testid="lp-facts">
            <span className="lp2-fact"><b>{fmt(stats.active_today)}</b> fished today</span>
            <span className="lp2-fact"><b>{fmt(stats.catches)}</b> fish landed</span>
            <span className="lp2-fact">Phone and desktop</span>
            <span className="lp2-fact">No download</span>
          </div>
        )}
      </section>

      <News items={news} />

      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 mt-14" data-testid="lp-about">
        <h2 className="font-deco gold-text text-2xl sm:text-3xl lp2-h">About Fishing Realms</h2>
        <p className="mt-3 text-sm sm:text-base text-amber-50/85 max-w-3xl leading-relaxed">Fishing Realms is a free multiplayer fishing game you play in your browser. You start with a cheap rod at Millbrook Pond and work your way out to twelve waters, each with its own species, conditions and bosses.</p>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="lp-features">
          {ABOUT.map(([ic, t, d], i) => (
            <div key={t} className="fr-panel p-4 pt-3 flex flex-col items-center text-center gap-2 lp2-lift" data-testid={`lp-feature-${i}`}>
              <img src={icon(ic)} alt="" className="h-20 w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,.7)] lp2-float" style={{ animationDelay: `${i * 0.3}s` }} />
              <div className="font-cinzel font-bold text-amber-100 text-base">{t}</div>
              <div className="text-xs text-amber-50/75 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-xs font-cinzel text-amber-100/80" data-testid="lp-guides">
          <span className="text-amber-300">Guides:</span>
          {GUIDES.map(([t, slug]) => <Link key={t} to={slug ? `/guides/${slug}` : "/wiki"} className="underline decoration-amber-500/40 hover:text-amber-300">{t}</Link>)}
        </div>
      </section>

      <footer className="relative z-10 mt-16 border-t-2 border-amber-600/60 bg-[#04121c]/90" data-testid="lp-footer">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-cinzel text-amber-100/70">
          <img src="art/logo_tfl.webp" alt="" className="h-10 w-auto" />
          <span className="text-amber-200">© Fishing Realms</span>
          <Link to="/about" data-testid="wl-footer-about">About</Link>
          <Link to="/contact" data-testid="wl-footer-contact">Contact</Link>
          <Link to="/privacy" data-testid="wl-footer-privacy">Privacy</Link>
          <Link to="/terms" data-testid="wl-footer-terms">Terms</Link>
          <Link to="/wiki" data-testid="wl-footer-wiki">Wiki</Link>
        </div>
      </footer>
    </div>
  );
}
