import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { GearIcon } from "./GearIcon";
import { durColor } from "./Durability";
import { t as tt } from "../i18n";

export const ROD_SKINS = { skin_kraken: "Krakenjaw", skin_inferno: "Inferno Wyrm", skin_galleon: "Ghost Galleon", skin_founder: "Golden Founder" };

export function RodSkinArt({ skin, className = "" }) {
  return <img src={`/art/skins/${skin}.png`} alt={ROD_SKINS[skin]} className={`rod-skin rod-skin-${skin} ${className}`} draggable="false" data-testid={`rod-skin-art-${skin}`} />;
}


// Profile tackle: pictures for every slot; a rod skin replaces the rod picture and shows off.
export function ProfileTackle({ p, lookups, mine }) {
  const { user } = useGame();
  const rodSkin = mine ? user.rod_skin : p.rod_skin;
  return (
    <div className="space-y-2" data-testid="profile-tackle">
      {Object.entries(p.gear).map(([slot, id]) => {
        const g = lookups?.gearById[id];
        const skin = slot === "rod" && rodSkin;
        return (
          <div key={slot} className={`flex items-center gap-3 ${skin ? "rod-skin-row" : ""}`} data-testid={`profile-tackle-${slot}`}>
            {skin ? <span className="rod-skin-stage"><RodSkinArt skin={skin} /></span> : <GearIcon id={id} name={g?.name} />}
            <div className="min-w-0 flex-1">
              <div className="label">{slot}{skin && <span className="ml-1.5 text-[#b48cff]" data-testid="profile-rod-skin-name">· {ROD_SKINS[skin]} {tt("skin")}</span>}</div>
              <div className="text-[13px] truncate">{slot === "rod" ? g?.name : `${slot === "reel" ? "Reel" : "Line"} level ${p.tackle?.[slot]?.level || 1}`}</div>
            </div>
            {slot === "rod" ? <>
              <span className="num text-[11.5px]" style={{ color: durColor(p.durability?.[slot] ?? 100) }} title={tt("Condition")}>{p.durability?.[slot] ?? 100}/100</span>
              <span className="num text-[11.5px] text-[var(--muted)] w-7 text-right">T{g?.tier}</span>
            </> : <span className="num text-[11.5px] text-[var(--gold)]" data-testid={`profile-tackle-${slot}-level`}>{p.tackle?.[slot]?.level || 1}/10</span>}
          </div>
        );
      })}
      {mine && <RodSkinPicker />}
    </div>
  );
}

function RodSkinPicker() {
  const { user, setUser } = useGame();
  const owned = user.owned_rod_skins || [];
  if (!owned.length) return null;
  const set = async (skin) => {
    try { const r = await api.post("/cosmetics/rod-skin", { skin }); setUser(r.data.user); toast.success(skin ? tt("Rod skin on") : tt("Rod skin off")); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[12px]" data-testid="rod-skin-picker">
      <span className="label !text-[10px]">{tt("Rod skin")}</span>
      <button className={`btn btn-sm ${!user.rod_skin ? "btn-gold" : ""}`} onClick={() => set(null)} data-testid="rod-skin-none">{tt("None")}</button>
      {owned.map((s) => <button key={s} className={`btn btn-sm ${user.rod_skin === s ? "btn-gold" : ""}`} onClick={() => set(s)} data-testid={`rod-skin-${s}`}>{ROD_SKINS[s] || s}</button>)}
    </div>
  );
}
