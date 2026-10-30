/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import axios from "axios";
import { API } from "../lib/api";
import { t as tt } from "../i18n";

export default function ServerStatus() {
  const [down, setDown] = useState(false);
  useEffect(() => {
    const onDown = () => setDown(true);
    window.addEventListener("server-down", onDown);
    return () => window.removeEventListener("server-down", onDown);
  }, []);
  useEffect(() => {
    if (!down) return undefined;
    const t = setInterval(async () => {
      try {
        await axios.get(`${API}/health`, { timeout: 4000 });
        setDown(false);
        window.dispatchEvent(new CustomEvent("server-up"));
      } catch { /* still down */ }
    }, 4000);
    return () => clearInterval(t);
  }, [down]);
  if (!down) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center pointer-events-none" data-testid="server-status-banner">
      <div className="pointer-events-auto mt-2 mx-2 max-w-xl w-full border border-[var(--gold-dim)] bg-[#161412]/95 backdrop-blur px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,.5)] flex items-center gap-3 fade-in">
        <span className="text-[var(--gold)] text-[18px] animate-pulse">⚓</span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[13px] text-[#f4ead2]">{tt("Server reload")}</div>
          <div className="text-[11.5px] text-[var(--text-2)]">{tt("The server is reloading. The game will reconnect automatically in a moment.")}</div>
        </div>
      </div>
    </div>
  );
}
