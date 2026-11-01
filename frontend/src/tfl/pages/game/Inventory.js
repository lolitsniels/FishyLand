/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt, wt, ln, RARITIES } from "../../lib/api";
import { useWanted, wantedFor, WantedTag } from "../../lib/useWanted";
import { useGame } from "../../context/GameContext";
import { Panel, Rarity, Gold, Empty } from "../../components/ui-bits";
import { GearIcon } from "../../components/GearIcon";
import { FishPlate } from "../../components/FishPlate";
import { Durability, RepairButton } from "../../components/Durability";
const enhName = (n) => n;
import { Recycle, Info } from "lucide-react";
import { SizePips, BaitInfoDialog, useBaitValue } from "../../components/BaitInfo";
import { t as tt } from "../../i18n";
import { PassBox } from "../../components/PremiumShop";
import { CratesBox } from "../../components/Crates";
import { SellDialog, gearMarketHint } from "../../components/SellDialog";
import { RodInfoDialog } from "../../components/RodInfoDialog";
import { Candles, FishWorth, isHallow, HW_CANDLES } from "./Halloween";
import { sfxAchievements } from "../../lib/sound";
import { LinkChatBtn } from "../../components/ChatItem";
import { GameTabs, Slot, tierRarity } from "../../components/GameUI";
import { lookFace } from "../../../game/look";

export function ListDialog({ item, onClose, onListed }) {
  const [price, setPrice] = useState(Math.round(item.value * 1.2));
  const submit = async () => {
    try { await api.post("/market/list", { kind: "fish", catch_id: item.id, price: Number(price) }); toast.success(tt("{{v0}} listed for {{v1}} gold", { v0: item.name, v1: fmt(price) })); onListed(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,.6)]" onClick={onClose}>
      <div className="panel panel-gold w-80 p-4 space-y-3" onClick={(e) => e.stopPropagation()} data-testid="list-dialog">
        <div className="font-display text-[15px]">{tt("List on market")}</div>
        <div className="text-[13px]"><span className={`rar-${item.rarity}`}>{item.name}</span> · {wt(item.weight)} {tt("· vendor pays")} {fmt(item.vendor ?? Math.round(item.value * 0.7))}g</div>
        <div><label className="label block mb-1">{tt("Asking price (5% fee on sale)")}</label><input type="number" min={1} className="input num" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="list-price-input" /></div>
        <div className="flex gap-2 justify-end"><button className="btn btn-sm" onClick={onClose}>{tt("Cancel")}</button><button className="btn btn-sm btn-gold" onClick={submit} data-testid="list-confirm-button">{tt("List it")}</button></div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

function Loadout({ user, lookups, onInfo, onBait }) {
  const slots = ["rod"].map((k) => [k, lookups?.gearById[user.gear?.[k]]]);
  const bait = lookups?.baitById[user.active_bait];
  return (
    <div className="g-hero !min-h-0 p-3 flex flex-wrap items-end justify-center gap-3 sm:gap-5" style={{ backgroundImage: `url(/art/waters/${user.water}_thumb.jpg)` }} data-testid="loadout-bar">
      <div className="g-portrait g-face !w-[86px] !h-[86px] hidden sm:block"><img src={lookFace(user.avatar)} alt="" /></div>
      {slots.map(([k, g]) => <Slot key={k} cap={tt(k)} id={g?.id} name={g ? enhName(g.name, user.enhance?.[g.id]) : ""} rarity={g?.legendary ? "legendary" : tierRarity(g?.tier)} onClick={() => g && onInfo(g)} testid={`loadout-${k}`}><Durability id={g?.id} className="flex-col !gap-0.5" /></Slot>)}
      <Slot cap={tt("bait")} id={bait?.id} name={bait ? `${bait.name} ×${user.bait[bait.id] || 0}` : ""} rarity={tierRarity(Math.ceil((bait?.luck || 0) / 3) + 1)} onClick={onBait} testid="loadout-bait" />
    </div>
  );
}
const INV_TABS = [["fish", "Keepnet", "gear/bait_live.webp"], ["bait", "Bait box", "gear/bait_worm.webp"], ["tackle", "Tackle box", "inventory"], ["ingredients", "Ingredients", "gear/craft_salted.webp"], ["other", "Crates & more", "pass"]];

export function Pager({ cur, pages, total, onPage }) {
  const from = (cur - 1) * PAGE_SIZE + 1, to = Math.min(cur * PAGE_SIZE, total);
  const nums = [...new Set([1, cur - 1, cur, cur + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[12px]" data-testid="inventory-pager">
      <span className="text-[var(--muted)] mr-auto" data-testid="inventory-pager-range">{tt("Showing")} {fmt(from)}–{fmt(to)} {tt("of")} {fmt(total)}</span>
      <button className="btn btn-sm" disabled={cur <= 1} onClick={() => onPage(cur - 1)} data-testid="inventory-page-prev">{tt("‹ Prev")}</button>
      {nums.map((n, i) => <span key={n} className="flex items-center gap-1.5">{i > 0 && nums[i - 1] < n - 1 && <span className="text-[var(--muted)]">…</span>}<button className={`btn btn-sm num ${n === cur ? "btn-gold" : ""}`} onClick={() => onPage(n)} aria-current={n === cur ? "page" : undefined} data-testid={`inventory-page-${n}`}>{n}</button></span>)}
      <button className="btn btn-sm" disabled={cur >= pages} onClick={() => onPage(cur + 1)} data-testid="inventory-page-next">{tt("Next ›")}</button>
    </div>
  );
}

const cooldownText = (nextAt) => {
  const secs = Math.max(0, Math.floor((new Date(nextAt) - Date.now()) / 1000));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
};

function PotionBox({ onSell }) {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const p = user.potion;
  useEffect(() => { if (!p?.next_at) return undefined; const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, [p?.next_at]);
  if (!p || p.have <= 0) return null;
  const cooling = p.next_at && new Date(p.next_at) > Date.now();
  const full = user.energy >= (user.energy_cap || user.max_energy);
  const drink = async () => {
    setBusy(true);
    try { const r = await api.post("/inventory/potion/use"); setUser(r.data.user); toast.success(tt("You drink the potion, +{{v0}} energy", { v0: r.data.gained })); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Panel icon="potion" title={tt("Potions")} testId="potion-box">
      <div className="flex items-center gap-3" data-testid="potion-row">
        <GearIcon id="potion_energy" name={tt("Energy Potion")} size="md" />
        <div className="flex-1 min-w-0 text-[12px]">
          <div className="font-display text-[13.5px] text-[#f4ead2]">{tt("Energy Potion")} <span className="num text-[var(--muted)]">×{p.have}</span></div>
          <div className="text-[var(--text-2)]">{tt("+{{v0}} energy at once, and it can stack past a full bar up to {{v2}}. One every {{v1}}h.", { v0: p.energy, v1: p.cooldown_h, v2: user.energy_cap })}</div>
          {cooling && <div className="text-[11px] text-[var(--muted)] mt-0.5 num" data-testid="potion-cooldown">{tt("Next one in")} {cooldownText(p.next_at)}</div>}
          {!full && user.energy_cap && user.energy + p.energy > user.energy_cap && <div className="text-[11px] text-[#e0b341] mt-0.5 num" data-testid="potion-cap-hint">{tt("Only +{{v0}} fits right now, the rest would be wasted", { v0: user.energy_cap - user.energy })}</div>}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button className="btn btn-sm btn-gold" disabled={busy || cooling || full} title={full ? tt("You have banked the most energy you can") : cooling ? tt("One potion per cooldown") : ""} onClick={drink} data-testid="potion-drink">{tt("Drink")}</button>
          {!user.is_guest && <button className="btn btn-sm" onClick={onSell} data-testid="sell-potion">{tt("Sell")}</button>}
          {p.have > 0 && <LinkChatBtn item={{ kind: "item", ref: "potion_energy" }} label={tt("Energy Potion")} testId="link-chat-potion" />}
        </div>
      </div>
    </Panel>
  );
}

function SalvageBox({ onSell }) {
  const { user, setUser } = useGame();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/enhance").then((r) => setSt(r.data)).catch(() => {}); }, [user.salvage_count]); // eslint-disable-line
  const recycle = async (trash_id) => {
    setBusy(true);
    try { const r = await api.post("/enhance/recycle", { trash_id }); toast.success(r.data.message); setSt(r.data); setUser(r.data.user); sfxAchievements(r.data.new_achievements); (r.data.new_achievements || []).forEach((a) => toast.success(tt("Achievement unlocked: {{v0}}", { v0: a.name }))); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const rows = st ? st.trash.filter((t) => st.salvage[t.id] > 0) : [];
  return (
    <Panel icon="gear" title={tt("Salvage")} right={<span className="font-sans normal-case tracking-normal text-[12px] inline-flex items-center gap-1.5"><GearIcon id="scrap" className="!w-8 !h-6" /><span className="num text-[#f4ead2]" data-testid="salvage-scrap">{fmt(user.scrap || 0)}</span> <span className="text-[var(--muted)] whitespace-nowrap">{tt("Tackle Scrap")}</span>{user.scrap > 0 && <span className="ml-1"><LinkChatBtn item={{ kind: "item", ref: "scrap" }} label={tt("Tackle Scrap")} testId="link-chat-scrap" /></span>}{user.seals > 0 && <span className="ml-2 inline-flex items-center gap-1"><GearIcon id="seal" className="!w-8 !h-6" /><span className="num text-[#f4ead2]" data-testid="salvage-seals">{user.seals}</span> <span className="text-[var(--muted)]">{tt("Seals")}</span></span>}</span>} testId="salvage-box">
      {!st ? <Empty>{tt("Loading…")}</Empty> : rows.length === 0 ? <Empty>{tt("No trash yet. Now and then an empty cast hauls up junk, recycle it here into Tackle Scrap for the enhancement bench.")}</Empty> : (
        <table className="table"><tbody>
          {rows.map((t) => <tr key={t.id} data-testid={`salvage-row-${t.id}`}><td><span className="flex flex-wrap items-center gap-2"><GearIcon id={t.id} name={t.name} /><span><span>{t.name}</span><div className="text-[10.5px] text-[var(--muted)]">{t.scrap} {tt("scrap each")}</div></span></span></td><td className="num r">×{st.salvage[t.id]}</td><td className="r"><button className="btn btn-sm" disabled={busy} onClick={() => recycle(t.id)} data-testid={`recycle-${t.id}`}>{tt("Recycle")}</button></td></tr>)}
        </tbody></table>
      )}
      <div className="flex items-center gap-2 mt-2">
        <button className="btn btn-sm btn-gold" disabled={busy || rows.length === 0} onClick={() => recycle(null)} data-testid="recycle-all"><Recycle size={11} className="inline -mt-px mr-1" />{tt("Recycle all")}</button>
        {!user.is_guest && (user.scrap || 0) > 0 && <button className="btn btn-sm" onClick={onSell} data-testid="sell-scrap">{tt("Sell scrap on Market")}</button>}
        <Link to="/game/shop?tab=enhance" className="text-[11.5px] underline text-[var(--muted)]">{tt("Enhancement bench →")}</Link>
      </div>
    </Panel>
  );
}

export default function Inventory() {
  const { user, setUser, lookups, data } = useGame();
  const wanted = useWanted();
  const [inv, setInv] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [listing, setListing] = useState(null);
  const [stack, setStack] = useState(null);
  const [rodInfo, setRodInfo] = useState(null);
  const [sort, setSort] = useState("newest");
  const [rf, setRf] = useState("all");
  const [use, setUse] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [info, setInfo] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = INV_TABS.some(([id]) => id === params.get("tab")) ? params.get("tab") : "fish";
  const setTab = (id) => setParams({ tab: id }, { replace: true });
  const baitValue = useBaitValue([user.water, user.gear?.rod]);
  const baitRows = Object.entries(user.bait).filter(([, n]) => n > 0);
  const ingRows = Object.entries(user.ingredients || {}).filter(([, n]) => n > 0);
  const load = () => api.get("/inventory").then((r) => { setInv(r.data); setSel(new Set()); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const fish = useMemo(() => {
    if (!inv) return [];
    const usable = (f) => !!lookups?.fishById[f.species_id]?.baitable;
    const needle = q.trim().toLowerCase();
    const hit = (f) => !needle || f.name.toLowerCase().includes(needle) || (f.water_name || f.water || "").toLowerCase().includes(needle) || (f.variant && f.variant !== "normal" && f.variant.includes(needle)) || f.rarity.includes(needle);
    const isEvent = (f) => !!lookups?.fishById[f.species_id]?.event || isHallow(f.species_id);
    const arr = inv.fish.filter((f) => hit(f) && (rf === "all" || (rf === "event" ? isEvent(f) : f.rarity === rf)) && (use === "all" || (use === "craft" ? usable(f) : use === "wanted" ? !!wantedFor(wanted, f) : !usable(f))));
    const key = { newest: (a, b) => b.caught_at.localeCompare(a.caught_at), value: (a, b) => b.value - a.value, weight: (a, b) => b.weight - a.weight, rarity: (a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity), name: (a, b) => a.name.localeCompare(b.name) }[sort];
    return [...arr].sort(key);
  }, [inv, sort, rf, use, q, lookups, wanted]);
  const pages = Math.max(1, Math.ceil(fish.length / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const pageFish = fish.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [sort, rf, use, q]);
  const offPage = [...sel].filter((id) => !pageFish.some((f) => f.id === id)).length;
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selected = fish.filter((f) => sel.has(f.id));
  const selGold = selected.filter((f) => !isHallow(f.species_id));
  const selValue = selGold.reduce((a, f) => a + (f.vendor ?? Math.round(f.value * 0.7)), 0);
  const selCandles = selected.reduce((a, f) => a + (isHallow(f.species_id) ? HW_CANDLES[f.rarity] : 0), 0);
  const selBonus = selGold.length && selValue > 0 ? Math.round((selValue / selGold.reduce((a, f) => a + f.value * 0.7, 0) - 1) * 100) : 0;

  const act = async (path, label) => {
    try { const r = await api.post(path, { catch_ids: [...sel] }); setUser(r.data.user); toast.success(label(r.data)); sfxAchievements(r.data.new_achievements); (r.data.new_achievements || []).forEach((a) => toast.success(tt("Achievement unlocked: {{v0}}", { v0: a.name }))); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const equip = async (gear_id, copy) => { try { const r = await api.post("/shop/equip", { gear_id, copy }); setUser(r.data); } catch (e) { toast.error(errMsg(e)); } };
  const mount = async (f) => { try { await api.post("/inventory/mount", { catch_id: f.id }); toast.success(tt("{{v0}} mounted on your trophy wall", { v0: f.name })); load(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div className="space-y-3 fade-in" data-testid="inventory-page">
      <Loadout user={user} lookups={lookups} onInfo={setRodInfo} onBait={() => setTab("bait")} />
      <GameTabs testid="inventory-tab" value={tab} onChange={setTab} tabs={INV_TABS.map(([id, label, img]) => [id, label, img, fmt((id === "fish" ? (inv?.total ?? inv?.fish.length) : id === "bait" ? baitRows.reduce((a, [, n]) => a + n, 0) : id === "tackle" ? user.owned_gear.filter((g) => g.startsWith("rod_")).length : id === "ingredients" ? ingRows.reduce((a, [, n]) => a + n, 0) : null) ?? "") || null])} />
      {tab === "fish" && (
        <Panel icon="net" title={tt("Keepnet")} right={<span>{fmt(inv?.total ?? inv?.fish.length ?? 0)} {tt("fish ·")} <Link to="/game/profile" className="underline">{tt("trophy wall")} {inv?.mounted ?? 0}/{inv?.max_trophies ?? 6}</Link></span>} testId="keepnet-panel">
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <input className="input !w-40" placeholder={tt("Search fish…")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={tt("Search keepnet")} data-testid="inventory-search" />
            <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="inventory-sort"><option value="newest">{tt("Newest")}</option><option value="name">A → Z</option><option value="value">{tt("Most valuable")}</option><option value="weight">{tt("Heaviest")}</option><option value="rarity">{tt("Rarest")}</option></select>
            <select className="input !w-auto" value={rf} onChange={(e) => setRf(e.target.value)} data-testid="inventory-rarity-filter"><option value="all">{tt("All rarities")}</option>{RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}<option value="event">{tt("Event")}</option></select>
            <select className="input !w-auto" value={use} onChange={(e) => setUse(e.target.value)} data-testid="inventory-use-filter"><option value="all">{tt("Any use")}</option><option value="craft">{tt("Crafting & live bait")}</option><option value="plain">{tt("Sell or keep only")}</option><option value="wanted">{tt("Wanted for a contract")}</option></select>
            <button className="btn btn-sm" onClick={() => setSel(new Set(fish.map((f) => f.id)))} title={pages > 1 ? `Selects all ${fmt(fish.length)} matching fish across every page` : undefined} data-testid="select-all-button">{tt("Select all")}</button>
            <button className="btn btn-sm" onClick={() => setSel(new Set(fish.filter((f) => f.rarity === "common" && f.variant === "normal").map((f) => f.id)))} data-testid="select-commons-button">{tt("Select plain commons")}</button>
            <div className="ml-auto flex gap-2 items-center">
              <span className="text-[12px] text-[var(--text-2)]">{sel.size} {tt("selected")}{offPage > 0 && <span className="text-[var(--muted)]" data-testid="selected-off-page"> ({offPage} {tt("on other pages)")}</span>} {tt("· vendor")} <Gold n={selValue} />{selCandles > 0 && <span className="ml-1" data-testid="sel-candles"><Candles n={selCandles} /></span>}{selBonus > 0 && <span className="text-[11px] text-[#8fd0f0]" title={tt("Reel tier, species mastery and any server-wide booster, applied when you sell")} data-testid="vendor-bonus"> (+{selBonus}%)</span>}</span>
              <button className="btn btn-sm btn-gold" disabled={!sel.size} onClick={() => act("/inventory/sell", (d) => `Sold ${d.count} fish for ${fmt(d.gold)} gold${d.candles ? ` and ${d.candles} Soul Candles` : ""}`)} data-testid="sell-selected-button">{tt("Sell to vendor")}</button>
              <button className="btn btn-sm" disabled={!selected.some((f) => lookups?.fishById[f.species_id]?.baitable)} onClick={() => act("/inventory/use-bait", (d) => `Made ${d.bait} live bait`)} data-testid="bait-selected-button">{tt("Make live bait")}</button>
            </div>
          </div>
          {inv && inv.total > inv.shown && <div className="text-[11.5px] text-[#ffcfa8] mb-2" data-testid="inventory-truncated">{tt("Your keepnet holds")} {fmt(inv.total)} {tt("fish, showing the newest")} {fmt(inv.shown)}{tt(". Sell or list some and the older ones surface.")}</div>}
          {!inv ? <Empty>{tt("Loading...")}</Empty> : fish.length === 0 ? <Empty>{tt("Your keepnet is empty. Go catch something.")}</Empty> : (
            <div className="g-grid-sm" data-testid="inventory-table">
              {pageFish.map((f) => (
                <div key={f.id} className={`g-card rc-${f.rarity} !p-2 !gap-1 cursor-pointer ${sel.has(f.id) ? "sel" : ""}`} onClick={() => toggle(f.id)} data-testid={`inv-row-${f.id}`}>
                  <input type="checkbox" className="absolute top-2 left-2 z-[1]" checked={sel.has(f.id)} onChange={() => toggle(f.id)} onClick={(e) => e.stopPropagation()} data-testid={`inv-check-${f.id}`} />
                  {f.variant !== "normal" && <span className="badge !text-[#f0a35b] !border-[#f0a35b]">{f.variant}</span>}
                  <div className="art !h-[64px]"><FishPlate speciesId={f.species_id} name={f.name} className="w-full h-[60px] !border-0 !bg-transparent" /></div>
                  <div className={`name !text-[12px] truncate rar-${f.rarity}`}>{f.name}</div>
                  <div className="text-[10.5px] text-[var(--text-2)] truncate">{lookups?.waterByKey[f.water]?.name}</div>
                  <div className="flex items-center justify-between text-[11px] num"><span>{wt(f.weight)}</span><FishWorth f={f} /></div>
                  {(lookups?.fishById[f.species_id]?.baitable || wantedFor(wanted, f)) && <div className="flex flex-wrap gap-1">{lookups?.fishById[f.species_id]?.baitable && <span className="text-[9.5px] text-[#8fd0f0]">{tt("crafting/bait")}</span>}{wantedFor(wanted, f) && <WantedTag c={wantedFor(wanted, f)} />}</div>}
                  <div className="flex gap-1 justify-center mt-0.5" onClick={(e) => e.stopPropagation()}>
                    {!isHallow(f.species_id) && <button className="btn btn-sm !px-2" onClick={() => setListing(f)} data-testid={`list-fish-${f.id}`}>{tt("List")}</button>}
                    <button className="btn btn-sm !px-2" title={tt("Mount on trophy wall")} disabled={inv.mounted >= inv.max_trophies} onClick={() => mount(f)} data-testid={`mount-fish-${f.id}`}>{tt("Mount")}</button>
                    <LinkChatBtn item={{ kind: "fish", ref: f.id }} label={`${f.name} ${wt(f.weight)}`} testId={`link-chat-fish-${f.id}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {pages > 1 && <Pager cur={cur} pages={pages} total={fish.length} onPage={setPage} />}
        </Panel>
      )}
      {tab === "bait" && (
        <Panel icon="bait" title={tt("Bait box")} right={<Link to="/game/shop?tab=bait" className="text-[11.5px] underline">{tt("Buy bait")}</Link>} testId="bait-box">
          {baitRows.length === 0 ? <Empty>{tt("No bait.")} <Link to="/game/shop?tab=bait" className="underline">{tt("Buy some")}</Link></Empty> : (
            <table className="table" data-testid="bait-box-table">
              <thead><tr><th>{tt("Bait")}</th><th className="r">{tt("Luck")}</th><th className="r">{tt("Bite")}</th><th>{tt("Size")}</th><th className="r">{tt("Have")}</th><th className="r"></th></tr></thead>
              <tbody>
              {baitRows.sort(([a], [b]) => (lookups?.baitById[b]?.luck || 0) - (lookups?.baitById[a]?.luck || 0)).map(([id, n]) => { const b = lookups?.baitById[id]; return <tr key={id} data-testid={`bait-row-${id}`}><td><button type="button" className="flex flex-wrap items-center gap-2 text-left group" onClick={() => b && setInfo(b)} data-testid={`bait-box-info-${id}`}><GearIcon id={id} /><span className="group-hover:text-[var(--gold)]">{b?.name}</span><Info size={11} className="text-[var(--muted)]" />{b?.crafted && <span className="label !text-[9.5px]">{tt("crafted")}</span>}{b?.waters && !b.waters.includes(user.water) && <span className="text-[10px] text-[#f59a5c]" title={tt("Made for other waters, only a third of its luck here")}>{tt("off-water")}</span>}</button></td><td className="num r">{b?.ground ? <span className="text-[#8fd0f0] text-[11px]">{tt("ignored")}</span> : `+${b?.luck ?? 0}`}</td><td className="num r">+{b?.bite ?? 0}%</td><td><SizePips n={b?.size || 0} /></td><td className="num r">×{n}</td><td className="r whitespace-nowrap">{user.active_bait === id ? <span className="text-[11px] text-[var(--gold)] mr-1" data-testid={`bait-active-${id}`}>{tt("active")}</span> : <button className="btn btn-sm" onClick={async () => setUser((await api.post("/shop/equip", { bait_id: id })).data)} data-testid={`use-bait-${id}`}>{tt("Use")}</button>} {!b?.duel && <button className="btn btn-sm" onClick={() => setStack({ kind: "bait", id, name: b?.name, owned: n, hint: b?.price ? b.price / (b.pack || 1) : Math.max(20, b?.luck * 25) })} data-testid={`sell-bait-${id}`}>{tt("Sell")}</button>} <LinkChatBtn item={{ kind: "item", ref: id }} label={b?.name || id} testId={`link-chat-bait-${id}`} /></td></tr>; })}
              </tbody>
            </table>
          )}
          <div className="text-[11px] text-[var(--muted)] mt-2">{tt("Click a bait for its full breakdown: luck, bite rate, fish size, the species only it can catch, and what it earns you per cast at your current water.")}</div>
        </Panel>
      )}
      {tab === "other" && <div className="grid md:grid-cols-2 gap-3">
        <CratesBox onSell={(c) => setStack({ kind: "crate", id: c.id, name: c.name, owned: c.owned, hint: c.market?.avg || c.expected_value })} />
        <PassBox onSell={(p) => setStack({ kind: "pass", id: p.id, name: tt(p.name), owned: p.owned, hint: p.days >= 30 ? 250000 : 70000 })} />
        <PotionBox onSell={() => setStack({ kind: "potion", id: "potion_energy", name: tt("Energy Potion"), owned: user.potion?.have || 0, hint: 900 })} />
      </div>}
      {tab === "ingredients" && (
        <Panel icon="worm" title={tt("Crafting ingredients")} right={<Link to="/game/crafting" className="text-[11.5px] underline">{tt("Bait Crafting")}</Link>} testId="ingredients-box">
          {ingRows.length === 0 ? <Empty>{tt("No ingredients. Buy your daily stock at Bait Crafting.")}</Empty> : (
            <table className="table"><tbody>
              {ingRows.map(([id, n]) => { const i = data?.ingredients.find((x) => x.id === id); return <tr key={id} data-testid={`ing-row-${id}`}><td><span className="flex flex-wrap items-center gap-2"><GearIcon id={id} />{i?.name}</span></td><td className="num r">×{n}</td><td className="r">{user.is_guest ? <span className="text-[11px] text-[var(--muted)]" title={tt("Claim your account to sell ingredients")}>{tt("claim to sell")}</span> : <button className="btn btn-sm" onClick={() => setStack({ kind: "ingredient", id, name: i?.name, owned: n, hint: i?.price * 1.5, vendor: i?.price })} data-testid={`sell-ing-${id}`}>{tt("Sell")}</button>} <LinkChatBtn item={{ kind: "item", ref: id }} label={i?.name || id} testId={`link-chat-ing-${id}`} /></td></tr>; })}
            </tbody></table>
          )}
          <div className="text-[11px] text-[var(--muted)] mt-2">{tt("The vendor sells a limited stock per angler per day, so spare ingredients are worth gold on the Market.")}</div>
        </Panel>
      )}
      {tab === "tackle" && (
        <Panel icon="inventory" title={tt("Tackle box")} right={<RepairButton />} testId="tackle-box">
          <div className="g-grid">
            {user.owned_gear.filter((id) => id.startsWith("rod_")).flatMap((id) => { const g = lookups?.gearById[id]; const slot = id.split("_")[0]; const eq = user.gear[slot] === id; const rc = g?.legendary ? "legendary" : tierRarity(g?.tier); return [
              <div key={id} className={`g-card rc-${rc}`} data-testid={`tackle-card-${id}`}>
                <span className="tier">T{g?.tier}</span>{eq && <span className="badge">{tt("Equipped")}</span>}
                <button type="button" className="art" onClick={g ? () => setRodInfo(g) : undefined} data-testid={`inv-rod-info-${id}`}><img src={`/art/gear/${id}.webp`} alt={g?.name} /></button>
                <div className="name"><span className="label !text-[9.5px] mr-1">{slot}</span>{enhName(g?.name, user.enhance?.[id])}{g?.bound && <span className="tag tag-bound !text-[9.5px] ml-1.5" data-testid={`inv-untradable-${id}`}>{tt("Untradable")}</span>}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Durability id={id} /><RepairButton gearId={id} compact testId={`repair-${id}`} /></div>
                <div className="flex flex-wrap justify-end gap-1 mt-auto">{eq ? null : <><button className="btn btn-sm btn-gold" onClick={() => equip(id)} data-testid={`equip-${id}`}>{tt("Equip")}</button>{g?.price > 0 && !g.bound && !user.is_guest && <button className="btn btn-sm" onClick={() => setStack({ kind: "gear", id, name: enhName(g.name, user.enhance?.[id]), owned: 1, bound: g.bound, hint: gearMarketHint(g), detail: `T${g.tier} · ${user.durability?.[id] ?? 100}/100` })} data-testid={`sell-gear-${id}`}>{tt("Sell")}</button>}</>}<LinkChatBtn item={{ kind: "gear", ref: id }} label={enhName(g?.name, user.enhance?.[id])} testId={`link-chat-gear-${id}`} /></div>
              </div>,
              ...(user.spare_copies?.[id] || []).map((c, n) => (
                <div key={`${id}-${n}`} className={`g-card rc-${rc}`} data-testid={`inv-gear-copy-${id}-${n}`}>
                  <span className="tier">T{g?.tier}</span><span className="badge !border-[#8fd0f0] !text-[#cff6ff]">{tt("Spare")}</span>
                  <button type="button" className="art" onClick={g ? () => setRodInfo(g) : undefined}><img src={`/art/gear/${id}.webp`} alt={g?.name} /></button>
                  <div className="name">{enhName(g?.name, c.enhance)}</div>
                  <div className="flex items-center gap-2"><span className="inline-block w-14 h-1.5 bg-[#2a2420] rounded-full overflow-hidden"><span className="block h-full" style={{ width: `${c.durability}%`, background: c.durability > 50 ? "#5ad07f" : c.durability > 20 ? "#e0b341" : "#e0645a" }} /></span><span className="num text-[11px] text-[var(--text-2)]">{c.durability}/100</span></div>
                  <div className="flex flex-wrap justify-end gap-1 mt-auto"><button className="btn btn-sm btn-gold" onClick={() => equip(id, n)} data-testid={`equip-copy-${id}-${n}`}>{tt("Equip")}</button>{!user.is_guest && <button className="btn btn-sm" onClick={() => setStack({ kind: "gear", id, copy: n, name: enhName(g?.name, c.enhance), owned: 1, hint: gearMarketHint(g), detail: `T${g?.tier} · ${c.durability}/100` })} data-testid={`sell-gear-copy-${id}-${n}`}>{tt("Sell")}</button>}<LinkChatBtn item={{ kind: "gear", ref: id, copy_idx: n }} label={enhName(g?.name, c.enhance)} testId={`link-chat-gear-copy-${id}-${n}`} /></div>
                </div>
              )),
            ]; })}
          </div>
          <div className="text-[11px] text-[var(--muted)] mt-2">{tt("Every fish fought wears your rod by 1 point. A worn-out rod (0/100) still works but at 70% strength. Rods you no longer use can be sold or listed on the Market. Your reel and line never wear out: upgrade them with Pearls from the tackle slots on the right of the screen.")}</div>
        </Panel>
      )}
      {info && <BaitInfoDialog bait={info} value={baitValue} onClose={() => setInfo(null)} />}
      {listing && <ListDialog item={listing} onClose={() => setListing(null)} onListed={() => { setListing(null); load(); }} />}
      {rodInfo && <RodInfoDialog g={rodInfo} onClose={() => setRodInfo(null)} />}
      {stack && <SellDialog item={stack} onClose={() => setStack(null)} onDone={async (u) => { setStack(null); setUser(u || (await api.get("/auth/me")).data); }} />}
    </div>
  );
}
