/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGame } from "../context/GameContext";
import { PLAY_T } from "../lib/playI18n";
import { createGuest } from "../lib/guest";
import { RecaptchaNote } from "../components/ui-bits";
import { errMsg } from "../lib/api";
import { bmmVisit } from "../lib/bmmTracker";

// Ad landing page: one screen, no scroll, one job, get them fishing as a guest.
export default function Play() {
  const { user, login } = useGame();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const t = PLAY_T;
  useEffect(() => { bmmVisit(); }, []);
  useEffect(() => { document.title = t.title; }, [t]);
  useEffect(() => { if (user) nav("/game", { replace: true }); }, [user, nav]);
  const start = async () => {
    setBusy(true); setErr("");
    try { const d = await createGuest("ad"); login(d); nav("/game"); }
    catch (ex) { setErr(errMsg(ex)); setBusy(false); }
  };
  return (
    <main className="play-page" data-testid="play-page">
      <div className="play-bg" style={{ backgroundImage: "url(/art/hero.jpg)" }} aria-hidden="true" />
      <div className="play-grain" aria-hidden="true" />
      <img src="/art/ad/fish_left.webp" alt="" className="play-art play-art-left" aria-hidden="true" />
      <img src="/art/ad/angler.webp" alt="" className="play-art play-art-angler" aria-hidden="true" />
      <div className="play-content">
        <img src="/art/logo_anchor.webp" alt="The Fishing Lands" className="play-emblem" />
        <div className="play-kicker" data-testid="play-kicker">{t.kicker}</div>
        <h1 className="play-title" data-testid="play-title">{t.h1a} <span>{t.h1b}</span><br />{t.h1c}</h1>
        <p className="play-sub" data-testid="play-sub">{t.sub}</p>
        <button className="play-cta" onClick={start} disabled={busy} data-testid="play-start-button">
          {busy ? t.busy : t.cta}
        </button>
        <div className="play-fine">{t.fine}</div>
        {err && <div className="play-err" role="alert" data-testid="play-error">{err}</div>}
        <Link to="/" className="play-login" data-testid="play-login-link">{t.login}</Link>
        <RecaptchaNote className="text-center max-w-sm" />
      </div>
    </main>
  );
}
