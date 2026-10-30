/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { t as tt } from "../i18n";

export function useSecrets() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/secrets").then((r) => setD(r.data)).catch(() => {}); }, []);
  return d;
}

// Deliberately quiet: no notification when a window opens. Only a vague hint that this water hides something.
export function SecretPanel({ waterKey }) {
  const d = useSecrets();
  if (!d) return null;
  const here = d.secrets.find((s) => s.water === waterKey);
  if (!here) return null;
  return (
    <div className="text-[11.5px] text-[var(--muted)] px-1 flex items-center gap-1.5" data-testid="secret-panel-next">
      <Sparkles size={12} className="text-[#8a6fc0]" /> {tt("A secret catch haunts this water. Nobody knows the hour it bites")}{here.caught ? tt(" (you found it once already)") : ""}.
    </div>
  );
}
