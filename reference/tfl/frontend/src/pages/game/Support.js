/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Heart, Zap, Users, ShieldCheck, Lamp, Clover } from "lucide-react";
import { api, errMsg } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel, SupporterBadge } from "../../components/ui-bits";
import { PassPanel } from "../../components/PremiumShop";
import { CosmeticShop } from "../../components/CosmeticShop";
import { DeskTabs } from "../../components/MobileSheets";
import { pixelIcon } from "../../components/PixelIcon";
import { loadTebexJs } from "../../lib/tebex";
import { t as tt } from "../../i18n";

export const fmtLeft = (sec) => {
  if (sec <= 0) return "0m";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
};

export const fmtShort = (sec) => {
  if (sec <= 0) return "0m";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${Math.max(1, m)}m`;
};

export function useCountdown(endsAt) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  return left;
}

export const LANE_META = {
  xp: { Icon: Lamp, colour: "#ffcfa8", perks: (b) => `${tt("Double XP,")} ${b.sell_mult}${tt("× vendor prices &")} ${b.energy_mult || 1.5}${tt("× energy regen")}` },
  luck: { Icon: Clover, colour: "#9fe3b8", perks: (b) => `+${b.luck} ${tt("luck on every cast, about twice the legendary & mythic odds")}` },
};
export const boostIcon = (b) => `/art/boost/${b.kind || "xp"}${b.hours}.webp`;

function ActiveBoost({ boost, kind }) {
  const left = useCountdown(boost?.ends_at);
  const meta = LANE_META[kind];
  if (!boost) return <div className="px-3 py-2 text-[12px] text-[var(--muted)] italic" data-testid={`active-boost-${kind}-none`}>{tt("Not lit right now, the next one bought starts instantly.")}</div>;
  const total = boost.hours * 3600, pct = Math.max(0, Math.min(100, (left / total) * 100));
  return (
    <div data-testid={`active-boost-${kind}`}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <img src={boostIcon(boost)} alt="" draggable="false" className="w-10 h-10 shrink-0 object-contain boost-live [image-rendering:pixelated]" />
        <div className="min-w-0 flex-1 text-[12px]">
          <div style={{ color: meta.colour }} className="truncate">{meta.perks(boost)}</div>
          <div className="text-[11px] text-[var(--text-2)]">{tt("Courtesy of")} <span className="text-[var(--gold)]" data-testid={`active-boost-buyer-${kind}`}>{boost.buyer}</span> · {boost.hours}{tt("h booster")}</div>
        </div>
        <div className="text-right shrink-0"><div className="label !text-[9.5px]">{tt("Ends in")}</div><div className="num text-[15px] text-[#f4ead2]" data-testid={`active-boost-left-${kind}`}>{fmtLeft(left)}</div></div>
      </div>
      <div className="h-1 bg-[rgba(255,255,255,0.06)] overflow-hidden"><div className="h-full bg-[var(--gold)] transition-[width] duration-1000" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Queue({ queue, name }) {
  if (!queue.length) return null;
  return (
    <div className="px-3 py-1.5 text-[11.5px] text-[var(--text-2)] flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-[var(--border)]" data-testid="boost-queue">
      <span className="label !text-[9.5px] flex items-center gap-1"><Users size={10} /> {tt("Up next")}</span>
      {queue.map((q, i) => <span key={q.id} className="whitespace-nowrap"><span className="num text-[var(--muted)]">{i + 1}.</span> <span className="text-[var(--gold)]">{q.buyer}</span> {q.hours}h {name} <span className="text-[var(--muted)]">· {new Date(q.starts_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span></span>)}
    </div>
  );
}

const BADGE = { xp12: ["Most popular", "bg-[#ffcfa8] text-[#1a110c]"], xp24: ["Best value", "bg-[#9fe3b8] text-[#0b2415]"] };

function Options({ options, canBuy, onBuy, anonymous }) {
  const [busy, setBusy] = useState(null);
  const buy = async (id) => {
    if (busy) return;
    setBusy(id);
    try { await onBuy(id, anonymous); } finally { setBusy(null); }
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 pt-4">
      {options.map((o) => (
        <button key={o.id} type="button" disabled={!canBuy || !!busy} onClick={() => buy(o.id)} data-testid={`booster-${o.id}`}
          className={`group relative text-left border rounded-[3px] p-2 hover:bg-[rgba(240,194,122,0.06)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center ${BADGE[o.id] ? "border-[var(--gold-dim)] bg-[rgba(240,194,122,0.05)]" : "border-[var(--border)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--gold-dim)]"}`}>
          {BADGE[o.id] && <span className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-px text-[9px] font-bold uppercase tracking-[.14em] rounded-[2px] shadow whitespace-nowrap ${BADGE[o.id][1]}`} data-testid={`booster-badge-${o.id}`}>{tt(BADGE[o.id][0])}</span>}
          <img src={`/art/boost/${o.id}.webp`} alt="" draggable="false" loading="lazy" className="w-12 h-12 object-contain [image-rendering:pixelated] transition-transform duration-500 group-hover:scale-110 drop-shadow-[0_4px_10px_rgba(0,0,0,.5)]" />
          <div className="mt-1 flex items-baseline gap-1.5"><span className="font-serif text-[15px] text-[#f4ead2]">{o.hours}h</span><span className="num text-[var(--gold)] text-[13.5px]">${o.price.toFixed(0)}</span></div>
          <div className="text-[10px] text-[var(--muted)] num">${(o.price / o.hours).toFixed(2)}/h</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--gold-dim)] group-hover:text-[var(--gold)]">{busy === o.id ? tt("Opening…") : tt("Buy →")}</div>
        </button>
      ))}
    </div>
  );
}

function Lane({ kind, state, onBuy, anonymous }) {
  const meta = LANE_META[kind], lane = state.lanes[kind], name = state.kinds[kind].name;
  const opts = state.options.filter((o) => o.kind === kind);
  return (
    <Panel title={<span className="flex items-center gap-2"><meta.Icon size={14} style={{ color: meta.colour }} /> {name} <span className="font-sans normal-case tracking-normal text-[11.5px] text-[var(--muted)] hidden sm:inline">· {kind === "xp" ? tt("2× XP · 1.5× vendor gold · 1.5× energy regen, for everyone online") : tt("+{{v0}} luck on every cast, for everyone", { v0: state.luck })}</span></span>} bodyClass="!p-0" testId={`lane-${kind}`}>
      <div className="border-b border-[var(--border)]"><div className="label !text-[9.5px] px-3 pt-1.5 flex items-center gap-1"><Zap size={10} /> {tt("Live now")}</div><ActiveBoost boost={lane.active} kind={kind} /></div>
      <Options options={opts} canBuy={state.can_buy} onBuy={onBuy} anonymous={anonymous} />
      <Queue queue={lane.queue} name={name} />
    </Panel>
  );
}

export { loadTebexJs };

export default function Support() {
  const { user } = useGame();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState(null);
  const [anonymous, setAnonymous] = useState(false);
  const load = () => api.get("/support/state").then((r) => setState(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []); // eslint-disable-line
  useEffect(() => {
    if (params.get("paid")) { verify(); toast.success(tt("Thank you! Your booster joins the queue the moment the payment is confirmed (usually within a minute).")); params.delete("paid"); setParams(params, { replace: true }); }
  }, []); // eslint-disable-line

  const verify = () => api.post("/support/verify").then((r) => { if (r.data.fulfilled) { toast.success(tt("Payment confirmed, your booster is queued!")); } load(); }).catch(() => {});

  const onBuy = async (option, anon) => {
    try {
      const r = await api.post("/support/checkout", { option, anonymous: anon });
      if (r.data.provider === "tebex" && r.data.ident && (await loadTebexJs())) {
        window.Tebex.checkout.init({ ident: r.data.ident, theme: "dark", colors: [{ name: "primary", color: "#d9682e" }, { name: "secondary", color: "#1d160a" }] });
        window.Tebex.checkout.on("payment:complete", () => { toast.success(tt("Payment received. Confirming with the harbour…")); setTimeout(verify, 1500); setTimeout(verify, 6000); });
        window.Tebex.checkout.on("payment:error", () => toast.error(tt("The payment was declined, nothing was charged. You can try again.")));
        window.Tebex.checkout.on("close", () => load());
        window.Tebex.checkout.launch();
        return;
      }
      window.__leaving = true; // polls aborted by the navigation must not raise the "server reload" banner
      window.location.assign(r.data.url);
    }
    catch (e) { toast.error(errMsg(e)); }
  };

  const recent = state?.recent || [];
  return (
    <div className="space-y-2.5" data-testid="support-page">
      <div className="relative overflow-hidden rounded-[3px] border border-[var(--border)] bg-[#0c0b0a] min-h-[64px]" data-testid="support-hero">
        <img src="/art/boost/hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_35%] opacity-70" draggable="false" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(10,9,8,0.92)] via-[rgba(10,9,8,0.7)] to-[rgba(10,9,8,0.35)]" />
        <div className="relative px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="font-serif text-[18px] sm:text-[22px] text-[#f4ead2] leading-tight flex items-center gap-2 drop-shadow"><Heart size={18} className="text-[#e8647a]" fill="currentColor" /> {tt("Donate to The Fishing Lands")}</h1>
          <p className="text-[11.5px] text-[#d9cfb8] flex-1 min-w-[220px] drop-shadow">{tt("No pay-to-win. Treat yourself to an Angler Pass, light the Harbour Lantern for everyone online, or grab a ridiculous cosmetic. Supporters get a permanent")} <SupporterBadge size={11} className="mx-0.5" /> {tt("beside their name.")}</p>
        </div>
      </div>

      <DeskTabs pinned inline testId="support-tabs" initial={["pass", "lantern", "cosmetics"].includes(params.get("tab")) ? params.get("tab") : "pass"} items={[
        { id: "pass", label: "Angler Pass", Icon: pixelIcon("almanac"), node: <PassPanel /> },
        { id: "lantern", label: "Harbour Lantern", Icon: pixelIcon("lantern"), node: (
          <div className="space-y-2.5">
            {!state ? <Panel icon="lantern" title={tt("Harbour Lantern")}><div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div></Panel> : <Lane kind="xp" state={state} onBuy={onBuy} anonymous={anonymous} />}
            {state?.lanes.luck?.active && <Lane kind="luck" state={state} onBuy={onBuy} anonymous={anonymous} />}
          </div>) },
        { id: "cosmetics", label: "Cosmetics", Icon: pixelIcon("pearl"), node: <CosmeticShop /> },
      ]} />

      {state && (
        <div className="panel px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]" data-testid="support-options">
          <label className="flex items-center gap-1.5 text-[var(--text-2)] cursor-pointer select-none">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} data-testid="booster-anonymous" />
            {tt("Announce me as \"An anonymous angler\"")}
          </label>
          <span className="text-[var(--muted)] flex items-center gap-1.5" data-testid="checkout-provider-note"><ShieldCheck size={11} /> {state.provider === "paypal" ? tt("Secure checkout by PayPal.") : tt("Secure checkout by Tebex (cards, PayPal and more).")} {tt("USD.")}</span>
          <span className="text-[var(--muted)]" title={tt("Boosters run one at a time; a second one queues and starts when the first ends, no hours lost. Only XP from landed fish and vendor prices are boosted.")}>{tt("Boosters queue, never overlap · only fish XP & vendor prices are boosted")}</span>
          {!state.can_buy && <span className="text-[#f0a5a3]" data-testid="booster-guest-note">{tt("Claim your guest account first so purchases can be credited to you.")}</span>}
          {recent.length > 0 && <span className="block w-full truncate" data-testid="support-recent"><span className="label !text-[9.5px] mr-1.5">{tt("Recent supporters")}</span>{recent.slice(0, 6).map((r, i) => <span key={r.id}><span className="text-[var(--gold)]">{r.buyer}</span>{i < Math.min(recent.length, 6) - 1 ? ", " : ""}</span>)}</span>}
          {user.is_admin && state.provider_trial && <span className="text-[var(--gold)]" data-testid="provider-trial-note">{tt("Admin: trialling {{v0}} checkout, players still see {{v1}}.", { v0: state.provider === "tebex" ? "Tebex" : "PayPal", v1: state.provider === "tebex" ? "PayPal" : "Tebex" })}</span>}
          {user.is_admin && !state.webhook_ready && <span className="text-[#f0a5a3]" data-testid="webhook-warning">{tt("Admin:")} {state.provider === "paypal" ? tt("PAYPAL_EMAIL is not set, paid boosters won't be credited.") : tt("TEBEX_WEBHOOK_SECRET is not set, paid boosters won't be credited.")}</span>}
        </div>
      )}
    </div>
  );
}
