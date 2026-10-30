/*
 * The Fishing Lands, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import i18next from "i18next";

// The site is English-only; t() only fills {{placeholders}} in the English strings.
export const OLD_LANG_PATHS = ["nl", "de", "pl", "ru", "uk", "sv", "no", "fi", "tr", "pt", "zh"];
export const getLang = () => "en";

export async function initI18n() {
  try { localStorage.removeItem("owo_lang"); localStorage.removeItem("owo_play_lang"); } catch { /* storage blocked */ }
  await i18next.init({ lng: "en", resources: { en: { translation: {} } }, keySeparator: false, nsSeparator: false, interpolation: { escapeValue: false }, returnEmptyString: false });
  document.documentElement.lang = "en";
  return "en";
}

export const t = (key, opts) => i18next.t(key, opts);
