/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { api, errMsg, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty } from "../../components/ui-bits";
import { t as tt } from "../../i18n";

export default function Messages() {
  const { username } = useParams();
  const { user } = useGame();
  const nav = useNavigate();
  const [convs, setConvs] = useState([]);
  const [thread, setThread] = useState(null);
  const [reported, setReported] = useState(() => new Set());
  const reportPm = async (m) => {
    if (reported.has(m.id)) return;
    try { await api.post(`/messages/report/${m.id}`); setReported((s) => new Set(s).add(m.id)); toast.success(tt("Reported. Thanks, the staff will take a look.")); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const box = useRef(null);
  const loadConvs = () => api.get("/messages").then((r) => setConvs(r.data)).catch(() => {});
  const loadThread = () => username && api.get(`/messages/${username}`).then((r) => setThread(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { loadConvs(); const t = setInterval(loadConvs, 10000); return () => clearInterval(t); }, []);
  useEffect(() => { setThread(null); loadThread(); const t = setInterval(loadThread, 6000); return () => clearInterval(t); }, [username]); // eslint-disable-line
  const stick = useRef(true);
  const lastId = useRef(null);
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 40; };
  useEffect(() => {
    const msgs = thread?.messages || [];
    const newest = msgs.length ? msgs[msgs.length - 1].id : null;
    const changed = newest !== lastId.current;
    if (changed && box.current && (stick.current || lastId.current === null)) box.current.scrollTop = box.current.scrollHeight;
    if (changed) lastId.current = newest;
  }, [thread]);
  useEffect(() => { lastId.current = null; stick.current = true; }, [username]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api.post(`/messages/${username}`, { text }); setText(""); loadThread(); loadConvs(); } catch (ex) { toast.error(errMsg(ex)); }
  };
  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-3 fade-in" data-testid="messages-page">
      <Panel icon="chat" title={tt("Conversations")} bodyClass="!p-0" testId="conversations">
        <form className="flex border-b border-[var(--border)]" onSubmit={(e) => { e.preventDefault(); if (to.trim()) { nav(`/game/messages/${to.trim()}`); setTo(""); } }}>
          <input className="input !border-0 !bg-transparent" placeholder={tt("Whisper to angler...")} value={to} onChange={(e) => setTo(e.target.value)} data-testid="new-message-input" />
          <button className="btn btn-sm !border-0 !rounded-none" data-testid="new-message-button">{tt("Open")}</button>
        </form>
        {convs.length === 0 ? <Empty>{tt("No whispers yet.")}</Empty> : (
          <ul>
            {convs.map((c) => (
              <li key={c.partner}>
                <button onClick={() => nav(`/game/messages/${c.partner}`)} className={`w-full text-left px-3 py-2 border-b border-[#221e1b] hover:bg-[var(--panel-2)] ${username === c.partner ? "bg-[var(--panel-2)]" : ""}`} data-testid={`conv-${c.partner}`}>
                  <div className="flex justify-between items-center"><span className="font-medium text-[13px]">{c.partner}</span>{c.unread > 0 && <span className="num text-[10px] px-1.5 bg-[var(--gold)] text-black rounded-sm" data-testid={`conv-unread-${c.partner}`}>{c.unread}</span>}</div>
                  <div className="text-[11.5px] text-[var(--muted)] truncate">{c.from === user.username ? tt("You: ") : ""}{c.last} · {ago(c.at)}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel icon="messages" title={username ? `Whispers with ${username}` : tt("Private messages")} right={username && username.toLowerCase() !== "harbourmaster" && <button className="underline" onClick={() => nav(`/game/profile/${username}`)}>{tt("view profile")}</button>} bodyClass="!p-0" testId="thread-panel">
        {!username ? <Empty>{tt("Pick a conversation or open a new one. You can also message anglers from their profile or a market listing.")}</Empty> : !thread ? <Empty>{tt("Loading...")}</Empty> : (
          <>
            <div ref={box} onScroll={onScroll} className="h-[420px] overflow-auto p-3 space-y-2 text-[13px]" data-testid="thread-messages">
              {thread.messages.length === 0 && <Empty>{tt("Say hello.")}</Empty>}
              {thread.messages.map((m, i) => (
                <div key={i} className={`max-w-[75%] ${m.from === user.username ? "ml-auto text-right" : ""}`}>
                  <div className={`inline-block px-2.5 py-1.5 border ${m.from === user.username ? "border-[var(--gold-dim)] bg-[#1f1714]" : m.from === "Harbourmaster" ? "border-[var(--gold-dim)] bg-[#1e1a10] text-[#ffcfa8]" : "border-[var(--border)] bg-[var(--bg-2)]"}`}>{m.text}</div>
                  <div className="text-[10.5px] text-[var(--muted)] mt-0.5">{m.from} · {ago(m.at)}{m.id && m.from !== user.username && !thread.system && <button className={`ml-1.5 align-middle ${reported.has(m.id) ? "text-[#f0a5a3]" : "hover:text-[#f0c27a]"}`} title={reported.has(m.id) ? tt("Reported") : tt("Report message")} onClick={() => reportPm(m)} data-testid={`pm-report-${m.id}`}><Flag size={10} className="inline" /></button>}</div>
                </div>
              ))}
            </div>
            {thread.system ? (
              <div className="border-t border-[var(--border)] px-3 py-2 text-[11.5px] text-[var(--muted)] italic" data-testid="system-thread-note">{tt("The Harbourmaster only sends notices, replies aren't read.")}</div>
            ) : (
              <form onSubmit={send} className="flex border-t border-[var(--border)]">
                <input className="input !border-0 !bg-transparent" placeholder={`Message ${username}...`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} data-testid="message-input" />
                <button className="btn btn-sm !border-0 !rounded-none" data-testid="message-send-button">{tt("Send")}</button>
              </form>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
