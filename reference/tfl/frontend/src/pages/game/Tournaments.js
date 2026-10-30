import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ticket, Clock, Users, Trophy } from "lucide-react";
import { api, errMsg, fmt, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Empty, Gold, Pearls } from "../../components/ui-bits";
import { InfoTabs } from "../../components/MobileSheets";
import { pixelIcon } from "../../components/PixelIcon";
import { Avatar } from "../../components/Avatar";
import { contestVal } from "./contestBits";
import { t as tt } from "../../i18n";

const left = (at) => {
  const s = Math.max(0, (new Date(at) - Date.now()) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
const hhmm = (at) => new Date(at).toISOString().slice(11, 16) + " UTC";
const unitOne = (u) => ({ catches: tt("catch"), species: tt("species"), variants: tt("variant"), pts: tt("point"), kg: "kg" }[u] || u);
const Money = ({ cur, n, className = "" }) => (cur === "gold" ? <Gold n={n} className={className} /> : <Pearls n={n} className={className} />);

function Icon({ t, size = 64 }) {
  return <img src={t.icon} alt={t.label} width={size} height={size} className="shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,.6)]" style={{ width: size, height: size }} data-testid={`tournament-icon-${t.category}`} />;
}

function Card({ t, mine, busy, onJoin, user }) {
  const live = t.status === "live";
  const n = t.entrants.length;
  const canAfford = user[t.currency] >= t.fee;
  return (
    <div className={`panel ${live ? "panel-gold" : ""} p-3`} data-testid={`tournament-${t.id}`} data-status={t.status}>
      <div className="flex gap-3">
        <Icon t={t} size={72} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`tag ${live ? "text-[var(--ok)]" : "text-[var(--gold)]"}`} data-testid={`tournament-status-${t.id}`}>{live ? tt("LIVE · ends in {{v0}}", { v0: left(t.end) }) : tt("Buy-in open · starts in {{v0}}", { v0: left(t.start) })}</span>
            <span className="tag">{t.currency === "gold" ? tt("Gold tournament") : tt("Pearl tournament")}</span>
            <span className="tag num">{t.hours}h</span>
          </div>
          <div className="font-display text-[17px] text-[#f4ead2] mt-1">{t.label}</div>
          <div className="text-[12px] text-[var(--text-2)]">{t.desc}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--muted)] mt-1.5 num">
            <span className="inline-flex items-center gap-1"><Clock size={11} /> {hhmm(t.start)} → {hhmm(t.end)}</span>
            <span className="inline-flex items-center gap-1"><Users size={11} /> {n} {tt("in")} {n < t.min_entrants && !live && <span className="text-[#f0a5a3]">({tt("needs {{v0}}", { v0: t.min_entrants })})</span>}</span>
            <span className="inline-flex items-center gap-1" title={`${tt("cap")} ${t.cap} ${t.currency} · ${tt("podium")} +${t.podium.join("/")} ${t.podium_currency}`}><Trophy size={11} /> <Money cur={t.currency} n={t.rate} className="text-[11.5px]" /> {tt("per")} {unitOne(t.unit)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right space-y-1.5">
          <div className="text-[11px] text-[var(--muted)] uppercase tracking-wider">{tt("buy-in")}</div>
          <Money cur={t.currency} n={t.fee} className="text-[15px]" />
          {t.joined ? <div className="tag text-[var(--ok)] inline-flex items-center gap-1" data-testid={`tournament-joined-${t.id}`}><Ticket size={11} /> {tt("your ticket")}</div>
            : live ? <div className="text-[11px] text-[var(--muted)]">{tt("closed")}</div>
            : <button className="btn btn-sm btn-gold" disabled={busy || !!mine || !canAfford || user.is_guest} title={mine ? tt("You already hold a ticket") : !canAfford ? tt("Not enough {{v0}}", { v0: t.currency }) : ""} onClick={() => onJoin(t)} data-testid={`tournament-join-${t.id}`}>{tt("Buy in")}</button>}
        </div>
      </div>
      {n > 0 && !live && <div className="flex flex-wrap gap-1 mt-2" data-testid={`tournament-entrants-${t.id}`}>{t.entrants.map((e) => <span key={e.username} className="inline-flex items-center gap-1 text-[11px] text-[var(--text-2)]"><Avatar id={e.avatar} name={e.username} size="xs" />{e.username}</span>)}</div>}
      {live && (
        <table className="table mt-2" data-testid={`tournament-standings-${t.id}`}><tbody>
          {(t.standings || []).length === 0 ? <tr><td className="text-[var(--muted)] italic">{tt("Nothing on the board yet, first fish takes the lead.")}</td></tr>
            : t.standings.slice(0, 10).map((s, i) => <tr key={s.user_id} className={s.username === user.username ? "bg-[rgba(212,160,23,.08)]" : ""}>
              <td className="num w-6 text-[var(--muted)]">{i + 1}</td>
              <td><span className="inline-flex items-center gap-1.5"><Avatar id={s.avatar} name={s.username} size="xs" frame={s.frame} />{s.username}</span></td>
              <td className="num r text-[#ffcfa8]">{contestVal(t.unit, s.value)}{s.name ? <span className="text-[10.5px] text-[var(--muted)]"> · {s.name}</span> : null}</td>
              <td className="num r text-[var(--text-2)] w-20" title={s.reward >= t.cap ? tt("payout so far (capped)") : tt("payout so far")}><Money cur={t.currency} n={s.reward} className={`text-[11px] ${s.reward >= t.cap ? "!text-[var(--ok)]" : ""}`} /></td>
            </tr>)}
        </tbody></table>
      )}
    </div>
  );
}

export default function Tournaments() {
  const { user, setUser } = useGame();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/tournaments").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);
  const join = async (t) => {
    setBusy(true);
    try { const r = await api.post(`/tournaments/${t.id}/join`); setD(r.data); setUser(r.data.user); toast.success(tt("You're in! The {{v0}} tournament starts at {{v1}}.", { v0: t.label, v1: hhmm(t.start) })); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  if (!d) return <Empty>{tt("Loading tournaments...")}</Empty>;
  const r = d.rules;
  return (
    <div className="space-y-3 fade-in" data-testid="tournaments-page">
      <Panel icon="tournaments" title={tt("Tournaments")} right={d.my_ticket && <span className="tag text-[var(--ok)] inline-flex items-center gap-1"><Ticket size={11} /> {tt("ticket held")}</span>}>
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Scheduled contests you buy into. One starts every 3 hours, alternating gold and Pearls, and each runs 1 or 2 hours so there is always a breather between them; buy-in opens {{v0}} hour before the start and closes when it begins. A tournament needs at least {{v1}} anglers or it is called off and everyone is refunded. You can hold one ticket at a time. Only fish you hook yourself during the window count.", { v0: r.signup_h, v1: r.min_entrants })}</p>
        <p className="text-[12.5px] text-[var(--text-2)] mt-1">{tt("The buy-in is a fee, not a prize pool: you are paid for your own score, a rate per fish, kilo, species or point that grows with the buy-in, so the more you land the more you earn, whatever the others do. Gold payouts are capped at {{v0}}× the buy-in, Pearl payouts at {{v1}} Pearls. The top three also take a podium bonus in the other currency and the winner keeps the title", { v0: r.cap_mult_gold, v1: r.cap_pearls })} <span className="text-[var(--gold)]">"{r.title}"</span>.</p>
      </Panel>
      <InfoTabs inline testId="tournament-tabs" initial={d.active.length === 0 ? "upcoming" : null} items={[
        { id: "upcoming", label: "Coming up", Icon: pixelIcon("compass"), node: (
      <Panel icon="compass" title={tt("Coming up")} bodyClass="!p-0" testId="tournaments-upcoming">
        <table className="table"><tbody>
          {d.upcoming.map((t) => <tr key={t.currency + t.start} data-testid={`upcoming-${t.currency}-${t.start}`}>
            <td className="w-10"><Icon t={t} size={34} /></td>
            <td><div className="font-display text-[13px] text-[#f4ead2]">{t.label}</div><div className="text-[11px] text-[var(--muted)]">{t.currency === "gold" ? tt("Gold") : tt("Pearls")} · {t.hours}h · {tt("buy-in")} <Money cur={t.currency} n={t.fee} className="text-[11px]" /> · <Money cur={t.currency} n={t.rate} className="text-[11px]" /> {tt("per")} {unitOne(t.unit)}</div></td>
            <td className="num r text-[var(--text-2)]">{tt("starts")} {hhmm(t.start)}<div className="text-[11px] text-[var(--muted)]">{tt("in")} {left(t.start)} · {tt("buy-in opens")} {hhmm(t.signup_at)}</div></td>
          </tr>)}
        </tbody></table>
      </Panel>) },
        { id: "past", label: "Recent results", Icon: pixelIcon("rankings"), node: (
      <Panel icon="rankings" title={tt("Recent results")} bodyClass="!p-0" testId="tournaments-past">
        {d.past.length === 0 ? <Empty>{tt("No tournaments have finished yet.")}</Empty> : (
          <table className="table"><tbody>
            {d.past.map((t) => <tr key={t.id} data-testid={`past-${t.id}`}>
              <td className="w-10"><Icon t={t} size={34} /></td>
              <td><div className="font-display text-[13px] text-[#f4ead2]">{t.label} <span className="text-[11px] text-[var(--muted)] num">· {t.currency} {fmt(t.fee)}</span></div><div className="text-[11px] text-[var(--muted)]">{ago(t.end)} · {t.entrants.length} {tt("anglers")}</div></td>
              <td className="text-[12px]">{t.status === "cancelled" ? <span className="text-[var(--muted)] italic">{tt("called off, too few anglers")}</span>
                : t.results.length === 0 ? <span className="text-[var(--muted)] italic">{tt("nobody scored")}</span>
                : t.results.slice(0, 3).map((w, i) => <span key={w.user_id} className="mr-3"><span className={i === 0 ? "text-[var(--gold)]" : ""}>{w.username}</span> <span className="num text-[11px] text-[var(--muted)]">{contestVal(t.unit, w.value)} · {fmt(w.reward)} {t.currency}</span></span>)}</td>
            </tr>)}
          </tbody></table>
        )}
      </Panel>) },
      ]} />
      {d.active.length === 0 ? <Panel icon="tournaments" title={tt("On the board")}><Empty>{tt("No tournament is taking buy-ins right now, see what's coming up.")}</Empty></Panel>
        : <div className="grid lg:grid-cols-2 gap-3" data-testid="tournaments-active">{d.active.map((t) => <Card key={t.id} t={t} mine={d.my_ticket} busy={busy} onJoin={join} user={user} />)}</div>}
    </div>
  );
}
