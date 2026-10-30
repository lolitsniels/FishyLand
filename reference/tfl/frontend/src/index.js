/*
 * The Fishing Lands. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { applyModes, trackKeyboard } from "@/lib/modes";
import "@/index.css";
applyModes();
trackKeyboard();
window.addEventListener("prefs-changed", applyModes);
import App from "@/App";
import { initI18n } from "@/i18n";
import { PORTAL, initPortal } from "@/lib/portal";
initPortal();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
initI18n().then(() => root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
));

// Register the service worker so the browser can offer the "Install app" prompt.
if ("serviceWorker" in navigator && !PORTAL) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
