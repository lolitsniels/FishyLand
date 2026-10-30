/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import axios from "axios";
import { toast } from "sonner";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, withCredentials: true });
// Background polls (GETs) are dropped while the tab is hidden; duel matchmaking and auth still go through.
const KEEP_HIDDEN = /^\/?(duel|auth)\b/;
api.interceptors.request.use((cfg) => {
  if (document.hidden && (cfg.method || "get").toLowerCase() === "get" && !KEEP_HIDDEN.test(cfg.url || "")) return Promise.reject(new axios.CanceledError("tab hidden"));
  const t = localStorage.getItem("owo_token");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  cfg.headers["X-Client"] = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone ? "pwa" : "web";
  return cfg;
});
api.interceptors.response.use((r) => {
  (Array.isArray(r.data?.quests_done) ? r.data.quests_done : []).forEach((q) => {
    const bits = [`+${fmt(q.reward.gold)} gold`, `+${fmt(q.reward.xp)} XP`];
    if (q.reward.pearls) bits.push(`+${q.reward.pearls} Pearl${q.reward.pearls > 1 ? "s" : ""}`);
    if (q.reward.title) bits.push(`title "${q.reward.title}"`);
    toast.success(`${q.kind === "streak" ? "Streak bonus" : "Quest complete"}: ${q.name}`, { description: bits.join(" · "), duration: 6000 });
    window.dispatchEvent(new CustomEvent("quests-changed"));
  });
  return r;
}, (e) => {
  if (isOutage(e) && !window.__leaving) window.dispatchEvent(new CustomEvent("server-down"));
  return Promise.reject(e);
});

export const outageMsg = () => "Server reload in progress. The game will reconnect automatically in a moment.";
export const isOutage = (e) => {
  const s = e?.response?.status;
  if (!e?.response) return e?.code === "ERR_NETWORK" || /network|timeout/i.test(e?.message || "");
  return [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530].includes(s) || (typeof e.response.data === "string" && /<html/i.test(e.response.data));
};

// Requests dropped while the tab was hidden are not errors: errMsg yields "" and toast.error ignores empty messages.
const _toastError = toast.error.bind(toast);
toast.error = (msg, opts) => (msg ? _toastError(msg, opts) : undefined);

// Touch devices: a tap fires mouseenter without a mouseleave (and scrolls cancel pointerup), which leaves sonner's
// auto-close timer paused forever. Enforce dismissal ourselves so phone toasts always go away.
export const IS_TOUCH = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
if (IS_TOUCH) {
  ["success", "error", "info", "warning", "message"].forEach((k) => {
    const orig = toast[k].bind(toast);
    toast[k] = (msg, opts = {}) => {
      const id = orig(msg, opts);
      const d = opts.duration ?? 4000;
      if (id !== undefined && d !== Infinity) setTimeout(() => toast.dismiss(id), d + 300);
      return id;
    };
  });
}

export function errMsg(e) {
  if (axios.isCancel(e)) return "";
  if (isOutage(e)) return outageMsg();
  const d = e?.response?.data?.detail;
  if (!d) return e?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(" ");
  return d.msg || String(d);
}

export const fmt = (n) => Number(n ?? 0).toLocaleString();
const LB_REGIONS = new Set(["US", "GB", "LR", "MM"]);
export const defaultWeightUnit = () => {
  const region = (Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || "").split("-")[1]?.toUpperCase();
  return LB_REGIONS.has(region) ? "lb" : "kg";
};
export const weightUnit = () => {
  try { return JSON.parse(localStorage.getItem("owo_prefs") || "{}").weight_unit || defaultWeightUnit(); } catch { return defaultWeightUnit(); }
};
const fmtW = (w) => (w >= 10 ? w.toFixed(1) : w >= 1 ? w.toFixed(2) : w.toFixed(3));
// Number only, in the player's unit (kg or lb). `wt` adds the unit label; `wtRange` formats "a–b unit".
export const kg = (w) => fmtW(weightUnit() === "lb" ? Number(w) * 2.20462 : Number(w));
export const wt = (w) => `${kg(w)} ${weightUnit()}`;
// Server-written sentences ('landed a 5.13 kg Huchen'), convert inline kg figures for lb players.
export const wtText = (t) => (weightUnit() === "lb" && typeof t === "string" ? t.replace(/(\d+(?:\.\d+)?)\s?kg\b/g, (_, n) => `${kg(Number(n))} lb`) : t);
export const ln = (cm) => (cm == null || Number.isNaN(Number(cm)) ? "-" : weightUnit() === "lb" ? `${(Number(cm) / 2.54).toFixed(1)} in` : `${cm} cm`);
export const wtRange = (a, b) => (weightUnit() === "lb" ? `${Math.round(a * 2.20462 * 10) / 10}–${Math.round(b * 2.20462 * 10) / 10} lb` : `${a}–${b} kg`);
export const ago = (isoStr) => {
  const s = Math.max(0, (Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
