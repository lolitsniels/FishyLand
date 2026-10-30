/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { PearlIcon } from "./ui-bits";

const SIZES = { xs: "w-5 h-5", chat: "w-6 h-6", sm: "w-8 h-8", md: "w-14 h-14", lg: "w-24 h-24", xl: "w-32 h-32" };
const PAD = { xs: "p-px", chat: "p-px", sm: "p-[2px]", md: "p-1", lg: "p-[5px]", xl: "p-[6px]" };

const ANIM_AV = { av_leviathan_king: "leviathan", av_storm_titan: "storm", av_kraken_lord: "kraken", av_founder: "founder" };
// big over-the-top frames drawn as an overlay around the portrait (md+ sizes only); x/y/w in % of the avatar box
const OVERLAY = {
  frame_maw: { x: -27, y: -25, w: 154 },
  frame_dragonfire: { x: -30, y: -38, w: 170 },
  frame_frost: { x: -30, y: -28, w: 160 },
  frame_founder: { x: -33, y: -33, w: 166 },
};
const SMALL = ["xs", "chat", "sm"];

export const Avatar = ({ id, name = "", size = "sm", className = "", gold = false, frame = null, testId }) => {
  const anim = ANIM_AV[id];
  const img = (
    <span className={`relative inline-block shrink-0 overflow-hidden border ${frame ? "border-[rgba(0,0,0,.6)]" : gold ? "border-[var(--gold)]" : "border-[var(--border)]"} bg-[#0b0a09] ${SIZES[size]} ${frame ? "" : className}`} data-testid={frame ? undefined : testId}>
      <img src={`/art/avatars/${id || "av_lad"}.jpg`} alt={name} loading="lazy" className={`w-full h-full object-cover block ${anim ? `av-anim av-anim-${anim}` : ""}`} />
      {anim && <span className={`av-fx av-fx-${anim}`} aria-hidden="true" />}
      {anim === "leviathan" && <span className="av-sparkle" aria-hidden="true" />}
    </span>
  );
  if (!frame) return img;
  const owner = frame === "frame_owner";
  const ov = OVERLAY[frame];
  return (
    <span className={`av-frame av-frame-${frame} av-size-${size} inline-flex shrink-0 align-middle ${PAD[size]} ${className}`} data-testid={testId} data-frame={frame} title={owner ? "Game Owner" : undefined}>
      {img}
      {owner && !["xs", "chat"].includes(size) && <span className="av-owner-crown" aria-hidden="true" />}
      {ov && !SMALL.includes(size) && <span className={`av-ovl av-ovl-${frame}`} style={{ left: `${ov.x}%`, top: `${ov.y}%`, width: `${ov.w}%`, height: `${ov.w}%`, backgroundImage: `url(/art/skins/${frame}.png)` }} aria-hidden="true" />}
      {frame === "frame_maw" && !SMALL.includes(size) && <span className="av-maw-lure" aria-hidden="true" />}
    </span>
  );
};

// Grid of portraits. `owned` is a Set of ids; premium (price>0) unowned ones show their Pearl price.
export const AvatarPicker = ({ avatars, value, onChange, owned, pearls = 0, showPremium = true, showNames = true, testId = "avatar-picker" }) => (
  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2" data-testid={testId}>
    {avatars.filter((a) => showPremium || a.price === 0).map((a) => {
      const isOwned = a.price === 0 || owned?.has(a.id);
      const sel = a.id === value;
      const affordable = pearls >= a.price;
      return (
        <button type="button" key={a.id} onClick={() => onChange(a)} title={a.name}
          className={`group text-left border p-1 transition-colors ${sel ? "border-[var(--gold)] bg-[#1f1714]" : isOwned ? "border-[var(--border)] hover:border-[var(--text-2)]" : "border-dashed border-[#5a4e6e] hover:border-[#b9a8c9]"}`}
          data-testid={`avatar-option-${a.id}`} data-selected={sel} data-owned={isOwned}>
          <div className={`relative ${!isOwned && !affordable ? "opacity-70" : ""}`}>
            <img src={`/art/avatars/${a.id}.jpg`} alt={a.name} loading="lazy" className="w-full aspect-square object-cover block" />
            {!isOwned && <span className="absolute bottom-0 right-0 num text-[10px] px-1 bg-[rgba(12,11,10,.85)] text-[#e9dcf5] inline-flex items-center gap-1"><PearlIcon size={8} />{a.price}</span>}
          </div>
          {showNames && <div className={`text-[10.5px] mt-1 truncate ${sel ? "text-[var(--gold)]" : "text-[var(--text-2)]"}`}>{a.name}</div>}
        </button>
      );
    })}
  </div>
);
