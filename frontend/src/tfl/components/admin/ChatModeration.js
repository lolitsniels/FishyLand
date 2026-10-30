/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api, errMsg, ago } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

const when = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function ChatModeration({ onPickPlayer }) {
  const [channel, setChannel] = useState("global");
  const [q, setQ] = useState("");
  const [crewId, setCrewId] = useState("");
  const [crews, setCrews] = useState([]);
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const fetch = (before) => api.get("/admin/chat", { params: { channel, q, crew_id: channel === "crew" ? crewId : "", before: before || "" } });
  const load = () => fetch().then((r) => { setRows(r.data.rows); setMore(r.data.more); setCrews(r.data.crews); }).catch((e) => toast.error(errMsg(e)));
  const older = async () => {
    if (!rows.length || busy) return;
    setBusy(true);
    try { const r = await fetch(rows[rows.length - 1].at); setRows((rs) => [...rs, ...r.data.rows]); setMore(r.data.more); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [channel, crewId]); // eslint-disable-line
  const remove = async (m) => {
    try { await api.delete(`/admin/chat/${m.id}`); setRows((rs) => rs.filter((x) => x.id !== m.id)); toast.success("Message removed"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel title="Chat moderation" right={
      <span className="flex gap-1">{["global", "trade", "crew"].map((c) => <button key={c} onClick={() => { setChannel(c); setCrewId(""); }} data-testid={`admin-chat-tab-${c}`} className={`px-2 py-0.5 text-[10.5px] uppercase tracking-wider border rounded-[2px] ${channel === c ? "border-[var(--gold-dim)] text-[var(--gold)]" : "border-transparent text-[var(--muted)]"}`}>{c}</button>)}</span>
    } bodyClass="!p-0" testId="admin-chat-panel">
      <div className="flex flex-wrap gap-1 p-2 border-b border-[var(--border)]">
        <input className="input flex-1 min-w-[160px]" placeholder="Filter by name or text..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} data-testid="admin-chat-search-input" />
        {channel === "crew" && (
          <select className="input !w-auto" value={crewId} onChange={(e) => setCrewId(e.target.value)} data-testid="admin-chat-crew-select">
            <option value="">All crews</option>
            {crews.map((c) => <option key={c.id} value={c.id}>{c.tag ? `[${c.tag}] ` : ""}{c.name}</option>)}
          </select>
        )}
        <button className="btn btn-sm" onClick={load} data-testid="admin-chat-search-button">Search</button>
      </div>
      {rows.length === 0 ? <Empty>No messages.</Empty> : (
        <div className="overflow-x-auto max-w-full"><table className="table min-w-[560px]"><tbody>
          {rows.map((m) => (
            <tr key={m.id} data-testid={`admin-chat-row-${m.id}`}>
              <td className="text-[11px] text-[var(--muted)] whitespace-nowrap" title={when(m.at)}>{ago(m.at)}</td>
              {channel === "crew" && <td className="whitespace-nowrap text-[11px]"><button className="text-[#8fd0f0] hover:text-[var(--gold)]" onClick={() => setCrewId(m.crew_id)} title="Only this crew" data-testid={`admin-chat-crew-${m.id}`}>{m.crew ? `[${m.crew.tag || "-"}] ${m.crew.name}` : <span className="text-[var(--muted)]">disbanded crew</span>}</button></td>}
              <td className="whitespace-nowrap"><button className="hover:text-[var(--gold)] font-medium" onClick={() => onPickPlayer(m.username)} data-testid={`admin-chat-user-${m.id}`}>{m.username}</button></td>
              <td className="text-[var(--text-2)]">{m.text}</td>
              <td className="r"><button className="text-[var(--muted)] hover:text-[#f0a5a3]" title="Delete message" onClick={() => remove(m)} data-testid={`admin-chat-delete-${m.id}`}><X size={13} /></button></td>
            </tr>
          ))}
        </tbody></table></div>
      )}
      <div className="flex items-center justify-between px-2 py-1.5 border-t border-[var(--border)] text-[11px] text-[var(--muted)]">
        <span data-testid="admin-chat-count">{rows.length} shown{rows.length ? ` · oldest ${when(rows[rows.length - 1].at)}` : ""} · full history is kept, nothing is pruned</span>
        {more && <button className="btn btn-sm" disabled={busy} onClick={older} data-testid="admin-chat-older">Load older</button>}
      </div>
    </Panel>
  );
}
