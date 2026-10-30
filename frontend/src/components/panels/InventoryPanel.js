import { useCallback, useEffect, useState } from "react";
import { Coins, FlaskConical, Sparkles, Gem, ScrollText } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import { useGame } from "../../store";
import { api, errMsg, fmt } from "../../lib/api";
import { sfx } from "../../game/sfx";

const ITEM_ICON = { glow_shrimp: Sparkles, star_lure: Sparkles, stamina_potion: FlaskConical, enhance_stone: Gem, protection_scroll: ScrollText };

export default function InventoryPanel() {
  const [tab, setTab] = useState("fish");
  const [fish, setFish] = useState([]);
  const [sel, setSel] = useState(new Set());
  const p = useGame((s) => s.player);
  const data = useGame((s) => s.data);
  const setPlayer = useGame((s) => s.setPlayer);
  const load = useCallback(() => api.get("/inventory/fish").then((r) => setFish(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const sell = async (all) => {
    try {
      const { data: r } = await api.post("/inventory/sell", all ? { all: true } : { ids: [...sel] });
      setPlayer(r.player); sfx("coin"); toast.success(`Sold ${r.sold} fish for ${fmt(r.gold)} gold`); setSel(new Set()); load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const usePotion = async () => {
    try { const { data: r } = await api.post("/items/use", { item_id: "stamina_potion" }); setPlayer(r.player); toast.success("+30 Stamina"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const selValue = fish.filter((f) => sel.has(f.id)).reduce((a, f) => a + f.value, 0);

  return (
    <Modal title="Inventory" testid="inventory-modal">
      <div className="flex gap-2 mb-3">
        {["fish", "items"].map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)} data-testid={`inventory-tab-${tb}`}
            className={`fr-btn px-4 py-1 text-sm ${tab === tb ? "" : "fr-btn-dark"}`}>{tb === "fish" ? `Fish (${fish.length})` : "Items"}</button>
        ))}
      </div>
      {tab === "fish" ? (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 min-h-[120px]" data-testid="inventory-fish-grid">
            {fish.length === 0 && <div className="col-span-full text-amber-100/50 italic py-8 text-center">Your keep-net is empty. Go fish!</div>}
            {fish.map((f) => (
              <button type="button" key={f.id} onClick={() => toggle(f.id)} data-testid={`inventory-fish-${f.id}`}
                className={`rar-${f.rarity} rar-frame relative rounded bg-black/50 p-1 flex flex-col items-center transition-transform hover:-translate-y-0.5 ${sel.has(f.id) ? "ring-2 ring-white" : ""}`}>
                <img src={f.img} alt="" className="w-full h-12 object-contain" />
                <span className="text-[10px] leading-tight truncate w-full">{f.variant ? `${f.variant} ` : ""}{f.name}</span>
                <span className="text-[10px] text-amber-300">{f.weight}kg · {f.value}g</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-sm mr-auto text-amber-100/80">Selected: {sel.size} · <Coins size={12} className="inline" color="#ffd34d" /> {fmt(selValue)}</span>
            <button type="button" className="fr-btn fr-btn-dark px-4 py-1.5 text-sm" disabled={!sel.size} onClick={() => sell(false)} data-testid="sell-selected-btn">Sell Selected</button>
            <button type="button" className="fr-btn px-4 py-1.5 text-sm" disabled={!fish.length} onClick={() => sell(true)} data-testid="sell-all-btn">Batch Sell All</button>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="inventory-items-list">
          {Object.entries(p.items).filter(([, q]) => q > 0).map(([id, q]) => {
            const Icon = ITEM_ICON[id] || Sparkles;
            return (
              <div key={id} className="fr-chip !rounded flex items-center gap-3 p-2" data-testid={`inventory-item-${id}`}>
                <Icon size={22} color="#ffd34d" />
                <div className="flex-1"><div className="font-cinzel font-bold text-sm">{data.items[id].name} <span className="text-amber-300">x{q}</span></div><div className="text-[11px] text-amber-100/60">{data.items[id].desc}</div></div>
                {id === "stamina_potion" && <button type="button" className="fr-btn px-3 py-1 text-xs" onClick={usePotion} data-testid="use-stamina-potion-btn">Use</button>}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
