import { X } from "lucide-react";
import { useEffect } from "react";
import { useGame } from "../../store";

export default function Modal({ title, children, width = 720, testid }) {
  const close = useGame((s) => s.closeModal);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [close]);
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-3" onPointerDown={(e) => e.target === e.currentTarget && close()} data-testid={testid}>
      <div className="fr-panel fr-modal rise flex flex-col max-h-[90vh] w-full mt-6" style={{ maxWidth: width }}>
        {["tl", "tr", "bl", "br"].map((c) => <span key={c} className={`fr-corner ${c}`} />)}
        <div className="relative flex items-center justify-center px-12 pt-1 pb-2 border-b-2 border-amber-600/70 bg-gradient-to-b from-amber-900/50 to-transparent">
          <div className="modal-banner relative -mt-7 px-14 py-3 min-w-[260px] text-center" style={{ backgroundImage: "url(art/ui/banner.png)" }}>
            <h2 className="relative gold-text font-deco text-lg md:text-xl font-black tracking-wide whitespace-nowrap">{title}</h2>
          </div>
          <button type="button" onClick={close} data-testid="modal-close-btn"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full grid place-items-center bg-gradient-to-b from-red-600 to-red-900 border-2 border-amber-300 hover:scale-110 transition-transform">
            <X size={16} color="#fff" strokeWidth={3} />
          </button>
        </div>
        <div className="overflow-y-auto scroll-gold p-4">{children}</div>
      </div>
    </div>
  );
}
