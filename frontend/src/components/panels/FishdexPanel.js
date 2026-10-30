import { useEffect, useState } from "react";
import Modal from "./Modal";
import { useGame } from "../../store";
import { api } from "../../lib/api";

export default function FishdexPanel() {
  const data = useGame((s) => s.data);
  const [dex, setDex] = useState({});
  const [pick, setPick] = useState(null);
  useEffect(() => { api.get("/fishdex").then((r) => setDex(r.data)); }, []);
  const found = Object.keys(dex).length;
  const sp = pick && data.species.find((s) => s.id === pick);
  return (
    <Modal title="Fishdex · Crystal Lagoon" width={860} testid="fishdex-modal">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-cinzel text-sm">Discovered <b className="text-amber-200" data-testid="fishdex-progress">{found}/{data.species.length}</b></span>
        <div className="fr-bar flex-1"><i style={{ width: `${(100 * found) / data.species.length}%`, background: "linear-gradient(90deg,#f6c445,#fff2a6)" }} /></div>
      </div>
      <div className="grid md:grid-cols-[1fr_260px] gap-4">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {data.species.map((s) => {
            const d = dex[s.id];
            return (
              <button type="button" key={s.id} onClick={() => setPick(s.id)} data-testid={`fishdex-entry-${s.id}`}
                className={`rar-${s.rarity} ${d ? "rar-frame" : "border border-amber-900"} rounded bg-black/50 p-1.5 flex flex-col items-center transition-transform hover:-translate-y-0.5 ${pick === s.id ? "ring-2 ring-white" : ""}`}>
                <img src={s.img} alt="" className="h-14 w-full object-contain" style={d ? {} : { filter: "brightness(0) opacity(0.6)" }} />
                <span className="text-[10px] truncate w-full">{d ? s.name : "???"}</span>
                <span className="text-[9px] uppercase rar-text font-cinzel font-bold">{s.rarity}</span>
              </button>
            );
          })}
        </div>
        <div className="fr-chip !rounded-md p-3 min-h-[200px]" data-testid="fishdex-detail">
          {!sp ? <div className="text-amber-100/50 italic text-sm">Select a fish to read its lore.</div> : (
            <div className={`rar-${sp.rarity} flex flex-col items-center text-center`}>
              <img src={sp.img} alt="" className="h-28 object-contain" style={dex[sp.id] ? {} : { filter: "brightness(0) opacity(0.6)" }} />
              <div className="gold-text font-black text-lg">{dex[sp.id] ? sp.name : "Undiscovered"}</div>
              <div className="rar-text text-xs uppercase font-cinzel font-black">{sp.rarity} · {sp.behavior}</div>
              <div className="text-xs mt-2 text-amber-100/80">Weight {sp.weight[0]}–{sp.weight[1]} kg · Prefers {data.items[sp.bait].name}</div>
              {dex[sp.id] && <div className="text-xs mt-1 text-cyan-200">Caught {dex[sp.id].count}× · Best {dex[sp.id].best_weight} kg</div>}
              <div className="text-xs italic mt-2 text-amber-100/70">{dex[sp.id] ? `“${sp.lore}”` : "Catch one to unlock its lore."}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
