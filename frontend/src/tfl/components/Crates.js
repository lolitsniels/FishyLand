import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, fmt } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Panel } from "./ui-bits";
import { GearIcon } from "./GearIcon";
import { sfx } from "../lib/sound";
import { X } from "lucide-react";
import { LinkChatBtn } from "./ChatItem";

const TW = 112, SPIN_MS = 6800;
export const CRATE_COL = { crate_bronze: "#e0995a", crate_silver: "#bfe6ff", crate_gold: "#f2c744" };
const pct = (c) => (c >= 1 ? `${c.toFixed(c % 1 ? 1 : 0)}%` : `${+c.toPrecision(2)}%`);

export function useCrates(dep) {
  const [d, setD] = useState(null);
  const load = () => api.get("/crates").then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); }, [dep]); // eslint-disable-line
  return [d, load];
}

const Modal = ({ children, onClose, testId, wide }) => (
  <div className="fixed inset-0 z-50 flex overflow-y-auto bg-[rgba(0,0,0,.72)] p-3" onClick={onClose}>
    <div className={`panel panel-gold m-auto w-full ${wide ? "max-w-3xl" : "max-w-xl"} p-4 relative`} onClick={(e) => e.stopPropagation()} role="dialog" data-testid={testId}>
      <button type="button" className="absolute right-2 top-2 text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose} aria-label="Close" data-testid={`${testId}-close`}><X size={16} /></button>
      {children}
    </div>
  </div>
);

const PriceLine = ({ c }) => (
  <div className="grid grid-cols-3 gap-2 text-center text-[11px]" data-testid={`crate-prices-${c.id}`}>
    <div className="crate-stat"><div className="label !text-[9.5px]">Expected value</div><div className="num text-[#ffcf8a]">{fmt(c.expected_value)}g</div></div>
    <div className="crate-stat"><div className="label !text-[9.5px]">Cheapest listed</div><div className="num">{c.market?.cheapest ? `${fmt(c.market.cheapest)}g` : "none"}</div></div>
    <div className="crate-stat"><div className="label !text-[9.5px]">Avg sale</div><div className="num">{c.market?.avg ? `${fmt(c.market.avg)}g` : "no sales yet"}</div></div>
  </div>
);

export function CrateOdds({ crate: c, howTo, onClose, onOpen }) {
  return (
    <Modal onClose={onClose} testId="crate-odds">
      <div className="flex items-center gap-3 mb-3">
        <img src={`/art/gear/${c.id}.webp`} alt="" className={`w-20 h-20 object-contain crate-glow-${c.rarity}`} style={{ imageRendering: "pixelated" }} />
        <div className="min-w-0">
          <div className="font-display text-[17px]" style={{ color: CRATE_COL[c.id] }}>{c.name}</div>
          <div className="text-[12px] text-[var(--text-2)]">{c.desc}</div>
        </div>
      </div>
      <PriceLine c={c} />
      <table className="table mt-3 text-[12px]" data-testid="crate-contents"><thead><tr><th>Prize</th><th className="r">Chance</th><th className="r">Value</th></tr></thead><tbody>
        {[...c.contents].sort((a, b) => b.chance - a.chance).map((p, i) => (
          <tr key={i} data-testid={`crate-prize-${c.id}-${i}`}>
            <td><span className="inline-flex items-center gap-2"><GearIcon id={p.icon} className="!w-9 !h-7" eager /><span className={`rar-${p.rarity} ${p.kind === "rod" ? "font-semibold" : ""}`}>{p.label}</span></span></td>
            <td className="num r">{pct(p.chance)}</td>
            <td className="num r">{fmt(p.value)}g</td>
          </tr>
        ))}
      </tbody></table>
      {howTo && <div className="mt-3 text-[11.5px] text-[var(--text-2)] space-y-1" data-testid="crate-how-to"><div className="label !text-[10px]">How to get crates</div>{howTo.map((h) => <div key={h}>· {h}</div>)}</div>}
      <div className="text-[10.5px] text-[var(--muted)] mt-2">Crates are only earned in game, never sold for Pearls or money. Every opening is a fresh roll, nothing carries over. A rod you already own goes into your Tackle box as a spare you can sell.</div>
      {onOpen && c.owned > 0 && <div className="flex justify-end mt-3"><button className="btn btn-gold" onClick={onOpen} data-testid="crate-odds-open">Open one (×{c.owned})</button></div>}
    </Modal>
  );
}

const Tile = ({ p, win }) => (
  <div className={`crate-tile crate-tile-${p.rarity} ${win ? "crate-tile-win" : ""}`} style={{ width: TW - 8 }}>
    <GearIcon id={p.icon} className="!w-16 !h-12" eager />
    <div className={`crate-tile-label rar-${p.rarity}`}>{p.label}</div>
  </div>
);

export function CrateOpener({ crate: c, onClose, onDone }) {
  const { setUser } = useGame();
  const [res, setRes] = useState(null);
  const [done, setDone] = useState(false);
  const [x, setX] = useState(0);
  const box = useRef(null), track = useRef(null), sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api.post("/crates/open", { crate_id: c.id }).then((r) => setRes(r.data)).catch((e) => { toast.error(errMsg(e)); onClose(); });
  }, []); // eslint-disable-line
  useLayoutEffect(() => {
    if (!res || !box.current) return undefined;
    const w = box.current.clientWidth, jitter = (Math.random() - 0.5) * (TW - 30);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setX(-(res.win_at * TW + TW / 2 - w / 2 + jitter))));
    let last = 0, raf;
    const tick = () => {
      const m = track.current && getComputedStyle(track.current).transform;
      const tx = m && m !== "none" ? Math.abs(parseFloat(m.split(",")[4])) : 0;
      const n = Math.floor(tx / TW);
      if (n !== last) { last = n; sfx("reel", 0); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const t = setTimeout(() => {
      cancelAnimationFrame(raf); setDone(true); setUser(res.user);
      sfx(["legendary", "mythic"].includes(res.prize.rarity) || res.prize.kind === "rod" ? "level" : "rare");
      onDone?.();
    }, SPIN_MS + 150);
    return () => { cancelAnimationFrame(id); cancelAnimationFrame(raf); clearTimeout(t); };
  }, [res]); // eslint-disable-line
  const p = res?.prize;
  return (
    <Modal onClose={done ? onClose : () => {}} testId="crate-opener" wide>
      <div className="font-display text-[16px] mb-2">Opening a <span style={{ color: CRATE_COL[c.id] }}>{c.name}</span></div>
      <div className="crate-reel" ref={box} data-testid="crate-reel">
        <div className="crate-reel-marker" />
        <div className="crate-reel-track" ref={track} style={{ transform: `translateX(${x}px)`, transition: x ? `transform ${SPIN_MS}ms cubic-bezier(.08,.7,.12,1)` : "none" }}>
          {(res?.strip || Array.from({ length: 12 }, () => null)).map((s, i) => s ? <Tile key={i} p={s} win={done && i === res.win_at} /> : <div key={i} className="crate-tile" style={{ width: TW - 8 }} />)}
        </div>
      </div>
      {done && p && (
        <div className={`crate-win crate-win-${p.rarity} mt-3`} data-testid="crate-win">
          <GearIcon id={p.icon} size="md" />
          <div className="min-w-0">
            <div className="label !text-[10px]">You won</div>
            <div className={`font-display text-[18px] rar-${p.rarity}`} data-testid="crate-win-label">{p.label}</div>
            <div className="text-[11.5px] text-[var(--muted)] num">{pct(p.chance)} chance · worth ~{fmt(p.value)}g</div>
            {res.note && <div className="text-[11.5px] text-[#ffcfa8] mt-1" data-testid="crate-win-note">{res.note}</div>}
          </div>
          <button className="btn btn-gold ml-auto" onClick={onClose} data-testid="crate-win-close">Collect</button>
        </div>
      )}
    </Modal>
  );
}

export function CratesBox({ onSell }) {
  const { user } = useGame();
  const [d, load] = useCrates(JSON.stringify(user.crates || {}));
  const [odds, setOdds] = useState(null);
  const [opening, setOpening] = useState(null);
  if (!d) return null;
  return (
    <Panel icon="chest" title="Crates" right={<button type="button" className="text-[11.5px] underline" onClick={() => setOdds(d.crates[0])} data-testid="crates-how-link">How to get them</button>} testId="crates-box">
      <div className="grid grid-cols-3 gap-2">
        {d.crates.map((c) => (
          <div key={c.id} className={`crate-card ${c.owned ? "" : "opacity-60"}`} data-testid={`crate-card-${c.id}`}>
            <button type="button" className="block mx-auto" onClick={() => setOdds(c)} title="Contents and chances" data-testid={`crate-info-${c.id}`}>
              <img src={`/art/gear/${c.id}.webp`} alt={c.name} className={`w-16 h-16 object-contain crate-glow-${c.rarity} ${c.owned ? "crate-bob" : ""}`} style={{ imageRendering: "pixelated" }} />
            </button>
            <div className="text-[12px] font-display" style={{ color: CRATE_COL[c.id] }}>{c.name}</div>
            <div className="num text-[11px] text-[var(--muted)]" data-testid={`crate-owned-${c.id}`}>×{c.owned}</div>
            <div className="flex flex-wrap justify-center gap-1 mt-1">
              <button className="btn btn-sm btn-gold" disabled={!c.owned} onClick={() => setOpening(c)} data-testid={`crate-open-${c.id}`}>Open</button>
              {!user.is_guest && <button className="btn btn-sm" disabled={!c.owned} onClick={() => onSell(c)} data-testid={`crate-sell-${c.id}`}>Sell</button>}
              {c.owned > 0 && <LinkChatBtn item={{ kind: "item", ref: c.id }} label={c.name} testId={`link-chat-${c.id}`} />}
            </div>
          </div>
        ))}
      </div>
      {odds && <CrateOdds crate={odds} howTo={d.how_to_get} onClose={() => setOdds(null)} onOpen={() => { setOpening(odds); setOdds(null); }} />}
      {opening && <CrateOpener crate={opening} onClose={() => { setOpening(null); load(); }} onDone={load} />}
    </Panel>
  );
}

export function CrateOddsLink({ crateId, className = "" }) {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);
  const show = async () => { if (!d) setD((await api.get("/crates")).data); setOpen(true); };
  const c = d?.crates.find((x) => x.id === crateId);
  return <>
    <button type="button" className={`underline decoration-dotted underline-offset-2 ${className}`} onClick={show} data-testid={`crate-odds-link-${crateId}`}>contents & chances</button>
    {open && c && <CrateOdds crate={c} howTo={d.how_to_get} onClose={() => setOpen(false)} />}
  </>;
}

export const CrateDropNote = ({ drop }) => drop ? (
  <div className={`crate-win crate-win-${drop.rarity} !py-2`} data-testid="crate-drop-note">
    <img src={`/art/gear/${drop.id}.webp`} alt="" className={`w-10 h-10 object-contain crate-glow-${drop.rarity} crate-bob`} style={{ imageRendering: "pixelated" }} />
    <div className="text-[12.5px]"><b className={`rar-${drop.rarity}`}>{drop.name}!</b> It came up with the catch. Open it from Inventory, Crates & more.</div>
  </div>
) : null;
