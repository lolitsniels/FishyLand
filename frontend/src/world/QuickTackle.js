import { useState } from "react";
import { api, errMsg } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { toast } from "sonner";

const SLOTS = [["rod", "Rod"], ["reel", "Reel"], ["line", "Line"], ["bait", "Bait"]];

// Right-side tackle slots: tap one for a quick list of what you own and equip it instantly.
export function QuickTackle() {
  const { user, setUser, data, lookups } = useGame();
  const [open, setOpen] = useState(null);
  if (!data) return null;
  const pool = { rod: data.rods, reel: data.reels, line: data.lines };
  const current = (slot) => (slot === "bait" ? user.active_bait : user.gear[slot]);
  const nameOf = (slot, id) => (slot === "bait" ? lookups?.baitById[id]?.name : pool[slot].find((g) => g.id === id)?.name) || "None";
  const owned = (slot) => (slot === "bait"
    ? Object.entries(user.bait || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, name: nameOf("bait", id), n }))
    : pool[slot].filter((g) => user.owned_gear.includes(g.id)).map((g) => ({ id: g.id, name: g.name, n: `T${g.tier}` })));
  const equip = async (slot, id) => {
    try { const r = await api.post("/shop/equip", slot === "bait" ? { bait_id: id } : { gear_id: id }); setUser(r.data); setOpen(null); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="qt pointer-events-auto" data-testid="quick-tackle">
      {SLOTS.map(([slot, label]) => {
        const id = current(slot);
        return (
          <div key={slot} className="relative">
            <button type="button" className={`qt-slot ${open === slot ? "on" : ""}`} onClick={() => setOpen(open === slot ? null : slot)} title={`${label}: ${nameOf(slot, id)}`} data-testid={`quick-${slot}`}>
              {id ? <img src={`/art/gear/${id}.webp`} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="qt-none">—</span>}
              <span className="qt-cap">{label}{slot === "bait" && id ? ` ×${user.bait?.[id] || 0}` : ""}</span>
            </button>
            {open === slot && (
              <div className="qt-pop" data-testid={`quick-list-${slot}`}>
                <div className="qt-pop-h">Your {label.toLowerCase()}s</div>
                {owned(slot).length === 0 && <div className="qt-empty">None owned yet</div>}
                {owned(slot).map((g) => (
                  <button key={g.id} type="button" className={`qt-row ${g.id === id ? "on" : ""}`} disabled={g.id === id} onClick={() => equip(slot, g.id)} data-testid={`quick-equip-${g.id}`}>
                    <img src={`/art/gear/${g.id}.webp`} alt="" /><span className="flex-1 truncate">{g.name}</span><span className="qt-n">{g.id === id ? "In use" : slot === "bait" ? `×${g.n}` : g.n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
