/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { defaultWeightUnit } from "./api";

// Tiny per-device display preferences (localStorage), broadcast via a window event so open panels update live.
const KEY = "owo_prefs";
const DEFAULTS = { chat_timestamps: true, weight_unit: defaultWeightUnit(), legendary_alerts: true, share_buttons: true, sound_on: true, sound_volume: 0.35, sound_mention: true, ui_scale: "auto", toasts: "all" };


// Big monitors: scale the whole game up so it doesn't sit as a small strip in the middle. "auto" picks by screen width.
export const autoScale = (w = window.innerWidth) => (w >= 2300 ? 1.35 : w >= 1900 ? 1.2 : w >= 1600 ? 1.1 : 1);
export const applyUiScale = () => {
  const v = getPrefs().ui_scale;
  const z = v === "auto" ? autoScale() : Number(v) || 1;
  document.documentElement.style.zoom = z === 1 ? "" : String(z);
  document.documentElement.style.setProperty("--zoom", String(z));  // viewport units ignore zoom; CSS divides by this
  return z;
};

export const getPrefs = () => {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; } catch { return { ...DEFAULTS }; }
};

export const setPref = (k, v) => {
  localStorage.setItem(KEY, JSON.stringify({ ...getPrefs(), [k]: v }));
  window.dispatchEvent(new CustomEvent("prefs-changed"));
};

export function usePrefs() {
  const [p, setP] = useState(getPrefs);
  useEffect(() => {
    const on = () => setP(getPrefs());
    window.addEventListener("prefs-changed", on);
    return () => window.removeEventListener("prefs-changed", on);
  }, []);
  return p;
}
