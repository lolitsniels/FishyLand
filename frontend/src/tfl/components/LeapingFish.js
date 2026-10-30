/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
// Small leaping-fish icon (fish arcing out of the water with sparkles), drawn in the same 24-grid stroke style as lucide-react.
export const LeapingFish = ({ size = 14, className = "", ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...rest}>
    {/* fish body arcing up and to the right */}
    <path d="M6 14c1.5-4.5 5-7 9-7 1.8 0 3 .6 3.6 1.4" />
    <path d="M6 14c3.2 1 6.6.2 9.3-2.4" />
    {/* tail */}
    <path d="M18.6 8.4 21 6.2M18.6 8.4l-.4 3.2" />
    {/* eye */}
    <circle cx="14.6" cy="9.6" r=".6" fill="currentColor" stroke="none" />
    {/* water line with a splash */}
    <path d="M2 19c1.3-1 2.7-1 4 0s2.7 1 4 0 2.7-1 4 0 2.7 1 4 0" />
    <path d="M6 16.5v-1" />
    {/* sparkles */}
    <path d="M4.5 6.5v2M3.5 7.5h2" />
    <path d="M10.5 3.5v1.6M9.7 4.3h1.6" />
    <path d="M20.5 13v1.4M19.8 13.7h1.4" />
  </svg>
);
