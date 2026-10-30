import { Map, ChevronDown } from "lucide-react";
import { useGame } from "../../store";
import { Bar } from "../fr";

export function Minimap() {
  const open = useGame((s) => s.openModal);
  return (
    <div className="fr-panel w-[190px] p-2 rise" style={{ animationDelay: "0.15s" }} data-testid="minimap">
      <div className="flex items-center justify-between mb-1.5">
        <span className="gold-text text-[13px] font-black">Crystal Lagoon</span>
        <button type="button" className="text-amber-200" onClick={() => open({ type: "waters" })} data-testid="open-waters-btn"><Map size={14} /></button>
      </div>
      <div className="relative h-[86px] rounded overflow-hidden border border-amber-700/70">
        <img src="/art/crystal_lagoon.jpg" alt="" className="w-full h-full object-cover" />
        <span className="absolute left-[47%] top-[78%] w-2.5 h-2.5 rounded-full bg-amber-300 border border-white shadow-[0_0_8px_#ffd34d]" />
        <span className="absolute left-[55%] top-[55%] w-1.5 h-1.5 rounded-full bg-cyan-300 animate-ping" />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[11px]">
        <button type="button" className="fr-chip px-2 py-0.5 flex items-center gap-1 font-cinzel font-bold text-emerald-300" data-testid="channel-selector"
          onClick={() => open({ type: "soon", title: "Channels", desc: "Multiple channels per water with up to 60 anglers each.", phase: 4 })}>
          Channel 1 <ChevronDown size={11} />
        </button>
        <span className="text-amber-100/80 font-cinzel">X 600 · Y 748</span>
      </div>
    </div>
  );
}

export function Tracker() {
  const p = useGame((s) => s.player);
  const goals = [
    { id: "catch", label: "Land 5 fish", v: p.stats.catches || 0, max: 5 },
    { id: "dex", label: "Discover 6 species", v: p.fishdex_count, max: 6 },
    { id: "level", label: "Reach Level 5", v: p.level, max: 5 },
  ];
  return (
    <div className="fr-panel w-[190px] p-2 rise" style={{ animationDelay: "0.2s" }} data-testid="fishing-tracker">
      <div className="gold-text text-[12px] font-black mb-1">Fishing Tracker</div>
      {goals.map((g) => (
        <div key={g.id} className="mb-1.5" data-testid={`tracker-${g.id}`}>
          <div className="flex justify-between text-[11px]">
            <span className={g.v >= g.max ? "text-emerald-300" : "text-amber-50"}>{g.label}</span>
            <span className="font-cinzel text-amber-200">{Math.min(g.v, g.max)}/{g.max}</span>
          </div>
          <Bar value={g.v} max={g.max} className="!h-[5px]" color="linear-gradient(90deg,#f6c445,#fff2a6)" />
        </div>
      ))}
    </div>
  );
}
