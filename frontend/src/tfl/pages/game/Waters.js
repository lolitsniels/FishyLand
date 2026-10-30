/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
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

const MOODS = [[0.15, "Calm", "#7fc9a0"], [0.45, "Choppy", "#e0b341"], [0.8, "Rough", "#f08a45"], [2, "Wild", "#e0645a"]];
function WaterMood({ w }) {
  const [, label, col] = MOODS.find(([max]) => (w.pressure || 0) <= max);
  return (
    <div className="flex items-center gap-1.5 text-[10.5px] bg-[rgba(10,9,8,.85)] px-2 py-0.5 border rounded-full" style={{ borderColor: col }} data-testid={`water-mood-${w.key}`}>
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


import { WorldMap } from "../../components/WorldMap";

export default function Waters() {
  const { user, setUser, data } = useGame();
  const cond = useConditions();
  const ev = useExpedition();
  const progress = useWaterProgress();
  const travel = async (key) => {
    try { const r = await api.post("/waters/travel", { water: key }); setUser(r.data); toast.success(tt("You travel to {{v0}}.", { v0: data.waters.find((w) => w.key === key).name })); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-3 fade-in" data-testid="waters-page">
      <div className="wm-banner" data-testid="expedition-banner"><ExpeditionPanel ev={ev} waterKey={user.water} /></div>
      {data && <WorldMap waters={data.waters} user={user} mode={sessionStorage.getItem("fr_mode") || "harbour"} onTravel={travel} expedition={ev?.active?.water} />}
    </div>
  );
}
