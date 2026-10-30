/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { CrateDropNote } from "../../components/Crates";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, wt, ln, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Rarity, Empty } from "../../components/ui-bits";
import TensionGame from "../../components/TensionGame";
import { FishPlate } from "../../components/FishPlate";
import { FishWorth } from "./Halloween";
import { ConditionLine } from "../../components/Conditions";
import { ExpeditionPanel, useExpedition } from "../../components/Expedition";
import { GearIcon } from "../../components/GearIcon";
import { Durability, RepairButton } from "../../components/Durability";
import { useWaterProgress } from "../../components/WaterProgress";
import { BossPanel, BossResult } from "../../components/Boss";
import { useFriends, FriendsHere } from "../../components/FriendsPanel";
import { LuckOdds } from "../../components/LuckOdds";
import { SizePips, BaitInfoDialog } from "../../components/BaitInfo";
import { LanternNudge } from "../../components/LanternNudge";
import { MobileSheets, DeskTabs, useIsMobile } from "../../components/MobileSheets";

import { t as tt } from "../../i18n";
import { PixelSplash } from "../../components/PixelSplash";
import { CatchShare } from "../../components/CatchShare";
import { sfx, sfxAchievements, RARE_UP } from "../../lib/sound";
import { pixelIcon } from "../../components/PixelIcon";

function CatchResult({ res, onDone, onSold }) {
  const c = res.catch;
  const { user } = useGame();
  const [busy, setBusy] = useState(false);
  const act = async (path, ok) => {
    setBusy(true);
    try { const r = await api.post(path, { catch_ids: [c.id] }); ok(r.data); onDone(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className={`fade-in border p-3 space-y-2`} style={{ borderColor: `var(--r-${c.rarity})`, background: "var(--bg-2)" }} data-testid="catch-result">
      <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative w-full h-[150px] sm:w-[180px] sm:h-[120px] shrink-0"><FishPlate speciesId={c.species_id} name={c.name} className="w-full h-full" /><PixelSplash key={c.id} rarity={c.rarity} /></div>
      <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="label">{tt("You landed")}</div>
          <div className={`font-display text-xl rar-${c.rarity}`} data-testid="catch-name">{c.variant !== "normal" && <span className="tag tag-variant mr-2 align-middle">{c.variant}</span>}{c.name}</div>
          <p className="text-[12.5px] text-[var(--text-2)] italic mt-0.5">{res.blurb}</p>
        </div>
        <Rarity r={c.rarity} tag />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12.5px]">
        <div><div className="label">{tt("Weight")}</div><div className="num text-[var(--text)]" data-testid="catch-weight">{wt(c.weight)}</div></div>
        <div><div className="label">{tt("Length")}</div><div className="num">{ln(c.length_cm)}</div></div>
        <div><div className="label">{tt("Value")}</div><FishWorth f={c} /></div>
        <div><div className="label">{tt("XP")}</div><div className="num text-[var(--xp)]">+{res.xp}{res.xp_boost && <span className="ml-1 text-[10px] text-[var(--gold)] align-middle" title={tt("Server-wide XP booster")} data-testid="xp-boost-tag">{res.xp_boost}×</span>}</div></div>
      </div>
      <CrateDropNote drop={res.crate_drop} />
      {res.hex_bonus && <div className="text-[12.5px] text-[#d9a6ff]" data-testid="hex-bonus">Hex Hook! A twin {res.hex_bonus.name} ({wt(res.hex_bonus.weight)}) came up with it and went into your keepnet.</div>}
      {(res.first_discovery || res.level_up || res.mastery_up) && (
        <div className="text-[12.5px] text-[#ffcfa8]">
          {res.first_discovery && <span data-testid="first-discovery">{tt("✦ New species added to your journal!")} </span>}
          {res.level_up && <span data-testid="level-up">{tt("▲ Level")} {res.level_up} {tt("reached!")}</span>}
          {res.mastery_up && <span className="block text-[#8fd0f0]" data-testid="mastery-up">◆ {res.mastery_up.species} {tt("mastery")} {res.mastery_up.level}/10{res.mastery_up.level === 10 ? tt(". Mastered! Title and a Pearl earned.") : ` · ${res.mastery_up.perks.join(" · ")}`}</span>}
        </div>
      )}
      </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn btn-sm" onClick={onDone} disabled={busy} data-testid="catch-keep-button">{tt("Keep in inventory")}</button>
        <button className="btn btn-sm" onClick={() => act("/inventory/sell", (d) => { toast.success(d.candles ? `The Marsh Witch pays ${d.candles} Soul Candles` : tt("Sold for {{v0}} gold", { v0: fmt(d.gold) })); onSold(d.user); })} disabled={busy} data-testid="catch-sell-button" title={c.vendor_bonus_pct ? `70% of value, +${c.vendor_bonus_pct}% from your reel and mastery${res.xp_boost ? " and the server-wide 1.5× booster" : ""}` : tt("70% of value")}>{c.species_id >= 900 && c.species_id < 1000 ? `Sell to the Marsh Witch (+${res.candles ?? ""} candles)` : <>{tt("Sell to vendor (")}{fmt(c.vendor ?? Math.round(c.value * 0.7))}g{c.vendor_bonus_pct ? ` · +${c.vendor_bonus_pct}%` : ""})</>}</button>
        {res.baitable && <button className="btn btn-sm" onClick={() => act("/inventory/use-bait", (d) => { toast.success(tt("+{{v0}} live bait", { v0: d.bait })); onSold(d.user); })} disabled={busy} data-testid="catch-bait-button">{tt("Use as live bait (+1)")}</button>}
        <div className="ml-auto self-center"><CatchShare c={c} username={user?.username} lbs={wt(c.weight)} /></div>
      </div>
    </div>
  );
}

export default function Fishing() {
  const { user, setUser, lookups, data } = useGame();
  const [phase, setPhase] = useState("idle"); // idle | casting | fight | result | lost | nothing
  const mobile = useIsMobile();
  const [enc, setEnc] = useState(null);
  const [result, setResult] = useState(null);
  const [note, setNote] = useState("");
  const [trash, setTrash] = useState(null);
  const [log, setLog] = useState([]);
  const [active, setActive] = useState(null);
  const ev = useExpedition();
  const friends = useFriends();
  const water = lookups?.waterByKey[user.water];
  const pool = data?.fish.filter((f) => f.water === user.water && !f.secret) || [];
  const wp = useWaterProgress([user.water, user.stats?.catches])?.[user.water];
  useEffect(() => {
    const load = () => api.get(`/waters/${user.water}/active`).then((r) => setActive(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [user.water, log.length]);

  const cast = async () => {
    setPhase("casting"); setResult(null); setNote(""); setTrash(null); sfx("cast");
    try {
      const r = await api.post("/fish/cast");
      setUser(r.data.user);
      if (r.data.event_win) { toast.success(r.data.event_win.message, { duration: 10000 }); sfx("rare"); setTimeout(() => sfx("level"), 900); }
      if (r.data.result === "nothing") { setNote(r.data.message); setTrash(r.data.trash || null); setPhase("nothing"); return; }
      setEnc(r.data.encounter); setPhase("fight"); setTimeout(() => sfx("bite"), 700);
    } catch (e) {
      toast.error(errMsg(e)); setPhase("idle");
      api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {});
    }
  };

  const finish = useCallback(async (ok, elapsed, why, holds, gameTime) => {
    try {
      const r = await api.post("/fish/land", { encounter_id: enc.id, success: ok, elapsed, game_time: gameTime ?? elapsed, holds: holds || [] });
      if (r.data.crate_drop) { toast.success(`You found a ${r.data.crate_drop.name}!`, { duration: 10000 }); setTimeout(() => sfx("level"), 900); }
      if (r.data.success && r.data.boss) {
        setResult(r.data); setUser(r.data.user); setPhase("result"); sfx("catch"); sfx("rare");
        toast.success(tt("BOSS SLAIN: {{v0}}! +{{v1}} gold, title \"{{v2}}\"", { v0: r.data.boss.name, v1: fmt(r.data.boss.gold), v2: r.data.boss.title }), { duration: 8000 });
        window.dispatchEvent(new CustomEvent("friends-changed"));
      } else if (r.data.success) {
        setResult(r.data); setUser(r.data.user); setPhase("result");
        setLog((l) => [r.data.catch, ...l].slice(0, 12));
        sfx("catch"); if (RARE_UP.includes(r.data.catch?.rarity)) sfx("rare");
        sfxAchievements(r.data.new_achievements);
        window.dispatchEvent(new CustomEvent("tutorial", { detail: "landed" }));
        (r.data.new_achievements || []).forEach((a) => toast.success(tt("Achievement unlocked: {{v0}} (+{{v1}}g{{v2}})", { v0: a.name, v1: a.reward, v2: a.title ? `, title "${a.title}"` : "" })));
      } else { setNote(why || r.data.message); setPhase("lost"); sfx("snap"); }
    } catch (e) { toast.error(errMsg(e)); setPhase("idle"); }
  }, [enc, setUser]);

  useEffect(() => {
    const typing = (e) => ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName) || e.target?.isContentEditable;
    const castable = () => ["idle", "nothing", "lost", "result"].includes(phase) && user.energy >= user.cast_cost;
    const onKey = (e) => {
      if (typing(e)) return;
      if (e.code === "Space") {
        if (["BUTTON", "A"].includes(e.target?.tagName)) return;  // let focused controls keep their native Space behaviour
        e.preventDefault();  // never page-scroll on the fishing screen, Space is the reel key
        if (!e.repeat && castable()) cast();
      } else if (e.code === "Enter" && !e.repeat && castable()) cast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, user.energy, user.cast_cost]); // eslint-disable-line

  const [baitInfo, setBaitInfo] = useState(null);
  const setBait = async (bait_id) => {
    try { const r = await api.post("/shop/equip", { bait_id }); setUser(r.data); } catch (e) { toast.error(errMsg(e)); }
  };
  const gear = user.gear;
  const canCast = user.energy >= user.cast_cost && phase !== "fight" && phase !== "casting";
  const baitOptions = Object.entries(user.bait).filter(([, n]) => n > 0);

  const baitPanel = (
        <Panel icon="worm" title={tt("Bait")} testId="bait-panel">
          <select className="input" value={user.active_bait || ""} onChange={(e) => setBait(e.target.value)} data-testid="bait-select">
            <option value="">{tt("No bait (poor odds)")}</option>
            {baitOptions.map(([id, n]) => <option key={id} value={id}>{lookups?.baitById[id]?.name} × {n}</option>)}
          </select>
          {user.active_bait && user.bait?.[user.active_bait] > 0 && lookups?.baitById[user.active_bait] && (
            <div className="text-[12px] text-[var(--text-2)] mt-2 flex gap-2 items-start">
              <GearIcon id={user.active_bait} size="md" />
              <div>{lookups.baitById[user.active_bait].desc}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px]" data-testid="bait-stats">
                <span className="num">{tt("luck")} <span className="text-[var(--ok)]">+{lookups.baitById[user.active_bait].luck}</span></span>
                <span className="num">{tt("bite")} <span className="text-[var(--ok)]">+{lookups.baitById[user.active_bait].bite}%</span></span>
                <span className="inline-flex items-center gap-1">{tt("size")} <SizePips n={lookups.baitById[user.active_bait].size || 0} /></span>
                <button type="button" className="underline text-[var(--muted)] hover:text-[var(--gold)]" onClick={() => setBaitInfo(lookups.baitById[user.active_bait])} data-testid="bait-info-open">{tt("details")}</button>
              </div>
              {lookups.baitById[user.active_bait].ground && <div className="text-[#8fd0f0] mt-1" data-testid="groundbait-note">{tt("Groundbait mode: your luck is ignored, common & uncommon fish are twice as likely. Rare and up still bite at base odds.")}</div>}
              {lookups.baitById[user.active_bait].waters && !lookups.baitById[user.active_bait].waters.includes(user.water) && <div className="text-[#f59a5c] mt-1">{tt("Not ideal for this water, reduced effect.")}</div>}</div>
            </div>
          )}
          {(() => { const bo = pool.filter((f) => f.bait_only); if (!bo.length) return null; const withThis = bo.filter((f) => f.bait_only.includes(user.active_bait)); const without = bo.filter((f) => !f.bait_only.includes(user.active_bait)); return (
            <div className="text-[11.5px] mt-2 space-y-0.5" data-testid="bait-only-hint">
              {withThis.length > 0 && <div className="text-[var(--ok)]">{tt("This bait unlocks:")} {withThis.map((f) => f.name).join(", ")}</div>}
              {without.length > 0 && <div className="text-[var(--muted)]">{tt("Needs other bait:")} {without.map((f) => `${f.name} (${f.bait_only.map((b) => lookups?.baitById[b]?.name).join(" / ")})`).join("; ")}</div>}
            </div>); })()}
          {user.crew?.perks?.luck > 0 && (
            <div className="text-[11.5px] mt-2 space-y-0.5" data-testid="luck-bonuses">
              <div className="text-[var(--ok)]">+{[1, 2, 3][user.crew.perks.luck - 1]} {tt("luck · crew Lucky Charms")}</div>
            </div>
          )}
          {baitInfo && <BaitInfoDialog bait={baitInfo} onClose={() => setBaitInfo(null)} />}
          {baitOptions.length === 0 && <div className="text-[12px] text-[#f59a5c] mt-2">{tt("You have no bait.")} <Link className="underline" to="/game/shop?tab=bait">{tt("Buy some")}</Link>{tt(", fishing without bait is slow.")}</div>}
        </Panel>
  );
  const tacklePanel = (
        <Panel icon="shop" title={tt("Tackle")} right={<RepairButton label={tt("Repair")} testId="fishing-repair-button" />} testId="gear-panel">
          <table className="table"><tbody>
            {[["Rod", gear.rod], ["Reel", gear.reel], ["Line", gear.line]].map(([slot, id]) => <tr key={slot}><td className="label !text-[10.5px]">{slot}</td><td><span className="inline-flex items-center gap-2"><GearIcon id={id} /><span>{user.enhance?.[id] ? `${lookups?.gearById[id]?.name} +${user.enhance[id]}` : lookups?.gearById[id]?.name}<div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Durability id={id} /><RepairButton gearId={id} compact testId={`fishing-repair-${id}`} /></div></span></span></td><td className="num r text-[var(--muted)]">T{lookups?.gearById[id]?.tier}</td></tr>)}
          </tbody></table>
          {user.rare_set && <div className="text-[12px] text-[var(--gold)] mt-2" data-testid="rare-set-bonus">{tt("Matched set: rod, reel and line are all the same tier, +5% fight power and your gear wears half as fast.")}</div>}
          {Object.values(gear).some((id) => (user.durability?.[id] ?? 100) <= 0) && <div className="text-[12px] text-[#f0a5a3] mt-2" data-testid="worn-out-warning">{tt("Some of your tackle is worn out: it fights at 70% and its tier perks (rod luck, reel sell bonus, line XP) are cut to 70% too. Repair it in one click above.")}</div>}
          <div className="text-[11.5px] text-[var(--muted)] mt-2">{tt("Rod power tires fish faster and widens the sweet spot. Reel speed lets you shed tension. Line strength forgives the redline.")}</div>
        </Panel>
  );
  const speciesPanel = (
        <Panel icon="fish" title={tt("Local species")} right={<Link to="/game/journal" className="underline">{tt("journal")}</Link>}>
          <div className="text-[12px] grid grid-cols-3 gap-1 text-center">
            {["common", "uncommon", "rare", "epic", "legendary", "mythic"].map((r) => <div key={r}><div className={`num rar-${r} text-[14px]`}>{pool.filter((f) => f.rarity === r).length}</div><div className="label !text-[9px]">{r}</div></div>)}
          </div>
          {active && (
            <div className="mt-3" data-testid="active-species">
              <div className="label mb-1">{tt("Feeding now ·")} <span className="capitalize">{active.conditions.period}</span></div>
              <div className="flex flex-wrap gap-1">
                {active.active.map((f) => <span key={f.id} className={`tag rar-${f.rarity} ${f.name ? "" : "opacity-60"}`}>{f.name || "???"}</span>)}
              </div>
            </div>
          )}
        </Panel>
  );
  const sessionPanel = (
        <Panel icon="quests" title={tt("This session")} testId="session-log">
          {log.length === 0 ? <Empty>{tt("No fish landed yet this session.")}</Empty> : (
            <table className="table"><tbody>
              {log.map((c) => <tr key={c.id}><td><span className={`rar-${c.rarity} font-medium`}>{c.name}</span>{c.variant !== "normal" && <span className="tag tag-variant ml-2">{c.variant}</span>}</td><td className="num r">{wt(c.weight)}</td><td className="r"><FishWorth f={c} /></td></tr>)}
            </tbody></table>
          )}
        </Panel>
  );

  const sideItems = [
    { id: "bait", label: "Bait", Icon: pixelIcon("worm"), node: baitPanel },
    { id: "tackle", label: "Tackle", Icon: pixelIcon("shop"), node: tacklePanel },
    { id: "species", label: "Species", Icon: pixelIcon("fish"), node: speciesPanel },
    { id: "session", label: "Session", Icon: pixelIcon("quests"), badge: log.length || null, node: sessionPanel },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-3 fade-in" data-testid="fishing-page">
      <div className="space-y-3">
        <div className="water-hero !h-auto aspect-[3/2] sm:aspect-[21/9] max-h-[380px] lg:aspect-auto lg:!h-[230px] w-full" style={{ backgroundImage: `url(${water?.image})` }} data-testid="fishing-water-hero">
          <div className="!absolute top-2 right-2 z-[2]"><LanternNudge compact /></div>
          <div className="!absolute bottom-0 left-0 right-0 p-3 flex flex-col sm:flex-row sm:items-end justify-between gap-1.5">
            <div className="min-w-0">
              <div className="label label-gold">{water?.type}</div>
              <div className="font-display text-xl sm:text-2xl text-[#f4ead2]">{water?.name}</div>
              <div className="text-[12px] text-[var(--text-2)]">{wp ? <span data-testid="hero-species-progress"><span className="num">{wp.species}/{pool.length}</span> {tt("species in your journal")}{wp.variants > 0 && <> · <span className="num">{wp.variants}</span> {tt("as variants")}</>}{wp.complete && <span className="ml-1.5 text-[10px] uppercase tracking-widest text-[var(--gold)] border border-[var(--gold-dim)] px-1.5 py-px" data-testid="hero-water-complete">{tt("Complete")}</span>}</span> : <>{pool.length} {tt("species recorded here")}</>} · <Link to="/game/waters" className="underline hover:text-[var(--gold)]">{tt("change water")}</Link></div>
            </div>
            {active && <div className="sm:text-right shrink-0 hero-chip"><ConditionLine c={active.conditions} luck={<LuckOdds deps={[user.water, user.active_bait, user.gear?.rod, user.crew?.perks?.luck, log.length, friends?.here?.length]} />} /><div className="text-[11px] text-[var(--muted)] sm:mt-0.5">{tt("changes in")} {active.conditions.next_change_min} {tt("min")}</div></div>}
          </div>
        </div>
        <BossPanel boss={ev?.boss} waterKey={user.water} />
        <ExpeditionPanel ev={ev} waterKey={user.water} />

        <Panel icon="bobber" title={tt("The line")} right={<span className="num">{tt("Energy")} {user.energy}/{user.max_energy} {tt("· cast costs")} {user.cast_cost}</span>} bodyClass="fishing-stage" testId="fishing-panel">
          {phase === "fight" && enc && (
            <div className="fight-wrap space-y-3" data-testid="fight-wrap">
              {mobile && <div className="fight-art" style={{ backgroundImage: `url(${water?.image})` }} data-testid="fight-water-art"><span className="fight-art-name font-display">{water?.name}</span></div>}
              <div className={`text-[13px] ${enc.boss ? "font-display text-[var(--r-legendary)]" : "text-[#ffcfa8]"}`} data-testid="encounter-hint">{enc.hint}</div>
              <TensionGame enc={enc} onFinish={finish} />
            </div>
          )}
          {phase === "result" && result?.boss && <BossResult res={result} onDone={() => setPhase("idle")} />}
          {phase === "result" && result && !result.boss && <CatchResult res={result} onDone={() => setPhase("idle")} onSold={(u) => { setUser(u); setPhase("idle"); }} />}
          {phase !== "fight" && phase !== "result" && (
            <div className="space-y-3">
              {(phase === "nothing" || phase === "lost") && <div className={`text-[13px] ${phase === "lost" ? "text-[#f0a5a3]" : "text-[var(--text-2)]"} italic`} data-testid="cast-note">{note}</div>}
              {phase === "nothing" && trash && <div className="flex items-center gap-3 panel p-2.5 max-w-md" data-testid="cast-trash"><GearIcon id={trash.id} name={trash.name} size="md" /><div className="text-[12.5px]"><div className="font-display text-[14px] text-[#f4ead2]">{trash.name}</div><div className="text-[var(--text-2)]">{tt("Salvage · worth {{v0}} Tackle Scrap when recycled in your Inventory.", { v0: trash.scrap })}</div></div></div>}
              {phase === "idle" && !note && <div className="text-[13px] text-[var(--text-2)] italic">{active?.conditions?.text || water?.desc}</div>}
              <div className="flex items-center gap-3">
                <button className={`btn btn-gold btn-lg cast-btn ${phase === "casting" ? "casting" : ""}`} onClick={cast} disabled={!canCast} data-testid="cast-line-button"><img src="/art/fight/rod.png" alt="" className="cast-rod" draggable="false" />{phase === "casting" ? tt("Casting...") : tt("Cast line")}</button>
                <span className="text-[11.5px] text-[var(--muted)]">{user.energy < user.cast_cost ? `Out of energy: +1 every ${user.energy_regen_sec || 60}s.` : <span className="hidden lg:inline">{tt("Enter or Space to cast")}</span>}</span>
              </div>
            </div>
          )}
        </Panel>

        {mobile && <MobileSheets testId="fish-sheets" items={sideItems} />}
      </div>

      <div className="space-y-3">
        <FriendsHere friends={friends} />
        {!mobile && <DeskTabs testId="fish-tabs" items={sideItems} initial="bait" pinned />}
      </div>
    </div>
  );
}
