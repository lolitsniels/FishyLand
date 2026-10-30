import { X, Lock } from "lucide-react";
import { fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Gold, Pearls } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { repairPerPoint } from "./Durability";

const Stat = ({ label, value, hint, testId }) => (
  <div className="flex items-baseline justify-between gap-3 py-1 border-b border-[#2a2320] last:border-0" data-testid={testId}>
    <span className="text-[12.5px] text-[var(--text-2)]">{label}{hint && <span className="block text-[11px] text-[var(--muted)]">{hint}</span>}</span>
    <span className="num text-[13px] text-[#ffe2cc] whitespace-nowrap">{value}</span>
  </div>
);

function Milestones({ miles }) {
  return (
    <div className="space-y-1.5" data-testid="rod-info-milestones">
      <div className="label">To buy it you also need</div>
      {miles.map((m) => {
        const done = m.have >= m.need;
        return (
          <div key={m.key} className="text-[12px]">
            <div className="flex justify-between gap-2"><span className={done ? "text-[var(--ok)]" : "text-[var(--text-2)]"}>{done ? "✓" : "○"} {fmt(m.need)} {m.label}</span><span className="num text-[var(--muted)]">{fmt(Math.min(m.have, m.need))}/{fmt(m.need)}</span></div>
            <div className="h-1 mt-0.5 bg-[#2a2320] rounded-sm overflow-hidden"><div className="h-full bg-[var(--gold)]" style={{ width: `${Math.min(100, (m.have / m.need) * 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

/* Rod details: stats, bonuses and (for milestone rods) what it takes to buy. */
export function RodInfoDialog({ g, miles = [], onClose }) {
  const { user } = useGame();
  const slot = g.id.split("_")[0];
  const n = g.tier - 1;
  const stats = {
    rod: [["Power", "Tires fish out faster", `×${g.power}`], ["Control", "Wider safe zone on the tension bar", `×${g.control}`], ["Luck", "Rarer fish and variants on every cast", n + (g.luck_bonus || 0) ? `+${n + (g.luck_bonus || 0)}` : "-"]],
    reel: [["Recovery", "Tension falls faster when you ease off", `×${g.recovery}`], ["Sell bonus", "Extra gold when you sell fish you landed", n ? `+${n * 2}%` : "-"]],
    line: [["Tolerance", "Takes more tension before it snaps", `×${g.tolerance}`], ["XP bonus", "Extra XP on every catch", n ? `+${n * 2}%` : "-"]],
  }[slot] || [];
  const rp = repairPerPoint(g);
  const owned = user.owned_gear.includes(g.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,.65)] p-3" onClick={onClose}>
      <div className="panel panel-gold w-full max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog" data-testid="rod-info-dialog">
        <div className="flex items-start gap-3">
          <GearIcon id={g.id} name={g.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-[17px] text-[#fff1e4]">{g.name}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="tag !text-[10px]">Tier {g.tier}</span>
              {g.bound && <span className="tag tag-bound !text-[10px]">Untradable</span>}
              {g.legendary && <span className="tag rar-legendary !text-[10px]">Legendary</span>}
              {g.event && <span className="tag !text-[10px] text-[#ffb36b]">Halloween</span>}
              {owned && <span className="tag !text-[10px] text-[var(--ok)]">Owned</span>}
            </div>
          </div>
          <button type="button" className="p-1 text-[var(--muted)] hover:text-[var(--gold)]" onClick={onClose} aria-label="Close" data-testid="rod-info-close"><X size={18} /></button>
        </div>
        <p className="text-[12.5px] text-[var(--text-2)] italic">{g.desc}</p>
        {g.perk && <div className="panel !bg-[#22160f] border-[#5a3220] p-2.5 text-[12.5px] text-[#ffcfa8]" data-testid="rod-info-perk"><span className="label !text-[#ffb36b] block mb-0.5">Special power</span>{g.perk}</div>}
        <div>
          {stats.map(([label, hint, value]) => <Stat key={label} label={label} hint={hint} value={value} testId={`rod-info-${label.toLowerCase().replace(/\s+/g, "-")}`} />)}
          <Stat label="Wear" value={g.no_wear ? "Never wears out" : rp ? `Repair ${rp}g per point` : "Free repairs"} testId="rod-info-wear" />
          <Stat label="Market" value={g.bound ? "Can't be sold" : g.price ? "Can be sold (buyer gets a fresh copy)" : "Can't be sold"} testId="rod-info-market" />
        </div>
        {!owned && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="rod-info-price">
              <span className="label">Price</span>
              {g.event ? <span className="text-[#ffb36b]">Marsh Witch, for Soul Candles</span> : <>{g.price ? <Gold n={g.price} /> : "Free"}{g.pearls ? <Pearls n={g.pearls} /> : null}</>}
              {g.level && <span className={`ml-auto text-[12px] ${user.level >= g.level ? "text-[var(--ok)]" : "text-[#f0a5a3]"}`}>{user.level < g.level && <Lock size={11} className="inline mr-1" />}Level {g.level}</span>}
            </div>
            {miles.length > 0 && <Milestones miles={miles} />}
          </div>
        )}
      </div>
    </div>
  );
}
