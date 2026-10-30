/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import MarketingShell from "../components/MarketingShell";
import Seo from "../components/Seo";
import { t as tt } from "../i18n";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();
  const [check, setCheck] = useState(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => {
    if (!token) { setCheck({ valid: false }); return; }
    api.get("/auth/reset-check", { params: { token } }).then((r) => setCheck(r.data)).catch(() => setCheck({ valid: false }));
  }, [token]);
  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) { toast.error(tt("The two passwords do not match")); return; }
    setBusy(true);
    try { const r = await api.post("/auth/reset-password", { token, password: pw }); setDone(r.data.username); }
    catch (err) { toast.error(errMsg(err)); }
    finally { setBusy(false); }
  };
  return (
    <MarketingShell active="reset">
      <Seo title={tt("Reset password, Fishing Realms")} description={tt("Set a new password for your Fishing Realms angler.")} path="/reset-password" />
      <main className="max-w-md mx-auto px-4 sm:px-6 py-10" data-testid="reset-page">
        <div className="panel panel-gold">
          <div className="panel-head"><span>{tt("Set a new password")}</span></div>
          <div className="panel-body">
            {check === null ? <div className="text-[12.5px] text-[var(--muted)]">{tt("Checking your link...")}</div>
              : done ? (
                <div className="text-center py-3" data-testid="reset-success">
                  <div className="font-display text-[15px] text-[#f4ead2]">{tt("Password changed")}</div>
                  <p className="text-[12.5px] text-[var(--text-2)] mt-2">{tt("Welcome back,")} {done}{tt(". Sign in with your new password.")}</p>
                  <button className="btn btn-gold mt-4" onClick={() => nav("/?login=1")} data-testid="reset-go-login">{tt("Go to sign in")}</button>
                </div>
              ) : !check.valid ? (
                <div className="text-center py-3" data-testid="reset-invalid">
                  <div className="font-display text-[15px] text-[#f0a5a3]">{tt("This link is invalid or has expired")}</div>
                  <p className="text-[12.5px] text-[var(--text-2)] mt-2">{tt("Reset links work once and only for 30 minutes. Request a fresh one from the sign-in box.")}</p>
                  <Link to="/?login=1" className="btn btn-gold mt-4 inline-block" data-testid="reset-back-home">{tt("Back to sign in")}</Link>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3" data-testid="reset-form">
                  <p className="text-[12.5px] text-[var(--text-2)]">{tt("Choose a new password for")} <b className="text-[var(--gold)]">{check.username}</b>.</p>
                  <div><label className="label block mb-1" htmlFor="r-pw">{tt("New password")}</label><input id="r-pw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={4} maxLength={72} required autoComplete="new-password" data-testid="reset-password-input" /></div>
                  <div><label className="label block mb-1" htmlFor="r-pw2">{tt("Repeat it")}</label><input id="r-pw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={4} maxLength={72} required autoComplete="new-password" data-testid="reset-password2-input" /></div>
                  <button type="submit" className="btn btn-gold btn-lg w-full" disabled={busy || pw.length < 4} data-testid="reset-submit-button">{busy ? "..." : tt("Save new password")}</button>
                </form>
              )}
          </div>
        </div>
      </main>
    </MarketingShell>
  );
}
