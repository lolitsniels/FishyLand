import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const TRAILER = ["trailer", "Fishing Realms trailer", "mp4"];
const SHOTS = [
  TRAILER,
  ["fishing_anim", "A real catch: hold to reel and keep the needle in the green", "webp"],
  ["waters", "Twelve waters, from Millbrook Pond to the Cinder Trench"],
  ["harbor", "The harbour: news, chests and the people of the docks"],
  ["shop", "Rods, reels and lines to upgrade"],
  ["journal", "Fill your journal, species by species"],
  ["rankings", "Climb the weekly, monthly and all-time rankings"],
];

export function ShotColumn() {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(null);
  const n = SHOTS.length;
  const shown = [i % n, (i + 1) % n];
  useEffect(() => {
    const open = () => setZoom(TRAILER);
    window.addEventListener("lp-trailer", open); return () => window.removeEventListener("lp-trailer", open);
  }, []);
  useEffect(() => {
    if (!zoom) return;
    const esc = (e) => e.key === "Escape" && setZoom(null);
    document.addEventListener("keydown", esc); return () => document.removeEventListener("keydown", esc);
  }, [zoom]);
  return (
    <div className="lp-shots" data-testid="lp-shots">
      <button type="button" className="lp-shot-arrow" onClick={() => setI((i + n - 1) % n)} aria-label="Previous screenshot" data-testid="lp-shots-up"><span className="lp-tri up" /></button>
      {SHOTS.map(([k, cap, ext], j) => (
        <button type="button" key={k} className={`lp-shot ${shown.includes(j) ? "" : "lp-shot-off"}`} style={{ order: shown.indexOf(j) === -1 ? 9 : shown.indexOf(j) + 1 }} onClick={() => setZoom([k, cap, ext])} data-testid={`lp-shot-${k}`}>
          {k === "trailer"
            ? <><video src="/video/trailer_loop.mp4" poster="/video/trailer_poster.jpg" autoPlay muted loop playsInline preload="metadata" aria-label={cap} data-testid="lp-trailer-loop" /><span className="lp-shot-play"><span className="lp-tri right" />Watch trailer</span></>
            : <img src={`/art/screens/${k}.${ext || "jpg"}`} alt={cap} loading={j <= 1 ? "eager" : "lazy"} />}
        </button>
      ))}
      <button type="button" className="lp-shot-arrow" style={{ order: 5 }} onClick={() => setI((i + 1) % n)} aria-label="Next screenshot" data-testid="lp-shots-down"><span className="lp-tri down" /></button>
      {zoom && createPortal(
        <div className="lp-zoom" onClick={() => setZoom(null)} data-testid="lp-shot-zoom">
          <figure onClick={(e) => e.stopPropagation()}>
            {zoom[0] === "trailer"
              ? <video src="/video/trailer.mp4" poster="/video/trailer_poster.jpg" controls autoPlay playsInline data-testid="lp-trailer-video" />
              : <img src={`/art/screens/${zoom[0]}.${zoom[2] || "jpg"}`} alt={zoom[1]} />}
            <figcaption>{zoom[1]}</figcaption>
            <button type="button" onClick={() => setZoom(null)} aria-label="Close" data-testid="lp-shot-zoom-close"><X size={18} /></button>
          </figure>
        </div>, document.body)}
    </div>
  );
}
