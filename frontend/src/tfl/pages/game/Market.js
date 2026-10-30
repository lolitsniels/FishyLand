/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { CrateOddsLink } from "../../components/Crates";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, errMsg, fmt, wt, ago, RARITIES } from "../../lib/api";
import { useWanted, wantedFor, WantedTag } from "../../lib/useWanted";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Empty } from "../../components/ui-bits";
import { t as tt } from "../../i18n";
import { FishPlate } from "../../components/FishPlate";
import { GearIcon } from "../../components/GearIcon";
import { ShopFrame } from "../../components/ShopFrame";
import { MarketSell } from "../../components/MarketSell";

export default function Market() {
  const { user, setUser, lookups } = useGame();
  const wanted = useWanted();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(["sell", "mine"].includes(params.get("tab")) ? params.get("tab") : "browse");
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState(params.get("kind") || "");
  const [rarity, setRarity] = useState("");
  const [q, setQ] = useState(params.get("q") || "");
  const [sort, setSort] = useState("newest");

  const load = () => tab !== "sell" && api.get("/market", { params: { kind: kind || undefined, rarity: rarity || undefined, q: q || undefined, sort, mine: tab === "mine" } }).then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [kind, rarity, q, sort, tab]); // eslint-disable-line

  const busy = useRef(false);
  const buy = async (l) => {
    if (busy.current) return;
    busy.current = true;
    try { const r = await api.post(`/market/${l.id}/buy`); setUser(r.data); toast.success(tt("Bought {{v0}} from {{v1}}", { v0: l.item.name, v1: l.seller })); load(); } catch (e) { toast.error(errMsg(e)); }
    finally { busy.current = false; }
  };
  const cancel = async (l) => {
    try { const r = await api.post(`/market/${l.id}/cancel`); setUser(r.data); toast.success(tt("Listing withdrawn")); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const details = (l) => {
    if (l.kind === "fish") return <>{wt(l.item.weight)} · {lookups?.waterByKey[l.item.water]?.name} {tt("· vendor")} {Math.round(l.item.value * 0.7)}g</>;
    if (l.kind === "ingredient") return <>{tt("crafting ingredient · vendor")} {fmt(l.item.vendor_price)}g · {Math.round(l.price / l.qty)}{tt("g each")}</>;
    if (l.kind === "scrap") return <>{tt("enhancement material · fuels the Tackle Shop bench")} · {Math.round(l.price / l.qty)}{tt("g each")}</>;
    if (l.kind === "gear") return <>{tt("tackle")} · T{l.item.tier} {l.item.slot}{l.item.enhance ? <span className="text-[#8fd0f0]"> · +{l.item.enhance} {tt("enhanced")}</span> : null} · {l.item.durability}/100 {tt("durability")} · {tt("shop")} {fmt(l.item.shop_price)}g{user.owned_gear?.includes(l.item.gear_id) && <span className="text-[#f59a5c]"> · {tt("you own one")}</span>}</>;
    if (l.kind === "potion") return <>+{l.item.energy} {tt("energy at once · one per hour · drink from Inventory")}{l.qty > 1 && <> · {Math.round(l.price / l.qty)}{tt("g each")}</>}</>;
    if (l.kind === "crate") return <>{tt("loot crate")} · <CrateOddsLink crateId={l.item.item_id} />{l.qty > 1 && <> · {Math.round(l.price / l.qty)}{tt("g each")}</>}</>;
    if (l.kind === "pass") return <>{l.item.days} {tt("days of Angler Pass · activate from Inventory")}{l.qty > 1 && <> · {Math.round(l.price / l.qty)}{tt("g each")}</>}</>;
    return <>{tt("bait · luck +")}{l.item.luck} · {Math.round(l.price / l.qty)}{tt("g each")}</>;
  };

  const listView = (<div className="space-y-3">
      <Panel icon="market" title={tab === "mine" ? tt("My listings") : tt("Player market")} right={<span>{tt("Purse:")} <Gold n={user.gold} /></span>}>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input !w-auto" value={kind} onChange={(e) => setKind(e.target.value)} data-testid="market-kind-filter"><option value="">{tt("Everything")}</option><option value="fish">{tt("Fish only")}</option><option value="baitfish">{tt("Fish usable for crafting")}</option><option value="bait">{tt("Bait only")}</option><option value="ingredient">{tt("Ingredients only")}</option><option value="gear">{tt("Tackle only")}</option><option value="potion">{tt("Potions only")}</option><option value="scrap">{tt("Tackle Scrap only")}</option><option value="pass">{tt("Angler Passes only")}</option><option value="crate">{tt("Crates only")}</option></select>
          <select className="input !w-auto" value={rarity} onChange={(e) => setRarity(e.target.value)} data-testid="market-rarity-filter"><option value="">{tt("Any rarity")}</option>{RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          <input className="input !w-44" placeholder={tt("Search name...")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="market-search" />
          <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="market-sort"><option value="newest">{tt("Newest")}</option><option value="cheapest">{tt("Cheapest")}</option><option value="priciest">{tt("Priciest")}</option></select>
          <span className="text-[12px] text-[var(--muted)] ml-auto">{rows.length} {tt("listings ·")} {Math.round((user.market_fee ?? 0.05) * 100)}{tt("% fee to seller ·")} <button className="underline" onClick={() => setTab("sell")} data-testid="market-sell-hint">{tt("sell something")}</button></span>
        </div>
      </Panel>

      <div data-testid="market-listings">
          {rows.length === 0 ? <Empty>{tt("No listings match.")}</Empty> : (
            <div className="sf-grid">
              {rows.map((l) => {
                const mine = l.seller_id === user.id;
                const icon = l.kind === "fish" ? null : l.kind === "scrap" ? "scrap" : l.kind === "gear" ? l.item.gear_id : ["pass", "potion", "crate"].includes(l.kind) ? l.item.item_id : l.kind === "bait" ? l.item.bait_id : l.item.ingredient_id;
                return (
                  <div key={l.id} className={`sf-item rc-${l.item.rarity || "common"}`} data-testid={`listing-${l.id}`}>
                    <div className="sf-item-art">{l.kind === "fish" ? <FishPlate speciesId={l.item.species_id} name={l.item.name} className="w-14 h-9" /> : <GearIcon id={icon} className="!w-12 !h-12" />}{l.qty > 1 && <span className="sf-item-badge">×{l.qty}</span>}</div>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className={`sf-item-n rar-${l.item.rarity}`} title={l.item.name}>{l.item.name}{l.item.variant && l.item.variant !== "normal" && <span className="sf-item-tag">{l.item.variant}</span>}{l.kind === "fish" && wantedFor(wanted, l.item) && <WantedTag c={wantedFor(wanted, l.item)} className="ml-1.5" />}</div>
                      <div className="sf-item-sub">{details(l)}</div>
                      <div className="sf-item-sub">{tt("by")} <button className="hover:text-[var(--gold)] underline decoration-dotted" onClick={() => nav(`/game/profile/${l.seller}`)}>{l.seller}</button>{!mine && <button className="ml-1.5 hover:text-[var(--gold)] underline" onClick={() => nav(`/game/messages/${l.seller}`)} data-testid={`msg-seller-${l.id}`}>{tt("whisper")}</button>} · {ago(l.created_at)}</div>
                      <div className="flex items-center justify-between gap-2 mt-auto pt-1.5"><Gold n={l.price} />{mine ? <button className="btn btn-sm btn-danger" onClick={() => cancel(l)} data-testid={`cancel-${l.id}`}>{tt("Withdraw")}</button> : <button className="btn btn-sm btn-gold" disabled={user.gold < l.price} onClick={() => buy(l)} data-testid={`buy-${l.id}`}>{tt("Buy")}</button>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );

  const CATS = [["", "Everything", "market"], ["fish", "Fish", "fishdex"], ["bait", "Bait", "bait"], ["gear", "Tackle", "rod"], ["ingredient", "Ingredients", "craft"], ["crate", "Crates", "daily"], ["pass", "Angler Passes", "pass"]];
  const side = (
    <>
      <div className="sf-side-h">{tt("Categories")}</div>
      {CATS.map(([k, label, ic]) => (
        <button key={k || "all"} type="button" className={`sf-deal w-full text-left ${kind === k && tab !== "sell" ? "on" : ""}`} onClick={() => { setKind(k); if (tab === "sell") setTab("browse"); }} data-testid={`market-cat-${k || "all"}`}>
          <img src={`/art/ui/${ic}.png`} alt="" /><div className="sf-item-n">{tt(label)}</div>
        </button>
      ))}
    </>
  );
  return (
    <div className="fade-in" data-testid="market-page">
      <ShopFrame testid="market-tabs" tabs={[["browse", tt("Buy")], ["sell", tt("Sell")], ["mine", tt("My listings")]]} value={tab} onChange={(t) => { if (t !== tab) setRows([]); setTab(t); }} side={tab === "sell" ? null : side}
        wallet={{ gold: user.gold }} action={<span className="sf-item-sub">{Math.round((user.market_fee ?? 0.05) * 100)}{tt("% fee to seller")}</span>}>
        {tab === "sell" ? <MarketSell /> : listView}
      </ShopFrame>
    </div>
  );
}
