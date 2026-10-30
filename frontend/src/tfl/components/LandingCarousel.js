/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { t as tt } from "../i18n";

// Screenshots are captured per language (backend/capture_screens.py); fall back to the English root file if one is missing.
const fallback = (e, src) => { if (e.currentTarget.src.indexOf(src) === -1) e.currentTarget.src = src; };

export const SHOTS = [
  { src: "/art/screens/fishing.jpg",  title: "The Fight",         caption: "Hold to reel, ease off on the dive. Keep the needle in the sweet spot or the line snaps." },
  { src: "/art/screens/harbor.jpg",   title: "The Harbour",       caption: "Your dock. Chest, dockside gossip, patron contracts, expedition timer." },
  { src: "/art/screens/journal.jpg",  title: "The Fish Journal",  caption: "340+ species to discover. Silhouettes fill in as you land them." },
  { src: "/art/screens/waters.jpg",   title: "Twelve Waters",     caption: "From village pond to a volcanic sea trench. Level up and pay the passage." },
  { src: "/art/screens/shop.jpg",     title: "Tackle Shop",       caption: "Rods, reels, lines and bait for every water. Upgrade and enhance your favourites." },
  { src: "/art/screens/rankings.jpg", title: "Rankings",          caption: "Heaviest catch, most species, gold earned. Records the whole server can see." },
];

export default function ScreenShowcase({ onPlay, showPlay, bare = false }) {
  const [cur, setCur] = useState(0);
  const [open, setOpen] = useState(false);
  const total = SHOTS.length;
  const advance = (dir) => setCur((v) => (v + dir + total) % total);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowRight") advance(1);
      if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]); // eslint-disable-line

  const s = SHOTS[cur];
  return (
    <div data-testid="landing-carousel">
      <div className="portal-frame group">
        <img src={s.src} onError={(e) => fallback(e, s.src)} alt={s.title} className="w-full aspect-[16/10] object-cover object-top block" data-testid="showcase-image" />
        {showPlay && (
          <button onClick={onPlay} className="portal-play" data-testid="landing-start-button">
            <span className="font-display">{tt("Play free")}</span>
            <span className="text-[10.5px] tracking-widest uppercase opacity-80">{tt("no download")}</span>
          </button>
        )}
        <button onClick={() => setOpen(true)} aria-label={tt("Enlarge screenshot")} className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/60 border border-[var(--border-2)] hover:border-[var(--gold)] opacity-0 group-hover:opacity-100 transition-opacity" data-testid="showcase-enlarge">
          <Maximize2 size={13} className="text-[#f4ead2]" />
        </button>
        {!bare && <div className="portal-caption">
          <span className="font-display text-[12px] text-[#f4ead2]">{s.title}</span>
          <span className="text-[11.5px] text-[var(--text-2)] truncate hidden sm:inline">{s.caption}</span>
          <span className="num text-[10.5px] text-[var(--muted)] ml-auto shrink-0">{cur + 1}/{total}</span>
        </div>}
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1.5">
        {SHOTS.map((t, idx) => (
          <button key={t.src} onClick={() => setCur(idx)} aria-label={`Show ${t.title}`} data-testid={`carousel-thumb-${idx}`}
            className={`portal-thumb ${idx === cur ? "active" : ""}`}>
            <img src={t.src} onError={(e) => fallback(e, t.src)} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover object-top block" />
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(false)} data-testid="carousel-lightbox" role="dialog" aria-modal="true">
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="panel panel-gold overflow-hidden">
              <img src={s.src} onError={(e) => fallback(e, s.src)} alt={s.title} className="w-full h-auto max-h-[80vh] object-contain bg-[var(--bg)]" />
              {!bare && <div className="px-4 py-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[14px] text-[#f4ead2]">{s.title}</div>
                  <div className="text-[12px] text-[var(--text-2)] truncate">{s.caption}</div>
                </div>
                <div className="text-[11px] text-[var(--muted)] shrink-0 num">{cur + 1} / {total}</div>
              </div>}
            </div>
            <button onClick={() => advance(-1)} aria-label={tt("Previous screen")} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/70 border border-[var(--border-2)] hover:border-[var(--gold)]" data-testid="carousel-prev"><ChevronLeft size={20} className="text-[#f4ead2]" /></button>
            <button onClick={() => advance(1)} aria-label={tt("Next screen")} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-black/70 border border-[var(--border-2)] hover:border-[var(--gold)]" data-testid="carousel-next"><ChevronRight size={20} className="text-[#f4ead2]" /></button>
            <button onClick={() => setOpen(false)} aria-label={tt("Close")} className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-[var(--panel-2)] border border-[var(--gold-dim)] hover:bg-[var(--panel)]" data-testid="carousel-close"><X size={16} className="text-[#f4ead2]" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
