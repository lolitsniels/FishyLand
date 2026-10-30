import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, ago, fmt } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

function History({ rows }) {
  if (!rows.length) return <Empty>No mail-outs sent yet.</Empty>;
  return (
    <table className="table" data-testid="mailout-history">
      <thead><tr><th>Subject</th><th>By</th><th>When</th><th className="r">Sent</th><th className="r">Failed</th><th className="r">Status</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.subject}</td><td>{r.by}</td><td>{ago(r.at)}</td><td className="num r">{fmt(r.sent)}/{fmt(r.total)}</td><td className="num r">{r.failed}</td><td className="r">{r.status}</td></tr>)}</tbody>
    </table>
  );
}

export function MailOut() {
  const [d, setD] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const load = (fill) => api.get("/admin/mailout").then((r) => { setD(r.data); if (fill) { setSubject(r.data.template.subject); setBody(r.data.template.body); } }).catch(() => {});
  useEffect(() => { load(true); const t = setInterval(() => load(false), 5000); return () => clearInterval(t); }, []);
  const post = async (path, ok) => {
    setBusy(true);
    try { const r = await api.post(path, { subject, body }); toast.success(ok(r.data)); load(false); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const sendAll = () => { if (window.confirm(`Send "${subject}" to ${d.recipients} players now? This cannot be undone.`)) post("/admin/mailout/send", (r) => `Sending to ${r.total} players`); };
  if (!d) return <Panel title="Email all players"><Empty>Loading...</Empty></Panel>;
  const sending = d.history.some((h) => h.status === "sending");
  return (
    <div className="space-y-3">
      <Panel title="Email all players" right={<span data-testid="mailout-recipients">{fmt(d.recipients)} players with an email</span>} testId="admin-mailout-panel">
        {!d.configured && <div className="text-[12px] text-[#f0a5a3] mb-2">Email sending is not set up on this server.</div>}
        <label className="label block mb-1">Subject</label>
        <input className="input mb-2" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} data-testid="mailout-subject" />
        <label className="label block mb-1">Message</label>
        <textarea className="input min-h-[300px] font-mono text-[12px]" value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} data-testid="mailout-body" />
        <p className="text-[11px] text-[var(--muted)] mt-1">{"{username}"} becomes each player's name. **text** is bold, lines starting with "- " become a list, blank lines start a new paragraph.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-sm" disabled={busy || !d.test_to} onClick={() => post("/admin/mailout/test", (r) => `Test sent to ${r.to}`)} data-testid="mailout-test-button">Send test to {d.test_to || "me"}</button>
          <button className="btn btn-sm btn-gold" disabled={busy || sending || !d.configured} onClick={sendAll} data-testid="mailout-send-button">{sending ? "Sending..." : `Send to all ${fmt(d.recipients)} players`}</button>
        </div>
      </Panel>
      <Panel title="Sent mail-outs" testId="admin-mailout-history"><History rows={d.history} /></Panel>
    </div>
  );
}
