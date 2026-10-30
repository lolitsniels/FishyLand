/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Flame, Ghost, Lock, Check } from "lucide-react";
import { api, errMsg, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Rarity, Gold } from "../../components/ui-bits";
import { FishPlate } from "../../components/FishPlate";
import { InfoTabs } from "../../components/MobileSheets";

const left = (iso) => { const s = Math.max(0, (new Date(iso) - Date.now()) / 1000); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
const ART = { rod_hexwood: "/art/gear/rod_hexwood.webp", av_pumpkin: "/art/avatars/av_pumpkin.jpg", potion_witch: "/art/gear/potion_energy.webp" };

export const HW_CANDLES = { common: 1, uncommon: 3, rare: 6, epic: 15, legendary: 40, mythic: 120 };
export const isHallow = (id) => id >= 900 && id < 1000;
export const FishWorth = ({ f }) => isHallow(f.species_id) ? <Candles n={HW_CANDLES[f.rarity]} /> : <Gold n={f.value} />;

export const Candles = ({ n, className = "" }) => <span className={`inline-flex items-center gap-1 num text-[#ffb36b] ${className}`} data-testid="candles-amount"><Flame size={13} className="text-[#ff8a3d]" />{fmt(n || 0)}</span>;

function ShopItem({ it, candles, onBuy, busy, level }) {
  const lowLv = it.level && level < it.level;
  const can = !it.owned && !lowLv && candles >= it.price;
  return (
    <div className={`hw-item ${it.id === "rod_hexwood" ? "hw-item-star" : ""}`} data-testid={`hw-item-${it.id}`}>
      <div className="hw-item-art">{it.kind === "frame" ? <span className="av-frame av-frame-frame_jackolantern block w-14 h-14 p-1.5"><img src="/art/avatars/av_pumpkin.jpg" alt="" className="w-full h-full object-cover" /></span> : <img src={ART[it.id]} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} />}</div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[14px] text-[#ffe2cc]">{it.name}</div>
        <p className="text-[12px] text-[var(--text-2)] mt-0.5">{it.desc}{it.level ? ` Needs level ${it.level}.` : ""}</p>
        <div className="flex items-center gap-3 mt-2">
          <Candles n={it.price} className="text-[13px]" />
          {it.owned ? <span className="text-[12px] text-[var(--ok)] inline-flex items-center gap-1" data-testid={`hw-owned-${it.id}`}><Check size={13} /> Owned</span>
            : <button className="btn btn-sm btn-gold" disabled={!can || busy} onClick={() => onBuy(it)} data-testid={`hw-buy-${it.id}`}>{can ? "Trade" : <><Lock size={11} /> {lowLv ? `Needs level ${it.level}` : "Not enough"}</>}</button>}
        </div>
      </div>
    </div>
  );
}

function Exchange({ rates, candles, disabled, onDone }) {
  const [gold, setGold] = useState(10);
  const [pearls, setPearls] = useState(1);
  const [busy, setBusy] = useState(false);
  const trade = async (to, qty) => {
    setBusy(true);
    try { const r = await api.post("/halloween/exchange", { to, qty: Number(qty) }); toast.success(`The Witch takes ${fmt(r.data.spent)} Soul Candles and hands you ${r.data.got}`); onDone(r.data.user); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const row = (label, val, set, cost, to, unit, id) => (
    <div className="flex items-center gap-2 flex-wrap" data-testid={`hw-exchange-${id}`}>
      <input type="number" min={1} value={val} onChange={(e) => set(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="input num !w-24" data-testid={`hw-exchange-${id}-qty`} />
      <span className="text-[12px] text-[var(--text-2)] flex-1 min-w-[120px]">{label}</span>
      <button className="btn btn-sm btn-gold" disabled={busy || disabled || candles < cost} onClick={() => trade(to, val)} data-testid={`hw-exchange-${id}-button`}>Trade <Candles n={cost} className="text-[12px] ml-1" /></button>
    </div>
  );
  return (
    <Panel icon="halloween" title="Trade candles" testId="hw-exchange">
      <div className="space-y-2.5">
        {row(<>candles for <b className="text-[var(--gold)]">{fmt(gold * rates.gold)} gold</b></>, gold, setGold, gold, "gold", "gold", "gold")}
        {row(<>Pearl{pearls > 1 ? "s" : ""} for {fmt(pearls * rates.pearl)} candles</>, pearls, setPearls, pearls * rates.pearl, "pearls", "pearls", "pearls")}
      </div>
      <p className="text-[11.5px] text-[var(--muted)] mt-2">1 Soul Candle = {rates.gold} gold · {rates.pearl} Soul Candles = 1 Pearl</p>
    </Panel>
  );
}

export default function Halloween() {
  const { user, setUser } = useGame();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/halloween").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  const buy = async (it) => {
    setBusy(true);
    try { const r = await api.post("/halloween/buy", { item_id: it.id }); setUser(r.data.user); toast.success(`The Marsh Witch hands you: ${r.data.item}`); load(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!d) return <div className="panel p-6 text-[var(--muted)]" data-testid="halloween-loading">Lighting the candles…</div>;
  const g = d.ghost;
  return (
    <div className="space-y-3 fade-in" data-testid="halloween-page">
      <section className="hw-hero" style={{ backgroundImage: "url(/art/halloween_banner.jpg)" }}>
        <div className="relative z-[1] p-4 sm:p-6 max-w-xl">
          <div className="label !text-[#ffb36b]">Seasonal event</div>
          <h1 className="font-display text-3xl sm:text-4xl text-[#fff1e4] mt-1">Halloween on the Water</h1>
          <p className="text-[13px] text-[#e8d6c8] mt-2">{d.active ? `Ends in ${left(d.ends_at)}.` : "The Marsh Witch returns on 15 October."} Halloween fish bite in every water. Sell them for Soul Candles and trade those with the Marsh Witch.</p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="hw-chip">Your Soul Candles <Candles n={d.candles} className="text-[15px] ml-1" /></span>
            <Link to="/game/fish" className="btn btn-gold" data-testid="hw-go-fishing">Go fishing</Link>
          </div>
        </div>
      </section>
          <InfoTabs inline testId="hw-sheets" items={[
          { id: "ghost", label: "Ghost boss", Icon: Ghost, node: (
          <Panel icon="skull" title="The ghost boss" testId="hw-ghost">
            <img src="/art/bosses/1099.webp" alt="" className="w-full h-28 object-contain hw-ghost-img" />
            <div className="font-display text-[15px] text-[#ffe2cc] mt-1">{g.name}</div>
            {g.now ? <div className="text-[12.5px] text-[#ffb36b] mt-1" data-testid="hw-ghost-now">Haunting {g.now.water_name || g.now.water} right now, gone in {left(g.now.end)}. Go fish there!</div>
              : g.next ? <div className="text-[12.5px] text-[var(--text-2)] mt-1" data-testid="hw-ghost-next">Next haunting in {left(g.next.start)}.</div> : null}
            <p className="text-[12px] text-[var(--muted)] mt-1.5">Rises every 6 hours for 30 minutes at a random water. Hook it: +15 candles. Land it: +150 candles, the title Ghostbreaker and a boss purse.</p>
          </Panel>) },
          { id: "rates", label: "Candles", Icon: Flame, node: (
          <Panel icon="fish" title="Candles per fish" testId="hw-rates">
            <div className="grid grid-cols-3 gap-1.5 text-center">{Object.entries(d.rates).map(([r, n]) => <div key={r}><Candles n={n} className="justify-center" /><div className={`label !text-[9.5px] rar-${r}`}>{r}</div></div>)}</div>
          </Panel>) },
          ]} />

      <div className="grid lg:grid-cols-[1fr_340px] gap-3">
        <Panel icon="halloween" title="The Marsh Witch's stall" testId="hw-shop">
          <div className="grid sm:grid-cols-2 gap-2.5">{d.shop.map((it) => <ShopItem key={it.id} it={it} candles={d.candles} onBuy={buy} busy={busy || !d.active} level={user?.level || 0} />)}</div>
          <p className="text-[11.5px] text-[var(--muted)] mt-3">Soul Candles keep from year to year. Event rewards stay yours forever.</p>
        </Panel>
        <div className="space-y-3">
          <Exchange rates={d.exchange} candles={d.candles} disabled={!d.active} onDone={(u) => { setUser(u); load(); }} />
        </div>
      </div>

      <Panel icon="fish" title={`Halloween fish · ${d.fish.filter((f) => f.caught).length}/${d.fish.length} caught`} testId="hw-fish">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {d.fish.map((f) => (
            <div key={f.id} className={`journal-cell ${f.caught ? "discovered" : "undiscovered"} !p-2`} data-testid={`hw-fish-${f.id}`}>
              <FishPlate speciesId={f.id} name={f.name} silhouette={!f.caught} className="w-full h-16" />
              <div className="mt-1 flex items-center justify-between gap-1"><span className={`text-[12px] truncate rar-${f.rarity}`}>{f.caught ? f.name : "???"}</span><Rarity r={f.rarity} tag /></div>
              <div className="text-[11px] text-[var(--muted)] flex items-center justify-between"><span>{f.caught ? `${f.caught}× landed` : "Not caught"}</span><Candles n={f.candles} /></div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="text-[11.5px] text-[var(--muted)] flex items-center gap-1.5"><Ghost size={12} /> Halloween fish can't be listed on the Market. Sell them from your catch screen or Inventory.</div>
    </div>
  );
}
