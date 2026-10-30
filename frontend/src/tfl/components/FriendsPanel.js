/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { PixelIcon } from "./PixelIcon";
import { t as tt } from "../i18n";

export function useFriends() {
  const [d, setD] = useState(null);
  useEffect(() => {
    const load = () => api.get("/friends").then((r) => setD(r.data)).catch(() => {});
    load();
    window.addEventListener("friends-changed", load);
    const t = setInterval(load, 20000);
    return () => { clearInterval(t); window.removeEventListener("friends-changed", load); };
  }, []);
  return d;
}

export const friendsChanged = () => window.dispatchEvent(new CustomEvent("friends-changed"));

// Fishing-page panel: only shown while a friend fishes the same water (active luck bonus).
export function FriendsHere({ friends }) {
  if (!friends || friends.friends.length === 0) return null;
  const here = friends.friends.filter((f) => friends.here.includes(f.username));
  if (here.length === 0) return null;
  const luck = friends.luck_per ?? friends.luck_bonus;
  return (
    <section className="panel panel-gold" data-testid="friends-here-panel">
      <header className="panel-head"><span>{tt("Fishing together")}</span>{<span className="font-sans normal-case tracking-normal text-[12px] text-[var(--gold)] num" data-testid="friends-here-bonus">+{luck} {tt("luck active")}</span>}</header>
      <div className="panel-body text-[12px] space-y-1.5">
        <>
            <div className="text-[var(--text-2)]">{tt("Every cast gets")} <b className="text-[var(--gold)]">+{luck} {tt("luck")}</b> {tt("while a friend fishes this water with you.")}</div>
            <ul className="space-y-0.5" data-testid="friends-here-list">
              {here.map((f) => <li key={f.username} className="flex items-center gap-2"><span className="online-dot" /><Link to={`/game/profile/${f.username}`} className="hover:text-[var(--gold)] font-medium" data-testid={`friend-here-${f.username}`}>{f.tag && <span className="text-[var(--gold)] mr-1">[{f.tag}]</span>}{f.username}</Link><span className="text-[var(--muted)] num">{tt("Lv")} {f.level}</span></li>)}
            </ul>
        </>
      </div>
    </section>
  );
}

export default function FriendsPanel() {
  const nav = useNavigate();
  const d = useFriends();
  const { user, setUser } = useGame();
  const canTravel = (f) => f.online && f.water && f.water !== user?.water && (user?.unlocked_waters || []).includes(f.water);
  const travelTo = async (f) => {
    try { const r = await api.post("/waters/travel", { water: f.water }); setUser(r.data); toast.success(`You travel to ${f.water_name} to fish with ${f.username}.`); nav("/game/fish"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); friendsChanged(); } catch (e) { toast.error(errMsg(e)); } };
  if (!d) return null;
  const online = d.friends.filter((f) => f.online).length;
  return (
    <div className="p-3 text-[11.5px] text-[var(--muted)]" data-testid="friends-panel">
      <div className="label mb-1 flex justify-between"><span>{tt("Friends ·")} <span className="text-[var(--ok)]">{online}</span>/{d.friends.length}</span></div>
      {d.incoming.map((r) => (
        <div key={r.id} className="flex items-center gap-1 py-0.5 text-[var(--text-2)]" data-testid={`friend-incoming-${r.username}`}>
          <span className="truncate flex-1"><b className="text-[var(--text)]">{r.username}</b> {tt("wants to be friends")}</span>
          <button className="text-[var(--ok)] hover:text-white" title={tt("Accept")} onClick={() => act(() => api.post(`/friends/${r.id}/accept`), `You and ${r.username} are now friends`)} data-testid={`accept-friend-${r.username}`}><PixelIcon name="check" size={14} /></button>
          <button className="hover:text-[#f0a5a3]" title={tt("Decline")} onClick={() => act(() => api.post(`/friends/${r.id}/decline`))} data-testid={`decline-friend-${r.username}`}><PixelIcon name="cross" size={14} /></button>
        </div>
      ))}
      <ul className="space-y-0.5 max-h-52 overflow-auto" data-testid="friends-list">
        {d.friends.length === 0 && d.incoming.length === 0 && <li className="italic">{tt("No friends yet. Add anglers from their profile.")}</li>}
        {d.friends.map((f) => (
          <li key={f.username} className="flex items-center gap-1.5 group" data-testid={`friend-${f.username}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.online ? "bg-[var(--ok)]" : "bg-[#3a342f]"}`} />
            <button className={`text-left truncate flex-1 hover:text-[var(--gold)] ${f.online ? "text-[var(--text)]" : ""}`} onClick={() => nav(`/game/profile/${f.username}`)} title={f.online ? `At ${f.water_name}` : tt("Offline")}>
              {f.username}{f.online && <span className="text-[var(--muted)] text-[10.5px]"> · {f.water_name}</span>}{f.ghost && <span className="text-[var(--muted)] text-[10.5px] italic"> · {tt("account gone")}</span>}
            </button>
            {canTravel(f) && <button className="opacity-70 group-hover:opacity-100 hover:text-[var(--gold)]" title={`Travel to ${f.water_name}`} onClick={() => travelTo(f)} data-testid={`travel-friend-${f.username}`}><PixelIcon name="compass" size={14} /></button>}
            <button className="opacity-50 group-hover:opacity-100 hover:text-[var(--gold)]" title={tt("Whisper")} onClick={() => nav(`/game/messages/${f.username}`)} data-testid={`whisper-friend-${f.username}`}><PixelIcon name="chat" size={14} /></button>
            <button className="opacity-50 group-hover:opacity-100 hover:text-[#f0a5a3]" title={tt("Remove friend")} onClick={() => act(() => api.post("/friends/remove", { username: f.username }), `${f.username} removed from friends`)} data-testid={`remove-friend-${f.username}`}><PixelIcon name="unfriend" size={14} /></button>
          </li>
        ))}
      </ul>
      {d.outgoing.length > 0 && <div className="mt-1 italic truncate">{tt("Pending:")} {d.outgoing.map((o) => o.username).join(", ")}</div>}
    </div>
  );
}
