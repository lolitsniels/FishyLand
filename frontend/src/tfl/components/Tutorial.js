/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { t as tt } from "../i18n";

// Guided first steps, hosted by the Harbourmaster. Progress is stored on the account (user.tutorial).
const STEPS = [
  { title: "Welcome to the harbour", text: "Aldous Crane, Harbourmaster. I keep the ledger of every fish landed in these waters, and I'll show you the ropes. Five minutes, then the water's yours.", button: "Show me" },
  { text: "First, the water. Open Go Fishing. Millbrook Pond is where every angler starts.", target: ['[data-testid="nav-go-fishing"]'], route: "/game/fish" },
  { text: "Cast your line, the button, or Space on a keyboard. When something bites, hold to reel and keep the needle in the sweet spot; ease off when the line strains. Land one fish for me.", target: ['[data-testid="cast-line-button"]', '[data-testid="fight-wrap"]'], event: "landed" },
  { text: "Landed. The card shows weight, rarity and what the vendor pays. XP fills the bar in the header. Level up and new waters open. Keep it, sell it, or turn it into live bait.", target: ['[data-testid="catch-result"]'], button: "Got it" },
  { text: "Every cast costs a little energy, the price is shown on the line. It comes back a point a minute, and a level-up adds a full bar on top (you can bank up to double), so no need to sit and wait.", target: ['[data-testid="hud-energy-wrap"]', '[data-testid="mobile-energy"]'], button: "Next" },
  { text: "Now, your keepnet. Open Inventory.", target: ['[data-testid="nav-inventory"]'], route: "/game/inventory" },
  { text: "Everything you land waits here. Tick fish and Sell to vendor for instant gold, or List them on the Market where other anglers pay more. Bait, ingredients and tackle live in this room too.", target: ['[data-testid="inventory-table"]', '[data-testid="inventory-page"]'], button: "Next" },
  { text: "One more stop, the Market.", target: ['[data-testid="nav-market"]'], route: "/game/market" },
  { text: "Anglers trade here: fish, bait, crafting ingredients. Prices are set by players, so a rare fish fetches far more than the vendor gives. Patience pays.", target: ['[data-testid="market-page"]'], button: "Next" },
  { text: "Work. Quests tell the harbour's story and pay gold and XP; dailies reset each day. Contracts are the patrons' orders, fill them for gold and favour. Check both often.", target: ['[data-testid="nav-quests"]', '[data-testid="nav-contracts"]'], button: "Next" },
  { text: "Last things. Chat with the harbour up top; join a Crew to fill shared orders; new Waters open as you level. Take these for the road: a tin of earthworms and some bread crust. Tight lines.", target: ['[data-testid="toggle-chat-button"]'], button: "Off you go", last: true },
];

const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
const findTarget = (sels) => { for (const s of sels || []) { const el = [...document.querySelectorAll(s)].find(visible); if (el) return el; } return null; };

export default function Tutorial() {
  const { user, setUser } = useGame();
  const loc = useLocation();
  const [step, setStep] = useState(Math.min(user.tutorial?.step || 0, STEPS.length - 1));
  const [rect, setRect] = useState(null);
  const [busy, setBusy] = useState(false);
  const stepRef = useRef(step); stepRef.current = step;
  const cur = STEPS[step];

  const persist = useCallback((n) => { api.post("/tutorial/step", { step: n }).catch(() => {}); }, []);
  const advance = useCallback(() => {
    const n = stepRef.current + 1;
    if (n >= STEPS.length) return;
    setStep(n); persist(n);
  }, [persist]);

  const finish = async () => {
    setBusy(true);
    try {
      const r = await api.post("/tutorial/complete");
      setUser(r.data.user);
      if (r.data.reward) toast.success(tt("The Harbourmaster hands you 10 Earthworms and 10 Bread Crust. Tight lines!"), { duration: 6000 });
    } catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const skip = async () => {
    setBusy(true);
    try { const r = await api.post("/tutorial/skip"); setUser(r.data.user); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };

  // Route-driven steps advance when the player arrives; event-driven ones on the game event (first landed fish).
  useEffect(() => { if (cur.route && loc.pathname === cur.route) advance(); }, [loc.pathname, cur, advance]);
  useEffect(() => {
    if (!cur.event) return undefined;
    const h = (e) => { if (e.detail === cur.event) advance(); };
    window.addEventListener("tutorial", h); return () => window.removeEventListener("tutorial", h);
  }, [cur, advance]);

  // Spotlight follows the target; scroll it into view once per step.
  useEffect(() => {
    let scrolled = false;
    const tick = () => {
      const el = findTarget(cur.target);
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      if (!scrolled) { scrolled = true; const out = r.top < 70 || r.bottom > window.innerHeight - 40 || r.left < 0 || r.right > window.innerWidth; if (out) el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }); }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    tick();
    const t = setInterval(tick, 250);
    window.addEventListener("resize", tick); window.addEventListener("scroll", tick, true);
    return () => { clearInterval(t); window.removeEventListener("resize", tick); window.removeEventListener("scroll", tick, true); };
  }, [cur]);

  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zoom")) || 1;
  const vh = window.innerHeight / zoom;
  const placeTop = rect ? (rect.top + rect.height / 2) / zoom > vh * 0.55 : false;

  return (
    <>
      {rect && <div className="tut-spot" style={{ top: rect.top / zoom - 6, left: rect.left / zoom - 6, width: rect.width / zoom + 12, height: rect.height / zoom + 12 }} data-testid="tutorial-spotlight" />}
      <div className={`tut-card ${placeTop ? "tut-top" : "tut-bottom"}`} role="dialog" aria-label={tt("Tutorial")} data-testid="tutorial-card">
        <img src="/art/npc/harbourmaster.webp" alt="" className="tut-portrait" draggable="false" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="label text-[var(--gold)] truncate">{cur.title || tt("Harbourmaster Aldous Crane")}</div>
            <div className="num text-[10.5px] text-[var(--muted)] whitespace-nowrap" data-testid="tutorial-step">{step + 1} / {STEPS.length}</div>
          </div>
          <p className="tut-text" data-testid="tutorial-text">{cur.text}</p>
          <div className="flex items-center gap-3 mt-2">
            {cur.button && <button className="btn btn-sm btn-gold" disabled={busy} onClick={cur.last ? finish : advance} data-testid="tutorial-next-button">{cur.button}</button>}
            {!cur.button && <span className="text-[11px] text-[var(--text-2)] italic" data-testid="tutorial-waiting">{cur.event ? tt("Waiting for your first catch…") : tt("Waiting for you…")}</span>}
            <button className="tut-skip" disabled={busy} onClick={skip} data-testid="tutorial-skip-button">{tt("Skip tutorial")}</button>
          </div>
        </div>
      </div>
    </>
  );
}
