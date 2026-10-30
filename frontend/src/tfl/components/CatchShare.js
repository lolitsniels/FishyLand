import { toast } from "sonner";
import { usePrefs } from "../lib/prefs";
import { api } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Link2 } from "lucide-react";
import { SiX, SiFacebook, SiWhatsapp, SiReddit, SiTelegram } from "react-icons/si";

const TARGETS = [
  ["x", "X", SiX, "#000000", (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
  ["facebook", "Facebook", SiFacebook, "#1877f2", (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`],
  ["whatsapp", "WhatsApp", SiWhatsapp, "#25d366", (u, t) => `https://wa.me/?text=${t}%20${u}`],
  ["reddit", "Reddit", SiReddit, "#ff4500", (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}`],
  ["telegram", "Telegram", SiTelegram, "#26a5e4", (u, t) => `https://t.me/share/url?url=${u}&text=${t}`],
];
const btn = "w-6 h-6 inline-flex items-center justify-center rounded-[2px] border border-white/15 text-white transition-[filter,transform] hover:brightness-125 hover:-translate-y-px";

export function CatchShare({ c, username, lbs }) {
  const { user, setUser } = useGame();
  const { share_buttons } = usePrefs();
  const bonus = user?.share_reward || 0;
  const claim = () => { if (bonus) api.post("/share/reward").then((r) => { if (r.data.gold) toast.success(`+${r.data.gold} gold for sharing your ${c.boss ? "boss kill" : "catch"}`); setUser(r.data.user); }).catch(() => {}); };
  const link = `${window.location.origin}/api/share/catch?s=${c.species_id}&w=${c.weight}&v=${c.variant || "normal"}&u=${encodeURIComponent(username || "")}&un=${lbs.endsWith("kg") ? "kg" : "lb"}`;
  const v = c.variant && c.variant !== "normal" ? `${c.variant} ` : "";
  const text = c.boss ? `I just slew the boss ${c.name} (${lbs}) in Fishing Realms!` : c.name.startsWith("The ") ? `I just landed ${c.name} (${v}${lbs}) in Fishing Realms!` : `I just landed a ${lbs} ${v}${c.name} in Fishing Realms!`;
  const u = encodeURIComponent(link), t = encodeURIComponent(text);
  const copy = async () => { try { await navigator.clipboard.writeText(`${text} ${link}`); toast.success("Share link copied"); claim(); } catch { toast.error("Could not copy"); } };
  if (!share_buttons) return null;
  return (
    <div className="flex items-center gap-1" data-testid="catch-share">
      <span className="text-[10.5px] uppercase tracking-wider text-[var(--muted)] mr-1">Share{bonus > 0 && <span className="normal-case tracking-normal text-[var(--gold)] ml-1" title="Once a day, the first catch you share pays a gold bonus" data-testid="catch-share-bonus">+{bonus}g today</span>}</span>
      {TARGETS.map(([id, name, Icon, color, href]) => (
        <a key={id} href={href(u, t)} target="_blank" rel="noopener noreferrer" title={`Share on ${name}`} aria-label={`Share on ${name}`} data-testid={`catch-share-${id}`} onClick={claim} className={btn} style={{ background: color }}><Icon size={11} /></a>
      ))}
      <button type="button" className={btn} title="Copy share link" aria-label="Copy share link" onClick={copy} data-testid="catch-share-copy" style={{ background: "#c2410c" }}><Link2 size={11} /></button>
    </div>
  );
}
