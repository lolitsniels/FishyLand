import { useState } from "react";
import { toast } from "sonner";
import { rewardedSupported, showRewarded } from "../offline/bridge";
import { useGame as useTfl } from "../tfl/context/GameContext";

// Offline build only: opt-in rewarded ad for bonus energy, hidden when the platform has no rewarded ads.
export function AdEnergy({ u }) {
  const { setUser } = useTfl();
  const [busy, setBusy] = useState(false);
  if (!rewardedSupported() || u.energy >= u.max_energy * 0.5) return null;
  const watch = async () => {
    setBusy(true);
    const ok = await showRewarded("energy");
    setBusy(false);
    if (!ok) { toast("No reward this time. The ad didn't finish."); return; }
    const { adEnergy, AD_ENERGY } = await import("../offline/server");
    setUser(adEnergy());
    toast.success(`+${AD_ENERGY} energy. Tight lines!`);
  };
  return (
    <button type="button" disabled={busy} onClick={watch} className="img-pill-dark absolute right-3 top-[120px] px-4 py-1.5 pointer-events-auto text-[13px] !min-w-0" data-testid="ad-energy-btn">
      Watch an ad: +30 energy
    </button>
  );
}
