/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Star, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, fmt, wt, wtText, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Pearls, Bar, Empty, Rarity } from "../../components/ui-bits";
import { FishPlate } from "../../components/FishPlate";
import { untilText } from "./Quests";
import { t as tt } from "../../i18n";
import { InfoTabs } from "../../components/MobileSheets";

import { sfxAchievements } from "../../lib/sound";
import { pixelIcon } from "../../components/PixelIcon";

const TIER_TIP = "Tier follows the rarity of what the order asks for: T1 common, T2 uncommon, T3 rare, T4 epic/legendary. Higher tiers pay more gold, XP and favour (+8/12/20/30) and have a better Pearl chance (0/10/30/60%).";

const pos = (v, max) => `${Math.round(Math.sqrt(Math.min(1, v / max)) * 100)}%`;

const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

function Milestone({ m, reached, max, open, onOpen, onClose, onToggle }) {
  const p = Math.round(Math.sqrt(Math.min(1, m.at / max)) * 100);
  const align = p < 30 ? "left-0 -ml-1.5" : p > 70 ? "right-0 -mr-1.5" : "left-1/2 -translate-x-1/2";
  const arrow = p < 30 ? "left-2.5" : p > 70 ? "right-2.5" : "left-1/2 -translate-x-1/2";
  return (
    <span className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2" style={{ left: pos(m.at, max) }} onMouseEnter={() => canHover() && onOpen()} onMouseLeave={() => canHover() && onClose()}>
      <button type="button" className={`block w-3 h-3 rounded-full border ${reached ? "bg-[var(--gold)] border-[var(--gold)]" : "bg-[var(--bg-deep)] border-[var(--gold-dim)]"} hover:scale-125 transition-transform`}
        onClick={(e) => { e.stopPropagation(); canHover() ? onOpen() : onToggle(); }} aria-label={`${m.name} at ${m.at} favour`} aria-expanded={open} data-testid={`milestone-${m.rank}`} />
      {open && (
        <div className={`absolute bottom-full pb-2 ${align} w-[min(230px,calc(100vw-40px))] z-30`} data-testid={`milestone-pop-${m.rank}`}>
          <div className="relative border border-[var(--gold-dim)] bg-[var(--bg-deep)] p-2 text-[11px] shadow-lg">
            <div className="flex justify-between gap-2"><span className={`font-display text-[12px] ${reached ? "text-[var(--gold)]" : "text-[#f4ead2]"}`}>{m.name}</span><span className="num text-[var(--muted)] whitespace-nowrap">{m.at} {tt("favour")}</span></div>
            <div className="text-[var(--text-2)] mt-0.5">{tt("One-off:")} <span className="text-[var(--gold)] num">{m.gold.toLocaleString()} {tt("gold")}</span>{m.pearls > 0 && <> + <span className="text-[#cfe6ff] num">{m.pearls} {tt("Pearl")}{m.pearls > 1 ? "s" : ""}</span></>}</div>
            {m.perks.map((k) => <div key={k} className="text-[var(--ok)]">{tt("Unlocks:")} {k}</div>)}
            {m.title && <div className="text-[#f59a5c]">{tt("Title \"")}{m.title}{tt("\" + special orders")}</div>}
            {reached && <div className="text-[var(--muted)] italic">{tt("reached")}</div>}
            <span className={`absolute ${arrow} -bottom-[5px] w-2 h-2 rotate-45 bg-[var(--bg-deep)] border-r border-b border-[var(--gold-dim)]`} />
          </div>
        </div>
      )}
    </span>
  );
}

function PatronCard({ p }) {
  const [open, setOpen] = useState(null);
  const max = p.milestones[p.milestones.length - 1].at;
  const toggle = (r) => setOpen((o) => (o === r ? null : r));
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-2)] p-2.5 flex gap-3 min-w-0" onClick={() => setOpen(null)} data-testid={`patron-${p.id}`}>
      <img src={p.portrait} alt={p.name} className="w-[64px] h-[64px] object-cover border border-[var(--gold-dim)] shrink-0" style={{ objectPosition: "center 20%" }} />
      <div className="min-w-0 flex-1 text-[12px]">
        <div className="font-display text-[13px] text-[#f4ead2] leading-tight truncate">{p.name}</div>
        <div className="label !text-[9.5px]">{p.role} {tt("· wants")} {p.wants}</div>
        <div className="flex items-center gap-2 mt-2.5 mb-1">
          <span className={`text-[11.5px] whitespace-nowrap ${p.rank >= 5 ? "text-[var(--gold)]" : "text-[var(--text-2)]"}`} data-testid={`patron-rank-${p.id}`}>{p.rank_name}</span>
          <div className="relative flex-1 h-1.5 bg-[var(--bg-deep)] border border-[var(--border)] mx-1.5">
            <div className="absolute inset-y-0 left-0 bg-[var(--gold)]" style={{ width: pos(p.favour, max) }} />
            {p.milestones.map((m) => <Milestone key={m.rank} m={m} max={max} reached={p.rank >= m.rank} open={open === m.rank} onOpen={() => setOpen(m.rank)} onClose={() => setOpen(null)} onToggle={() => toggle(m.rank)} />)}
          </div>
          <span className="num text-[10.5px] text-[var(--muted)] whitespace-nowrap" data-testid={`patron-favour-${p.id}`}>{p.favour} / {max} {tt("favour")}</span>
        </div>
        <div className="text-[10.5px] text-[var(--muted)]">{p.next_at ? `Next rank: ${p.milestones.find((m) => m.rank === p.rank + 1)?.name} at ${p.next_at} favour (${p.next_at - p.favour} to go) · tap a dot to see what each rank gives` : tt("Old Friend, every perk unlocked, special orders may appear on your board")}</div>
        <ul className="mt-1 space-y-0.5">
          {p.perks.filter((k) => k.active).map((k) => <li key={k.key} className="text-[11px] text-[var(--ok)]">✓ {k.label}</li>)}
          {p.rank >= 5 && <li className="text-[11px] text-[var(--ok)]">{tt("✓ Title \"")}{p.title}{tt("\" · special orders")}</li>}
        </ul>
      </div>
    </div>
  );
}

function DoneCard({ c, busy, onDismiss }) {
  return (
    <div className="border border-[var(--ok)]/40 bg-[var(--bg-2)] p-2.5 flex gap-3 min-w-0 opacity-90" data-testid={`contract-${c.id}`} data-status="done">
      {c.species_id ? <FishPlate speciesId={c.species_id} name={c.species_name} className="w-[84px] h-[64px] shrink-0 hidden sm:block grayscale-[.3]" />
        : <img src={c.portrait} alt="" className="w-[84px] h-[64px] object-cover shrink-0 hidden sm:block border border-[var(--border)]" style={{ objectPosition: "center 20%" }} />}
      <div className="flex-1 min-w-0 text-[12px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label !text-[9.5px] flex items-center gap-1"><img src={c.portrait} alt="" className="w-4 h-4 object-cover inline-block border border-[var(--border)]" style={{ objectPosition: "center 20%" }} />{c.patron_name}</span>
          <span className="text-[10px] px-1 border border-[var(--ok)] text-[var(--ok)]" data-testid={`contract-done-tag-${c.id}`}>{tt("✓ Filled ·")} {new Date(c.done_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <button className="btn btn-sm ml-auto text-[var(--muted)]" disabled={busy} onClick={() => onDismiss(c)} data-testid={`contract-dismiss-${c.id}`}>{tt("Clear")}</button>
        </div>
        <div className="mt-0.5 font-medium text-[13px] text-[#f4ead2] line-through decoration-[var(--ok)]/60">{wtText(c.text)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px]">
          <span className="label">{tt("Paid:")}</span><Gold n={c.paid_gold ?? c.gold} className="text-[11.5px]" /><span className="text-[var(--xp)] num">+{fmt(c.xp)} {tt("XP")}</span>{c.pearls > 0 && <Pearls n={c.pearls} className="text-[11.5px]" />}<span className="text-[var(--gold)] num">+{c.favour} {tt("favour with")} {c.patron_short}</span>
        </div>
        <div className="text-[10.5px] text-[var(--muted)] mt-1">{c.delivered.length} {tt("fish handed in · stays here for a day, or clear it now.")}</div>
      </div>
    </div>
  );
}

function IncomingCard({ at }) {
  return (
    <div className="border border-dashed border-[var(--border)] bg-[var(--bg-2)]/50 p-2.5 flex items-center justify-center min-h-[96px] text-[12px] text-[var(--muted)] italic" data-testid="contract-incoming">
      {tt("A patron is writing up a new order, posted in")} {untilText(at)}.
    </div>
  );
}

function ContractCard({ c, slotsFull, capped, busy, onAccept, onDeliver, onAbandon, onReroll, rerollOk, nav }) {
  const accepted = c.status === "accepted";
  const [confirm, setConfirm] = useState(false);
  const isKg = c.kind === "weight";
  const remaining = Math.max(0, c.target - c.progress);
  const haveTxt = c.have ? (isKg ? `${wt(c.have.kg)}` : `${c.have.count}`) : null;
  return (
    <div className={`border ${c.special ? "border-[var(--gold)] shadow-[0_0_10px_rgba(240,194,122,.15)]" : "border-[var(--border)]"} bg-[var(--bg-2)] p-2.5 flex gap-3 min-w-0`} data-testid={`contract-${c.id}`} data-status={c.status}>
      {c.species_id ? <FishPlate speciesId={c.species_id} name={c.species_name} className="w-[84px] h-[64px] shrink-0 hidden sm:block" />
        : <img src={c.portrait} alt="" className="w-[84px] h-[64px] object-cover shrink-0 hidden sm:block border border-[var(--border)]" style={{ objectPosition: "center 20%" }} />}
      <div className="flex-1 min-w-0 text-[12px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label !text-[9.5px] flex items-center gap-1"><img src={c.portrait} alt="" className="w-4 h-4 object-cover inline-block border border-[var(--border)]" style={{ objectPosition: "center 20%" }} />{c.patron_name}</span>
          <span className={`text-[10px] px-1 border cursor-help ${c.special ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--muted)]"}`} title={c.special ? tt("Special order for Old Friends: grand-tier pay, a guaranteed Pearl and +45 favour") : TIER_TIP} data-testid={`contract-tier-${c.id}`}>{c.special ? <><Star size={9} className="inline -mt-0.5" /> {tt("Special order")}</> : `Tier ${c.tier} of 4`}</span>
          <span className="ml-auto text-[10.5px] text-[var(--muted)] num">{accepted ? `due in ${untilText(c.deadline)}` : `on the board ${untilText(c.expires_at)}`}</span>
        </div>
        <div className="mt-0.5 font-medium text-[13px] text-[#f4ead2]" data-testid={`contract-text-${c.id}`}>{wtText(c.text)}{c.species_id && <> <Rarity r={c.rarity} tag className="ml-1" /></>}</div>
        <div className="text-[11.5px] text-[var(--text-2)] italic">“{c.flavour}”</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px]">
          <span className="label">{tt("Pays:")}</span><Gold n={c.gold} className="text-[11.5px]" /><span className="text-[var(--xp)] num">+{fmt(c.xp)} {tt("XP")}</span>{c.pearls > 0 && <Pearls n={c.pearls} className="text-[11.5px]" />}<span className="text-[var(--gold)] num">+{c.favour} {tt("favour")}</span>
          <span className="text-[var(--muted)]">· {c.water_name}</span>
        </div>
        {accepted && <div className="flex items-center gap-2 mt-1.5"><Bar value={c.progress} max={c.target} color="var(--gold)" className="flex-1 !h-1.5" /><span className="num text-[10.5px] text-[var(--muted)]" data-testid={`contract-progress-${c.id}`}>{isKg ? `${wt(c.progress)} / ${wt(c.target)}` : `${c.progress} / ${c.target}`}</span></div>}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {accepted ? <>
            <button className={`btn btn-sm ${c.have?.ready ? "btn-gold" : ""}`} disabled={busy || !c.have || c.have.count === 0} onClick={() => onDeliver(c)} data-testid={`contract-deliver-${c.id}`}>
              {c.have?.ready ? tt("Hand in & complete") : c.have?.count > 0 ? `Hand in ${haveTxt} now` : tt("Nothing matching in your inventory")}
            </button>
            {c.have && c.have.count > 0 && !c.have.ready && <span className="text-[10.5px] text-[var(--muted)]">{tt("you have")} {haveTxt}{tt(", need")} {isKg ? wt(remaining) : remaining} {tt("more")}</span>}
            {c.species_id && <button className="btn btn-sm" onClick={() => nav(`/game/market?kind=fish&q=${encodeURIComponent(c.species_name)}`)} data-testid={`contract-market-${c.id}`}>{c.on_market > 0 ? `${c.on_market} on the market` : tt("Look on the market")}</button>}
            {!confirm ? <button className="btn btn-sm text-[var(--muted)] ml-auto" onClick={() => setConfirm(true)} data-testid={`contract-abandon-${c.id}`}>{tt("Abandon")}</button>
              : <span className="ml-auto flex items-center gap-1 text-[11px]"><span className="text-[#f0a5a3]">{tt("−5 favour with")} {c.patron_short}.</span><button className="btn btn-sm btn-danger" disabled={busy} onClick={() => onAbandon(c)} data-testid={`contract-abandon-confirm-${c.id}`}>{tt("Yes, abandon")}</button><button className="btn btn-sm" onClick={() => setConfirm(false)}>{tt("Keep")}</button></span>}
          </> : <>
            <button className="btn btn-sm btn-gold" disabled={busy || slotsFull || capped} title={capped ? tt("You've filled today's contracts, the board reopens tomorrow") : slotsFull ? tt("Your contract slots are full") : ""} onClick={() => onAccept(c)} data-testid={`contract-accept-${c.id}`}>{tt("Accept")}</button>
            {c.have && c.have.count > 0 && <span className="text-[10.5px] text-[var(--ok)]">{tt("you already have")} {haveTxt} {tt("in your inventory")}</span>}
            {rerollOk && <button className="btn btn-sm text-[var(--muted)] ml-auto" title={tt("Swap this offer for another")} onClick={() => onReroll(c)} data-testid={`contract-reroll-${c.id}`}><RefreshCw size={11} /> {tt("Swap")}</button>}
          </>}
        </div>
      </div>
    </div>
  );
}

export default function Contracts() {
  const { setUser } = useGame();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get("/contracts").then((r) => setD(r.data)).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 60000); window.addEventListener("inventory-changed", load); return () => { clearInterval(t); window.removeEventListener("inventory-changed", load); }; }, [load]);
  const changed = () => window.dispatchEvent(new CustomEvent("contracts-changed"));
  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast.error(wtText(errMsg(e))); } finally { setBusy(false); } };
  const accept = (c) => run(async () => { const r = await api.post(`/contracts/${c.id}/accept`); setD(r.data); changed(); toast.success(tt("Accepted: {{v0}}", { v0: wtText(c.text) })); });
  const reroll = (c) => run(async () => { const r = await api.post(`/contracts/${c.id}/reroll`); setD(r.data); toast.message(tt("Offer swapped")); });
  const dismiss = (c) => run(async () => { const r = await api.post(`/contracts/${c.id}/dismiss`); setD(r.data); });
  const abandon = (c) => run(async () => { const r = await api.post(`/contracts/${c.id}/abandon`); setD(r.data.state); changed(); toast.message(tt("Abandoned. {{v0}}", { v0: r.data.favour_lost ? `−${r.data.favour_lost} favour with ${r.data.patron}.` : "" })); });
  const deliver = (c) => run(async () => {
    const r = await api.post(`/contracts/${c.id}/deliver`, {});
    setD(r.data.state); setUser(r.data.user); changed(); window.dispatchEvent(new CustomEvent("inventory-changed"));
    if (r.data.done) {
      toast.success(tt("Contract filled for {{v0}}: +{{v1}} gold, +{{v2}} XP{{v3}}, +{{v4}} favour", { v0: r.data.patron, v1: fmt(r.data.gold), v2: fmt(r.data.xp), v3: r.data.pearls ? `, ${r.data.pearls} Pearl` : "", v4: r.data.favour }), { duration: 7000 });
      (r.data.rank_ups || []).forEach((u) => toast.success(tt("{{v0}} now calls you {{v1}}: +{{v2}} gold{{v3}}{{v4}}{{v5}}", { v0: u.patron, v1: u.rank, v2: fmt(u.gold), v3: u.pearls ? `, ${u.pearls} Pearls` : "", v4: u.title ? `, title "${u.title}"` : "", v5: u.frame ? ", Galley Copper frame" : "" }), { duration: 9000 }));
      if (r.data.level_up) toast.success(tt("▲ Level {{v0}} reached, energy refilled!", { v0: r.data.level_up }), { duration: 7000 });
      sfxAchievements(r.data.new_achievements); (r.data.new_achievements || []).forEach((a) => toast.success(tt("Achievement unlocked: {{v0}}", { v0: a.name })));
    } else toast.message(tt("Handed in {{v0}}, {{v1}} is {{v2}}", { v0: r.data.delivered, v1: wtText(c.text).toLowerCase(), v2: c.kind === "weight" ? `${wt(r.data.progress)} / ${wt(r.data.target)}` : `${r.data.progress}/${r.data.target}` }));
  });
  if (!d) return <Empty>{tt("Reading the board…")}</Empty>;
  const slotsFull = d.slots.used >= d.slots.max;
  const capped = d.done_today + d.slots.used >= d.daily_cap;  // filled + in hand; delivering what you hold is never blocked
  const active = d.accepted.filter((c) => c.status === "accepted");
  const filled = d.accepted.filter((c) => c.status === "done");
  return (
    <div className="space-y-3" data-testid="contracts-page">
      <Panel icon="contracts" title={tt("Harbour Contract Board")} right={<span className="flex items-center gap-1"><ClipboardList size={12} /> {tt("favour earns lasting perks")}</span>} testId="contracts-intro">
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Four dockside patrons post orders here.")} <b>{tt("Accept")}</b> {tt("one, bring the fish, from your inventory, fresh from the water, or bought on the Market, and")} <b>{tt("hand them in")}</b> {tt("for gold, XP, the odd Pearl and")} <b>{tt("favour")}</b>{tt(". Favour climbs through five ranks with each patron, tap the dots on a favour bar to see what each rank pays and unlocks. Up to")} <b>{d.daily_cap} {tt("contracts a day")}</b> {tt("can be filled, and an accepted order's place on the board is re-posted")} {d.refill_hours} {tt("hours later.")}{d.gold_mult > 1 && <> {tt("The Cook's favour is adding")} <b className="text-[var(--ok)]">+{Math.round((d.gold_mult - 1) * 100)}{tt("% gold")}</b> {tt("to every contract you fill.")}</>}</p>
      </Panel>

      <InfoTabs inline testId="contract-tabs" items={[
        { id: "patrons", label: "Patrons & favour", Icon: pixelIcon("angler"), node: <div className="grid md:grid-cols-2 gap-2" data-testid="patron-cards">{d.patrons.map((p) => <PatronCard key={p.id} p={p} />)}</div> },
        (filled.length > 0 || d.recent.length > 0) && { id: "filled", label: "Filled contracts", Icon: pixelIcon("quests"), badge: filled.length || null, node: (
        <Panel icon="quests" title={tt("Filled contracts")} right={<span>{tt("done today")} {d.done_today}/{d.daily_cap}</span>} testId="contracts-recent">
          {filled.length > 0 && <div className="space-y-2 mb-3" data-testid="contracts-filled">{filled.map((c) => <DoneCard key={c.id} c={c} busy={busy} onDismiss={dismiss} />)}</div>}
          <ul className="text-[12px] space-y-1">{d.recent.filter((c) => !filled.some((f) => f.id === c.id)).map((c) => <li key={c.id} className="flex items-center gap-2 flex-wrap"><span className="text-[var(--muted)] num text-[11px]">{new Date(c.done_at).toLocaleDateString()}</span><span className="text-[#f4ead2]">{wtText(c.text)}</span><span className="text-[var(--muted)]">{tt("for")} {c.patron_name}</span><span className="ml-auto flex items-center gap-2"><Gold n={c.gold} className="text-[11.5px]" />{c.pearls > 0 && <Pearls n={c.pearls} className="text-[11.5px]" />}<span className="text-[var(--gold)] num text-[11px]">+{c.favour} {tt("favour")}</span></span></li>)}</ul>
        </Panel>) },
      ]} />
      <Panel icon="contracts" title={`Your contracts · ${active.length}/${d.slots.max}`} right={<span data-testid="contracts-done-today">{tt("filled today")} {d.done_today}/{d.daily_cap}{capped ? ` · new orders in ${untilText(d.day_resets_at)}` : tt(" · hand in from your inventory before the deadline")}</span>} testId="contracts-accepted">
        {capped && <div className="text-[11.5px] text-[var(--muted)] mb-2" data-testid="contracts-capped">{tt("Today's")} {d.daily_cap} {tt("contracts are spoken for")}{d.slots.used > 0 ? tt(", you can still hand in the orders you hold") : ""}{tt(". New orders open in")} {untilText(d.day_resets_at)}.</div>}
        {active.length === 0 ? <Empty>{tt("No contracts in hand. Pick one from the board below.")}</Empty>
          : <div className="space-y-2">{active.map((c) => <ContractCard key={c.id} c={c} busy={busy} onDeliver={deliver} onAbandon={abandon} nav={nav} />)}</div>}
      </Panel>

      <Panel icon="contracts" title={tt("On the board")} right={<span>{d.reroll_available ? <>{d.rerolls_left} {d.rerolls_left === 1 ? tt("free swap left today") : tt("free swaps left today")}{d.rerolls_max > 1 && <span className="text-[#f08a45]"> · {tt("Angler Pass")}</span>}</> : tt("swaps used today · offers refresh as they expire")}</span>} testId="contracts-offers">
        {slotsFull && <div className="text-[11.5px] text-[var(--muted)] mb-2" data-testid="contracts-slots-full">{tt("Your")} {d.slots.max} {tt("slots are full, finish or abandon a contract to accept another.")}{d.slots.max < 3 && tt(" Old Tobias grants a third slot at Trusted rank.")}</div>}
        {capped && !slotsFull && <div className="text-[11.5px] text-[var(--muted)] mb-2" data-testid="contracts-offers-capped">{tt("Today's quota is filled, you can accept new orders again in")} {untilText(d.day_resets_at)}.</div>}
        <div className="grid xl:grid-cols-2 gap-2">{d.offers.map((c) => <ContractCard key={c.id} c={c} slotsFull={slotsFull} capped={capped} busy={busy} onAccept={accept} onReroll={reroll} rerollOk={d.reroll_available} nav={nav} />)}{(d.incoming || []).map((t) => <IncomingCard key={t} at={t} />)}</div>
      </Panel>

    </div>
  );
}
