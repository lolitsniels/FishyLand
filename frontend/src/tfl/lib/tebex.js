// Tebex.js (embedded checkout popup) is loaded on demand. Only anglers who actually press Buy pay for the script.
export const loadTebexJs = () => new Promise((resolve) => {
  if (window.Tebex?.checkout) return resolve(true);
  if (document.getElementById("tebex-js")) { const t = setInterval(() => { if (window.Tebex?.checkout) { clearInterval(t); resolve(true); } }, 100); setTimeout(() => { clearInterval(t); resolve(!!window.Tebex?.checkout); }, 6000); return; }
  const s = document.createElement("script"); s.id = "tebex-js"; s.src = "https://js.tebex.io/v/1.js"; s.async = true;
  s.onload = () => resolve(!!window.Tebex?.checkout); s.onerror = () => resolve(false);
  document.head.appendChild(s);
});

