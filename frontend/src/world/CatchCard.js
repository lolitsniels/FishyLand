import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, errMsg, fmt, wt, ln, lengthUnit } from "../tfl/lib/api";
import { standInArt } from "./useFight";
import { useGame as useTfl } from "../tfl/context/GameContext";
import { OFFLINE, rewardedSupported, showRewarded } from "../offline/bridge";

const STARS = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 5 };
const WATER_ART = { crew_pond: "millbrook", hallow: "blackwater" };

function Tape({ cm }) {
  const inch = lengthUnit() === "in";
  const end = inch ? `${Math.round(cm / 2.54)}"` : cm >= 100 ? `${(cm / 100).toFixed(1)}m` : Math.round(cm);
  return (
    <div className="relative w-[200px] h-[38px] tape-in" data-testid="catch-tape">
      <img src="/art/hud/tape.webp" alt="" className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-y-0 left-2 right-6 flex items-center justify-between font-black text-[13px] text-[#2a1a04]">
        {[1, 2, 3, 4, 5].map((n) => <span key={n}>{n}</span>)}<span>…</span><span className="px-1 bg-[#fff3b0]/80 rounded-sm border border-[#7a5a10]">{end}</span>
      </div>
    </div>
  );
}

function Stars({ rarity }) {
  const n = STARS[rarity] || 1;
  return (
    <div className="flex gap-0.5" data-testid="catch-stars" data-stars={n}>
      {[0, 1, 2, 3, 4].map((i) => (
        <img key={i} src={`/art/hud/star_${i < n ? "gold" : "grey"}.webp`} alt="" className={`w-7 h-7 star-pop ${rarity === "mythic" && i < n ? "drop-shadow-[0_0_6px_rgba(255,120,255,0.9)]" : ""}`} style={{ animationDelay: `${0.25 + i * 0.09}s` }} />
      ))}
    </div>
  );
}

export default function CatchCard({ res, onClose }) {
  const { setUser, user } = useTfl();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const c = res.catch || {};
  const sell = async () => {
    setBusy(true);
    try { const { data } = await api.post("/inventory/sell", { catch_ids: [c.id] }); if (data.user) setUser(data.user); (data.new_achievements || []).forEach((a) => toast.success(`Achievement unlocked: ${a.name}`)); toast.success(`Sold for ${fmt(data.gold)} gold`); onClose(); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  // opt-in rewarded ad: this catch sells for double gold, only if the ad was watched to the end
  const sellDouble = async () => {
    setBusy(true);
    const ok = await showRewarded("double_gold");
    if (!ok) { setBusy(false); toast("No bonus this time. The ad didn't finish."); return; }
    try { const { data } = await api.post("/inventory/sell", { catch_ids: [c.id], double: true }); if (data.user) setUser(data.user); (data.new_achievements || []).forEach((a) => toast.success(`Achievement unlocked: ${a.name}`)); toast.success(`Double gold! Sold for ${fmt(data.gold)} gold`); onClose(); }
    catch (e) { toast.error(errMsg(e)); setBusy(false); }
  };
  const dex = () => { onClose(); nav("/game/journal"); };
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/55" data-testid="catch-popup">
      <div className={`fr-panel fr-modal pop relative w-[480px] max-w-[94%] p-4 flex flex-col gap-3 rar-frame-${c.rarity}`}>
        <button type="button" onClick={onClose} className="absolute -top-3 -right-3 z-20 w-10 h-10 transition-transform hover:scale-110" data-testid="catch-close-btn">
          <img src="/art/hud/close.webp" alt="Close" className="w-full h-full" />
        </button>
        <div className="text-center font-deco text-xl sm:text-2xl gold-text leading-tight" data-testid="catch-name">
          {c.variant && c.variant !== "normal" ? `${c.variant} ` : ""}{c.name} <span className="uppercase">caught!</span>
        </div>
        {res.first_discovery && <div className="text-center -mt-2 text-[11px] font-cinzel tracking-widest text-cyan-200" data-testid="catch-new">NEW SPECIES FOR YOUR FISHDEX!</div>}
        <div className="relative h-44 rounded-xl overflow-hidden border-2 border-[#3a2412] shadow-inner" data-testid="catch-scene">
          <img src={`/art/waters/${WATER_ART[c.water] || c.water || user?.water || "millbrook"}.jpg`} alt="" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/art/hud/catch_bg.webp"; }} className="absolute inset-0 w-full h-full object-cover catch-water-bg" data-testid="catch-water-bg" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#04324a]/25 to-[#021a2a]/70" />
          <img src={res.img} alt={c.name} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `/${standInArt(c.rarity, c.species_id || 0)}`; }} className={`absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 ${c.rarity === "mythic" ? "w-[19rem] h-48 scale-110" : c.rarity === "legendary" ? "w-64 h-40" : "w-52 h-32"} object-contain drop-shadow-[0_8px_10px_rgba(0,20,50,0.6)] fish-swim`} />
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/45 text-[10px] uppercase tracking-widest font-cinzel rar-${c.rarity}`} data-testid="catch-rarity">{c.rarity}</div>
          {res.level_up && <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/50 gold-text font-deco text-sm" data-testid="catch-levelup">Level {res.level_up}!</div>}
        </div>
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="flex flex-col items-center gap-1">
            <Tape cm={c.length_cm || 0} />
            <div className="font-deco text-2xl text-[#ffe9a3] leading-none" data-testid="catch-length">{ln(c.length_cm || 0)}</div>
            <div className="text-xs text-amber-100/80 font-bold" data-testid="catch-weight">{wt(c.weight)}</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Stars rarity={c.rarity} />
            {res.duel ? (
              <>
                <div className="text-xs text-amber-100/80 font-bold whitespace-nowrap">Added to your duel score</div>
                <div className="font-deco text-2xl text-[#ffe9a3] leading-none whitespace-nowrap" data-testid="catch-duel-score">+{wt(c.weight)}</div>
                <div className="text-[11px] text-amber-200/80 font-bold whitespace-nowrap">The fish goes back in the water</div>
              </>
            ) : <>
            <div className="text-xs text-amber-100/80 font-bold whitespace-nowrap">You've gained</div>
            <div className="font-deco text-2xl text-[#ffe9a3] leading-none whitespace-nowrap" data-testid="catch-xp">{res.xp} exp</div>
            <div className="text-xs text-amber-200 font-bold whitespace-nowrap" data-testid="catch-value">worth {fmt(c.value)} g</div>
            </>}
          </div>
        </div>
        <div className="flex gap-2 w-full items-center">
          {res.duel ? (
            <button type="button" className="fr-btn flex-1 py-2" onClick={onClose} data-testid="catch-duel-back-btn">Back to the duel</button>
          ) : <>
          <button type="button" className="fr-btn fr-btn-dark flex-1 py-2" disabled={busy} onClick={onClose} data-testid="catch-keep-btn">Keep</button>
          <button type="button" onClick={dex} className="relative flex-[1.3] h-11 transition-transform hover:scale-105 active:scale-95" data-testid="catch-fishdex-btn">
            <img src="/art/hud/btn_green.webp" alt="" className="absolute inset-0 w-full h-full" />
            <span className="relative whitespace-nowrap font-black text-white text-[10px] sm:text-[12.5px] px-3 [text-shadow:0_2px_0_#0a4a0a]">VIEW IN FISHDEX</span>
          </button>
          <button type="button" className="fr-btn flex-1 py-2 whitespace-nowrap" disabled={busy} onClick={sell} data-testid="catch-sell-btn">Sell {fmt(c.vendor ?? Math.round((c.value || 0) * 0.7))} g</button>
          </>}
        </div>
        {OFFLINE && !res.duel && rewardedSupported() && (
          <button type="button" className="fr-btn w-full py-2 mt-2 whitespace-nowrap" disabled={busy} onClick={sellDouble} data-testid="catch-double-gold-btn">
            Watch an ad: sell for {fmt(2 * (c.vendor ?? Math.round((c.value || 0) * 0.7)))} g (double)
          </button>
        )}
      </div>
    </div>
  );
}
