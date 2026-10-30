import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Hammer, ShieldCheck } from "lucide-react";
import { api, errMsg, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Gold, Empty } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { t as tt } from "../i18n";
import { sfxAchievements } from "../lib/sound";

export const enhName = (name, lvl) => (lvl ? `${name} +${lvl}` : name);

function GearRow({ g, st, onDone }) {
  const { user } = useGame();
  const [busy, setBusy] = useState(false);
  const [seal, setSeal] = useState(false);
  const n = g.next;
  const canSeal = n && n.chance < 100 && st.seals > 0;
  const go = async () => {
    if (busy || !n) return;
    if (n.drops_on_fail && !seal && !window.confirm(tt("A failed attempt at +{{v0}} costs the scrap and gold AND drops the item to +{{v1}}. Try anyway?", { v0: g.level + 1, v1: g.level - 1 }))) return;
    setBusy(true);
    try {
      const r = await api.post("/enhance/upgrade", { gear_id: g.id, use_seal: seal && canSeal });
      (r.data.success ? toast.success : toast.error)(r.data.message);
      sfxAchievements(r.data.new_achievements); (r.data.new_achievements || []).forEach((a) => toast.success(tt("Achievement unlocked: {{v0}}", { v0: a.name })));
      onDone(r.data);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const poor = n && (st.scrap < n.scrap || user.gold < n.gold);
  return (
    <tr data-testid={`enhance-row-${g.id}`}>
      <td className="w-full lg:max-w-0">
        <div className="flex items-center gap-2 min-w-[200px]">
          <GearIcon id={g.id} name={g.name} size="sm" />
          <div className="min-w-0">
            <div className="font-medium truncate flex items-center gap-1.5">{g.name}{g.level > 0 && <span className="num text-[var(--gold)] text-[11px]" data-testid={`enhance-level-${g.id}`}>+{g.level}</span>}<span className="text-[var(--muted)] text-[10px]">T{g.tier}</span>{g.equipped && <span className="text-[10px] text-[var(--gold)]">{tt("equipped")}</span>}</div>
            <div className="text-[11.5px] text-[#8fd0f0] truncate">{g.perks || tt("no enhancement yet")}</div>
          </div>
        </div>
      </td>
      {n ? <>
        <td className="text-[11.5px] text-[var(--text-2)] whitespace-nowrap">{n.perks}</td>
        <td className="r whitespace-nowrap"><span className={`num ${st.scrap < n.scrap ? "text-[#f0a5a3]" : ""}`}>{n.scrap}</span> <span className="text-[var(--muted)] text-[11px]">{tt("scrap")}</span> · <Gold n={n.gold} className={user.gold < n.gold ? "!text-[#f0a5a3]" : ""} /></td>
        <td className={`num r whitespace-nowrap ${n.chance >= 80 ? "text-[var(--ok)]" : n.chance >= 50 ? "text-[#ffcfa8]" : "text-[#f0a5a3]"}`} data-testid={`enhance-chance-${g.id}`}>{seal && canSeal ? "100%" : `${n.chance}%`}{n.drops_on_fail && !(seal && canSeal) && <span className="text-[10px] text-[#f0a5a3] ml-1" title={tt("On failure the item drops one level")}>▼</span>}</td>
        <td className="r whitespace-nowrap">
          {n.chance < 100 && <label className={`inline-flex items-center gap-1 text-[11px] mr-2 ${canSeal ? "cursor-pointer text-[var(--text-2)]" : "text-[var(--muted)] opacity-60"}`} title={canSeal ? tt("Spend one Harbourmaster's Seal: this attempt cannot fail") : tt("Buy Harbourmaster's Seals in the Pearl Shop")}><input type="checkbox" disabled={!canSeal} checked={seal && canSeal} onChange={(e) => setSeal(e.target.checked)} data-testid={`enhance-seal-${g.id}`} /><ShieldCheck size={11} />{tt("Seal")}</label>}
          <button className="btn btn-sm btn-gold" disabled={busy || poor} title={poor ? tt("Not enough scrap or gold") : ""} onClick={go} data-testid={`enhance-go-${g.id}`}><Hammer size={11} className="inline -mt-px mr-1" />+{g.level + 1}</button>
        </td>
      </> : <td colSpan={4} className="r text-[11px] text-[var(--gold)]">{tt("Maxed at +{{v0}}", { v0: st.max_level })}</td>}
    </tr>
  );
}

export function EnhanceBench() {
  const { setUser } = useGame();
  const [st, setSt] = useState(null);
  const [slot, setSlot] = useState("rod");
  useEffect(() => { api.get("/enhance").then((r) => setSt(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  if (!st) return <Empty>{tt("Loading…")}</Empty>;
  const rows = st.gear.filter((g) => g.slot === slot).sort((a, b) => b.tier - a.tier);
  const onDone = (d) => { setSt(d); if (d.user) setUser(d.user); };
  return (
    <div className="space-y-3" data-testid="enhance-bench">
      <Panel icon="gear" title={tt("Enhancement bench")} right={<span className="font-sans normal-case tracking-normal text-[12px] inline-flex items-center gap-3"><span className="inline-flex items-center gap-1"><GearIcon id="scrap" size="sm" className="!w-8 !h-6" /><span className="num text-[#f4ead2]" data-testid="enhance-scrap">{fmt(st.scrap)}</span> <span className="text-[var(--muted)]">{tt("scrap")}</span></span><span className="inline-flex items-center gap-1"><GearIcon id="seal" size="sm" className="!w-8 !h-6" /><span className="num text-[#f4ead2]" data-testid="enhance-seals">{st.seals}</span> <span className="text-[var(--muted)]">{tt("Seals")}</span></span></span>}>
        <p className="text-[12.5px] text-[var(--text-2)]">{tt("Every level adds +{{v0}}% to the item's fight stat. Rods also gain +1 luck at every even level, reels +1% vendor price per level, lines +1% XP per level. Costs 8·n² Tackle Scrap plus gold (10% of the item's price × n). +1 always succeeds; from +2 the odds fall each step, and from +{{v1}} a failure also knocks the item down one level. A Harbourmaster's Seal (Pearl Shop) makes one attempt certain.", { v0: Math.round(st.stat_per_level * 100), v1: st.drop_from })} {tt("Tackle Scrap comes from recycling trash in your Inventory, or buy it from other anglers on the")} <Link to="/game/market" className="underline">{tt("Market")}</Link>.</p>
      </Panel>
      <div className="flex gap-1 border-b border-[var(--border)]" data-testid="enhance-slots">
        {["rod", "reel", "line"].map((s) => <button key={s} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px ${slot === s ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setSlot(s)} data-testid={`enhance-slot-${s}`}>{tt(s === "rod" ? "Rods" : s === "reel" ? "Reels" : "Lines")}</button>)}
      </div>
      <Panel bodyClass="!p-0" testId={`enhance-${slot}`}>
        <div className="overflow-x-auto max-w-full">
          <table className="table min-w-[720px]">
            <thead><tr><th>{tt("Item")}</th><th>{tt("Next level gives")}</th><th className="r">{tt("Cost")}</th><th className="r">{tt("Chance")}</th><th className="r"></th></tr></thead>
            <tbody>{rows.map((g) => <GearRow key={g.id} g={g} st={st} onDone={onDone} />)}</tbody>
          </table>
        </div>
      </Panel>
      <Panel icon="compass" title={tt("Odds by level")} bodyClass="!p-0" testId="enhance-odds">
        <table className="table text-[11.5px]"><thead><tr><th>{tt("Level")}</th>{Object.keys(st.success_table).map((n) => <th key={n} className="r num">+{n}</th>)}</tr></thead>
          <tbody><tr><td>{tt("Success")}</td>{Object.entries(st.success_table).map(([n, c]) => <td key={n} className={`num r ${Number(n) >= st.drop_from ? "text-[#f0a5a3]" : ""}`}>{c}%</td>)}</tr>
            <tr><td>{tt("Scrap")}</td>{Object.keys(st.success_table).map((n) => <td key={n} className="num r">{8 * n * n}</td>)}</tr></tbody></table>
        <p className="text-[11px] text-[var(--muted)] px-3 py-2">{tt("Red levels drop one step on failure.")}</p>
      </Panel>
    </div>
  );
}
