/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { AvatarPicker } from "./Avatar";
import { createGuest } from "../lib/guest";
import { bmmRegistration } from "../lib/bmmTracker";
import { toast } from "sonner";
import { t as tt } from "../i18n";

export default function AuthBox({ mode, setMode }) {
  const { login, data } = useGame();
  const nav = useNavigate();
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [email, setE] = useState("");
  const [avatar, setAvatar] = useState("");
  const [ref, setRef] = useState(() => localStorage.getItem("owo_ref") || "");
  const [showRef, setShowRef] = useState(() => !!localStorage.getItem("owo_ref"));
  const [recruiter, setRecruiter] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [guestToken, setGuestToken] = useState(() => localStorage.getItem("owo_guest_token") || "");
  const starters = (data?.avatars || []).filter((a) => a.price === 0);
  useEffect(() => { if (!avatar && starters.length) setAvatar(starters[Math.floor(Math.random() * starters.length)].id); }, [starters.length]); // eslint-disable-line
  useEffect(() => {
    const code = ref.trim().toUpperCase();
    if (code.length < 4) { setRecruiter(null); return; }
    const t = setTimeout(() => api.get(`/referrals/lookup/${code}`).then((r) => setRecruiter(r.data.recruiter)).catch(() => setRecruiter(false)), 350);
    return () => clearTimeout(t);
  }, [ref]);
  const refBody = () => ({ ...(ref.trim() ? { ref: ref.trim().toUpperCase() } : {}), source: localStorage.getItem("owo_source") || undefined, source_page: localStorage.getItem("owo_source_page") || undefined, guide: localStorage.getItem("owo_guide") || undefined });
  const afterAuth = (r) => {
    if (r.referral) { if (r.referral.applied) toast.success(tt("Recruited by {{v0}}: you'll both earn rewards as you level up", { v0: r.referral.recruiter })); else toast.error(r.referral.reason); }
    localStorage.removeItem("owo_ref");
    login(r);
    nav("/game");
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const body = mode === "register" ? { username, password, ...(email.trim() ? { email: email.trim() } : {}), ...(avatar ? { avatar } : {}), ...refBody() } : { username: username.trim(), password };
      if (mode === "register" && guestToken) {
        // This device played as a guest: claim that account so catches, journal and contest entries carry over.
        try {
          const r = await api.post("/auth/complete-signup", body, { headers: { Authorization: `Bearer ${guestToken}` } });
          toast.success(tt("Your guest progress has been carried over"));
          afterAuth(r.data); return;
        } catch (ex) {
          if (ex?.response?.status !== 401 && ex?.response?.status !== 403) throw ex;
          localStorage.removeItem("owo_guest_token"); setGuestToken("");
        }
      }
      const r = await api.post(`/auth/${mode}`, body);
      if (mode === "register") bmmRegistration(r.data.user?.id);
      mode === "register" ? afterAuth(r.data) : (login(r.data), nav("/game"));
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  const [busyGuest, setBusyGuest] = useState(false);
  const playGuest = async () => {
    setBusyGuest(true); setErr("");
    try { const r = await createGuest("welcome", ref); if (r.referral && !r.referral.applied) toast.error(r.referral.reason); login(r); nav("/game"); }
    catch (ex) { setErr(errMsg(ex)); setBusyGuest(false); }
  };
  const isLogin = mode === "login";
  const sendReset = async () => {
    setBusy(true); setErr(""); setForgotMsg("");
    try { const r = await api.post("/auth/forgot-password", { identifier: username.trim() }); setForgotMsg(r.data.message); }
    catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  if (isLogin && forgot) {
    return (
      <div className="portal-box w-full" data-testid="auth-box">
        <div className="portal-tabs"><button type="button" className="active" data-testid="auth-tab-forgot">{tt("Forgot password")}</button></div>
        <div className="p-4 space-y-3">
          <p className="text-[12px] text-[var(--text-2)]">{tt("Enter your angler name or the email on your account. If an email is on file we'll send a single-use link that works for 30 minutes.")}</p>
          <div>
            <label className="label block mb-1">{tt("Angler name or email")}</label>
            <input className="input" data-testid="forgot-identifier-input" value={username} onChange={(e) => setU(e.target.value)} placeholder={tt("Name or you@example.com")} autoComplete="username" />
          </div>
          {err && <div className="text-[13px] text-[#f0a5a3]" data-testid="auth-error">{err}</div>}
          {forgotMsg && <div className="text-[12.5px] text-[var(--ok)]" data-testid="forgot-success">{forgotMsg}</div>}
          <button type="button" className="btn btn-gold btn-lg w-full" disabled={busy || username.trim().length < 2} onClick={sendReset} data-testid="forgot-submit-button">{busy ? "..." : tt("Send reset link")}</button>
          <button type="button" className="text-[11.5px] text-[var(--muted)] hover:text-[var(--gold)] underline underline-offset-2 block mx-auto" onClick={() => { setForgot(false); setErr(""); setForgotMsg(""); }} data-testid="forgot-back-button">{tt("Back to sign in")}</button>
          <p className="text-[11px] text-[var(--muted)] text-center leading-snug">{tt("No email on your account? Ask an admin on Discord or email Support@TheFishingLands.com to reset it for you.")}</p>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="portal-box w-full" data-testid="auth-box">
      <div className="portal-tabs">
        {["login", "register"].map((m) => (
          <button type="button" key={m} data-testid={`auth-tab-${m}`} onClick={() => { setMode(m); setErr(""); }} className={mode === m ? "active" : ""}>
            {m === "login" ? tt("Login") : tt("New angler")}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <label className="label block mb-1">{isLogin ? tt("Angler name or email") : tt("Angler name")}</label>
          <input className="input" data-testid="auth-username-input" value={username} onChange={(e) => setU(e.target.value)}
            placeholder={isLogin ? tt("Name or you@example.com") : tt("3 to 16 letters, numbers, _")} autoComplete="username" />
        </div>
        <div>
          <label className="label block mb-1 flex justify-between"><span>{tt("Password")}</span>{isLogin && <button type="button" className="normal-case tracking-normal text-[10.5px] text-[var(--muted)] hover:text-[var(--gold)] underline underline-offset-2" onClick={() => { setForgot(true); setErr(""); }} data-testid="forgot-password-link">{tt("Forgot password?")}</button>}</label>
          <input className="input" type="password" data-testid="auth-password-input" value={password} onChange={(e) => setP(e.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} />
        </div>
        {!isLogin && (
          <div>
            <label className="label block mb-1">{tt("Email")} <span className="text-[10px] text-[var(--muted)] normal-case tracking-normal">{tt("(optional, lets you sign in with it)")}</span></label>
            <input className="input" type="email" data-testid="auth-email-input" value={email} onChange={(e) => setE(e.target.value)} placeholder={tt("you@example.com")} autoComplete="email" />
          </div>
        )}
        {!isLogin && starters.length > 0 && (
          <div data-testid="auth-avatar-section">
            <label className="label block mb-1">{tt("Portrait")} <span className="text-[10px] text-[var(--muted)] normal-case tracking-normal">· {starters.find((a) => a.id === avatar)?.name}</span></label>
            <div className="[&>div]:!grid-cols-6">
              <AvatarPicker avatars={starters} value={avatar} onChange={(a) => setAvatar(a.id)} showPremium={false} showNames={false} testId="auth-avatar-picker" />
            </div>
          </div>
        )}
        {!isLogin && (showRef ? (
          <div>
            <label className="label block mb-1">{tt("Referral code")}</label>
            <input className="input uppercase" data-testid="auth-ref-input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={tt("e.g. BAPY7HHX")} maxLength={16} />
            {recruiter && <div className="text-[11.5px] text-[var(--ok)] mt-1" data-testid="auth-ref-recruiter">{tt("Recruited by")} <b>{recruiter}</b>{tt(", you both earn rewards as you level up.")}</div>}
            {recruiter === false && ref.trim().length >= 4 && <div className="text-[11.5px] text-[#f0a5a3] mt-1" data-testid="auth-ref-invalid">{tt("Unknown referral code.")}</div>}
          </div>
        ) : (
          <button type="button" className="text-[11.5px] text-[var(--muted)] hover:text-[var(--gold)] underline underline-offset-2" onClick={() => setShowRef(true)} data-testid="auth-ref-toggle">{tt("Have a referral code?")}</button>
        ))}
        {err && <div className="text-[13px] text-[#f0a5a3]" data-testid="auth-error">{err}</div>}
        {!isLogin && guestToken && <div className="text-[11.5px] text-[var(--ok)]" data-testid="auth-guest-carryover">{tt("Your guest progress on this device (catches, journal, contest entries) will be carried over to this account.")}</div>}
        <button className="btn btn-gold btn-lg w-full" disabled={busy || !username || !password} data-testid="auth-submit-button">
          {busy ? "..." : isLogin ? tt("Login") : tt("Begin at Millbrook Pond")}
        </button>
        <button type="button" className="btn w-full" disabled={busyGuest} onClick={playGuest} data-testid="auth-guest-button">
          {busyGuest ? tt("Checking…") : tt("Play as guest, no account")}
        </button>
        <p className="text-[11px] text-[var(--muted)] text-center leading-snug">{tt("By playing you agree to our")} <Link to="/terms" className="underline" data-testid="auth-terms-link">{tt("Terms of Service")}</Link> {tt("and")} <Link to="/privacy" className="underline" data-testid="auth-privacy-link">{tt("Privacy Policy")}</Link>. {tt("Free to play. Guests can claim a proper account any time. This site is protected by reCAPTCHA; the Google")} <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline">{tt("Privacy Policy")}</a> {tt("and")} <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline">{tt("Terms")}</a> {tt("apply.")}{isLogin && recruiter && <span className="block text-[var(--ok)] mt-1" data-testid="auth-ref-guest-hint">{tt("Recruit link from")} <b>{recruiter}</b> {tt("noted, it applies to a new angler or guest.")}</span>}</p>
      </div>
    </form>
  );
}
