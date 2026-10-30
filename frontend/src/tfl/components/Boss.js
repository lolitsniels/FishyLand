/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { CrateDropNote } from "./Crates";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Skull } from "lucide-react";
import { toast } from "sonner";
import { api, wt, wtRange, fmt, errMsg, ago } from "../lib/api";
import { useGame } from "../context/GameContext";
import { countdown } from "./Expedition";
import { Panel, Gold, Empty } from "./ui-bits";
import { t as tt } from "../i18n";
import { CatchShare } from "./CatchShare";

export const BossPlate = ({ bossId, name, silhouette = false, className = "" }) => (
  <div className={`border border-[var(--r-legendary)] flex items-center justify-center p-1 ${className}`} style={{ backgroundImage: "radial-gradient(ellipse at center, #3a2a12 0%, #121110 78%)" }}>
    <img src={`/art/bosses/${bossId}.webp`} alt={silhouette ? tt("Unslain boss") : name} loading="lazy" className="max-w-full max-h-full object-contain"
      style={silhouette ? { filter: "brightness(0) invert(0.3) blur(1px)", opacity: 0.55 } : { filter: "drop-shadow(0 3px 5px rgba(0,0,0,.7))" }} data-testid={`boss-plate-${bossId}`} />
  </div>
);

// Active boss status block for Fishing / Harbour. `boss` comes from GET /events.
export const BossPanel = ({ boss, waterKey }) => {
  const { user, setUser } = useGame();
  const nav = useNavigate();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t); }, []);
  if (!boss) return null;
  const here = boss.water === waterKey;
  const travel = async () => { try { const r = await api.post("/waters/travel", { water: boss.water }); setUser(r.data); nav("/game/fish"); } catch {} };
  return (
    <div className={`border px-3 py-2 text-[12.5px] flex items-center gap-3 ${here ? "border-[var(--r-legendary)] bg-[#241612]" : "border-[var(--gold-dim)] bg-[var(--bg-2)]"}`} data-testid="boss-panel">
      <Skull size={15} className="text-[var(--r-legendary)] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-display text-[11px] tracking-widest uppercase text-[var(--r-legendary)] mr-2">{tt("Boss stirring")}</span>
        <span className="text-[#f4ead2]">{here ? tt("The water heaves. Something enormous is here: {{v0}}% of bites will be IT.", { v0: boss.hook_chance }) : tt("Something enormous is stirring at {{v0}}.", { v0: boss.water_name })} {tt("Slay it for")} <span className="num text-[#ffcfa8]">{fmt(boss.gold)}g</span>, <span className="num text-[var(--xp)]">{fmt(boss.xp)} {tt("XP")}</span> {tt("and the title “")}{boss.title}{tt("” · leaves in")} <span className="num">{countdown(boss.end)}</span></span>
      </div>
      {!here && user.unlocked_waters.includes(boss.water) && <button className="btn btn-sm btn-gold" onClick={travel} data-testid="boss-travel-button">{tt("Travel there")}</button>}
      {!here && !user.unlocked_waters.includes(boss.water) && <span className="text-[11px] text-[var(--muted)]">{tt("locked for you")}</span>}
    </div>
  );
};

export const BossResult = ({ res, onDone }) => {
  const b = res.boss;
  const { user } = useGame();
  return (
    <div className="fade-in panel !border-2 !border-[var(--r-legendary)] p-3 space-y-2" data-testid="boss-result">
      <div className="flex flex-col sm:flex-row gap-3">
        <BossPlate bossId={b.id} name={b.name} className="w-full sm:w-[220px] h-[160px] sm:h-[140px] shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="label label-gold">{tt("Boss slain")}</div>
          <div className="font-display text-2xl text-[var(--r-legendary)]" data-testid="boss-result-name">{b.name}</div>
          <p className="text-[12.5px] text-[var(--text-2)] italic">{b.blurb}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12.5px]">
            <div><div className="label">{tt("Weight")}</div><div className="num">{wt(b.weight)}</div></div>
            <div><div className="label">{tt("Gold")}</div><Gold n={b.gold} /></div>
            <div><div className="label">{tt("XP")}</div><div className="num text-[var(--xp)]">+{fmt(b.xp)}</div></div>
            <div><div className="label">{tt("Title")}</div><div className="text-[#ffcfa8]">{b.title}</div></div>
          </div>
          {b.shared_with.length > 0 && <div className="text-[12px] text-[var(--ok)]" data-testid="boss-shared">{tt("Crewmates standing by got a 10% share:")} {b.shared_with.join(", ")}</div>}
          <CrateDropNote drop={res.crate_drop} />
          {res.level_up && <div className="text-[12.5px] text-[#ffcfa8]">{tt("▲ Level")} {res.level_up} {tt("reached!")}</div>}
          <div className="text-[12px] text-[var(--text-2)]" data-testid="boss-result-note">{tt("Rewards are already in your pocket. The kill is recorded in the Journal's ☠ Bosses tab, the title \"")}{b.title}{tt("\" is in your Displayed Title picker, and the whole server has been told.")}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-sm btn-gold" onClick={onDone} data-testid="boss-result-done">{tt("Catch your breath")}</button>
        <Link to="/game/journal?tab=bosses" className="btn btn-sm" data-testid="boss-result-journal">{tt("View in Journal")}</Link>
        <Link to="/game/profile" className="btn btn-sm" data-testid="boss-result-title">{tt("Wear the title")}</Link>
        <div className="ml-auto self-center" data-testid="boss-share"><CatchShare c={{ species_id: b.id, name: b.name, weight: b.weight, boss: true }} username={user?.username} lbs={wt(b.weight)} /></div>
      </div>
    </div>
  );
};

export function BossJournal() {
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const load = () => api.get("/bosses").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const mount = async (b, on) => { try { await api.post(`/bosses/${b.id}/${on ? "mount" : "unmount"}`); toast.success(on ? `${b.name} mounted on a gold plaque` : `${b.name} taken down`); load(); } catch (e) { toast.error(errMsg(e)); } };
  if (!d) return <Empty>{tt("Loading...")}</Empty>;
  const slain = d.bosses.filter((b) => b.you).length;
  return (
    <div className="space-y-3" data-testid="boss-journal">
      <Panel icon="skull" title={tt("Legendary bosses")} right={<span className="num"><span data-testid="boss-progress">{slain} / {d.bosses.length} {tt("slain")}</span> · <span data-testid="boss-mounts">{d.mounted} / {d.max_mounts} {tt("plaques")}</span></span>}>
        <p className="text-[12.5px] text-[var(--text-2)]">{tt("One monster haunts every water. One rises somewhere roughly every")} {d.period_h} {tt("hours, for")} {d.window_min} {tt("minutes, at an unpredictable moment. When it does, the whole server hears (turn on boss alerts in My Angler to get a ping). While it is up,")} {d.hook_chance}{tt("% of bites at that water will be the boss itself. Expect a two-phase fight: it rallies at half strength.")}</p>
        {!d.active && d.last_sighting && <div className="mt-2 text-[12px] text-[var(--muted)]" data-testid="boss-last-sighting">{tt("Last sighting:")} {d.last_sighting.water_name}, {ago(d.last_sighting.at)}.</div>}
        {d.active && <div className="mt-2 text-[12.5px] text-[var(--r-legendary)]" data-testid="boss-journal-active">◆ {d.active.name} {tt("is stirring at")} {d.active.water_name} {tt("right now:")} <button className="underline" onClick={() => nav("/game/fish")}>{tt("go")}</button></div>}
      </Panel>
      <div className="grid md:grid-cols-2 gap-2">
        {d.bosses.map((b) => (
          <div key={b.id} className={`journal-cell flex gap-3 ${b.you ? "discovered" : "undiscovered"}`} data-testid={`boss-entry-${b.id}`}>
            <BossPlate bossId={b.id} name={b.name} silhouette={!b.you} className="w-[120px] h-[84px] shrink-0" />
            <div className="min-w-0 flex-1 text-[12px]">
              <div className="flex items-center justify-between gap-2"><span className={`font-display ${b.you ? "text-[var(--r-legendary)]" : "text-[var(--text-2)]"}`}>{b.name}</span><span className="tag text-[var(--muted)]">{b.water_name}</span></div>
              <div className="italic text-[var(--text-2)] mt-0.5">{b.blurb}</div>
              <div className="num text-[11.5px] mt-1 text-[var(--text-2)]">{wtRange(b.min_kg, b.max_kg)} · {b.behavior} · <span className="text-[#ffcfa8]">{fmt(b.gold)}g</span> {tt("· title “")}{b.title}”</div>
              <div className="text-[11.5px] text-[var(--muted)] mt-0.5">
                {b.you ? <span className="text-[var(--ok)]">{tt("Slain ×")}{b.you.kills} {tt("· your best")} {wt(b.you.best)}</span> : tt("Not yet slain by you")}
                {b.record && <> {tt("· record")} <b className="text-[var(--text-2)]">{b.record.username}</b> {wt(b.record.weight)}</>}
                {" · "}{b.kills} {tt("kills server-wide")}
              </div>
              {b.you && (b.you.mounted
                ? <button className="btn btn-sm mt-1" onClick={() => mount(b, false)} data-testid={`unmount-boss-${b.id}`}>{tt("Take down plaque")}</button>
                : <button className="btn btn-sm btn-gold mt-1" onClick={() => mount(b, true)} disabled={d.mounted >= d.max_mounts} title={d.mounted >= d.max_mounts ? tt("Your wall is full") : tt("Mount your best kill on your profile")} data-testid={`mount-boss-${b.id}`}>{tt("Mount on wall")}</button>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const BossPlaque = ({ t }) => (
  <div className="border-2 border-[var(--r-legendary)] p-2 flex gap-2 relative" style={{ background: "linear-gradient(180deg, #2a2210, #171208)" }} data-testid={`boss-trophy-${t.boss_id}`}>
    <BossPlate bossId={t.boss_id} name={t.name} className="w-[120px] h-[80px] shrink-0" />
    <div className="min-w-0 text-[12px] flex-1">
      <div className="font-display text-[var(--r-legendary)] truncate">{t.name}</div>
      <div className="num text-[var(--text-2)] mt-0.5">{wt(t.weight)} · {t.water_name}</div>
      <div className="mt-1.5 inline-block px-2 py-0.5 text-[10px] tracking-widest uppercase text-[#241612] font-bold" style={{ background: "linear-gradient(180deg, #ffcfa8, #b8892e)", boxShadow: "inset 0 0 0 1px #6b4d13" }}>
        {tt("Slain")}
      </div>
    </div>
  </div>
);
