import { useState } from "react";
import { toast } from "sonner";
import { Ring, itemImg } from "../fr";
import { useGame } from "../../store";
import { fx } from "../../game/fx";
import { api, errMsg } from "../../lib/api";
import { t } from "../../i18n";
import { sfx } from "../../game/sfx";
import { PORTAL } from "../../portal";

function QuickSlots() {
  const p = useGame((s) => s.player);
  const data = useGame((s) => s.data);
  const bait = useGame((s) => s.bait);
  const setBait = useGame((s) => s.setBait);
  const setPlayer = useGame((s) => s.setPlayer);
  const usePotion = async () => {
    try { const { data: r } = await api.post("/items/use", { item_id: "stamina_potion" }); setPlayer(r.player); sfx("coin"); toast.success("+30 Stamina"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const slot = (id, onClick, active, qty, testid) => (
    <button type="button" key={id} onClick={onClick} data-testid={testid} title={data.items[id].name + " · " + data.items[id].desc}
      className={`relative w-11 h-11 rounded-lg border-2 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,#4a2e10,#140b04)] transition-transform hover:-translate-y-0.5 ${active ? "border-amber-300 shadow-[0_0_12px_#ffd34d]" : "border-amber-800"}`}>
      <img src={itemImg(id)} alt="" draggable={false} className="w-9 h-9 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" />
      <span className="absolute bottom-0 right-0.5 text-[10px] font-cinzel font-black outline-text">{qty}</span>
    </button>
  );
  return (
    <div className="flex gap-1 mb-1" data-testid="quick-slots">
      {["worm", "glow_shrimp", "star_lure"].map((b) =>
        slot(b, () => (b === "worm" || p.items[b] > 0 ? setBait(b) : toast.error(`No ${data.items[b].name} — buy some in the Bait shop`)),
          bait === b, b === "worm" ? "∞" : p.items[b] || 0, `quick-slot-${b}`))}
      {slot("stamina_potion", usePotion, false, p.items.stamina_potion || 0, "quick-slot-stamina-potion")}
    </div>
  );
}

function FishButton({ cast }) {
  const phase = useGame((s) => s.phase);
  const [held, setHeld] = useState(false);
  const fighting = phase === "fight" || phase === "bite";
  const label = phase === "idle" ? t("fish") : fighting ? t("reel") : t("waiting");
  const down = (e) => {
    e.preventDefault();
    fx.hold = true; setHeld(true);
    if (useGame.getState().phase === "idle") cast();
  };
  const up = () => { fx.hold = false; setHeld(false); };
  return (
    <button type="button" data-testid="cast-fish-button" onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      className={`fish-btn w-[92px] h-[92px] -mt-6 grid place-items-center ${held ? "held" : ""} ${phase !== "idle" ? "busy" : ""}`}>
      <span className="font-deco font-black text-xl text-[#3a1c02] drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">{label}</span>
    </button>
  );
}

export const EXTRA_MENUS = [
  { id: "skills", img: "skills", label: "Skills", desc: "4 active fishing skills and passives bought with skill points.", phase: 5 },
  { id: "auto", img: "auto", label: "Auto", title: "Auto Fishing", desc: "Official auto-fishing (70% success, 60% rewards). Free 1h/day, unlimited at VIP 3 or Lv 40.", phase: 6 },
  { id: "craft", img: "craft", label: "Craft", title: "Crafting", desc: "Craft gear and baits from fish and materials.", phase: 5 },
  { id: "market", img: "market", label: "Market", desc: "Player trading with 5% tax and price history.", phase: 7 },
  { id: "crew", img: "crew", label: "Crew", desc: "Friends, whispers and gifting.", phase: 4 },
  { id: "guild", img: "guild", label: "Guild", desc: "Guilds up to 50 with guild boss and shop.", phase: 7 },
  { id: "rankings", img: "rankings", label: "Rankings", desc: "BR, Level, Biggest Fish and Guild rankings.", phase: 7 },
];

export default function ActionBar({ cast, mobile }) {
  const open = useGame((s) => s.openModal);
  const p = useGame((s) => s.player);
  const soon = (title, desc, phase) => () => open({ type: "soon", title, desc, phase });
  const gearAlert = Object.values(p.gear).some((g) => g.cur_dur <= g.dur * 0.15);
  return (
    <div className="flex flex-col items-center rise" style={{ animationDelay: "0.35s" }} data-testid="action-bar">
      <QuickSlots />
      <div className="fr-panel flex items-end gap-2.5 px-3 pt-1.5 pb-1">
        <Ring img="inventory" label="Inventory" size={46} testid="menu-inventory" onClick={() => open({ type: "inventory" })} />
        {!PORTAL && !mobile && <Ring img="skills" label="Skills" size={46} dim testid="menu-skills" onClick={soon("Skills", "4 active fishing skills and passives bought with skill points.", 5)} />}
        <Ring img="rod" label="Rod" size={46} dot={gearAlert} testid="menu-gear" onClick={() => open({ type: "gear" })} />
        <Ring img="bait" label="Bait" size={46} testid="menu-shop" onClick={() => open({ type: "shop" })} />
        <FishButton cast={cast} />
        {!PORTAL && !mobile && <Ring img="auto" label="Auto" size={46} dim testid="menu-auto" onClick={soon("Auto Fishing", "Official auto-fishing (70% success, 60% rewards). Free 1h/day, unlimited at VIP 3 or Lv 40.", 6)} />}
        <Ring img="fishdex" label="Fishdex" size={46} testid="menu-fishdex" onClick={() => open({ type: "fishdex" })} />
        {!PORTAL && !mobile && <>
        <Ring img="craft" label="Craft" size={46} dim testid="menu-craft" onClick={soon("Crafting", "Craft gear and baits from fish and materials.", 5)} />
        <Ring img="market" label="Market" size={46} dim testid="menu-market" onClick={soon("Market", "Player trading with 5% tax and price history.", 7)} />
        <Ring img="crew" label="Crew" size={46} dim testid="menu-crew" onClick={soon("Crew", "Friends, whispers and gifting.", 4)} />
        <Ring img="guild" label="Guild" size={46} dim testid="menu-guild" onClick={soon("Guild", "Guilds up to 50 with guild boss and shop.", 7)} />
        <Ring img="rankings" label="Rankings" size={46} dim testid="menu-rankings" onClick={soon("Rankings", "BR, Level, Biggest Fish and Guild rankings.", 7)} />
        </>}
        {!PORTAL && mobile && <Ring img="settings" label="More" size={46} testid="menu-more" onClick={() => open({ type: "more" })} />}
        {PORTAL && <Ring img="settings" label="Settings" size={46} testid="menu-settings" onClick={() => open({ type: "settings" })} />}
      </div>
    </div>
  );
}
