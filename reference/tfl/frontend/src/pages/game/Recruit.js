/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { Copy, Check, UserPlus, ShieldAlert, Share2, Image as ImageIcon, IdCard, Lightbulb } from "lucide-react";
import { api, errMsg, fmt, ago } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, Gold, Pearls, Empty } from "../../components/ui-bits";
import { InfoTabs } from "../../components/MobileSheets";
import { pixelIcon } from "../../components/PixelIcon";
import { Avatar } from "../../components/Avatar";
import { t as tt } from "../../i18n";
import { CRATE_COL } from "../../components/Crates";
import { recruitLink, useCopy } from "../../components/recruit/shared";
import RecruitShare from "../../components/recruit/RecruitShare";
import RecruitBanners from "../../components/recruit/RecruitBanners";
import RecruitSigs from "../../components/recruit/RecruitSigs";
import RecruitTips from "../../components/recruit/RecruitTips";


function CodeBox({ code }) {
  const [copied, copy] = useCopy();
  const link = recruitLink(code);
  return (
    <div className="space-y-2" data-testid="recruit-code-box">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label">{tt("Your code")}</span>
        <span className="num font-display text-[20px] tracking-[.18em] text-[#f4ead2] bg-[#0b0a09] border border-[var(--gold-dim)] px-3 py-1" data-testid="recruit-code">{code}</span>
        <button className="btn btn-sm inline-flex items-center gap-1" onClick={() => copy("code", code, tt("Code"))} data-testid="recruit-copy-code">{copied === "code" ? <Check size={12} /> : <Copy size={12} />} {tt("Copy")}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label">{tt("Recruit link")}</span>
        <input readOnly className="input !w-auto flex-1 min-w-[220px] num text-[12px]" value={link} onFocus={(e) => e.target.select()} data-testid="recruit-link" />
        <button className="btn btn-sm btn-gold inline-flex items-center gap-1" onClick={() => copy("link", link, tt("Recruit link"))} data-testid="recruit-copy-link">{copied === "link" ? <Check size={12} /> : <Copy size={12} />} {tt("Copy link")}</button>
      </div>
      <div className="text-[11.5px] text-[var(--muted)]">{tt("Friends who open the link (or type the code when registering or playing as guest) are tied to you. Guests count once they claim a full account.")}</div>
    </div>
  );
}

function LevelRewards({ lr, mentor }) {
  return (
    <div className="panel p-3 text-[12.5px] space-y-2" data-testid="recruit-level-rewards">
      <div className="font-display text-[15px] text-[#f4ead2]">{tt("Every 10 levels, forever")}</div>
      <div className="text-[var(--text-2)]">{tt("Each time a recruit gains another 10 levels you get a crate and Pearls, and they get")} <Pearls n={lr.recruit_pearls} className="text-[12px]" /> {tt("too. It never stops: Lv 50, 60, 70 keep paying.")}</div>
      <div className="flex flex-wrap gap-2">
        {lr.milestones.map((m) => (
          <div key={m.level} className="border border-[var(--border-2)] bg-[#0f0d0c] px-2.5 py-1.5 flex items-center gap-2" data-testid={`recruit-level-${m.level}`}>
            <span className="num text-[#f4ead2]">{tt("Lv")} {m.level}{m.level === 40 ? "+" : ""}</span>
            <img src={`/art/gear/${m.crate}.webp`} alt="" className="w-6 h-6 object-contain pixelated" />
            <span style={{ color: CRATE_COL[m.crate] }}>{{ crate_bronze: "Bronze", crate_silver: "Silver", crate_gold: "Gold" }[m.crate]}</span>
            <Pearls n={m.pearls} className="text-[12px]" />
            {m.level === lr.title_level && <span className="text-[#f59a5c] text-[12px]" data-testid="recruit-title-reward">+ {tt("title")} "{mentor}"</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [["overview", "Overview", UserPlus], ["share", "Share", Share2], ["banners", "Banners", ImageIcon], ["sigs", "Signatures & Userbars", IdCard], ["tips", "Tips", Lightbulb]];

function ApplyCode({ data, reload }) {
  const { setUser } = useGame();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  if (data.referred_by) return <div className="text-[12.5px] text-[var(--text-2)]" data-testid="recruit-referred-by">{tt("You were recruited by")} <Link to={`/game/profile/${data.referred_by}`} className="underline text-[var(--gold)]">{data.referred_by}</Link>{tt(". Every 10 levels you gain pays you both.")}</div>;
  if (!data.can_apply) return null;
  const go = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post("/referrals/apply", { code: code.trim().toUpperCase() }); setUser(r.data.user); toast.success(tt("Linked to {{v0}}", { v0: r.data.recruiter })); reload(); }
    catch (ex) { toast.error(errMsg(ex)); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={go} className="flex flex-wrap items-center gap-2 text-[12.5px]" data-testid="recruit-apply-form">
      <span className="text-[var(--text-2)]">{tt("Got a friend's code? New anglers can still enter one:")}</span>
      <input className="input !w-40 uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder={tt("CODE")} maxLength={16} data-testid="recruit-apply-input" />
      <button className="btn btn-sm" disabled={busy || code.trim().length < 4} data-testid="recruit-apply-button">{tt("Apply")}</button>
    </form>
  );
}

export default function Recruit() {
  const { user } = useGame();
  const [data, setData] = useState(null);
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([id]) => id === params.get("tab")) ? params.get("tab") : "overview";
  const load = () => api.get("/referrals").then((r) => setData(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!data) return <div className="text-[var(--muted)] text-sm italic py-6 text-center">{tt("Checking the recruitment ledger...")}</div>;
  const link = data.code ? recruitLink(data.code) : null;
  const tabs = (
    <div className="flex flex-wrap gap-1 border-b border-[var(--border)]" data-testid="recruit-tabs">
      {TABS.map(([id, label, Icon]) => <button key={id} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setParams({ tab: id }, { replace: true })} data-testid={`recruit-tab-${id}`}><Icon size={13} />{tt(label)}</button>)}
    </div>
  );
  if (tab !== "overview") return (
    <div className="space-y-3" data-testid="recruit-page">
      <Panel icon="recruit" title={tt("Recruit an Angler")} testId="recruit-header">
        <div className="space-y-4">{tabs}
          {!link ? <div className="text-[var(--muted)] text-[12.5px]" data-testid="recruit-guest-note">{tt("Claim your account (banner above) to receive your own recruit code.")}</div>
            : tab === "share" ? <RecruitShare link={link} user={user} /> : tab === "banners" ? <RecruitBanners link={link} /> : tab === "sigs" ? <RecruitSigs link={link} user={user} /> : <RecruitTips />}
        </div>
      </Panel>
    </div>
  );
  return (
    <div className="space-y-3" data-testid="recruit-page">
      <Panel icon="recruit" title={tt("Recruit an Angler")} right={<span className="font-sans normal-case tracking-normal text-[12px] text-[var(--text-2)]">{tt("Earned so far:")} <Gold n={data.totals.gold} /> · <Pearls n={data.totals.pearls} /></span>} testId="recruit-header">
        <div className="space-y-3 text-[12.5px]">{tabs}
          <div className="flex items-start gap-2"><UserPlus size={16} className="text-[var(--gold)] mt-0.5 shrink-0" /><p className="text-[var(--text-2)]">{tt("Bring a friend to the water. Every 10 levels your recruit gains, forever, you get a crate and Pearls, and they get a little Pearl bonus too. Rewards are paid automatically the moment they level up.")}</p></div>
          <div className="flex items-start gap-2 border border-[#7a1f1a] bg-[#2a0f0d] px-3 py-2 text-[#ff6b5e]" data-testid="recruit-cheat-warning"><ShieldAlert size={15} className="mt-0.5 shrink-0" /><p><b>No cheating.</b> Recruiting your own alt accounts, using VPNs or proxies to fake new players, or any other referral abuse gets every account involved <b>IP banned</b>. Recruits on the same network as you never pay out.</p></div>
          {user.is_guest ? <div className="text-[var(--muted)]" data-testid="recruit-guest-note">{tt("Claim your account (banner above) to receive your own recruit code.")}</div> : <CodeBox code={data.code} />}
          <ApplyCode data={data} reload={load} />
        </div>
      </Panel>

      <InfoTabs inline testId="recruit-info-tabs" items={[
        { id: "rewards", label: "Level rewards", Icon: pixelIcon("chest"), node: <LevelRewards lr={data.level_rewards} mentor={data.mentor_title} /> },
        { id: "recruits", label: "Your recruits", Icon: pixelIcon("angler"), badge: data.recruits.length || null, node: (
      <Panel icon="angler" title={`Your recruits · ${data.recruits.length}`} testId="recruit-list">
        {data.recruits.length === 0 ? <Empty>{tt("No recruits yet. Share your link, the dock always has room for one more.")}</Empty> : (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>{tt("Angler")}</th><th className="r">{tt("Level")}</th><th className="r">{tt("Fish")}</th><th>{tt("Next reward")}</th><th>{tt("Joined")}</th></tr></thead>
            <tbody>{data.recruits.map((r) => (
              <tr key={r.username} data-testid={`recruit-row-${r.username}`}>
                <td><Link to={`/game/profile/${r.username}`} className="inline-flex items-center gap-2 hover:text-[var(--gold)]"><Avatar id={r.avatar} size="xs" />{r.username}</Link>{r.is_guest && <span className="label !text-[9.5px] ml-1">{tt("guest")}</span>}{r.flagged && <span className="inline-flex items-center gap-1 text-[10.5px] text-[#f0a5a3] ml-1" title={tt("Shares a network with you, no rewards paid for this recruit")}><ShieldAlert size={11} />{tt("flagged")}</span>}</td>
                <td className="num r">{r.level}</td><td className="num r">{fmt(r.fish)}</td>
                <td className="text-[12px]"><span className="num">{tt("at Lv")} {r.next_milestone}</span>{r.is_guest && <span className="text-[var(--muted)]"> {tt("(must claim account)")}</span>}</td>
                <td className="text-[var(--muted)] text-[12px] whitespace-nowrap">{ago(r.joined)}</td>
              </tr>))}</tbody></table></div>
        )}
      </Panel>) },

      data.log.length > 0 && { id: "ledger", label: "Payout ledger", Icon: pixelIcon("coin"), node: (
        <Panel icon="chest" title={tt("Payout ledger")} testId="recruit-log">
          <ul className="text-[12px] space-y-1">{data.log.map((l, i) => <li key={i} className="flex justify-between gap-2"><span><b>{l.recruit}</b> {tt("reached")} {l.name}{tt(", you earned")} {l.reward}</span><span className="text-[var(--muted)] whitespace-nowrap">{ago(l.at)}</span></li>)}</ul>
        </Panel>) },
      ]} />

      <div className="text-[11.5px] text-[var(--muted)]">{tt("Fair play: recruits on the same network as you are linked but never pay out, and codes can only be entered within 48 hours of creating an account. Fights are verified server-side, so milestones can't be scripted.")}</div>
    </div>
  );
}
