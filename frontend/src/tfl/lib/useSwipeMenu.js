import { useEffect } from "react";

// Ancestor that scrolls sideways (tables, banner rows, tabs): swipes there belong to the content, not the menu.
const scrollsX = (el) => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
    if (n.matches?.("input[type=range], [data-no-swipe], .tension-frame")) return true;
  }
  return false;
};

// Mobile: swipe right anywhere to open the menu, swipe left to close it.
export function useSwipeMenu(open, setOpen, enabled) {
  useEffect(() => {
    if (!enabled) return;
    let s = null;
    const start = (e) => {
      const t = e.touches[0];
      const blocked = document.body.classList.contains("fighting") || e.touches.length > 1 || (!open && (scrollsX(e.target) || document.querySelector('[role="dialog"], .chat-expanded')));
      s = blocked ? null : { x: t.clientX, y: t.clientY, at: Date.now() };
    };
    const end = (e) => {
      if (!s) return;
      const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      const quick = Date.now() - s.at < 700, flat = Math.abs(dy) < Math.abs(dx) * 0.6;
      if (quick && flat && dx > 70 && !open) setOpen(true);
      if (quick && flat && dx < -60 && open) setOpen(false);
      s = null;
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    return () => { document.removeEventListener("touchstart", start); document.removeEventListener("touchend", end); };
  }, [open, setOpen, enabled]);
}
