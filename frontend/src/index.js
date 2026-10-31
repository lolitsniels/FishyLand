import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { initI18n } from "@/tfl/i18n";
import { OFFLINE, initBridge, onPlatformPause, ls } from "@/offline/bridge";
import { useGame } from "@/store";

// Legacy TFL art that hasn't been redrawn yet falls back to matching 2.5D art instead of a broken icon.
const ART_FALLBACK = [["/art/avatars/", "/art/angler.png"], ["/art/badges/", "/art/ui/daily.png"], ["/art/bosses/", "/art/fish/starwhale.png"], ["/art/leviathans/", "/art/fish/starwhale.png"], ["/art/gear/", "/art/ui/inventory.png"], ["/art/", "/art/ui/banner.png"]];
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img?.tagName !== "IMG" || img.dataset.fb) return;
  const path = new URL(img.src, window.location.href).pathname;
  const hit = ART_FALLBACK.find(([pre]) => path.includes(pre));
  if (hit) { img.dataset.fb = "1"; img.src = hit[1]; }
}, true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

async function start() {
  if (OFFLINE) {
    try { await initBridge(); } catch { /* no platform: Bridge falls back to a mock */ }
    const { boot } = await import("@/offline/server");
    await boot();
    ls.setItem("owo_token", "offline");
    onPlatformPause((paused, muted) => useGame.setState({ paused, platformMuted: muted }));
    // Esc belongs to the browser's full-screen exit on portals
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") e.stopImmediatePropagation(); }, true);
    document.addEventListener("contextmenu", (e) => e.preventDefault());
  }
  initI18n();
  const root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
  );
}
start();
