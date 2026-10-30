import { useEffect, useRef } from "react";

const SRC = "/art/landing_water.webp";
const IMG_W = 1376, IMG_H = 768, HORIZON = 0.335, LIGHT = [0.891, 0.266], BAND = 4;

// Canvas placed like background-size: cover; background-position: center 40%
function place(cv) {
  const w = window.innerWidth, h = window.innerHeight, s = Math.max(w / IMG_W, h / IMG_H);
  Object.assign(cv.style, { width: `${IMG_W * s}px`, height: `${IMG_H * s}px`, left: `${(w - IMG_W * s) / 2}px`, top: `${(h - IMG_H * s) * 0.4}px` });
}

export function PixelSea() {
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const cv = ref.current, ctx = cv.getContext("2d");
    cv.width = IMG_W; cv.height = IMG_H; ctx.imageSmoothingEnabled = false;
    const img = new Image(); img.src = SRC;
    const hy = Math.round(IMG_H * HORIZON);
    const stars = Array.from({ length: 36 }, () => ({ x: Math.random() * IMG_W, y: Math.random() * hy * 0.8, ph: Math.random() * 6.28 }));
    let raf = 0, t0 = 0, meteor = null, nextMeteor = 4 + Math.random() * 8;
    const onResize = () => place(cv);
    place(cv); window.addEventListener("resize", onResize);
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !img.complete) return;
      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      ctx.drawImage(img, 0, 0, IMG_W, hy, 0, 0, IMG_W, hy);
      for (let y = hy; y < IMG_H; y += BAND) {
        const d = (y - hy) / (IMG_H - hy);
        const off = Math.sin(t * 1.0 - y * 0.03) * (1 + d * 6) + Math.sin(t * 0.55 + y * 0.012) * (1 + d * 4);
        const yy = Math.round(y + Math.sin(t * 0.8 + y * 0.05) * d * 2);
        const sy = Math.min(IMG_H - BAND, Math.max(hy, yy));
        ctx.drawImage(img, 0, sy, IMG_W, BAND, off, y, IMG_W, BAND);
        ctx.drawImage(img, 0, sy, IMG_W, BAND, off - Math.sign(off || 1) * IMG_W, y, IMG_W, BAND);
      }
      for (const s of stars) {
        const a = Math.sin(t * 1.4 + s.ph);
        if (a > 0.5) { ctx.fillStyle = `rgba(255,255,240,${a.toFixed(2)})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), 3, 3); }
      }
      if (Math.sin(t * 1.6) > 0) { ctx.fillStyle = "rgba(255,170,70,.6)"; ctx.fillRect(Math.round(LIGHT[0] * IMG_W) - 4, Math.round(LIGHT[1] * IMG_H) - 3, 8, 6); }
      if (!meteor && t > nextMeteor) { meteor = { x: 120 + Math.random() * 800, y: 20 + Math.random() * hy * 0.4, t, dir: Math.random() < 0.5 ? 1 : -1 }; nextMeteor = t + 10 + Math.random() * 18; }
      if (meteor) {
        const age = (t - meteor.t) / 0.9;
        if (age > 1) meteor = null;
        else for (let i = 0; i < 14; i++) {
          const p = age * 300 - i * 9;
          if (p < 0) break;
          ctx.fillStyle = i === 0 ? `rgba(255,255,255,${(1 - age * 0.6).toFixed(2)})` : `rgba(255,${225 - i * 8},${170 - i * 9},${((1 - i / 14) * (1 - age * 0.7)).toFixed(2)})`;
          ctx.fillRect(Math.round(meteor.x + meteor.dir * p), Math.round(meteor.y + p * 0.45), 3, 3);
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={ref} className="lp-sea-fx" aria-hidden="true" data-testid="lp-sea-fx" />;
}
