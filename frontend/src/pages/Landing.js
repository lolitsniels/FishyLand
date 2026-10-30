import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Users, Fish, Waves, Gem, Anchor, LogIn } from "lucide-react";
import { api, errMsg, fmt } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { createGuest } from "../tfl/lib/guest";

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
  const { login, data } = useGame();
  const [f, setF] = useState({ username: "", password: "", email: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const register = async (e) => {
    e.preventDefault(); setBusy("signup"); setErr("");
    const starters = (data?.avatars || []).filter((a) => a.price === 0);
    const body = { username: f.username.trim(), password: f.password, ...(f.email.trim() ? { email: f.email.trim() } : {}), ...(starters.length ? { avatar: starters[Math.floor(Math.random() * starters.length)].id } : {}) };
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

const FEATURES = [
  [Anchor, "Walk the harbour", "A living 2.5D port town. Stroll the docks, visit the shops and meet other anglers."],
  [Waves, "12 waters", "From quiet Millbrook to the Cinder Depths, each with its own weather, tides and fish."],
  [Fish, "400+ species", "Fight every catch on the line. Golden, Giant and Ancient variants for the lucky."],
  [Gem, "Never pay to win", "Pearls are earned by fishing and only buy cosmetics. Skill lands the big ones."],
];

export default function Landing() {
  const { user } = useGame();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [catches, setCatches] = useState([]);
  const [showLogin, setShowLogin] = useState(false);
  const go = () => nav("/game");
  useEffect(() => {
    const load = () => api.get("/game/stats").then((r) => setStats(r.data)).catch(() => {});
    load(); api.get("/news/landing-catches").then((r) => setCatches(Array.isArray(r.data) ? r.data : r.data?.catches || [])).catch(() => {});
    const t = setInterval(load, 30000); return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden text-amber-50" data-testid="welcome-page">
      <div className="fixed inset-0 lp2-bg" style={{ backgroundImage: "url(art/harbour.jpg)" }} aria-hidden="true" />
      <div className="fixed inset-0 bg-gradient-to-b from-[#04121c]/70 via-[#04121c]/35 to-[#04121c]/95" aria-hidden="true" />
      <Motes />
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

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-16 grid lg:grid-cols-[1.25fr_1fr] gap-10 items-start">
        <section className="pt-4 lg:pt-14 rise">
          <div className="font-cinzel text-xs tracking-[0.35em] text-cyan-200 mb-3" data-testid="lp-kicker">FREE FISHING MMO · IN YOUR BROWSER</div>
          <h1 className="font-deco font-black gold-text text-4xl sm:text-5xl lg:text-6xl leading-[1.05]" data-testid="lp-logo">The Fishing Lands</h1>
          <p className="mt-5 text-base max-w-xl text-amber-50/90 leading-relaxed" data-testid="lp-tagline">
            Grab a rod and join anglers from everywhere in one shared world. Walk the harbour, sail to twelve waters, land hundreds of species and become the most famous angler in the Lands.
          </p>
          <div className="mt-3 font-cinzel font-bold text-emerald-300 text-sm" data-testid="lp-no-p2w">Free to play, never pay to win.</div>
          <div className="mt-8 grid sm:grid-cols-2 gap-3" data-testid="lp-features">
            {FEATURES.map(([I, t, d], i) => (
              <div key={t} className="fr-panel p-4 flex gap-3 rise" style={{ animationDelay: `${0.1 + i * 0.08}s` }} data-testid={`lp-feature-${i}`}>
                <I size={22} className="text-amber-300 shrink-0 mt-0.5" />
                <div><div className="font-cinzel font-bold text-amber-100">{t}</div><div className="text-xs text-amber-50/70 mt-1 leading-relaxed">{d}</div></div>
              </div>
            ))}
          </div>
        </section>

        <section className="fr-panel fr-modal p-5 sm:p-6 rise relative" style={{ animationDelay: ".15s" }} data-testid="lp-board">
          {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`fr-corner ${c}`} />)}
          <h2 className="font-deco gold-text text-lg text-center mb-4">{user ? "Ready to cast?" : "Sign up now!"}</h2>
          {user ? (
            <div className="flex flex-col items-center gap-3 text-center" data-testid="lp-welcome-back">
              <div className="font-cinzel font-bold text-xl">Welcome back, {user.username}</div>
              <p className="text-sm text-amber-50/70">Your gear, gold and journal are right where you left them.</p>
              <button type="button" className="fr-btn px-8 py-2.5 text-base" onClick={go} data-testid="lp-continue-big">Back to the harbour</button>
            </div>
          ) : <SignupBox go={go} />}
        </section>
      </main>

      {stats && (
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 flex flex-wrap gap-3 font-cinzel text-sm" data-testid="lp-facts">
          <span className="fr-chip px-3 py-1"><b>{fmt(stats.active_today)}</b> fished today</span>
          <span className="fr-chip px-3 py-1"><b>{fmt(stats.catches)}</b> fish landed</span>
          <span className="fr-chip px-3 py-1">Phone and desktop</span>
          <span className="fr-chip px-3 py-1">No download</span>
        </div>
      )}
      {catches.length > 0 && (
        <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-8 mt-8" data-testid="lp-catches">
          <h3 className="font-cinzel font-bold text-amber-200 text-sm tracking-widest mb-3">FRESH FROM THE WATER</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scroll-gold">
            {catches.slice(0, 10).map((c, i) => (
              <div key={i} className="fr-panel px-3 py-2 shrink-0 text-xs" data-testid={`lp-catch-${i}`}>
                <div className={`font-cinzel font-bold rar-${c.rarity}`}>{c.species || c.name}</div>
                <div className="text-amber-50/60">{c.username}{c.weight ? ` · ${c.weight} kg` : ""}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="relative z-10 mt-16 border-t border-amber-700/40 bg-[#04121c]/80" data-testid="lp-footer">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-cinzel text-amber-100/70">
          <span className="text-amber-200">© The Fishing Lands</span>
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
