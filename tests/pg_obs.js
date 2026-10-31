// Records every sonner toast text into window.__toasts (toasts vanish before polling sees them). Evaluate once per page load.
() => {
  if (window.__obs) return;
  window.__toasts = [];
  window.__obs = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    const els = n.matches?.('[data-sonner-toast]') ? [n] : [...(n.querySelectorAll?.('[data-sonner-toast]') || [])];
    els.forEach((e) => setTimeout(() => window.__toasts.push(e.innerText.replace(/\n/g, ' | ')), 50));
  })));
  window.__obs.observe(document.body, { childList: true, subtree: true });
}
