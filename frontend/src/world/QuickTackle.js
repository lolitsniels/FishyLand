import { useState } from "react";
import { api, errMsg } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { toast } from "sonner";

const SLOTS = [["rod", "Rod"], ["reel", "Reel"], ["line", "Line"], ["bait", "Bait"]];
const ART = { reel: "reel_spool", line: "line_cotton" };

function Upgrade({ slot, user, info, onDone }) {
  const [busy, setBusy] = useState(false);
  const t = user.tackle?.[slot] || { level: 1, max: 10, stat: 1, perk_pct: 0, next_cost: 3 };
  const tr = info?.tracks?.[slot] || {};
  const up = async () => {
    setBusy(true);
    try { const r = await api.post("/tackle/upgrade", { slot }); onDone(r.data.user); toast.success(`${tr.name || slot} upgraded to level ${t.level + 1}!`); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="qt-pop qt-up" data-testid={`quick-upgrade-${slot}`}>
      <div className="qt-pop-h">{tr.name || slot} · Level {t.level}/{t.max}</div>
      <div className="qt-pips" data-testid={`quick-${slot}-pips`}>{Array.from({ length: t.max }, (_, i) => <i key={i} className={i < t.level ? "on" : ""} />)}</div>
      <p className="qt-up-t">{tr.desc}</p>
      <p className="qt-up-t">+{t.perk_pct}% {tr.perk}{t.next_cost ? <> · next level +{t.perk_pct + 2}%</> : null}</p>
      {t.next_cost ? (
        <button type="button" className="fr-btn w-full py-1.5 mt-1 flex items-center justify-center gap-1.5" disabled={busy || (user.pearls || 0) < t.next_cost} onClick={up} data-testid={`quick-upgrade-${slot}-btn`}>
          Upgrade for {t.next_cost} <img src="/art/hud/pearl.webp" alt="Pearls" className="w-4 h-4" />
        </button>
      ) : <div className="qt-empty" data-testid={`quick-${slot}-max`}>Max level reached!</div>}
      {t.next_cost && (user.pearls || 0) < t.next_cost && <div className="qt-up-t !text-[#ffcfa8]">Earn Pearls from quests, achievements and goals.</div>}
    </div>
  );
}

// Right-side tackle slots: rods and bait swap from a quick list, the reel and line upgrade with Pearls.
export function QuickTackle() {
  const { user, setUser, data, lookups } = useGame();
  const [open, setOpen] = useState(null);
  if (!data) return null;
  const current = (slot) => (slot === "bait" ? user.active_bait : slot === "rod" ? user.gear.rod : ART[slot]);
  const nameOf = (slot, id) => (slot === "bait" ? lookups?.baitById[id]?.name : data.rods.find((g) => g.id === id)?.name) || "None";
  const owned = (slot) => (slot === "bait"
    ? Object.entries(user.bait || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, name: nameOf("bait", id), n }))
    : data.rods.filter((g) => user.owned_gear.includes(g.id)).map((g) => ({ id: g.id, name: g.name, n: `T${g.tier}` })));
  const equip = async (slot, id) => {
    try { const r = await api.post("/shop/equip", slot === "bait" ? { bait_id: id } : { gear_id: id }); setUser(r.data); setOpen(null); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="qt pointer-events-auto" data-testid="quick-tackle">
      {SLOTS.map(([slot, label]) => {
        const id = current(slot), lv = ART[slot] ? user.tackle?.[slot]?.level || 1 : null;
        return (
          <div key={slot} className="relative">
            <button type="button" className={`qt-slot ${open === slot ? "on" : ""}`} onClick={() => setOpen(open === slot ? null : slot)} title={lv ? `${label}: level ${lv}` : `${label}: ${nameOf(slot, id)}`} data-testid={`quick-${slot}`}>
              {id ? <img src={`/art/gear/${id}.webp`} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="qt-none">—</span>}
              {lv && <span className="qt-lv" data-testid={`quick-${slot}-level`}>Lv {lv}</span>}
              <span className="qt-cap">{label}{slot === "bait" && id ? ` ×${user.bait?.[id] || 0}` : ""}</span>
            </button>
            {open === slot && lv && <Upgrade slot={slot} user={user} info={data.tackle} onDone={setUser} />}
            {open === slot && !lv && (
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
