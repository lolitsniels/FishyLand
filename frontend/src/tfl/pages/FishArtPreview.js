/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Logo } from "../components/Logo";

const SAMPLES = [[42, "Northern Pike"], [1, "Bluegill"], [35, "Rainbow Trout"], [158, "Mahi-Mahi"], [22, "Escaped Koi"], [152, "Lionfish"]];

export default function FishArtPreview() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] p-6 space-y-6" data-testid="fish-art-preview">
      <div className="flex items-center justify-between max-w-6xl mx-auto"><Logo /><span className="label">Fish Journal art style · sample plates for approval</span></div>
      <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SAMPLES.map(([id, name]) => (
          <div key={id} className="panel" data-testid={`preview-${id}`}>
            <div className="panel-head">{name}</div>
            <div className="p-4 flex items-center justify-center h-56 bg-[var(--bg-2)]"><img src={`/art/fish_v2/${id}.webp`} alt={name} className="max-h-full max-w-full object-contain" /></div>
            <div className="p-3 flex items-center justify-center h-32 bg-[#e9e2d0] border-t border-[var(--border)]"><img src={`/art/fish_v2/${id}.webp`} alt="" className="max-h-full max-w-full object-contain" /></div>
          </div>
        ))}
      </div>
      <p className="max-w-6xl mx-auto text-[12.5px] text-[var(--text-2)]">Top: as it appears in the dark journal. Bottom: same transparent PNG on a light surface to show clean edges. Every future plate is generated from one fixed style template so the whole collection matches.</p>
    </div>
  );
}
