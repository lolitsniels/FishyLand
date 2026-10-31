/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmt, kg, wt, weightUnit, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Rarity, Gold, Stat, Empty } from "../../components/ui-bits";
import { ExpeditionPanel, useExpedition } from "../../components/Expedition";
import Dockside from "../../components/Dockside";
import DailySpin from "../../components/DailySpin";
import { BossPanel } from "../../components/Boss";
import GuestQuests from "../../components/GuestQuests";
import { t as tt } from "../../i18n";
import { MobileGroup, InfoTabs } from "../../components/MobileSheets";
import { NewsPanel } from "../../components/NewsPanel";
import { pixelIcon, PixelIcon } from "../../components/PixelIcon";
import { PORTAL } from "../../lib/portal";
import { ls } from "../../../offline/bridge";

export default function Harbor() {
  const { user, setUser, lookups, data } = useGame();
  const nav = useNavigate();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [journalCount, setJournalCount] = useState(null);
  const [news, setNews] = useState([]);
  const [newsSeen, setNewsSeen] = useState(() => ls.getItem("owo_news_seen") || "");
  const ev = useExpedition();
  useEffect(() => {
    const live = () => {
      api.get("/game/stats").then((r) => setStats(r.data)).catch(() => {});
      api.get("/catches/recent").then((r) => setRecent(r.data)).catch(() => {});
    };
    live();
    api.get("/journal").then((r) => setJournalCount(Object.keys(r.data).length)).catch(() => {});
    api.get("/news").then((r) => setNews(r.data.items)).catch(() => {});
    const t = setInterval(live, 30000);
    return () => clearInterval(t);
  }, []);
  const unreadNews = news.filter((n) => new Date(n.created_at) > new Date(newsSeen || 0)).length;
  const freshCatches = recent.filter((c) => Date.now() - new Date(c.caught_at) < 3600000).length;
  const markNewsSeen = () => { const at = new Date().toISOString(); ls.setItem("owo_news_seen", at); setNewsSeen(at); };
  const showFriend = !PORTAL && !(user.seen_flags || []).includes("friend_tab");
  const openFriend = () => { setUser({ ...user, seen_flags: [...(user.seen_flags || []), "friend_tab"] }); api.post("/me/seen", { flag: "friend_tab" }).catch(() => {}); nav("/game/recruit"); };
  const water = lookups?.waterByKey[user.water];
  const nextWater = data?.waters.find((w) => !user.unlocked_waters.includes(w.key));

  return (
    <div className="space-y-3 fade-in" data-testid="harbor-page">
      <div className="water-hero !h-[170px]" style={{ backgroundImage: `url(${water?.image})` }}>
        <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between gap-3">
          <div>
            <div className="label label-gold">{tt("Welcome back,")} {user.title}</div>
            <div className="font-display text-2xl text-[#f4ead2]">{user.username}</div>
            <div className="text-[12.5px] text-[var(--text-2)]">{tt("You are at")} {water?.name}. {water?.desc}</div>
          </div>
          <button className="btn btn-gold btn-lg" onClick={() => nav("/game/fish")} data-testid="harbor-go-fishing-button">{tt("Go fishing")}</button>
        </div>
      </div>
      <InfoTabs inline testId="harbour-news-sheets" onOpen={(id) => { if (id === "news") markNewsSeen(); if (id === "friend") openFriend(); }} items={[
        { id: "server", label: "Server", Icon: pixelIcon("harbour"), badge: stats?.online || null, tone: "ok", node: (
        <Panel title={tt("Server")} icon="harbour" testId="server-stats">
          {stats && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-y-3 gap-x-4">
              <Stat label={tt("Anglers")} value={fmt(stats.players)} />
              <Stat label={tt("Online")} value={<span className="text-[var(--ok)]">{stats.online}</span>} />
              <Stat label={tt("Fish landed")} value={fmt(stats.catches)} />
              <Stat label={tt("Market listings")} value={fmt(stats.open_listings)} />
              <Stat label={tt("Gold in world")} value={fmt(stats.gold_in_circulation)} />
              <Stat label={tt("Species")} value={stats.species} />
            </div>
          )}
        </Panel>) },
        { id: "catches", label: "Notable catches", Icon: pixelIcon("rankings"), badge: freshCatches || null, node: (
        <Panel title={tt("Notable catches on the server")} icon="rankings" testId="recent-catches">
          {recent.length === 0 ? <Empty>{tt("Quiet waters.")}</Empty> : (
            <table className="table">
              <thead><tr><th>{tt("Angler")}</th><th>{tt("Fish")}</th><th className="r">{tt("Weight (")}{weightUnit()})</th><th className="r">{tt("When")}</th></tr></thead>
              <tbody>{recent.map((c) => <tr key={c.id}><td><button className="hover:text-[var(--gold)]" onClick={() => nav(`/game/profile/${c.username}`)}>{c.username}</button></td><td className={`rar-${c.rarity}`}>{c.variant !== "normal" && <span className="tag tag-variant mr-1">{c.variant}</span>}{c.name}</td><td className="num r">{kg(c.weight)}</td><td className="r text-[var(--muted)] text-xs">{ago(c.caught_at)}</td></tr>)}</tbody>
            </table>
          )}
        </Panel>) },
        { id: "news", label: "News", Icon: pixelIcon("bell"), badge: unreadNews > 9 ? "9+" : unreadNews || null, node: <NewsPanel /> },
        ...(showFriend ? [{ id: "friend", label: "Bring a friend", Icon: pixelIcon("recruit"), badge: "!", node: null }] : []),
      ]} />

      <BossPanel boss={ev?.boss} waterKey={user.water} />
      <ExpeditionPanel ev={ev} waterKey={user.water} />

      <GuestQuests />

      <DailySpin />

      {user.level < 15 && <Link to="/game/wiki#guide" className="guide-cta" data-testid="harbor-guide-link"><PixelIcon name="journal" className="text-[#ffcf8a] shrink-0" /><span><b className="text-[#ffcf8a]">{tt("New here?")}</b> {tt("Read the New player guide: what to do first, what to focus on, and quick tips.")}</span><span className="ml-auto text-[var(--gold)] shrink-0">{tt("Open guide ›")}</span></Link>}

      <Dockside />


      <MobileGroup className="grid md:grid-cols-2 gap-3" testId="harbour-sheets" items={[["Progress", pixelIcon("compass")], ["Goals", pixelIcon("bobber")]]}>
        <Panel title={tt("Your progress")} icon="compass">
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <Stat label={tt("Level")} value={user.level} />
            <Stat label={tt("Gold")} value={<Gold n={user.gold} />} />
            <Stat label={tt("Fish landed")} value={fmt(user.stats.catches)} />
            <Stat label={tt("Species found")} value={<span>{journalCount ?? user.stats.species} <span className="text-[var(--muted)] text-xs">/ {data?.fish.length}</span></span>} />
            <Stat label={tt("Heaviest")} value={user.stats.heaviest_kg ? wt(user.stats.heaviest_kg) : "-"} />
            <Stat label={tt("Waters")} value={`${user.unlocked_waters.length} / ${data?.waters.length}`} />
          </div>
        </Panel>
        <Panel title={tt("Next goals")} icon="bobber">
          <ul className="text-[12.5px] space-y-1.5 text-[var(--text-2)]">
            {nextWater && <li>{tt("› Reach")} <b className="text-[var(--text)]">{tt("Lv")} {nextWater.level}</b> {tt("and save")} <b className="text-[#ffcfa8]">{fmt(nextWater.fee)}g</b> {tt("for")} <Link to="/game/waters" className="underline">{nextWater.name}</Link></li>}
            {user.gear.rod === "rod_cane" && <li>{tt("› Buy your first real rod at the")} <Link to="/game/shop" className="underline">{tt("Tackle Shop")}</Link></li>}
            <li>{tt("› Discover all")} {data?.fish.filter((f) => f.water === user.water).length} {tt("species at")} {water?.name}</li>
            <li>{tt("› Land a legendary catch (you have")} {user.stats.legendary})</li>
            <li>{tt("› Break your record:")} {user.stats.heaviest_name ? `${user.stats.heaviest_name} ${wt(user.stats.heaviest_kg)}` : tt("no catches yet")}</li>
          </ul>
        </Panel>
      </MobileGroup>

    </div>
  );
}
