/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Timer, Flag, Trophy, Lock } from "lucide-react";
import { DuelLadder, DuelBoard } from "../../components/DuelLadder";
import { api, errMsg, wt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty, Rarity } from "../../components/ui-bits";
import { Avatar } from "../../components/Avatar";
import { RodSkinArt, ROD_SKINS } from "../../components/RodSkin";
import TensionGame from "../../components/TensionGame";
import { FishPlate } from "../../components/FishPlate";
import { setDuelWatch } from "../../components/DuelWatcher";
import { t as tt } from "../../i18n";
import { InfoTabs, useIsMobile } from "../../components/MobileSheets";

import { pixelIcon, PixelIcon } from "../../components/PixelIcon";

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function PlayerCard({ p, me, score, live, testId }) {
  return (
    <div className={`duel-card ${me ? "duel-card-me" : ""}`} data-testid={testId}>
      <Avatar id={p.avatar} name={p.username} size="md" frame={p.frame} />
      <div className="min-w-0 flex-1">
        <div className="font-display text-[14px] truncate" style={p.name_colour_hex ? { color: p.name_colour_hex } : undefined}>{p.username}{me && <span className="text-[10px] text-[var(--muted)] ml-1.5 tracking-widest uppercase">{tt("you")}</span>}</div>
        <div className="text-[11px] text-[var(--muted)] num">{tt("Lv")} {p.level} · {p.landed} {tt("landed ·")} {p.lost} {tt("lost")}</div>
        {p.gear?.length > 0 && <div className="duel-gear" data-testid={`${testId}-gear`}>{p.gear.map((g) => <span key={g.slot} className={`duel-gear-chip ${g.skin ? "duel-gear-skin" : ""}`} title={`${g.name} (T${g.tier}${g.enh ? ` +${g.enh}` : ""})${g.skin ? ` · ${ROD_SKINS[g.skin]} skin` : ""}`} data-testid={`${testId}-gear-${g.slot}`}><span className="duel-gear-art">{g.skin ? <RodSkinArt skin={g.skin} /> : <img src={`/art/gear/${g.id}.webp`} alt="" loading="lazy" />}</span><span className="min-w-0 truncate"><span className="num">T{g.tier}{g.enh ? ` +${g.enh}` : ""}</span> <span className="truncate">{g.skin ? <span className="text-[#c9a8ff]">{ROD_SKINS[g.skin]}</span> : g.name}</span></span></span>)}</div>}
        {live && <div className={`text-[12px] mt-1 truncate ${p.status === "fighting" ? "text-[#ffcfa8]" : p.status === "landed" ? "text-[var(--ok)]" : p.status === "lost" ? "text-[#f0a5a3]" : "text-[var(--text-2)]"}`} data-testid={`${testId}-status`}>{p.status === "fighting" && <span className="duel-pulse" />}{p.status_text}</div>}
      </div>
      <div className="duel-score num" data-testid={`${testId}-score`}>{score}</div>
    </div>
  );
}

function DuelScene({ children }) {
  return (
    <div className="duel-scene" data-testid="duel-hero">
      <img src="/art/duel_scene.webp" alt="" className="duel-scene-art" draggable="false" />
      <div className="duel-scene-copy">
        <div className="font-display text-2xl sm:text-3xl text-[#f4ead2]">{tt("The Duelling Pier")}</div>
        <div className="text-[12.5px] text-[var(--text-2)]">{tt("Two anglers, one water, most points wins. Climb the weekly ladder for prizes.")}</div>
      </div>
      {children && <div className="duel-scene-cta">{children}</div>}
    </div>
  );
}

function DuelHero({ sub, right }) {
  return (
    <div className="water-hero" style={{ backgroundImage: "url(/art/duel_scene.webp)", backgroundPosition: "center 40%" }} data-testid="duel-arena-hero">
      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col sm:flex-row sm:items-end justify-between gap-1.5">
        <div className="min-w-0">
          <div className="label label-gold">{tt("Head-to-head · 2 minutes")}</div>
          <div className="font-display text-xl sm:text-2xl text-[#f4ead2]">{tt("The Duelling Pier")}</div>
          <div className="text-[12px] text-[var(--text-2)]">{sub}</div>
        </div>
        {right && <div className="sm:text-right shrink-0">{right}</div>}
      </div>
    </div>
  );
}

const Fight = memo(function Fight({ enc, onFinish }) {
  return <TensionGame enc={enc} onFinish={onFinish} />;
});

function Arena({ m, onState }) {
  const { user } = useGame();
  const me = m.players[m.me], opp = m.players[m.opponent];
  const [enc, setEnc] = useState(m.encounter);
  const [left, setLeft] = useState(m.seconds_left);
  const [flash, setFlash] = useState(null);
  const encRef = useRef(enc);
  useEffect(() => { encRef.current = enc; }, [enc]);
  useEffect(() => { setLeft(m.seconds_left); }, [m.seconds_left]);
  const leftRef = useRef(left);
  leftRef.current = left;
  useEffect(() => { const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  // Server-side pending fish is only adopted on mount (re-entering the pier mid-fight); polls never restart a fight.
  // Mirrors the normal fishing screen: idle → casting → fight → landing → result/lost/nothing. Space only casts from a settled phase.
  const [phase, setPhase] = useState(m.encounter ? "fight" : "idle");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const settled = (p) => ["idle", "nothing", "lost", "result"].includes(p);
  const cast = async () => {
    if (!settled(phaseRef.current) || leftRef.current <= 0) return;
    setPhase("casting"); setFlash(null);
    try {
      const r = await api.post("/duel/cast");
      if (r.data.result === "hooked") { setEnc(r.data.encounter); setPhase("fight"); }
      else { setFlash({ kind: "miss", text: r.data.message }); setPhase("nothing"); }
      onState(r.data.match);
    } catch (e) { toast.error(errMsg(e)); setPhase("idle"); }
  };
  const finish = useCallback(async (ok, elapsed, why, holds, gameTime) => {
    const fish = encRef.current;
    setPhase("landing");
    try {
      const r = await api.post("/duel/land", { success: ok, elapsed, game_time: gameTime ?? elapsed, holds: holds || [] });
      setFlash(r.data.success ? { kind: "landed", text: `Landed the ${r.data.fish.name}, +${r.data.points} pts`, fish: r.data.fish } : { kind: "lost", text: `${why || ""} The ${fish?.name || "fish"} got away.` });
      setPhase(r.data.success ? "result" : "lost");
      onState(r.data.match);
    } catch (e) { if (!/No duel in progress|already been settled|let the line settle/i.test(errMsg(e))) toast.error(errMsg(e)); setPhase("idle"); }
    finally { setEnc(null); }
  }, [onState]);
  const castRef = useRef(cast);
  castRef.current = cast;
  const spaceHeld = useRef(false);
  const settledAt = useRef(0);
  useEffect(() => { if (settled(phase)) settledAt.current = performance.now(); }, [phase]);
  useEffect(() => {
    // Only a fresh press of Space casts, never a key still held over from reeling, and never within the first beat after a fish is settled.
    const canCast = () => settled(phaseRef.current) && performance.now() - settledAt.current > 450;
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.code === "Space") {
        if (["BUTTON", "A"].includes(e.target?.tagName)) return;
        e.preventDefault();
        const fresh = !spaceHeld.current && !e.repeat;
        spaceHeld.current = true;
        if (fresh && canCast()) castRef.current();
      } else if (e.code === "Enter" && canCast()) castRef.current();
    };
    const onUp = (e) => { if (e.code === "Space") spaceHeld.current = false; };
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onUp); window.addEventListener("blur", () => { spaceHeld.current = false; });
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onUp); };
  }, []);
  const forfeit = async () => { if (!window.confirm("Forfeit the duel? Your opponent takes the win.")) return; try { const r = await api.post("/duel/forfeit"); onState(r.data); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="space-y-3 fade-in" data-testid="duel-arena">
      <DuelHero sub={`Fishing ${m.water_name} against ${opp.username}`} right={<div className={`num text-[26px] leading-none ${left <= 15 ? "text-[#f0a5a3]" : "text-[#f4ead2]"}`} data-testid="duel-clock">{m.overtime ? tt("OT") : mmss(left)}</div>} />
      {m.overtime && <div className="portal-box px-3 py-2 text-[12.5px] text-[#ffcfa8] flex items-center gap-2" data-testid="duel-overtime"><span className="duel-pulse" />{m.waiting_on?.includes(m.me) ? tt("Time! Land your fish, the duel is decided when it's settled.") : `Time! Waiting for ${opp.username} to finish their fight…`}</div>}
      <div className="duel-board" data-testid="duel-board">
        <PlayerCard p={me} me score={me.score} live testId="duel-me" />
        <div className="duel-clock">
          <div className="label">{tt("Duel clock")}</div>
          <div className={`num text-[30px] leading-none ${left <= 15 ? "text-[#f0a5a3]" : "text-[#f4ead2]"}`}>{m.overtime ? tt("Overtime") : mmss(left)}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">{m.water_name}</div>
        </div>
        <PlayerCard p={opp} score={opp.score} live testId="duel-opp" />
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-3">
        <Panel icon="bobber" title={tt("Your line")} right={<span className="num text-[var(--muted)]">{tt("no energy spent · your own gear")}</span>} bodyClass="fishing-stage" testId="duel-line">
          {phase === "fight" && enc ? (
            <div className="fight-wrap space-y-3" data-testid="duel-fight">
              <div className="text-[13px] text-[#ffcfa8]" data-testid="duel-hint"><Rarity r={enc.rarity} tag /> <b>{enc.name}</b> · {wt(enc.weight)} {tt("· worth")} <b className="num">{enc.points}</b> {tt("pts.")} {enc.hint}</div>
              <Fight enc={enc} onFinish={finish} />
            </div>
          ) : (
            <div className="space-y-3">
              {flash && <div className={`text-[13px] ${flash.kind === "landed" ? "text-[var(--ok)]" : flash.kind === "lost" ? "text-[#f0a5a3]" : "text-[var(--text-2)] italic"} flex items-center gap-3`} data-testid="duel-flash">{flash.fish && <FishPlate speciesId={flash.fish.species_id} name={flash.fish.name} className="w-20 h-14 shrink-0" />}<span>{flash.text}</span></div>}
              <button className="btn btn-gold btn-lg w-full" onClick={cast} disabled={!settled(phase) || m.overtime || left <= 0} data-testid="duel-cast-button">{m.overtime || left <= 0 ? tt("Time's up") : phase === "casting" ? tt("Casting...") : phase === "landing" ? tt("Landing...") : settled(phase) && phase !== "idle" ? tt("Cast again") : tt("Cast line")}</button>
              <div className="text-[11.5px] text-[var(--muted)]">{tt("Press Enter or Space to cast, hold Space to reel. Every fish in")} {m.water_name} {tt("is in play, bigger and rarer means more points.")}</div>
            </div>
          )}
        </Panel>
        <Panel icon="quests" title={tt("Pier log")} bodyClass="!p-0" testId="duel-log">
          <ul className="text-[12px] divide-y divide-[var(--border)] max-h-[320px] overflow-y-auto scrollbar-thin">
            {[...m.log].reverse().map((e, i) => <li key={i} className={`px-3 py-1.5 ${e.uid === m.me ? "text-[var(--text)]" : "text-[var(--text-2)]"}`}>{e.rarity && <span className={`rar-${e.rarity} mr-1.5`}>●</span>}{e.text}{e.pts ? <b className="num text-[var(--gold)] ml-1">+{e.pts}</b> : null}</li>)}
          </ul>
          <div className="p-2 border-t border-[var(--border)]"><button className="btn btn-sm w-full" onClick={forfeit} data-testid="duel-forfeit"><Flag size={12} className="inline mr-1 -mt-0.5" />{tt("Forfeit")}</button></div>
        </Panel>
      </div>
    </div>
  );
}

function Rematch({ m, cost, energy, busy, onRematch }) {
  const opp = m.players[m.opponent];
  if (m.opponent_left) return <div className="text-center text-[12px] text-[var(--muted)] mt-3" data-testid="duel-rematch-gone">{opp.username} {tt("has left the pier.")}</div>;
  const rm = m.rematch;
  if (rm && rm.by === m.me) return <div className="duel-cta-box mt-3 text-[12.5px] text-[var(--gold)]" data-testid="duel-rematch-waiting"><Timer size={13} className="inline duel-spin mr-1" />{tt("Rematch offered, waiting for")} {opp.username}… <span className="num">{rm.seconds}s</span><div className="text-[11px] text-[var(--muted)]">{tt("No answer? Your")} {cost} {tt("energy comes back.")}</div></div>;
  return (
    <div className="mt-3 text-center">
      {rm && <div className="text-[12.5px] text-[var(--gold)] mb-1.5" data-testid="duel-rematch-offer">{opp.username} {tt("wants a rematch!")} <span className="num text-[var(--muted)]">{rm.seconds}s</span></div>}
      <button className={`btn w-full ${rm ? "btn-gold" : ""}`} onClick={onRematch} disabled={busy || energy < cost} title={energy < cost ? `You need ${cost} energy` : ""} data-testid={rm ? "duel-rematch-accept" : "duel-rematch-button"}>
        <PixelIcon name="duel" size={14} className="inline mr-1.5 -mt-0.5" />{rm ? tt("Accept rematch") : tt("Rematch")} · {cost} {tt("energy")}
      </button>
    </div>
  );
}

function Result({ m, onDismiss, rematch }) {
  const me = m.players[m.me], opp = m.players[m.opponent];
  const outcome = m.winner === null ? "draw" : m.winner === m.me ? "win" : "loss";
  return (
    <Panel icon="duel" title={tt("Duel over")} testId="duel-result">
      <div className={`font-display text-[22px] text-center ${outcome === "win" ? "text-[var(--gold)]" : outcome === "loss" ? "text-[#f0a5a3]" : "text-[#f4ead2]"}`} data-testid="duel-outcome">{outcome === "win" ? tt("Victory") : outcome === "loss" ? tt("Defeat") : tt("A draw")}</div>
      <div className="text-center text-[12.5px] text-[var(--text-2)] mt-1">{m.log[m.log.length - 1]?.text}</div>
      <div className="duel-board mt-4">
        <PlayerCard p={me} me score={me.score} testId="duel-res-me" />
        <div className="duel-clock"><div className="label">{tt("Ladder points")}</div><div className="num text-[26px] text-[var(--gold)]" data-testid="duel-ladder-delta">{(m.ladder?.[m.me]?.delta ?? 0) >= 0 ? "+" : ""}{m.ladder?.[m.me]?.delta ?? 0}</div><div className="text-[11px] text-[var(--muted)] mt-1">{m.water_name}</div></div>
        <PlayerCard p={opp} score={opp.score} testId="duel-res-opp" />
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 text-[12px] text-[var(--text-2)] mt-3 num">
        <div>{tt("You:")} {me.landed} {tt("landed ·")} {me.lost} {tt("lost ·")} {wt(me.weight)} {tt("total")}</div><div>{opp.username}: {opp.landed} {tt("landed ·")} {opp.lost} {tt("lost ·")} {wt(opp.weight)} {tt("total")}</div>
      </div>
      {m.ladder?.[m.me]?.milestones?.length > 0 && <div className="mt-3 text-center text-[12.5px] text-[var(--ok)]" data-testid="duel-milestones-won">{tt("Ladder milestone reached:")} {m.ladder[m.me].milestones.join(" · ")}</div>}
      <Rematch m={m} {...rematch} />
      <button className={`btn w-full mt-3 ${m.rematch && m.rematch.by !== m.me ? "" : "btn-gold"}`} onClick={onDismiss} data-testid="duel-dismiss">{tt("Back to the pier")}</button>
    </Panel>
  );
}

function Locked({ level, need }) {
  return (
    <div className="space-y-3 fade-in" data-testid="duel-locked">
      <DuelScene />
      <Panel icon="duel" title={tt("The pier is not open to you yet")} testId="duel-locked-panel">
        <div className="duel-lock">
          <Lock size={28} className="mx-auto text-[var(--muted)]" />
          <div className="font-display text-[16px] text-[#f4ead2] mt-2">{tt("Fishing duels open at level {{v0}}", { v0: need })}</div>
          <p className="text-[12.5px] text-[var(--text-2)] mt-1">{tt("You are level {{v0}}. Keep fishing, the duelling pier and its weekly ladder unlock on the way.", { v0: level })}</p>
          <Link to="/game/fish" className="btn btn-gold mt-4 inline-block" data-testid="duel-locked-go-fish">{tt("Go fishing")}</Link>
        </div>
      </Panel>
    </div>
  );
}

export default function Duel() {
  const { user, setUser } = useGame();
  const mobile = useIsMobile();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const apply = useCallback((d, { user: withUser = true } = {}) => {
    setS((prev) => {
      // Polls during a live duel only touch the board when something actually changed, a re-render mid-fight is what made the needle stutter.
      if (prev?.match?.status === "live" && d?.match?.status === "live") {
        const a = JSON.stringify([prev.match.players, prev.match.log.length]), b = JSON.stringify([d.match.players, d.match.log.length]);
        if (a === b) return prev;
      }
      return d;
    });
    if (d?.user && withUser) setUser(d.user);
    if (d?.notices?.length) d.notices.forEach((n) => toast.message(n));
    setDuelWatch(!!(d?.queue || (d?.match && d.match.status !== "done")));
  }, [setUser]);
  const locked = !user.duel_access;
  const load = useCallback(() => (locked ? Promise.resolve() : api.get("/duel/state").then((r) => apply(r.data, { user: r.data.match?.status !== "live" })).catch((e) => setErr(errMsg(e)))), [apply, locked]);
  useEffect(() => { load(); }, [load]);
  const live = s?.match?.status === "live", queued = !!s?.queue, pendingM = s?.match?.status === "pending";
  useEffect(() => {
    if (!s) return undefined;
    const t = setInterval(load, live ? 2000 : (queued || pendingM || s.match?.status === "done") ? 2500 : 15000);
    return () => clearInterval(t);
  }, [s, live, queued, pendingM, load]);
  const call = async (fn) => { setBusy(true); try { apply((await fn()).data); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); } };
  const setMatch = useCallback((match) => setS((prev) => (prev ? { ...prev, match } : prev)), []);
  if (locked) return <Locked level={user.level} need={user.duel_level} />;
  if (err) return <Empty>{err}</Empty>;
  if (!s) return null;
  if (s.match?.status === "live") return <Arena m={s.match} onState={setMatch} />;
  if (s.match?.status === "done") return <Result m={s.match} onDismiss={() => call(() => api.post("/duel/dismiss"))} rematch={{ cost: s.cost, energy: user.energy, busy, onRematch: () => call(() => api.post("/duel/rematch")) }} />;
  const pending = s.match?.status === "pending";
  const r = s.record;
  const cta = pending ? (
    <div className="duel-cta-box border-[var(--gold)] font-display text-[13px] text-[var(--gold)]" data-testid="duel-pending-note">{tt("Opponent found, accept the duel in the popup.")}</div>
  ) : queued ? (
    <div className="duel-cta-box" data-testid="duel-queue">
      <div className="font-display text-[13px] text-[var(--gold)] flex items-center justify-center gap-2"><Timer size={14} className="duel-spin" /> {tt("Waiting for an opponent…")} <span className="num">{mmss(s.queue.waiting)}</span></div>
      <div className="text-[11.5px] text-[var(--muted)] mt-1">{s.queue.others > 0 ? `${s.queue.others} other angler${s.queue.others > 1 ? "s" : ""} on the pier` : tt("You're first on the pier, tell a friend.")} {tt("· auto-leave at")} {mmss(s.queue_timeout)}</div>
      <button className="btn btn-sm mt-2" onClick={() => call(() => api.delete("/duel/queue"))} disabled={busy} data-testid="duel-leave-queue">{tt("Leave queue (refund")} {s.cost} {tt("energy)")}</button>
    </div>
  ) : (
    <button className="btn btn-gold btn-lg w-full" onClick={() => call(() => api.post("/duel/queue"))} disabled={busy || user.energy < s.cost} title={user.energy < s.cost ? `You need ${s.cost} energy` : ""} data-testid="duel-enter-queue"><PixelIcon name="duel" size={16} className="inline mr-1.5 -mt-0.5" />{tt("Find an opponent ·")} {s.cost} {tt("energy")}</button>
  );
  const howPanel = (
        <Panel icon="wiki" title={tt("How it works")} testId="duel-lobby">
          <p className="text-[12.5px] text-[var(--text-2)]">{tt("Two anglers, one water you both know,")} <b>{tt("two minutes")}</b>{tt(". A fish hooked before the buzzer may still be fought to the end, the other angler waits. Every fish landed scores points, common")} {s.points.common}{tt(", uncommon")} {s.points.uncommon}{tt(", rare")} {s.points.rare}{tt(", epic")} {s.points.epic}{tt(", legendary")} {s.points.legendary}{tt(", mythic")} {s.points.mythic}{tt(". More for a big one, a quarter more for a variant. Lost fish score nothing. Most points wins.")}</p>
          <ul className="text-[12px] text-[var(--muted)] mt-2 space-y-0.5 list-disc pl-4">
            <li>{tt("You both fight with your own rod, reel and line, so better gear hooks rarer fish and makes fights easier. Duels never wear your gear down. Landing a species you've mastered adds +1.5% points per mastery level (up to +15%).")}</li>
            <li>{tt("Entering costs")} <b className="num">{s.cost} {tt("energy")}</b>{tt(". Casts inside the duel are free, and duel fish never enter your inventory.")}</li>
            <li>{tt("No opponent within")} {s.queue_timeout}{tt("s? You leave the queue and the energy comes back. You can wander the harbour while you wait, a popup will call you to the pier when someone turns up (")}{s.accept_seconds}{tt("s to accept).")}</li>
          </ul>
        </Panel>
  );
  const recordPanel = (
          <Panel icon="quests" title={tt("Your record")} right={<span className="num">{tt("this week")} {s.ladder.wins}W · {s.ladder.losses}L</span>} testId="duel-record">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="num text-[20px] text-[var(--ok)]">{r.wins}</div><div className="label">{tt("wins")}</div></div>
              <div><div className="num text-[20px] text-[#f0a5a3]">{r.losses}</div><div className="label">{tt("losses")}</div></div>
              <div><div className="num text-[20px]">{r.draws}</div><div className="label">{tt("draws")}</div></div>
            </div>
            <div className="text-[11.5px] text-[var(--muted)] mt-2 num flex items-center gap-1"><Trophy size={11} /> {tt("streak")} {r.streak} {tt("· best")} {r.best_streak} · {r.played} {tt("duels")}</div>
          </Panel>
  );
  return (
    <div className="space-y-3 fade-in" data-testid="duel-page">
      <DuelScene>{cta}</DuelScene>
      <InfoTabs inline testId={mobile ? "duel-sheets" : "duel-tabs"} items={[
        mobile && { id: "board", label: "Weekly board", Icon: pixelIcon("rankings"), node: <DuelBoard l={s.ladder} me={user.id} /> },
        { id: "record", label: mobile ? "Record" : "Your record", Icon: pixelIcon("quests"), node: recordPanel },
        { id: "how", label: "How it works", Icon: pixelIcon("wiki"), node: howPanel },
      ]} />
      <div className="grid lg:grid-cols-[1fr_340px] gap-3 items-start">
        <div className="min-w-0"><DuelLadder l={s.ladder} /></div>
        {!mobile && <DuelBoard l={s.ladder} me={user.id} />}
      </div>
    </div>
  );
}
