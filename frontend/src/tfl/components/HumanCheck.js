/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api, errMsg } from "../lib/api";
import { renderCheckbox, resetCheckbox } from "../lib/recaptcha";
import { useGame } from "../context/GameContext";
import { RecaptchaNote } from "./ui-bits";
import { t as tt } from "../i18n";

export function HumanCheck() {
  const { user, setUser } = useGame();
  const [ch, setCh] = useState(null);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const widget = useRef(null);
  const slot = useMemo(() => Math.floor(Math.random() * 3), [done]);
  const due = !!user?.humancheck_due;
  useEffect(() => {
    if (!due) { setCh(null); setDone(false); widget.current = null; return; }
    api.get("/humancheck").then((r) => { setCh(r.data.challenge); setMsg(""); }).catch(() => {});
  }, [due]);
  useEffect(() => {
    if (!ch || !box.current || widget.current != null) return;
    widget.current = "pending";  // synchronous guard: StrictMode / re-renders must not call render() twice on the same element
    renderCheckbox(box.current, { onToken: (tok) => send(tok), onExpired: () => setMsg(tt("The check expired. Tick the box again.")) })
      .then((id) => { widget.current = id; })
      .catch((e) => { widget.current = null; setMsg(e.message); });
  }, [ch]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!due || (!ch && !done)) return null;
  const send = async (token) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.post("/humancheck/answer", { id: ch.id, answer: token });
      if (r.data.ok) { setDone(true); setCh(null); widget.current = null; }
      else { setCh(r.data.challenge); setMsg(r.data.message); resetCheckbox(widget.current); }
    } catch (e) { setMsg(errMsg(e)); resetCheckbox(widget.current); if (e?.response?.status === 409) api.get("/humancheck").then((r) => setCh(r.data.challenge)).catch(() => {}); }
    finally { setBusy(false); }
  };
  const close = () => { setDone(false); setUser({ ...user, humancheck_due: false }); };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(0,0,0,.75)] p-3" data-testid="humancheck-overlay">
      <div className="panel panel-gold w-full max-w-sm p-5 space-y-4" role="dialog" aria-modal="true" data-testid="humancheck-dialog">
        {done ? (
          <>
            <div className="font-display text-[17px] text-[#f4ead2]" data-testid="humancheck-done">{tt("Well done, angler.")}</div>
            <p className="text-[12.5px] text-[var(--text-2)]">{tt("Sorry for the interruption, the harbourmaster checks now and then that the rods are held by people. Tight lines.")}</p>
            <div className="grid grid-cols-3 gap-2 pt-1" data-testid="humancheck-close-row">
              {[0, 1, 2].map((i) => i === slot
                ? <button key={i} className="btn btn-gold" onClick={close} data-testid="humancheck-close">{tt("Close")}</button>
                : <span key={i} aria-hidden="true" />)}
            </div>
          </>
        ) : (
          <>
            <div className="label label-gold !text-[10px]">{tt("Harbourmaster's check")}</div>
            <div className="font-display text-[16px] text-[#f4ead2]">{tt("Please confirm you're not a robot")}</div>
            <p className="text-[12px] text-[var(--text-2)]">{tt("Your casts are paused until you tick the box. This only shows up when your fishing rhythm looks mechanical.")}</p>
            <div className="flex justify-center min-h-[78px]"><div ref={box} data-testid="humancheck-captcha" /></div>
            {busy && <div className="text-[12px] text-[var(--muted)]">{tt("Checking…")}</div>}
            {msg && <div className="text-[12px] text-[#f0a5a3]" data-testid="humancheck-msg">{msg}</div>}
            <RecaptchaNote className="!mt-1" />
          </>
        )}
      </div>
    </div>
  );
}
