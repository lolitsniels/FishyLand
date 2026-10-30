import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SOCIAL_NETS as NETS } from "../../lib/socials";
import { api, errMsg } from "../../lib/api";
import { Panel } from "../ui-bits";

export function SocialLinks() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/admin/social").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  const set = (n, k, v) => setD((x) => ({ ...x, [n]: { ...x[n], [k]: v } }));
  const save = async () => {
    setBusy(true);
    try { const r = await api.put("/admin/social", d); setD(r.data); toast.success("Social links saved"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Panel title="Social media buttons" testId="admin-social-panel">
      {!d ? <div className="text-[12px] text-[var(--muted)]">Loading...</div> : (
        <div className="space-y-3">
          <p className="text-[12px] text-[var(--text-2)]">Buttons appear in the game header when turned on, in this order. On phones only the first 3 that are turned on show, to keep the header tidy.</p>
          {NETS.map(([n, label, Icon, color, ph]) => (
            <div key={n} className="flex flex-wrap items-center gap-2" data-testid={`admin-social-${n}`}>
              <span className="w-7 h-7 inline-flex items-center justify-center rounded-[3px] text-white" style={{ background: n === "x" ? "#000" : color }}><Icon size={14} /></span>
              <span className="w-20 text-[13px]">{label}</span>
              <input className="input flex-1 min-w-[220px]" placeholder={ph} value={d[n].url} onChange={(e) => set(n, "url", e.target.value)} data-testid={`admin-social-${n}-url`} />
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="checkbox" checked={d[n].on} onChange={(e) => set(n, "on", e.target.checked)} data-testid={`admin-social-${n}-on`} /> Show in game
              </label>
            </div>
          ))}
          <button className="btn btn-sm btn-gold" disabled={busy} onClick={save} data-testid="admin-social-save">Save</button>
        </div>
      )}
    </Panel>
  );
}
