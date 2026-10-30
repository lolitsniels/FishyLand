/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
// Light theme switch + phone keyboard tracking (iOS keeps fixed panels behind the keyboard otherwise).
const KEY = "owo_prefs";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export function applyModes() {
  document.documentElement.classList.toggle("theme-light", read().theme === "light");
}

export function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const on = () => {
    const open = vv.height < window.innerHeight * 0.8;
    root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    root.style.setProperty("--vvt", `${Math.round(vv.offsetTop)}px`);
    root.classList.toggle("kb-open", open);
  };
  vv.addEventListener("resize", on); vv.addEventListener("scroll", on); on();
}
