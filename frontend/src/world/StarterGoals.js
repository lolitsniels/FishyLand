import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift, Check, ChevronDown, ChevronUp } from "lucide-react";
import { api, errMsg, fmt } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";

// First-session checklist (offline build): small gold per goal and a gift chest when every goal is done.
export function StarterGoals() {
  const { user, setUser } = useTfl();
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(() => window.innerWidth > 640);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user?.tutorial?.done) api.get("/starter").then((r) => setD(r.data)).catch(() => {}); }, [user]);
  if (!d || d.claimed) return null;
  const claim = async () => {
    setBusy(true);
    try { const r = await api.post("/starter/claim"); setUser(r.data.user); setD(r.data); toast.success("Gift chest opened!", { description: `+${fmt(r.data.reward.gold)} gold · +${r.data.reward.pearls} Pearls · +${r.data.reward.xp} XP`, duration: 7000 }); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  return (
    <div className={`starter-goals ${d.ready ? "is-ready" : ""}`} data-testid="starter-goals">
      <button type="button" className="sg-head" onClick={() => setOpen(!open)} data-testid="starter-goals-toggle">
        <Gift size={18} className="sg-gift" />
        <span>Starter Goals</span>
        <b data-testid="starter-goals-count">{d.done}/{d.total}</b>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      <div className="sg-bar"><i style={{ width: `${(100 * d.done) / d.total}%` }} /></div>
      {open && (
        <ul className="sg-list">
          {d.goals.map((g) => (
            <li key={g.id} className={g.done ? "done" : ""} data-testid={`starter-goal-${g.id}`}>
              <span className="sg-tick">{g.done && <Check size={12} strokeWidth={3.5} />}</span>
              <span className="sg-label">{g.label}</span>
              {!g.done && g.target > 1 && <span className="sg-prog">{g.progress}/{g.target}</span>}
            </li>
          ))}
        </ul>
      )}
      {d.ready
        ? <button type="button" className="sg-claim" onClick={claim} disabled={busy} data-testid="starter-claim-btn"><Gift size={16} /> Open gift chest</button>
        : open && <div className="sg-foot">+{d.goal_gold} gold per goal · chest: {fmt(d.chest.gold)} gold, {d.chest.pearls} Pearls</div>}
    </div>
  );
}
