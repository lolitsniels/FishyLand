/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { api, errMsg, fmt, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Pearls, Empty } from "../../components/ui-bits";
import { InfoTabs } from "../../components/MobileSheets";
import { pixelIcon } from "../../components/PixelIcon";
import { t as tt } from "../../i18n";

const ORD = { 1: "1st", 2: "2nd", 3: "3rd" };
const RANK_COLOUR = { 1: "text-[var(--gold)]", 2: "text-[#d8d8e0]", 3: "text-[#d19a66]" };
const untilText = (isoStr) => { const ms = new Date(isoStr) - Date.now(); if (ms <= 0) return "moments"; const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000); return d > 0 ? `${d}d ${h}h` : `${h}h`; };

function SiteCard({ s, onStart, pending }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-2)] p-3 flex flex-col gap-2" data-testid={`vote-site-${s.key}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-display text-[15px] text-[#f4ead2]">{s.name}</div>
        <span className="tag whitespace-nowrap">{tt("every")} {s.cooldown_h}h</span>
      </div>
      <div className="text-[12px] flex flex-wrap items-center gap-1.5">{tt("Reward")} <Gold n={s.gold} className="text-[12px]" />{s.pearls > 0 && <> + <Pearls n={s.pearls} className="text-[12px]" /></>}</div>
      <button className={`btn inline-flex items-center justify-center gap-1.5 ${s.ready ? "btn-gold" : ""}`} onClick={() => onStart(s)} disabled={pending === s.key} data-testid={`vote-button-${s.key}`}>
        <ExternalLink size={13} /> {pending === s.key ? tt("Waiting for your vote...") : `Vote on ${s.name}`}
      </button>
      {!s.ready && <div className="text-[11.5px] text-[var(--muted)]" data-testid={`vote-cooldown-${s.key}`}>{tt("Voted")} {ago(s.last_at)} {tt("· reward claimed")}</div>}
    </div>
  );
}

function AdminRewards({ onChanged }) {
  const [sites, setSites] = useState([]);
  const [edits, setEdits] = useState({});
  useEffect(() => { api.get("/admin/vote-sites").then((r) => setSites(r.data)).catch(() => {}); }, []);
  const val = (s, k) => edits[s.key]?.[k] ?? s[k];
  const set = (s, k, v) => setEdits((e) => ({ ...e, [s.key]: { ...(e[s.key] || {}), [k]: v } }));
  const save = async (s) => {
    try {
      const r = await api.post("/admin/vote-sites", { key: s.key, name: s.name, url: s.url, cooldown_h: Number(val(s, "cooldown_h")), gold: Number(val(s, "gold")), pearls: Number(val(s, "pearls")) });
      setSites(r.data); setEdits((e) => ({ ...e, [s.key]: undefined })); toast.success(tt("{{v0}} updated", { v0: s.name })); onChanged();
    } catch (ex) { toast.error(errMsg(ex)); }
  };
  if (sites.length === 0) return null;
  return (
    <Panel icon="gear" title={tt("Admin · rewards & timers")} bodyClass="!p-0" testId="vote-admin-rewards">
      <div className="overflow-x-auto"><table className="table"><thead><tr><th>{tt("Site")}</th><th className="r">{tt("Every (h)")}</th><th className="r">{tt("Gold")}</th><th className="r">{tt("Pearls")}</th><th className="r" title={tt("Pay the angler this many minutes after they click, even if the toplist never sends a postback. 0 = postback required.")}>{tt("Trust (min)")}</th><th /></tr></thead><tbody>
        {sites.map((s) => (
          <tr key={s.key} data-testid={`vote-admin-row-${s.key}`}>
            <td>{s.name}</td>
            <td className="r"><input className="input num !w-16 text-right" type="number" min={1} max={168} value={val(s, "cooldown_h")} onChange={(e) => set(s, "cooldown_h", e.target.value)} data-testid={`vote-admin-cooldown-${s.key}`} /></td>
            <td className="r"><input className="input num !w-24 text-right" type="number" min={0} value={val(s, "gold")} onChange={(e) => set(s, "gold", e.target.value)} data-testid={`vote-admin-gold-${s.key}`} /></td>
            <td className="r"><input className="input num !w-16 text-right" type="number" min={0} max={50} value={val(s, "pearls")} onChange={(e) => set(s, "pearls", e.target.value)} data-testid={`vote-admin-pearls-${s.key}`} /></td>
            <td className="r"><input className="input num !w-16 text-right" type="number" min={0} max={60} value={val(s, "trust_after_min") ?? 0} onChange={(e) => set(s, "trust_after_min", e.target.value)} data-testid={`vote-admin-trust-${s.key}`} /></td>
            <td className="r"><button className="btn btn-sm btn-gold" disabled={!edits[s.key]} onClick={() => save(s)} data-testid={`vote-admin-save-${s.key}`}>{tt("Save")}</button></td>
          </tr>
        ))}
      </tbody></table></div>
    </Panel>
  );
}

export default function Vote() {
  const { user, setUser } = useGame();
  const [d, setD] = useState(null);
  const [pending, setPending] = useState(null);
  const pendingSince = useRef(null);
  const load = () => api.get("/vote").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!pending) return undefined;
    const t = setInterval(async () => {
      try {
        const r = await api.get("/vote");
        setD(r.data);
        const s = r.data.sites.find((x) => x.key === pending);
        if (s && !s.ready && s.last_at && new Date(s.last_at) > pendingSince.current) {
          const me = await api.get("/auth/me"); setUser(me.data);
          toast.success(tt("Vote counted, {{v0}} gold{{v1}} added. Thank you!", { v0: fmt(s.gold), v1: s.pearls ? ` and ${s.pearls} Pearl${s.pearls > 1 ? "s" : ""}` : "" }));
          setPending(null);
        } else if (Date.now() - pendingSince.current > 10 * 60000) {
          setPending(null);
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => clearInterval(t);
  }, [pending, setUser]);
  const start = async (s) => {
    if (!s.ready) { window.open(s.url, "_blank", "noopener"); return; }
    try {
      const r = await api.post(`/vote/${s.key}/start`);
      pendingSince.current = Date.now();
      setPending(s.key);
      const w = window.open(r.data.url, "_blank", "noopener");
      if (!w) toast.message(tt("Pop-up blocked, open the vote page manually"), { action: { label: "Open", onClick: () => window.open(r.data.url, "_blank") } });
    } catch (e) { toast.error(errMsg(e)); }
  };
  if (!d) return <Empty>{tt("Loading...")}</Empty>;
  return (
    <div className="space-y-3 fade-in" data-testid="vote-page">
      <Panel icon="vote" title={<span className="inline-flex items-center gap-2">{tt("Vote for Fishing Realms")}</span>} right={<span className="num">{tt("your votes ·")} {fmt(d.total)}</span>}>
        <p className="text-[12.5px] text-[var(--text-2)] m-clamp">{tt("Every vote on a game toplist brings new anglers to the docks. Click a site below, cast your vote there, and the harbour pays you the moment the toplist confirms it, usually within a few seconds. You can vote on each site again once its timer runs out.")}</p>
        {d.sites.length === 0 ? <Empty>{tt("No vote sites are listed yet.")}</Empty> : (
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            {d.sites.map((s) => <SiteCard key={s.key} s={s} onStart={start} pending={pending} />)}
          </div>
        )}
        {pending && <div className="text-[11.5px] text-[var(--muted)] mt-2 italic" data-testid="vote-pending-note">{tt("Waiting for the toplist to confirm your vote... keep this tab open; you can carry on fishing meanwhile.")}</div>}
      </Panel>
      <InfoTabs inline testId="vote-tabs" items={[
        { id: "recent", label: "Your votes", Icon: pixelIcon("vote"), node: (
        <Panel icon="vote" title={tt("Your recent votes")} bodyClass="!p-0" testId="vote-recent">
          {d.recent.length === 0 ? <Empty>{tt("No votes yet. Your first one pays out right away.")}</Empty> : (
            <table className="table"><tbody>
              {d.recent.map((r, i) => <tr key={i}><td>{r.site}</td><td className="text-xs text-[var(--muted)]">{ago(r.at)}</td><td className="r"><Gold n={r.gold} className="text-[12px]" /></td><td className="r">{r.pearls > 0 && <Pearls n={r.pearls} className="text-[12px]" />}</td></tr>)}
            </tbody></table>
          )}
        </Panel>) },
        { id: "top", label: "Top voters", Icon: pixelIcon("rankings"), node: (
        <Panel icon="rankings" title={<span className="inline-flex items-center gap-2">{tt("Top voters ·")} {d.month}</span>} right={<span className="text-[11px] text-[var(--muted)]">{tt("podium paid in")} {untilText(d.month_ends_at)}</span>} bodyClass="!p-0" testId="vote-top">
          <div className="px-3 py-2 text-[11.5px] text-[var(--text-2)] border-b border-[var(--border)] flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="vote-prizes">
            <span>{tt("Month-end prizes:")}</span>
            {d.prizes.map((p) => <span key={p.rank} className="inline-flex items-center gap-1"><span className={`num ${RANK_COLOUR[p.rank]}`}>{ORD[p.rank]}</span> <Gold n={p.gold} className="text-[11.5px]" /> + <Pearls n={p.pearls} className="text-[11.5px]" /></span>)}
          </div>
          {d.top_month.length === 0 ? <Empty>{tt("Nobody has voted this month yet, be the first.")}</Empty> : (
            <table className="table"><tbody>
              {d.top_month.map((t, i) => <tr key={t.username} className={t.username === user.username ? "bg-[#1f1714]" : ""} data-testid={`vote-top-row-${i + 1}`}><td className={`num w-8 ${RANK_COLOUR[i + 1] || "text-[var(--muted)]"}`}>{i + 1}</td><td>{t.username}</td><td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{i < 3 && <><Gold n={d.prizes[i].gold} className="text-[11px]" /> + <Pearls n={d.prizes[i].pearls} className="text-[11px]" /></>}</td><td className="num r text-[#ffcfa8] whitespace-nowrap">{t.votes} {tt("votes")}</td></tr>)}
            </tbody></table>
          )}
          {d.last_podium && d.last_podium.winners.length > 0 && (
            <div className="px-3 py-2 text-[11.5px] text-[var(--muted)] border-t border-[var(--border)]" data-testid="vote-last-podium">
              {d.last_podium.month} {tt("podium:")} {d.last_podium.winners.map((w, i) => <span key={w.rank}>{i > 0 && " · "}<span className={RANK_COLOUR[w.rank]}>{ORD[w.rank]}</span> <span className="text-[var(--text-2)]">{w.username}</span> ({w.votes})</span>)}
            </div>
          )}
        </Panel>) },
      ]} />
      {user.is_admin && <AdminRewards onChanged={load} />}
    </div>
  );
}
