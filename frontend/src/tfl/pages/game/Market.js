/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
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
import { DeskTabs } from "../../components/MobileSheets";
import { MarketSell } from "../../components/MarketSell";
import { pixelIcon } from "../../components/PixelIcon";

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

      <Panel bodyClass="!p-0" testId="market-listings">
          {rows.length === 0 ? <Empty>{tt("No listings match.")}</Empty> : (
            <table className="table">
              <thead><tr><th>{tt("Item")}</th><th>{tt("Details")}</th><th>{tt("Seller")}</th><th className="r">{tt("Listed")}</th><th className="r">{tt("Price")}</th><th></th></tr></thead>
              <tbody>
                {rows.map((l) => {
                  const mine = l.seller_id === user.id;
                  return (
                    <tr key={l.id} data-testid={`listing-${l.id}`}>
                      <td><span className="inline-flex items-center gap-1.5">{l.kind === "fish" ? <FishPlate speciesId={l.item.species_id} name={l.item.name} className="w-9 h-5" /> : <GearIcon id={l.kind === "scrap" ? "scrap" : l.kind === "gear" ? l.item.gear_id : l.kind === "pass" || l.kind === "potion" || l.kind === "crate" ? l.item.item_id : l.kind === "bait" ? l.item.bait_id : l.item.ingredient_id} className="!w-9 !h-5" />}<span className={`font-medium rar-${l.item.rarity}`}>{l.item.name}</span></span>{l.qty > 1 && <span className="num text-[var(--muted)]"> ×{l.qty}</span>}{l.item.variant && l.item.variant !== "normal" && <span className="tag tag-variant ml-1.5">{l.item.variant}</span>}{l.kind === "fish" && lookups?.fishById[l.item.species_id]?.baitable && <span className="text-[10px] text-[var(--muted)] ml-1.5" title={tt("Can be used as live bait / crafting ingredient")}>{tt("crafting")}</span>}{l.kind === "fish" && l.kind === "fish" && wantedFor(wanted, l.item) && <WantedTag c={wantedFor(wanted, l.item)} className="ml-1.5" />}</td>
                      <td className="text-[12px] text-[var(--text-2)]">{details(l)}</td>
                      <td><button className="hover:text-[var(--gold)]" onClick={() => nav(`/game/profile/${l.seller}`)}>{l.seller}</button>{!mine && <button className="ml-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--gold)] underline" onClick={() => nav(`/game/messages/${l.seller}`)} data-testid={`msg-seller-${l.id}`}>{tt("whisper")}</button>}</td>
                      <td className="r text-xs text-[var(--muted)]">{ago(l.created_at)}</td>
                      <td className="r"><Gold n={l.price} /></td>
                      <td className="r">{mine ? <button className="btn btn-sm btn-danger" onClick={() => cancel(l)} data-testid={`cancel-${l.id}`}>{tt("Withdraw")}</button> : <button className="btn btn-sm btn-gold" disabled={user.gold < l.price}  onClick={() => buy(l)} data-testid={`buy-${l.id}`}>{tt("Buy")}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
    </div>
  );

  return (
    <div className="space-y-3 fade-in" data-testid="market-page">
      <DeskTabs pinned inline testId="market-tabs" value={tab} onChange={(t) => { if (t !== tab) setRows([]); setTab(t); }} items={[
        { id: "browse", label: "Buy", Icon: pixelIcon("market"), node: listView },
        { id: "sell", label: "Sell", Icon: pixelIcon("coin"), node: <MarketSell /> },
        { id: "mine", label: "My listings", Icon: pixelIcon("chest"), node: listView },
      ]} />
    </div>
  );
}
