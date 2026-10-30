import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";
import { initI18n } from "@/tfl/i18n";

initI18n();

// Legacy TFL art that hasn't been redrawn yet falls back to matching 2.5D art instead of a broken icon.
const ART_FALLBACK = [["/art/avatars/", "/art/angler.png"], ["/art/badges/", "/art/ui/daily.png"], ["/art/bosses/", "/art/fish/starwhale.png"], ["/art/leviathans/", "/art/fish/starwhale.png"], ["/art/gear/", "/art/ui/inventory.png"], ["/art/", "/art/ui/banner.png"]];
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img?.tagName !== "IMG" || img.dataset.fb) return;
  const path = new URL(img.src, window.location.href).pathname;
  const hit = ART_FALLBACK.find(([pre]) => path.startsWith(pre));
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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
