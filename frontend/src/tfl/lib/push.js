/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { api } from "../lib/api";

// Convert a base64url VAPID key to a Uint8Array for pushManager.subscribe.
function urlBase64ToUint8Array(b64) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch { return null; }
}

// Prompts for permission, subscribes to push, and posts the subscription (+ which alerts to receive) to the backend.
// Returns { ok, reason }, reason is one of: "denied", "unsupported", "not-configured", "error".
export async function enablePush(prefs = { boss: true, expedition: false }) {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const cfg = (await api.get("/push/config")).data;
  if (!cfg?.enabled || !cfg?.public_key) return { ok: false, reason: "not-configured" };
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.public_key),
      });
    }
    const raw = sub.toJSON();
    await api.post("/push/subscribe", { endpoint: raw.endpoint, keys: raw.keys, prefs });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", error: String(e) };
  }
}

// iOS Safari only delivers web push once the site is installed to the Home Screen.
export const isIosBrowser = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone);

export async function disablePush() {
  if (!pushSupported()) return { ok: true };
  const sub = await currentSubscription();
  if (sub) {
    try { await api.post("/push/unsubscribe", { endpoint: sub.endpoint }); } catch {}
    try { await sub.unsubscribe(); } catch {}
  } else {
    try { await api.post("/push/unsubscribe", {}); } catch {}
  }
  return { ok: true };
}
