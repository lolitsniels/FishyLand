/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { prizeArt } from "../lib/prizeArt";

const FILL = { normal: ["#c0392b", "#1f6fb2", "#e0a526", "#2e9e6a"], better: ["#e0a526", "#b8860b", "#f2c744", "#c98f12"] };
const pt = (r, a) => [+(r * Math.sin((a * Math.PI) / 180)).toFixed(2), +(-r * Math.cos((a * Math.PI) / 180)).toFixed(2)];

const Slice = ({ i, n, seg, better }) => {
  const a0 = (i * 360) / n, a1 = ((i + 1) * 360) / n, mid = (a0 + a1) / 2;
  const [x0, y0] = pt(46, a0), [x1, y1] = pt(46, a1);
  const pal = FILL[better ? "better" : "normal"];
  const fill = seg.kind === "mythic" ? "#7a1f3d" : pal[i % pal.length];
  return (
    <g>
      <path d={`M0 0L${x0} ${y0}A46 46 0 0 1 ${x1} ${y1}Z`} fill={fill} stroke="#3a2210" strokeWidth=".8" />
      <g transform={`rotate(${mid}) translate(0 -31) rotate(${-mid})`}>
        <circle r="10.5" fill="rgba(255,255,255,.22)" />
        <image href={prizeArt(seg)} x="-9" y="-9" width="18" height="18" preserveAspectRatio="xMidYMid meet" />
      </g>
    </g>
  );
};

export function Wheel({ segments, better, rotation = 0, spinning = false, size = 260 }) {
  const n = segments.length;
  return (
    <svg viewBox="-60 -62 120 122" width={size} height={size} className="spin-wheel" data-testid="spin-wheel">
      <defs>
        <radialGradient id="spin-rim" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffe9a3" /><stop offset="100%" stopColor={better ? "#b8860b" : "#a8742a"} /></radialGradient>
      </defs>
      <g style={{ transform: `rotate(${rotation}deg)`, transformBox: "fill-box", transformOrigin: "center", transition: spinning ? "transform 4.2s cubic-bezier(.15,.7,.2,1)" : "none" }}>
        <circle r="53" fill="url(#spin-rim)" stroke="#3a2210" strokeWidth="1.5" />
        <circle r="47" fill="#3a2210" />
        {segments.map((s, i) => <Slice key={s.id} i={i} n={n} seg={s} better={better} />)}
        {Array.from({ length: n * 2 }, (_, k) => { const [px, py] = pt(50, (k * 180) / n); return <circle key={k} cx={px} cy={py} r="1.6" fill="#fff6c8" stroke="#a8742a" strokeWidth=".4" />; })}
        <circle r="8" fill="url(#spin-rim)" stroke="#3a2210" strokeWidth="1.2" />
        <circle r="3" fill="#3a2210" />
      </g>
      <path d="M0 -50 L-6 -61 L6 -61 Z" fill="#f2c744" stroke="#3a2210" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

// Rotation that brings slice idx under the top pointer, after several full turns.
export const landingRotation = (from, idx, n) => {
  const centre = ((idx + 0.5) * 360) / n + (Math.random() - 0.5) * (360 / n) * 0.6;
  const base = Math.ceil(from / 360) * 360 + 360 * 5;
  return base + (360 - centre);
};
