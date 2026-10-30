/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, ago } from "../../lib/api";
import { Panel } from "../ui-bits";

const KINDS = [["goldfish", "Hidden Goldfish"], ["salvage", "Shipwreck Salvage"], ["quickdraw", "Chat Quick-Draw"]];

export function RandomEvents() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/random-event").then((r) => setSt(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const start = async (kind) => {
    setBusy(true);
    try { const r = await api.post("/admin/random-event/start", { kind }); toast.success(`Started${r.data.water ? ` at ${r.data.water}` : ""}${r.data.word ? `, word: ${r.data.word}` : ""}`); load(); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  if (!st) return null;
  const a = st.active;
  return (
    <Panel title="Random events" testId="admin-random-events">
      <div className="text-[12px] space-y-3">
        {a ? (
          <div className="border border-[#1d4a44] bg-[#0f1a18] px-2 py-1.5" data-testid="admin-random-active">
            <span className="tag text-[#7fe0d0] border-[#3fb8a6] mr-2">ACTIVE</span><b>{a.name}</b>
            {a.water && <span className="text-[var(--muted)]"> · {a.water}</span>}{a.word && <span className="text-[var(--muted)]"> · word {a.word}</span>}
            <span className="text-[var(--muted)]"> · {a.winners.length} winner(s)</span>
          </div>
        ) : <div className="text-[var(--muted)]" data-testid="admin-random-next">Next random event {st.next_at ? `around ${new Date(st.next_at).toLocaleString()}` : "not scheduled yet"}</div>}
        <div className="flex flex-wrap gap-2">
          {KINDS.map(([k, n]) => <button key={k} className="btn btn-sm" disabled={busy || !!a} onClick={() => start(k)} data-testid={`admin-random-start-${k}`}>Start {n}</button>)}
        </div>
        {st.recent.length > 0 && <div className="space-y-1" data-testid="admin-random-recent">
          {st.recent.map((e) => <div key={e.start} className="text-[var(--text-2)]">{e.name} · {ago(e.start)} · {e.winners.length ? e.winners.map((w) => `${w.username} (${w.crate})`).join(", ") : "nobody won"}</div>)}
        </div>}
      </div>
    </Panel>
  );
}
