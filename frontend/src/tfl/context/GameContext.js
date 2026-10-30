/*
 * FishyLand, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, isOutage } from "../lib/api";
import { getLang } from "../i18n";

const Ctx = createContext(null);

export function GameProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=guest
  const [data, setData] = useState(null);
  const [dataError, setDataError] = useState(false);

  const loadData = useCallback(async (version) => {
    setDataError(false);
    // Static payload, cached client-side for the session so re-mounts don't hammer the endpoint.
    try {
      const cached = sessionStorage.getItem(`owo_game_data_v1_${getLang()}`);
      if (cached && !version) { setData(JSON.parse(cached)); }
    } catch {}
    // The browser may hold a stale copy of the un-versioned URL for hours after a deploy; always request the newest version we know of.
    const v = version || localStorage.getItem("owo_data_version") || "";
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const r = await api.get(`/game/data?lang=${getLang()}${v ? `&v=${v}` : ""}`);
        setData(r.data);
        try { sessionStorage.setItem(`owo_game_data_v1_${getLang()}`, JSON.stringify(r.data)); if (r.data.version) localStorage.setItem("owo_data_version", r.data.version); } catch {}
        return;
      } catch {
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
      }
    }
    setDataError(true);
  }, []);

  useEffect(() => {
    loadData();
    if (!localStorage.getItem("owo_token")) { setUser(false); return; }
    const me = () => api.get("/auth/me").then((r) => setUser(r.data)).catch((e) => {
      if (isOutage(e)) { window.addEventListener("server-up", me, { once: true }); return; }  // keep the session through a server refit
      localStorage.removeItem("owo_token"); setUser(false);
    });
    me();
  }, [loadData]);

  const refresh = useCallback(async () => {
    const r = await api.get("/auth/me");
    setUser(r.data);
    return r.data;
  }, []);

  const login = useCallback((payload) => {
    localStorage.setItem("owo_token", payload.token);
    sessionStorage.setItem("fr_mode", "harbour");
    if (payload.user?.is_guest) localStorage.setItem("owo_guest_token", payload.token); else localStorage.removeItem("owo_guest_token");
    setUser(payload.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("owo_token");
    setUser(false);
  }, []);

  const lookups = useMemo(() => {
    if (!data) return null;
    const fishById = Object.fromEntries(data.fish.map((f) => [f.id, f]));
    const waterByKey = Object.fromEntries(data.waters.map((w) => [w.key, w]));
    const gearById = Object.fromEntries([...data.rods, ...data.reels, ...data.lines].map((g) => [g.id, g]));
    const baitById = Object.fromEntries(data.baits.map((b) => [b.id, b]));
    return { fishById, waterByKey, gearById, baitById };
  }, [data]);

  return <Ctx.Provider value={{ user, setUser, data, dataError, loadData, lookups, refresh, login, logout }}>{children}</Ctx.Provider>;
}

export const useGame = () => useContext(Ctx);
