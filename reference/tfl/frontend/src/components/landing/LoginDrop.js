import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { portalPlay } from "../../lib/portal";

export function LoginDrop() {
  const { login } = useGame();
  const nav = useNavigate();
  const [open, setOpen] = useState(() => !!new URLSearchParams(window.location.search).get("login"));
  const [forgot, setForgot] = useState(false);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(""); setMsg("");
    try {
      if (forgot) { const r = await api.post("/auth/forgot-password", { identifier: name.trim() }); setMsg(r.data.message); }
      else { const r = await api.post("/auth/login", { username: name.trim(), password: pw }); login(r.data); portalPlay(() => nav("/game")); }
    } catch (ex) { setErr(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <div className="lp-login" ref={box}>
      <button type="button" className={`lp-login-btn ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="lp-login-toggle">
        Login <span className="lp-tri down sm" />
      </button>
      {open && (
        <form className="lp-login-drop" onSubmit={submit} data-testid="lp-login-drop">
          <input className="lp-input lp-input-sm" placeholder="Angler name or email" value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus data-testid="lp-login-name" />
          {!forgot && <input className="lp-input lp-input-sm" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" data-testid="lp-login-password" />}
          {err && <div className="lp-err" data-testid="lp-login-error">{err}</div>}
          {msg && <div className="lp-ok" data-testid="lp-forgot-success">{msg}</div>}
          <button type="button" className="lp-link" onClick={() => { setForgot((f) => !f); setErr(""); setMsg(""); }} data-testid="lp-forgot-toggle">{forgot ? "Back to login" : "Forgot password?"}</button>
          <button className="lp-btn-small" disabled={busy || name.trim().length < 2 || (!forgot && !pw)} data-testid="lp-login-submit">{busy ? "..." : forgot ? "Send reset link" : "Login"}</button>
        </form>
      )}
    </div>
  );
}
