import { Coins, Zap, Shield, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { useGame } from "../../store";
import { fmt } from "../../lib/api";
import { Bar } from "../fr";
import { PORTAL } from "../../portal";

const Currency = ({ icon: Icon, value, color, testid, label }) => (
  <div className="fr-chip flex items-center gap-1.5 pl-1 pr-3 py-0.5" title={label}>
    <Icon size={14} color={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    <span className="font-cinzel text-xs font-bold" data-testid={testid}>{fmt(value)}</span>
  </div>
);

function StaminaTimer({ sec }) {
  const [left, setLeft] = useState(sec);
  useEffect(() => { setLeft(sec); const i = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(i); }, [sec]);
  if (!sec) return null;
  return <span className="text-[10px] text-cyan-200/80 ml-1">+1 in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>;
}

export default function PlayerPanel() {
  const p = useGame((s) => s.player);
  const bait = useGame((s) => s.bait);
  const data = useGame((s) => s.data);
  const [pvp, setPvp] = useState(false);
  return (
    <div className="flex items-start gap-2 rise" data-testid="player-panel">
      <div className="relative shrink-0">
        <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-[3px] border-amber-300 shadow-[0_0_16px_rgba(255,200,60,0.6)] bg-gradient-to-b from-cyan-700 to-slate-900">
          <img src="art/angler.png" alt="" className="w-[150%] max-w-none -ml-[12%] -mt-[2%]" />
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 fr-chip px-2 text-[11px] font-cinzel font-black text-amber-200" data-testid="player-level">Lv.{p.level}</div>
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-cinzel font-bold text-sm text-amber-50 outline-text truncate max-w-[130px]" data-testid="player-name">{p.username}</span>
        </div>
        <div className="flex items-baseline gap-1.5 -mt-1">
          <span className="font-cinzel text-[11px] font-black text-amber-300 outline-text">BR</span>
          <span className="gold-text text-3xl font-black leading-none tracking-wide" data-testid="br-display-value">{p.br.toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Currency icon={Coins} value={p.gold} color="#ffd34d" testid="gold-value" label="Gold" />
        </div>
        <div className="flex items-center gap-1 w-[230px]">
          <Zap size={12} color="#7ff3ff" />
          <Bar value={p.stamina} max={p.stamina_max} className="flex-1" testid="stamina-bar"
            color={p.stamina > p.stamina_max ? "linear-gradient(90deg,#ffd34d,#fff2a6)" : undefined} />
          <span className="text-[10px] font-cinzel font-bold" data-testid="stamina-value">{p.stamina}/{p.stamina_max}</span>
        </div>
        <div className="flex items-center gap-1 w-[230px] -mt-0.5">
          <span className="text-[9px] font-cinzel font-black text-fuchsia-300">XP</span>
          <Bar value={p.xp} max={p.xp_need} className="flex-1 !h-[5px]" color="linear-gradient(90deg,#a855f7,#f0abfc)" testid="xp-bar" />
          <StaminaTimer sec={p.stamina_next_sec} />
        </div>
        <div className="flex items-center gap-1">
          {!PORTAL && <button type="button" onClick={() => setPvp(!pvp)} data-testid="mode-toggle"
            className={`fr-chip flex items-center gap-1 px-2 py-0.5 text-[10px] font-cinzel font-bold ${pvp ? "text-red-300" : "text-emerald-300"}`}>
            {pvp ? <Swords size={11} /> : <Shield size={11} />} {pvp ? "PvP" : "Peace"}
          </button>}
          {bait !== "worm" && (
            <span className="fr-chip px-2 py-0.5 text-[10px] text-cyan-200" data-testid="active-bait-buff">{data.items[bait].name} · {data.items[bait].desc}</span>
          )}
        </div>
      </div>
    </div>
  );
}
