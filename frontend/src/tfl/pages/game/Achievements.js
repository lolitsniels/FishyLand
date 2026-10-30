/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { AchievementBadge } from "../../components/AchievementBadge";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Bar, Pearls } from "../../components/ui-bits";
import { t as tt } from "../../i18n";

const TIERS = [["all", "All"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["legendary", "Legendary"]];

export default function Achievements() {
  const { setUser } = useGame();
  const [d, setD] = useState(null);
  const [tier, setTier] = useState("all");
  const badges = d?.badges || [];
  const toggleBadge = async (id) => {
    const next = badges.includes(id) ? badges.filter((b) => b !== id) : [...badges, id];
    if (next.length > 3) { toast.message(tt("You can show 3 badges. Hide one first.")); return; }
    try { const r = await api.post("/achievements/badges", { ids: next }); setD({ ...d, badges: r.data.badges }); } catch (e) { toast.error(errMsg(e)); }
  };
  useEffect(() => { api.get("/achievements").then((r) => { setD(r.data); setUser(r.data.user); if (r.data.new.length) toast.success(tt("Achievement unlocked: {{v0}}", { v0: r.data.new.map((a) => a.name).join(", ") })); }).catch(() => {}); }, [setUser]);
  if (!d) return null;
  const done = d.all.filter((a) => a.unlocked).length;
  return (
    <div className="space-y-3 fade-in" data-testid="achievements-page">
      <Panel icon="achievements" title={tt("Achievements")} right={<span className="num" data-testid="achievements-progress">{done} / {d.all.length}</span>}>
        <Bar value={done} max={d.all.length} color="var(--gold)" className="!h-2" />
        <div className="mt-2 text-[11.5px] text-[var(--muted)]">{tt("Earned titles can be displayed from")} <span className="text-[var(--text-2)]">{tt("My Angler")}</span>. {tt("Press Show on up to 3 earned badges to put them on your profile")} (<span className="num text-[var(--text-2)]" data-testid="badges-shown-count">{badges.length}/3</span>).</div>
      </Panel>
      <div className="flex gap-1.5 flex-wrap" data-testid="achievement-tabs">
        {TIERS.map(([k, label]) => {
          const list = k === "all" ? d.all : d.all.filter((a) => a.tier === k);
          return (
            <button key={k} onClick={() => setTier(k)} className={`btn btn-sm ${tier === k ? "btn-gold" : ""}`} data-testid={`achievement-tab-${k}`}>
              {tt(label)} <span className="num opacity-70 ml-1">{list.filter((a) => a.unlocked).length}/{list.length}</span>
            </button>
          );
        })}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-1.5" data-testid="achievements-grid">
        {d.all.filter((a) => tier === "all" || a.tier === tier).map((a) => (
          <div key={a.id} className={`journal-cell flex gap-2 ${a.unlocked ? "discovered" : "undiscovered"}`} data-testid={`achievement-${a.id}`}>
            <div className="shrink-0 flex flex-col items-center gap-1">
              <AchievementBadge id={a.id} size={44} locked={!a.unlocked} />
              {a.unlocked && <button type="button" onClick={() => toggleBadge(a.id)} className={`text-[9.5px] px-1 border ${badges.includes(a.id) ? "border-[var(--gold)] text-[var(--gold)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"}`} data-testid={`badge-pin-${a.id}`}>{badges.includes(a.id) ? tt("Shown") : tt("Show")}</button>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><span className={`font-medium ${a.unlocked ? "text-[#f4ead2]" : ""}`}>{a.name}</span><span className="inline-flex items-center gap-2"><Gold n={a.reward} className="text-[11px]" />{a.pearls > 0 && <Pearls n={a.pearls} className="text-[11px]" data-testid={`achievement-pearls-${a.id}`} />}</span></div>
              <div className="text-[11.5px] text-[var(--text-2)]">{a.desc}</div>
              {a.title && <div className="text-[10.5px] mt-0.5 text-[#f59a5c]">{tt("Title:")} {a.title}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
