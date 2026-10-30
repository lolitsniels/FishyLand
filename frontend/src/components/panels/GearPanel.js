import { useCallback, useEffect, useState } from "react";
import { Coins, Gem, Hammer, Wrench, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import { useGame } from "../../store";
import { api, errMsg, fmt } from "../../lib/api";
import { Bar } from "../fr";
import { sfx } from "../../game/sfx";

const SLOT_LABEL = { rod: "Rod · Power", reel: "Reel · Control", line: "Line · Strength" };

export default function GearPanel() {
  const [slot, setSlot] = useState("rod");
  const [costs, setCosts] = useState(null);
  const [protect, setProtect] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = useGame((s) => s.player);
  const data = useGame((s) => s.data);
  const setPlayer = useGame((s) => s.setPlayer);
  const pushSystem = useGame((s) => s.pushSystem);
  const loadCosts = useCallback(() => api.get("/gear/costs").then((r) => setCosts(r.data)), []);
  useEffect(() => { loadCosts(); }, [loadCosts, p]);

  const g = p.gear[slot];
  const c = costs?.[slot];
  const call = async (path, body, ok) => {
    setBusy(true);
    try { const { data: r } = await api.post(path, body); setPlayer(r.player); ok?.(r); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  const enhance = () => call("/gear/enhance", { slot, protect }, (r) => {
    if (r.success) { sfx("land"); toast.success(`Enhance success! ${g.name} +${r.enh}`); pushSystem(`${g.name} enhanced to +${r.enh}`, "epic"); }
    else { sfx("snap"); toast.error(r.dropped ? `Enhance failed… dropped to +${r.enh}` : "Enhance failed"); }
  });

  return (
    <Modal title="Gear Forge" width={820} testid="gear-modal">
      <div className="flex gap-2 mb-4">
        {Object.keys(SLOT_LABEL).map((s) => (
          <button key={s} type="button" onClick={() => setSlot(s)} data-testid={`gear-tab-${s}`}
            className={`fr-btn px-4 py-1 text-sm relative ${slot === s ? "" : "fr-btn-dark"}`}>
            {SLOT_LABEL[s]}{p.gear[s].broken && <span className="fr-dot">!</span>}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-[1.1fr_1fr] gap-4">
        <div className="fr-chip !rounded-md p-4 flex flex-col gap-2" data-testid="equipped-gear-card">
          <div className="text-[11px] text-amber-300 font-cinzel tracking-widest">EQUIPPED</div>
          <div className="gold-text text-2xl font-black" data-testid="equipped-gear-name">{g.name} <span className="text-emerald-300">+{g.enh}</span></div>
          <div className="text-sm">Stat <b className="text-cyan-200">{g.effective.toFixed(2)}×</b> · BR <b className="text-amber-200" data-testid="equipped-gear-br">{g.br_value.toLocaleString()}</b></div>
          <div className="text-xs">Durability {g.cur_dur}/{g.dur} {g.broken && <span className="text-red-400 font-bold">BROKEN — stats halved</span>}</div>
          <Bar value={g.cur_dur} max={g.dur} testid="gear-durability-bar" color={g.cur_dur < g.dur * 0.2 ? "linear-gradient(90deg,#d4161b,#ff7a7a)" : "linear-gradient(90deg,#3ee27a,#c6ffd6)"} />
          {c && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="text-sm flex flex-wrap items-center gap-x-3">
                <span>Enhance +{g.enh} → +{g.enh + 1}</span>
                <span className="text-amber-200"><Coins size={12} className="inline" /> {fmt(c.enhance_gold)}</span>
                <span className="text-cyan-200"><Gem size={12} className="inline" /> {c.enhance_stones} stones (have {p.items.enhance_stone || 0})</span>
                <span className="text-emerald-300" data-testid="enhance-chance">{Math.round(c.chance * 100)}%</span>
              </div>
              {g.enh >= 5 && <div className="text-[11px] text-red-300">Failure at +5 or higher drops one level unless protected.</div>}
              <label className="text-xs flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} data-testid="enhance-protect-checkbox" />
                Use Protection Scroll (have {p.items.protection_scroll || 0})
              </label>
              <div className="flex gap-2">
                <button type="button" className="fr-btn flex-1 py-2 flex items-center justify-center gap-1" disabled={busy || g.enh >= data.enhance_max} onClick={enhance} data-testid="enhance-btn"><Hammer size={15} /> Enhance</button>
                <button type="button" className="fr-btn fr-btn-teal flex-1 py-2 flex items-center justify-center gap-1" disabled={busy || !c.repair_gold}
                  onClick={() => call("/gear/repair", { slot }, (r) => toast.success(`Repaired for ${r.cost} gold`))} data-testid="repair-btn">
                  <Wrench size={15} /> Repair {c.repair_gold ? `(${fmt(c.repair_gold)}g)` : ""}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2" data-testid="gear-tier-list">
          {data.gear[slot].map((d) => {
            const owned = p.owned_gear[slot][String(d.tier)];
            const equipped = p.gear[slot].tier === d.tier;
            const locked = p.level < d.level;
            return (
              <div key={d.tier} className={`fr-chip !rounded flex items-center gap-2 px-3 py-2 ${equipped ? "!border-amber-300 shadow-[0_0_10px_#ffd34d]" : ""}`} data-testid={`gear-tier-${slot}-${d.tier}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-cinzel font-bold text-sm truncate">T{d.tier} · {d.name} {owned && <span className="text-emerald-300">+{owned.enh}</span>}</div>
                  <div className="text-[11px] text-amber-100/60">{d.stat}× · BR {d.br.toLocaleString()} · Lv {d.level}</div>
                </div>
                {equipped ? <span className="text-emerald-300 text-xs flex items-center gap-1"><Check size={13} />Equipped</span>
                  : owned ? <button type="button" className="fr-btn fr-btn-dark px-3 py-1 text-xs" disabled={busy} onClick={() => call("/gear/equip", { slot, tier: d.tier })} data-testid={`equip-${slot}-${d.tier}`}>Equip</button>
                  : <button type="button" className="fr-btn px-3 py-1 text-xs flex items-center gap-1" disabled={busy || locked || p.gold < d.price}
                      onClick={() => call("/gear/buy", { slot, tier: d.tier }, () => { sfx("coin"); toast.success(`${d.name} purchased & equipped!`); })} data-testid={`buy-${slot}-${d.tier}`}>
                      {locked ? <><Lock size={11} />Lv {d.level}</> : <><Coins size={11} />{fmt(d.price)}</>}
                    </button>}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
