import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
import { api, errMsg } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { fx } from "../game/fx";
import { toast } from "sonner";

const CHANNELS = [["global", "Global"], ["crew", "Crew"], ["trade", "Trade"]];

// Bottom-left chat: Global / Guild / Trade. New lines also pop up as speech bubbles over the speaker.
export function ChatBox() {
  const { user } = useGame();
  const [ch, setCh] = useState("global");
  const [open, setOpen] = useState(() => window.innerWidth > 700);
  const [rows, setRows] = useState([]);
  const [text, setText] = useState("");
  const last = useRef(""), first = useRef(true), list = useRef(null);
  const canCrew = !!user?.crew;
  useEffect(() => {
    let live = true;
    last.current = ""; first.current = true; setRows([]);
    if (ch === "crew" && !canCrew) return undefined;
    const pull = async () => {
      try {
        const r = await api.get(`/chat/${ch}`, { params: { after: last.current } });
        if (!live || !r.data.length) return;
        last.current = r.data[r.data.length - 1].at;
        if (!first.current) r.data.forEach((m) => { if (m.text) fx.bubbles[m.username] = { text: m.text, until: Date.now() + 6000 }; });
        first.current = false;
        setRows((old) => { const seen = new Set(old.map((m) => m.id)); return [...old, ...r.data.filter((m) => !seen.has(m.id))].slice(-80); });
      } catch { /* offline: try again next tick */ }
    };
    pull();
    const t = setInterval(pull, 3000);
    return () => { live = false; clearInterval(t); };
  }, [ch, canCrew]);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [rows, open]);
  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    try { const r = await api.post(`/chat/${ch}`, { text: t }); setText(""); if (r.data?.id) { last.current = r.data.at || last.current; setRows((old) => (old.some((m) => m.id === r.data.id) ? old : [...old, r.data].slice(-80))); } fx.bubbles[user.username] = { text: t, until: Date.now() + 6000 }; } catch (er) { toast.error(errMsg(er)); }
  };
  return (
    <div className={`chatbox pointer-events-auto ${open ? "open" : ""}`} data-testid="chat-box" onKeyDown={(e) => e.stopPropagation()}>
      <div className="chat-tabs">
        {CHANNELS.map(([id, label]) => (
          <button key={id} type="button" className={`chat-tab ${ch === id ? "on" : ""}`} onClick={() => { setCh(id); setOpen(true); }} data-testid={`chat-tab-${id}`}>{label}</button>
        ))}
        <button type="button" className="chat-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Shrink chat" : "Open chat"} data-testid="chat-toggle">{open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>
      </div>
      {open && (
        <>
          <div className="chat-list" ref={list} data-testid="chat-list">
            {ch === "crew" && !canCrew ? <div className="chat-empty">Join a crew at the Crew HQ to use crew chat.</div>
              : rows.length === 0 ? <div className="chat-empty">No messages yet. Say hello!</div>
              : rows.map((m) => (
                <div key={m.id} className="chat-line" data-testid="chat-line">
                  <b className={m.system ? "sys" : m.username === user.username ? "me" : ""}>{m.username}{m.level ? <span className="lv"> {m.level}</span> : null}:</b> <span>{m.text || m.item?.label || ""}</span>
                </div>
              ))}
          </div>
          {!(ch === "crew" && !canCrew) && (
            <form className="chat-input" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={240} placeholder={`Message ${CHANNELS.find(([id]) => id === ch)[1]}…`} data-testid="chat-input" />
              <button type="submit" aria-label="Send" data-testid="chat-send"><Send size={15} /></button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
