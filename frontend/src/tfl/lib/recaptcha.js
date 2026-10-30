/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
const SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
let loading = null;

// Loads the reCAPTCHA v3 script on demand (landing pages only) and resolves once grecaptcha is ready.
export function loadRecaptcha() {
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
      s.async = true; s.defer = true;
      s.onload = () => window.grecaptcha.ready(() => resolve(window.grecaptcha));
      s.onerror = () => { loading = null; reject(new Error("Bot check could not load. Check your connection or ad blocker")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export async function recaptchaToken(action) {
  if (!SITE_KEY) return undefined; // no key configured: backend skips the bot check too (IP limits still apply)
  const g = await loadRecaptcha();
  return g.execute(SITE_KEY, { action });
}

const V2_SITE_KEY = process.env.REACT_APP_RECAPTCHA_V2_SITE_KEY;

// Renders a v2 "I'm not a robot" checkbox into el; resolves the response token when the angler ticks it.
export async function renderCheckbox(el, { onToken, onExpired }) {
  const g = await loadRecaptcha();
  return g.render(el, { sitekey: V2_SITE_KEY, theme: "dark", callback: onToken, "expired-callback": onExpired });
}

export function resetCheckbox(widgetId) {
  if (window.grecaptcha?.reset && typeof widgetId === "number") window.grecaptcha.reset(widgetId);
}
