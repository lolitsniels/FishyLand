/*
 * FishyLand, Copyright © 2026. All rights reserved.
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
import { Gold, Pearls, PearlIcon } from "../../components/ui-bits";
import { RodInfoDialog } from "../../components/RodInfoDialog";
const enhName = (n) => n;
import { BaitInfoDialog, useBaitValue } from "../../components/BaitInfo";
import { t as tt } from "../../i18n";
import { tierRarity } from "../../components/GameUI";
import { ShopFrame, ShopBanner, ShopItem, SideDeal } from "../../components/ShopFrame";

const PERK_HEAD = { rod: "Luck", reel: "Vendor price", line: "XP" };
const PERK_TITLE = { rod: "Bonus luck on every cast (rarer fish & variants): +1 per tier", reel: "Bonus gold when selling fish you land, +2% per tier", line: "Bonus XP on every catch, +2% per tier" };
const perkText = (slot, tier, extra = 0) => { const n = (tier || 1) - 1 + extra; return n === 0 ? "-" : slot === "rod" ? `+${n} luck` : `+${n * 2}%`; };

const TABS = [
  ["rod", "Rods", "gear/_rod_t5.webp"], ["bait", "Bait", "gear/bait_worm.webp"],
];
const INTRO = {
  rod: "Rods set your power and control in the fight and add +1 luck per tier. Rods are the heart of your tackle: a better rod lands bigger, rarer fish. Your reel and line are upgraded with Pearls from the tackle slots on the right of the screen.",
  reel: "Reels set how fast you recover line and add +2% vendor price per tier when you sell fish.",
  line: "Lines set how much tension you can take before it snaps and add +2% XP per tier.",
  bait: "Bait is used up one per cast. Better bait pulls rarer AND bigger fish, bites more often (fewer empty casts) and some species only take a specific bait. Click any bait for the full breakdown and what it earns you at your current water.",
  enhance: "Fish up trash on empty casts, recycle it into Tackle Scrap from your Inventory, and hammer your rods, reels and lines from +1 to +10 here.",
};



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

const GearPrice = ({ g }) => <>{g.price ? <Gold n={g.price} /> : <span className="text-[var(--muted)]">-</span>}{g.pearls ? <> · <Pearls n={g.pearls} /></> : null}</>;

function GearCard({ g, slot, statKeys, user, act }) {
  const eq = user.gear[slot] === g.id, owned = user.owned_gear.includes(g.id);
  return (
    <ShopItem testid={`shop-item-${g.id}`} img={`/art/gear/${g.id}.webp`} rarity={g.legendary ? "legendary" : tierRarity(g.tier)} onArt={() => act.setInfo(g)}
      name={enhName(g.name, user.enhance?.[g.id])} tag={`T${g.tier}`} badge={eq ? tt("Equipped") : owned ? tt("Owned") : null}
      sub={<>{statKeys.map((k) => <span key={k}>{tt(k)} ×{g[k]}</span>)}<span className="text-[#8fd0f0]" data-testid={`perk-${g.id}`}>{perkText(slot, g.tier, g.luck_bonus || 0)}{slot === "rod" ? "" : ` ${tt(PERK_HEAD[slot]).toLowerCase()}`}</span></>}
      price={<span className="whitespace-nowrap"><GearPrice g={g} /></span>}>
      <GearAction g={g} slot={slot} user={user} miles={act.ms[g.id] || []} buy={act.buy} setInfo={act.setInfo} />
    </ShopItem>
  );
}

const useGearBuy = () => {
  const { setUser } = useGame();
  const busy = useRef(false);
  return async (id) => {
    if (busy.current) return;
    busy.current = true;
    try { const r = await api.post("/shop/buy-gear", { gear_id: id }); setUser(r.data); toast.success(tt("Purchased and equipped")); } catch (e) { toast.error(errMsg(e)); }
    finally { busy.current = false; }
  };
};
// The next piece of tackle worth saving for in a slot: cheapest unowned item the angler can reach soon.
const nextUp = (items, user, key) => [...items].sort((a, b) => a[key] - b[key]).find((g) => !user.owned_gear.includes(g.id) && !g.bound && g.price > 0 && (g.level || 1) <= user.level + 4);

function GearTable({ items, statKeys, slot }) {
  const { user } = useGame();
  const [ms, setMs] = useState({});
  const [info, setInfo] = useState(null);
  useEffect(() => { if (slot === "rod") api.get("/shop/milestones").then((r) => setMs(r.data)).catch(() => {}); }, [slot, user.owned_gear.length]);
  const buy = useGearBuy();
  const sorted = [...items].sort((a, b) => a[statKeys[0]] - b[statKeys[0]]);
  const act = { ms, buy, setInfo };
  const pick = nextUp(items, user, statKeys[0]);
  return (
    <div data-testid={`shop-${slot}`}>
      {pick && (
        <ShopBanner testid="shop-feature" kicker={tt("Your next upgrade")} title={pick.name} bg={`/art/waters/${user.water}.jpg`} img={`/art/gear/${pick.id}.webp`}
          sub={<>{statKeys.map((k) => `${tt(k)} ×${pick[k]}`).join(" · ")} · {perkText(slot, pick.tier, pick.luck_bonus || 0)}{slot === "rod" ? "" : ` ${tt(PERK_HEAD[slot]).toLowerCase()}`}</>}>
          <span className="sf-price-lg"><GearPrice g={pick} /></span>
          <GearAction g={pick} slot={slot} user={user} miles={ms[pick.id] || []} buy={buy} setInfo={setInfo} />
        </ShopBanner>
      )}
      <div className="sf-grid">{sorted.map((g) => <GearCard key={g.id} g={g} slot={slot} statKeys={statKeys} user={user} act={act} />)}</div>
      {info && <RodInfoDialog g={info} miles={ms[info.id] || []} onClose={() => setInfo(null)} />}
    </div>
  );
}

function UpgradeSide() {
  const { user, data } = useGame();
  const buy = useGearBuy();
  const picks = [["rod", data.rods.filter((g) => !g.event && !g.crate), "power"]]
    .map(([slot, items, key]) => [slot, nextUp(items, user, key)]).filter(([, g]) => g);
  return (
    <>
      <div className="sf-side-h">{tt("Next upgrades")}</div>
      {picks.length === 0 && <div className="sf-item-sub p-2">{tt("You own the best tackle you can reach right now.")}</div>}
      {picks.map(([slot, g]) => {
        const locked = (g.level || 1) > user.level, poor = user.gold < g.price;
        return (
          <SideDeal key={slot} testid={`shop-side-${slot}`} img={`/art/gear/${g.id}.webp`} name={g.name} sub={<>{tt(slot)} · T{g.tier} · <Gold n={g.price} /></>}>
            {locked ? <span className="text-[11px] text-[#f0a5a3]">{tt("Lv")} {g.level}</span> : <button className="btn btn-sm btn-gold" disabled={poor} onClick={() => buy(g.id)} data-testid={`shop-side-buy-${g.id}`}>{tt("Buy")}</button>}
          </SideDeal>
        );
      })}
    </>
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
function BaitTable() {
  const { user, setUser, data } = useGame();
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
    <div data-testid="shop-bait">
      <div className="sf-grid">
        {baits.map((b) => { const r = baitRow(b, user, qty); return (
          <ShopItem key={b.id} testid={`shop-bait-${b.id}`} img={`/art/gear/${b.id}.webp`} rarity={tierRarity(Math.ceil((b.luck || 0) / 3) + 1)} onArt={() => setInfo(b)}
            name={b.name} badge={`×${user.bait[b.id] || 0}`}
            sub={<><span>{tt("Luck")} <BaitLuck b={b} /></span><span>{tt("Bite")} +{b.bite}%</span><button type="button" className="underline decoration-dotted" onClick={() => setInfo(b)} data-testid={`bait-info-${b.id}`}>{tt("details")}</button></>}
            price={<span className="text-[12px] whitespace-nowrap"><BaitEach b={b} r={r} user={user} /></span>}>
            <BaitQty b={b} qty={qty} setQty={setQty} /><BaitBuy b={b} r={r} buyBait={buyBait} />
          </ShopItem>
        ); })}
      </div>
      <p className="text-[11.5px] text-[var(--muted)] mt-3">{tt("Live Bait can't be bought here, convert small fish from your keepnet, or buy from other anglers on the market. Crafted baits are made at")} <Link to="/game/crafting" className="underline">{tt("Bait Crafting")}</Link>.</p>
      {info && <BaitInfoDialog bait={info} value={value} onClose={() => setInfo(null)} />}
    </div>
  );
}

export default function Shop() {
  const { user, data } = useGame();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get("tab")) ? params.get("tab") : "rod";
  const setTab = (id) => setParams({ tab: id }, { replace: true });
  if (!data) return null;
  return (
    <div className="fade-in" data-testid="shop-page">
      <ShopFrame testid="shop" tabs={TABS.map(([id, label]) => [id, tt(label)])} value={tab} onChange={setTab} side={<UpgradeSide />}
        wallet={{ gold: user.gold, pearls: user.pearls || 0 }} action={<Link to="/game/market" className="btn btn-sm" data-testid="shop-to-market">{tt("Player Market")}</Link>}>
        <p className="text-[12.5px] text-[var(--text-2)] mb-3" data-testid="shop-intro">{tt(INTRO[tab])}</p>
        {tab === "rod" && <GearTable items={data.rods.filter((g) => !g.event && !g.crate)} statKeys={["power", "control"]} slot="rod" />}
        {tab === "bait" && <BaitTable />}
      </ShopFrame>
    </div>
  );
}
