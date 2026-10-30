import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg, fmt, wt } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";

export default function CatchCard({ res, onClose }) {
  const { setUser } = useTfl();
  const [busy, setBusy] = useState(false);
  const c = res.catch || {};
  const sell = async () => {
    setBusy(true);
    try { const { data } = await api.post("/inventory/sell", { catch_ids: [c.id] }); if (data.user) setUser(data.user); toast.success(`Sold for ${fmt(data.gold)} gold`); onClose(); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/55" data-testid="catch-popup">
      <div className={`fr-panel fr-modal pop w-[400px] max-w-[92vw] p-5 flex flex-col items-center text-center gap-2 rar-frame-${c.rarity}`}>
        {res.first_discovery && <div className="text-[11px] font-cinzel tracking-widest text-cyan-200" data-testid="catch-new">NEW SPECIES!</div>}
        <img src={res.img} alt="" className="w-56 h-36 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]" />
        <div className={`font-deco text-2xl font-black rar-${c.rarity}`} data-testid="catch-name">{c.variant && c.variant !== "normal" ? `${c.variant} ` : ""}{c.name}</div>
        <div className="text-xs uppercase tracking-widest font-cinzel text-amber-200/80" data-testid="catch-rarity">{c.rarity}</div>
        <div className="flex gap-4 font-cinzel text-sm">
          <span data-testid="catch-weight">{wt(c.weight)}</span><span className="text-amber-200" data-testid="catch-value">{fmt(c.value)} g</span><span className="text-fuchsia-200" data-testid="catch-xp">+{res.xp} XP</span>
        </div>
        {res.level_up && <div className="gold-text font-deco text-lg" data-testid="catch-levelup">Level {res.level_up}!</div>}
        <div className="flex gap-2 w-full mt-2">
          <button type="button" className="fr-btn fr-btn-dark flex-1 py-2" disabled={busy} onClick={onClose} data-testid="catch-keep-btn">Keep</button>
          <button type="button" className="fr-btn flex-1 py-2" disabled={busy} onClick={sell} data-testid="catch-sell-btn">Sell {fmt(c.vendor ?? Math.round((c.value || 0) * 0.7))} g</button>
        </div>
      </div>
    </div>
  );
}
