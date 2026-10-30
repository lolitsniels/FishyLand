/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useState } from "react";
import { t as tt } from "../i18n";

// Stand-in art until each of the 416 species gets its own plate.
const STAND_IN = ["azure_perch", "coral_snapper", "crystal_angelfish", "glimmer_minnow", "golden_sunray", "lagoon_carp", "moonfin_trout", "prism_koi", "starwhale", "stormscale_pike"];
// Illustrated species plate (transparent PNG); silhouette mode for undiscovered journal entries.
export const FishPlate = ({ speciesId, name, silhouette = false, className = "" }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className={`bg-[var(--bg-2)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] text-[10px] ${className}`}>{silhouette ? "?" : tt("no plate")}</div>;
  return (
    <div className={`border border-[var(--border)] bg-[var(--bg-2)] flex items-center justify-center p-1 ${className}`} style={{ backgroundImage: "radial-gradient(ellipse at center, #221e1b 0%, #121110 75%)" }}>
      <img src={`/art/fish/${STAND_IN[speciesId % STAND_IN.length]}.png`} alt={silhouette ? tt("Undiscovered species") : name} data-silhouette={silhouette ? "1" : undefined} onError={() => setFailed(true)} loading="lazy"
        className="max-w-full max-h-full object-contain"
        style={silhouette ? { filter: "brightness(0) invert(0.35) blur(0.8px)", opacity: 0.6 } : { filter: `hue-rotate(${(speciesId * 47) % 360}deg) drop-shadow(0 2px 3px rgba(0,0,0,.6))` }} data-testid={`fish-plate-${speciesId}`} />
    </div>
  );
};
