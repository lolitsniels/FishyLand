/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { prizeArt } from "../lib/prizeArt";

const FILL = { normal: ["#5a3520", "#734426"], better: ["#2b3f4a", "#3a5563"] };
const pt = (r, a) => [+(r * Math.sin((a * Math.PI) / 180)).toFixed(2), +(-r * Math.cos((a * Math.PI) / 180)).toFixed(2)];

const Slice = ({ i, n, seg, better }) => {
  const a0 = (i * 360) / n, a1 = ((i + 1) * 360) / n, mid = (a0 + a1) / 2;
  const [x0, y0] = pt(46, a0), [x1, y1] = pt(46, a1);
  const fill = seg.kind === "mythic" ? "#5c1f2c" : FILL[better ? "better" : "normal"][i % 2];
  return (
    <g>
      <path d={`M0 0L${x0} ${y0}A46 46 0 0 1 ${x1} ${y1}Z`} fill={fill} stroke="#1a110c" strokeWidth="1" />
      <g transform={`rotate(${mid}) translate(-9 -41)`}>
        <image href={prizeArt(seg)} x="0" y="0" width="18" height="14" preserveAspectRatio="xMidYMid meet" style={{ imageRendering: "pixelated" }} />
      </g>
    </g>
  );
};

export function Wheel({ segments, better, rotation = 0, spinning = false, size = 260 }) {
  const n = segments.length;
  return (
    <svg viewBox="-60 -62 120 122" width={size} height={size} shapeRendering="crispEdges" className="spin-wheel" data-testid="spin-wheel">
      <g style={{ transform: `rotate(${rotation}deg)`, transformBox: "fill-box", transformOrigin: "center", transition: spinning ? "transform 4.2s cubic-bezier(.15,.7,.2,1)" : "none" }}>
        {Array.from({ length: 8 }, (_, k) => {
          const [hx, hy] = pt(57, k * 45);
          return <g key={k}><line x1="0" y1="0" x2={hx} y2={hy} stroke="#3b2414" strokeWidth="4" /><circle cx={hx} cy={hy} r="3.2" fill="#8a5530" stroke="#1a110c" strokeWidth="1" /></g>;
        })}
        <circle r="51" fill={better ? "#c59a3e" : "#8a5530"} stroke="#1a110c" strokeWidth="1.5" />
        <circle r="47" fill="#1a110c" />
        {segments.map((s, i) => <Slice key={s.id} i={i} n={n} seg={s} better={better} />)}
        {Array.from({ length: n }, (_, k) => { const [px, py] = pt(49, (k * 360) / n); return <rect key={k} x={px - 1.2} y={py - 1.2} width="2.4" height="2.4" fill="#f0d79a" />; })}
        <circle r="7" fill={better ? "#c59a3e" : "#8a5530"} stroke="#1a110c" strokeWidth="1.2" />
        <circle r="2.4" fill="#1a110c" />
      </g>
      <path d="M-5 -61h10v3h-2v3h-2v3h-2v-3h-2v-3h-2z" fill="#f2c744" stroke="#1a110c" strokeWidth=".8" />
    </svg>
  );
}

// Rotation that brings slice idx under the top pointer, after several full turns.
export const landingRotation = (from, idx, n) => {
  const centre = ((idx + 0.5) * 360) / n + (Math.random() - 0.5) * (360 / n) * 0.6;
  const base = Math.ceil(from / 360) * 360 + 360 * 5;
  return base + (360 - centre);
};
