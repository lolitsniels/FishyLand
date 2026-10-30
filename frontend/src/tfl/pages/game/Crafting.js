/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt, wt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Empty } from "../../components/ui-bits";
import { GearIcon } from "../../components/GearIcon";
import { SizePips } from "../../components/BaitInfo";
import { t as tt } from "../../i18n";
import { MobileGroup } from "../../components/MobileSheets";

import { CraftFishPicker } from "./CraftFishPicker";
import { pixelIcon } from "../../components/PixelIcon";

export default function Crafting() {
  const { user, setUser, data, lookups } = useGame();
  const [inv, setInv] = useState([]);
  const [recipe, setRecipe] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [qty, setQty] = useState({});
  const load = () => api.get("/inventory").then((r) => { setInv(r.data.fish.filter((f) => lookups.fishById[f.species_id]?.baitable)); setSel(new Set()); }).catch(() => {});
  useEffect(() => { if (lookups) load(); }, [lookups]); // eslint-disable-line
  const ing = user.ingredients || {};
  const bought = user.ingredient_buys || {};
  const left = (i) => Math.max(0, i.daily_cap - (bought[i.id] || 0));
  const resetIn = () => { const n = new Date(); const ms = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime(); const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h ? `${h}h ${m}m` : `${m}m`; };
  const canCraft = (r) => inv.length >= r.fish && Object.entries(r.ingredients).every(([k, n]) => (ing[k] || 0) >= n);
  const maxBatches = (r) => Math.min(50, Math.floor(inv.length / r.fish), ...Object.entries(r.ingredients).map(([k, n]) => Math.floor((ing[k] || 0) / n)));
  const maxFish = recipe ? maxBatches(recipe) * recipe.fish : 0;
  const batches = recipe ? Math.floor(sel.size / recipe.fish) : 0;
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (recipe && n.size < maxFish) n.add(id); return n; });
  const buy = async (i) => {
    const n = Math.min(Number(qty[i.id] || 5), left(i));
    try { const r = await api.post("/shop/buy-ingredient", { ingredient_id: i.id, qty: n }); setUser(r.data); toast.success(tt("Bought {{v0}} × {{v1}}", { v0: n, v1: i.name })); } catch (e) { toast.error(errMsg(e)); }
  };
  const craft = async () => {
    try { const r = await api.post("/craft", { recipe_id: recipe.id, catch_ids: [...sel] }); setUser(r.data.user); toast.success(tt("Crafted {{v0}} × {{v1}}{{v2}}", { v0: r.data.made, v1: r.data.bait, v2: r.data.bonus ? ` (${r.data.bonus} plump bonus)` : "" })); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const sorted = useMemo(() => [...inv].sort((a, b) => (a.variant !== "normal") - (b.variant !== "normal") || a.value - b.value), [inv]);
  const plain = useMemo(() => sorted.filter((f) => f.variant === "normal"), [sorted]);
  const selVariants = [...sel].filter((id) => inv.find((f) => f.id === id)?.variant !== "normal").length;
  if (!data) return null;
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-3 fade-in" data-testid="crafting-page">
      <div className="space-y-3">
        <Panel icon="bait" title={tt("Bait crafting")}>
          <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Combine small bait-grade fish from your keepnet with dockside ingredients to make baits no shop sells. Every crafted bait out-lucks the shop bait of its tier, none of them need Pearls or a level to craft, and Angler's Secret is still the strongest bait in the game. Crafted bait also trades well on the market. Using plump fish (")}{wt(0.4)} {tt("average or more) yields one extra bait.")}</p>
        </Panel>
        <Panel icon="journal" title={tt("Recipes")} bodyClass="!p-0" testId="recipes">
          <table className="table">
            <thead><tr><th>{tt("Bait")}</th><th className="r">{tt("Luck")}</th><th className="r">{tt("Bite")}</th><th>{tt("Size")}</th><th>{tt("Needs")}</th><th className="r">{tt("Yield")}</th><th className="r">{tt("Owned")}</th><th></th></tr></thead>
            <tbody>
              {data.recipes.map((r) => { const b = lookups.baitById[r.id]; const ok = canCraft(r); return (
                <tr key={r.id} className={recipe?.id === r.id ? "bg-[#1f1714]" : ""} data-testid={`recipe-${r.id}`}>
                  <td><div className="flex items-center gap-2"><GearIcon id={r.id} name={b.name} /><div><div className="font-medium text-[#f4ead2]">{b.name}</div><div className="text-[11.5px] text-[var(--muted)] italic">{b.desc.replace("Crafted. ", "")}{b.waters && <span> {tt("Best in")} {b.waters.map((w) => lookups.waterByKey[w].name).join(", ")}.</span>}</div></div></div></td>
                  <td className="num r text-[var(--ok)]">+{b.luck}</td><td className="num r">+{b.bite}%</td><td><SizePips n={b.size || 0} /></td>
                  <td className="text-[12px]"><span className={inv.length >= r.fish ? "" : "text-[#f0a5a3]"}>{r.fish} {tt("small fish")}</span>{Object.entries(r.ingredients).map(([k, n]) => <span key={k} className={`ml-2 ${(ing[k] || 0) >= n ? "" : "text-[#f0a5a3]"}`}>{n}× {data.ingredients.find((i) => i.id === k).name}</span>)}</td>
                  <td className="num r">{r.yield}</td><td className="num r">{user.bait[r.id] || 0}</td>
                  <td className="r"><button className={`btn btn-sm ${ok ? "btn-gold" : ""}`} disabled={!ok} onClick={() => { setRecipe(r); setSel(new Set()); }} data-testid={`select-recipe-${r.id}`}>{recipe?.id === r.id ? tt("Selected") : tt("Craft")}</button></td>
                </tr>); })}
            </tbody>
          </table>
        </Panel>
        {recipe && (
          <Panel icon="fish" title={`Choose small fish for ${lookups.baitById[recipe.id].name} (${recipe.fish} per batch)`} right={<span className="num" data-testid="craft-sel-count">{sel.size} / {maxFish} · {batches} {batches === 1 ? "batch" : "batches"}</span>} testId="craft-fish-picker">
            {sorted.length === 0 ? <Empty>{tt("No bait-grade fish in your keepnet.")}</Empty> : (
              <div className="mb-3"><CraftFishPicker fish={inv} sel={sel} toggle={toggle} max={maxFish} onPick={(ids) => setSel(new Set(ids))} /></div>
            )}
            {sorted.length > plain.length && <p className="text-[11px] text-[var(--muted)] -mt-1 mb-2" data-testid="craft-variant-note">{tt("Variant fish are sorted last by \"Cheapest first\". Harbour contracts often ask for them, so \"Pick cheapest\" leaves them alone.")}</p>}
            {selVariants > 0 && <p className="text-[11.5px] text-[#f59a5c] mb-2" role="alert" data-testid="craft-variant-warning">{tt("Heads up:")} {selVariants} {tt("selected fish")} {selVariants === 1 ? tt("is a variant") : tt("are variants")} {tt("crafting destroys")} {selVariants === 1 ? tt("it") : tt("them")}.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn btn-gold" disabled={!batches || sel.size % recipe.fish !== 0} onClick={craft} data-testid="craft-button">{tt("Craft")} {batches > 1 ? `${batches}× ` : ""}{lookups.baitById[recipe.id].name}{batches ? ` (${batches * recipe.yield}+ bait)` : ""}</button>
              <button className="btn btn-sm" onClick={() => setSel(new Set((plain.length >= maxFish ? plain : sorted).slice(0, maxFish).map((f) => f.id)))} data-testid="craft-autopick">{tt("Pick cheapest")} {maxFish} <span className="text-[var(--muted)]">({maxBatches(recipe)} {tt("batches, max")})</span></button>
              {sel.size > 0 && <button className="btn btn-sm" onClick={() => setSel(new Set())} data-testid="craft-clear">{tt("Clear")}</button>}
              {sel.size % recipe.fish !== 0 && <span className="text-[11.5px] text-[#f59a5c]" data-testid="craft-remainder">{tt("Pick")} {recipe.fish - (sel.size % recipe.fish)} {tt("more to finish the batch")}</span>}
              <span className="text-[11.5px] text-[var(--muted)]">{tt("Selected fish are consumed. Vendor value lost:")} <Gold n={[...sel].reduce((a, id) => a + Math.round((inv.find((f) => f.id === id)?.value || 0) * 0.7), 0)} /></span>
            </div>
          </Panel>
        )}
      </div>
      <MobileGroup testId="craft-sheets" items={[["Ingredients", pixelIcon("worm")], ["My baits", pixelIcon("bait")]]}>
        <Panel icon="worm" title={tt("Dockside ingredients")} right={<Gold n={user.gold} />} testId="ingredients-shop">
          <p className="text-[11.5px] text-[var(--muted)] mb-2" data-testid="ingredient-cap-note">{tt("The vendor sells each angler a limited stock per day · resets in")} <span className="num text-[var(--text-2)]">{resetIn()}</span>{tt(". Need more? Buy from other anglers on the")} <Link to="/game/market?kind=ingredient" className="underline">{tt("Market")}</Link>.</p>
          <table className="table"><tbody>
            {data.ingredients.map((i) => { const rem = left(i); return <tr key={i.id} data-testid={`ingredient-${i.id}`}>
              <td><div className="flex items-center gap-2"><GearIcon id={i.id} name={i.name} /><div><div className="font-medium">{i.name}</div><div className="text-[11px] text-[var(--muted)] italic">{i.desc}</div><div className="text-[11px] num">{tt("owned ×")}{ing[i.id] || 0} · {fmt(i.price)}{tt("g each ·")} <span className={rem ? "text-[var(--ok)]" : "text-[#f0a5a3]"} data-testid={`ing-left-${i.id}`}>{rem}/{i.daily_cap} {tt("left today")}</span></div></div></div></td>
              <td className="r whitespace-nowrap">{rem ? <><input type="number" min={1} max={rem} className="input !w-14 num inline-block mr-1" value={Math.min(qty[i.id] ?? 5, rem)} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} data-testid={`ing-qty-${i.id}`} /><button className="btn btn-sm btn-gold" disabled={user.gold < i.price * Math.min(Number(qty[i.id] || 5), rem)} onClick={() => buy(i)} data-testid={`buy-ing-${i.id}`}>{tt("Buy")}</button></> : <Link to="/game/market?kind=ingredient" className="btn btn-sm" data-testid={`market-ing-${i.id}`}>{tt("Find on Market")}</Link>}</td>
            </tr>; })}
          </tbody></table>
        </Panel>
        <Panel icon="bait" title={tt("Your crafted baits")} testId="crafted-baits">
          {data.baits.filter((b) => b.crafted && user.bait[b.id] > 0).length === 0 ? <Empty>{tt("Nothing crafted yet.")}</Empty> : (
            <table className="table"><tbody>{data.baits.filter((b) => b.crafted && user.bait[b.id] > 0).map((b) => <tr key={b.id}><td><span className="inline-flex items-center gap-2"><GearIcon id={b.id} />{b.name}</span></td><td className="num r">×{user.bait[b.id]}</td><td className="r">{user.active_bait === b.id ? <span className="text-[11px] text-[var(--gold)]">{tt("active")}</span> : <button className="btn btn-sm" onClick={async () => setUser((await api.post("/shop/equip", { bait_id: b.id })).data)} data-testid={`use-${b.id}`}>{tt("Use")}</button>}</td></tr>)}</tbody></table>
          )}
          <p className="text-[11px] text-[var(--muted)] mt-2">{tt("Sell spare crafted bait or ingredients with the Sell buttons in your")} <Link to="/game/inventory" className="underline">{tt("Inventory")}</Link>.</p>
        </Panel>
      </MobileGroup>
    </div>
  );
}
