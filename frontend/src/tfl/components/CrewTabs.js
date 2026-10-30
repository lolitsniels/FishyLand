/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Anchor, Users, Trophy, ClipboardList, Landmark, Settings2, Skull } from "lucide-react";
import { api, errMsg, fmt, wt, ago } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Empty, Gold } from "./ui-bits";
import { t as tt } from "../i18n";

export const TABS = [
  ["home", "Home", Anchor], ["members", "Members", Users], ["contest", "Contest", Trophy, true], ["contract", "Contract", ClipboardList, true],
  ["hall", "Hall & Upgrades", Landmark, true], ["leviathan", "Crew Boss", Skull, true], ["manage", "Manage", Settings2, "manage"],
];

export function CrewTabs({ tab, setTab, member, canManage }) {
  const shown = TABS.filter(([, , , need]) => !need || (need === "manage" ? canManage : member));
  return (
    <nav className="crew-tabs" data-testid="crew-tabs">
      {shown.map(([key, label, Icon]) => (
        <button key={key} className={`crew-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)} data-testid={`crew-tab-${key}`}>
          <Icon size={13} /> <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export const CrewName = ({ crew, className = "" }) => (
  <span className={className}><span style={crew.colour ? { color: crew.colour } : undefined} data-testid="crew-tag">[{crew.tag}]</span> {crew.name}</span>
);

const KIND_ICON = { member: "⚓", rank: "★", bank: "◈", hall: "⌂", order: "✓", emblem: "❖", misc: "·" };

export function CrewActivity({ crewId }) {
  const [ev, setEv] = useState(null);
  useEffect(() => { api.get(`/crews/${crewId}/activity`).then((r) => setEv(r.data.events)).catch(() => setEv([])); }, [crewId]);
  return (
    <Panel icon="journal" title={tt("Crew log")} bodyClass="!p-0" testId="crew-activity">
      {!ev ? <Empty>{tt("Loading…")}</Empty> : ev.length === 0 ? <Empty>{tt("Nothing in the log yet, joins, deposits, builds and filled orders land here.")}</Empty> : (
        <ul className="divide-y divide-[var(--border)] max-h-72 overflow-auto text-[12px]">
          {ev.map((e, i) => <li key={i} className="px-3 py-1.5 flex gap-2"><span className="text-[var(--gold-dim)] w-4 text-center shrink-0">{KIND_ICON[e.kind] || "·"}</span><span className="flex-1 min-w-0"><b className="text-[#f4ead2]">{e.who}</b> {e.text}</span><span className="text-[var(--muted)] text-[11px] whitespace-nowrap">{ago(e.at)}</span></li>)}
        </ul>
      )}
    </Panel>
  );
}

export function CrewHome({ crew, member, mine, onJoin, onRequest, onLeave }) {
  const nav = useNavigate();
  const banner = crew.hall_tier > 0 ? `/art/hall/hall_${crew.hall_tier}.jpg` : "/art/header_band.jpg";
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[3px] border border-[var(--border)] h-40 sm:h-52" data-testid="crew-home-banner">
        <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover" draggable="false" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,9,8,0.92)] via-[rgba(10,9,8,0.35)] to-transparent" />
        <div className="absolute left-4 right-4 bottom-3">
          <div className="label text-[var(--gold)]">{crew.open ? tt("Open to join") : tt("Invite only")} · {crew.member_count} / {crew.max_members} {tt("anglers")}</div>
          <h1 className="font-serif text-[22px] sm:text-[30px] text-[#f4ead2] leading-tight drop-shadow"><CrewName crew={crew} /></h1>
          <p className="text-[12.5px] text-[var(--text-2)] italic truncate" data-testid="crew-motto">{crew.desc || tt("No motto.")}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="crew-home-stats">
        {[["Leader", crew.leader], ["Contest wins", crew.wins], ["This week", wt(crew.weekly_kg)], ["Founded", ago(crew.created_at)]].map(([k, v]) => (
          <div key={k} className="panel px-3 py-2"><div className="label">{k}</div><div className="text-[13px] text-[#f4ead2] truncate">{v}</div></div>
        ))}
      </div>
      {crew.officers?.length > 0 && <div className="text-[12px] text-[var(--text-2)]">{tt("Officer")}{crew.officers.length > 1 ? "s" : ""}: <b>{crew.officers.join(", ")}</b></div>}
      {crew.motd && <Panel icon="contracts" title={tt("Notice board")} testId="crew-home-motd"><p className="text-[13px] text-[#f4ead2] italic">{crew.motd}</p></Panel>}
      <div className="flex gap-2 flex-wrap">
        {!mine && crew.open && <button className="btn btn-gold btn-sm" onClick={onJoin} data-testid="join-crew-button">{tt("Join crew")}</button>}
        {!mine && !crew.open && <button className="btn btn-gold btn-sm" onClick={onRequest} data-testid="request-join-button">{tt("Request to join")}</button>}
        {member && <button className="btn btn-danger btn-sm" onClick={onLeave} data-testid="leave-crew-button">{tt("Leave crew")}</button>}
        <button className="btn btn-sm" onClick={() => nav("/game/crews")}>{tt("All crews")}</button>
      </div>
      {member && <CrewActivity crewId={crew.id} />}
    </div>
  );
}

export function WithdrawBox({ crew, onChanged }) {
  const { setUser } = useGame();
  const [info, setInfo] = useState(null);
  const [amt, setAmt] = useState(100);
  const load = () => api.get(`/crews/${crew.id}/hall/withdraw`).then((r) => setInfo(r.data)).catch(() => {});
  useEffect(() => { load(); }, [crew.id]); // eslint-disable-line
  const go = async (e) => {
    e.preventDefault();
    try { const r = await api.post(`/crews/${crew.id}/hall/withdraw`, { amount: Number(amt) }); setUser(r.data.user); toast.success(tt("Withdrew {{v0}} gold from the crew bank", { v0: fmt(amt) })); load(); onChanged?.(); }
    catch (ex) { toast.error(errMsg(ex)); }
  };
  if (!info) return null;
  return (
    <form onSubmit={go} className="space-y-1.5 text-[12px]" data-testid="withdraw-form">
      <div className="label">{tt("Withdraw from crew bank · leader only")}</div>
      <div className="flex gap-1">
        <input type="number" min={1} max={info.allowed} className="input !py-1 num" value={amt} onChange={(e) => setAmt(e.target.value)} data-testid="withdraw-input" />
        <button className="btn btn-sm" disabled={Number(amt) < 1 || Number(amt) > info.allowed} data-testid="withdraw-button">{tt("Withdraw")}</button>
      </div>
      <div className="text-[var(--muted)]">{tt("Up to")} {info.share_pct}{tt("% of the bank per")} {info.window_h}h, <b className="text-[var(--text)] num">{fmt(info.allowed)}</b> {tt("gold available now")}{info.withdrawn_24h > 0 && <>, {fmt(info.withdrawn_24h)} {tt("taken in the last")} {info.window_h}h</>}{tt(". Every withdrawal is written in the ledger.")}</div>
    </form>
  );
}

export function EmblemColour({ crew, onChanged }) {
  const [pal, setPal] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/crew-colours").then((r) => setPal(r.data)).catch(() => {}); }, []);
  const pick = async (key) => {
    setBusy(true);
    try { await api.post(`/crews/${crew.id}/colour`, { colour: key }); toast.success(key ? `Emblem dyed ${key}` : "Emblem back to plain"); onChanged?.(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!pal) return null;
  return (
    <Panel icon="crews" title={tt("Emblem colour")} right={<span className="text-[11px] text-[var(--muted)]"><Gold n={pal.cost} /> {tt("from the crew bank per dye")}</span>} testId="crew-colour">
      <div className="text-[12px] text-[var(--text-2)] mb-2">{tt("Colours your")} <b>[{crew.tag}]</b> {tt("in chat, rankings and the crew list. Bank holds")} <Gold n={crew.bank} />.</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(pal.colours).map(([k, hex]) => (
          <button key={k} disabled={busy || crew.colour_key === k} onClick={() => pick(k)} title={k} className={`crew-swatch ${crew.colour_key === k ? "active" : ""}`} style={{ "--sw": hex }} data-testid={`crew-colour-${k}`}><span>[{crew.tag}]</span></button>
        ))}
        {crew.colour && <button disabled={busy} onClick={() => pick(null)} className="crew-swatch" style={{ "--sw": "#a89f95" }} data-testid="crew-colour-plain"><span>{tt("plain")}</span></button>}
      </div>
    </Panel>
  );
}
