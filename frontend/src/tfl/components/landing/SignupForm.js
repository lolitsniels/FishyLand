import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { createGuest } from "../../lib/guest";
import { bmmRegistration } from "../../lib/bmmTracker";

export function SignupForm() {
  const { login, data } = useGame();
  const nav = useNavigate();
  const [f, setF] = useState({ username: "", password: "", email: "" });
  const [ref, setRef] = useState(() => localStorage.getItem("owo_ref") || "");
  const [showRef, setShowRef] = useState(() => !!localStorage.getItem("owo_ref"));
  const [recruiter, setRecruiter] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const guestToken = localStorage.getItem("owo_guest_token") || "";  useEffect(() => {
    const code = ref.trim().toUpperCase();
    if (code.length < 4) { setRecruiter(null); return; }
    const t = setTimeout(() => api.get(`/referrals/lookup/${code}`).then((r) => setRecruiter(r.data.recruiter)).catch(() => setRecruiter(false)), 350);
    return () => clearTimeout(t);
  }, [ref]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const done = (r) => {
    if (r.referral) r.referral.applied ? toast.success(`Recruited by ${r.referral.recruiter}: you'll both earn rewards as you level up`) : toast.error(r.referral.reason);
    localStorage.removeItem("owo_ref"); login(r); nav("/game");
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy("signup"); setErr("");
    const starters = (data?.avatars || []).filter((a) => a.price === 0);
    const body = { username: f.username.trim(), password: f.password, ...(f.email.trim() ? { email: f.email.trim() } : {}),
      ...(starters.length ? { avatar: starters[Math.floor(Math.random() * starters.length)].id } : {}),
      ...(ref.trim() ? { ref: ref.trim().toUpperCase() } : {}), source: localStorage.getItem("owo_source") || undefined, source_page: localStorage.getItem("owo_source_page") || undefined };
    try {
      if (guestToken) {
        try { const r = await api.post("/auth/complete-signup", body, { headers: { Authorization: `Bearer ${guestToken}` } }); toast.success("Your guest progress has been carried over"); return done(r.data); }
        catch (ex) { if (ex?.response?.status !== 401 && ex?.response?.status !== 403) throw ex; localStorage.removeItem("owo_guest_token"); }
      }
      const reg = (await api.post("/auth/register", body)).data; bmmRegistration(reg.user?.id); done(reg);
    } catch (ex) { setErr(errMsg(ex)); setBusy(""); }
  };
  return (
    <form className="lp-form" onSubmit={submit} data-testid="lp-signup-form">
      <label className="lp-label" htmlFor="lp-u">Angler name</label>
      <input id="lp-u" className="lp-input" value={f.username} onChange={set("username")} placeholder="3 to 16 letters, numbers or _" autoComplete="username" data-testid="lp-signup-username" />
      <label className="lp-label" htmlFor="lp-p">Password</label>
      <input id="lp-p" className="lp-input" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" data-testid="lp-signup-password" />
      <label className="lp-label" htmlFor="lp-e">Email <span>optional, for password resets</span></label>
      <input id="lp-e" className="lp-input" type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" autoComplete="email" data-testid="lp-signup-email" />
      {showRef ? (
        <div className="mt-2">
          <input className="lp-input lp-input-sm uppercase" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Referral code" maxLength={16} data-testid="lp-signup-ref" />
          {recruiter && <div className="lp-ok" data-testid="lp-ref-recruiter">Recruited by <b>{recruiter}</b>, you both earn rewards.</div>}
          {recruiter === false && ref.trim().length >= 4 && <div className="lp-err">Unknown referral code.</div>}
        </div>
      ) : <button type="button" className="lp-link mt-2" onClick={() => setShowRef(true)} data-testid="lp-ref-toggle">Got a referral code?</button>}
      {guestToken && <div className="lp-ok" data-testid="lp-guest-carryover">Your guest progress on this device will carry over.</div>}
      {err && <div className="lp-err" data-testid="lp-signup-error">{err}</div>}
      <p className="lp-terms">By signing up you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>
      <button className="lp-cta" disabled={!!busy || !f.username || !f.password} data-testid="lp-signup-submit">{busy === "signup" ? "Rigging your boat..." : "Register"}</button>
      <PlayNowButton />
    </form>
  );
}

export function PlayNowButton() {
  const { login } = useGame();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const r = await createGuest("welcome", localStorage.getItem("owo_ref") || ""); if (r.referral && !r.referral.applied) toast.error(r.referral.reason); login(r); nav("/game"); }
    catch (ex) { toast.error(errMsg(ex)); setBusy(false); }
  };
  return (
    <button type="button" className="lp-play-now" onClick={go} disabled={busy} data-testid="lp-guest-button">{busy ? "Casting..." : "Play now"}<span>no account needed</span></button>
  );
}
