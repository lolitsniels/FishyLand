import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

const SHOW_MS = 6500, GAP_MS = 2500, POP_W = 250, POP_H = 250;
const SIZE = { rare: 120, epic: 140, legendary: 160, mythic: 180 };
const BLOCKERS = ".lp-top, .lp-stage > *, .lp-mascot-wrap, .lp-footer";
const article = (s) => (/^the /i.test(s) ? "" : /^[aeiou]/i.test(s) ? "an " : "a ");

export function useLandingCatches() {
  const [list, setList] = useState([]);
  useEffect(() => {
    const load = () => api.get("/news/landing-catches").then((r) => setList(r.data || [])).catch(() => {});
    load(); const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  return list;
}

// Pop box (fish bottom-centre at x,y) in viewport px
const boxAt = (x, y) => ({ left: x - POP_W / 2, right: x + POP_W / 2, top: y - POP_H, bottom: y + 12 });
const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const blocked = (box) => [...document.querySelectorAll(BLOCKERS)].some((el) => hits(box, el.getBoundingClientRect()));

function spot() {
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < 24; i++) {
    const x = POP_W / 2 + 8 + Math.random() * (w - POP_W - 16), y = POP_H + 60 + Math.random() * (h - POP_H - 80);
    const box = boxAt(x, y);
    if (box.top >= 50 && box.bottom <= h && !blocked(box)) return { x, y };
  }
  return null;
}

function Pop({ c, at, leaving }) {
  const variant = c.variant && c.variant !== "normal" ? `${c.variant} ` : "";
  return (
    <div className={`lp-pop lp-pop-${c.rarity} ${leaving ? "lp-pop-out" : ""}`} style={{ left: at.x, top: at.y }} data-testid="lp-catch-pop">
      <div className="lp-pop-sign">
        <b>{c.username}</b> landed {article(variant || c.name)}<span className="lp-pop-lb">{c.lb} lb</span> {variant}<span className="lp-pop-name">{c.name}</span>
      </div>
      <img src={`/art/fish_v2/${c.species_id}.webp`} alt="" className="lp-pop-fish" style={{ width: SIZE[c.rarity] || 120 }} draggable="false" />
      <div className="lp-pop-splash">{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ "--i": i }} />)}</div>
    </div>
  );
}

export function CatchPops({ list }) {
  const [cur, setCur] = useState(null);
  const idx = useRef(0);
  useEffect(() => {
    if (!list.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let hide, next;
    const show = () => {
      next = setTimeout(show, SHOW_MS + GAP_MS);
      if (document.hidden) return;
      const at = spot();
      if (!at) return;
      const c = list[idx.current % list.length]; idx.current += 1;
      setCur({ c, at, key: idx.current });
      hide = setTimeout(() => setCur(null), SHOW_MS);
    };
    next = setTimeout(show, 1500);
    return () => { clearTimeout(hide); clearTimeout(next); };
  }, [list]);
  useEffect(() => {
    if (!cur) return undefined;
    const check = () => { if (blocked(boxAt(cur.at.x, cur.at.y))) setCur((p) => (p && p.key === cur.key ? { ...p, leaving: true } : p)); };
    window.addEventListener("scroll", check, { passive: true }); window.addEventListener("resize", check);
    return () => { window.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [cur]);
  return <div className="lp-pops" aria-hidden="true">{cur && <Pop key={cur.key} c={cur.c} at={cur.at} leaving={cur.leaving} />}</div>;
}

export function CatchTicker({ list }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return undefined;
    const t = setInterval(() => setI((n) => n + 1), 4500);
    return () => clearInterval(t);
  }, [list]);
  if (!list.length) return null;
  const c = list[i % list.length];
  return (
    <div className="lp-ticker" data-testid="lp-catch-ticker" aria-live="polite">
      <span key={i} className={`lp-tick-item lp-pop-${c.rarity}`} data-testid="lp-ticker-item">
        <img src={`/art/fish_v2/${c.species_id}.webp`} alt="" draggable="false" />
        <span className="lp-tick-text"><b>{c.username}</b> landed {c.lb} lb <span className="lp-pop-name">{c.name}</span></span>
      </span>
    </div>
  );
}
