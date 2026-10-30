/*
 * Fishing Realms, Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { api, wtText } from "./api";

let cache = { at: 0, data: [] };
const listeners = new Set();

const fetchWanted = () => api.get("/contracts/wanted").then((r) => { cache = { at: Date.now(), data: r.data.wanted }; listeners.forEach((fn) => fn(cache.data)); }).catch(() => {});
if (typeof window !== "undefined") window.addEventListener("contracts-changed", fetchWanted);

const RAR = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
export const wantedFor = (wanted, f) => (wanted || []).find((c) => {
  if (c.species_id && f.species_id !== c.species_id && !(c.species_ids || []).includes(f.species_id)) return false;
  if (c.kind === "trophy" && f.weight < c.min_kg) return false;
  if (c.kind === "variant" && (!f.variant || f.variant === "normal")) return false;
  if (c.kind === "rarity_water" && (f.water !== c.water || RAR.indexOf(f.rarity) < RAR.indexOf(c.min_rarity))) return false;
  return true;
});

export const useWanted = () => {
  const [w, setW] = useState(cache.data);
  useEffect(() => {
    listeners.add(setW);
    if (Date.now() - cache.at > 60000) fetchWanted(); else setW(cache.data);
    return () => listeners.delete(setW);
  }, []);
  return w;
};

export const WantedTag = ({ c, className = "" }) => (
  <span className={`tag !border-[var(--gold-dim)] !text-[var(--gold)] ${className}`} title={`${c.patron_short} wants this: ${wtText(c.text)}. Hand it in on the Contract Board.`} data-testid="wanted-tag">Wanted</span>
);
