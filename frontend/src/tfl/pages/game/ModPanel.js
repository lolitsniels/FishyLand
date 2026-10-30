/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, ago, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty } from "../../components/ui-bits";
import { Suspicious } from "../../components/admin/Suspicious";

const STAT_LABELS = [["players", "Total players"], ["online", "Online now"], ["new_today", "New accounts today"], ["guests_today", "Guests today"], ["muted", "Muted"], ["banned", "Banned"], ["fish_caught", "Fish caught"]];
const STANDING = { good: ["Good standing", "text-[#8fd18f]"], watch: ["Under watch", "text-[#f0c27a]"], bad: ["Bad standing", "text-[#f0a5a3]"] };
const fmtUntil = (s) => (s ? new Date(s).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "permanent");

function Stats({ o, onSlow }) {
  if (!o) return null;
  return (
    <Panel icon="rankings" title="Harbour at a glance" testId="mod-stats" right={<SlowToggle until={o.slow_until} onChange={onSlow} />}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {STAT_LABELS.map(([k, l]) => (
          <div key={k} className="border border-[var(--border)] bg-[var(--bg-deep)] rounded-[2px] px-2 py-1.5" data-testid={`mod-stat-${k}`}>
            <div className="label">{l}</div><div className="num text-[16px] text-[#f4ead2]">{fmt(o[k])}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SlowToggle({ until, onChange }) {
  const set = async (on) => {
    try { const r = await api.post("/mod/slowmode", { on }); onChange(r.data.slow_until); toast.success(on ? "Slow mode on for 10 minutes" : "Slow mode off"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return until
    ? <span className="inline-flex items-center gap-2" data-testid="mod-slow-active"><span className="text-[#f0c27a]">Slow mode until {new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><button className="btn btn-sm" onClick={() => set(false)} data-testid="mod-slow-off">Turn off</button></span>
    : <button className="btn btn-sm" onClick={() => set(true)} title="Players can post once every 30 s in global and trade for 10 minutes" data-testid="mod-slow-on">Slow mode (10 min)</button>;
}

function Sanction({ label, s, onLift, testId }) {
  if (!s) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]" data-testid={testId}>
      <span className="tag text-[#f0a5a3]">{label}</span><span>until {fmtUntil(s.until)}</span>
      {s.reason && <span className="text-[var(--muted)]">"{s.reason}"</span>}<span className="text-[var(--muted)]">by {s.by}</span>
      {s.liftable ? <button className="btn btn-sm" onClick={onLift} data-testid={`${testId}-lift`}>Lift</button> : <span className="text-[var(--muted)] italic">set by the owner</span>}
    </div>
  );
}

function PlayerActions({ p, reload }) {
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(1);
  const act = async (path, body, ok) => {
    try { await api.post(`/mod/${path}`, { username: p.username, reason, ...body }); toast.success(ok); setReason(""); reload(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  if (p.staff) return <Empty>Staff accounts can't be moderated here.</Empty>;
  return (
    <div className="space-y-2">
      <Sanction label="muted" s={p.mute} testId="mod-player-mute" onLift={() => act("unmute", {}, "Mute lifted")} />
      <Sanction label="banned" s={p.ban} testId="mod-player-ban" onLift={() => act("unban", {}, "Ban lifted")} />
      <input className="input" placeholder="Reason (shown to the player)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="mod-reason-input" />
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="btn btn-sm" onClick={() => act("warn", {}, `${p.username} warned`)} data-testid="mod-warn-button">Warn</button>
        <span className="w-px h-5 bg-[var(--border)] mx-1" />
        <select className="input !w-auto !py-1" value={hours} onChange={(e) => setHours(+e.target.value)} data-testid="mod-mute-hours">
          {[1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => act("mute", { hours }, `${p.username} muted for ${hours} h`)} data-testid="mod-mute-button">Mute</button>
        <span className="w-px h-5 bg-[var(--border)] mx-1" />
        <button className="btn btn-sm !text-[#f0a5a3]" onClick={() => act("ban", { days: 1 }, `${p.username} banned for 1 day`)} data-testid="mod-ban-day-button">Ban 1 day</button>
        <button className="btn btn-sm !text-[#f0a5a3]" onClick={() => act("ban", { days: 7 }, `${p.username} banned for 1 week`)} data-testid="mod-ban-week-button">Ban 1 week</button>
      </div>
    </div>
  );
}

function History({ rows }) {
  if (!rows.length) return <Empty>Clean record. No warnings, mutes or bans.</Empty>;
  return (
    <ul className="text-[12px] divide-y divide-[#221e1b] max-h-60 overflow-y-auto scrollbar-thin" data-testid="mod-player-history">
      {rows.map((h, i) => <li key={i} className="py-1 flex gap-2"><span className="tag shrink-0">{h.action.replace("_", " ")}</span><span className="min-w-0 flex-1 break-words">{h.what}</span><span className="text-[var(--muted)] shrink-0">{h.by} · {ago(h.at)}</span></li>)}
    </ul>
  );
}

function PlayerLookup({ name, setName, onDone }) {
  const [p, setP] = useState(null);
  const load = (n = name) => n.trim() && api.get(`/mod/player/${encodeURIComponent(n.trim())}`).then((r) => setP(r.data)).catch((e) => { setP(null); toast.error(errMsg(e)); });
  useEffect(() => { if (name) load(name); }, [name]); // eslint-disable-line
  const [q, setQ] = useState("");
  const reload = () => { load(p.username); onDone(); };
  return (
    <Panel icon="angler" title="Player lookup" testId="mod-player-panel">
      <div className="flex gap-1 mb-3"><input className="input" placeholder="Angler name..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setName(q) } data-testid="mod-player-search" /><button className="btn btn-sm" onClick={() => (q === name ? load(q) : setName(q))} data-testid="mod-player-search-button">Look up</button></div>
      {!p ? <Empty>Look up an angler, or click a name in the chat log.</Empty> : (
        <div className="space-y-3" data-testid="mod-player-card">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Link to={`/game/profile/${p.username}`} className="font-display text-[17px] text-[#f4ead2] hover:underline" data-testid="mod-player-name">{p.username}</Link>
            <span className={`text-[12px] font-medium ${STANDING[p.standing][1]}`} data-testid="mod-player-standing">{STANDING[p.standing][0]}</span>
            <span className="text-[11.5px] text-[var(--muted)]">Lv {p.level} · {fmt(p.catches)} catches · joined {ago(p.joined)} · seen {p.last_seen ? ago(p.last_seen) : "never"}{p.is_guest ? " · guest" : ""}</span>
          </div>
          <PlayerActions p={p} reload={reload} />
          <div><div className="label mb-1">History</div><History rows={p.history} /></div>
        </div>
      )}
    </Panel>
  );
}

function ChatWatch({ onPick }) {
  const [channel, setChannel] = useState("global");
  const [rows, setRows] = useState([]);
  const load = () => api.get("/mod/chat", { params: { channel } }).then((r) => setRows(r.data.rows)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [channel]); // eslint-disable-line
  const del = async (m) => {
    try { await api.delete(`/mod/chat/${m.id}`); setRows((rs) => rs.filter((x) => x.id !== m.id)); toast.success("Message removed"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel icon="messages" title="Chat log" testId="mod-chat-panel" right={<span className="inline-flex gap-1">{["global", "trade"].map((c) => <button key={c} className={`btn btn-sm ${channel === c ? "btn-gold" : ""}`} onClick={() => setChannel(c)} data-testid={`mod-chat-tab-${c}`}>{c}</button>)}</span>}>
      {!rows.length ? <Empty>No messages.</Empty> : (
        <ul className="text-[12px] max-h-[420px] overflow-y-auto scrollbar-thin divide-y divide-[#221e1b]">
          {rows.map((m) => (
            <li key={m.id} className="py-1 flex items-start gap-2" data-testid={`mod-chat-row-${m.id}`}>
              <button className="btn btn-sm !px-1.5 shrink-0" title="Delete message" onClick={() => del(m)} data-testid={`mod-chat-delete-${m.id}`}>Delete</button>
              <span className="text-[var(--muted)] num shrink-0">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="min-w-0 flex-1 break-words"><button className="font-medium text-[#c8bfb5] hover:underline" onClick={() => onPick(m.username)} data-testid={`mod-chat-user-${m.id}`}>{m.username}</button>: {m.item && <span className="tag mr-1">{m.item}</span>}{m.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Reports({ onPick, onChange }) {
  const [rows, setRows] = useState([]);
  const load = () => api.get("/mod/reports").then((r) => { setRows(r.data.rows); window.dispatchEvent(new CustomEvent("reports-open", { detail: r.data.rows.length })); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const act = async (r, action) => {
    try { await api.post(`/mod/reports/${r.id}`, { action }); toast.success(action === "delete" ? "Message removed" : "Report dismissed"); onChange(); }
    catch (e) { toast.error(errMsg(e)); }
    load();
  };
  return (
    <Panel icon="bell" title={`Chat reports${rows.length ? ` (${rows.length})` : ""}`} testId="mod-reports">
      {!rows.length ? <Empty>No open reports. Calm waters.</Empty> : (
        <ul className="text-[12px] divide-y divide-[#221e1b] max-h-[360px] overflow-y-auto scrollbar-thin">
          {rows.map((r) => (
            <li key={r.id} className="py-1.5 space-y-1" data-testid={`mod-report-${r.id}`}>
              <div className="break-words"><span className={`tag mr-1 ${r.channel === "private" ? "text-[#f0c27a]" : ""}`}>{r.channel}</span><button className="font-medium text-[#c8bfb5] hover:underline" onClick={() => onPick(r.username)} data-testid={`mod-report-user-${r.id}`}>{r.username}</button>{r.to && <span className="text-[var(--muted)]"> to {r.to}</span>}: {r.item && <span className="tag mr-1">{r.item}</span>}<span className="text-[var(--text-2)]">{r.text}</span></div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[var(--muted)] mr-auto" title={r.reporters.join(", ")} data-testid={`mod-report-count-${r.id}`}>{r.reporters.length} report{r.reporters.length > 1 ? "s" : ""} · sent {ago(r.msg_at)}</span>
                <button className="btn btn-sm !text-[#f0a5a3]" onClick={() => act(r, "delete")} data-testid={`mod-report-delete-${r.id}`}>Delete message</button>
                <button className="btn btn-sm" onClick={() => act(r, "dismiss")} data-testid={`mod-report-dismiss-${r.id}`}>Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StaffChat() {
  const [rows, setRows] = useState([]);
  const [text, setText] = useState("");
  const box = useRef(null);
  const load = () => api.get("/mod/staff-chat").then((r) => setRows(r.data.rows)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, []);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [rows.length]);
  const send = async () => {
    if (!text.trim()) return;
    try { await api.post("/mod/staff-chat", { text }); setText(""); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel icon="crews" title="Staff chat" testId="mod-staff-chat">
      <div ref={box} className="h-64 overflow-y-auto scrollbar-thin text-[12.5px] space-y-1 mb-2" data-testid="mod-staff-chat-log">
        {!rows.length ? <Empty>Only admins and MODs can read this. Say hello.</Empty> : rows.map((m) => (
          <div key={m.id}><span className="num text-[10px] text-[var(--muted)] mr-1">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className={`font-medium ${m.system ? "text-[#f0c27a]" : m.owner ? "text-[#ffb3b0]" : "text-[#7fd6b8]"}`}>{m.username}</span>: <span className="text-[var(--text-2)] break-words">{m.text}</span></div>
        ))}
      </div>
      <div className="flex gap-1"><input className="input" maxLength={400} placeholder="Message the staff..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} data-testid="mod-staff-chat-input" /><button className="btn btn-sm btn-gold" onClick={send} data-testid="mod-staff-chat-send">Send</button></div>
    </Panel>
  );
}

export default function ModPanel() {
  const { user } = useGame();
  const [o, setO] = useState(null);
  const [name, setName] = useState("");
  const staff = user.is_mod || user.is_admin;
  const loadO = () => api.get("/mod/overview").then((r) => setO(r.data)).catch(() => {});
  useEffect(() => { if (staff) loadO(); }, [staff]); // eslint-disable-line
  if (!staff) return <Empty>Staff only.</Empty>;
  return (
    <div className="space-y-3 fade-in pb-16" data-testid="mod-page">
      <Stats o={o} onSlow={(until) => setO({ ...o, slow_until: until })} />
      <Reports onPick={setName} onChange={loadO} />
      <div className="grid lg:grid-cols-2 gap-3">
        <PlayerLookup name={name} setName={setName} onDone={loadO} />
        <StaffChat />
      </div>
      <ChatWatch onPick={(n) => { setName(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      <Suspicious onPickPlayer={(n) => { setName(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      <p className="text-[11px] text-[var(--muted)]">MODs can mute for up to 6 hours and ban for 1 day or 1 week. Every action is logged for the owner.</p>
    </div>
  );
}
