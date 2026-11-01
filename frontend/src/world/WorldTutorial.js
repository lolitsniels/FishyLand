import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { useGame } from "../store";
import { fx } from "../game/fx";
import { adBreak } from "../offline/bridge";
import { HARBOUR_MAP, TILED } from "../game/maps";

// Shared by fishyland.com and the Playgama build: straight into fishing (first catch is a mythic), then a guided walk round the harbour.
const OFF = process.env.REACT_APP_OFFLINE === "1";
const TOUR = (id, title, text) => ({ title, text, visit: id });
const STEPS = [
  { title: "Welcome to FishyLand!", text: "Ahoy, angler! I'm Harbourmaster Crane. FishyLand is a multiplayer fishing MMO: anglers from all over the world fish, chat, duel and build crews here. There are 12 waters and over 350 fish to find. Let's catch your first fish right now!", next: "Let's fish!" },
  { title: "Board the Sea Serpent", harbour: "Follow the golden arrows to the Sea Serpent at the dock, or tap the big SAIL button, and pick Millbrook Pond. The locals say something HUGE was seen there this morning...", water: "Tap Back to Harbour, then sail to Millbrook Pond.", wait: "water", sail: true },
  { title: "Cast your line", harbour: "Tap SAIL and pick Millbrook Pond, that's where the big one is!", water: "Follow the arrows to a glowing ring and press FISH. When it bites, HOLD to push the needle right and LET GO to let it drift back. Keep it in the green middle to fill the progress bar. This one is HUGE, don't give up!", wait: "catch", sail: true },
  { title: "A MYTHIC fish!", text: OFF ? "INCREDIBLE! You landed The Mill Giant, a MYTHIC fish! See the banner at the top? Mythic catches get a big announcement, and most anglers never even see one. Close the card when you're ready." : "INCREDIBLE! You landed The Mill Giant, a MYTHIC fish! See the banner at the top? Mythic catches are announced to every angler on the server. Close the card when you're ready.", wait: "close" },
  { title: "Back to the harbour", water: "Now let me show you the harbour, there's a lot to explore. Tap Back to Harbour at the top right.", harbour: "Welcome back!", target: "back-harbour-button", wait: "harbour" },
  TOUR("shop", "The Tackle Shop", "Rods are the heart of FishyLand. A better rod lands bigger and rarer fish, and this is where you buy them, plus bait. Walk up to the sign!"),
  TOUR("quests", "The Quest Board", "Story quests plus new daily and weekly jobs. Every finished quest pays gold, XP and often Pearls!"),
  TOUR("contracts", "The Anchor Café", "The regulars here order special fish. Fill their orders for big gold, and they become your friends over time."),
  TOUR("market", "The Market", "Trade fish, bait and rods with other players. Some anglers make a fortune here!"),
  TOUR("crews", "Crew HQ", "Team up with other anglers in a Crew and get your own island with a clubhouse and a private pond."),
  TOUR("duel", "The Duel Pier", "Challenge another player to a live fishing duel. Most weight in two minutes wins!"),
  TOUR("pearl-shop", "The Pearl Shop", "Spend Pearls on frames, colours and looks that make you stand out from the crowd."),
  TOUR("achievements", "Hall of Achievements", "Every big moment earns a badge, with gold and Pearl rewards. How many can you unlock?"),
  TOUR("leaderboards", "The Fountain of Fame", "The best anglers on the server. Catch enough and your name goes up here for everyone to see!"),
  { title: "Your reel and line", text: "On the right are your reel and line. Tap them to upgrade with Pearls, up to level 10. A better reel and line make every fight easier.", target: "quick-tackle", next: "Got it" },
  { title: "Your energy", text: "Every cast uses a little energy, this yellow bar. It refills by itself, and levelling up gives you a full refill!", target: "energy-bar", next: "Next" },
  { title: "Your Fishdex", text: "Every new fish goes in your Fishdex. There are over 350 to find, and it shows how many are still hiding in each water!", target: "menu-journal", next: "Next" },
  { title: "Say hello!", text: "This is the chat. Say hi to the other anglers, ask for tips or trade. You're never fishing alone in FishyLand!", target: "chat-box", next: "Ahoy!" },
  ...(OFF ? [{ title: "Starter goals", text: "Check your Starter Goals list. Finish them all for 100 gold each and a big gift chest at the end!", next: "On it!" }] : []),
  { title: "You're ready!", text: "That's everything, angler! Here's a starter gift: 10 Pearls, 10 worms and 10 bread crusts. Tight lines!", finish: true },
];
const WAIT_TEXT = { water: "Sail to Millbrook Pond...", catch: "Catch a fish...", close: "Close the card...", harbour: "Sail back to the harbour..." };
const spotOf = (map, id) => map.spots.find((p) => p.id === id);

export function WorldTutorial({ mode }) {
  const { user, setUser } = useTfl();
  const result = useGame((s) => s.result);
  const t = user?.tutorial;
  const [step, setStep] = useState(t?.step || 0);
  // a late user refresh must never pull the card back a step; a restart (done -> not done) starts over
  useEffect(() => { setStep((cur) => Math.max(cur, t?.step || 0)); }, [t?.step]);
  useEffect(() => { if (t && !t.done) setStep(t.step || 0); }, [t?.done]); // eslint-disable-line
  const go = (n) => { setStep(n); api.post("/tutorial/step", { step: n }).catch(() => {}); };
  const s = STEPS[Math.min(step, STEPS.length - 1)];

  // wait for the player to do the thing
  useEffect(() => {
    if (!t || t.done) return;
    if (s.wait === "water" && mode === "water" && user?.water === "millbrook") go(step + 1);
    if (s.wait === "harbour" && mode === "harbour") go(step + 1);
  }, [step, t?.done, mode, user?.water]); // eslint-disable-line
  useEffect(() => {
    if (!t || t.done) return;
    if ((s.wait === "catch" || s.wait === "water") && result && !result.duel) go(STEPS.findIndex((x) => x.wait === "close"));
    if (s.wait === "close" && !result) go(step + 1);
  }, [result, step]); // eslint-disable-line
  // golden arrows on the ground toward the building being shown, the dock, or the nearest fishing ring
  useEffect(() => {
    fx.guide = null;
    if (!t || t.done) return undefined;
    const pick = () => {
      if (s.visit && mode === "harbour") return spotOf(HARBOUR_MAP, s.visit);
      if (s.sail && mode === "harbour") return spotOf(HARBOUR_MAP, "boat");
      if (s.sail && mode === "water" && user?.water === "millbrook") { const m = TILED[user?.water]; const rings = (m?.spots || []).filter((p) => p.fish); return rings.sort((a, b) => Math.hypot(a.x - fx.me.x, a.y - fx.me.y) - Math.hypot(b.x - fx.me.x, b.y - fx.me.y))[0]; }
      return null;
    };
    const iv = setInterval(() => {
      const p = pick();
      fx.guide = p && !(s.sail && fx.atSpot) ? { x: p.x, y: p.y } : null;
      if (s.visit && mode === "harbour" && p && Math.hypot(fx.me.x - p.x, fx.me.y - p.y) < 120) go(step + 1);
    }, 300);
    return () => { clearInterval(iv); fx.guide = null; };
  }, [step, t?.done, mode, user?.water]); // eslint-disable-line
  // glow the thing being talked about
  useEffect(() => {
    if (!s.target) return undefined;
    const el = document.querySelector(`[data-testid="${s.target}"]`);
    el?.classList.add("wtut-glow");
    return () => el?.classList.remove("wtut-glow");
  }, [step, mode]); // eslint-disable-line

  if (!t || t.done) return null;
  const finish = async () => {
    try { const r = await api.post("/tutorial/complete"); if (r.data.user) setUser(r.data.user); toast.success(r.data.reward ? "Starter gift added: 10 Pearls, 10 worms and 10 bread crusts!" : "Tutorial complete. Tight lines!"); adBreak("tutorial_done"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const skip = async () => { try { const r = await api.post("/tutorial/skip"); if (r.data.user) setUser(r.data.user); } catch (e) { toast.error(errMsg(e)); } };
  const text = s.harbour ? (mode === "harbour" ? s.harbour : s.water) : s.text;
  const tip = s.visit && mode !== "harbour" ? " Sail back to the harbour first." : "";
  return (
    <div className={`wtut-card pointer-events-auto ${s.wait === "close" ? "wtut-low" : ""}`} data-testid="tutorial-card" data-step={step}>
      <img src="/art/hud/mascot.webp" alt="Harbourmaster" className="wtut-mascot" />
      <div className="wtut-body">
        <div className="wtut-step" data-testid="tutorial-progress">Step {step + 1} of {STEPS.length}</div>
        <div className="wtut-title" data-testid="tutorial-title">{s.title}</div>
        <p className="wtut-text" data-testid="tutorial-text">{text}{tip}</p>
        <div className="flex gap-2 justify-end items-center mt-2">
          {!s.finish && <button type="button" className="wtut-skip" onClick={skip} data-testid="tutorial-skip">Skip tutorial</button>}
          {s.next && <button type="button" className="img-pill-dark !min-w-[120px] !min-h-[40px] px-5" onClick={() => go(step + 1)} data-testid="tutorial-next">{s.next}</button>}
          {s.finish && <button type="button" className="img-pill-dark !min-w-[150px] !min-h-[40px] px-5" onClick={finish} data-testid="tutorial-finish">Collect my gift!</button>}
          {s.wait && <span className="wtut-wait" data-testid="tutorial-waiting">{WAIT_TEXT[s.wait]}</span>}
          {s.visit && <span className="wtut-wait" data-testid="tutorial-waiting">{mode === "harbour" ? "Follow the arrows..." : "Sail back to the harbour..."}</span>}
        </div>
      </div>
    </div>
  );
}
