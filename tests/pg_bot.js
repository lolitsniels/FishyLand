() => {
  if (window.__bot) return;
  let held = false;
  const send = (t) => window.dispatchEvent(new KeyboardEvent(t, { code: "Space", key: " ", bubbles: true }));
  window.__bot = setInterval(() => {
    const n = document.querySelector('[data-testid="tension-needle"]');
    const z = document.querySelector('[data-testid="tension-zone-box"],[data-testid="needle-zone"]');
    if (!n || !z) { if (held) { send("keyup"); held = false; } return; }
    const t = parseFloat(n.style.left), zl = parseFloat(z.style.left), zw = parseFloat(z.style.width);
    const want = t < zl + zw * 0.5;
    if (want && !held) { send("keydown"); held = true; }
    if (!want && held) { send("keyup"); held = false; }
  }, 25);
}
