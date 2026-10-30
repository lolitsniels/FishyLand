/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { toast } from "sonner";
import { pushSupported, currentSubscription, enablePush, disablePush } from "../lib/push";
import { t as tt } from "../i18n";

const DISMISS_KEY = "fl_push_dismissed_at";
const DISMISS_DAYS = 21;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function dismissedRecently() {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return at && Date.now() - at < DISMISS_DAYS * 86400 * 1000;
}

// Nudge shown once the site is running as an installed app. Asks the player if they'd like a ping when a boss appears anywhere in the world.
export function PushOptIn() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    const check = async () => {
      // Only ping people who have actually installed the app OR who have just installed it in this session.
      const installed = isStandalone() || sessionStorage.getItem("fl_just_installed") === "1";
      if (!installed) return;
      if (Notification.permission === "denied") return;
      if (Notification.permission === "granted") {
        const sub = await currentSubscription();
        if (sub) return; // already subscribed, nothing to nudge
      }
      if (dismissedRecently()) return;
      setShow(true);
    };
    check();
    const onInstalled = () => { sessionStorage.setItem("fl_just_installed", "1"); check(); };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (!show) return null;

  const dismiss = () => { setShow(false); localStorage.setItem(DISMISS_KEY, String(Date.now())); };
  const enable = async () => {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    if (r.ok) {
      toast.success(tt("Boss alerts on, we'll ping you next time one stirs."));
      setShow(false);
    } else if (r.reason === "denied") {
      toast.error(tt("Notifications blocked. Enable them in your browser settings if you change your mind."));
      dismiss();
    } else if (r.reason === "not-configured") {
      toast.error(tt("Push isn't set up on this server yet."));
      dismiss();
    } else {
      toast.error(tt("Could not turn on notifications. Try again from your Angler settings."));
    }
  };

  return (
    <div className="fixed inset-x-2 bottom-[56px] z-50" data-testid="push-optin">
      <div className="mx-auto max-w-md bg-[#131211] border border-[#2e2420] shadow-xl">
        <div className="flex items-start gap-2 p-3">
          <div className="w-10 h-10 border border-[#2e2420] shrink-0 flex items-center justify-center text-[var(--gold)]"><Bell size={18} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[13px] tracking-widest uppercase text-[var(--gold)]">{tt("Boss alerts?")}</div>
            <div className="text-[11.5px] text-[var(--text-2)] mt-0.5 leading-snug">
              {tt("A boss surfaces about every eight hours and doesn't linger. We can ping you the moment one stirs, anywhere in the world.")}
            </div>
          </div>
          <button onClick={dismiss} className="text-[var(--muted)] hover:text-[var(--text)] p-1 -mr-1 -mt-1" title={tt("Not now")} data-testid="push-dismiss"><X size={14} /></button>
        </div>
        <div className="px-3 pb-3 flex gap-2">
          <button onClick={enable} disabled={busy} className="btn btn-sm btn-gold flex-1 inline-flex items-center justify-center gap-1.5 disabled:opacity-50" data-testid="push-accept"><Bell size={12} /> {busy ? tt("Enabling…") : tt("Enable alerts")}</button>
          <button onClick={dismiss} className="btn btn-sm" data-testid="push-later">{tt("Later")}</button>
        </div>
      </div>
    </div>
  );
}

// Compact settings toggle for the "My Angler" panel, always available, not just after install.
export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    setSupported(true);
    currentSubscription().then((s) => setSubscribed(!!s));
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    if (subscribed) {
      await disablePush();
      setSubscribed(false);
      toast.success(tt("Boss alerts turned off."));
    } else {
      const r = await enablePush();
      if (r.ok) { setSubscribed(true); toast.success(tt("Boss alerts on.")); }
      else if (r.reason === "denied") toast.error(tt("Notifications blocked in your browser."));
      else toast.error(tt("Could not enable alerts."));
    }
    setBusy(false);
  };

  return (
    <button onClick={toggle} disabled={busy} className={`btn btn-sm inline-flex items-center gap-1.5 ${subscribed ? "btn-gold" : ""} disabled:opacity-50`} data-testid="push-toggle">
      {subscribed ? <Bell size={12} /> : <BellOff size={12} />} {subscribed ? tt("Alerts on") : tt("Enable boss alerts")}
    </button>
  );
}
