import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { useGame } from "../store";
import { fx } from "../game/fx";

// The Harbourmaster's guided first steps for new anglers. Progress lives on the account (user.tutorial).
const STEPS = [
  { title: "Welcome to FishyLand!", text: "Ahoy there, young angler! I'm Harbourmaster Crane. Hundreds of fish are hiding in these waters, from tiny minnows to giant sea monsters. Ready to catch your first one?", next: "Let's go!" },
  { title: "Let's take a walk", text: "Tap anywhere on the ground to walk there. On a computer you can use W A S D or the arrow keys too. Go on, walk around a bit!", wait: "walk" },
  { title: "Time to go fishing", harbour: "See the big SAIL button at the bottom? Tap it, then pick Millbrook Pond on the map. That's where every angler starts!", water: "Walk onto a glowing ring by the water and press FISH. When a fish bites, HOLD the button to reel. Keep the needle in the green zone, and let go if the line gets too tight!", target: "cast-fish-button", wait: "catch" },
  { title: "You caught a fish!", text: "Look at that beauty! The stars show how rare it is, and the tape shows how long it is. Keep it, or sell it for gold. Close the card when you're ready.", wait: "close" },
  { title: "Your energy", text: "Every cast uses a little energy, this yellow bar. Don't worry, it fills up again all by itself, and levelling up gives you a full refill!", target: "energy-bar", next: "Got it" },
  { title: "Your Fishdex", text: "Every new kind of fish you catch goes in your Fishdex. There are over 350 to find. Can you catch them all?", target: "menu-journal", next: "Next" },
  { title: "Better gear, bigger fish", text: "Gold buys better rods, reels and bait in the Tackle Shop at the harbour. Better gear means bigger and rarer fish!", target: "menu-inventory", next: "Next" },
  { title: "Secret fish", text: "Some fish are secret! My friends at the harbour tell riddles about where and when to find them. Walk up to them and listen closely.", next: "Ooh, secrets!" },
  process.env.REACT_APP_OFFLINE === "1" ? { title: "Coming soon: friends!", text: "Soon you'll be able to chat with other anglers, join a Crew with its own island and race your friends at the Duel Pier. Keep fishing and get ready!" } :
  { title: "Fish with friends", text: "Chat with other anglers here, join a Crew and get your own island, or race a friend at the Duel Pier. The world is full of real players!", target: "chat-box", next: "Awesome" },
  { title: "You're ready!", text: "That's everything, angler! Here's a starter gift to get you going: 10 Pearls, 10 worms and 10 bread crusts. Tight lines, and have fun!", finish: true },
];

export function WorldTutorial({ mode }) {
  const { user, setUser } = useTfl();
  const result = useGame((s) => s.result);
  const t = user?.tutorial;
  const [step, setStep] = useState(t?.step || 0);
  const start = useRef(null);
  const sawResult = useRef(false);
  useEffect(() => { setStep(t?.step || 0); }, [t?.step]);
  const go = (n) => { setStep(n); api.post("/tutorial/step", { step: n }).catch(() => {}); };
  const s = STEPS[Math.min(step, STEPS.length - 1)];

  // wait for the player to do the thing
  useEffect(() => {
    if (!t || t.done) return undefined;
    if (s.wait === "walk") {
      start.current = { ...fx.me };
      const iv = setInterval(() => { if (Math.hypot(fx.me.x - start.current.x, fx.me.y - start.current.y) > 140) go(2); }, 400);
      return () => clearInterval(iv);
    }
    return undefined;
  }, [step, t?.done]); // eslint-disable-line
  useEffect(() => {
    if (!t || t.done) return;
    if (s.wait === "catch" && result && !result.duel) { sawResult.current = true; go(3); }
    if (s.wait === "close" && !result) go(4);
  }, [result, step]); // eslint-disable-line
  // glow the thing being talked about
  useEffect(() => {
    if (!s.target) return undefined;
    const el = document.querySelector(`[data-testid="${s.target}"]`);
    el?.classList.add("wtut-glow");
    return () => el?.classList.remove("wtut-glow");
  }, [step]); // eslint-disable-line

  if (!t || t.done) return null;
  const finish = async () => {
    try { const r = await api.post("/tutorial/complete"); if (r.data.user) setUser(r.data.user); toast.success(r.data.reward ? "Starter gift added: 10 Pearls, 10 worms and 10 bread crusts!" : "Tutorial complete. Tight lines!"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const skip = async () => { try { const r = await api.post("/tutorial/skip"); if (r.data.user) setUser(r.data.user); } catch (e) { toast.error(errMsg(e)); } };
  const text = s.harbour ? (mode === "harbour" ? s.harbour : s.water) : s.text;
  return (
    <div className={`wtut-card pointer-events-auto ${s.wait === "close" ? "wtut-low" : ""}`} data-testid="tutorial-card" data-step={step}>
      <img src="/art/hud/mascot.webp" alt="Harbourmaster" className="wtut-mascot" />
      <div className="wtut-body">
        <div className="wtut-step" data-testid="tutorial-progress">Step {step + 1} of {STEPS.length}</div>
        <div className="wtut-title" data-testid="tutorial-title">{s.title}</div>
        <p className="wtut-text" data-testid="tutorial-text">{text}</p>
        <div className="flex gap-2 justify-end items-center mt-2">
          {!s.finish && <button type="button" className="wtut-skip" onClick={skip} data-testid="tutorial-skip">Skip tutorial</button>}
          {s.next && <button type="button" className="img-pill-dark !min-w-[120px] !min-h-[40px] px-5" onClick={() => go(step + 1)} data-testid="tutorial-next">{s.next}</button>}
          {s.finish && <button type="button" className="img-pill-dark !min-w-[150px] !min-h-[40px] px-5" onClick={finish} data-testid="tutorial-finish">Collect my gift!</button>}
          {s.wait && <span className="wtut-wait" data-testid="tutorial-waiting">{s.wait === "walk" ? "Walk around..." : s.wait === "catch" ? "Catch a fish..." : "Close the card..."}</span>}
        </div>
      </div>
    </div>
  );
}
