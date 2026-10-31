/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { toast } from "sonner";
import { api } from "./api";
import { recaptchaToken } from "./recaptcha";
import { bmmRegistration } from "./bmmTracker";
import { PORTAL } from "./portal";
import { ls } from "../../offline/bridge";

// One guest-account flow for every "Play as guest" button: reCAPTCHA v3 token → /auth/guest (portal builds skip Google's bot check).
export async function createGuest(source, refCode) {
  const ref = (refCode || ls.getItem("owo_ref") || "").trim();
  const recaptcha_token = PORTAL ? undefined : await recaptchaToken("guest_signup");
  const r = await api.post("/auth/guest", { ...(ref ? { ref: ref.toUpperCase() } : {}), ...(PORTAL ? { portal: PORTAL } : {}), source: ls.getItem("owo_source") || source, source_page: ls.getItem("owo_source_page") || undefined, guide: ls.getItem("owo_guide") || undefined, recaptcha_token });
  if (r.data.referral?.applied) toast.success(`Recruited by ${r.data.referral.recruiter}`);
  ls.removeItem("owo_ref");
  if (!r.data.resumed) bmmRegistration(r.data.user?.id);
  return r.data;
}
