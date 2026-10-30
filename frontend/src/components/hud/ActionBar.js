import { Settings, Backpack, Sparkles, Wrench, ShoppingBag, Bot, BookOpen, Hammer, Store, Users, Shield, Trophy, FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Ring } from "../fr";
import { useGame } from "../../store";
import { fx } from "../../game/fx";
import { api, errMsg } from "../../lib/api";
import { t } from "../../i18n";
import { sfx } from "../../game/sfx";
import { PORTAL } from "../../portal";

const BAIT_COLORS = { worm: "#d9a066", glow_shrimp: "#7ff3ff", star_lure: "#ffd34d" };

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
      className={`relative w-10 h-10 rounded border-2 grid place-items-center bg-black/60 transition-transform hover:-translate-y-0.5 ${active ? "border-amber-300 shadow-[0_0_12px_#ffd34d]" : "border-amber-800"}`}>
      {id === "stamina_potion" ? <FlaskConical size={18} color="#ff7ad9" /> : <Sparkles size={18} color={BAIT_COLORS[id]} />}
      <span className="absolute bottom-0 right-0.5 text-[10px] font-cinzel font-black outline-text">{qty}</span>
    </button>
  );
  return (
    <div className="flex gap-1 mb-1" data-testid="quick-slots">
      {["worm", "glow_shrimp", "star_lure"].map((b) =>
        slot(b, () => (b === "worm" || p.items[b] > 0 ? setBait(b) : toast.error(`No ${data.items[b].name} — buy some in the Bait shop`)),
          bait === b, b === "worm" ? "∞" : p.items[b] || 0, `quick-slot-${b}`))}
      {slot("stamina_potion", usePotion, false, p.items.stamina_potion || 0, "quick-slot-stamina-potion")}
      <div className="w-10 h-10 rounded border-2 border-dashed border-amber-900/70 bg-black/40" />
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

export default function ActionBar({ cast }) {
  const open = useGame((s) => s.openModal);
  const p = useGame((s) => s.player);
  const soon = (title, desc, phase) => () => open({ type: "soon", title, desc, phase });
  const gearAlert = Object.values(p.gear).some((g) => g.cur_dur <= g.dur * 0.15);
  return (
    <div className="flex flex-col items-center rise" style={{ animationDelay: "0.35s" }} data-testid="action-bar">
      <QuickSlots />
      <div className="fr-panel flex items-end gap-2.5 px-3 pt-1.5 pb-1">
        <Ring icon={Backpack} label="Inventory" size={40} testid="menu-inventory" onClick={() => open({ type: "inventory" })} />
        {!PORTAL && <Ring icon={Sparkles} label="Skills" size={40} dim testid="menu-skills" onClick={soon("Skills", "4 active fishing skills and passives bought with skill points.", 5)} />}
        <Ring icon={Wrench} label="Rod" size={40} dot={gearAlert} testid="menu-gear" onClick={() => open({ type: "gear" })} />
        <Ring icon={ShoppingBag} label="Bait" size={40} testid="menu-shop" onClick={() => open({ type: "shop" })} />
        <FishButton cast={cast} />
        {!PORTAL && <Ring icon={Bot} label="Auto" size={40} dim testid="menu-auto" onClick={soon("Auto Fishing", "Official auto-fishing (70% success, 60% rewards). Free 1h/day, unlimited at VIP 3 or Lv 40.", 6)} />}
        <Ring icon={BookOpen} label="Fishdex" size={40} testid="menu-fishdex" onClick={() => open({ type: "fishdex" })} />
        {!PORTAL && <>
        <Ring icon={Hammer} label="Craft" size={40} dim testid="menu-craft" onClick={soon("Crafting", "Craft gear and baits from fish and materials.", 5)} />
        <Ring icon={Store} label="Market" size={40} dim testid="menu-market" onClick={soon("Market", "Player trading with 5% tax and price history.", 7)} />
        <Ring icon={Users} label="Crew" size={40} dim testid="menu-crew" onClick={soon("Crew", "Friends, whispers and gifting.", 4)} />
        <Ring icon={Shield} label="Guild" size={40} dim testid="menu-guild" onClick={soon("Guild", "Guilds up to 50 with guild boss and shop.", 7)} />
        <Ring icon={Trophy} label="Rankings" size={40} dim testid="menu-rankings" onClick={soon("Rankings", "BR, Level, Biggest Fish and Guild rankings.", 7)} />
        </>}
        {PORTAL && <Ring icon={Settings} label="Settings" size={40} testid="menu-settings" onClick={() => open({ type: "settings" })} />}
      </div>
    </div>
  );
}
