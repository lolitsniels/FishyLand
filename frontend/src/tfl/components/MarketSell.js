import { useEffect, useState } from "react";
import { api, fmt, wt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Empty } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { FishPlate } from "./FishPlate";
import { SellDialog, gearMarketHint } from "./SellDialog";
import { enhName } from "./EnhanceBench";
import { useCrates, CRATE_COL } from "./Crates";
import { usePassState } from "./PremiumShop";
import { ListDialog } from "../pages/game/Inventory";
import { isHallow } from "../pages/game/Halloween";
import { t as tt } from "../i18n";

const CATS = [["fish", "Fish"], ["bait", "Bait"], ["ingredient", "Ingredients"], ["tackle", "Tackle"], ["crates", "Crates & passes"], ["other", "Potions & scrap"]];

function Row({ icon, name, sub, onSell, testId }) {
  return (
    <tr data-testid={testId}>
      <td><span className="inline-flex items-center gap-2">{icon}<span className="min-w-0"><span className="block">{name}</span>{sub && <span className="block text-[11px] text-[var(--muted)]">{sub}</span>}</span></span></td>
      <td className="r"><button className="btn btn-sm btn-gold" onClick={onSell} data-testid={`${testId}-sell`}>{tt("Sell")}</button></td>
    </tr>
  );
}

// Market "Sell" tab: pick something from your bag and list it without leaving the Market.
export function MarketSell({ onListed }) {
  const { user, setUser, lookups, data } = useGame();
  const [cat, setCat] = useState("fish");
  const [fish, setFish] = useState(null);
  const [q, setQ] = useState("");
  const [listing, setListing] = useState(null);
  const [stack, setStack] = useState(null);
  const [crates] = useCrates(JSON.stringify(user.crates || {}));
  const [passes] = usePassState();
  const loadFish = () => api.get("/inventory").then((r) => setFish(r.data.fish.filter((f) => !f.listed && !f.mounted && !isHallow(f.species_id)))).catch(() => setFish([]));
  useEffect(() => { loadFish(); }, []); // eslint-disable-line
  if (user.is_guest) return <Panel icon="market" title={tt("Sell")} testId="market-sell"><Empty>{tt("Claim your account (banner above) to sell on the Market.")}</Empty></Panel>;

  const done = async (u) => { setStack(null); setListing(null); setUser(u || (await api.get("/auth/me")).data); loadFish(); onListed?.(); };
  const match = (n) => !q || (n || "").toLowerCase().includes(q.toLowerCase());
  const rows = cat === "fish" ? (fish || []).filter((f) => match(f.name)).sort((a, b) => b.value - a.value).slice(0, 60).map((f) => (
      <Row key={f.id} testId={`sell-fish-${f.id}`} icon={<FishPlate speciesId={f.species_id} name={f.name} className="w-12 h-7" />}
        name={<><span className={`rar-${f.rarity} font-medium`}>{f.name}</span>{f.variant !== "normal" && <span className="tag tag-variant ml-1.5">{f.variant}</span>}</>}
        sub={`${wt(f.weight)} · ${tt("vendor")} ${fmt(f.vendor ?? Math.round(f.value * 0.7))}g`} onSell={() => setListing(f)} />))
    : cat === "bait" ? Object.entries(user.bait).filter(([id, n]) => n > 0 && match(lookups?.baitById[id]?.name)).map(([id, n]) => { const b = lookups?.baitById[id]; return (
      <Row key={id} testId={`sell-bait-${id}`} icon={<GearIcon id={id} />} name={b?.name} sub={`×${n}`}
        onSell={() => setStack({ kind: "bait", id, name: b?.name, owned: n, hint: b?.price ? b.price / (b.pack || 1) : Math.max(20, b?.luck * 25) })} />); })
    : cat === "ingredient" ? Object.entries(user.ingredients || {}).filter(([id, n]) => n > 0 && match(data?.ingredients.find((x) => x.id === id)?.name)).map(([id, n]) => { const i = data?.ingredients.find((x) => x.id === id); return (
      <Row key={id} testId={`sell-ing-${id}`} icon={<GearIcon id={id} />} name={i?.name} sub={`×${n}`}
        onSell={() => setStack({ kind: "ingredient", id, name: i?.name, owned: n, hint: i?.price * 1.5, vendor: i?.price })} />); })
    : cat === "tackle" ? user.owned_gear.flatMap((id) => {
        const g = lookups?.gearById[id];
        if (!g || !match(g.name)) return [];
        const slot = id.split("_")[0];
        const own = user.gear[slot] !== id && g.price > 0 && !g.bound ? [
          <Row key={id} testId={`sell-gear-${id}`} icon={<GearIcon id={id} />} name={enhName(g.name, user.enhance?.[id])} sub={`${slot} · T${g.tier} · ${user.durability?.[id] ?? 100}/100`}
            onSell={() => setStack({ kind: "gear", id, name: enhName(g.name, user.enhance?.[id]), owned: 1, hint: gearMarketHint(g), detail: `T${g.tier} · ${user.durability?.[id] ?? 100}/100` })} />] : [];
        return own.concat((user.spare_copies?.[id] || []).map((c, n) => (
          <Row key={`${id}-${n}`} testId={`sell-gear-copy-${id}-${n}`} icon={<GearIcon id={id} />} name={enhName(g.name, c.enhance)} sub={`${slot} · T${g.tier} · ${c.durability}/100 · ${tt("spare")}`}
            onSell={() => setStack({ kind: "gear", id, copy: n, name: enhName(g.name, c.enhance), owned: 1, hint: gearMarketHint(g), detail: `T${g.tier} · ${c.durability}/100` })} />)));
      })
    : cat === "crates" ? [
      ...(crates?.crates || []).filter((c) => c.owned > 0).map((c) => (
        <Row key={c.id} testId={`sell-crate-${c.id}`} icon={<img src={`/art/gear/${c.id}.webp`} alt="" className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />}
          name={<span className="font-display" style={{ color: CRATE_COL[c.id] }}>{c.name}</span>} sub={`×${c.owned}`}
          onSell={() => setStack({ kind: "crate", id: c.id, name: c.name, owned: c.owned, hint: c.market?.avg || c.expected_value })} />)),
      ...(passes?.passes || []).filter((p) => p.owned > 0).map((p) => (
        <Row key={p.id} testId={`sell-pass-${p.id}`} icon={<GearIcon id={p.id} />} name={tt(p.name)} sub={`×${p.owned}`}
          onSell={() => setStack({ kind: "pass", id: p.id, name: tt(p.name), owned: p.owned, hint: p.days >= 30 ? 250000 : 70000 })} />)),
    ]
    : [
      (user.potion?.have || 0) > 0 && <Row key="potion" testId="sell-potion" icon={<GearIcon id="potion_energy" />} name={tt("Energy Potion")} sub={`×${user.potion.have}`}
        onSell={() => setStack({ kind: "potion", id: "potion_energy", name: tt("Energy Potion"), owned: user.potion.have, hint: 900 })} />,
      (user.scrap || 0) > 0 && <Row key="scrap" testId="sell-scrap" icon={<GearIcon id="scrap" />} name={tt("Tackle Scrap")} sub={`×${user.scrap}`}
        onSell={() => setStack({ kind: "scrap", id: "scrap", name: tt("Tackle Scrap"), owned: user.scrap, hint: 12 })} />,
    ].filter(Boolean);

  return (
    <Panel icon="market" title={tt("Sell from your bag")} testId="market-sell">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <div className="flex flex-wrap border border-[var(--border-2)] rounded-[2px] overflow-hidden">
          {CATS.map(([k, l]) => <button key={k} onClick={() => setCat(k)} className={`px-3 py-1 text-[12.5px] ${cat === k ? "bg-[var(--panel-hi)] text-[var(--gold)]" : "text-[var(--text-2)]"}`} data-testid={`market-sell-cat-${k}`}>{tt(l)}</button>)}
        </div>
        {!["other", "crates"].includes(cat) && <input className="input !w-44" placeholder={tt("Search name...")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="market-sell-search" />}
        <span className="text-[11.5px] text-[var(--muted)] ml-auto">{Math.round((user.market_fee ?? 0.05) * 100)}{tt("% fee when it sells")}</span>
      </div>
      {cat === "fish" && fish === null ? <Empty>{tt("Loading…")}</Empty> : rows.length === 0 ? <Empty>{tt(cat === "tackle" ? "No spare tackle. Equipped and untradable tackle can't be sold." : "Nothing to sell here.")}</Empty> : (
        <table className="table"><tbody>{rows}</tbody></table>
      )}
      {cat === "fish" && (fish || []).length > 60 && !q && <div className="text-[11px] text-[var(--muted)] mt-2">{tt("Showing your 60 most valuable fish. Search to find others.")}</div>}
      {listing && <ListDialog item={listing} onClose={() => setListing(null)} onListed={() => done()} />}
      {stack && <SellDialog item={stack} onClose={() => setStack(null)} onDone={done} />}
    </Panel>
  );
}
