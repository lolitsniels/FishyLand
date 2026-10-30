/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { UserSquare2, Frame as FrameIcon } from "lucide-react";
import { api, errMsg } from "../lib/api";
import { useGame } from "../context/GameContext";
import { Pearls } from "./ui-bits";
import { AvatarPicker, Avatar } from "./Avatar";
import { t as tt } from "../i18n";

const TABS = [
  { id: "portrait", label: "Portrait", icon: UserSquare2 },
  { id: "frame", label: "Frame", icon: FrameIcon },
];

// Owner-side picker for everything visible on the profile.
export default function CosmeticsModal({ onClose, tab: initialTab = "portrait", onChanged }) {
  const { user, setUser } = useGame();
  const [cos, setCos] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/cosmetics").then((r) => setCos(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const call = async (path, body, msg) => {
    setBusy(true);
    try { const r = await api.post(path, body); setUser(r.data.user); toast.success(msg); load(); onChanged?.(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const ownedFrames = cos ? cos.frames.filter((f) => f.owned) : [];
  const ownedAvatars = cos ? cos.avatars.filter((a) => a.owned) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-[rgba(0,0,0,.65)] overflow-y-auto p-3" onClick={onClose} data-testid="cosmetics-modal">
      <div className="panel panel-gold w-full max-w-2xl my-3" onClick={(e) => e.stopPropagation()}>
        <header className="panel-head flex items-center justify-between">
          <span>{tt("Change your appearance")}</span>
          <button className="btn btn-sm" onClick={onClose} data-testid="cosmetics-modal-close">{tt("Close")}</button>
        </header>
        <div className="flex gap-1 border-b border-[var(--border)] px-2" data-testid="cosmetics-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 -mb-px inline-flex items-center gap-1.5 ${tab === t.id ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"}`} onClick={() => setTab(t.id)} data-testid={`cosmetics-tab-${t.id}`}><t.icon size={13} />{t.label}</button>
          ))}
        </div>
        <div className={`panel-body space-y-3 ${busy ? "opacity-70 pointer-events-none" : ""}`}>
          {!cos ? <div className="text-[var(--muted)] text-sm italic py-3 text-center">{tt("Loading...")}</div> : (
            <>
              {tab === "portrait" && (
                <>
                  <p className="text-[12.5px] text-[var(--text-2)]">{tt("Portraits you own. Click one to wear it on your profile, in the header and on the rankings.")}</p>
                  <AvatarPicker avatars={ownedAvatars} value={user.avatar} owned={new Set(ownedAvatars.map((a) => a.id))} onChange={(a) => a.id !== user.avatar && call("/cosmetics/avatar", { avatar_id: a.id }, `Portrait set: ${a.name}`)} />
                </>
              )}
              {tab === "frame" && (
                <>
                  <p className="text-[12.5px] text-[var(--text-2)]">{tt("Frames wrap your portrait everywhere it appears. Buy new frames in the Pearl Shop; switch between the ones you own here.")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="cosmetics-frames-grid">
                    <button type="button" className={`panel p-2 flex gap-2 items-center text-left ${!user.frame ? "panel-gold" : ""}`} disabled={!user.frame} onClick={() => call("/cosmetics/frame", { frame_id: null }, "Back to the plain border")} data-testid="cosmetics-frame-none">
                      <Avatar id={user.avatar} size="md" gold />
                      <div className="min-w-0 text-[12px]"><div className="font-display text-[13.5px] text-[#f4ead2]">{tt("Plain border")}</div>{!user.frame ? <div className="text-[11px] text-[var(--gold)]">{tt("In use")}</div> : <div className="text-[11px] text-[var(--muted)]">{tt("Free")}</div>}</div>
                    </button>
                    {ownedFrames.map((f) => (
                      <button type="button" key={f.id} className={`panel p-2 flex gap-2 items-center text-left ${user.frame === f.id ? "panel-gold" : ""}`} disabled={user.frame === f.id} onClick={() => call("/cosmetics/frame", { frame_id: f.id }, `Portrait framed in ${f.name}`)} data-testid={`cosmetics-frame-${f.id}`}>
                        <Avatar id={user.avatar} size="md" frame={f.id} />
                        <div className="min-w-0 text-[12px]"><div className="font-display text-[13.5px] text-[#f4ead2] truncate">{f.name}</div>{user.frame === f.id ? <div className="text-[11px] text-[var(--gold)]">{tt("In use")}</div> : <div className="text-[11px] text-[var(--muted)] truncate">{tt("Owned")}</div>}</div>
                      </button>
                    ))}
                  </div>
                  {ownedFrames.length === 0 && <div className="text-[11.5px] text-[var(--muted)] italic">{tt("You haven't bought any frames yet. The")} <Link to="/game/pearl-shop" className="underline" onClick={onClose}>{tt("Pearl Shop → Frames")}</Link> {tt("has nine to pick from.")}</div>}
                </>
              )}
            </>
          )}
          <div className="text-[12px] text-[var(--text-2)] border-t border-[var(--border)] pt-2 flex flex-wrap items-center justify-between gap-2">
            <span>{tt("Buy new looks in the")} <Link to="/game/pearl-shop" className="underline text-[var(--gold)]" onClick={onClose} data-testid="cosmetics-modal-shop-link">{tt("Pearl Shop")}</Link>.</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-[var(--muted)]">{tt("You have")}</span><Pearls n={user.pearls} /></span>
          </div>
        </div>
      </div>
    </div>
  );
}
