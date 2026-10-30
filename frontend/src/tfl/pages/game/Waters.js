/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Rarity, PassIcon } from "../../components/ui-bits";
import { ConditionLine, useConditions } from "../../components/Conditions";
import { ExpeditionPanel, useExpedition } from "../../components/Expedition";
import { Lock } from "lucide-react";
import { WaterProgress, useWaterProgress } from "../../components/WaterProgress";
import { t as tt } from "../../i18n";
import { NO_IAP } from "../../lib/portal";
import { CageSlot, useCages } from "../../components/CrabCages";

const MOODS = [[0.15, "Calm", "#7fc9a0"], [0.45, "Choppy", "#e0b341"], [0.8, "Rough", "#f08a45"], [2, "Wild", "#e0645a"]];
function WaterMood({ w }) {
  const [, label, col] = MOODS.find(([max]) => (w.pressure || 0) <= max);
  return (
    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[10.5px] bg-[rgba(10,9,8,.85)] px-2 py-0.5 border" style={{ borderColor: col }} data-testid={`water-mood-${w.key}`}>
      <span className="uppercase tracking-widest" style={{ color: col }}>{tt(label)}</span>
      <span className="inline-flex gap-[2px]">{[0, 0.2, 0.5, 0.85].map((s, i) => <span key={i} className="w-2 h-1.5" style={{ background: (w.pressure || 0) >= s ? col : "#2a2420" }} />)}</span>
      {w.rough_pct >= 2 && <span className="text-[var(--text-2)]">+{w.rough_pct}%</span>}
    </div>
  );
}

function TestWaterCard() {
  return (
    <section className="panel overflow-hidden border-dashed" data-testid="water-card-testwater">
      <div className="aspect-[16/9] relative flex items-center justify-center bg-[repeating-linear-gradient(135deg,#14202a_0_10px,#101a22_10px_20px)]">
        <span className="absolute top-2 left-2 text-[10.5px] uppercase tracking-widest bg-[rgba(10,9,8,.85)] text-[#f08a45] px-2 py-0.5 border border-[#f08a45]">{tt("Testers only")}</span>
        <span className="font-display text-[22px] text-[#cfe3ea] opacity-80">{tt("The Test Water")}</span>
      </div>
      <div className="p-3">
        <p className="text-[12.5px] text-[var(--text-2)]">{tt("A sandbox for new fight mechanics. No energy used, nothing is kept.")}</p>
        <div className="flex justify-end mt-3"><Link to="/game/testwater" className="btn btn-sm btn-gold" data-testid="travel-testwater-button">{tt("Open test water")}</Link></div>
      </div>
    </section>
  );
}


export default function Waters() {
  const { user, setUser, data } = useGame();
  const cond = useConditions();
  const ev = useExpedition();
  const progress = useWaterProgress();
  const [cages, reloadCages] = useCages();
  const travel = async (key) => {
    try { const r = await api.post("/waters/travel", { water: key }); setUser(r.data); toast.success(tt("You travel to {{v0}}.", { v0: data.waters.find((w) => w.key === key).name })); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-3 fade-in" data-testid="waters-page">
      <Panel icon="waters" title={tt("Waters of the world")} right={`${user.unlocked_waters.length} / ${data?.waters.length} unlocked`}>
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Each water holds its own pool of species. Passage is paid once; after that you may travel freely. Level requirements reflect how hard the local fish fight. Weather shifts every three hours; dawn and dusk bring the most bites, night brings the strangest fish, and tides matter on salt water.")}</p>
      </Panel>
      <ExpeditionPanel ev={ev} waterKey={user.water} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data?.waters.map((w) => {
          const unlocked = w.premium ? !!user.premium && user.level >= w.level : user.unlocked_waters.includes(w.key);
          const here = user.water === w.key;
          const pool = data.fish.filter((f) => f.water === w.key && !f.secret);
          const canUnlock = w.premium ? !!user.premium && user.level >= w.level : user.level >= w.level && user.gold >= w.fee;
          return (
            <section key={w.key} className={`panel overflow-hidden ${here ? "panel-gold" : ""}`} data-testid={`water-card-${w.key}`}>
              <div className="aspect-[16/9] bg-cover bg-center relative" style={{ backgroundImage: `url(/art/waters/${w.key}_thumb.jpg)`, filter: unlocked ? "none" : "grayscale(.7) brightness(.6)" }}>
                {!unlocked && <div className="absolute top-2 right-2 text-[11px] flex items-center gap-1 bg-[rgba(10,9,8,.8)] px-2 py-0.5 border border-[var(--border)]"><Lock size={11} /> {tt("Lv")} {w.level}</div>}
                {here && <div className="absolute top-2 left-2 text-[10.5px] uppercase tracking-widest bg-[rgba(10,9,8,.85)] text-[var(--gold)] px-2 py-0.5 border border-[var(--gold-dim)]">{tt("You are here")}</div>}
                {ev?.active?.water === w.key && <div className="absolute bottom-9 left-2 text-[10.5px] uppercase tracking-widest bg-[rgba(10,9,8,.85)] text-[var(--energy)] px-2 py-0.5 border border-[var(--energy)]" data-testid={`expedition-badge-${w.key}`}>{tt("Expedition active")}</div>}
                <WaterMood w={w} />
                <CageSlot water={w} here={here} unlocked={unlocked} st={cages} onChange={reloadCages} />
                {progress?.[w.key]?.complete && <div className="absolute top-2 right-2 text-[10.5px] uppercase tracking-widest bg-[rgba(10,9,8,.85)] text-[var(--gold)] px-2 py-0.5 border border-[var(--gold-dim)]" data-testid={`water-complete-${w.key}`}>{tt("Complete")}</div>}
              </div>
              <div className="p-3">
                <div className="flex items-baseline justify-between">
                  <div className="font-display text-[16px] text-[#f4ead2]">{w.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">{w.type}</div>
                </div>
                <p className="text-[12.5px] text-[var(--text-2)] mt-1">{w.desc}</p>
                <div className="mt-1.5"><ConditionLine c={cond[w.key]} /></div>
                <div className="flex items-center gap-2 mt-2 text-[11px]">
                  <span className="text-[var(--muted)]">{pool.length} {tt("species:")}</span>
                  {["common", "uncommon", "rare", "epic", "legendary", "mythic"].map((r) => <span key={r} className={`num rar-${r}`}>{pool.filter((f) => f.rarity === r).length}</span>)}
                  {data.fish.some((f) => f.cage && f.water === w.key) && <span className="text-[var(--muted)] ml-auto" data-testid={`cage-species-${w.key}`}>{tt("incl.")} {pool.filter((f) => f.cage).length} {tt("by cage")}</span>}
                </div>
                {unlocked && progress?.[w.key] && <div className="mt-2 pt-2 border-t border-[var(--border)]"><WaterProgress p={progress[w.key]} compact stamp={false} testId={`water-progress-${w.key}`} /></div>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[12px] text-[var(--text-2)]">{w.premium ? <span className="inline-flex items-center gap-1 text-[#f08a45]"><PassIcon size={12} /> {unlocked ? tt("Angler Pass water, open to you") : user.premium ? <>{tt("Angler Pass water · requires Lv")} {w.level}</> : <>{tt("Angler Pass water · Lv")} {w.level} {!NO_IAP && <> · <Link to="/game/support" className="underline">{tt("get an Angler Pass")}</Link></>}</>}</span> : unlocked ? tt("Passage paid") : w.fee === 0 ? tt("Free") : <>{tt("Passage")} <span className="num text-[#ffcfa8]">{fmt(w.fee)}g</span> {tt("· requires Lv")} {w.level}</>}</span>
                  {here ? <Link to="/game/fish" className="btn btn-sm btn-gold" data-testid={`fish-here-${w.key}-button`}>{tt("Fish here")}</Link>
                    : <button className={`btn btn-sm ${unlocked || canUnlock ? "btn-gold" : ""}`} disabled={!unlocked && !canUnlock} onClick={() => travel(w.key)} data-testid={`travel-${w.key}-button`}>{unlocked ? tt("Travel") : w.premium ? (user.premium ? tt("Locked") : tt("Angler Pass only")) : canUnlock ? tt("Pay passage & travel") : tt("Locked")}</button>}
                </div>
              </div>
            </section>
          );
        })}
        {user.test_water && <TestWaterCard />}
      </div>
    </div>
  );
}
