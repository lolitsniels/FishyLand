/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, errMsg, ago, wtText } from "../lib/api";
import { useGame } from "../context/GameContext";
import { toast } from "sonner";
import { X, Palette, MessageSquare, ChevronUp, ChevronDown, Flag } from "lucide-react";
import { AdminBadge, ModBadge, SupporterBadge, PremiumBadge } from "./ui-bits";
import { Avatar } from "./Avatar";
import { usePrefs } from "../lib/prefs";
import { t as tt } from "../i18n";
import { sfx } from "../lib/sound";
import { ChatItemChip, ChatAttachment } from "./ChatItem";

function ColourPicker({ onPicked }) {
  const { user, setUser } = useGame();
  const [open, setOpen] = useState(false);
  const [cos, setCos] = useState(null);
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    if (!cos) api.get("/cosmetics").then((r) => setCos(r.data)).catch(() => {});
    const off = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener("mousedown", off);
    return () => window.removeEventListener("mousedown", off);
  }, [open]); // eslint-disable-line
  const set = async (colour_id) => {
    try { const r = await api.post("/cosmetics/colour", { colour_id }); setUser(r.data.user); toast.success(colour_id ? "Chat name colour updated" : "Back to the default name colour"); onPicked?.(); setOpen(false); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const owned = cos?.colours.filter((c) => c.owned) || [];
  return (
    <span className="relative shrink-0" ref={boxRef}>
      <button type="button" className="px-1.5 py-1 text-[var(--muted)] hover:text-[var(--gold)] border-l border-[var(--border)]" title={tt("Chat name colour")} onClick={() => setOpen((o) => !o)} data-testid="chat-colour-toggle"><Palette size={13} /></button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 panel panel-gold w-52 z-30 text-[12px]" data-testid="chat-colour-popover">
          <header className="panel-head !py-1 !text-[10px]">{tt("Chat name colour")}</header>
          <div className="p-2 space-y-1">
            <button type="button" className={`w-full flex items-center gap-2 px-1.5 py-1 text-left border ${!user.name_colour ? "border-[var(--gold)] bg-[#1f1714]" : "border-transparent hover:border-[var(--border)]"}`} onClick={() => set(null)} data-testid="chat-colour-default"><span className="inline-block w-3 h-3 border border-[var(--border)] bg-[#c8bfb5]" /><span className="flex-1">{tt("Default")}</span>{!user.name_colour && <span className="text-[10px] text-[var(--gold)]">{tt("In use")}</span>}</button>
            {cos === null ? <div className="text-[var(--muted)] italic text-[11px] px-1.5">{tt("Loading...")}</div> :
             owned.length === 0 ? <div className="text-[var(--muted)] text-[11px] px-1.5">{tt("You don't own any Pearl colours yet.")} <Link to="/game/pearl-shop" className="underline" onClick={() => setOpen(false)}>{tt("Shop →")}</Link></div> :
             owned.map((c) => (
              <button type="button" key={c.id} className={`w-full flex items-center gap-2 px-1.5 py-1 text-left border ${user.name_colour === c.id ? "border-[var(--gold)] bg-[#1f1714]" : "border-transparent hover:border-[var(--border)]"}`} onClick={() => set(c.id)} data-testid={`chat-colour-${c.id}`}>
                <span className="inline-block w-3 h-3 border border-[rgba(255,255,255,.25)]" style={{ background: c.hex }} />
                <span className="flex-1" style={{ color: c.hex }}>{c.name}</span>
                {user.name_colour === c.id && <span className="text-[10px] text-[var(--gold)]">{tt("In use")}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export function ServerClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 15000); return () => clearInterval(i); }, []);
  const hh = String(t.getUTCHours()).padStart(2, "0"), mm = String(t.getUTCMinutes()).padStart(2, "0");
  return <span className="font-sans normal-case tracking-normal text-[11px] text-[var(--muted)] num whitespace-nowrap" title={tt("Server time. Daily resets, tournaments and secret-catch windows all follow UTC.")} data-testid="server-clock">{hh}:{mm} {tt("UTC")}</span>;
}

function FeedList({ feed }) {
  return (
    <ul className="space-y-1.5" data-testid="world-feed">
      {feed.filter((e) => e.kind !== "join").map((e, i) => (
        <li key={i} className="border-b border-[#221e1b] pb-1.5 last:border-0 flex items-start gap-1.5">
          {e.avatar ? <Link to={`/game/profile/${e.username}`} className="shrink-0 mt-px" title={e.username} data-testid={`feed-avatar-${e.username}`}><Avatar id={e.avatar} size="xs" frame={e.frame} /></Link> : <span className={`rar-${e.rarity} shrink-0`}>●</span>}
          <span className="min-w-0"><span className={`rar-${e.rarity} mr-1`}>{e.avatar ? "●" : ""}</span><span className="text-[var(--text-2)]">{wtText(e.text)}</span>{e.at && <span className="text-[10.5px] text-[var(--muted)] ml-1" title={new Date(e.at).toLocaleString()}>· {ago(e.at)}</span>}</span>
        </li>
      ))}
      {feed.length === 0 && <li className="text-[var(--muted)] italic">{tt("The harbour is quiet. For now.")}</li>}
    </ul>
  );
}

const MENTION_RE = /(@[A-Za-z0-9_]{2,24})/g;
export const mentionsMe = (text, me) => new RegExp(`@${me.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_])`, "i").test(text || "");

function MsgText({ text, me }) {
  return text.split(MENTION_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    const name = part.slice(1);
    const isMe = name.toLowerCase() === me.toLowerCase();
    return <Link key={i} to={`/game/profile/${name}`} className={`font-medium ${isMe ? "text-[#1a110c] bg-[var(--gold)] px-0.5 rounded-[2px]" : "text-[var(--gold)] hover:underline"}`} data-testid="chat-mention">{part}</Link>;
  });
}

export default function ChatPanel({ onClose, feed = [], online = [], collapsed = false, onToggle, mentions = 0 }) {
  const { user } = useGame();
  const { chat_timestamps: showTs } = usePrefs();
  const [channel, setChannel] = useState("global");
  const [reported, setReported] = useState(() => new Set());
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [attach, setAttach] = useState(null);
  const toggleRef = useRef(onToggle);
  toggleRef.current = onToggle;
  const box = useRef(null);
  const input = useRef(null);
  const [sugg, setSugg] = useState([]);
  const [suggIdx, setSuggIdx] = useState(0);
  const seenIds = useRef(new Set());
  const [unseen, setUnseen] = useState(0);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  useEffect(() => { if (!collapsed) setUnseen(0); }, [collapsed]);
  useEffect(() => {
    const on = (e) => {
      setAttach(e.detail);
      if (collapsedRef.current) toggleRef.current?.();
      setChannel((c) => (c === "feed" ? "global" : c));
      setTimeout(() => input.current?.focus(), 80);
    };
    window.addEventListener("chat-link", on);
    return () => window.removeEventListener("chat-link", on);
  }, []);

  const lastAt = useRef(null);
  const stick = useRef(true);
  const crewId = user.crew?.id;
  useEffect(() => {
    if (channel === "crew" && !crewId) setChannel("global");
    if (channel === "feed") return undefined;
    let alive = true;
    lastAt.current = null; stick.current = true; setMsgs([]); seenIds.current = new Set();
    const load = () => api.get(`/chat/${channel}`, { params: lastAt.current ? { after: lastAt.current } : {} }).then((r) => {
      if (!alive || r.data.length === 0) return;
      lastAt.current = r.data[r.data.length - 1].at;
      const fresh = r.data.filter((x) => !seenIds.current.has(x.id));
      if (fresh.length) api.post("/chat/seen").catch(() => {});
      if (collapsedRef.current && seenIds.current.size > 0) setUnseen((n) => n + fresh.filter((x) => x.username !== user.username).length);
      fresh.forEach((x) => seenIds.current.add(x.id));
      if (seenIds.current.size > 1) fresh.filter((x) => x.username !== user.username && mentionsMe(x.text, user.username) && Date.now() - new Date(x.at).getTime() < 20000)
        .forEach((x, i) => (i === 0 && sfx("mention", 3000), toast.message(tt("{{v0}} mentioned you in {{v1}}: {{v2}}", { v0: x.username, v1: channel, v2: x.text.slice(0, 80) }), { duration: 6000 })));
      setMsgs((m) => { const seen = new Set(m.map((x) => x.id)); return [...m, ...r.data.filter((x) => !seen.has(x.id))].slice(-120); });
    }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [channel, crewId, user.username]);
  // Only follow new messages when the reader is already at the bottom; never yank them back while scrolled up.
  const onScroll = () => { const b = box.current; if (b) stick.current = b.scrollHeight - b.scrollTop - b.clientHeight < 40; };
  useEffect(() => { if (box.current && stick.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs]);
  useEffect(() => {  // the message box remounts when the chat is opened: jump to the newest message
    if (collapsed || channel === "feed") return;
    stick.current = true;
    const f = requestAnimationFrame(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; });
    return () => cancelAnimationFrame(f);
  }, [collapsed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (channel === "feed" && box.current) box.current.scrollTop = 0; }, [channel]);

  const sending = useRef(false);
  const send = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !attach) || sending.current) return;
    sending.current = true;
    try {
      const r = await api.post(`/chat/${channel}`, { text, ...(attach ? { item: attach.item } : {}) });
      setMsgs((m) => (m.some((x) => x.id === r.data.id) ? m : [...m, r.data]));
      setText(""); setAttach(null);
      if (r.data.event_win) { toast.success(r.data.event_win.message, { duration: 10000 }); sfx("level"); }
    } catch (ex) { toast.error(errMsg(ex)); }
    finally { sending.current = false; }
  };

  // @mention autocomplete: names from who's online and who spoke recently
  const names = () => { const s = new Set(online.map((p) => p.username)); msgs.forEach((m) => m.username && s.add(m.username)); s.delete(user.username); return [...s]; };
  const onType = (v) => {
    setText(v);
    const m = /(^|\s)@([A-Za-z0-9_]*)$/.exec(v);
    if (!m) { setSugg([]); return; }
    const q = m[2].toLowerCase();
    setSugg(names().filter((n) => n.toLowerCase().startsWith(q)).slice(0, 6)); setSuggIdx(0);
  };
  const pick = (name) => { setText((t) => t.replace(/@([A-Za-z0-9_]*)$/, `@${name} `)); setSugg([]); input.current?.focus(); };
  const onKey = (e) => {
    if (!sugg.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSuggIdx((i) => (i + 1) % sugg.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSuggIdx((i) => (i - 1 + sugg.length) % sugg.length); }
    else if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); pick(sugg[suggIdx]); }
    else if (e.key === "Escape") setSugg([]);
  };
  const mentionUser = (name) => { if (name === user.username) return; setText((t) => (t.endsWith(" ") || !t ? t : t + " ") + `@${name} `); input.current?.focus(); };

  const reportMsg = async (m) => {
    if (reported.has(m.id)) return;
    try { await api.post(`/chat/report/${m.id}`); setReported((s) => new Set(s).add(m.id)); toast.success(tt("Reported. Thanks, the staff will take a look.")); }
    catch (ex) { toast.error(errMsg(ex)); }
  };

  const removeMsg = async (m) => {
    try { await api.delete(user.is_admin ? `/admin/chat/${m.id}` : `/mod/chat/${m.id}`); setMsgs((ms) => ms.filter((x) => x.id !== m.id)); toast.success(tt("Message removed")); }
    catch (ex) { toast.error(errMsg(ex)); }
  };

  const last = msgs[msgs.length - 1];
  if (collapsed) return (
    <button type="button" className="chat-dock-bar" onClick={onToggle} data-testid="toggle-chat-button" aria-label={tt("Open chat")}>
      <MessageSquare size={15} className="text-[var(--gold)] shrink-0" />
      <span className="chat-dock-title">{tt("Chat")}</span>
      <span className="chat-dock-preview" data-testid="chat-dock-preview">{last ? <><b style={last.colour ? { color: last.colour } : undefined}>{last.username}:</b> {last.item ? `[${last.item.name}] ` : ""}{last.text}</> : tt("Say hello to the harbour…")}</span>
      {mentions > 0 && <span className="chat-dock-count chat-dock-mention" title={tt("Mentions of you")} data-testid="chat-mention-badge">@{mentions}</span>}
      {unseen > 0 && <span className="chat-dock-count" data-testid="chat-unread-count">{unseen > 99 ? "99+" : unseen}</span>}
      <span className="chat-dock-clock" data-testid="chat-dock-clock"><ServerClock /></span>
      <ChevronUp size={15} className="shrink-0 text-[var(--text-2)]" />
    </button>
  );
  return (
    <section className="panel" data-testid="chat-panel">
      <header className="panel-head !py-1.5 flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-2"><span>{tt("Chat")}</span><ServerClock /></span>
        <span className="flex items-center gap-0.5 ml-auto">
          {["global", "trade", ...(user.crew ? ["crew"] : []), "feed"].map((c) => (
            <button key={c} onClick={() => setChannel(c)} data-testid={`chat-tab-${c}`}
              className={`px-2 py-0.5 text-[10.5px] uppercase tracking-wider border rounded-[2px] ${channel === c ? "border-[var(--gold-dim)] text-[var(--gold)] bg-[var(--bg-deep)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`}>{c === "feed" ? tt("Feed") : c}</button>
          ))}
          {onClose && <button type="button" onClick={onClose} className="ml-1 p-1 text-[var(--muted)] hover:text-[var(--gold)]" aria-label={tt("Collapse chat")} data-testid="chat-close-button"><ChevronDown size={16} /></button>}
        </span>
      </header>
      <div ref={box} onScroll={onScroll} className="chat-messages overflow-auto p-2 space-y-1 text-[12px]" data-testid="chat-messages">
        {channel === "feed" && <FeedList feed={feed} />}
        {channel !== "feed" && msgs.map((m, i) => (
          <div key={m.id || i} className={`group flex items-start gap-1 ${m.username !== user.username && mentionsMe(m.text, user.username) ? "bg-[rgba(240,194,122,.10)] border-l-2 border-[var(--gold)] pl-1 -ml-1 rounded-r-[2px]" : ""}`} data-testid={m.username !== user.username && mentionsMe(m.text, user.username) ? "chat-msg-mentioned" : undefined}>{m.avatar && (m.system ? <span className="shrink-0 mt-px" title="Harbourmaster" data-testid="chat-avatar-harbourmaster"><Avatar id={m.avatar} size="chat" /></span> : <Link to={`/game/profile/${m.username}`} className="shrink-0 mt-px" title={m.username} data-testid={`chat-avatar-${m.username}`}><Avatar id={m.avatar} size="chat" frame={m.frame} /></Link>)}<span className="min-w-0 flex-1">{showTs && <span className="num text-[9.5px] text-[var(--muted)] opacity-70 mr-1" title={new Date(m.at).toLocaleString()} data-testid="chat-time">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}{!m.system && <span className={`num text-[10px] mr-1 ${m.username === user.username ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>[{m.level}]</span>}{m.tag && <span className="text-[10.5px] text-[var(--gold-dim)] mr-0.5" style={m.tag_colour ? { color: m.tag_colour } : undefined}>[{m.tag}]</span>}{m.admin && <AdminBadge className="mr-1" data-testid={`chat-admin-badge-${m.username}`} />}{m.mod && !m.admin && <ModBadge className="mr-1" data-testid={`chat-mod-badge-${m.username}`} />}{m.supporter && <SupporterBadge className="mr-1" data-testid={`chat-supporter-badge-${m.username}`} />}{m.premium && <PremiumBadge className="mr-1" data-testid={`chat-premium-badge-${m.username}`} />}<Link to={`/game/profile/${m.username}`} className={`font-medium hover:underline ${m.colour ? "" : m.username === user.username ? "text-[var(--gold)]" : "text-[#c8bfb5]"}`} style={m.colour ? { color: m.colour } : undefined} data-testid={`chat-user-${m.username}`}>{m.username}</Link><span className={`font-medium ${m.colour ? "" : m.username === user.username ? "text-[var(--gold)]" : "text-[#c8bfb5]"}`} style={m.colour ? { color: m.colour } : undefined}>:</span> <span className="text-[var(--text-2)]">{m.item && <ChatItemChip it={m.item} who={m.username} />}{m.item && m.text ? " " : ""}<MsgText text={m.text} me={user.username} /></span></span>
            {m.username !== user.username && <button className="text-[var(--muted)] hover:text-[var(--gold)] opacity-0 group-hover:opacity-100 shrink-0 text-[11px] num" title={`Mention @${m.username}`} onClick={() => mentionUser(m.username)} data-testid={`chat-mention-btn-${m.username}`}>@</button>}
            {channel !== "crew" && !m.system && m.id && m.username !== user.username && <button className={`shrink-0 mt-0.5 ${reported.has(m.id) ? "text-[#f0a5a3] opacity-100" : "text-[var(--muted)] hover:text-[#f0c27a] opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-60"}`} title={reported.has(m.id) ? tt("Reported") : tt("Report message")} onClick={() => reportMsg(m)} data-testid={`chat-report-${m.id}`}><Flag size={10} /></button>}
            {(user.is_admin || (user.is_mod && channel !== "crew" && !m.system)) && m.id && <button className="text-[var(--muted)] hover:text-[#f0a5a3] opacity-0 group-hover:opacity-100 shrink-0" title={tt("Delete message (staff)")} onClick={() => removeMsg(m)} data-testid={`chat-delete-${m.id}`}><X size={11} /></button>}
          </div>
        ))}
      </div>
      {channel === "feed" ? <div className="chat-input-row border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]" data-testid="feed-footer">{tt("Server-wide happenings: big catches, contracts, crews and boosters. Switch to Global to talk.")}</div>
      : <>{attach && <ChatAttachment a={attach} onClear={() => setAttach(null)} />}<form onSubmit={send} className="chat-input-row relative flex border-t border-[var(--border)]">
        {sugg.length > 0 && (
          <ul className="absolute bottom-full left-0 mb-1 min-w-[160px] border border-[var(--gold-dim)] bg-[var(--bg-deep)] text-[12px] z-20 shadow-lg" data-testid="chat-mention-suggestions">
            {sugg.map((n, i) => <li key={n}><button type="button" className={`w-full text-left px-2 py-1 ${i === suggIdx ? "bg-[var(--bg-2)] text-[var(--gold)]" : "text-[var(--text-2)]"}`} onMouseDown={(e) => { e.preventDefault(); pick(n); }} data-testid={`chat-mention-option-${n}`}>@{n}</button></li>)}
          </ul>
        )}
        <input ref={input} className="input !border-0 !bg-transparent min-w-0" placeholder={tt("Say something in {{v0}}…", { v0: channel })} value={text} onChange={(e) => onType(e.target.value)} onKeyDown={onKey} maxLength={240} enterKeyHint="send" autoComplete="off" data-testid="chat-input" />
        <ColourPicker />
        <button className="btn btn-sm !border-0 !rounded-none" data-testid="chat-send-button">{tt("Send")}</button>
      </form></>}
    </section>
  );
}
