import { useEffect, useState } from "react";
import { toast } from "sonner";
import Modal from "../components/panels/Modal";
import { api, errMsg, fmt, wtRange } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";

const STARS = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };

function PondFish({ f, canManage, bank, onStock }) {
  const locked = !f.stocked && !f.next;
  return (
    <div className={`pond-card panel p-2 flex flex-col items-center text-center gap-1 ${f.stocked ? "is-stocked" : locked ? "is-locked" : "is-next"}`} data-testid={`pond-fish-${f.id}`}>
      <div className="pond-art"><img src={`/art/fish_v2/${f.id}.webp`} alt={f.name} className={locked ? "brightness-0 opacity-50" : ""} /></div>
      <b className="text-[13px] text-[#f4ead2] leading-tight">{f.name}</b>
      <span className={`text-[11px] font-bold rar-${f.rarity}`} data-testid={`pond-fish-rarity-${f.id}`}>{"★".repeat(STARS[f.rarity])} {f.rarity}</span>
      <span className="text-[10.5px] text-amber-100/70">{wtRange(f.min_kg, f.max_kg)}</span>
      {f.stocked ? (
        <span className="pond-tag" data-testid={`pond-fish-status-${f.id}`}>{f.caught ? "In the pond · caught" : "In the pond"}</span>
      ) : f.next ? (
        canManage
          ? <button type="button" className="btn btn-gold btn-sm mt-auto flex items-center gap-1" disabled={bank < f.cost} onClick={() => onStock(f)} data-testid={`pond-stock-${f.id}`}>
              Stock <img src="/art/hud/gold.webp" alt="" className="w-4 h-4" />{fmt(f.cost)}
            </button>
          : <span className="text-[11px] text-amber-200/80 mt-auto" data-testid={`pond-fish-status-${f.id}`}><img src="/art/hud/gold.webp" alt="" className="w-3.5 h-3.5 inline" /> {fmt(f.cost)} · officers stock</span>
      ) : (
        <span className="text-[11px] text-amber-100/50 mt-auto" data-testid={`pond-fish-status-${f.id}`}>Locked · stock the one before</span>
      )}
    </div>
  );
}

// The Pond Keeper on the crew island: buys crew-pond-only species with crew bank gold, one after another.
export function PondKeeper({ onClose }) {
  const { user } = useTfl();
  const cid = user?.crew?.id;
  const [d, setD] = useState(null);
  useEffect(() => { if (cid) api.get(`/crews/${cid}/pond`).then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, [cid]);
  const stock = async (f) => {
    try { const r = await api.post(`/crews/${cid}/pond/stock`, { species_id: f.id }); setD(r.data); toast.success(`Splash! ${f.name} now swims in the crew pond`); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Modal title="Pond Keeper" testid="pond-keeper-modal" width={820} onClose={onClose}>
      <div className="tfl-skin" data-testid="pond-keeper-panel">
        <div className="flex items-end gap-3 mb-3">
          <img src="/art/npc/body_pondkeeper.webp" alt="Pond Keeper Maud" className="w-[70px] shrink-0 drop-shadow-lg" />
          <div className="panel p-3 flex-1">
            <div className="font-cinzel font-bold text-amber-200 text-sm">Pond Keeper Maud</div>
            <p className="text-[13px] text-[#f4ead2]">These fish live in your crew pond and nowhere else. Stock them one by one with crew bank gold, then fish them from the glowing rings round the pond.</p>
          </div>
        </div>
        {!d ? <div className="p-6 text-center text-amber-100/70">Loading…</div> : <>
          <div className="flex flex-wrap gap-3 justify-between items-center mb-3 text-[13px]">
            <span data-testid="pond-progress">Pond stocked: <b>{d.stocked} / {d.total}</b> species</span>
            <span className="flex items-center gap-1" data-testid="pond-bank">Crew bank: <img src="/art/hud/gold.webp" alt="" className="w-4 h-4" /><b>{fmt(d.bank)}</b></span>
          </div>
          {!d.can_manage && <p className="text-[12.5px] text-amber-100/70 italic mb-2" data-testid="pond-readonly">Only the captain and officers can stock the pond. Deposit gold in the crew bank to help.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="pond-grid">
            {d.species.map((f) => <PondFish key={f.id} f={f} canManage={d.can_manage} bank={d.bank} onStock={stock} />)}
          </div>
        </>}
      </div>
    </Modal>
  );
}
