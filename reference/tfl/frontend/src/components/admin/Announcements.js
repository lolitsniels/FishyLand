/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, ago } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

export function Announcements() {
  const [text, setText] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [rows, setRows] = useState([]);
  const load = () => api.get("/admin/announcements").then((r) => setRows(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const send = async () => {
    try { await api.post("/admin/announce", { text, minutes: Number(minutes) }); toast.success("Announcement posted"); setText(""); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const end = async (a) => {
    try { await api.delete(`/admin/announcements/${a.id}`); toast.success("Announcement ended"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel title="Server announcement" testId="admin-announce-panel">
      <p className="text-[12px] text-[var(--text-2)] mb-2">Shows as a gold Harbourmaster's notice banner to every angler in the game for the chosen time, and posts a line to the world feed.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[240px]"><label className="label block mb-1">Message</label><input className="input" placeholder="Server restarts at 20:00 UTC..." value={text} onChange={(e) => setText(e.target.value)} maxLength={240} data-testid="admin-announce-input" /></div>
        <div><label className="label block mb-1">Show for</label><select className="input" value={minutes} onChange={(e) => setMinutes(e.target.value)} data-testid="admin-announce-minutes">{[["10", "10 min"], ["30", "30 min"], ["60", "1 hour"], ["180", "3 hours"], ["720", "12 hours"], ["1440", "24 hours"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <button className="btn btn-gold" disabled={!text.trim()} onClick={send} data-testid="admin-announce-button">Broadcast</button>
      </div>
      <div className="mt-3">
        <div className="label mb-1">Recent announcements</div>
        {rows.length === 0 ? <Empty>None yet.</Empty> : (
          <table className="table"><tbody>
            {rows.map((a) => <tr key={a.id} data-testid={`admin-announcement-${a.id}`}><td className="text-[11px] text-[var(--muted)] whitespace-nowrap">{ago(a.at)}</td><td className="text-[var(--text-2)]">{a.text}</td><td className="r whitespace-nowrap">{a.active ? <button className="btn btn-sm" onClick={() => end(a)} data-testid={`admin-announcement-end-${a.id}`}>End now</button> : <span className="text-[var(--muted)] text-[11px]">ended</span>}</td></tr>)}
          </tbody></table>
        )}
      </div>
    </Panel>
  );
}
