/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";

// Small inline equipment/bait illustration for compact table rows. Same art pipeline as fish plates.
export const GearIcon = ({ id, name = "", size = "sm", className = "", eager = false }) => {
  const [failed, setFailed] = useState(false);
  const dims = size === "md" ? "w-20 h-14" : size === "wide" ? "w-24 h-10" : "w-14 h-10";
  if (failed) return <span className={`inline-block ${dims} ${className}`} />;
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${dims} ${className}`} style={{ background: "radial-gradient(ellipse at center, #221e1b 0%, rgba(22,19,17,0) 75%)" }}>
      <img src={`/art/gear/${id}.webp`} alt={name} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} className="max-w-full max-h-full object-contain" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }} data-testid={`gear-icon-${id}`} />
    </span>
  );
};
