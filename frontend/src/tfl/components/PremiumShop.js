import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, FlaskConical, Ticket, RefreshCw } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { loadTebexJs } from "../lib/tebex";
import { t as tt } from "../i18n";
import { NO_IAP } from "../lib/portal";
import { LinkChatBtn } from "./ChatItem";

const fmtUntil = (iso) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function usePassState() {
  const [st, setSt] = useState(null);
  const load = () => api.get("/premium").then((r) => setSt(r.data)).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line
  return [st, setSt, load];
}

// Donate page: buy a pass for real money (Tebex). The pass lands in the inventory as an item.
export function PassPanel() {
  const { user, setUser } = useGame();
  const [st, setSt] = usePassState();
  const [busy, setBusy] = useState(false);
  const [renew, setRenew] = useState(false);
  const [gift, setGift] = useState("");
  const [params, setParams] = useSearchParams();
  const verify = () => api.post("/premium/verify").then((r) => { if (r.data.fulfilled) { toast.success(tt("Payment received, thank you! Check your Messages for the details.")); setSt(r.data); setUser(r.data.user); } }).catch(() => {});
  const cancelRenew = async () => {
    if (!window.confirm(tt("Turn off auto-renew? Your pass keeps running until it ends."))) return;
    setBusy(true);
    try { const r = await api.post("/premium/cancel-renew"); toast.success(r.data.message); setSt(r.data); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const sub = st?.subscription;
  const subActive = sub?.status === "active";
  useEffect(() => { if (params.get("paid")) { setTimeout(verify, 1500); params.delete("paid"); setParams(params, { replace: true }); } }, []); // eslint-disable-line
  const buy = async (p) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.post("/premium/checkout", { item: p.id, auto_renew: renew && !subActive && !gift.trim(), gift_to: gift.trim() });
      if (r.data.ident && (await loadTebexJs())) {
        window.Tebex.checkout.init({ ident: r.data.ident, theme: "dark", colors: [{ name: "primary", color: "#d9682e" }, { name: "secondary", color: "#1d160a" }] });
        window.Tebex.checkout.on("payment:complete", () => { toast.success(tt("Payment received, the harbour is stamping your pass…")); setTimeout(verify, 1500); setTimeout(verify, 6000); });
        window.Tebex.checkout.on("payment:error", () => toast.error(tt("The payment was declined. nothing was charged.")));
        window.Tebex.checkout.on("close", () => setTimeout(verify, 800));
        window.Tebex.checkout.launch();
      } else if (r.data.url) { window.__leaving = true; window.location.assign(r.data.url); }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Panel icon="achievements" title={<span className="flex items-center gap-2">{tt("Angler Pass")} <span className="font-sans normal-case tracking-normal text-[11.5px] text-[var(--muted)] hidden sm:inline">· {tt("comfort for one angler: yours, or a friend's")}</span></span>} testId="pass-panel" bodyClass="!p-2.5">
      {!st ? <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div> : (
        <div className="text-[12px] space-y-2">
          <div className="flex items-start gap-2.5">
            <GearIcon id="pass_month" name={tt("Angler Pass")} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-2)] text-[11.5px] leading-snug">{tt("A one-time pass lands in your Inventory as an item: activate it when you like, keep it, or sell it on the Market. A renewing pass activates right away and extends itself each period. Comfort and content only: no extra luck, no better gear.")}</p>
              <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px]">{st.perks.map((p) => <li key={p} className="flex items-start gap-1"><Check size={11} className="text-[#f08a45] shrink-0 mt-[3px]" /><span className="leading-snug">{tt(p)}</span></li>)}</ul>
            </div>
          </div>
          {st.active && <div className="text-[11px] text-[#f08a45]" data-testid="pass-active">{tt("Your pass is active until")} {fmtUntil(st.until)}. {tt("Activating another one adds 30 days on top.")}</div>}
          {sub && (
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] border border-[var(--border)] rounded-[3px] px-2 py-1.5" data-testid="pass-subscription">
              <RefreshCw size={12} className={subActive ? "text-[var(--ok)]" : "text-[var(--muted)]"} />
              <span className="flex-1 min-w-[160px]">{tt(sub.name)}: {subActive ? <span className="text-[var(--ok)]">{tt("renews automatically")}</span> : <span className="text-[var(--muted)]">{tt("auto-renew off, runs until it ends")}</span>}
                {subActive && <span className="block text-[10.5px] text-[var(--muted)]" data-testid="pass-loyal-progress">{sub.days_paid >= sub.loyal_days ? tt("Loyal Tidekeeper frame earned") : `${tt("Loyal Tidekeeper frame")}: ${Math.round(sub.days_paid)} / ${sub.loyal_days} ${tt("days in a row")}`}</span>}</span>
              {subActive && <button className="btn btn-sm" disabled={busy} onClick={cancelRenew} data-testid="pass-cancel-renew">{tt("Turn off auto-renew")}</button>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {!subActive && (
              <label className={`flex items-center gap-2 text-[11.5px] select-none ${gift.trim() ? "opacity-50" : "cursor-pointer"}`} data-testid="pass-auto-renew-label">
                <input type="checkbox" checked={renew && !gift.trim()} disabled={!!gift.trim()} onChange={(e) => setRenew(e.target.checked)} data-testid="pass-auto-renew" />
                <span>{tt("Renew automatically")} <span className="text-[var(--muted)]">{tt("(cancel any time here, 3 months in a row earns a frame)")}</span></span>
              </label>
            )}
            <label className="flex items-center gap-2 text-[11.5px]">
              <span className="text-[var(--text-2)]">{tt("Gift to")}</span>
              <input className="input !h-7 !w-36 !text-[12px]" placeholder={tt("friend's name")} value={gift} maxLength={24} onChange={(e) => setGift(e.target.value)} data-testid="pass-gift-input" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {st.passes.map((p) => (
              <div key={p.id} className={`relative border rounded-[3px] p-2 ${p.id === "pass_month" ? "border-[#f08a45] bg-[rgba(224,176,78,.06)]" : "border-[var(--border)] bg-[rgba(255,255,255,0.02)]"}`} data-testid={`pass-offer-${p.id}`}>
                {p.id === "pass_month" && <span className="absolute -top-2 left-2 px-1.5 py-px text-[9px] font-bold uppercase tracking-[.14em] bg-[#f08a45] text-[#1a110c] rounded-[2px] shadow" data-testid="pass-badge-cheapest">{tt("Cheapest")}</span>}
                <div className="flex items-baseline justify-between gap-1"><span className="font-display text-[13.5px] text-[#f4ead2] truncate">{p.days >= 30 ? tt("Month") : tt("Week")}</span><span className="num text-[var(--gold)] text-[14px]">${p.usd.toFixed(2)}</span></div>
                <div className="text-[10.5px] text-[var(--muted)]">{p.days} {tt("days")} · <span className={p.id === "pass_month" ? "text-[#f08a45]" : ""}>${(p.usd / p.days).toFixed(2)}/{tt("day")}</span></div>
                <button className="btn btn-sm btn-gold mt-1.5 w-full" disabled={busy || !st.can_buy} onClick={() => buy(p)} data-testid={`pass-buy-${p.id}`}>{busy ? tt("Opening…") : gift.trim() ? <><Ticket size={12} /> {tt("Gift pass")}</> : renew && !subActive ? <><RefreshCw size={12} /> {tt("Subscribe")}</> : <><Ticket size={12} /> {tt("Buy pass")}</>}</button>
                {p.owned > 0 && <div className="text-[10.5px] text-[var(--text-2)] mt-1" data-testid={`pass-owned-${p.id}`}>{tt("You hold")} <b className="num">{p.owned}</b>, <Link to="/game/inventory?tab=other" className="underline">{tt("Inventory")}</Link></div>}
              </div>
            ))}
          </div>
          {!st.can_buy && <p className="text-[11px] text-[#f0a5a3]" data-testid="pass-guest-note">{tt("Claim your guest account first so the pass can be credited to you.")}</p>}
        </div>
      )}
    </Panel>
  );
}

// Inventory: activate a held pass, sell it; the weekly potion is delivered automatically.
export function PassBox({ onSell }) {
  const { user, setUser } = useGame();
  const [st, setSt] = usePassState();
  const [busy, setBusy] = useState(false);
  const activate = async (p) => {
    if (busy) return;
    setBusy(true);
    try { const r = await api.post("/premium/activate", { item: p.id }); toast.success(r.data.message); setSt(r.data); setUser(r.data.user); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const held = (st?.passes || []).filter((p) => p.owned > 0);
  return (
    <Panel icon="achievements" title={<span className="inline-flex items-center gap-1.5">{tt("Angler Pass")}</span>}
      right={st?.active ? <span className="font-sans normal-case tracking-normal text-[11.5px] text-[#f08a45]" data-testid="pass-box-active">{tt("active until")} {fmtUntil(st.until)}</span> : NO_IAP ? null : <Link to="/game/support" className="text-[11.5px] underline">{tt("Get a pass")}</Link>} testId="pass-box">
      {!st ? <div className="text-[12px] text-[var(--muted)]">{tt("Loading…")}</div> : (
        <div className="space-y-2 text-[12.5px]">
          {held.length === 0 ? <div className="text-[var(--muted)] italic text-[12px]" data-testid="pass-box-empty">{st.active ? tt("No spare passes. Your current one keeps running until it expires.") : (NO_IAP ? tt("No pass held. Passes can be bought from other anglers on the Market; activating one gives 150 max energy, no market fee, the Angler's Almanac and two contract swaps a day for 30 days.") : tt("No pass held. Passes are bought on the Donate page or from other anglers on the Market; activating one gives 150 max energy, no market fee, the Angler's Almanac and two contract swaps a day for 30 days."))}</div>
            : held.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2" data-testid={`pass-row-${p.id}`}>
                <GearIcon id={p.id} name={tt(p.name)} />
                <span className="flex-1 min-w-[140px]"><span className="rar-epic">{tt(p.name)}</span> <span className="num text-[var(--muted)]">×{p.owned}</span><div className="text-[11px] text-[var(--muted)]">{p.days} {tt("days")}{st.active && <> · {tt("adds to your current pass")}</>}</div></span>
                <button className="btn btn-sm btn-gold" disabled={busy} onClick={() => activate(p)} data-testid={`pass-activate-${p.id}`}>{st.active ? tt("Extend") : tt("Activate")}</button>
                {!user.is_guest && <button className="btn btn-sm" onClick={() => onSell(p)} data-testid={`pass-sell-${p.id}`}>{tt("Sell on Market")}</button>} <LinkChatBtn item={{ kind: "item", ref: p.id }} label={tt(p.name)} testId={`link-chat-${p.id}`} />
              </div>
            ))}
          {st.active && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2 text-[11.5px] text-[var(--text-2)]" data-testid="premium-potion">
              <FlaskConical size={14} className="text-[var(--energy)]" />
              <span className="flex-1 min-w-[180px]">{tt("Weekly Energy Potion")}: {st.potion.next_at ? <>{tt("the Harbourmaster delivers the next one")} {fmtUntil(st.potion.next_at)}</> : tt("delivered by the Harbourmaster the next time you come ashore")}</span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
