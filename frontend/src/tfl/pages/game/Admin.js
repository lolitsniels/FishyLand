/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Empty } from "../../components/ui-bits";
import { GrantPanel } from "../../components/admin/GrantPanel";
import { ModerationPanel } from "../../components/admin/ModerationPanel";
import { ChatModeration } from "../../components/admin/ChatModeration";
import { Announcements } from "../../components/admin/Announcements";
import { BossSpawn } from "../../components/admin/BossSpawn";
import { RandomEvents } from "../../components/admin/RandomEvents";
import { OnlineNow } from "../../components/admin/OnlineNow";
import { CheatLog } from "../../components/admin/CheatLog";
import { Suspicious } from "../../components/admin/Suspicious";
import { Doubles } from "../../components/admin/Doubles";
import { Traffic } from "../../components/admin/Traffic";
import { Boosters } from "../../components/admin/Boosters";
import { MailOut } from "../../components/admin/MailOut";
import { SocialLinks } from "../../components/admin/SocialLinks";
import { MediaLibrary } from "../../components/admin/MediaLibrary";

const TABS = [["anglers", "Anglers"], ["boosters", "Boosters"], ["chat", "Chat"], ["announce", "Announcements"], ["mail", "Email players"], ["social", "Social links"], ["media", "Media"], ["cheats", "Flagged fights"], ["suspicious", "Bot catcher"], ["doubles", "Doubles"], ["traffic", "Traffic"], ["log", "Log"]];

function Overview({ o }) {
  if (!o) return null;
  const cells = [["Anglers", o.players, `${o.new_today} new today`], ["Online", o.online], ["Guests", o.guests, `${o.new_guests_today} new today`], ["Admins", o.admins], ["Banned", o.banned], ["Muted", o.muted], ["Catches", o.catches], ["Open listings", o.open_listings], ["Chat today", o.chat_today]];
  return (
    <div className="grid grid-cols-3 md:grid-cols-9 gap-px bg-[var(--border)] border border-[var(--border)]" data-testid="admin-overview">
      {cells.map(([l, v, sub]) => <div key={l} className="bg-[var(--bg)] px-2 py-1.5 text-center" title={sub || undefined} data-testid={`admin-overview-${l.toLowerCase().replace(/ /g, "-")}`}><div className="num text-[15px] text-[#ffcfa8]">{fmt(v)}</div><div className="label text-[9.5px]">{l}</div>{sub && <div className="text-[9.5px] text-[var(--muted)] leading-tight mt-0.5">{sub}</div>}</div>)}
    </div>
  );
}

function AdminLog({ log }) {
  return (
    <Panel icon="admin" title="Admin log" bodyClass="!p-0" testId="admin-log">
      {log.length === 0 ? <Empty>No actions yet.</Empty> : (
        <div className="overflow-x-auto max-w-full"><table className="table min-w-[560px]"><tbody>{log.map((l, i) => <tr key={i}><td className="text-xs text-[var(--muted)] whitespace-nowrap">{new Date(l.at).toLocaleString()}</td><td className="whitespace-nowrap">{l.admin}</td><td className="text-[var(--muted)] text-[11px]">{l.action || "grant"}</td><td className="whitespace-nowrap">{l.target}</td><td className="text-[var(--text-2)]">{l.changes.join(", ")}</td></tr>)}</tbody></table></div>
      )}
    </Panel>
  );
}

function MergePanel({ target, onChanged }) {
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const merge = async () => {
    if (!window.confirm(`Move everything from ${source} into ${target.username} and delete ${source}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const r = await api.post("/admin/merge", { username: target.username, source: source.trim() });
      toast.success(`Merged: ${r.data.moved_catches} catches and ${r.data.new_species} new species moved to ${target.username}`);
      setSource(""); onChanged(r.data.user);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Panel icon="admin" title={`Merge an old account into ${target.username}`} testId="admin-merge-panel">
      <div className="text-[12px] text-[var(--text-2)] mb-2">For players who played as a guest, then registered a fresh account: type the old (guest) name below. Its catches, journal, boss kills, gold, XP, Pearls, bait and stats move to {target.username}; the old account is then deleted.</div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input !w-auto flex-1 min-w-[200px]" placeholder="Old account name, e.g. Guest_ab12cd" value={source} onChange={(e) => setSource(e.target.value)} data-testid="admin-merge-source" />
        <button className="btn btn-gold" disabled={busy || source.trim().length < 3 || source.trim().toLowerCase() === target.username.toLowerCase()} onClick={merge} data-testid="admin-merge-button">Merge into {target.username}</button>
      </div>
    </Panel>
  );
}

export default function Admin() {
  const { user, data } = useGame();
  const [tab, setTab] = useState("anglers");
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState([]);
  const [target, setTarget] = useState(null);
  const [log, setLog] = useState([]);
  const [overview, setOverview] = useState(null);
  const search = (term = q) => api.get("/admin/players", { params: { q: term } }).then((r) => setPlayers(r.data)).catch((e) => toast.error(errMsg(e)));
  const loadLog = () => api.get("/admin/log").then((r) => setLog(r.data)).catch(() => {});
  const loadOverview = () => api.get("/admin/overview").then((r) => setOverview(r.data)).catch(() => {});
  useEffect(() => { search(); loadLog(); loadOverview(); }, []); // eslint-disable-line
  if (!user.is_admin) return <Empty>Admins only.</Empty>;
  if (!data) return null;
  const onChanged = (u) => { setTarget(u); setPlayers((ps) => ps.map((p) => (p.id === u.id ? u : p))); loadLog(); loadOverview(); };
  const onDeleted = (u) => { setTarget(null); setPlayers((ps) => ps.filter((p) => p.id !== u.id)); loadLog(); loadOverview(); };
  const pickPlayer = async (name) => {
    setQ(name); setTab("anglers");
    const r = await api.get("/admin/players", { params: { q: name } }).catch(() => null);
    if (r) { setPlayers(r.data); setTarget(r.data.find((p) => p.username === name) || null); }
  };
  return (
    <div className="space-y-3 fade-in" data-testid="admin-page">
      <Overview o={overview} />
      <div className="flex gap-1 border-b border-[var(--border)] overflow-x-auto whitespace-nowrap scrollbar-thin" data-testid="admin-tabs">
        {TABS.map(([k, l]) => <button key={k} onClick={() => { setTab(k); if (k === "log") loadLog(); }} className={`shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px ${tab === k ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} data-testid={`admin-tab-${k}`}>{l}</button>)}
      </div>
      {tab === "anglers" && (
        <div className="space-y-3">
        <OnlineNow onPick={pickPlayer} />
        <div className="grid lg:grid-cols-[300px_1fr] gap-3">
          <Panel icon="angler" title="Anglers" testId="admin-players">
            <div className="flex gap-1 mb-2"><input className="input" placeholder="Search name..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} data-testid="admin-search-input" /><button className="btn btn-sm" onClick={() => search()} data-testid="admin-search-button">Find</button></div>
            {players.length === 0 ? <Empty>No anglers match.</Empty> : (
              <table className="table"><tbody>
                {players.map((p) => <tr key={p.id} className={target?.id === p.id ? "bg-[#1f1714]" : "cursor-pointer"} onClick={() => setTarget(p)} data-testid={`admin-player-${p.username}`}>
                  <td className="truncate max-w-[150px]">{p.username}{p.is_admin && <span className="tag ml-1 text-[var(--gold)]">admin</span>}{p.role === "mod" && <span className="tag ml-1 text-[#7fd6b8]">mod</span>}{p.banned && <span className="tag ml-1 text-[#f0a5a3]">banned</span>}{p.mute && <span className="tag ml-1 text-[#ffcfa8]">muted</span>}{p.is_guest && <span className="tag ml-1">guest</span>}</td>
                  <td className="num r text-[var(--muted)]">Lv {p.level}</td><td className="r"><Gold n={p.gold} /></td></tr>)}
              </tbody></table>
            )}
          </Panel>
          <div className="space-y-3 min-w-0">
            {!target ? <Panel icon="angler" title="Select an angler"><Empty>Pick a player on the left to moderate or grant items.</Empty></Panel> : (
              <>
                <ModerationPanel target={target} onChanged={onChanged} onDeleted={onDeleted} />
                <GrantPanel target={target} onChanged={onChanged} />
                <MergePanel target={target} onChanged={onChanged} />
              </>
            )}
            <BossSpawn />
            <RandomEvents />
          </div>
        </div>
        </div>
      )}
      {tab === "chat" && <ChatModeration onPickPlayer={pickPlayer} />}
      {tab === "boosters" && <Boosters onPickPlayer={pickPlayer} />}
      {tab === "announce" && <Announcements />}
      {tab === "mail" && <MailOut />}
      {tab === "social" && <SocialLinks />}
      {tab === "media" && <MediaLibrary />}
      {tab === "cheats" && <CheatLog onPickPlayer={pickPlayer} />}
      {tab === "suspicious" && <Suspicious onPickPlayer={pickPlayer} />}
      {tab === "doubles" && <Doubles onPickPlayer={pickPlayer} />}
      {tab === "traffic" && <Traffic />}
      {tab === "log" && <AdminLog log={log} />}
    </div>
  );
}
