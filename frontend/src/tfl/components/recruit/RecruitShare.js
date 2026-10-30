import { Share2 } from "lucide-react";
import { SiX, SiFacebook, SiTelegram, SiVk, SiWhatsapp, SiReddit, SiDiscord } from "react-icons/si";
import { t as tt } from "../../i18n";
import { CopyField, Tip, useCopy } from "./shared";

const TARGETS = [
  ["x", "X", SiX, "#000000", (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`],
  ["facebook", "Facebook", SiFacebook, "#1877f2", (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`],
  ["reddit", "Reddit", SiReddit, "#ff4500", (u, t) => `https://www.reddit.com/submit?url=${u}&title=${t}`],
  ["whatsapp", "WhatsApp", SiWhatsapp, "#25d366", (u, t) => `https://wa.me/?text=${t}%20${u}`],
  ["telegram", "Telegram", SiTelegram, "#26a5e4", (u, t) => `https://t.me/share/url?url=${u}&text=${t}`],
  ["vk", "VK", SiVk, "#0077ff", (u, t) => `https://vk.com/share.php?url=${u}&title=${t}`],
];

const MESSAGES = (link, user) => [
  ["short", tt("Short"), `Come fish with me in The Fishing Lands, a free fishing MMO you play right in your browser 🎣 ${link}`],
  ["brag", tt("Show off"), `Just hit level ${user.level} in The Fishing Lands with ${user.stats?.catches ?? 0} fish landed. Free browser fishing MMO with bosses, crews and duels. Join me: ${link}`],
  ["crew", tt("Crew invite"), `Looking for anglers to join my crew in The Fishing Lands! Free to play in your browser, no download. Start here and we both get rewards: ${link}`],
];

export default function RecruitShare({ link, user }) {
  const [copied, copy] = useCopy();
  const text = tt("Come fish with me in The Fishing Lands, a free fishing MMO in your browser. Join with my link:");
  const u = encodeURIComponent(link), t = encodeURIComponent(text);
  const native = async () => { try { await navigator.share({ title: "The Fishing Lands", text, url: link }); } catch {} };
  return (
    <div className="space-y-4 text-[12.5px]" data-testid="recruit-share-tab">
      <div className="space-y-2">
        <div className="label">{tt("One-tap share")}</div>
        <div className="flex flex-wrap items-center gap-1.5" data-testid="recruit-share-row">
          {TARGETS.map(([id, name, Icon, color, href]) => (
            <a key={id} href={href(u, t)} target="_blank" rel="noopener" title={name} aria-label={name} data-testid={`recruit-share-${id}`}
              className="h-9 px-3 inline-flex items-center gap-2 rounded-[2px] border border-white/15 text-white text-[12px] transition-[filter,transform] hover:brightness-125 hover:-translate-y-px" style={{ background: color }}>
              <Icon size={14} /> {name}
            </a>
          ))}
          <button type="button" className="h-9 px-3 inline-flex items-center gap-2 rounded-[2px] border border-white/15 text-white text-[12px] hover:brightness-125" style={{ background: "#5865f2" }} onClick={() => copy("discord", `${text} ${link}`, "Discord message")} data-testid="recruit-share-discord"><SiDiscord size={14} /> Discord</button>
          {typeof navigator !== "undefined" && navigator.share && <button type="button" className="btn btn-sm inline-flex items-center gap-1 h-9" onClick={native} data-testid="recruit-share-native"><Share2 size={12} /> {tt("More…")}</button>}
        </div>
      </div>
      <div className="space-y-2">
        <div className="label">{tt("Ready-made messages")}</div>
        {MESSAGES(link, user).map(([id, label, msg]) => (
          <div key={id} className="space-y-1" data-testid={`recruit-msg-${id}`}>
            <div className="text-[11px] text-[var(--muted)] uppercase tracking-wider">{label}</div>
            <CopyField id={id} value={msg} label={tt("message")} copied={copied} copy={copy} testId={`recruit-msg-${id}`} />
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-3 border-t border-[var(--border)]">
        <div className="label">{tt("How to share it best")}</div>
        <ol className="space-y-2.5" data-testid="recruit-share-howto">
          <Tip n="1" title={tt("Post a moment, not an ad")}>{tt("Share a screenshot of a legendary catch, a boss fight or a funny chat moment with your link underneath. People click on stories, not on \"play my game\".")}</Tip>
          <Tip n="2" title={tt("Use the Catch Share button")}>{tt("After a great catch, tap Share on the catch card: it makes a picture of your fish. Add your recruit link to the post text.")}</Tip>
          <Tip n="3" title={tt("Pick the right place")}>{tt("Gaming groups, fishing subreddits, browser game Discords and your friends' group chats work best. Follow each community's rules about self-promotion.")}</Tip>
          <Tip n="4" title={tt("Invite friends directly")}>{tt("A personal WhatsApp or Discord message to 3 friends beats 100 strangers. Offer to show them around the first waters and help them join your crew.")}</Tip>
        </ol>
      </div>
    </div>
  );
}
