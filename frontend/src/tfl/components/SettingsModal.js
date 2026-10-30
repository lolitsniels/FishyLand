/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { NotificationSettings, DisplaySettings, TutorialSettings } from "./SettingsSections";
import { InstallSettings } from "./InstallPrompt";
import { PORTAL } from "../lib/portal";
import { t as tt } from "../i18n";

const Field = ({ label, testId, ...p }) => (
  <label className="block">
    <span className="label block mb-1">{label}</span>
    <input className="input w-full" data-testid={testId} {...p} />
  </label>
);

function PasswordForm() {
  const [f, setF] = useState({ current: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const mismatch = f.confirm && f.password !== f.confirm;
  const submit = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    try { await api.post("/auth/change-password", f); toast.success(tt("Password changed")); setF({ current: "", password: "", confirm: "" }); }
    catch (ex) { toast.error(errMsg(ex)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-2" data-testid="settings-password-form">
      <div className="font-display text-[13px] text-[#f4ead2]">{tt("Change password")}</div>
      <Field label={tt("Current password")} type="password" value={f.current} onChange={set("current")} required autoComplete="current-password" testId="settings-current-password" />
      <Field label={tt("New password")} type="password" value={f.password} onChange={set("password")} required minLength={4} maxLength={72} autoComplete="new-password" testId="settings-new-password" />
      <Field label={tt("Repeat new password")} type="password" value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" testId="settings-confirm-password" />
      {mismatch && <div className="text-[11.5px] text-[#f0a5a3]" data-testid="settings-password-mismatch">{tt("The two new passwords don't match.")}</div>}
      <button className="btn btn-sm btn-gold" disabled={busy || !!mismatch} data-testid="settings-password-submit">{tt("Save password")}</button>
    </form>
  );
}

function EmailForm() {
  const { user, setUser } = useGame();
  const [email, setEmail] = useState(user.email || "");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/auth/email", { current, email });
      setUser(r.data.user); setCurrent("");
      toast.success(email.trim() ? "Email saved" : "Email removed");
    } catch (ex) { toast.error(errMsg(ex)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-2" data-testid="settings-email-form">
      <div className="font-display text-[13px] text-[#f4ead2]">{user.email ? tt("Change email") : tt("Add an email")}</div>
      <div className="text-[11.5px] text-[var(--muted)]">{tt("An email lets you sign in with it and reset a forgotten password.")} {user.email ? "" : tt("You have none on file yet.")}</div>
      <Field label={tt("Email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tt("you@example.com")} maxLength={120} testId="settings-email-input" />
      <Field label={tt("Current password")} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" testId="settings-email-password" />
      <button className="btn btn-sm btn-gold" disabled={busy || (!email.trim() && !user.email)} data-testid="settings-email-submit">{email.trim() || !user.email ? tt("Save email") : tt("Remove email")}</button>
    </form>
  );
}

export default function SettingsModal({ onClose }) {
  const { user } = useGame();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,.6)] p-3" onClick={onClose} data-testid="settings-backdrop">
      <div className="panel panel-gold w-full max-w-sm flex flex-col" style={{ maxHeight: "calc(88vh / var(--zoom, 1))" }} onClick={(e) => e.stopPropagation()} data-testid="settings-modal">
        <header className="panel-head shrink-0"><span>{tt("Account settings")}</span><button className="text-[var(--muted)] hover:text-[var(--gold)]" onClick={onClose} aria-label={tt("Close")} data-testid="settings-close"><X size={14} /></button></header>
        <div className="panel-body space-y-4 text-[12.5px] min-h-0" style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }} data-testid="settings-scroll">
          <div className="text-[var(--text-2)]">{tt("Signed in as")} <span className="text-[#f4ead2]">{user.username}</span>{user.email && <> · <span className="num" data-testid="settings-current-email">{user.email}</span></>}</div>
          <NotificationSettings />
          <div className="divider" />
          <DisplaySettings />
          <div className="divider" />
          <TutorialSettings onClose={onClose} />
          <div className="divider" />
          {!PORTAL && <>
          <div className="space-y-1.5">
            <div className="font-display text-[13px] text-[#f4ead2]">{tt("Install the app")}</div>
            <InstallSettings claimed={user.app_reward} />
          </div>
          <div className="divider" />
          </>}
          {user.is_guest ? (
            <div className="text-[#f59a5c]" data-testid="settings-guest-note">{tt("Guest accounts have no password yet. Claim your account from the banner above the harbour first.")}</div>
          ) : (
            <>
              <PasswordForm />
              <div className="divider" />
              <EmailForm />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
