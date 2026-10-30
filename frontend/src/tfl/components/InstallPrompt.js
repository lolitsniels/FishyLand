/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { t as tt } from "../i18n";
import { useInstallPrompt, isMobileUA, isIOS, isStandalone } from "../lib/install";

const DISMISS_KEY = "fl_install_dismissed_at";
const DESK_KEY = "fl_install_desk_nudged";
const DISMISS_DAYS = 10;

function dismissedRecently() {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return at && Date.now() - at < DISMISS_DAYS * 86400 * 1000;
}

export const INSTALL_REWARD_TEXT = "Open the game from the app once to get the exclusive App Angler frame + an Energy Potion.";

// Phones: classic bottom banner (native prompt on Android, Share → Add to Home Screen on iOS), every 10 days until installed.
// PC: a single one-time nudge when the browser offers installing.
export function InstallPrompt() {
  const { canInstall, install } = useInstallPrompt();
  const mobile = isMobileUA();
  const [ios, setIos] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!mobile || !isIOS() || isStandalone() || dismissedRecently()) return undefined;
    const t = setTimeout(() => setIos(true), 4000);
    return () => clearTimeout(t);
  }, [mobile]);

  const eligible = !isStandalone() && (mobile ? !dismissedRecently() : !localStorage.getItem(DESK_KEY));
  const show = !closed && eligible && (canInstall || ios);
  if (!show) return null;
  const remember = () => localStorage.setItem(mobile ? DISMISS_KEY : DESK_KEY, String(Date.now()));
  const dismiss = () => { setClosed(true); remember(); };
  const accept = async () => { await install(); dismiss(); };

  return (
    <div className={mobile ? "fixed inset-x-2 bottom-2 z-50" : "fixed right-4 bottom-20 z-50 w-[360px]"} data-testid={mobile ? "install-prompt" : "install-prompt-desktop"}>
      <div className="mx-auto max-w-md bg-[#131211] border border-[#2e2420] shadow-xl">
        <div className="flex items-start gap-2 p-3">
          <img src="/icon-192.png" alt="" className="w-10 h-10 border border-[#2e2420] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-[13px] tracking-widest uppercase text-[var(--gold)]">{tt(mobile ? "Install FishyLand" : "Get it on your desktop")}</div>
            {ios ? (
              <div className="text-[11.5px] text-[var(--text-2)] mt-0.5 leading-snug">
                {tt("Tap")} <Share size={11} className="inline -mt-0.5" /> {tt("Share below, then")} <b>{tt("Add to Home Screen")}</b> {tt("to keep the docks one tap away.")}
              </div>
            ) : (
              <div className="text-[11.5px] text-[var(--text-2)] mt-0.5 leading-snug">{tt(mobile ? "Pin the docks to your home screen: no store, no download, one tap to fish." : "Install the game as an app: its own window and a desktop icon, no download needed.")}</div>
            )}
            <div className="text-[11.5px] text-[var(--gold)] mt-1" data-testid="install-reward">{tt(INSTALL_REWARD_TEXT)}</div>
          </div>
          <button onClick={dismiss} className="text-[var(--muted)] hover:text-[var(--text)] p-1 -mr-1 -mt-1" title={tt("Not now")} data-testid="install-dismiss"><X size={14} /></button>
        </div>
        {!ios && canInstall && (
          <div className="px-3 pb-3 flex gap-2">
            <button onClick={accept} className="btn btn-sm btn-gold flex-1 inline-flex items-center justify-center gap-1.5" data-testid="install-accept"><Download size={12} /> {tt("Install")}</button>
            <button onClick={dismiss} className="btn btn-sm" data-testid="install-later">{tt(mobile ? "Later" : "No thanks")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Settings: install (or reinstall) any time, on PC or phone.
export function InstallSettings({ claimed }) {
  const { canInstall, install } = useInstallPrompt();
  const installed = isStandalone();
  return (
    <div data-testid="settings-install">
      {installed ? <div className="text-[12.5px] text-[var(--ok)]" data-testid="settings-install-done">{tt("You're playing from the installed app.")}</div>
        : canInstall ? <button type="button" className="btn btn-sm btn-gold inline-flex items-center gap-1.5" onClick={install} data-testid="settings-install-button"><Download size={12} /> {tt(isMobileUA() ? "Install on this phone" : "Install on this computer")}</button>
        : <div className="text-[12px] text-[var(--text-2)] leading-snug" data-testid="settings-install-howto">
            {isIOS() ? <>{tt("In Safari tap")} <Share size={11} className="inline -mt-0.5" /> {tt("Share, then")} <b>{tt("Add to Home Screen")}</b>.</>
              : isMobileUA() ? <>{tt("Open your browser menu (⋮) and tap")} <b>{tt("Install app")}</b> {tt("or")} <b>{tt("Add to Home screen")}</b>.</>
              : <>{tt("In Chrome or Edge, click the install icon at the right of the address bar, or open the menu (⋮) and choose")} <b>{tt("Install FishyLand")}</b>. {tt("Already installed? Open it from your desktop or Start menu.")}</>}
          </div>}
      <div className={`text-[11.5px] mt-1.5 ${claimed ? "text-[var(--muted)]" : "text-[var(--gold)]"}`} data-testid="settings-install-reward">{claimed ? tt("App reward claimed.") : tt(INSTALL_REWARD_TEXT)}</div>
    </div>
  );
}
