import { useEffect, useRef, useState } from "react";
import { api, errMsg } from "../tfl/lib/api";
import { toast } from "sonner";
import { fx } from "../game/fx";

const fmtT = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const goMode = (m) => window.dispatchEvent(new CustomEvent("fr-mode", { detail: m }));

// Live scoreboard over the Duel Pier, then the win / lose screen.
export function DuelHud() {
  const [m, setM] = useState(null);
  const gone = useRef(0);
  const placed = useRef(false);
  useEffect(() => {
    let live = true;
    const pull = async () => {
      try {
        const r = await api.get("/duel/live/state");
        if (!live) return;
        if (r.data.state === "matched") {
          gone.current = 0; setM(r.data.match); fx.duelPhase = r.data.match.phase;
          // each duelist starts on their own side of the path so they don't overlap
          if (!placed.current) { placed.current = true; fx.me = { x: fx.me.x + (r.data.match.side ? 60 : -60), y: fx.me.y + 40 }; }
        }
        else if (++gone.current > 2) goMode("harbour");
      } catch { /* retry */ }
    };
    pull();
    const t = setInterval(pull, 1500);
    return () => { live = false; clearInterval(t); fx.duelPhase = null; };
  }, []);
  if (!m) return null;
  const leave = async () => { try { await api.post("/duel/live/leave"); } catch (e) { toast.error(errMsg(e)); } goMode("harbour"); };
  const startIn = Math.max(0, Math.ceil((new Date(m.start) - Date.now()) / 1000));
  const lead = m.me.kg === m.foe.kg ? null : m.me.kg > m.foe.kg ? "me" : "foe";
  return (
    <>
      <div className="duel-board pointer-events-auto" data-testid="duel-scoreboard">
        <div className={`duel-side ${lead === "me" ? "lead" : ""}`}><b data-testid="duel-me-name">{m.me.username}</b><span className="duel-kg" data-testid="duel-me-kg">{m.me.kg.toFixed(2)} kg</span><small>{m.me.catches} fish</small></div>
        <div className="duel-clock" data-testid="duel-timer">{m.phase === "countdown" ? `Starts in ${startIn}` : m.phase === "live" ? fmtT(m.seconds_left) : "Time!"}</div>
        <div className={`duel-side right ${lead === "foe" ? "lead" : ""}`}><b data-testid="duel-foe-name">{m.foe.username}</b><span className="duel-kg" data-testid="duel-foe-kg">{m.foe.kg.toFixed(2)} kg</span><small>{m.foe.catches} fish</small></div>
      </div>
      {m.phase === "done" && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 pointer-events-auto" data-testid="duel-result">
          <div className="panel duel-result text-center">
            <div className={`duel-result-t ${m.result}`} data-testid="duel-result-title">{m.result === "win" ? "Victory!" : m.result === "lose" ? "Defeat" : "Draw"}</div>
            <p className="text-[13px] text-[#dbe8ff] mt-1">{m.result === "win" ? `You out-fished ${m.foe.username}.` : m.result === "lose" ? `${m.foe.username} landed more weight.` : "Dead even on the scales."}</p>
            <div className="duel-final">
              {[m.me, m.foe].map((p, i) => (
                <div key={p.username} className={i === 0 ? "me" : ""}>
                  <b>{p.username}</b><span>{p.kg.toFixed(2)} kg</span><small>{p.catches} fish{p.best ? ` · best ${p.best.name} ${p.best.kg} kg` : ""}</small>
                </div>
              ))}
            </div>
            {m.reward > 0 && <div className="duel-reward" data-testid="duel-reward"><img src="/art/hud/gold.webp" alt="" />+{m.reward}</div>}
            <button type="button" className="btn btn-gold mt-3" onClick={leave} data-testid="duel-back-harbour">Back to the harbour</button>
          </div>
        </div>
      )}
    </>
  );
}

// Duel Pier page: find an opponent, then both anglers sail to the duel map.
export default function DuelLive() {
  const [st, setSt] = useState("idle");
  useEffect(() => {
    if (st !== "waiting") return undefined;
    const t = setInterval(async () => {
      try { const r = await api.post("/duel/live/queue"); if (r.data.state === "matched") goMode("duel"); } catch { /* retry */ }
    }, 2000);
    return () => clearInterval(t);
  }, [st]);
  const find = async () => {
    try { const r = await api.post("/duel/live/queue"); if (r.data.state === "matched") goMode("duel"); else setSt("waiting"); } catch (e) { toast.error(errMsg(e)); }
  };
  const cancel = async () => { await api.post("/duel/live/leave").catch(() => {}); setSt("idle"); };
  return (
    <div className="space-y-3 fade-in" data-testid="duel-page">
      <div className="sf-banner" style={{ backgroundImage: "linear-gradient(90deg, rgba(6,14,30,.92) 35%, rgba(6,14,30,.3)), url(/art/waters/millbrook.jpg)" }}>
        <div className="flex-1">
          <div className="sf-kicker">Duel Pier</div>
          <div className="sf-banner-t">3-minute fishing duel</div>
          <div className="sf-banner-s">You and another angler fish the same duel pond. The live scoreboard tracks the total weight you land, and the heaviest total when the clock runs out wins 500 gold.</div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {st === "idle" ? <button type="button" className="btn btn-gold" onClick={find} data-testid="duel-find">Find an opponent</button>
              : <><span className="sf-banner-s self-center" data-testid="duel-waiting">Looking for an opponent…</span><button type="button" className="btn" onClick={cancel} data-testid="duel-cancel">Cancel</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}
