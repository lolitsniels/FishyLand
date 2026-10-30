/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { X, Palette } from "lucide-react";
import { api, errMsg, ago } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel, Empty, AdminBadge } from "./ui-bits";
import { Avatar } from "./Avatar";
import { t as tt } from "../i18n";

function WallPicker({ current, onChanged }) {
  const { setUser } = useGame();
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
  const set = async (wall_id, name) => {
    try { const r = await api.post("/cosmetics/wall", { wall_id }); setUser(r.data.user); toast.success(wall_id ? `Guestbook panelled in ${name}` : "Back to the plain guestbook"); onChanged?.(); setOpen(false); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const owned = cos?.walls.filter((w) => w.owned) || [];
  return (
    <span className="relative" ref={boxRef}>
      <button type="button" className="btn btn-sm !px-1.5 !py-0.5 !text-[10px] inline-flex items-center gap-1" onClick={() => setOpen((o) => !o)} title={tt("Change the guestbook wall")} data-testid="guestbook-edit-wall-button"><Palette size={11} /> {tt("Wall")}</button>
      {open && (
        <div className="absolute right-0 top-full mt-1 panel panel-gold w-56 z-30 text-[12px]" data-testid="wall-popover">
          <header className="panel-head !py-1 !text-[10px]">{tt("Guestbook wall")}</header>
          <div className="p-2 space-y-1">
            <button type="button" className={`w-full flex items-center justify-between px-1.5 py-1 text-left border ${!current ? "border-[var(--gold)] bg-[#1f1714]" : "border-transparent hover:border-[var(--border)]"}`} onClick={() => set(null)} data-testid="wall-option-none"><span>{tt("Plain panel")}</span>{!current && <span className="text-[10px] text-[var(--gold)]">{tt("In use")}</span>}</button>
            {cos === null ? <div className="text-[var(--muted)] italic text-[11px] px-1.5">{tt("Loading...")}</div> :
             owned.length === 0 ? <div className="text-[var(--muted)] text-[11px] px-1.5">{tt("You don't own any walls yet.")} <Link to="/game/pearl-shop" className="underline" onClick={() => setOpen(false)}>{tt("Shop →")}</Link></div> :
             owned.map((w) => (
              <button type="button" key={w.id} className={`w-full panel gb-wall gb-wall-${w.id} !p-1.5 text-left ${current === w.id ? "panel-gold" : ""}`} onClick={() => set(w.id, w.name)} data-testid={`wall-option-${w.id}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-display text-[12px] truncate">{w.name}</span>{current === w.id && <span className="text-[10px]">{tt("In use")}</span>}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export default function Guestbook({ username, isMine }) {
  const [state, setState] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/players/${username}/guestbook`).then((r) => { setState(r.data); if (isMine) window.dispatchEvent(new CustomEvent("guestbook-changed")); }).catch(() => {});
  useEffect(() => { setState(null); setText(""); load(); }, [username]); // eslint-disable-line

  const post = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api.post(`/players/${username}/guestbook`, { text: text.trim() });
      setText("");
      toast.success(tt("Signed {{v0}}'s guestbook", { v0: username }));
      load();
    } catch (ex) { toast.error(errMsg(ex)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    try { await api.delete(`/players/${username}/guestbook/${id}`); toast.success(tt("Entry removed")); load(); }
    catch (ex) { toast.error(errMsg(ex)); }
  };

  if (!state) return null;
  const max = state.max_chars;
  const remaining = max - text.length;
  const disabled = busy || !text.trim() || text.length > max;

  return (
    <Panel icon="chat" title={isMine ? tt("Your guestbook") : `${username}'s guestbook`} right={<span className="flex items-center gap-2"><span className="num text-[11px] text-[var(--muted)]">{state.entries.length} {tt("entr")}{state.entries.length === 1 ? "y" : tt("ies")}</span>{isMine && <WallPicker current={state.wall} onChanged={load} />}</span>} testId="guestbook-panel" className={state.wall ? `gb-wall gb-wall-${state.wall}` : ""}>
      {state.can_post ? (
        <form onSubmit={post} className="mb-3 border border-[var(--border)] bg-[var(--bg-2)] p-2" data-testid="guestbook-form">
          <textarea className="input !w-full !h-16 resize-none" maxLength={max} placeholder={isMine ? tt("Leave a note for future visitors...") : `Leave a note on ${username}'s page...`} value={text} onChange={(e) => setText(e.target.value)} data-testid="guestbook-input" />
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className={`text-[11px] ${remaining < 0 ? "text-[#f0a5a3]" : "text-[var(--muted)]"}`}>{remaining} / {max}</span>
            <button className="btn btn-sm btn-gold" disabled={disabled} data-testid="guestbook-submit-button">{busy ? tt("Signing...") : tt("Sign guestbook")}</button>
          </div>
        </form>
      ) : (
        <div className="mb-3 text-[11.5px] text-[var(--muted)] border border-dashed border-[var(--border)] px-2 py-1.5" data-testid="guestbook-locked-note">
          {state.guest ? <>{tt("Claim your account to sign guestbooks.")} <Link to="/game/profile" className="underline">{tt("Choose a name and password")}</Link></> :
           state.muted ? tt("You are muted and cannot sign guestbooks right now.") :
           tt("Signing is currently disabled for your account.")}
        </div>
      )}

      {state.entries.length === 0 ? <Empty>{isMine ? tt("Nobody has signed your guestbook yet. Share your profile with other anglers!") : tt("Nobody has signed this guestbook yet, be the first.")}</Empty> : (
        <ul className="space-y-2" data-testid="guestbook-entries">
          {state.entries.map((e) => (
            <li key={e.id} className="group flex gap-2 border-b border-[#221e1b] pb-2 last:border-0" data-testid={`guestbook-entry-${e.id}`}>
              {e.author_avatar && <Link to={`/game/profile/${e.author}`} className="shrink-0" title={e.author}><Avatar id={e.author_avatar} size="sm" frame={e.author_frame} /></Link>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link to={`/game/profile/${e.author}`} className="font-medium text-[12.5px] hover:underline" style={e.author_colour ? { color: e.author_colour } : undefined} data-testid={`guestbook-author-${e.id}`}>{e.author}</Link>
                  {e.author_admin && <AdminBadge className="!text-[8px]" />}
                  <span className="text-[10.5px] text-[var(--muted)]">{ago(e.at)}</span>
                </div>
                <div className="text-[12.5px] text-[var(--text-2)] whitespace-pre-wrap break-words mt-0.5">{e.text}</div>
              </div>
              {e.can_delete && (
                <button className="text-[var(--muted)] hover:text-[#f0a5a3] opacity-0 group-hover:opacity-100 shrink-0" title={tt("Remove entry")} onClick={() => remove(e.id)} data-testid={`guestbook-delete-${e.id}`}><X size={13} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
