import { useEffect, useRef, useState } from "react";
import { Smile, Settings } from "lucide-react";
import { useGame } from "../../store";
import { api } from "../../lib/api";
import { PORTAL } from "../../portal";

const TABS = PORTAL ? ["System"] : ["General", "World", "Guild", "System"];
const KIND_COLOR = { legendary: "#ffcc33", mythic: "#ff3f8e", epic: "#c06bff", rare: "#47a3ff", uncommon: "#3ee27a", lost: "#ff8a8a", level: "#f0abfc", drop: "#7ff3ff" };

export default function ChatBox({ compact }) {
  const [tab, setTab] = useState("System");
  const [open, setOpen] = useState(!compact);
  const system = useGame((s) => s.system);
  const world = useGame((s) => s.world);
  const setWorld = useGame((s) => s.setWorld);
  const openModal = useGame((s) => s.openModal);
  const end = useRef(null);

  useEffect(() => {
    if (PORTAL) return;
    const load = () => api.get("/world/feed").then((r) => setWorld(r.data)).catch(() => {});
    load();
    const i = setInterval(load, 12000);
    return () => clearInterval(i);
  }, [setWorld]);

  const lines = tab === "System" ? system.map((l) => ({ id: l.id, tag: "System", text: l.text, color: KIND_COLOR[l.kind] }))
    : tab === "World" ? world.map((w, i) => ({ id: i, tag: "World", text: w.text, color: KIND_COLOR[w.rarity] }))
    : [];
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [lines.length, tab]);

  return (
    <div className={`fr-panel w-[340px] ${PORTAL ? "max-w-[26vw]" : "max-w-[34vw]"} flex flex-col rise ${open ? "h-[170px]" : "h-[34px]"}`} style={{ animationDelay: "0.3s" }} data-testid="chat-box">
      <div className="flex items-center border-b border-amber-700/60">
        {TABS.map((tb) => (
          <button key={tb} type="button" onClick={() => { setTab(tb); setOpen(true); }} data-testid={`chat-tab-${tb.toLowerCase()}`}
            className={`px-2.5 py-1 text-[11px] font-cinzel font-bold transition-colors ${tab === tb ? "text-amber-200 bg-amber-900/40" : "text-amber-100/50 hover:text-amber-100"}`}>
            {tb}
          </button>
        ))}
        <button type="button" className="ml-auto px-2 text-amber-200/70 text-xs" onClick={() => setOpen(!open)} data-testid="chat-collapse-btn">{open ? "–" : "+"}</button>
      </div>
      {open && (
        <>
          <div className="flex-1 overflow-y-auto scroll-gold px-2 py-1 text-[12px] leading-snug select-text" data-testid="chat-lines">
            {lines.length === 0 && (
              <div className="text-amber-100/40 italic">
                {tab === "General" || tab === "Guild" ? "Live chat opens with multiplayer channels (Phase 4)." : "Nothing yet. Go catch something legendary."}
              </div>
            )}
            {lines.map((l) => (
              <div key={l.id}><span className="text-amber-400 font-cinzel">[{l.tag}]</span> <span style={{ color: l.color || "#fdf1cf" }}>{l.text}</span></div>
            ))}
            <div ref={end} />
          </div>
          {!PORTAL && <div className="flex items-center gap-1 p-1 border-t border-amber-700/60">
            <input disabled className="fr-input !py-1 !text-[11px] flex-1 opacity-60" placeholder="Chat unlocks in Phase 4" data-testid="chat-input" />
            <Smile size={15} className="text-amber-300/60" />
            <button type="button" onClick={() => openModal({ type: "settings" })} data-testid="chat-settings-btn"><Settings size={15} className="text-amber-300" /></button>
          </div>}
        </>
      )}
    </div>
  );
}
