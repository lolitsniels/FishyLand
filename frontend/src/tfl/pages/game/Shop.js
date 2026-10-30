/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { repairPerPoint } from "../../components/Durability";
import { Panel, Gold, Pearls, PearlIcon } from "../../components/ui-bits";
import { GearIcon } from "../../components/GearIcon";
import { RodInfoDialog } from "../../components/RodInfoDialog";
import { EnhanceBench, enhName } from "../../components/EnhanceBench";
import { SizePips, BaitInfoDialog, useBaitValue } from "../../components/BaitInfo";
import { Hammer, Fish, Wand, Disc3, Spline, Info, Box } from "lucide-react";
import { CageShop } from "../../components/CrabCages";
import { t as tt } from "../../i18n";

const PERK_HEAD = { rod: "Luck", reel: "Vendor price", line: "XP" };
const PERK_TITLE = { rod: "Bonus luck on every cast (rarer fish & variants): +1 per tier", reel: "Bonus gold when selling fish you land, +2% per tier", line: "Bonus XP on every catch, +2% per tier" };
const perkText = (slot, tier, extra = 0) => { const n = (tier || 1) - 1 + extra; return n === 0 ? "-" : slot === "rod" ? `+${n} luck` : `+${n * 2}%`; };

const TABS = [
  ["rod", "Rods", Wand], ["reel", "Reels", Disc3], ["line", "Lines", Spline], ["bait", "Bait", Fish], ["cages", "Crab Cages", Box], ["enhance", "Enhance", Hammer],
];
const INTRO = {
  rod: "Rods set your power and control in the fight and add +1 luck per tier. Gear is permanent and swaps freely from your tackle box; match rod, reel and line of the same tier for +5% power and half the wear.",
  reel: "Reels set how fast you recover line and add +2% vendor price per tier when you sell fish.",
  line: "Lines set how much tension you can take before it snaps and add +2% XP per tier.",
  bait: "Bait is used up one per cast. Better bait pulls rarer AND bigger fish, bites more often (fewer empty casts) and some species only take a specific bait. Click any bait for the full breakdown and what it earns you at your current water.",
  cages: "Crab Cages work while you're away. Drop one at your current water from the Waters page, it catches something every 20-60 minutes for up to 8 hours, then come back and haul it up. Each water has 5 critters you can only catch in a cage.",
  enhance: "Fish up trash on empty casts, recycle it into Tackle Scrap from your Inventory, and hammer your rods, reels and lines from +1 to +10 here.",
};

const useNarrow = () => {
  const q = "(max-width: 767px)";
  const [n, setN] = useState(() => window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setN(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return n;
};

const Stat = ({ k, children }) => <span className="shop-stat"><span>{k}</span><b className="num">{children}</b></span>;

function GearAction({ g, slot, user, miles, buy, setInfo }) {
  const owned = user.owned_gear.includes(g.id);
  const eq = user.gear[slot] === g.id;
  const locked = (g.level || 1) > user.level;
  const poor = user.gold < g.price || (g.pearls || 0) > (user.pearls || 0);
  const unmet = miles.some((m) => m.have < m.need);
  const reqBtn = (tid) => <button type="button" className="text-[11px] text-[#f0a5a3] underline decoration-dotted underline-offset-2" onClick={() => setInfo(g)} data-testid={tid}>{tt("Requirements not met")}</button>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5 flex-wrap">
      {(eq || owned) && !g.bound && g.price > 0 && <button className="btn btn-sm btn-gold" disabled={poor} title={poor ? tt("Not enough gold or Pearls") : ""} onClick={() => buy(g.id)} data-testid={`buy-again-${g.id}`}>{tt("Buy spare")}</button>}
      {eq ? <span className="text-[11px] text-[var(--gold)]">{tt("equipped")}</span> : owned ? <span className="text-[11px] text-[var(--muted)]">{tt("owned")}</span>
        : g.milestones && locked ? reqBtn(`req-locked-${g.id}`) : locked ? <span className="text-[11px] text-[#f0a5a3]" data-testid={`locked-${g.id}`}>{tt("Lv")} {g.level}</span>
        : unmet ? reqBtn(`milestones-locked-${g.id}`) : <button className="btn btn-sm btn-gold" disabled={poor} title={poor ? tt("Not enough gold or Pearls") : ""} onClick={() => buy(g.id)} data-testid={`buy-${g.id}`}>{tt("Buy")}</button>}
    </span>
  );
}

const GearName = ({ g, user }) => (
  <>
    <div className="font-medium flex flex-wrap items-center gap-x-1.5 gap-y-0.5 group-hover:text-[var(--gold)] underline decoration-dotted decoration-[#5a3220] underline-offset-2 min-w-0">
      <span className="truncate">{enhName(g.name, user.enhance?.[g.id])}</span> <span className="text-[var(--muted)] text-[10px]">T{g.tier}</span>
      {g.bound && <span className="tag tag-bound !text-[9.5px]" title={tt("Can't be sold on the Market, it stays with the angler who earned it")} data-testid={`untradable-${g.id}`}>{tt("Untradable")}</span>}
      {g.legendary && <span className="tag rar-legendary !text-[9.5px]">{tt("Legendary")}</span>}
    </div>
    <div className="text-[11.5px] text-[var(--muted)] italic truncate">{g.desc}</div>
  </>
);

const GearPrice = ({ g }) => <>{g.price ? <Gold n={g.price} /> : <span className="text-[var(--muted)]">-</span>}{g.pearls ? <> · <Pearls n={g.pearls} /></> : null}</>;

function GearCard({ g, slot, statKeys, user, act }) {
  return (
    <div className="shop-card" data-testid={`shop-item-${g.id}`}>
      <button type="button" className="flex items-center gap-2 min-w-0 w-full text-left group" onClick={() => act.setInfo(g)} data-testid={`rod-info-open-${g.id}`}>
        <GearIcon id={g.id} name={g.name} size="sm" />
        <div className="min-w-0 flex-1"><GearName g={g} user={user} /></div>
      </button>
      <div className="shop-card-stats">
        {statKeys.map((k) => <Stat key={k} k={tt(k)}>×{g[k]}</Stat>)}
        <Stat k={tt(PERK_HEAD[slot])}><span className="text-[#8fd0f0]" data-testid={`perk-${g.id}`}>{perkText(slot, g.tier, g.luck_bonus || 0)}</span></Stat>
        <Stat k={tt("Repair")}>{repairPerPoint(g) ? `${repairPerPoint(g)}g/pt` : tt("free")}</Stat>
      </div>
      <div className="flex items-center justify-between gap-2"><span className="whitespace-nowrap"><GearPrice g={g} /></span><GearAction g={g} slot={slot} user={user} miles={act.ms[g.id] || []} buy={act.buy} setInfo={act.setInfo} /></div>
    </div>
  );
}

function GearTable({ title, items, statKeys, slot }) {
  const { user, setUser } = useGame();
  const narrow = useNarrow();
  const busy = useRef(false);
  const [ms, setMs] = useState({});
  const [info, setInfo] = useState(null);
  useEffect(() => { if (slot === "rod") api.get("/shop/milestones").then((r) => setMs(r.data)).catch(() => {}); }, [slot, user.owned_gear.length]);
  const buy = async (id) => {
    if (busy.current) return;
    busy.current = true;
    try { const r = await api.post("/shop/buy-gear", { gear_id: id }); setUser(r.data); toast.success(tt("Purchased and equipped")); } catch (e) { toast.error(errMsg(e)); }
    finally { busy.current = false; }
  };
  const sorted = [...items].sort((a, b) => a[statKeys[0]] - b[statKeys[0]]);
  const act = { ms, buy, setInfo };
  return (
    <Panel title={title} testId={`shop-${slot}`} bodyClass="!p-0">
      {narrow ? <div className="shop-cards">{sorted.map((g) => <GearCard key={g.id} g={g} slot={slot} statKeys={statKeys} user={user} act={act} />)}</div> : (
      <div className="overflow-x-auto max-w-full">
      <table className="table min-w-[620px]">
        <thead><tr><th>{tt("Item")}</th>{statKeys.map((k) => <th key={k} className="r">{k}</th>)}<th className="r" title={PERK_TITLE[slot]}>{PERK_HEAD[slot]}</th><th className="r" title={tt("Gold per durability point to repair")}>{tt("Repair")}</th><th className="r">{tt("Price")}</th><th className="r"></th></tr></thead>
        <tbody>
          {sorted.map((g) => (
            <tr key={g.id} data-testid={`shop-item-${g.id}`}>
              <td className="w-full lg:max-w-0">
                <div className="flex items-center gap-2 min-w-[200px] cursor-pointer group" onClick={() => setInfo(g)} title={tt("Click for all bonuses")} data-testid={`rod-info-open-${g.id}`}>
                  <GearIcon id={g.id} name={g.name} size="sm" />
                  <div className="min-w-0"><GearName g={g} user={user} /></div>
                </div>
              </td>
              {statKeys.map((k) => <td key={k} className="num r whitespace-nowrap">×{g[k]}</td>)}
              <td className="num r whitespace-nowrap text-[#8fd0f0]" data-testid={`perk-${g.id}`}>{perkText(slot, g.tier, g.luck_bonus || 0)}</td>
              <td className="num r whitespace-nowrap text-[var(--muted)]">{repairPerPoint(g) ? `${repairPerPoint(g)}g/pt` : tt("free")}</td>
              <td className="r whitespace-nowrap"><GearPrice g={g} /></td>
              <td className="r whitespace-nowrap"><GearAction g={g} slot={slot} user={user} miles={ms[g.id] || []} buy={buy} setInfo={setInfo} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>)}
      {info && <RodInfoDialog g={info} miles={ms[info.id] || []} onClose={() => setInfo(null)} />}
    </Panel>
  );
}

function baitRow(b, user, qty) {
  const n = Number(qty[b.id] || (b.pack ? 1 : 10));
  const each = user.bait_discount ? Math.max(1, Math.ceil(b.price * (100 - user.bait_discount) / 100)) : b.price;
  const gCost = each * n, pCost = (b.pearls || 0) * n;
  const locked = (b.level || 1) > user.level;
  return { n, each, gCost, pCost, locked, cantAfford: locked || user.gold < gCost || (pCost && user.pearls < pCost) };
}

const BaitLuck = ({ b }) => b.ground ? <span className="text-[#8fd0f0] text-[11px]" title={tt("Groundbait ignores your luck: common & uncommon fish twice as likely")} data-testid="shop-bait-ground-luck">{tt("ignored")}</span> : `+${b.luck}`;
const BaitEach = ({ b, r, user }) => <>{<Gold n={r.each} />}{r.each !== b.price && <span className="text-[10px] text-[var(--ok)] ml-1" title={"Nettie's favour: -" + user.bait_discount + "% on bait"} data-testid={"bait-discount-" + b.id}>-{user.bait_discount}%</span>}{b.pearls ? <> · <Pearls n={b.pearls} /></> : null}{b.pack ? <div className="text-[10px] text-[var(--muted)]" data-testid={`bait-pack-${b.id}`}>{tt("per pack of {{v0}}", { v0: b.pack })}</div> : null}</>;
const BaitQty = ({ b, qty, setQty }) => <input type="number" min={1} max={500} className="input !w-14 num" value={qty[b.id] ?? (b.pack ? 1 : 10)} onChange={(e) => setQty({ ...qty, [b.id]: e.target.value })} data-testid={`bait-qty-${b.id}`} />;
const BaitBuy = ({ b, r, buyBait }) => r.locked ? <span className="text-[11px] text-[#f0a5a3]" data-testid={`bait-locked-${b.id}`}>{tt("Lv")} {b.level}</span>
  : <button className="btn btn-sm btn-gold whitespace-nowrap" disabled={r.cantAfford} onClick={() => buyBait(b)} data-testid={`buy-bait-${b.id}`}>{tt("Buy")} {fmt(r.gCost)}g{r.pCost ? <> +{r.pCost}<PearlIcon className="ml-0.5" /></> : null}</button>;
const BaitName = ({ b, user, lookups, onClick }) => (
  <button type="button" className="flex items-center gap-2 min-w-0 md:min-w-[190px] pr-2 text-left w-full group" onClick={onClick} data-testid={`bait-info-${b.id}`}>
    <GearIcon id={b.id} name={b.name} />
    <div className="min-w-0">
      <div className="font-medium truncate flex items-center gap-1.5 group-hover:text-[var(--gold)]">{b.name}<Info size={11} className="text-[var(--muted)] shrink-0" /></div>
      <div className="text-[11px] text-[var(--text-2)] num" data-testid={`bait-owned-${b.id}`}>{user.bait[b.id] || 0} {tt("owned")} · {b.waters ? b.waters.map((w) => lookups.waterByKey[w].name).join(", ") : tt("All waters")}</div>
    </div>
  </button>
);

function BaitTable() {
  const { user, setUser, data, lookups } = useGame();
  const narrow = useNarrow();
  const [qty, setQty] = useState({});
  const [info, setInfo] = useState(null);
  const value = useBaitValue([user.water, user.gear?.rod, user.bait_discount]);
  const busy = useRef(false);
  const buyBait = async (b) => {
    if (busy.current) return;
    busy.current = true;
    const n = Number(qty[b.id] || (b.pack ? 1 : 10));
    try { const r = await api.post("/shop/buy-bait", { bait_id: b.id, qty: n }); setUser(r.data); toast.success(tt("Bought {{v0}} × {{v1}}", { v0: n * (b.pack || 1), v1: b.name })); } catch (e) { toast.error(errMsg(e)); }
    finally { busy.current = false; }
  };
  const baits = data.baits.filter((b) => b.price !== null).sort((a, b) => a.luck - b.luck);
  return (
    <Panel icon="worm" title={tt("Bait")} right={narrow ? null : <span className="text-[var(--muted)]">{tt("Click a bait to see what it earns at your water")}</span>} testId="shop-bait" bodyClass="!p-0">
      {narrow ? (
        <div className="shop-cards">
          {baits.map((b) => { const r = baitRow(b, user, qty); return (
            <div key={b.id} className="shop-card" data-testid={`shop-bait-${b.id}`}>
              <BaitName b={b} user={user} lookups={lookups} onClick={() => setInfo(b)} />
              <div className="shop-card-stats">
                <Stat k={tt("Luck")}><BaitLuck b={b} /></Stat><Stat k={tt("Bite")}>+{b.bite}%</Stat>
                <span className="shop-stat"><span>{tt("Size")}</span><SizePips n={b.size || 0} testId={`bait-size-${b.id}`} /></span>
                <Stat k={tt("Each")}><BaitEach b={b} r={r} user={user} /></Stat>
              </div>
              <div className="flex items-center justify-end gap-2"><BaitQty b={b} qty={qty} setQty={setQty} /><BaitBuy b={b} r={r} buyBait={buyBait} /></div>
            </div>
          ); })}
        </div>
      ) : (
      <div className="overflow-x-auto max-w-full">
      <table className="table min-w-[680px]">
        <thead><tr><th>{tt("Bait")}</th><th className="r">{tt("Luck")}</th><th className="r">{tt("Bite")}</th><th title={tt("Bigger fish grade")}>{tt("Size")}</th><th className="r">{tt("Each")}</th><th className="r">{tt("Qty")}</th><th className="r"></th></tr></thead>
        <tbody>
          {baits.map((b) => { const r = baitRow(b, user, qty); return (
            <tr key={b.id} data-testid={`shop-bait-${b.id}`}>
              <td className="w-full lg:max-w-0"><BaitName b={b} user={user} lookups={lookups} onClick={() => setInfo(b)} /></td>
              <td className="num r whitespace-nowrap"><BaitLuck b={b} /></td>
              <td className="num r whitespace-nowrap">+{b.bite}%</td>
              <td><SizePips n={b.size || 0} testId={`bait-size-${b.id}`} /></td>
              <td className="r whitespace-nowrap"><BaitEach b={b} r={r} user={user} /></td>
              <td className="r"><BaitQty b={b} qty={qty} setQty={setQty} /></td>
              <td className="r whitespace-nowrap"><BaitBuy b={b} r={r} buyBait={buyBait} /></td>
            </tr>
          ); })}
        </tbody>
      </table>
      </div>)}
      <p className="text-[11.5px] text-[var(--muted)] mt-2 px-3 pb-2">{tt("Live Bait can't be bought here, convert small fish from your keepnet, or buy from other anglers on the market. Crafted baits (out-luck their shop tier, no Pearls needed) are made at")} <Link to="/game/crafting" className="underline">{tt("Bait Crafting")}</Link>.</p>
      {info && <BaitInfoDialog bait={info} value={value} onClose={() => setInfo(null)} />}
    </Panel>
  );
}

export default function Shop() {
  const { user, data } = useGame();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get("tab")) ? params.get("tab") : "rod";
  const setTab = (id) => setParams({ tab: id }, { replace: true });
  if (!data) return null;
  return (
    <div className="space-y-3 fade-in" data-testid="shop-page">
      <Panel icon="shop" title={tt("Harbour Tackle & Bait")} right={<span>{tt("Your purse:")} <Gold n={user.gold} /> · <Pearls n={user.pearls || 0} /></span>}>
        <div className="flex flex-wrap gap-1 mb-2 border-b border-[var(--border)]" data-testid="shop-tabs">
          {TABS.map(([id, label, Icon]) => <button key={id} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setTab(id)} data-testid={`shop-tab-${id}`}><Icon size={13} />{tt(label)}</button>)}
        </div>
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp" data-testid="shop-intro">{tt(INTRO[tab])}</p>
      </Panel>
      {tab === "rod" && <GearTable title={tt("Rods, power & control")} items={data.rods.filter((g) => !g.event && !g.crate)} statKeys={["power", "control"]} slot="rod" />}
      {tab === "reel" && <GearTable title={tt("Reels, recovery")} items={data.reels} statKeys={["recovery"]} slot="reel" />}
      {tab === "line" && <GearTable title={tt("Lines, tolerance")} items={data.lines} statKeys={["tolerance"]} slot="line" />}
      {tab === "bait" && <BaitTable />}
      {tab === "cages" && <CageShop />}
      {tab === "enhance" && <EnhanceBench />}
    </div>
  );
}
