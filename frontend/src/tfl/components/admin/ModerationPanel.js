/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel } from "../ui-bits";

const MUTE_OPTIONS = [["60", "1 hour"], ["1440", "24 hours"], ["10080", "7 days"], ["0", "Permanent"]];

function Row({ label, children }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-[#221e1b] py-2 last:border-0"><span className="label w-32 shrink-0">{label}</span>{children}</div>;
}

export function ModerationPanel({ target, onChanged, onDeleted }) {
  const { user } = useGame();
  const [reason, setReason] = useState("");
  const [muteMin, setMuteMin] = useState("60");
  const [newPw, setNewPw] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const self = target.username === user.username;
  const act = async (path, body, ok) => {
    try { const r = await api.post(`/admin/${path}`, { username: target.username, ...body }); toast.success(ok); if (r.data.user) onChanged(r.data.user); return r; }
    catch (e) { toast.error(errMsg(e)); }
  };
  const setMod = async (mod) => {
    try { await api.post("/admin/mod", { username: target.username, mod }); toast.success(mod ? `${target.username} is now a MOD` : `${target.username} is no longer a MOD`); return true; }
    catch (e) { toast.error(errMsg(e)); return false; }
  };
  const del = async () => {
    const r = await act("delete", { confirm: confirmName }, `${target.username} deleted`);
    if (r) { setConfirmName(""); onDeleted(target); }
  };
  const status = target.banned ? <span className="tag text-[#f0a5a3] border-[#6b2b2b]">banned</span> : target.mute ? <span className="tag text-[#ffcfa8]">muted</span> : <span className="tag text-[var(--energy)]">in good standing</span>;
  return (
    <Panel title={`Moderate ${target.username}`} right={<span className="flex items-center gap-2">{target.is_admin && <span className="tag text-[var(--gold)]">admin</span>}{target.supporter && <span className="tag text-[#e8647a]" data-testid="admin-supporter-tag">♥ supporter</span>}{target.is_guest && <span className="tag">guest</span>}{status}</span>} testId="admin-moderation-panel">
      <div className="text-[12px]">
        <Row label="Account">
          <span className="text-[var(--text-2)]">Lv {target.level} · {target.stats.catches} catches · {target.email || "no email"} · last seen {target.last_seen ? ago(target.last_seen) : "never"} · came from <b data-testid="admin-player-source">{target.source || "unknown"}</b></span>
        </Row>
        <Row label="IP address">
          <span className="text-[var(--text-2)] flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <b className="num text-[#f4ead2] select-all" data-testid="admin-player-ip">{target.last_ip || "not recorded yet"}</b>
            {target.last_ip_at && <span className="text-[var(--muted)]">seen {ago(target.last_ip_at)}</span>}
            {target.recent_ips?.length > 1 && <span className="text-[var(--muted)]" data-testid="admin-player-ips">· also: {target.recent_ips.filter((ip) => ip !== target.last_ip).join(", ")}</span>}
            {target.last_ip && <a className="underline text-[var(--muted)]" href={`https://ipinfo.io/${target.last_ip}`} target="_blank" rel="noopener noreferrer">lookup</a>}
          </span>
        </Row>
        <Row label="Reason (optional)">
          <input className="input !w-auto flex-1 min-w-[200px]" placeholder="Shown to the player" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} data-testid="admin-reason-input" />
        </Row>
        <Row label="Account ban">
          {target.banned ? (
            <>
              <span className="text-[#f0a5a3]">Banned {ago(target.banned.at)} by {target.banned.by}{target.banned.reason && `: ${target.banned.reason}`}</span>
              <button className="btn btn-sm" onClick={() => act("unban", {}, `${target.username} unbanned`)} data-testid="admin-unban-button">Lift ban</button>
            </>
          ) : <button className="btn btn-sm" disabled={self} onClick={() => act("ban", { reason }, `${target.username} banned`)} data-testid="admin-ban-button">Ban account</button>}
        </Row>
        <Row label="Chat mute">
          {target.mute ? (
            <>
              <span className="text-[#ffcfa8]">Muted {target.mute.until ? `until ${new Date(target.mute.until).toLocaleString()}` : "permanently"}{target.mute.reason && `: ${target.mute.reason}`}</span>
              <button className="btn btn-sm" onClick={() => act("unmute", {}, `${target.username} unmuted`)} data-testid="admin-unmute-button">Unmute</button>
            </>
          ) : (
            <>
              <select className="input !w-auto" value={muteMin} onChange={(e) => setMuteMin(e.target.value)} data-testid="admin-mute-duration">{MUTE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              <button className="btn btn-sm" disabled={self} onClick={() => act("mute", { minutes: Number(muteMin), reason }, `${target.username} muted`)} data-testid="admin-mute-button">Mute chat</button>
            </>
          )}
        </Row>
        <Row label="Reset password">
          <input type="password" className="input !w-48" placeholder="New password (6+)" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="admin-newpw-input" />
          <button className="btn btn-sm" disabled={newPw.length < 6} onClick={async () => { if (await act("reset-password", { password: newPw }, "Password reset")) setNewPw(""); }} data-testid="admin-resetpw-button">Set password</button>
        </Row>
        <Row label="Admin rights">
          {target.is_admin
            ? <button className="btn btn-sm" disabled={self} onClick={() => act("role", { admin: false }, `${target.username} is no longer admin`)} data-testid="admin-demote-button">Remove admin</button>
            : <button className="btn btn-sm" disabled={target.is_guest} onClick={() => act("role", { admin: true }, `${target.username} promoted to admin`)} data-testid="admin-promote-button">Make admin</button>}
          {self && <span className="text-[var(--muted)]">You cannot change your own rights.</span>}
        </Row>
        {!target.is_admin && <Row label="MOD rights">
          {target.role === "mod"
            ? <button className="btn btn-sm" onClick={async () => { if (await setMod(false)) onChanged({ ...target, role: null }); }} data-testid="admin-unmod-button">Remove MOD</button>
            : <button className="btn btn-sm !text-[#7fd6b8]" disabled={target.is_guest} onClick={async () => { if (await setMod(true)) onChanged({ ...target, role: "mod" }); }} data-testid="admin-mod-button">Make MOD</button>}
          <span className="text-[var(--muted)]">MODs get a badge and the Mod Panel (mute up to 6 h, ban 1 day / 1 week).</span>
        </Row>}
        <Row label="Supporter heart">
          {target.supporter
            ? <button className="btn btn-sm" onClick={() => act("supporter", { supporter: false }, `Heart removed from ${target.username}`)} data-testid="admin-heart-remove-button">Remove heart</button>
            : <button className="btn btn-sm !text-[#e8647a]" onClick={() => act("supporter", { supporter: true }, `${target.username} now wears a supporter's heart`)} data-testid="admin-heart-give-button">Give heart</button>}
          <span className="text-[var(--muted)]">Shown beside their name in chat and on their profile.</span>
        </Row>
        <Row label="Delete account">
          <input className="input !w-48" placeholder={`Type ${target.username}`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} data-testid="admin-delete-confirm-input" />
          <button className="btn btn-sm !border-[#6b2b2b] !text-[#f0a5a3]" disabled={self || confirmName !== target.username} onClick={del} data-testid="admin-delete-button">Delete permanently</button>
          <span className="text-[var(--muted)]">Removes catches, journal, listings, messages and crew membership.</span>
        </Row>
      </div>
    </Panel>
  );
}
