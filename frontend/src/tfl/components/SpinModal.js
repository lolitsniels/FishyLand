/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Wheel, landingRotation } from "./SpinWheel";
import { t as tt } from "../i18n";

const Result = ({ r, onClose }) => (
  <div className="spin-result fade-in" data-testid="spin-result">
    <div className="label">{r.fish ? tt("Jackpot!") : tt("You won")}</div>
    <div className="font-heading text-[20px] leading-tight my-1" style={{ color: `var(--r-${r.rarity})` }} data-testid="spin-result-label">{r.label}</div>
    {r.fish && <div className="text-[12px] text-[var(--text-2)]">{tt("It is waiting in your keepnet.")}</div>}
    {r.bonus_pearls > 0 && <div className="text-[12px] text-[var(--text-2)]" data-testid="spin-bonus">+{r.bonus_pearls} bonus Pearls for your 7-day streak</div>}
    <button className="btn btn-gold mt-2" onClick={onClose} data-testid="spin-collect-button">{tt("Collect")}</button>
  </div>
);

function Odds({ segments }) {
  return (
    <details className="text-[11px] text-[var(--muted)] mt-2" data-testid="spin-odds">
      <summary className="cursor-pointer">{tt("Odds on this wheel")}</summary>
      <ul className="mt-1 grid grid-cols-2 gap-x-3">
        {segments.map((s) => <li key={s.id} className="flex justify-between gap-2"><span style={{ color: `var(--r-${s.rarity})` }}>{s.label}</span><span className="num">{s.weight}%</span></li>)}
      </ul>
    </details>
  );
}

export default function SpinModal({ state, onClose, onDone }) {
  const { setUser } = useGame();
  const [rot, setRot] = useState(() => (state.claimed_today && state.last ? 360 - ((state.last.index + 0.5) * 360) / state.segments.length : 0));
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(state.claimed_today ? state.last : null);
  useEffect(() => { const k = (e) => e.key === "Escape" && !spinning && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [spinning, onClose]);
  const spin = async () => {
    setSpinning(true);
    try {
      const r = await api.post("/daily-spin/spin");
      if (!r.data.spun) { toast.message(r.data.message); setSpinning(false); onDone(r.data.state); return; }
      setRot((from) => landingRotation(from, r.data.result.index, state.segments.length));
      setTimeout(() => { setSpinning(false); setResult(r.data.result); setUser(r.data.user); onDone(r.data.state); window.dispatchEvent(new CustomEvent("chest-changed")); }, 4400);
    } catch (e) { toast.error(errMsg(e)); setSpinning(false); }
  };
  const segs = state.segments;
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-3 px-ui" onClick={() => !spinning && onClose()} data-testid="spin-modal">
      <div className="panel panel-gold w-full max-w-[620px] fade-in" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head">
          <span>{state.better ? tt("Golden Wheel of Fortune · day 7") : `${tt("Wheel of Fortune · day")} ${state.day} ${tt("of 7")}`}</span>
          <button className="ml-auto text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose} disabled={spinning} aria-label={tt("Close")} data-testid="spin-close-button"><X size={16} /></button>
        </header>
        <div className="spin-stage">
          <img src="/art/npc/body_harbourmaster.webp" alt={tt("The Harbourmaster")} className="spin-hm" draggable="false" />
          <div className="flex flex-col items-center min-w-0">
            <div className="spin-bubble">{state.better ? tt("Seven days in a row! The golden wheel always pays 5 bonus Pearls.") : tt("One turn a day, angler. Come back 7 days in a row for the golden wheel!")}</div>
            <Wheel segments={segs} better={state.better} rotation={rot} spinning={spinning} size={270} />
            {result ? <Result r={result} onClose={onClose} />
              : <button className="btn btn-gold mt-2 !px-6" onClick={spin} disabled={spinning} data-testid="spin-button">{spinning ? tt("Spinning...") : tt("Spin the wheel")}</button>}
          </div>
        </div>
        <div className="px-3 pb-3"><Odds segments={segs} /></div>
      </div>
    </div>,
    document.body
  );
}
