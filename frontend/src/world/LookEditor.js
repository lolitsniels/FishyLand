import { Pencil } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { api, errMsg } from "../tfl/lib/api";
import { useGame } from "../tfl/context/GameContext";
import { CharacterPicker } from "./CharacterPicker";

// "Change look" button + dialog on your own profile.
export function LookEditor() {
  const { user, setUser } = useGame();
  const [open, setOpen] = useState(false);
  const [look, setLook] = useState(user.avatar);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { const r = await api.post("/me/look", { avatar: look }); setUser(r.data.user); toast.success("Looking sharp!"); setOpen(false); }
    catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };
  return (
    <>
      <button type="button" title="Change look" aria-label="Change look" className="look-edit-btn absolute -right-1 bottom-1 z-[2]" onClick={() => { setLook(user.avatar); setOpen(true); }} data-testid="change-look-button"><Pencil size={15} /></button>
      {open && createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-3" onClick={(e) => e.target === e.currentTarget && setOpen(false)} data-testid="look-dialog">
          <div className="fr-panel fr-modal p-5 w-full max-w-[420px] rise">
            <h3 className="font-deco gold-text text-lg text-center mb-4">Your angler</h3>
            <CharacterPicker value={look} onChange={setLook} testid="look-picker" />
            <p className="text-[11px] text-amber-100/60 mt-3">Outfits, rod skins and pets will arrive in the Pearl Shop later.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="fr-btn fr-btn-dark px-4 py-1.5 text-sm" onClick={() => setOpen(false)} data-testid="look-cancel">Cancel</button>
              <button type="button" className="fr-btn px-5 py-1.5 text-sm" disabled={busy || look === user.avatar} onClick={save} data-testid="look-save">{busy ? "Saving…" : "Save look"}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
