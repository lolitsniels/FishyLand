/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SOCIAL_NETS } from "../lib/socials";
import { User, LogOut, Settings, Heart, Lock, Menu, X } from "lucide-react";
import { pixelIcon, PixelIcon } from "../components/PixelIcon";
import AlertBanner from "../components/AlertBanner";
import { useSwipeMenu } from "../lib/useSwipeMenu";
import { HiddenPumpkin } from "../components/HiddenPumpkin";
import DuelWatcher from "../components/DuelWatcher";
import SettingsModal from "../components/SettingsModal";
import { useGame } from "../context/GameContext";
import { api, fmt, wtText } from "../lib/api";
import { usePrefs, applyUiScale } from "../lib/prefs";
import { Bar, Gold, Pearls, AdminBadge, ModBadge } from "../components/ui-bits";
import { WarningPopup } from "../components/WarningPopup";
import { BoostBadge } from "../components/BoostBadge";
import Tutorial from "../components/Tutorial";
import { Avatar } from "../components/Avatar";
import ChatPanel from "../components/ChatPanel";
import FriendsPanel from "../components/FriendsPanel";
import GuestSetupBanner from "../components/GuestSetupBanner";
import { PushOptIn } from "../components/PushOptIn";
import { HumanCheck } from "../components/HumanCheck";
import { t as tt } from "../i18n";
import { Candles } from "./game/Halloween";
import { sfx } from "../lib/sound";
import { PORTAL, PORTAL_BLOCKED, portalSignal } from "../lib/portal";

const P = pixelIcon;
const NAV = [
  ["/game", "Harbour", P("harbour"), true], ["/game/fish", "Go Fishing", P("fish")], ["/game/waters", "Waters", P("waters")], ["/game/quests", "Quests", P("quests")], ["/game/contracts", "Contracts", P("contracts")], ["/game/journal", "Fish Journal", P("journal")],
  ["/game/inventory", "Inventory", P("inventory")], ["/game/shop", "Tackle Shop", P("shop")], ["/game/pearl-shop", "Pearl Shop", P("pearl")], ["/game/crafting", "Bait Crafting", P("bait")], ["/game/market", "Market", P("market")],
  ["/game/leaderboards", "Rankings", P("rankings")], ["/game/tournaments", "Tournaments", P("tournaments")], ["/game/crews", "Crews", P("crews")], ["/game/achievements", "Achievements", P("achievements")],
  ["/game/messages", "Messages", P("messages")], ["/game/recruit", "Recruit", P("recruit")], ["/game/vote", "Vote", P("vote")], ["/game/profile", "My Angler", P("angler")], ["/game/almanac", "Almanac", P("almanac")], ["/game/wiki", "Wiki", P("wiki")],
];
const ADMIN_NAV = ["/game/admin", "Admin", P("admin")];
const MOD_NAV = ["/game/mod", "Mod Panel", P("mod")];
const DUEL_NAV = ["/game/duel", "Fishing Duel", P("duel")];
const HALLOWEEN_ICON = P("halloween");

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;
const CHAT_KEY = "owo_chat_open";

// Seconds until the next energy point, derived from the same server snapshot the HUD uses.
function EnergyHud({ user }) {
  const [hover, setHover] = useState(false);
  const [left, setLeft] = useState(null);
  const regenSec = user.energy_regen_sec || 60;
  useEffect(() => {
    if (!hover) return undefined;
    const calc = () => {
      if (user.energy >= user.max_energy) return setLeft(null);
      if (user._t0 === undefined) return setLeft("…");
      const regen = regenSec * 1000;
      setLeft(Math.max(1, Math.ceil((regen - ((Date.now() - user._t0) % regen)) / 1000)));
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [hover, user, regenSec]);
  const fullSec = typeof left === "number" ? left + (user.max_energy - user.energy - 1) * regenSec : null;
  const fullTxt = fullSec != null ? (fullSec >= 3600 ? `${Math.floor(fullSec / 3600)}h ${Math.floor((fullSec % 3600) / 60)}m` : `${Math.floor(fullSec / 60)}m ${Math.round(fullSec % 60)}s`) : null;
  return (
    <div className="relative flex items-center gap-2 w-full" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} data-testid="hud-energy-wrap">
      <span className="label w-12">{tt("Energy")}</span><Bar value={user.energy} max={user.max_energy} color="var(--energy)" className="flex-1" /><span className="num text-[11px]" data-testid="hud-energy">{user.energy}/{user.max_energy}</span>
      {hover && (
        <div className="absolute left-0 top-full mt-1.5 z-30 panel panel-gold px-2 py-1 text-[11px] whitespace-nowrap shadow-[0_6px_18px_rgba(0,0,0,.5)]" data-testid="energy-tooltip">
          {left === null ? tt("Energy is full") : <>{tt("Next energy in")} <span className="num text-[var(--energy)]">{left}s</span></>}<span className="text-[var(--muted)]"> {tt("· +1 every")} {Math.round(regenSec)}s</span>
          {fullTxt && <span className="text-[var(--muted)]"> {tt("· Full in")} <span className="num text-[#f4ead2]" data-testid="energy-full-in">{fullTxt}</span></span>}
        </div>
      )}
    </div>
  );
}

function SocialButtons() {
  const [links, setLinks] = useState({});
  useEffect(() => { api.get("/site/social").then((r) => setLinks(r.data)).catch(() => {}); }, []);
  return SOCIAL_NETS.filter(([n]) => links[n]).map(([n, label, Icon, color], i) => n === "discord"
    ? <a key={n} href={links[n]} target="_blank" rel="noopener noreferrer" className="btn btn-sm !text-[#7289da] hover:!text-[#a6b7ff]" title={tt("Join our Discord")} data-testid="discord-link" aria-label={tt("Join our Discord")}><PixelIcon name="discord" size={16} /></a>
    : <a key={n} href={links[n]} target="_blank" rel="noopener noreferrer" className={`btn btn-sm ${i > 2 ? "max-sm:!hidden" : ""}`} style={{ color }} title={`Follow us on ${label}`} aria-label={`Follow us on ${label}`} data-testid={`social-link-${n}`}><Icon size={13} /></a>);
}

export default function GameShell() {
  const { user, setUser, logout, lookups, dataError, loadData, data } = useGame();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [online, setOnline] = useState([]);
  const [feed, setFeed] = useState([]);
  const [chatOpen, setChatOpenRaw] = useState(() => isDesktop() && localStorage.getItem(CHAT_KEY) === "1");
  const setChatOpen = (v) => setChatOpenRaw((c) => { const n = typeof v === "function" ? v(c) : v; if (isDesktop()) localStorage.setItem(CHAT_KEY, n ? "1" : "0"); if (n) { setMentions(0); api.post("/chat/seen").catch(() => {}); } return n; });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { weight_unit: unit } = usePrefs();
  const [unread, setUnread] = useState(0);
  const [questsReady, setQuestsReady] = useState(0);
  const [crewInbox, setCrewInbox] = useState(0);
  const [chestReady, setChestReady] = useState(false);
  const [gbUnread, setGbUnread] = useState(0);
  const [reportsOpen, setReportsOpen] = useState(0);
  useEffect(() => { const f = (e) => setReportsOpen(e.detail); window.addEventListener("reports-open", f); return () => window.removeEventListener("reports-open", f); }, []);
  const [voteReady, setVoteReady] = useState(0);
  const [contractsReady, setContractsReady] = useState(0);
  const [mentions, setMentions] = useState(0);
  const [boost, setBoost] = useState(null);
  const [luckBoost, setLuckBoost] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useSwipeMenu(menuOpen, setMenuOpen, !isDesktop());
  useEffect(() => {  // tap a clamped intro paragraph (phones) to read all of it
    const on = (e) => { const el = e.target.closest?.(".m-clamp"); if (el && !e.target.closest("a, button")) el.classList.toggle("open"); };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  }, []);
  const [event, setEvent] = useState(null);
  const dataRef = useRef(data);
  const pulseRef = useRef(null);
  const levelRef = useRef(user?.level);
  useEffect(() => { if (levelRef.current && user?.level > levelRef.current) setTimeout(() => sfx("level"), 900); levelRef.current = user?.level; }, [user?.level]);
  useEffect(() => { portalSignal("play"); }, []);
  const prevPath = useRef(pathname);
  useEffect(() => { if (pathname === "/game" && prevPath.current !== "/game") portalSignal("break"); prevPath.current = pathname; }, [pathname]);
  useEffect(() => {  // one-time thank-you for playing from the installed app (phone or PC)
    const app = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (!user || user.app_reward || !app) return;
    api.post("/me/app-reward").then((r) => { setUser(r.data.user); toast.success(tt("Thanks for installing the app! You got the App Angler frame and an Energy Potion. Wear it from My Angler.")); }).catch(() => {});
  }, [user?.id, user?.app_reward]); // eslint-disable-line react-hooks/exhaustive-deps
  dataRef.current = data;

  useEffect(() => {
    const pulse = () => api.get("/shell/pulse").then((r) => {
      const p = r.data;
      (p.notices || []).forEach((n) => toast.message(n.text, { duration: 12000, action: n.url ? { label: n.label ? tt(n.label) : tt("Open"), onClick: () => nav(n.url) } : undefined }));
      const prev = pulseRef.current;
      if (prev) { if (p.unread > prev.unread) sfx("pm"); if ((p.mentions || 0) > prev.mentions) sfx("mention", 3000); }
      pulseRef.current = { unread: p.unread, mentions: p.mentions || 0 };
      setUnread(p.unread); setQuestsReady(p.story_ready); setCrewInbox(p.crew_inbox); setChestReady(p.chest_ready); setGbUnread(p.guestbook_unread); setVoteReady(p.vote_ready || 0); setBoost(p.boost || null); setLuckBoost(p.luck_boost || null); setContractsReady(p.contracts_ready || 0); setMentions(p.mentions || 0); setReportsOpen(p.reports_open || 0); setEvent(p.event || null);
      // New species/gear shipped while this tab was open (or the browser served a stale cached payload): refetch with a cache-busting version.
      if (p.data_version && dataRef.current && dataRef.current.version !== p.data_version) loadData(p.data_version);
    }).catch(() => {});
    const load = () => {
      api.get("/players/online").then((r) => setOnline(r.data)).catch(() => {});
      api.get("/feed?limit=40").then((r) => setFeed(r.data)).catch(() => {});
      pulse();
    };
    load();
    const events = ["chest-changed", "quests-changed", "crew-inbox-changed", "guestbook-changed"];
    events.forEach((ev) => window.addEventListener(ev, pulse));
    const t = setInterval(load, 30000);
    const onVisible = () => { if (!document.hidden) load(); };  // polling pauses while the tab is hidden; catch up on return
    document.addEventListener("visibilitychange", onVisible);
    // Hidden-tab heartbeat: one tiny request every 10 min keeps the player "online" (30-min window) without the regular polling.
    const hb = setInterval(() => { if (document.hidden) api.get("/auth/ping").catch(() => {}); }, 600000);
    // Client-side energy mirrors the server: base snapshot (+ how far into the regen cycle the server was) advanced by wall-clock time.
    const e = setInterval(() => setUser((u) => {
      if (!u) return u;
      if (u._e0 === undefined) return { ...u, _e0: u.energy, _t0: Date.now() - (u.energy_progress_sec || 0) * 1000 };
      const regen = (u.energy_regen_sec || 10) * 1000;
      const energy = u._e0 >= u.max_energy ? u._e0 : Math.min(u.max_energy, u._e0 + Math.floor((Date.now() - u._t0) / regen));
      return energy === u.energy ? u : { ...u, energy };
    }), 1000);
    return () => { clearInterval(t); clearInterval(e); clearInterval(hb); document.removeEventListener("visibilitychange", onVisible); events.forEach((ev) => window.removeEventListener(ev, pulse)); };
  }, [setUser]);

  useEffect(() => {
    applyUiScale();
    const on = () => applyUiScale();
    window.addEventListener("resize", on); window.addEventListener("prefs-changed", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("prefs-changed", on); document.documentElement.style.zoom = ""; document.documentElement.style.removeProperty("--zoom"); };
  }, []);

  useEffect(() => {
    if (isDesktop()) return;
    setChatOpen(false); setMenuOpen(false);
  }, [pathname]);

  const water = lookups?.waterByKey[user.water];
  useEffect(() => { document.documentElement.classList.toggle("ev-halloween", event?.key === "halloween"); }, [event]);
  const navList = [NAV[1], ...(event?.key === "halloween" ? [["/game/halloween", "Halloween", HALLOWEEN_ICON]] : []), NAV[0], NAV[2], DUEL_NAV, ...NAV.slice(3), ...(user.is_admin || user.is_mod ? [MOD_NAV] : []), ...(user.is_admin ? [ADMIN_NAV] : [])].filter(([to]) => !PORTAL || !PORTAL_BLOCKED.includes(to));
  const current = navList.find(([to, , , end]) => (end ? pathname === to : pathname.startsWith(to))) || navList[0];
  const CurIcon = current[2];
  const badgeCount = unread + questsReady + crewInbox + contractsReady + gbUnread + voteReady + reportsOpen + (chestReady ? 1 : 0);
  const navItems = navList.map(([to, label, Icon, end]) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? "active" : ""} ${label === "Admin" ? "text-[#f59a5c]" : ""} ${label === "Mod Panel" ? "text-[#7fd6b8]" : ""} ${label === "Go Fishing" ? "nav-primary" : ""} ${label === "Halloween" ? "nav-event" : ""} ${label === "Fishing Duel" && !user.duel_access ? "opacity-60" : ""}`} data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                <Icon /> <span className="truncate min-w-0" title={tt(label)}>{tt(label)}</span>{label === "Go Fishing" && <span className="nav-primary-hint">{water?.name}</span>}
                {label === "Fishing Duel" && !user.duel_access && <span className="ml-auto num text-[10px] text-[var(--muted)] inline-flex items-center gap-0.5" title={tt("Opens at level {{v0}}", { v0: user.duel_level })} data-testid="duel-nav-lock"><Lock size={10} />{user.duel_level}</span>}
                {label === "Harbour" && chestReady && <span className="ml-auto w-2 h-2 rounded-full bg-[var(--gold)] shadow-[0_0_5px_var(--gold)]" title={tt("Today's daily spin is waiting")} data-testid="chest-ready-dot" />}
                {label === "Mod Panel" && reportsOpen > 0 && <span className="ml-auto num text-[10px] px-1.5 bg-[#7fd6b8] text-black rounded-sm font-bold" title={`${reportsOpen} open chat report${reportsOpen > 1 ? "s" : ""}`} data-testid="reports-open-badge">{reportsOpen}</span>}
                {label === "Messages" && unread > 0 && <span className="ml-auto num text-[10px] px-1.5 bg-[var(--gold)] text-black rounded-sm" data-testid="unread-badge">{unread}</span>}
                {label === "Quests" && questsReady > 0 && <span className="ml-auto num text-[10px] px-1.5 bg-[var(--gold)] text-black rounded-sm font-bold" data-testid="quests-ready-badge" title={`${questsReady} new chapter${questsReady > 1 ? "s" : ""} ready to accept`}>!</span>}
                {label === "Crews" && crewInbox > 0 && <span className="ml-auto num text-[10px] px-1.5 bg-[var(--gold)] text-black rounded-sm" data-testid="crew-inbox-badge" title={tt("Pending crew invites or requests")}>{crewInbox}</span>}
                {label === "Contracts" && contractsReady > 0 && <span className="ml-auto num text-[10px] px-1.5 bg-[var(--gold)] text-black rounded-sm" title={`${contractsReady} contract${contractsReady > 1 ? "s" : ""} ready to hand in`} data-testid="contracts-ready-badge">{contractsReady}</span>}
                {label === "Vote" && voteReady > 0 && <span className="ml-auto w-2 h-2 rounded-full bg-[var(--gold)] shadow-[0_0_5px_var(--gold)]" title={tt("A vote reward is available")} data-testid="vote-ready-dot" />}
                {label === "My Angler" && gbUnread > 0 && <span className="ml-auto num text-[10px] px-1.5 bg-[var(--gold)] text-black rounded-sm" data-testid="guestbook-unread-badge" title={`${gbUnread} new guestbook ${gbUnread === 1 ? "entry" : "entries"}`}>{gbUnread}</span>}
              </NavLink>
  ));
  return (
    <div className={`min-h-screen flex flex-col bg-[var(--bg-deep)] game-shell px-ui ${chatOpen ? "chat-expanded" : ""}`} style={{ "--shell-bg": "url(/art/bg_water_tile.png)" }} data-testid="game-shell">
      <div className="game-water" aria-hidden="true" />
      <header className="game-header" style={{ backgroundImage: "url(/art/header_ember.jpg)" }}>
        <div className="max-w-[1400px] 2xl:max-w-[1560px] mx-auto px-3 h-16 flex items-center gap-3 sm:gap-5">
          <NavLink to="/game" className="shrink-0" data-testid="game-logo-link"><img src="/art/landing_logo.webp" alt="The Fishing Lands" className="h-[34px] sm:h-[44px] w-auto drop-shadow-[0_3px_6px_rgba(0,0,0,.7)]" draggable="false" data-testid="game-logo" /></NavLink>
          <div className="hidden lg:flex items-center gap-6 text-[12.5px] flex-1 min-w-0" data-testid="hud">
            <div className="flex items-center gap-2.5 whitespace-nowrap min-w-0">
              <NavLink to="/game/profile" title={tt("My Angler")} data-testid="hud-avatar-link"><Avatar id={user.avatar} size="sm" gold frame={user.frame} /></NavLink>
              <div className="leading-tight min-w-0">
                <div className="font-medium truncate" style={user.name_colour_hex ? { color: user.name_colour_hex } : undefined} data-testid="hud-username">{user.crew && <span className="text-[var(--gold)] mr-1" style={user.crew.colour ? { color: user.crew.colour } : undefined}>[{user.crew.tag}]</span>}{user.username}{user.is_admin && <AdminBadge data-testid="hud-admin-badge" />}{user.is_mod && <ModBadge className="ml-1" data-testid="hud-mod-badge" />}</div>
                <div className="text-[11.5px] text-[var(--muted)] truncate">{tt("Lv")} <span className="num" data-testid="hud-level">{user.level}</span> · <span data-testid="hud-title">{user.title}</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-52 shrink-0" data-testid="hud-bars">
              <div className="flex items-center gap-2"><span className="label w-12">{tt("XP")}</span><Bar value={user.xp_into_level} max={user.xp_next} color="var(--xp)" className="flex-1" /><span className="num text-[11px] text-[var(--muted)]">{user.xp_into_level}/{user.xp_next}</span></div>
              <EnergyHud user={user} />
            </div>
            <div className="flex flex-col gap-0.5 leading-tight min-w-0">
              <div className="flex items-center gap-3 whitespace-nowrap">
                <Gold n={user.gold} className="text-[13.5px]" data-testid="hud-gold" />
                <Pearls n={user.pearls} className="text-[13px]" data-testid="hud-pearls" />
                {event?.key === "halloween" && <NavLink to="/game/halloween" title="Soul Candles" data-testid="hud-candles"><Candles n={user.candles} className="text-[13px]" /></NavLink>}
              </div>
              <div className="text-[11.5px] text-[var(--muted)] whitespace-nowrap truncate" data-testid="hud-water">{tt("At")} <span className="text-[var(--text-2)]">{water?.name}</span></div>
            </div>
            <div className="flex items-center gap-2"><BoostBadge boost={boost} /><BoostBadge boost={luckBoost} /></div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!PORTAL && <>
            <NavLink to="/game/support" className="btn btn-sm !text-[#e8647a] hover:!text-[#ff8fa3]" title={tt("Donate to The Fishing Lands")} aria-label={tt("Donate to The Fishing Lands")} data-testid="support-button">
              <Heart size={13} /><span className="hidden sm:inline">{tt("Donate")}</span>
            </NavLink>
            <SocialButtons />
            </>}
            <button className="btn btn-sm" onClick={() => setSettingsOpen(true)} title={tt("Account settings")} aria-label={tt("Account settings")} data-testid="settings-button"><Settings size={13} /></button>
            <button className="btn btn-sm" onClick={async () => { await logout(); nav("/"); }} title={tt("Sign out")} data-testid="logout-button"><LogOut size={13} /></button>
          </div>
        </div>
      </header>
      <GuestSetupBanner />
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" data-testid="mobile-menu">
          <div className="absolute inset-0 bg-[rgba(0,0,0,.65)] mobile-menu-backdrop" onClick={() => setMenuOpen(false)} data-testid="mobile-menu-backdrop" />
          <div className="absolute inset-y-0 left-0 w-[84vw] max-w-[360px] panel !rounded-none flex flex-col shadow-[6px_0_30px_rgba(0,0,0,.6)] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] mobile-menu-panel">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
              <Avatar id={user.avatar} size="sm" gold frame={user.frame} />
              <span className="truncate text-[13px] flex-1">{user.username} <span className="text-[var(--muted)]">{tt("· Lv")} {user.level}</span></span>
              <button className="btn btn-sm" onClick={() => setMenuOpen(false)} aria-label={tt("Close")} data-testid="mobile-menu-close"><X size={14} /></button>
            </div>
            <nav className="py-1 flex flex-col overflow-y-auto flex-1 mobile-menu-list" data-testid="mobile-menu-list">{navItems}</nav>
            <NavLink to="/game/players" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 border-t border-[var(--border)] text-[13px] text-[var(--text-2)] hover:text-[var(--gold)]" data-testid="mobile-menu-online"><User size={15} className="text-[#5fd36a]" /><b className="num text-[#5fd36a]">{online.length}</b> {tt("anglers online")}</NavLink>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] 2xl:max-w-[1560px] w-full mx-auto px-3 py-3 flex-1 grid gap-4 grid-cols-1 lg:grid-cols-[300px_1fr] 2xl:grid-cols-[320px_1fr] game-body">
        <aside className="panel game-nav self-start lg:sticky" data-testid="game-nav">
          <div className="lg:hidden mobile-statbar" data-testid="mobile-nav-bar">
            <div className="flex items-center gap-2">
              <button className="mobile-menu-btn relative" onClick={() => setMenuOpen(true)} aria-label={tt("Menu")} data-testid="mobile-menu-button"><Menu size={18} />{badgeCount > 0 && <span className="absolute -top-1 -right-1 num text-[9.5px] min-w-[16px] h-4 px-1 flex items-center justify-center bg-[var(--gold)] text-black rounded-full font-bold" data-testid="mobile-menu-badge">{badgeCount}</span>}</button>
              <span className="flex items-center gap-1.5 text-[14px] min-w-0 font-display text-[#f4ead2]"><CurIcon size={16} className="text-[var(--gold)] shrink-0" /><span className="truncate" data-testid="mobile-nav-current">{tt(current[1])}</span></span>
              <span className="ml-auto flex items-center gap-2.5 whitespace-nowrap text-[12.5px]">
                <Gold n={user.gold} className="text-[12.5px]" data-testid="mobile-gold" />
                <Pearls n={user.pearls} className="text-[12.5px]" data-testid="mobile-pearls" />
                {event?.key === "halloween" && <NavLink to="/game/halloween" title="Soul Candles" data-testid="mobile-candles"><Candles n={user.candles} className="text-[12.5px]" /></NavLink>}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="num text-[11.5px] text-[var(--muted)] shrink-0" data-testid="mobile-level">{tt("Lv")} {user.level}</span>
              <span className="flex-1 min-w-0" data-testid="mobile-xp-bar" title={`${user.xp_into_level}/${user.xp_next} XP`}><Bar value={user.xp_into_level} max={user.xp_next} color="var(--xp)" className="mobile-mini-bar" /></span>
              <span className="num text-[11.5px] text-[var(--energy)] shrink-0" data-testid="mobile-energy">⚡ {user.energy}/{user.max_energy}</span>
              <Bar value={user.energy} max={user.max_energy} color="var(--energy)" className="w-16 mobile-mini-bar" />
            </div>
            {(boost || luckBoost) && <div className="flex flex-wrap gap-1.5 mt-1.5"><BoostBadge boost={boost} /><BoostBadge boost={luckBoost} /></div>}
          </div>
          <nav className="nav-grid hidden lg:grid" data-testid="nav-grid">{navItems}</nav>
          <div className="divider hidden lg:block" />
          <div className="game-nav-social hidden lg:block">
          <FriendsPanel />
          <div className="divider hidden lg:block" />
          <div className="p-3 text-[11.5px] text-[var(--muted)] hidden lg:block">
            <NavLink to="/game/players" className="label mb-1 flex items-center justify-between hover:text-[var(--gold)]" title={tt("All anglers, search, online list")} data-testid="online-players-link"><span>{tt("Online now ·")} {online.length}</span><span className="text-[10px] normal-case tracking-normal">{tt("all anglers ›")}</span></NavLink>
            <ul className="space-y-0.5" data-testid="online-players">
              {online.map((p) => <li key={p.username} className="flex items-center gap-1.5"><Avatar id={p.avatar} size="xs" frame={p.frame} /><button className="hover:text-[var(--gold)] text-left truncate flex-1" onClick={() => nav(`/game/profile/${p.username}`)}>{p.username}</button><span className="num">{p.level}</span></li>)}
            </ul>
          </div>
          </div>
        </aside>

        <main className="min-w-0">
          <AlertBanner />
          <HiddenPumpkin active={event?.key === "halloween"} />
          {user.duel_access && <DuelWatcher />}
          {user.tutorial && !user.tutorial.done && lookups && <Tutorial />}
          {lookups ? <div key={unit} className="contents"><Outlet /></div> : (
            <section className="panel p-6 text-center text-[13px]" data-testid="world-loading">
              {dataError ? (
                <>
                  <div className="text-[#f0a5a3] mb-2">{tt("The world's charts could not be loaded.")}</div>
                  <button className="btn btn-gold" onClick={loadData} data-testid="world-retry-button">{tt("Try again")}</button>
                </>
              ) : <div className="text-[var(--muted)]">{tt("Unrolling the charts of the world...")}</div>}
            </section>
          )}
        </main>

      </div>
      <div className="chat-dock" data-testid="chat-dock">
        <ChatPanel collapsed={!chatOpen} onToggle={() => setChatOpen(true)} onClose={() => setChatOpen(false)} feed={feed} online={online} mentions={mentions} />
      </div>
      {chatOpen && <div className="chat-backdrop lg:hidden" onClick={() => setChatOpen(false)} data-testid="chat-backdrop" />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {!PORTAL && <PushOptIn />}
      <HumanCheck />
      <WarningPopup />
    </div>
  );
}
