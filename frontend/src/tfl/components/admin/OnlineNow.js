/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api, ago } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

export const flagOf = (cc) => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "");

export function OnlineNow({ onPick }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const load = () => api.get("/admin/online").then((r) => setRows(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <Panel title={`Online now${rows ? ` · ${rows.length}` : ""}`} bodyClass="!p-0" testId="admin-online">
      {!rows ? <Empty>Loading...</Empty> : rows.length === 0 ? <Empty>Nobody is on the water right now.</Empty> : (
        <div className="overflow-x-auto"><table className="table"><thead><tr><th>Angler</th><th>Country</th><th>Platform</th><th>Came from</th><th>Water</th><th className="r">Seen</th></tr></thead><tbody>
          {rows.map((p) => (
            <tr key={p.id} className="cursor-pointer" onClick={() => onPick(p.username)} data-testid={`admin-online-${p.username}`}>
              <td className="whitespace-nowrap">{p.username}{p.is_guest && <span className="tag ml-1">guest</span>} <span className="num text-[var(--muted)] text-[11px]">Lv {p.level}</span></td>
              <td className="whitespace-nowrap" title={p.ip || ""} data-testid={`admin-online-country-${p.username}`}>{p.cc ? <><span className="text-[15px] mr-1">{flagOf(p.cc)}</span>{p.country}</> : <span className="text-[var(--muted)]">unknown</span>}</td>
              <td className="text-[12px] text-[var(--text-2)] whitespace-nowrap" data-testid={`admin-online-platform-${p.username}`}>{p.platform || <span className="text-[var(--muted)]">unknown</span>}</td>
              <td className="text-[12px] whitespace-nowrap" data-testid={`admin-online-source-${p.username}`}>{p.source && p.source !== "unknown" ? <span className="tag">{p.source}</span> : <span className="text-[var(--muted)]">unknown</span>}</td>
              <td className="text-[12px] text-[var(--text-2)] whitespace-nowrap">{p.water || "-"}</td>
              <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{ago(p.last_seen)}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </Panel>
  );
}
