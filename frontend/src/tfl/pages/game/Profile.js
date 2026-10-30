/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { AchievementBadge } from "../../components/AchievementBadge";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmt, wt, ln, ago, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Stat, Rarity, Gold, Empty } from "../../components/ui-bits";
import { InfoTabs } from "../../components/MobileSheets";
import { pixelIcon } from "../../components/PixelIcon";
import { FishPlate } from "../../components/FishPlate";
import { toast } from "sonner";
import { friendsChanged } from "../../components/FriendsPanel";
import { BossPlaque } from "../../components/Boss";
import AvatarModal from "../../components/CosmeticsModal";
import { Pearls, AdminBadge, ModBadge, SupporterBadge, PremiumBadge } from "../../components/ui-bits";
import { ProfileTackle } from "../../components/RodSkin";
import Guestbook from "../../components/Guestbook";
import { t as tt } from "../../i18n";

function FriendButton({ username }) {
  const [st, setSt] = useState(null);
  const load = () => api.get(`/friends/status/${username}`).then((r) => setSt(r.data)).catch(() => {});
  useEffect(() => { setSt(null); load(); }, [username]); // eslint-disable-line
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); friendsChanged(); load(); } catch (e) { toast.error(errMsg(e)); } };
  if (!st) return null;
  if (st.state === "friends") return <button className="btn btn-sm" onClick={() => act(() => api.post("/friends/remove", { username }), `${username} removed from friends`)} data-testid="profile-unfriend-button">{tt("✓ Friends · remove")}</button>;
  if (st.state === "outgoing") return <button className="btn btn-sm" disabled data-testid="profile-friend-pending">{tt("Request sent")}</button>;
  if (st.state === "incoming") return <button className="btn btn-sm btn-gold" onClick={() => act(() => api.post(`/friends/${st.id}/accept`), `You and ${username} are now friends`)} data-testid="profile-accept-friend-button">{tt("Accept friend request")}</button>;
  if (st.full) return (
    <span className="inline-block" title={`Your friend list is full (${st.count}/${st.slots}). More slots are sold in the Pearl Shop.`} data-testid="profile-add-friend-full">
      <button className="btn btn-sm opacity-50 cursor-not-allowed" disabled aria-label={`Friend list full, ${st.count} of ${st.slots}`}>{tt("+ Add friend")}</button>
    </span>
  );
  return <button className="btn btn-sm" onClick={() => act(() => api.post("/friends/request", { username }), `Friend request sent to ${username}`)} data-testid="profile-add-friend-button">{tt("+ Add friend")}</button>;
}

export default function Profile() {
  const { username } = useParams();
  const nav = useNavigate();
  const { user, setUser, lookups, data } = useGame();
  const [p, setP] = useState(null);
  const [err, setErr] = useState("");
  const [cosOpen, setCosOpen] = useState(null); // null | "portrait" | "frame" | "wall"
  const name = username || user.username;
  const mine = name.toLowerCase() === user.username.toLowerCase();
  const load = () => api.get(`/players/${name}`).then((r) => setP(r.data)).catch(() => setErr("No such angler."));
  useEffect(() => { setP(null); setErr(""); load(); }, [name]); // eslint-disable-line
  useEffect(() => { if (mine && p && (p.avatar !== user.avatar || p.username !== user.username)) load(); }, [user.avatar, user.username]); // eslint-disable-line
  const unmount = async (c) => { try { await api.post("/inventory/unmount", { catch_id: c.id }); toast.success(tt("{{v0}} returned to your keepnet", { v0: c.name })); load(); } catch (e) { toast.error(errMsg(e)); } };
  const setTitle = async (title) => { try { const r = await api.post("/achievements/title", { title }); setUser(r.data); toast.success(title ? `Title set: ${title}` : "Title cleared"); load(); } catch (e) { toast.error(errMsg(e)); } };
  if (err) return <Empty>{err}</Empty>;
  if (!p) return <Empty>{tt("Loading...")}</Empty>;
  const s = p.stats;
  const water = lookups?.waterByKey[p.water];
  return (
    <div className="space-y-3 fade-in" data-testid="profile-page">
      <div className="g-hero !min-h-[210px] flex flex-col justify-end" style={{ backgroundImage: `url(/art/waters/${p.water}.jpg)` }} data-testid="profile-hero">
        <div className="p-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="flex items-end gap-3 min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="g-portrait" data-testid="profile-avatar"><img src="/art/angler.png" alt={p.username} /></div>
              <span className="absolute -top-1 -left-1 fr-chip px-2 text-[11px] font-cinzel font-black text-amber-200" data-testid="profile-level-badge">Lv.{p.level}</span>
              {mine && <button className="absolute -bottom-1 -right-1 btn btn-sm !px-1.5 !py-0.5 !text-[10px]" onClick={() => setCosOpen("portrait")} title={tt("Change appearance")} data-testid="profile-change-avatar-button">{tt("Change")}</button>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="label label-gold truncate">{p.title} {tt("· Level")} {p.level}{p.crew && <> · <button className="underline" onClick={() => nav(`/game/crews/${p.crew.id}`)}>[{p.crew.tag}] {p.crew.name}</button></>}</div>
              <div className="font-deco gold-text text-2xl md:text-3xl truncate flex items-center gap-2" style={p.name_colour_hex ? { color: p.name_colour_hex } : undefined} data-testid="profile-username">{p.username}{p.is_admin && <AdminBadge className="!text-[9.5px]" data-testid="profile-admin-badge" />}{p.is_mod && <ModBadge data-testid="profile-mod-badge" />}{p.supporter && <SupporterBadge size={14} data-testid="profile-supporter-badge" />}{p.premium && <PremiumBadge size={14} data-testid="profile-premium-badge" />}</div>
              {p.badges?.length > 0 && <div className="flex items-center gap-1.5 my-1" data-testid="profile-badges">{p.badges.map((b) => <AchievementBadge key={b.id} id={b.id} size={36} title={`${b.name}: ${b.desc}`} />)}</div>}
              {mine && !p.badges?.length && <button className="text-[11px] text-[var(--muted)] underline my-0.5" onClick={() => nav("/game/achievements")} data-testid="profile-badges-hint">{tt("Show up to 3 achievement badges here")}</button>}
              <div className="text-[11.5px] md:text-[12px] text-[var(--text-2)] truncate">{p.avatar_name && <span className="text-[var(--muted)]">"{p.avatar_name}" · </span>}{tt("Fishing at")} {water?.name} {tt("· joined")} {ago(p.created_at)} {tt("· last seen")} {ago(p.last_seen)}</div>
            </div>
          </div>
          {!mine ? <div className="flex gap-2 shrink-0"><FriendButton username={p.username} /><button className="btn btn-gold btn-sm" onClick={() => nav(`/game/messages/${p.username}`)} data-testid="profile-message-button">{tt("Send whisper")}</button></div>
            : <div className="text-right text-[12px] shrink-0 hidden md:block"><div className="label">{tt("Pearls")}</div><Pearls n={user.pearls} className="text-[14px]" data-testid="profile-pearls" /><div><button className="underline text-[var(--text-2)] hover:text-[var(--gold)] text-[11.5px]" onClick={() => nav("/game/pearl-shop")} data-testid="profile-open-pearl-shop">{tt("Pearl Shop")}</button></div></div>}
        </div>
      </div>
      {cosOpen && <AvatarModal tab={cosOpen} onClose={() => setCosOpen(null)} onChanged={load} />}
      <InfoTabs inline testId="profile-tabs" items={[
        { id: "recent", label: "Recent catches", Icon: pixelIcon("fish"), node: (
      <Panel icon="fish" title={tt("Recent catches")} bodyClass="!p-0">
        {p.recent.length === 0 ? <Empty>{tt("Nothing yet.")}</Empty> : (
          <table className="table">
            <thead><tr><th>{tt("Fish")}</th><th>{tt("Water")}</th><th className="r">{tt("Weight")}</th><th className="r">{tt("Value")}</th><th className="r">{tt("When")}</th></tr></thead>
            <tbody>{p.recent.map((c) => <tr key={c.id}><td><span className={`rar-${c.rarity}`}>{c.name}</span>{c.variant !== "normal" && <span className="tag tag-variant ml-1.5">{c.variant}</span>}</td><td className="text-xs text-[var(--text-2)]">{lookups?.waterByKey[c.water]?.name}</td><td className="num r">{wt(c.weight)}</td><td className="r"><Gold n={c.value} /></td><td className="r text-xs text-[var(--muted)]">{ago(c.caught_at)}</td></tr>)}</tbody>
          </table>
        )}
      </Panel>) },
        p.contest_wins.length > 0 && { id: "honours", label: "Contest honours", Icon: pixelIcon("tournaments"), badge: p.contest_wins.length, node: (
        <Panel icon="tournaments" title={tt("Contest honours")} bodyClass="!p-0" testId="contest-honours">
          <table className="table"><tbody>{p.contest_wins.map((w, i) => <tr key={i}><td className="capitalize">{["1st", "2nd", "3rd"][w.place - 1]} · {w.kind} {w.label || w.category}</td><td className="num text-[var(--text-2)]">{w.unit === "kg" ? wt(w.value) : `${w.value} ${w.unit || ""}`}</td><td className="r">{w.currency === "pearls" ? <Pearls n={w.reward ?? w.prize} /> : <Gold n={w.reward ?? w.prize} />}</td><td className="r text-xs text-[var(--muted)]">{ago(w.end)}</td></tr>)}</tbody></table>
        </Panel>) },
      ]} />
      {mine && (
        <Panel icon="achievements" title={tt("Displayed title")} testId="title-picker-panel">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="label">{tt("Show as")}</span>
            <select className="input !w-auto" value={user.active_title || ""} onChange={(e) => setTitle(e.target.value || null)} data-testid="title-select">
              <option value="">{tt("Default (by level")}{user.stats?.legendary >= 3 ? tt(" or legend") : ""})</option>
              {(user.titles || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-[var(--muted)]">{tt("Earn titles from Achievements and Story Quests. They appear next to your name in the header, feed and profile.")}</span>
          </div>
          {(user.titles || []).length === 0 && <div className="text-[11.5px] text-[var(--muted)] mt-2">{tt("You have no earned titles yet. Complete achievements or story quests marked \"Title\" to add options here.")}</div>}
        </Panel>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <Panel icon="rankings" title={tt("Record")}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 profile-stats">
            <Stat label={tt("Fish landed")} value={fmt(s.catches)} />
            <Stat label={tt("Escaped")} value={fmt(s.escaped)} />
            <Stat label={tt("Species discovered")} value={<>{s.species} <span className="text-xs text-[var(--muted)]">/ {data?.fish.length}</span></>} />
            <Stat label={tt("Legendary catches")} value={s.legendary} />
            <Stat label={tt("Mythic catches")} value={<span className={s.mythic ? "rar-mythic" : ""}>{s.mythic || 0}</span>} />
            <Stat label={tt("Heaviest")} value={s.heaviest_kg ? <>{wt(s.heaviest_kg)} <span className="text-xs text-[var(--muted)]">{s.heaviest_name}</span></> : "-"} />
            <Stat label={tt("Waters unlocked")} value={`${p.unlocked_waters} / ${data?.waters.length}`} />
            <Stat label={tt("Gold earned (lifetime)")} value={<Gold n={s.gold_earned} />} />
            <Stat label={tt("Fish sold")} value={fmt(s.sold)} />
            <Stat label={tt("Bosses slain")} value={<span className={s.boss_kills ? "text-[var(--r-legendary)]" : ""}>{fmt(s.boss_kills || 0)}</span>} />
            <Stat label={tt("Mastery")} value={<span data-testid="profile-mastery">{fmt(s.mastery_total || 0)}<span className="text-xs text-[var(--muted)]"> {tt("lv")}{s.masteries ? ` · ${s.masteries} mastered` : ""}</span></span>} />
            <Stat label={tt("Cheers received")} value={<span className={s.cheers ? "text-[var(--gold)]" : ""} data-testid="profile-cheers">{fmt(s.cheers || 0)}</span>} />
            {p.duel && (p.duel.wins + p.duel.losses + p.duel.draws) > 0 && <Stat label={tt("Fishing duels")} value={<span data-testid="profile-duels"><span className="text-[var(--ok)]">{p.duel.wins}W</span> · <span className="text-[#f0a5a3]">{p.duel.losses}L</span> · {p.duel.draws}D<span className="text-xs text-[var(--muted)]"> {tt("· best streak")} {p.duel.best_streak}</span></span>} />}
          </div>
        </Panel>
        <Panel icon="shop" title={tt("Tackle")}>
          <ProfileTackle p={p} lookups={lookups} mine={mine} />
        </Panel>
      </div>
      <Panel icon="fish" title={tt("Trophy wall")} right={<span className="num">{p.trophies.length} {tt("/ 6 mounts ·")} {p.boss_trophies?.length || 0} / {p.max_boss_mounts} {tt("plaques")}</span>} testId="trophy-wall">
        {p.boss_trophies?.length > 0 && (
          <div className="mb-3" data-testid="boss-plaques">
            <div className="label label-gold mb-1">{tt("Boss plaques")}</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{p.boss_trophies.map((t) => <BossPlaque key={t.id} t={t} />)}</div>
          </div>
        )}
        {p.trophies.length === 0 && !(p.boss_trophies?.length > 0) ? <Empty>{mine ? tt("Nothing mounted yet. Use the Mount button in your Inventory to display a record catch.") : tt("This angler hasn't mounted anything yet.")}</Empty> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="fish-trophies">
            {p.trophies.map((c) => (
              <div key={c.id} className="border p-2 flex gap-2" style={{ borderColor: `var(--r-${c.rarity})`, background: "var(--bg-2)" }} data-testid={`trophy-${c.id}`}>
                <FishPlate speciesId={c.species_id} name={c.name} className="w-[110px] h-[74px] shrink-0" />
                <div className="min-w-0 text-[12px]">
                  <div className={`font-medium rar-${c.rarity} truncate`}>{c.name}</div>
                  {c.variant !== "normal" && <span className="tag tag-variant">{c.variant}</span>}
                  <div className="num text-[var(--text-2)] mt-0.5">{wt(c.weight)} · {ln(c.length_cm)}</div>
                  <div className="text-[11px] text-[var(--muted)]">{lookups?.waterByKey[c.water]?.name} · {ago(c.caught_at)}</div>
                  {mine && <button className="btn btn-sm mt-1" onClick={() => unmount(c)} data-testid={`unmount-${c.id}`}>{tt("Take down")}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Guestbook username={p.username} isMine={mine} />
    </div>
  );
}
