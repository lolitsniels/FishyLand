/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Gem, UserSquare2, PenLine, Hourglass, Palette, Frame, ScrollText, Users } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Pearls, PearlIcon } from "../../components/ui-bits";
import { Avatar } from "../../components/Avatar";
import { friendsChanged } from "../../components/FriendsPanel";
import { t as tt } from "../../i18n";
import { NO_IAP } from "../../lib/portal";

export const PEARL_SOURCES = [
  ["Story chapter completed", "2 (3 with a title)"], ["Weekly quest completed", "1"], ["7-day daily quest streak", "3"],
  ["Day-7 Harbour Chest", "2"], ["Legendary boss slain", "1"], ["Tournament podium (gold tournaments)", "3 / 2 / 1"], ["Achievement with a title", "1"], ["Toplist vote (2 sites, every 12 h)", "1 each"],
];

const CATEGORIES = [
  { id: "portraits", label: "Portraits", icon: UserSquare2 },
  { id: "frames", label: "Frames", icon: Frame },
  { id: "walls", label: "Guestbook walls", icon: ScrollText },
  { id: "colours", label: "Chat colours", icon: Palette },
  { id: "identity", label: "Name change", icon: PenLine },
  { id: "friends", label: "Friend slots", icon: Users },
  { id: "soon", label: "Coming soon", icon: Hourglass },
].filter((c) => process.env.REACT_APP_OFFLINE !== "1" || ["frames", "colours", "soon"].includes(c.id)); // offline: no portrait art, names, walls or friends

function Walls({ cos, reload }) {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const call = async (path, body, msg) => {
    setBusy(true);
    try { const r = await api.post(path, body); setUser(r.data.user); toast.success(msg); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const Preview = ({ id }) => (
    <div className={`panel ${id ? `gb-wall gb-wall-${id}` : ""} !p-2`} data-testid={`wall-preview-${id || "none"}`}>
      <div className="text-[10.5px] uppercase tracking-widest opacity-80">{tt("Guestbook")}</div>
      <div className="text-[11.5px] mt-1 italic">{tt("\"Tight lines,")} {user.username}{tt(". May the deep pay you well.\" A passing angler")}</div>
    </div>
  );
  const Card = ({ id, name, desc, price, owned, active, free, earned }) => {
    const afford = user.pearls >= (price || 0);
    const exclusive = price === null || price === undefined;
    return (
      <div className={`panel ${active ? "panel-gold" : ""} p-2 space-y-2`} data-testid={`shop-wall-${id || "none"}`} data-owned={owned}>
        <div className="flex items-center justify-between gap-2"><span className="font-display text-[13.5px] text-[#f4ead2] truncate">{name}</span>{free ? <span className="text-[11px] text-[var(--ok)]">{tt("Free")}</span> : owned ? <span className="text-[11px] text-[var(--ok)]">{tt("Owned")}</span> : exclusive && !free ? <span className="text-[11px] text-[var(--gold)]">{tt("Earned")}</span> : <Pearls n={price} className={`text-[12.5px] ${afford ? "" : "opacity-70"}`} />}</div>
        <Preview id={id} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[var(--muted)] truncate" title={desc}>{desc}</span>
          {active ? <span className="text-[11px] text-[var(--gold)] shrink-0">{tt("In use")}</span>
            : owned || free ? <button className="btn btn-sm" disabled={busy} onClick={() => call("/cosmetics/wall", { wall_id: id }, id ? `Guestbook now panelled in ${name}` : "Back to the plain guestbook")} data-testid={`shop-wall-use-${id || "none"}`}>{tt("Use")}</button>
            : <button className="btn btn-sm btn-gold" disabled={busy || !afford} title={afford ? "" : `You need ${price - user.pearls} more Pearls`} onClick={() => call("/cosmetics/buy-wall", { wall_id: id }, `Bought the ${name} wall`)} data-testid={`shop-wall-buy-${id}`}>{tt("Buy")}</button>}
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3" data-testid="shop-walls">
      <p className="text-[12.5px] text-[var(--text-2)]">{tt("Re-panel the guestbook on")} <Link to="/game/profile" className="underline">{tt("your profile page")}</Link>{tt(". Visitors see whichever wall you last chose. Buy once, switch between the ones you own any time, or go back to the plain panel for free.")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="shop-walls-grid">
        <Card id={null} name="Plain panel" desc={tt("The honest dockside default.")} free active={!user.wall} owned />
        {cos.walls.map((w) => <Card key={w.id} {...w} active={user.wall === w.id} />)}
      </div>
    </div>
  );
}

function Frames({ cos, reload }) {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const call = async (path, body, msg) => {
    setBusy(true);
    try { const r = await api.post(path, body); setUser(r.data.user); toast.success(msg); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const Card = ({ id, name, desc, price, owned, active, free, earned }) => {
    const afford = user.pearls >= (price || 0);
    const exclusive = price === null || price === undefined;
    return (
      <div className={`panel ${active ? "panel-gold" : ""} p-2 flex gap-3 items-center`} data-testid={`shop-frame-${id || "none"}`} data-owned={owned}>
        <Avatar id={user.avatar} size="md" gold={!id} frame={id} />
        <div className="flex-1 min-w-0 text-[12px]">
          <div className="flex items-center justify-between gap-2"><span className="font-display text-[13.5px] text-[#f4ead2] truncate">{name}</span>{free ? <span className="text-[11px] text-[var(--ok)]">{tt("Free")}</span> : owned ? <span className="text-[11px] text-[var(--ok)]">{tt("Owned")}</span> : exclusive && !free ? <span className="text-[11px] text-[var(--gold)]">{tt("Earned")}</span> : <Pearls n={price} className={`text-[12.5px] ${afford ? "" : "opacity-70"}`} />}</div>
          <div className="text-[var(--text-2)] text-[11.5px] truncate" title={desc}>{desc}</div>
          <div className="mt-1.5 flex justify-end">
            {active ? <span className="text-[11px] text-[var(--gold)]">{tt("In use")}</span>
              : owned || free ? <button className="btn btn-sm" disabled={busy} onClick={() => call("/cosmetics/frame", { frame_id: id }, id ? `Portrait framed in ${name}` : "Back to the plain border")} data-testid={`shop-frame-use-${id || "none"}`}>{tt("Use")}</button>
              : exclusive ? <span className="text-[11px] text-[var(--muted)] italic text-right" data-testid={`shop-frame-earned-${id}`}>{earned}</span>
              : <button className="btn btn-sm btn-gold" disabled={busy || !afford} title={afford ? "" : `You need ${price - user.pearls} more Pearls`} onClick={() => call("/cosmetics/buy-frame", { frame_id: id }, `Bought the ${name} frame`)} data-testid={`shop-frame-buy-${id}`}>{tt("Buy")}</button>}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="space-y-3" data-testid="shop-frames">
      <p className="text-[12.5px] text-[var(--text-2)]">{tt("A frame wraps your portrait everywhere it shows: header, profile, rankings and the online list. Buy once, switch between the frames you own whenever you like, or return to the plain border for free.")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="shop-frames-grid">
        <Card id={null} name="Plain border" desc={tt("The honest dockside default.")} free active={!user.frame} owned />
        {cos.frames.map((f) => <Card key={f.id} {...f} active={user.frame === f.id} />)}
      </div>
    </div>
  );
}

function Colours({ cos, reload }) {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const call = async (path, body, msg) => {
    setBusy(true);
    try { const r = await api.post(path, body); setUser(r.data.user); toast.success(msg); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const Preview = ({ hex, testId }) => (
    <div className="bg-[#0b0a09] border border-[var(--border)] px-2 py-1 text-[12px] leading-tight" data-testid={testId}>
      <span className="num text-[10px] mr-1 text-[var(--muted)]">[{user.level}]</span>{user.crew && <span className="text-[10.5px] text-[var(--gold-dim)] mr-0.5">[{user.crew.tag}]</span>}
      <span className="font-medium" style={hex ? { color: hex } : undefined}>{user.username}</span><span className="font-medium" style={hex ? { color: hex } : undefined}>:</span> <span className="text-[var(--text-2)]">{tt("tight lines, everyone")}</span>
    </div>
  );
  return (
    <div className="space-y-3" data-testid="shop-colours">
      <p className="text-[12.5px] text-[var(--text-2)]">{tt("Colour your name in global, trade and crew chat (and on your profile). Buy a colour once, switch between the ones you own whenever you like, or go back to the default for free.")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="shop-colours-grid">
        <div className={`panel ${!user.name_colour ? "panel-gold" : ""} p-2 space-y-2`} data-testid="shop-colour-default">
          <div className="flex items-center justify-between"><span className="font-display text-[13.5px] text-[#f4ead2]">{tt("Default")}</span><span className="text-[11px] text-[var(--ok)]">{tt("Free")}</span></div>
          <Preview hex={null} />
          <div className="flex justify-end">{!user.name_colour ? <span className="text-[11px] text-[var(--gold)]">{tt("In use")}</span> : <button className="btn btn-sm" disabled={busy} onClick={() => call("/cosmetics/colour", { colour_id: null }, "Back to the default name colour")} data-testid="shop-colour-use-default">{tt("Use")}</button>}</div>
        </div>
        {cos.colours.map((c) => {
          const active = user.name_colour === c.id; const exclusive = c.price === null; const afford = !exclusive && user.pearls >= c.price;
          return (
            <div key={c.id} className={`panel ${active ? "panel-gold" : ""} p-2 space-y-2`} data-testid={`shop-colour-${c.id}`} data-owned={c.owned}>
              <div className="flex items-center justify-between gap-2"><span className="font-display text-[13.5px] inline-flex items-center gap-2"><span className="inline-block w-3 h-3 border border-[rgba(255,255,255,.25)]" style={{ background: c.hex }} /><span style={{ color: c.hex }}>{c.name}</span></span>{c.owned ? <span className="text-[11px] text-[var(--ok)]">{tt("Owned")}</span> : exclusive ? <span className="text-[11px] text-[var(--gold)]">{tt("Earned")}</span> : <Pearls n={c.price} className={`text-[12.5px] ${afford ? "" : "opacity-70"}`} />}</div>
              <Preview hex={c.hex} testId={`shop-colour-preview-${c.id}`} />
              <div className="flex justify-end">
                {active ? <span className="text-[11px] text-[var(--gold)]">{tt("In use")}</span>
                  : c.owned ? <button className="btn btn-sm" disabled={busy} onClick={() => call("/cosmetics/colour", { colour_id: c.id }, `Chat name now ${c.name}`)} data-testid={`shop-colour-use-${c.id}`}>{tt("Use")}</button>
                  : exclusive ? <span className="text-[11px] text-[var(--muted)] italic text-right" data-testid={`shop-colour-earned-${c.id}`}>{c.earned}</span>
                  : <button className="btn btn-sm btn-gold" disabled={busy || !afford} title={afford ? "" : `You need ${c.price - user.pearls} more Pearls`} onClick={() => call("/cosmetics/buy-colour", { colour_id: c.id }, `Bought ${c.name}, now colouring your name`)} data-testid={`shop-colour-buy-${c.id}`}>{tt("Buy")}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PortraitCard({ a, owned, wearing, pearls, onBuy, onWear, busy }) {
  const afford = pearls >= a.price;
  return (
    <div className={`panel ${wearing ? "panel-gold" : ""} flex flex-col`} data-testid={`shop-portrait-${a.id}`} data-owned={owned}>
      <img src={`/art/avatars/${a.id}.jpg`} alt={a.name} loading="lazy" className="w-full aspect-square object-cover block" />
      <div className="p-2 text-[12px] flex-1 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2"><span className="font-display text-[13.5px] text-[#f4ead2] truncate">{a.name}</span><span className="label !text-[9.5px]">{a.sex === "m" ? tt("male") : a.sex === "f" ? tt("female") : a.kind || tt("creature")}</span></div>
        <div className="mt-auto flex items-center justify-between gap-2">
          {owned ? <span className="text-[11px] text-[var(--ok)]">{tt("Owned")}</span> : <Pearls n={a.price} className={`text-[12.5px] ${afford ? "" : "opacity-70"}`} />}
          {wearing ? <span className="text-[11px] text-[var(--gold)]">{tt("Wearing")}</span>
            : owned ? <button className="btn btn-sm" disabled={busy} onClick={() => onWear(a)} data-testid={`shop-wear-${a.id}`}>{tt("Wear")}</button>
            : <button className="btn btn-sm btn-gold" disabled={busy || !afford} title={afford ? "" : `You need ${a.price - pearls} more Pearls`} onClick={() => onBuy(a)} data-testid={`shop-buy-${a.id}`}>{tt("Buy")}</button>}
        </div>
      </div>
    </div>
  );
}

function Portraits({ cos, reload }) {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const call = async (path, a, msg) => {
    setBusy(true);
    try { const r = await api.post(path, { avatar_id: a.id }); setUser(r.data.user); toast.success(msg); setConfirm(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const premium = cos.avatars.filter((a) => a.price > 0);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[var(--text-2)]">{tt("Premium portraits are bought once and kept forever. Bought portraits are worn straight away; swap between the ones you own any time from")} <Link to="/game/profile" className="underline">{tt("My Angler")}</Link>{tt(". The six village faces are free for everyone.")}</p>
      {confirm && (
        <div className="border border-[#5a4e6e] bg-[var(--bg-2)] p-2.5 flex flex-wrap items-center gap-3 text-[12.5px]" data-testid="shop-buy-confirm">
          <Avatar id={confirm.id} size="md" />
          <div className="flex-1 min-w-[160px]"><div className="text-[#f4ead2]">{tt("Buy the")} <b>{confirm.name}</b> {tt("portrait for")} <Pearls n={confirm.price} />?</div><div className="text-[var(--text-2)]">{tt("You have")} <Pearls n={user.pearls} />{tt(". Pearls are not refunded.")}</div></div>
          <button className="btn btn-sm" onClick={() => setConfirm(null)}>{tt("Cancel")}</button>
          <button className="btn btn-sm btn-gold" disabled={busy} onClick={() => call("/cosmetics/buy-avatar", confirm, `Bought the ${confirm.name} portrait`)} data-testid="shop-buy-confirm-button">{tt("Confirm purchase")}</button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="shop-portraits-grid">
        {premium.map((a) => <PortraitCard key={a.id} a={a} owned={a.owned} wearing={user.avatar === a.id} pearls={user.pearls} busy={busy} onBuy={setConfirm} onWear={(x) => call("/cosmetics/avatar", x, `Now wearing ${x.name}`)} />)}
      </div>
    </div>
  );
}

function Identity({ cos, reload }) {
  const { user, login } = useGame();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const cost = cos.rename_cost;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post("/cosmetics/rename", { username: name.trim() }); login(r.data); setName(""); toast.success(tt("You are now known as {{v0}}", { v0: r.data.user.username })); reload(); }
    catch (ex) { toast.error(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-xl space-y-3 text-[12.5px]" data-testid="shop-identity">
      <p className="text-[var(--text-2)]">{tt("Change your angler name for")} <Pearls n={cost} />{tt(". Your catches, listings, whispers, crew membership and rankings all carry over; the world feed announces the change.")}</p>
      {user.is_guest ? <div className="text-[var(--muted)]">{tt("Guests choose their real name for free when they claim their account (see the banner above).")}</div> : (
        <form onSubmit={submit} className="flex flex-wrap gap-2 items-center" data-testid="rename-form">
          <span className="text-[var(--muted)]">{tt("Current:")}</span><b className="text-[#f4ead2]">{user.username}</b>
          <input className="input !w-56" value={name} onChange={(e) => setName(e.target.value)} placeholder={tt("New name (3-16 letters, numbers, _)")} maxLength={16} data-testid="rename-input" />
          <button className="btn btn-sm btn-gold" disabled={busy || name.trim().length < 3 || user.pearls < cost} data-testid="rename-button">{tt("Change name")}</button>
          {user.pearls < cost && <span className="text-[11.5px] text-[var(--muted)]">{tt("You need")} {cost - user.pearls} {tt("more Pearls.")}</span>}
        </form>
      )}
    </div>
  );
}

function FriendSlots({ cos, reload }) {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const fs = cos.friend_slots;
  const maxed = fs.have + fs.pack > fs.max;
  const buy = async () => {
    if (busy) return;
    setBusy(true);
    try { const r = await api.post("/friends/buy-slots"); setUser(r.data.user); toast.success(tt("Your friend list now holds {{v0}} anglers", { v0: r.data.slots })); reload(); friendsChanged(); }
    catch (ex) { toast.error(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <div className="max-w-xl space-y-3 text-[12.5px]" data-testid="shop-friend-slots">
      <p className="text-[var(--text-2)]">{tt("Room for more fishing companions. Each pack adds")} <b className="text-[#f4ead2]">+{fs.pack} {tt("friend slots")}</b> {tt("for")} <Pearls n={fs.cost} />{tt(", permanently.")}</p>
      <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] rounded-[2px] px-3 py-2 bg-[rgba(255,255,255,0.02)]">
        <div><div className="label">{tt("Friend list")}</div><div className="num text-[15px] text-[#f4ead2]" data-testid="friend-slots-count">{fs.used} / {fs.have}</div></div>
        <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden min-w-[120px]"><div className="h-full bg-[#e9dcf5]" style={{ width: `${Math.min(100, (fs.used / fs.have) * 100)}%` }} /></div>
        <button className="btn btn-sm btn-gold" disabled={busy || maxed || user.pearls < fs.cost} onClick={buy} data-testid="buy-friend-slots-button">+{fs.pack} {tt("slots ·")} {fs.cost} {tt("Pearls")}</button>
      </div>
      {maxed ? <div className="text-[11.5px] text-[var(--muted)]">{tt("You have the maximum of")} {fs.max} {tt("slots.")}</div>
        : user.pearls < fs.cost && <div className="text-[11.5px] text-[var(--muted)]">{tt("You need")} {fs.cost - user.pearls} {tt("more Pearls.")}</div>}
    </div>
  );
}

export default function PearlShop() {
  const { user } = useGame();
  const [cos, setCos] = useState(null);
  const [params] = useSearchParams();
  const [cat, setCat] = useState(params.get("tab") || CATEGORIES[0].id);
  const load = () => api.get("/cosmetics").then((r) => setCos(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-3" data-testid="pearl-shop-page">
      <Panel icon="pearl" title={tt("Pearl Shop")} right={<span className="font-sans normal-case tracking-normal text-[12px] inline-flex items-center gap-2"><span className="text-[var(--text-2)]">{tt("Your Pearls")}</span><Pearls n={user.pearls} className="text-[14px]" data-testid="shop-pearls" /></span>} testId="pearl-shop-header">
        <div className="flex flex-col md:flex-row gap-4 text-[12.5px]">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2"><Gem size={14} className="text-[#e9dcf5]" /><span className="font-display text-[15px] text-[#f4ead2]">{tt("Optional finery, never power")}</span></div>
            <p className="text-[var(--text-2)]"><span className="inline-flex items-center gap-1 text-[#e9dcf5]"><PearlIcon size={9} />{tt("Pearls")}</span> {NO_IAP ? tt("are earned by playing, never sold. Nothing here changes how well you fish: cosmetics, and conveniences, with more added over time.") : tt("are earned by playing, never sold. Nothing here changes how well you fish: cosmetics, and conveniences, with more added over time. The Angler Pass (more energy, no market fee, the Almanac) is bought on the Donate page.")}</p>
          </div>
          <div className="md:w-[420px] overflow-x-auto">
            <table className="table text-[11.5px]" data-testid="pearl-sources"><thead><tr><th>{tt("How to earn")}</th><th className="r">{tt("Pearls")}</th></tr></thead>
              <tbody>{PEARL_SOURCES.filter(([s]) => !NO_IAP || !s.includes("vote")).map(([s, n]) => <tr key={s}><td className="whitespace-nowrap !py-1">{s}</td><td className="r num text-[#e9dcf5] whitespace-nowrap !py-1">{n}</td></tr>)}</tbody></table>
          </div>
        </div>
      </Panel>
      <div className="panel" data-testid="shop-body">
      <div className="tab-strip flex flex-wrap gap-1 border-b border-[var(--border)] px-2 pt-1" data-testid="shop-categories">
        {CATEGORIES.map((c) => <button key={c.id} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px inline-flex items-center gap-1.5 ${cat === c.id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setCat(c.id)} data-testid={`shop-tab-${c.id}`}><c.icon size={13} />{c.label}</button>)}
      </div>
      <div className="panel-body">
      {!cos ? <div className="text-[var(--muted)] text-sm italic py-6 text-center">{tt("Opening the shop...")}</div>
        : cat === "portraits" ? <Portraits cos={cos} reload={load} />
        : cat === "frames" ? <Frames cos={cos} reload={load} />
        : cat === "walls" ? <Walls cos={cos} reload={load} />
        : cat === "colours" ? <Colours cos={cos} reload={load} />
        : cat === "identity" ? <Identity cos={cos} reload={load} />
        : cat === "friends" ? <FriendSlots cos={cos} reload={load} />
        : <div className="text-[12.5px] text-[var(--muted)] italic py-6 text-center" data-testid="shop-coming-soon">{tt("More Pearl goods are on the way: trophy-wall themes and boat liveries. Hold onto your Pearls.")}</div>}
      </div>
      </div>
    </div>
  );
}
