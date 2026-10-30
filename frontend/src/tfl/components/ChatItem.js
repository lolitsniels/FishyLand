/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Fragment, useState } from "react";
import { MessageSquarePlus, Mail, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useGame } from "../context/GameContext";
import { Dialog, DialogContent, DialogTitle } from "../../components/ui/dialog";
import { FishPlate } from "./FishPlate";
import { GearIcon } from "./GearIcon";
import { fmt, wt, ln } from "../lib/api";
import { t as tt } from "../i18n";

// Sends an owned item to the chat box; ChatPanel listens and attaches it to the next message.
export const linkToChat = (item, label) => window.dispatchEvent(new CustomEvent("chat-link", { detail: { item, label } }));

export const LinkChatBtn = ({ item, label, testId }) => (
  <button type="button" className="btn btn-sm !px-1.5" title={tt("Link to chat")} aria-label={tt("Link to chat")} onClick={() => linkToChat(item, label)} data-testid={testId}><MessageSquarePlus size={13} /></button>
);

const ItemArt = ({ it, big }) => it.kind === "fish"
  ? <FishPlate speciesId={it.species_id} name={it.name} className={big ? "w-40 h-24" : "w-6 h-4"} />
  : <GearIcon id={it.id} name={it.name} size={big ? "md" : "sm"} className={big ? "!w-24 !h-24" : "!w-5 !h-5"} />;

function Rows({ it }) {
  const r = [];
  if (it.kind === "fish") {
    r.push([tt("Weight"), wt(it.weight)]);
    if (it.length_cm) r.push([tt("Length"), ln(it.length_cm)]);
    if (it.variant && it.variant !== "normal") r.push([tt("Variant"), it.variant]);
    if (it.water) r.push([tt("Caught at"), it.water]);
    if (it.value) r.push([tt("Vendor value"), `${fmt(it.value)}g`]);
  } else if (it.kind === "gear") {
    r.push([tt("Slot"), `${it.slot} · T${it.tier}`]);
    if (it.enhance) r.push([tt("Enhanced"), `+${it.enhance}`]);
    r.push([tt("Wear"), `${it.durability}/100`]);
    if (it.power) r.push([tt("Power"), it.power]);
    if (it.control) r.push([tt("Control"), it.control]);
    if (it.recovery) r.push([tt("Recovery"), it.recovery]);
    if (it.tolerance) r.push([tt("Tolerance"), it.tolerance]);
    if (it.level) r.push([tt("Needs level"), it.level]);
    if (it.price) r.push([tt("Shop price"), `${fmt(it.price)}g`]);
  } else {
    if (it.qty) r.push([tt("They have"), `×${fmt(it.qty)}`]);
  }
  return <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[12px]">{r.map(([k, v]) => <Fragment key={k}><dt className="text-[var(--muted)]">{k}</dt><dd className="num text-[var(--text)] text-right">{v}</dd></Fragment>)}</dl>;
}

export function ChatItemChip({ it, who }) {
  const [open, setOpen] = useState(false);
  const { user } = useGame();
  return (
    <>
      <button type="button" className={`chat-item-chip rar-${it.rarity}`} onClick={() => setOpen(true)} data-testid={`chat-item-${it.id}`}>
        <ItemArt it={it} /><span>[{it.name}{it.kind === "gear" && it.enhance ? ` +${it.enhance}` : ""}]</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[340px] panel panel-gold !p-4" data-testid="chat-item-card">
          <DialogTitle className={`font-display text-[17px] rar-${it.rarity}`}>{it.name}{it.kind === "gear" && it.enhance ? ` +${it.enhance}` : ""}</DialogTitle>
          <div className="text-[10.5px] uppercase tracking-wider text-[var(--muted)] -mt-1">{it.rarity}{who ? ` · ${tt("linked by")} ${who}` : ""}</div>
          <div className="flex justify-center py-2 [image-rendering:pixelated]"><ItemArt it={it} big /></div>
          <Rows it={it} />
          {it.perk && <p className="text-[12px] text-[var(--text-2)] mt-1" data-testid="chat-item-perk">{it.perk}</p>}
          {it.desc && !it.perk && <p className="text-[12px] text-[var(--text-2)] mt-1">{it.desc}</p>}
          {who && who !== user.username && !user.is_guest && <Link to={`/game/messages/${who}`} className="btn btn-gold btn-sm justify-center mt-2 inline-flex items-center gap-1.5" onClick={() => setOpen(false)} data-testid="chat-item-message-player"><Mail size={13} /> {tt("Message")} {who}</Link>}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ChatAttachment({ a, onClear }) {
  return (
    <div className="chat-attach" data-testid="chat-attachment">
      <span className="text-[10.5px] uppercase tracking-wider text-[var(--muted)]">{tt("Linking")}</span>
      <span className="font-medium text-[var(--gold)] truncate" data-testid="chat-attachment-name">[{a.label}]</span>
      <span className="text-[10.5px] text-[var(--muted)] truncate hidden sm:inline">{tt("add a message, e.g. selling, price?")}</span>
      <button type="button" className="ml-auto text-[var(--muted)] hover:text-[var(--text)]" onClick={onClear} aria-label={tt("Remove link")} data-testid="chat-attachment-clear"><X size={12} /></button>
    </div>
  );
}
