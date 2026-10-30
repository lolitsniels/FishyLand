import { useState } from "react";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import { useGame } from "../../store";
import { api, errMsg, fmt } from "../../lib/api";
import { sfx } from "../../game/sfx";

export default function ShopPanel() {
  const data = useGame((s) => s.data);
  const p = useGame((s) => s.player);
  const setPlayer = useGame((s) => s.setPlayer);
  const [busy, setBusy] = useState(false);
  const buy = async (item_id, qty) => {
    setBusy(true);
    try { const { data: r } = await api.post("/shop/buy", { item_id, qty }); setPlayer(r.player); sfx("coin"); toast.success(`Bought ${data.items[item_id].name} x${qty}`); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <Modal title="Bait & Supplies" testid="shop-modal">
      <div className="text-sm mb-3 text-amber-100/80">Your gold: <b className="text-amber-200" data-testid="shop-gold">{fmt(p.gold)}</b></div>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(data.items).filter(([, it]) => it.price > 0).map(([id, it]) => (
          <div key={id} className="fr-chip !rounded p-3 flex items-center gap-3" data-testid={`shop-item-${id}`}>
            <div className="flex-1">
              <div className="font-cinzel font-bold">{it.name} <span className="text-xs text-amber-300">(have {p.items[id] || 0})</span></div>
              <div className="text-[11px] text-amber-100/60">{it.desc}</div>
              <div className="text-xs text-amber-200 mt-0.5"><Coins size={11} className="inline" /> {fmt(it.price)}</div>
            </div>
            <button type="button" className="fr-btn px-3 py-1 text-xs" disabled={busy || p.gold < it.price} onClick={() => buy(id, 1)} data-testid={`buy-${id}-1`}>x1</button>
            <button type="button" className="fr-btn px-3 py-1 text-xs" disabled={busy || p.gold < it.price * 10} onClick={() => buy(id, 10)} data-testid={`buy-${id}-10`}>x10</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
