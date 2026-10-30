import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skull, Zap, Clock, Trophy, Anchor, FlaskConical, Wrench } from "lucide-react";
import { api, errMsg, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Empty, Pearls, PassIcon } from "./ui-bits";
import TensionGame from "./TensionGame";
import { CRATE_COL } from "./Crates";
import { fmtLeft } from "../pages/game/Support";
import { t as tt } from "../i18n";

const left = (iso) => Math.max(0, (new Date(iso) - Date.now()) / 1000);
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`; };

export function LeviathanBanner({ boss, weight, children, dim }) {
  return (
    <div className={`relative overflow-hidden rounded-[3px] border border-[#3a2412] ${dim ? "opacity-70" : ""}`} data-testid="leviathan-banner">
      <img src={boss.image} alt={boss.name} className="w-full h-[210px] sm:h-[300px] object-cover block" draggable="false" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.05)_40%,rgba(8,10,14,.92)_100%)]" />
      <div className="absolute left-0 right-0 bottom-0 p-3 sm:p-4">
        <div className="text-[10px] uppercase tracking-[.25em] text-[#ff8a70] flex items-center gap-1.5"><Skull size={11} /> {tt("Crew Boss")}{weight && <> · <span className="num">{fmt(Math.round(weight))} kg</span></>}</div>
        <div className="font-display text-[26px] sm:text-[36px] leading-none text-[#f4ead2] drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]" data-testid="leviathan-name">{boss.name}</div>
        <div className="text-[12px] text-[#d9cdb5] mt-1 max-w-2xl italic">{boss.blurb}</div>
        {children}
      </div>
    </div>
  );
}

function Meter({ ev }) {
  const pct = 100 - (ev.distance_left / ev.distance_total) * 100;
  return (
    <div data-testid="leviathan-meter">
      <div className="flex justify-between text-[11.5px] mb-1"><span className="text-[var(--text-2)]">{tt("Distance to the quay")}</span><span className="num text-[#f4ead2]"><b>{fmt(ev.distance_left)}</b> / {fmt(ev.distance_total)} {tt("fathoms")}</span></div>
      <div className="h-4 bg-[rgba(0,0,0,.45)] border border-[var(--border)] relative overflow-hidden">
        <div className="h-full bg-[linear-gradient(90deg,#7a1f1f,#ff8a70)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10.5px] num text-white drop-shadow">{pct.toFixed(1)}%</div>
      </div>
      <div className="text-[11px] text-[var(--muted)] mt-1" data-testid="leviathan-drift">{tt("It fights back: every hour it drags itself about")} <b className="num">{ev.drift_per_hour}</b> {tt("fathoms out again")}{ev.drift_total > 0 && <> · <span className="num">{fmt(ev.drift_total)}</span> {tt("fathoms lost to it so far")}</>}.</div>
    </div>
  );
}

function Rewards({ r, title }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11.5px]" data-testid="leviathan-rewards">
      <div className="border border-[var(--border)] p-2"><div className="label">{tt("Gold")}</div><div className="num text-[#ffcfa8]">{tt("up to")} {fmt(r.gold)}</div></div>
      <div className="border border-[var(--border)] p-2"><div className="label">{tt("XP")}</div><div className="num text-[var(--xp)]">{tt("up to")} {fmt(r.xp)}</div></div>
      <div className="border border-[var(--border)] p-2"><div className="label">{tt("Pearls")}</div><Pearls n={r.pearls} className="text-[12px]" /></div>
      <div className="border border-[var(--border)] p-2"><div className="label flex items-center gap-1"><Wrench size={10} /> {tt("Tackle Scrap")}</div><div className="num">{tt("up to")} {r.scrap}</div></div>
      {r.crate && <div className="border border-[var(--border)] p-2" data-testid="leviathan-reward-crate"><div className="label">{tt("Crate")}</div><div className="flex items-center gap-1.5"><img src={`/art/gear/${r.crate}.webp`} alt="" className="w-5 h-5 object-contain" style={{ imageRendering: "pixelated" }} /><span style={{ color: CRATE_COL[r.crate] }}>{tt({ crate_bronze: "Bronze", crate_silver: "Silver", crate_gold: "Gold" }[r.crate])}</span> <span className="text-[var(--muted)]">{tt("for everyone")}</span></div></div>}
      <div className="border border-[var(--border)] p-2"><div className="label flex items-center gap-1"><FlaskConical size={10} /> {tt("Energy Potion")}</div><div className="num">{r.potion_pct}% {tt("chance")}</div></div>
      <div className="border border-[var(--border)] p-2"><div className="label flex items-center gap-1"><PassIcon size={10} /> {tt("Angler Pass · Week")}</div><div className="num">{r.pass_pct}% {tt("chance")}</div></div>
      <div className="border border-[var(--border)] p-2"><div className="label flex items-center gap-1"><Trophy size={10} /> {tt("Title")}</div><div className="text-[#f08a45]">{title || r.title}</div></div>
    </div>
  );
}

function Contributions({ ev, me }) {
  return (
    <Panel icon="crews" title={tt("Contributions")} bodyClass="!p-0" testId="leviathan-contributions">
      {ev.contributions.length === 0 ? <div className="p-3"><Empty>{tt("Nobody has pulled yet.")}</Empty></div> : (
        <table className="table text-[12px]"><thead><tr><th>#</th><th>{tt("Angler")}</th><th className="r">{tt("Fathoms")}</th><th className="r">{tt("Pulls")}</th><th className="r">{tt("Last")}</th></tr></thead>
          <tbody>{ev.contributions.map((c, i) => <tr key={c.username} className={c.username === me ? "bg-[rgba(224,176,78,.08)]" : ""} data-testid={`leviathan-contrib-${c.username}`}><td className="num">{i + 1}</td><td>{c.username}</td><td className="num r text-[#f4ead2]">{fmt(c.fathoms)}</td><td className="num r">{c.pulls}</td><td className="r text-[var(--muted)]">{c.last_pull_at ? ago(c.last_pull_at) : "-"}</td></tr>)}</tbody></table>
      )}
    </Panel>
  );
}

export function CrewBoss() {
  const { user, setUser } = useGame();
  const [st, setSt] = useState(null);
  const [pull, setPull] = useState(null);
  const [result, setResult] = useState(null);
  const [, tick] = useState(0);
  const load = () => api.get("/crew/boss").then((r) => setSt(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); const id = setInterval(() => { tick((x) => x + 1); if (!pull) load(); }, 30000); return () => clearInterval(id); }, [pull]); // eslint-disable-line
  const start = async () => {
    try { const r = await api.post("/crew/boss/pull"); setResult(null); setPull(r.data); setUser(r.data.user); } catch (e) { toast.error(errMsg(e)); }
  };
  const finish = async (ok, elapsed, why, holds, gameTime, progress) => {
    const snapped = !ok;
    try {
      const r = await api.post("/crew/boss/pull/finish", { pull_id: pull.pull_id, progress, snapped, elapsed, game_time: gameTime, holds });
      setResult({ ...r.data, why });
      setSt((s) => ({ ...s, event: r.data.event }));
      if (r.data.landed) toast.success(`${r.data.landed.name} is on the quay!`, { duration: 8000 });
    } catch (e) { toast.error(errMsg(e)); }
    setPull(null);
  };
  if (!st) return <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div>;
  const ev = st.event;
  if (pull) return (
    <div className="space-y-2" data-testid="leviathan-fight">
      <LeviathanBanner boss={ev.boss} weight={ev.weight} />
      <Panel icon="skull" title={tt("Crew Boss")} right={<span className="num">{tt("Energy")} {user.energy}/{user.max_energy}</span>}>
        <div className="fight-wrap space-y-3">
          <div className="text-[13px] font-display text-[var(--r-legendary)]" data-testid="leviathan-hint">{pull.params.hint}</div>
          <TensionGame enc={pull.params} onFinish={finish} />
        </div>
      </Panel>
    </div>
  );
  if (!ev) return (
    <div className="space-y-3" data-testid="leviathan-none">
      <Panel icon="skull" title={<span className="flex items-center gap-2">{tt("Crew Boss")}</span>}>
        <p className="text-[12.5px] text-[var(--text-2)]">{tt("Once a week a giant surfaces off your crew's moorings and the whole crew has {{h}} hours to haul it in against a shared distance meter, and every hour it drags itself part of the way back out. A pull costs {{e}} energy and is a {{s}}-second fight; then your arms need {{c}} hours. Only anglers who pulled share the reward, and the harder you pulled, the bigger your share.", { h: st.window_h, e: st.energy, s: 20, c: st.cooldown_h })}</p>
        <p className="text-[12px] text-[var(--muted)] mt-2">{tt("No crew boss is surfaced right now. One surfaces every week, keep an eye on your messages and crew chat.")}</p>
      </Panel>
      {st.history.length > 0 && <Panel icon="rankings" title={tt("Crew record")} bodyClass="!p-0" testId="leviathan-history"><table className="table text-[12px]"><tbody>{st.history.map((h) => <tr key={h.id}><td><span className="rar-mythic">{h.boss.name}</span></td><td className="num">{fmt(Math.round(h.weight))} kg</td><td>{h.status === "landed" ? <span className="text-[var(--ok)]">{tt("landed")}</span> : <span className="text-[var(--muted)]">{tt("escaped")}</span>}</td><td className="r text-[var(--muted)]">{h.ended_at ? ago(h.ended_at) + " " + tt("ago") : ""}</td></tr>)}</tbody></table></Panel>}
      <Panel icon="skull" title={tt("Known crew bosses")} testId="leviathan-catalogue">
        <div className="grid sm:grid-cols-2 gap-2">{st.leviathans.map((b) => <div key={b.id} className="border border-[var(--border)] p-2 text-[12px]"><div className="font-display text-[14px] text-[#f4ead2]">{b.name}</div><div className="text-[var(--muted)] italic">{b.blurb}</div><div className="mt-1 text-[11px] text-[var(--text-2)]">{tt("up to")} <span className="num text-[#ffcfa8]">{fmt(b.rewards.gold)}g</span> · <span className="num text-[var(--xp)]">{fmt(b.rewards.xp)} XP</span> · <Pearls n={b.rewards.pearls} className="text-[11px]" /> · <span className="num">{b.rewards.scrap}</span> {tt("scrap")}</div></div>)}</div>
      </Panel>
    </div>
  );
  const me = ev.me;
  const cd = me.cooldown_until ? left(me.cooldown_until) : 0;
  const canPull = ev.status === "active" && cd <= 0 && user.energy >= ev.energy;
  return (
    <div className="space-y-3" data-testid="leviathan-page">
      <LeviathanBanner boss={ev.boss} weight={ev.weight}>
        <div className="mt-2 text-[11.5px] text-[#d9cdb5] flex flex-wrap gap-x-4 gap-y-1"><span className="inline-flex items-center gap-1"><Clock size={11} /> {tt("escapes in")} <b className="num text-[#f4ead2]">{fmtLeft(left(ev.ends_at))}</b></span><span className="inline-flex items-center gap-1"><Anchor size={11} /> {ev.members_at_spawn} {tt("crew members")}</span></div>
      </LeviathanBanner>
      <Panel testId="leviathan-pull-panel">
        <Meter ev={ev} />
        {result && <div className={`mt-2 text-[12.5px] ${result.landed ? "text-[#f08a45]" : "text-[var(--text-2)]"}`} data-testid="leviathan-result"><b className="num">+{result.fathoms}</b> {tt("fathoms")}: {result.message}{result.why && !result.landed && <span className="text-[var(--muted)]"> ({result.why})</span>}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn btn-gold" disabled={!canPull} onClick={start} data-testid="leviathan-pull-button"><Zap size={13} /> {tt("Pull")} · {ev.energy} {tt("energy")}</button>
          <span className="text-[11.5px] text-[var(--muted)]" data-testid="leviathan-cooldown">
            {cd > 0 ? <>{tt("Next pull in")} <b className="num">{fmtLeft(cd)}</b></> : user.energy < ev.energy ? tt("Not enough energy") : tt("A {{s}}-second fight; hold the tension and every second in the sweet spot is another fathom.", { s: ev.pull_seconds })}
          </span>
          <span className="ml-auto text-[11.5px] text-[var(--text-2)]">{tt("You")}: <b className="num text-[#f4ead2]">{fmt(me.fathoms)}</b> {tt("fathoms")} · {me.pulls} {tt("pulls")}</span>
        </div>
      </Panel>
      <div className="grid lg:grid-cols-2 gap-3">
        <Contributions ev={ev} me={user.username} />
        <Panel icon="chest" title={tt("Rewards")} testId="leviathan-rewards-panel">
          <Rewards r={ev.rewards} />
          <p className="text-[11px] text-[var(--muted)] mt-2">{tt("Paid only to anglers who pulled: everyone gets a floor share, the rest scales with fathoms hauled. The crew bank receives {{p}}% on top. Escapes pay nothing.", { p: ev.rewards.bank_pct })}</p>
        </Panel>
      </div>
    </div>
  );
}

export function LeviathanJournal() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get("/crew/boss/journal").then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  if (!rows) return <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div>;
  const n = rows.filter((r) => r.caught).length;
  return (
    <div className="space-y-3" data-testid="leviathan-journal">
      <div className="text-[12.5px] text-[var(--text-2)]">{tt("Crew bosses your crew landed with your help.")} <span className="num text-[#f4ead2]">{n} / {rows.length}</span></div>
      <div className="grid md:grid-cols-2 gap-3">
        {rows.map((b) => (
          <div key={b.id} className={`relative overflow-hidden border ${b.caught ? "border-[#8a5a12]" : "border-[var(--border)]"} rounded-[3px]`} data-testid={`leviathan-journal-${b.id}`}>
            <img src={b.image} alt="" className={`w-full h-[150px] object-cover block ${b.caught ? "" : "grayscale brightness-[.35]"}`} draggable="false" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_35%,rgba(8,10,14,.95)_100%)]" />
            <div className="absolute left-0 right-0 bottom-0 p-2.5">
              <div className="font-display text-[18px] text-[#f4ead2] leading-none">{b.caught ? b.name : "???"}</div>
              {b.caught ? <div className="text-[11.5px] text-[#d9cdb5] mt-1"><span className="num">{fmt(Math.round(b.weight))} kg</span> · {b.crew} · {new Date(b.at).toLocaleDateString()} · <span className="num">{fmt(b.fathoms)}</span> {tt("fathoms by you")}{b.count > 1 && <> · ×{b.count}</>}<div className="text-[#f08a45] flex items-center gap-1 mt-0.5"><Trophy size={10} /> {b.title}</div></div>
                : <div className="text-[11.5px] text-[var(--muted)] mt-1 italic">{tt("Not yet hauled. Rumoured at")} {fmt(b.min_kg)}–{fmt(b.max_kg)} kg.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
