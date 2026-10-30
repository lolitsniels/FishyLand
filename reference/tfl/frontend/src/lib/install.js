import { useEffect, useState } from "react";

// Captures the browser's install prompt as early as possible so any screen (banner, settings) can trigger it.
let deferred = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f(deferred));

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; emit(); });
  window.addEventListener("appinstalled", () => { deferred = null; emit(); });
}

export const isMobileUA = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export function useInstallPrompt() {
  const [evt, setEvt] = useState(deferred);
  useEffect(() => { subs.add(setEvt); setEvt(deferred); return () => subs.delete(setEvt); }, []);
  const install = async () => {
    if (!deferred) return false;
    const e = deferred;
    e.prompt();
    let ok = false;
    try { ok = (await e.userChoice)?.outcome === "accepted"; } catch {}
    deferred = null; emit();
    return ok;
  };
  return { canInstall: !!evt, install };
}
