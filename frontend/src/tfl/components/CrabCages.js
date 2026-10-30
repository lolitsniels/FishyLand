/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Gold, PearlIcon } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { sfx } from "../lib/sound";
import { t as tt } from "../i18n";

const RARS = ["common", "uncommon", "rare", "epic", "legendary"];

export function useCages() {
  const [st, setSt] = useState(null);
  const load = useCallback(() => api.get("/cages").then((r) => setSt(r.data)).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [load]);
  return [st, load];
}

const left = (iso) => { const m = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

export function CageShop() {
  const { user, setUser } = useGame();
  const [st, reload] = useCages();
  const [qty, setQty] = useState({});
  const buy = async (c) => {
    const n = Number(qty[c.id] || 1);
    try { const r = await api.post("/cages/buy", { cage_id: c.id, qty: n }); setUser(r.data.user); reload(); toast.success(tt("Bought {{v0}} × {{v1}}", { v0: n, v1: c.name })); }
    catch (e) { toast.error(errMsg(e)); }
  };
  if (!st) return null;
  return (
    <Panel icon="crab" title={tt("Crab Cages")} right={<Link to="/game/waters" className="underline">{tt("Place them on the Waters page")}</Link>} testId="shop-cages" bodyClass="!p-0">
      <div className="overflow-x-auto max-w-full">
        <table className="table min-w-[680px]">
          <thead><tr><th>{tt("Cage")}</th><th className="r">{tt("Catches every")}</th><th>{tt("Odds")}</th><th className="r">{tt("Each")}</th><th className="r">{tt("Qty")}</th><th className="r"></th></tr></thead>
          <tbody>
            {st.cages.map((c) => {
              const n = Number(qty[c.id] || 1);
              const locked = c.level > user.level;
              const poor = c.pearls ? (user.pearls || 0) < c.pearls * n : user.gold < c.price * n;
              return (
                <tr key={c.id} data-testid={`shop-cage-${c.id}`}>
                  <td className="w-full lg:max-w-0"><div className="flex items-center gap-2 min-w-[220px]"><GearIcon id={c.id} name={c.name} /><div className="min-w-0"><div className="font-medium">{c.name}</div><div className="text-[11px] text-[var(--text-2)]">{c.desc}</div><div className="text-[11px] text-[var(--muted)] num" data-testid={`cage-owned-${c.id}`}>{c.owned} {tt("owned")}</div></div></div></td>
                  <td className="num r whitespace-nowrap">{c.gap[0]}-{c.gap[1]} min</td>
                  <td className="whitespace-nowrap text-[11px]">{RARS.map((r) => <span key={r} className={`num rar-${r} mr-1.5`} title={r}>{c.odds[r]}%</span>)}</td>
                  <td className="r whitespace-nowrap">{c.pearls ? <span className="num">{c.pearls}<PearlIcon className="ml-0.5" /></span> : <Gold n={c.price} />}</td>
                  <td className="r"><input type="number" min={1} max={20} className="input !w-14 num" value={qty[c.id] ?? 1} onChange={(e) => setQty({ ...qty, [c.id]: e.target.value })} data-testid={`cage-qty-${c.id}`} /></td>
                  <td className="r whitespace-nowrap">{locked ? <span className="text-[11px] text-[#f0a5a3]">{tt("Lv")} {c.level}</span> : <button className="btn btn-sm btn-gold" disabled={poor} onClick={() => buy(c)} data-testid={`buy-cage-${c.id}`}>{tt("Buy")} {c.pearls ? <>{c.pearls * n}<PearlIcon className="ml-0.5" /></> : `${fmt(c.price * n)}g`}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-[var(--muted)] mt-2 px-3 pb-2">{tt("Each cage is used once. Drop it at the water you're at, leave it up to {{v0}} hours and come back to haul. Every water has 5 critters you can only catch in a cage.", { v0: st.max_hours })}</p>
    </Panel>
  );
}

export function CageSlot({ water, here, unlocked, st, onChange }) {
  const { setUser } = useGame();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [haul, setHaul] = useState(null);
  if (!st || !unlocked) return null;
  const placed = st.placed.find((p) => p.water === water.key);
  if (!placed && !here) return null;
  const owned = st.cages.filter((c) => c.owned > 0);
  const place = async (c) => {
    setBusy(true);
    try { const r = await api.post("/cages/place", { cage_id: c.id }); setUser(r.data.user); setOpen(false); onChange(); sfx("cast"); toast.success(tt("{{v0}} dropped in. Come back within {{v1}} hours.", { v0: c.name, v1: st.max_hours })); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const doHaul = async () => {
    if (!placed.full && !window.confirm(tt("Haul now? The cage is used up and you keep the {{v0}} catches so far. Left alone it keeps catching for {{v1}} more.", { v0: placed.caught, v1: left(placed.ends_at) }))) return;
    setBusy(true);
    try { const r = await api.post("/cages/haul"); setUser(r.data.user); setHaul(r.data); onChange(); sfx(r.data.caught.some((c) => ["epic", "legendary"].includes(c.rarity)) ? "rare" : "catch"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1 z-[2]" data-testid={`cage-slot-${water.key}`}>
      {open && !placed && (
        <div className="bg-[rgba(10,9,8,.94)] border border-[var(--gold-dim)] p-1.5 space-y-1 min-w-[180px]" data-testid={`cage-menu-${water.key}`}>
          {owned.length === 0 ? <div className="text-[11px] text-[var(--text-2)] px-1">{tt("No cages.")} <Link to="/game/shop?tab=cages" className="underline text-[var(--gold)]">{tt("Buy one")}</Link></div>
            : owned.map((c) => <button key={c.id} className="flex items-center gap-1.5 w-full text-left text-[11.5px] px-1 py-0.5 hover:bg-[rgba(255,255,255,.06)]" disabled={busy} onClick={() => place(c)} data-testid={`place-cage-${c.id}`}><img src={`/art/gear/${c.id}.webp`} alt="" className="w-6 h-6 object-contain [image-rendering:pixelated]" draggable="false" />{c.name} <span className="num text-[var(--muted)] ml-auto">×{c.owned}</span></button>)}
        </div>
      )}
      {placed ? (
        <button className={`cage-chip ${placed.full ? "cage-chip-ready" : ""}`} disabled={busy || !here} onClick={doHaul} title={here ? tt("Haul your cage") : tt("Travel here to haul your cage")} data-testid={`cage-status-${water.key}`}>
          <img src={`/art/gear/${placed.cage}.webp`} alt="" draggable="false" />
          <span><b className="num">{placed.caught}</b> {tt("caught")} · {placed.full ? tt("Full") : left(placed.ends_at)}</span>
          {here && <span className="cage-chip-cta">{tt("Haul")}</span>}
        </button>
      ) : (
        <button className="cage-chip" onClick={() => setOpen(!open)} data-testid={`cage-place-${water.key}`}>
          <img src="/art/gear/cage_wicker.webp" alt="" draggable="false" className="opacity-70" />
          <span>{tt("Drop a crab cage")}</span>
        </button>
      )}
      {haul && <HaulResult h={haul} onClose={() => setHaul(null)} />}
    </div>
  );
}

function HaulResult({ h, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(0,0,0,.7)] flex items-center justify-center p-4" onClick={onClose} data-testid="cage-haul-result">
      <div className="panel panel-gold max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="font-display text-[18px] text-[#f4ead2]">{tt("You haul up your {{v0}}", { v0: h.cage_name })}</div>
        <div className="text-[12px] text-[var(--text-2)] mb-3">{h.water_name} · +{fmt(h.xp)} XP{h.new_species ? ` · ${h.new_species} ${tt("new species!")}` : ""}</div>
        {h.caught.length === 0 ? <p className="text-[12.5px] text-[var(--text-2)]">{tt("Empty. Nothing crawled in yet, leave it longer next time.")}</p> : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto">
            {h.caught.map((c, i) => (
              <div key={i} className={`border border-[var(--border)] bg-[#0f0d0b] p-1 text-center`} data-testid={`haul-item-${i}`}>
                <img src={`/art/fish_v2/${c.species_id}.webp`} alt="" className="w-full aspect-[3/2] object-contain [image-rendering:pixelated]" draggable="false" />
                <div className={`text-[10.5px] leading-tight rar-${c.rarity}`}>{c.name}</div>
                <div className="text-[10px] text-[var(--muted)] num">{c.weight} kg</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center mt-3">
          <Link to="/game/inventory" className="text-[12px] underline text-[var(--gold)]">{tt("See them in your keepnet")}</Link>
          <button className="btn btn-sm btn-gold" onClick={onClose} data-testid="cage-haul-close">{tt("Nice!")}</button>
        </div>
      </div>
    </div>
  );
}
