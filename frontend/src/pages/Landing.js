import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles, Server } from "lucide-react";
import { api, errMsg, tokens } from "../lib/api";
import { t } from "../i18n";

const Motes = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {Array.from({ length: 28 }).map((_, i) => (
      <span key={i} className="mote" style={{ left: `${(i * 37) % 100}%`, bottom: `-${(i * 13) % 20}px`, animationDuration: `${8 + (i % 7) * 2}s`, animationDelay: `${(i % 9) * 0.9}s` }} />
    ))}
  </div>
);

export default function Landing() {
  const nav = useNavigate();
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (tokens.has()) api.get("/auth/me").then(() => nav("/play")).catch(() => tokens.clear());
  }, [nav]);

  const go = async (path, body) => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post(path, body);
      tokens.set(data.access_token, data.refresh_token);
      toast.success(`Welcome, ${data.player.username}!`);
      nav("/play");
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (tab === "login") go("/auth/login", { email: form.email, password: form.password });
    else go("/auth/register", form);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 overflow-hidden" data-testid="landing-page">
      <img src="/art/landing.jpg" alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_55%,rgba(4,10,20,0.82)_0%,rgba(4,10,20,0.4)_45%,transparent_75%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      <Motes />
      <div className="relative h-full flex flex-col justify-center pl-[6vw] pr-4 py-3 gap-2 max-w-[560px] overflow-y-auto [@media(max-height:500px)]:justify-start [@media(max-height:500px)]:gap-1 [@media(max-height:500px)]:[&_.fr-input]:!py-1.5 [@media(max-height:500px)]:[&_.fr-btn]:!py-1.5">
        <img src="/art/logo.png" alt="Fishing Realm" className="w-[min(380px,38vw)] max-h-[24vh] object-contain object-left drop-shadow-[0_0_30px_rgba(255,200,60,0.5)] rise" data-testid="landing-logo" />
        <div className="font-cinzel text-amber-100 outline-text tracking-widest text-sm md:text-base -mt-2 rise" style={{ animationDelay: "0.1s" }}>{t("tagline")}</div>
        <div className="fr-panel p-5 [@media(max-height:500px)]:p-3 w-full max-w-[400px] rise" style={{ animationDelay: "0.2s" }} data-testid="auth-panel">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {["login", "register"].map((tb) => (
                <button key={tb} type="button" onClick={() => { setTab(tb); setErr(""); }} data-testid={`auth-tab-${tb}`}
                  className={`px-4 py-1.5 font-cinzel font-bold text-sm rounded transition-colors ${tab === tb ? "bg-amber-500/25 text-amber-200 border border-amber-400/70" : "text-amber-100/50 hover:text-amber-100"}`}>
                  {t(tb)}
                </button>
              ))}
            </div>
            <span className="fr-chip px-2 py-0.5 text-[11px] flex items-center gap-1 text-emerald-300" data-testid="server-select"><Server size={11} />{t("server")}</span>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2.5">
            {tab === "register" && <input className="fr-input" placeholder={t("heroName")} value={form.username} onChange={set("username")} data-testid="register-username-input" required minLength={3} maxLength={16} />}
            <input className="fr-input" type="email" placeholder={t("email")} value={form.email} onChange={set("email")} data-testid="auth-email-input" required />
            <input className="fr-input" type="password" placeholder={t("password")} value={form.password} onChange={set("password")} data-testid="auth-password-input" required minLength={tab === "register" ? 6 : 1} />
            {err && <div className="text-red-300 text-sm" data-testid="auth-error">{err}</div>}
            <button className="fr-btn py-2.5 text-base mt-1" type="submit" disabled={busy} data-testid="auth-submit-btn">{tab === "login" ? t("enter") : t("create")}</button>
          </form>
          <div className="flex items-center gap-2 my-3 [@media(max-height:500px)]:my-1.5 text-amber-100/40 text-xs"><div className="h-px bg-amber-700/50 flex-1" />or<div className="h-px bg-amber-700/50 flex-1" /></div>
          <button type="button" className="fr-btn fr-btn-teal w-full py-2.5 text-base flex items-center justify-center gap-2" disabled={busy} onClick={() => go("/auth/guest")} data-testid="guest-play-btn">
            <Sparkles size={16} /> {t("guest")}
          </button>
        </div>
      </div>
    </div>
  );
}
