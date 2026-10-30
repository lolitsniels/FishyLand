/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api, ago } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

const REASON = {
  landed_too_fast: "server clock: finished faster than the fish allows", bad_telemetry: "forged telemetry", bad_interval: "forged telemetry",
  "soft:no_telemetry": "no button telemetry", "soft:over_time_limit": "fight ran past the time limit (slow phone / screen lock)", "soft:game_time_over_wall": "odd fight clock",
  "soft:elapsed_too_short": "reported time shorter than the fish allows", "soft:hold_over_elapsed": "hold times past the end of the fight",
  "soft:held_constantly": "held the whole fight", "soft:hold_ratio_low": "barely held at all",
  elapsed_too_short: "old rule: finished faster than allowed", elapsed_over_limit: "old rule: time over the limit", no_telemetry: "old rule: no telemetry",
  bad_interval_bounds: "old rule: forged telemetry", overlapping_intervals: "old rule: forged telemetry", hold_over_elapsed: "old rule: forged telemetry",
  elapsed_age_mismatch: "old rule: client/server time mismatch", too_few_transitions: "old rule: too few toggles (retired)",
};
const labels = (r) => String(r || "").split(",").map((x) => REASON[x] || x).join(", ");

export function CheatLog({ onPickPlayer }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/admin/cheat-log").then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return <Empty>Loading...</Empty>;
  return (
    <div className="space-y-3" data-testid="admin-cheat-log">
      <Panel title="Flagged anglers · last 7 days" right={<span className="text-[11px] text-[var(--muted)]">hard = fish refused · soft = logged only</span>} bodyClass="!p-0" testId="cheat-anglers">
        {d.anglers.length === 0 ? <Empty>No flagged fights this week. Clean docks.</Empty> : (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Angler</th><th className="r">Hard</th><th className="r">Soft</th><th className="r">Catches</th><th>Reasons</th><th className="r">Last</th></tr></thead><tbody>
            {d.anglers.map((a) => (
              <tr key={a.username} className={`cursor-pointer ${a.hard >= 3 ? "bg-[rgba(217,83,79,.12)]" : ""}`} onClick={() => onPickPlayer(a.username)} data-testid={`cheat-angler-${a.username}`}>
                <td className="whitespace-nowrap">{a.username}</td>
                <td className={`num r ${a.hard ? "text-[#f0a5a3]" : "text-[var(--muted)]"}`}>{a.hard}</td>
                <td className="num r text-[var(--text-2)]">{a.soft}</td>
                <td className="num r text-[var(--text-2)]">{a.catches}</td>
                <td className="text-[11px] text-[var(--text-2)]">{a.reasons.map(labels).join(", ")}</td>
                <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{ago(a.last)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Panel>
      <Panel title="Latest flagged fights" bodyClass="!p-0" testId="cheat-recent">
        {d.recent.length === 0 ? <Empty>Nothing flagged yet.</Empty> : (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Angler</th><th>Fish</th><th>Why</th><th className="r">Fight</th><th className="r">Server</th><th className="r">Holds</th><th className="r">When</th></tr></thead><tbody>
            {d.recent.map((c, i) => (
              <tr key={i} data-testid={`cheat-row-${i}`}>
                <td className="whitespace-nowrap cursor-pointer" onClick={() => onPickPlayer(c.username)}>{c.username}</td>
                <td className="text-[12px]">{c.species}</td>
                <td className={`text-[11px] ${c.hard ? "text-[#f0a5a3]" : "text-[var(--muted)]"}`}>{c.hard ? "refused" : "logged"} · {labels(c.reason)}</td>
                <td className="num r">{c.elapsed}s</td><td className="num r text-[var(--text-2)]">{c.age}s</td><td className="num r text-[var(--text-2)]">{c.holds}</td>
                <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{ago(c.at)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Panel>
      <div className="text-[11.5px] text-[var(--muted)]">A real botter shows many <b>hard</b> refusals against a big catch count, or dozens of "held the whole fight" entries. One or two soft flags on a normal angler is just an odd fight.</div>
    </div>
  );
}
