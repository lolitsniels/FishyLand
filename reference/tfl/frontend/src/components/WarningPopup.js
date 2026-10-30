import { useState } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";
import { useGame } from "../context/GameContext";
import { t as tt } from "../i18n";

export function WarningPopup() {
  const { user, setUser } = useGame();
  const [busy, setBusy] = useState(false);
  const w = user?.warning;
  if (!w) return null;
  const ack = async () => {
    setBusy(true);
    try { const r = await api.post("/warning/ack"); setUser({ ...user, ...r.data.user }); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-[rgba(0,0,0,.78)] p-3" data-testid="warning-overlay">
      <div className="panel panel-gold w-full max-w-sm p-5 space-y-3" role="alertdialog" aria-modal="true" data-testid="warning-dialog">
        <div className="font-display text-[17px] text-[#f0a5a3]">{tt("Official warning")}</div>
        <p className="text-[12.5px] text-[var(--text-2)]">{tt("The harbour staff has issued you a warning:")}</p>
        <blockquote className="border-l-2 border-[#f0a5a3] pl-3 text-[13px] text-[#f4ead2] break-words" data-testid="warning-reason">{w.reason}</blockquote>
        <p className="text-[11.5px] text-[var(--muted)]">{tt("Further rule breaks can lead to a mute or ban.")}</p>
        <button className="btn btn-gold w-full" disabled={busy} onClick={ack} data-testid="warning-ack-button">{tt("I understand")}</button>
      </div>
    </div>
  );
}
