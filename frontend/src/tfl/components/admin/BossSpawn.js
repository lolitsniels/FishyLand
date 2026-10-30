/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty } from "../ui-bits";

function countdown(endIso) {
  const s = Math.max(0, Math.round((new Date(endIso).getTime() - Date.now()) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function BossSpawn() {
  const { data } = useGame();
  const [water, setWater] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const load = () => api.get("/bosses").then((r) => setActive(r.data.active)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(() => setTick((n) => n + 1), 1000); const p = setInterval(load, 15000); return () => { clearInterval(t); clearInterval(p); }; }, []);
  useEffect(() => { if (data?.waters?.length && !water) setWater(data.waters[0].key); }, [data, water]);

  const spawn = async () => {
    if (!water) return;
    setBusy(true);
    try {
      const r = await api.post("/admin/boss/spawn", { water, minutes: Number(minutes) });
      setActive(r.data);
      toast.success(`${r.data.name} stirring at ${r.data.water_name} for ${minutes} min`);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await api.post("/admin/boss/cancel");
      toast.success("Boss window ended");
      setActive(null);
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  if (!data) return null;
  return (
    <Panel title="Boss spawns" testId="admin-boss-spawn">
      <div className="text-[12px] space-y-3">
        <div>
          {active ? (
            <div className="flex flex-wrap items-center gap-2 border border-[#3a1d10] bg-[#1a110c] px-2 py-1.5 rounded-[2px]" data-testid="admin-boss-active">
              <span className="tag text-[var(--gold)] border-[var(--gold-dim)]">ACTIVE</span>
              <span className="font-medium text-[var(--gold)]">{active.name}</span>
              <span className="text-[var(--muted)]">at {active.water_name}</span>
              <span className="num text-[11px] text-[var(--text-2)] ml-auto" data-testid="admin-boss-countdown">ends in {countdown(active.end)}{tick < 0 ? "" : ""}</span>
              <button className="btn btn-sm !border-[#6b2b2b] !text-[#f0a5a3]" disabled={busy} onClick={cancel} data-testid="admin-boss-cancel-button">Cancel window</button>
            </div>
          ) : <Empty>No boss window active right now. Spawn one below.</Empty>}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label block mb-1">Water</label>
            <select className="input" value={water} onChange={(e) => setWater(e.target.value)} data-testid="admin-boss-water-select">
              {data.waters.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label block mb-1">Duration (min)</label>
            <input type="number" min={1} max={180} className="input num !w-24" value={minutes} onChange={(e) => setMinutes(e.target.value)} data-testid="admin-boss-minutes-input" />
          </div>
          <button className="btn btn-gold" disabled={busy || !water} onClick={spawn} data-testid="admin-boss-spawn-button">Spawn boss</button>
        </div>
        <p className="text-[11px] text-[var(--muted)]">Each water has one designated boss species. The window opens immediately and 25% of bites at that water hook the boss until it ends or you cancel.</p>
      </div>
    </Panel>
  );
}
