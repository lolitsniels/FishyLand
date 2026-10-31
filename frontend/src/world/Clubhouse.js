import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Modal from "../components/panels/Modal";
import { api, errMsg, fmt, wt, ago } from "../tfl/lib/api";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { CrewInbox, InviteAnglerBox, BroadcastBox } from "../tfl/pages/game/Crews";
import { CrewActivity, EmblemColour, WithdrawBox, CrewName } from "../tfl/components/CrewTabs";
import { lookFace } from "../game/look";

const TITLES = { "club-notice": "Notice Board", "club-portraits": "Member Portraits", "club-trophies": "Trophy Shelf", "club-desk": "Captain's Desk", "club-mail": "Mailbox" };
const Box = ({ title, children, testid }) => (
  <div className="panel p-3 mb-3" data-testid={testid}>
    {title && <div className="font-cinzel font-bold text-amber-200 text-sm mb-2">{title}</div>}
    {children}
  </div>
);
const ReadOnly = () => <p className="text-[12.5px] text-amber-100/70 italic" data-testid="club-readonly">Only the leader and officers can change this.</p>;

function MotdEditor({ crew, reload }) {
  const [text, setText] = useState(crew.motd || "");
  const save = async () => { try { await api.post(`/crews/${crew.id}/hall/motd`, { text }); toast.success("Notice pinned"); reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="flex flex-col gap-2 mt-2">
      <textarea className="input w-full min-h-[70px] text-[13px]" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pin a notice for the crew" data-testid="club-motd-input" />
      <div className="flex justify-end"><button className="btn btn-gold btn-sm" onClick={save} data-testid="club-motd-save">Pin notice</button></div>
    </div>
  );
}

function Notice({ crew, canManage, reload }) {
  return <>
    <Box title="Crew notice" testid="club-motd"><p className="text-[13px] italic text-[#f4ead2]">{crew.motd || "Nothing pinned yet."}</p>{canManage && <MotdEditor crew={crew} reload={reload} />}</Box>
    {canManage && <Box testid="club-broadcast"><BroadcastBox crew={crew} onSent={reload} /></Box>}
    <CrewActivity crewId={crew.id} />
  </>;
}

function Portraits({ crew, me, reload, onClose }) {
  const nav = useNavigate();
  const isLeader = crew.leader === me;
  const role = async (path, name, msg) => { try { await api.post(`/crews/${crew.id}/${path}`, { username: name }); toast.success(msg); reload(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="club-portrait-grid">
      {crew.members.map((m) => (
        <div key={m.user_id} className="panel p-2 flex flex-col items-center text-center gap-1" data-testid={`portrait-${m.username}`}>
          <button type="button" onClick={() => { onClose(); nav(`/game/profile/${encodeURIComponent(m.username)}`); }} className="club-frame" data-testid={`portrait-open-${m.username}`}>
            <img src={m.avatar ? lookFace(m.avatar) : "/art/hud/mascot.webp"} alt={m.username} />
          </button>
          <b className="text-[13px] text-[#f4ead2] truncate max-w-full">{m.username}</b>
          <span className="text-[11px] text-amber-200/80">{m.role === "leader" ? "Captain" : m.role === "officer" ? "Officer" : "Deckhand"} · Lv {m.level}</span>
          <span className="text-[10.5px] text-amber-100/60">{m.week_catches} fish this week · {m.last_seen ? ago(m.last_seen) : "-"}</span>
          {isLeader && m.username !== me && (
            <div className="flex gap-1 mt-1">
              {m.role === "officer"
                ? <button className="btn btn-sm" onClick={() => role("demote", m.username, `${m.username} is no longer an officer`)} data-testid={`demote-${m.username}`}>Demote</button>
                : <button className="btn btn-sm" onClick={() => role("promote", m.username, `${m.username} is now an officer`)} data-testid={`promote-${m.username}`}>Officer</button>}
              <button className="btn btn-sm btn-danger" onClick={() => role("kick", m.username, `${m.username} removed`)} data-testid={`kick-${m.username}`}>Kick</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Trophies({ crew }) {
  const t = crew.trophies || { catches: 0, kg: 0, species: 0, best: [] };
  const stats = [["Fish landed", fmt(t.catches)], ["Total weight", wt(t.kg)], ["Species", fmt(t.species)], ["Anglers", `${crew.member_count} / ${crew.max_members}`], ["Founded", ago(crew.created_at)], ["Hall tier", crew.hall_tier || 0]];
  return <>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3" data-testid="club-trophy-stats">
      {stats.map(([k, v]) => <div key={k} className="panel px-3 py-2"><div className="label">{k}</div><div className="text-[14px] text-[#f4ead2] font-bold">{v}</div></div>)}
    </div>
    <Box title="Biggest catches" testid="club-trophy-best">
      {t.best.length ? t.best.map((b, i) => (
        <div key={i} className="flex justify-between text-[13px] py-1 border-b border-amber-900/30 last:border-0"><span>{i + 1}. {b.name} <span className="text-amber-100/60">by {b.by}</span></span><b>{wt(b.weight)}</b></div>
      )) : <p className="text-[12.5px] text-amber-100/70">No fish landed for the crew yet.</p>}
    </Box>
  </>;
}

function Desk({ crew, canManage, isLeader, reload, onLeave }) {
  return <>
    <Box title="Joining" testid="club-desk-open">
      <div className="flex gap-2 items-center flex-wrap text-[12.5px]">
        <span>{crew.open ? "Anyone can join." : "Invite only, requests need approval."}</span>
        {isLeader && <button className="btn btn-sm" onClick={async () => { await api.post(`/crews/${crew.id}/settings`, { open: !crew.open }); reload(); }} data-testid="toggle-open-button">{crew.open ? "Make invite-only" : "Open to join"}</button>}
      </div>
      {!isLeader && <p className="text-[12.5px] text-amber-100/70 italic" data-testid="club-readonly">Only the captain can change who may join.</p>}
    </Box>
    {canManage && crew.member_count < crew.max_members && <Box title="Invite an angler" testid="club-desk-invite"><InviteAnglerBox crewId={crew.id} onSent={reload} /></Box>}
    {isLeader && <EmblemColour crew={crew} onChanged={reload} />}
    {isLeader && <WithdrawBox crew={crew} onChanged={reload} />}
    <div className="flex justify-end mt-2"><button className="btn btn-danger btn-sm" onClick={onLeave} data-testid="leave-crew-button">Leave crew</button></div>
  </>;
}

// Opens when you walk up to a piece of furniture inside the crew clubhouse.
export function ClubhousePanel({ spot, onClose }) {
  const { user, setUser } = useTfl();
  const [crew, setCrew] = useState(null);
  const [inbox, setInbox] = useState(null);
  const cid = user?.crew?.id;
  const reload = () => { if (!cid) return; api.get(`/crews/${cid}`).then((r) => setCrew(r.data)).catch(() => {}); api.get("/crews/inbox").then((r) => setInbox(r.data)).catch(() => {}); };
  useEffect(reload, [cid]); // eslint-disable-line
  const canManage = crew && (crew.leader === user.username || (crew.officers || []).includes(user.username));
  const isLeader = crew?.leader === user.username;
  const leave = async () => {
    try { const r = await api.post(`/crews/${crew.id}/leave`); if (r.data?.username) setUser(r.data); toast.success(`You left ${crew.name}`); onClose(); window.dispatchEvent(new CustomEvent("fr-mode", { detail: "harbour" })); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Modal title={TITLES[spot]} testid="clubhouse-modal" width={760} onClose={onClose}>
      {!crew ? <div className="p-6 text-center text-amber-100/70">Loading…</div> : (
        <div className="tfl-skin" data-testid={`club-panel-${spot}`}>
          <div className="text-center font-display text-[15px] text-[#f4ead2] mb-3"><CrewName crew={crew} /></div>
          {spot === "club-notice" && <Notice crew={crew} canManage={canManage} reload={reload} />}
          {spot === "club-portraits" && <Portraits crew={crew} me={user.username} reload={reload} onClose={onClose} />}
          {spot === "club-trophies" && <Trophies crew={crew} />}
          {spot === "club-desk" && <Desk crew={crew} canManage={canManage} isLeader={isLeader} reload={reload} onLeave={leave} />}
          {spot === "club-mail" && (canManage
            ? (((inbox?.requests || []).filter((r) => r.crew_id === crew.id)).length
              ? <CrewInbox inbox={{ invites: [], requests: inbox.requests.filter((r) => r.crew_id === crew.id) }} onChange={reload} />
              : <Box testid="club-mail-empty"><p className="text-[13px] text-amber-100/80">No letters today. Join requests to the crew land here.</p></Box>)
            : <Box testid="club-mail-locked"><ReadOnly /></Box>)}
        </div>
      )}
    </Modal>
  );
}
