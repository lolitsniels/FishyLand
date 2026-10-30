import { X } from "lucide-react";
import { useEffect } from "react";
import { useGame } from "../../store";

export default function Modal({ title, children, width = 720, testid, onClose }) {
  const storeClose = useGame((s) => s.closeModal);
  const close = onClose || storeClose;
  useEffect(() => {
    const k = (e) => {
      if (e.key !== "Escape") return;
      const nested = document.querySelector(".fixed.inset-0.z-50");
      if (nested) nested.click(); else if (!document.querySelector('[role="dialog"]')) close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);
  return (
    <div className="absolute inset-0 z-50 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center bg-black/60 backdrop-blur-sm p-0 sm:p-3" onPointerDown={(e) => e.target === e.currentTarget && close()} data-testid={testid}>
      <div className="fr-panel fr-modal rise flex flex-col w-full h-full sm:h-auto max-h-full sm:max-h-[90vh] mt-0 sm:mt-6 !rounded-none sm:!rounded-[6px]" style={{ maxWidth: width }}>
        {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`fr-corner ${c}`} />)}
        <div className="fr-modal-head relative flex items-center justify-center px-12 pt-1 pb-2">
          <div className="modal-banner relative mt-1 sm:-mt-7 px-14 py-3 min-w-[220px] sm:min-w-[260px] text-center" style={{ backgroundImage: "url(art/ui/banner.png)" }}>
            <h2 className="relative gold-text font-deco text-lg md:text-xl font-black tracking-wide whitespace-nowrap">{title}</h2>
          </div>
          <button type="button" onClick={close} data-testid="modal-close-btn"
            className="fr-modal-x absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain scroll-gold p-2.5 sm:p-4 flex-1 min-h-0" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }} data-testid="modal-scroll">{children}</div>
      </div>
    </div>
  );
}
