/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
export const Logo = ({ size = "sm", className = "" }) => (
  <img src="/art/landing_logo.webp" alt="The Fishing Lands" draggable="false" data-testid={size === "lg" ? "logo-lg" : "logo-sm"}
    className={`w-auto drop-shadow-[0_3px_6px_rgba(0,0,0,.7)] ${size === "lg" ? "h-[72px] sm:h-[88px]" : "h-[34px] sm:h-[42px]"} ${className}`} />
);
