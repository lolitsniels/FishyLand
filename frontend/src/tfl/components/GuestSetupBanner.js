/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { t as tt } from "../i18n";

export default function GuestSetupBanner() {
  const { user, login } = useGame();
  const [open, setOpen] = useState(false);
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [email, setE] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user || !user.is_guest) return null;

  const openModal = () => { setErr(""); setU(""); setP(""); setE(""); setOpen(true); };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const body = { username, password, ...(email.trim() ? { email: email.trim() } : {}) };
      const r = await api.post("/auth/complete-signup", { ...body, source: localStorage.getItem("owo_source") || undefined, source_page: localStorage.getItem("owo_source_page") || undefined });
      login(r.data);
      setOpen(false);
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="border-y border-[var(--gold-dim)] bg-[var(--panel-2)] px-3 py-1.5 flex items-center gap-3 text-[12.5px]" data-testid="guest-setup-banner">
        <span className="text-[var(--gold)] font-display uppercase tracking-widest text-[11px]">{tt("Guest angler")}</span>
        <span className="text-[var(--text-2)] flex-1 truncate">
          {tt("You're playing as")} <b>{user.username}</b>{tt(". Claim a real name and password so you can log back in later.")}
        </span>
        <button className="btn btn-gold btn-sm" onClick={openModal} data-testid="guest-claim-button">{tt("Finish setup")}</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)} data-testid="guest-claim-modal">
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="panel panel-gold w-full max-w-sm">
            <header className="panel-head flex items-center justify-between">
              <span>{tt("Claim your account")}</span>
              <button type="button" className="btn btn-sm" onClick={() => setOpen(false)} disabled={busy} data-testid="guest-modal-close">×</button>
            </header>
            <div className="p-4 space-y-3">
              <p className="text-[12px] text-[var(--muted)]">{tt("Your gold, gear, journal and progress all stay with you. Just pick a name and password.")}</p>
              <div>
                <label className="label block mb-1">{tt("New angler name")}</label>
                <input className="input" data-testid="guest-username-input" value={username} onChange={(e) => setU(e.target.value)} placeholder={tt("3 to 16 letters, numbers, _")} autoComplete="username" autoFocus />
              </div>
              <div>
                <label className="label block mb-1">{tt("Password")}</label>
                <input className="input" type="password" data-testid="guest-password-input" value={password} onChange={(e) => setP(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <label className="label block mb-1">{tt("Email")} <span className="text-[10px] text-[var(--muted)] normal-case tracking-normal">{tt("(optional)")}</span></label>
                <input className="input" type="email" data-testid="guest-email-input" value={email} onChange={(e) => setE(e.target.value)} placeholder={tt("you@example.com")} autoComplete="email" />
              </div>
              {err && <div className="text-[13px] text-[#f0a5a3]" data-testid="guest-error">{err}</div>}
              <button className="btn btn-gold w-full" disabled={busy || !username || !password} data-testid="guest-claim-submit">
                {busy ? "..." : tt("Claim account")}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
