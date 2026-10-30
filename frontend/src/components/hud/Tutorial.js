import { useState } from "react";
import { Hand, Target, Coins, Play } from "lucide-react";
import { kv } from "../../portal";
import { useGame } from "../../store";

const STEPS = [
  { icon: Play, title: "Cast your line", text: "Press the golden FISH button or Space. Wait for the bite — the bobber splashes and a “!” appears." },
  { icon: Hand, title: "Hold to pull, release to ease", text: "Hold FISH/Space (or touch and hold) to raise line tension. Release to let it drop. The fish fights back!" },
  { icon: Target, title: "Keep the needle in the green", text: "Green fills the catch meter fast. Stay out of red or the line snaps. Fill the meter to land the fish." },
  { icon: Coins, title: "Grow your Battle Rating", text: "Sell fish for gold, buy better bait and gear, enhance it and repair it when it wears out. Collect every fish in the Fishdex." },
];

export default function Tutorial() {
  const [step, setStep] = useState(kv.get("fr_tutorial") ? -1 : 0);
  const [, force] = useState(0);
  const open = useGame((s) => s.tutorialOpen);
  const show = open || step >= 0;
  if (!show) return null;
  const i = Math.max(0, step);
  const S = STEPS[i];
  const close = () => { kv.set("fr_tutorial", "1"); setStep(-1); useGame.setState({ tutorialOpen: false }); force((x) => x + 1); };
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-auto" data-testid="tutorial-overlay">
      <div className="fr-panel w-[420px] max-w-[92vw] p-6 flex flex-col items-center text-center gap-3 pop" key={i}>
        <div className="fr-ring w-16 h-16"><S.icon size={30} color="#ffe08a" /></div>
        <div className="text-[11px] font-cinzel text-amber-300 tracking-widest">HOW TO FISH · {i + 1}/{STEPS.length}</div>
        <div className="gold-text font-deco text-xl font-black" data-testid="tutorial-title">{S.title}</div>
        <p className="text-sm text-amber-50/90">{S.text}</p>
        <div className="flex gap-2 w-full mt-2">
          <button type="button" className="fr-btn fr-btn-dark flex-1 py-2 text-sm" onClick={close} data-testid="tutorial-skip-btn">Skip</button>
          <button type="button" className="fr-btn flex-1 py-2 text-sm" data-testid="tutorial-next-btn"
            onClick={() => (i + 1 < STEPS.length ? setStep(i + 1) : close())}>{i + 1 < STEPS.length ? "Next" : "Start Fishing"}</button>
        </div>
      </div>
    </div>
  );
}
