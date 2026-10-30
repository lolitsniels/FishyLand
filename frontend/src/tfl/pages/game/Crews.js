/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt, kg, wt, weightUnit, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty, Gold } from "../../components/ui-bits";
import CrewOrder from "../../components/CrewOrder";
import CrewHall from "../../components/CrewHall";
import { CrewBoss } from "../../components/CrewBoss";
import { TABS, CrewTabs, CrewName, CrewHome, WithdrawBox, EmblemColour } from "../../components/CrewTabs";
import { contestVal, PrizeRow } from "./contestBits";
import { t as tt } from "../../i18n";

const left = (end) => {
  const s = Math.max(0, (new Date(end) - Date.now()) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

function CrewChallenges({ myCrewId, focusCrewId }) {
  const nav = useNavigate();
  const [c, setC] = useState(null);
  const [showPast, setShowPast] = useState(false);
  useEffect(() => {
    const load = () => api.get("/contests").then((r) => {
      const cur = r.data.current.find((x) => x.category.startsWith("crew"));
      const past = r.data.past.filter((x) => x.category.startsWith("crew")).slice(0, 5);
      const next = (r.data.upcoming || []).find((x) => x.category.startsWith("crew"));
      setC({ current: cur, past, next });
    }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  if (!c) return null;
  const cur = c.current;
  return (
    <>
      {cur && (
        <Panel icon="tournaments" title={`Weekly crew challenge · ${cur.label}`} right={
          <span className="flex items-center gap-2">
            <span className="num">{tt("ends in")} {left(cur.end)}</span>
            {c.past.length > 0 && <button className="btn btn-sm" onClick={() => setShowPast((v) => !v)} data-testid="toggle-past-champions">{showPast ? tt("Hide past") : tt("Past champions")}</button>}
          </span>
        } bodyClass="!p-0" testId="crew-challenge">
          <div className="px-3 py-1.5 text-[11.5px] text-[var(--text-2)] italic border-b border-[var(--border)]">{cur.desc} {tt("Gold is split among members; every member gets the Pearls.")}{c.next && <span className="not-italic text-[var(--muted)]"> {tt("Next week:")} <span className="tag">{c.next.label}</span></span>}</div>
          <PrizeRow c={cur} shared="split" />
          {cur.standings.length === 0 ? <Empty>{tt("No crews have landed anything yet this week.")}</Empty> : (
            <table className="table"><tbody>
              {cur.standings.map((s, i) => (
                <tr key={s.crew_id} className={(myCrewId === s.crew_id || focusCrewId === s.crew_id) ? "bg-[#1f1714]" : ""} data-testid={`challenge-row-${s.crew_id}`}>
                  <td className="num text-[var(--muted)] w-8">{i + 1}</td>
                  <td><button className="hover:text-[var(--gold)] font-medium" onClick={() => nav(`/game/crews/${s.crew_id}`)}>{s.tag ? `[${s.tag}] ${s.name}` : s.username}</button></td>
                  <td className="num r text-[#ffcfa8]">{contestVal(cur.unit, s.value)}</td>
                </tr>
              ))}
            </tbody></table>
          )}
        </Panel>
      )}
      {showPast && c.past.length > 0 && (
        <Panel icon="rankings" title={tt("Past crew champions")} bodyClass="!p-0" testId="crew-past-champions">
          <table className="table">
            <thead><tr><th>{tt("Closed")}</th><th>{tt("Challenge")}</th><th>{tt("1st")}</th><th>{tt("2nd")}</th><th>{tt("3rd")}</th></tr></thead>
            <tbody>
              {c.past.map((row) => (
                <tr key={row.id}>
                  <td className="text-xs text-[var(--muted)]">{new Date(row.end).toLocaleDateString()}</td>
                  <td className="text-xs">{row.label}</td>
                  {[0, 1, 2].map((i) => { const w = row.winners[i]; return <td key={i}>{w ? <><span className={i === 0 ? "text-[var(--gold)]" : ""}>{w.tag ? `[${w.tag}] ${w.name}` : w.username}</span> <span className="num text-[11px] text-[var(--muted)]">{contestVal(row.unit, w.value)} · {fmt(w.prize)}{tt("g split")}</span></> : <span className="text-[var(--muted)]">-</span>}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

function CreateCrew({ cost, minLevel, onCreated }) {
  const { user } = useGame();
  const [f, setF] = useState({ name: "", tag: "", desc: "", open: true });
  const tooLow = user.level < minLevel;
  const submit = async (e) => {
    e.preventDefault();
    try { const r = await api.post("/crews", f); toast.success(tt("Crew {{v0}} founded", { v0: r.data.name })); onCreated(r.data.id); } catch (ex) { toast.error(errMsg(ex)); }
  };
  if (tooLow) return <div className="text-[12.5px] text-[var(--text-2)]" data-testid="create-crew-locked">{tt("Founding a crew needs")} <span className="text-[var(--gold)]">{tt("level")} {minLevel}</span> {tt("and")} {fmt(cost)} {tt("gold (you're level")} {user.level}{tt("). Anyone can join an existing crew below.")}</div>;
  return (
    <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-[1fr_90px_2fr_auto_auto] gap-2 items-end" data-testid="create-crew-form">
      <div><label className="label block mb-1">{tt("Crew name")}</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={24} data-testid="crew-name-input" /></div>
      <div><label className="label block mb-1">{tt("Tag")}</label><input className="input uppercase" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} maxLength={4} data-testid="crew-tag-input" /></div>
      <div><label className="label block mb-1">{tt("Motto")}</label><input className="input" value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} maxLength={200} data-testid="crew-desc-input" /></div>
      <label className="text-[12px] flex items-center gap-1 pb-1.5"><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} /> {tt("Open to join")}</label>
      <button className="btn btn-gold" disabled={user.gold < cost || f.name.length < 3 || f.tag.length < 2} data-testid="create-crew-button" title={user.gold < cost ? `You need ${fmt(cost)} gold` : ""}>{tt("Found crew (")}{fmt(cost)}g)</button>
    </form>
  );
}

function CrewInbox({ inbox, onChange }) {
  const nav = useNavigate();
  const { refresh } = useGame();
  const respond = async (path, msg) => {
    try {
      const r = await api.post(path);
      toast.success(msg);
      if (r.data.user) await refresh();
      onChange();
    } catch (e) { toast.error(errMsg(e)); }
  };
  if (!inbox || (inbox.invites.length === 0 && inbox.requests.length === 0)) return null;
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {inbox.invites.length > 0 && (
        <Panel icon="messages" title={tt("Crew invites")} bodyClass="!p-0" testId="crew-invites-panel">
          <table className="table"><tbody>
            {inbox.invites.map((iv) => (
              <tr key={iv.id} data-testid={`invite-${iv.id}`}>
                <td>
                  <button className="hover:text-[var(--gold)] font-medium" onClick={() => nav(`/game/crews/${iv.crew_id}`)}>[{iv.crew_tag}] {iv.crew_name}</button>
                  <div className="text-[11px] text-[var(--muted)]">{tt("from")} {iv.from_username} · {ago(iv.created_at)}</div>
                </td>
                <td className="r whitespace-nowrap">
                  <button className="btn btn-sm btn-gold" onClick={() => respond(`/crews/invites/${iv.id}/accept`, `You joined [${iv.crew_tag}] ${iv.crew_name}`)} data-testid={`accept-invite-${iv.id}`}>{tt("Accept")}</button>{" "}
                  <button className="btn btn-sm" onClick={() => respond(`/crews/invites/${iv.id}/decline`, "Invite declined")} data-testid={`decline-invite-${iv.id}`}>{tt("Decline")}</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        </Panel>
      )}
      {inbox.requests.length > 0 && (
        <Panel icon="recruit" title={`Join requests to your crew · ${inbox.requests.length}`} bodyClass="!p-0" testId="crew-requests-panel">
          <table className="table"><tbody>
            {inbox.requests.map((rq) => (
              <tr key={rq.id} data-testid={`request-${rq.id}`}>
                <td>
                  <button className="hover:text-[var(--gold)] font-medium" onClick={() => nav(`/game/profile/${rq.username}`)}>{rq.username}</button>
                  <div className="text-[11px] text-[var(--muted)]">{tt("wants to join [")}{rq.crew_tag}] {rq.crew_name} · {ago(rq.created_at)}</div>
                </td>
                <td className="r whitespace-nowrap">
                  <button className="btn btn-sm btn-gold" onClick={() => respond(`/crews/requests/${rq.id}/approve`, `${rq.username} joined the crew`)} data-testid={`approve-request-${rq.id}`}>{tt("Approve")}</button>{" "}
                  <button className="btn btn-sm" onClick={() => respond(`/crews/requests/${rq.id}/decline`, "Request declined")} data-testid={`decline-request-${rq.id}`}>{tt("Decline")}</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        </Panel>
      )}
    </div>
  );
}

function InviteAnglerBox({ crewId, onSent }) {
  const [u, setU] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    if (!u.trim()) return;
    setBusy(true);
    try { await api.post(`/crews/${crewId}/invite`, { username: u.trim() }); toast.success(tt("Invite whispered to {{v0}}", { v0: u.trim() })); setU(""); onSent(); } catch (ex) { toast.error(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={send} className="flex items-end gap-2 mt-2" data-testid="invite-angler-form">
      <div className="flex-1"><label className="label block mb-1">{tt("Invite an angler")}</label><input className="input" value={u} onChange={(e) => setU(e.target.value)} placeholder={tt("angler name")} maxLength={24} data-testid="invite-angler-input" /></div>
      <button className="btn btn-gold btn-sm" disabled={busy || u.trim().length < 3} data-testid="invite-angler-button">{tt("Send invite")}</button>
    </form>
  );
}

function BroadcastBox({ crew, onSent }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const wait = crew.broadcast_next_at && new Date(crew.broadcast_next_at) > Date.now();
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const r = await api.post(`/crews/${crew.id}/broadcast`, { text: text.trim() }); toast.success(tt("Message sent to {{v0}} crew member{{v1}}", { v0: r.data.sent, v1: r.data.sent === 1 ? "" : "s" })); setText(""); onSent(); }
    catch (ex) { toast.error(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={send} className="mt-3 border-t border-[var(--border)] pt-2" data-testid="crew-broadcast-form">
      <div className="flex items-center justify-between gap-2"><label className="label">{tt("Message the whole crew")}</label><span className="text-[11px] text-[var(--muted)]" data-testid="crew-broadcast-cooldown">{wait ? `next in ${left(crew.broadcast_next_at)}` : tt("one per crew every 24h")}</span></div>
      <div className="flex items-end gap-2 mt-1">
        <textarea className="input flex-1 !py-1.5 min-h-[38px]" rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={wait ? tt("Your crew already sent today's message") : tt("Lands in every member's inbox and the crew chat...")} disabled={!!wait} data-testid="crew-broadcast-input" />
        <button className="btn btn-gold btn-sm" disabled={busy || !!wait || text.trim().length < 3} data-testid="crew-broadcast-send">{tt("Send")}</button>
      </div>
    </form>
  );
}

const RoleTag = ({ role }) => role === "leader" ? <span className="tag ml-1.5 text-[var(--gold)] border-[var(--gold-dim)]" data-testid="role-leader">{tt("leader")}</span>
  : role === "officer" ? <span className="tag ml-1.5 text-[#8fd0f0] border-[#3a6b85]" data-testid="role-officer">{tt("officer")}</span> : null;

export default function Crews() {
  const { id } = useParams();
  const { user, setUser } = useGame();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [crew, setCrew] = useState(null);
  const [inbox, setInbox] = useState(null);
  const [tab, setTab] = useState(() => (id && localStorage.getItem(`owo_crew_tab_${id}`)) || "home");
  const load = () => api.get("/crews").then((r) => setD(r.data)).catch(() => {});
  const loadCrew = () => id && api.get(`/crews/${id}`).then((r) => setCrew(r.data)).catch(() => nav("/game/crews"));
  const loadInbox = () => api.get("/crews/inbox").then((r) => setInbox(r.data)).catch(() => {});
  useEffect(() => { load(); loadInbox(); }, []);
  useEffect(() => { setCrew(null); loadCrew(); setTab((id && localStorage.getItem(`owo_crew_tab_${id}`)) || "home"); }, [id]); // eslint-disable-line
  const refreshAll = () => { load(); loadCrew(); loadInbox(); window.dispatchEvent(new CustomEvent("crew-inbox-changed")); };
  const act = async (path, msg) => { try { const r = await api.post(path); if (r.data.username) setUser(r.data); toast.success(msg); refreshAll(); } catch (e) { toast.error(errMsg(e)); } };
  const apply = async (c) => { try { const r = await api.post(`/crews/${c.id}/apply`); toast.success(r.data.joined ? `You joined ${c.name}` : `Request sent to ${c.name}`); if (r.data.joined) { const me = await api.get("/auth/me"); setUser(me.data); } refreshAll(); } catch (e) { toast.error(errMsg(e)); } };
  if (!d) return null;
  const mine = user.crew;

  if (id && crew) {
    const isLeader = crew.leader === user.username;
    const isOfficer = (crew.officers || []).includes(user.username);
    const canManage = isLeader || isOfficer;
    const member = crew.members.some((m) => m.username === user.username);
    const roleAct = async (path, name, msg) => { try { await api.post(`/crews/${crew.id}/${path}`, { username: name }); toast.success(msg); loadCrew(); } catch (e) { toast.error(errMsg(e)); } };
    const allowed = TABS.filter(([, , , need]) => !need || (need === "manage" ? canManage : member)).map(([k]) => k);
    const cur = allowed.includes(tab) ? tab : "home";
    const pick = (t) => { setTab(t); localStorage.setItem(`owo_crew_tab_${crew.id}`, t); };
    return (
      <div className="space-y-3 fade-in" data-testid="crew-detail-page">
        <div className="panel px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="font-serif text-[15px] text-[#f4ead2] truncate"><CrewName crew={crew} /></div>
          <CrewTabs tab={cur} setTab={pick} member={member} canManage={canManage} />
        </div>
        {cur === "home" && <CrewHome crew={crew} member={member} mine={mine} onJoin={() => act(`/crews/${crew.id}/join`, `You joined ${crew.name}`)} onRequest={() => apply(crew)} onLeave={() => act(`/crews/${crew.id}/leave`, `You left ${crew.name}`)} />}
        {cur === "members" && (
          <Panel icon="angler" title={tt("Members · this week's contribution")} bodyClass="!p-0" testId="crew-members">
            <table className="table">
              <thead><tr><th>{tt("Angler")}</th><th className="r">{tt("Lv")}</th><th className="r">{tt("Catches")}</th><th className="r">{tt("Weight")}</th><th className="r">{tt("Seen")}</th>{isLeader && <th></th>}</tr></thead>
              <tbody>{crew.members.map((m) => <tr key={m.user_id} className={m.username === user.username ? "bg-[#1f1714]" : ""} data-testid={`member-row-${m.username}`}>
                <td><button className="hover:text-[var(--gold)]" onClick={() => nav(`/game/profile/${m.username}`)}>{m.username}</button><RoleTag role={m.role} /></td>
                <td className="num r">{m.level}</td><td className="num r">{m.week_catches}</td><td className="num r">{wt(m.week_kg)}</td><td className="r text-xs text-[var(--muted)]">{m.last_seen ? ago(m.last_seen) : "-"}</td>
                {isLeader && <td className="r whitespace-nowrap">
                  {m.username !== user.username && (m.role === "officer"
                    ? <button className="btn btn-sm" onClick={() => roleAct("demote", m.username, `${m.username} is no longer an officer`)} data-testid={`demote-${m.username}`}>{tt("Demote")}</button>
                    : <button className="btn btn-sm" onClick={() => roleAct("promote", m.username, `${m.username} is now an officer`)} data-testid={`promote-${m.username}`}>{tt("Make officer")}</button>)}
                  {m.username !== user.username && <> <button className="btn btn-sm btn-danger" onClick={async () => { try { await api.post(`/crews/${crew.id}/kick`, { username: m.username }); toast.success(tt("{{v0}} removed", { v0: m.username })); loadCrew(); } catch (e) { toast.error(errMsg(e)); } }} data-testid={`kick-${m.username}`}>{tt("Kick")}</button></>}
                </td>}
              </tr>)}</tbody>
            </table>
          </Panel>
        )}
        {cur === "contest" && <CrewChallenges myCrewId={mine?.id} focusCrewId={crew.id} />}
        {cur === "contract" && <CrewOrder crewId={crew.id} />}
        {cur === "leviathan" && <CrewBoss />}
        {cur === "hall" && <CrewHall crew={crew} canManage={canManage} member={member} onChanged={loadCrew} extra={isLeader && <WithdrawBox crew={crew} onChanged={loadCrew} />} />}
        {cur === "manage" && (
          <div className="space-y-3" data-testid="crew-manage">
            <Panel icon="gear" title={tt("Crew settings")}>
              <div className="flex gap-2 flex-wrap items-center text-[12.5px]">
                <span>{crew.open ? tt("Anyone can join.") : tt("Invite only, requests need approval.")}</span>
                {isLeader && <button className="btn btn-sm" onClick={async () => { await api.post(`/crews/${crew.id}/settings`, { open: !crew.open }); loadCrew(); }} data-testid="toggle-open-button">{crew.open ? tt("Make invite-only") : tt("Open to join")}</button>}
              </div>
              {crew.member_count < crew.max_members && <InviteAnglerBox crewId={crew.id} onSent={refreshAll} />}
              <BroadcastBox crew={crew} onSent={loadCrew} />
            </Panel>
            <CrewInbox inbox={{ invites: [], requests: (inbox?.requests || []).filter((r) => r.crew_id === crew.id) }} onChange={refreshAll} />
            {isLeader && <EmblemColour crew={crew} onChanged={loadCrew} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 fade-in" data-testid="crews-page">
      <Panel icon="crews" title={tt("Crews")} right={<span className="num">{tt("weekly contest ends in")} {Math.max(0, Math.floor((new Date(d.week_end) - Date.now()) / 3600000))}h</span>}>
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Crews of up to")} {d.max} {tt("anglers (more with a bigger hall) compete in a weekly crew challenge that rotates between total weight, species landed and rarity points, and share one big")} <b>{tt("weekly crew order")}</b> {tt("from a dockside patron, fill every line together and the payout is split by contribution, with a cut for the crew bank. The winning crew splits the gold, every member pockets Pearls, and the crew earns a win on its record. Members share a private chat channel and a crew hall: deposit gold into the crew bank and the leader (or an officer the leader appoints) builds perks, extra luck, market slots, faster energy and a grander hall, for everyone.")}</p>
        {mine ? <div className="mt-2 text-[13px]">{tt("You sail with")} <button className="text-[var(--gold)] underline" onClick={() => nav(`/game/crews/${mine.id}`)} data-testid="my-crew-link">[{mine.tag}] {mine.name}</button></div>
          : <div className="mt-3"><CreateCrew cost={d.cost} minLevel={d.min_level} onCreated={async (cid) => { const r = await api.get("/auth/me"); setUser(r.data); load(); nav(`/game/crews/${cid}`); }} /></div>}
      </Panel>
      <CrewInbox inbox={inbox} onChange={refreshAll} />
      <Panel icon="rankings" title={tt("Crew standings · this week")} bodyClass="!p-0" testId="crew-standings">
        {d.crews.length === 0 ? <Empty>{tt("No crews yet. Found the first one.")}</Empty> : (
          <table className="table">
            <thead><tr><th></th><th>{tt("Crew")}</th><th>{tt("Leader")}</th><th className="r">{tt("Members")}</th><th className="r">{tt("Wins")}</th><th className="r">{tt("Weekly")} {weightUnit()}</th><th></th></tr></thead>
            <tbody>{d.crews.map((c, i) => <tr key={c.id} className={mine?.id === c.id ? "bg-[#1f1714]" : ""} data-testid={`crew-row-${c.id}`}>
              <td className="num text-[var(--muted)] w-8">{i + 1}</td>
              <td><button className="hover:text-[var(--gold)] font-medium" onClick={() => nav(`/game/crews/${c.id}`)}><CrewName crew={c} /></button><div className="text-[11px] text-[var(--muted)] italic truncate max-w-xs">{c.desc}</div></td>
              <td>{c.leader}</td><td className="num r">{c.member_count}/{c.max_members}</td><td className="num r">{c.wins}</td><td className="num r text-[#ffcfa8]">{kg(c.weekly_kg)}</td>
              <td className="r">
                {!mine && c.open && c.member_count < c.max_members && <button className="btn btn-sm btn-gold" onClick={() => act(`/crews/${c.id}/join`, `You joined ${c.name}`)} data-testid={`join-${c.id}`}>{tt("Join")}</button>}
                {!mine && !c.open && c.member_count < c.max_members && <button className="btn btn-sm" onClick={() => apply(c)} data-testid={`request-${c.id}`}>{tt("Request")}</button>}
                {!c.open && c.member_count >= c.max_members && <span className="text-[11px] text-[var(--muted)]">{tt("full")}</span>}
              </td>
            </tr>)}</tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
