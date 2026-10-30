import { Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useGame } from "../../store";
import { api, errMsg } from "../../lib/api";
import { sfx } from "../../game/sfx";

export default function CatchPopup({ onClose }) {
  const result = useGame((s) => s.result);
  const data = useGame((s) => s.data);
  const setPlayer = useGame((s) => s.setPlayer);
  if (!result?.fish) return null;
  const f = result.fish;
  const sellNow = async () => {
    try { const { data: r } = await api.post("/inventory/sell", { ids: [f.id] }); setPlayer(r.player); sfx("coin"); toast.success(`Sold for ${r.gold} gold`); onClose(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-[2px]" data-testid="catch-popup">
      <div className={`rar-${f.rarity} relative pop`}>
        <div className="absolute inset-[-120px] pointer-events-none opacity-70 spin-slow"
          style={{ background: "conic-gradient(from 0deg, transparent 0 8%, color-mix(in srgb, var(--rc) 45%, transparent) 10%, transparent 14% 22%, color-mix(in srgb, var(--rc) 45%, transparent) 25%, transparent 29% 38%, color-mix(in srgb, var(--rc) 45%, transparent) 41%, transparent 45% 55%, color-mix(in srgb, var(--rc) 45%, transparent) 58%, transparent 62% 72%, color-mix(in srgb, var(--rc) 45%, transparent) 75%, transparent 79% 88%, color-mix(in srgb, var(--rc) 45%, transparent) 91%, transparent 95%)", maskImage: "radial-gradient(circle, #000 25%, transparent 70%)", WebkitMaskImage: "radial-gradient(circle, #000 25%, transparent 70%)" }} />
        <div className="fr-panel rar-frame relative w-[360px] p-5 flex flex-col items-center text-center">
          {f.new_species && <div className="absolute -top-3 right-4 fr-btn px-3 py-0.5 text-xs" data-testid="new-species-tag">NEW!</div>}
          <div className="font-cinzel text-xs tracking-[0.3em] uppercase rar-text font-black" data-testid="catch-rarity">{f.rarity}{f.variant ? ` · ${f.variant}` : ""}</div>
          <img src={f.img} alt={f.name} className="w-[240px] h-[170px] object-contain my-2 float-y drop-shadow-[0_0_20px_var(--rc)]" data-testid="catch-fish-image" />
          <div className="gold-text text-2xl font-black" data-testid="catch-fish-name">{f.name}</div>
          <div className="text-[12px] text-amber-100/70 italic mt-1 mb-3">“{f.lore}”</div>
          <div className="grid grid-cols-3 gap-2 w-full text-sm">
            <div className="fr-chip py-1"><div className="text-[10px] text-amber-300">WEIGHT</div><b data-testid="catch-weight">{f.weight} kg</b></div>
            <div className="fr-chip py-1"><div className="text-[10px] text-amber-300">VALUE</div><b className="flex items-center justify-center gap-1" data-testid="catch-value"><Coins size={12} color="#ffd34d" />{f.value}</b></div>
            <div className="fr-chip py-1"><div className="text-[10px] text-amber-300">XP</div><b data-testid="catch-xp">+{result.xp}</b></div>
          </div>
          {result.drops.length > 0 && (
            <div className="mt-2 text-xs text-cyan-200 flex items-center gap-1" data-testid="catch-drops">
              <Sparkles size={12} /> {result.drops.map((d) => `${data.items[d.item_id].name} x${d.qty}`).join(", ")}
            </div>
          )}
          {result.level_ups > 0 && <div className="mt-2 font-deco font-black text-fuchsia-300 outline-text" data-testid="catch-levelup">LEVEL UP! Lv.{result.player.level}</div>}
          <div className="flex gap-3 mt-4 w-full">
            <button type="button" className="fr-btn-dark fr-btn flex-1 py-2" onClick={sellNow} data-testid="catch-sell-btn">Sell Now</button>
            <button type="button" className="fr-btn flex-1 py-2" onClick={onClose} data-testid="catch-keep-btn">Keep</button>
          </div>
        </div>
      </div>
    </div>
  );
}
