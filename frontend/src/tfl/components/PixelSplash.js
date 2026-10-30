const WATER = ["#e8f7ff", "#9fdcff", "#5fb4e8", "#ffffff"];
const SPARK = { rare: "#7fb8ff", epic: "#c89bff", legendary: "#ffd36b", mythic: "#ff7a5c" };
const rnd = (seed) => { let x = seed; return () => (x = (x * 9301 + 49297) % 233280) / 233280; };

export function PixelSplash({ rarity }) {
  const r = rnd(Math.floor(Math.random() * 100000));
  const drops = Array.from({ length: 16 }, (_, i) => ({
    "--x": `${42 + r() * 16}%`, "--dx": `${(r() - 0.5) * 120}px`, "--h": `${30 + r() * 50}px`,
    "--s": `${r() > 0.6 ? 6 : 4}px`, "--c": WATER[i % WATER.length], "--d": `${Math.round(r() * 160)}ms`,
  }));
  const color = SPARK[rarity];
  const sparks = color ? Array.from({ length: rarity === "mythic" || rarity === "legendary" ? 9 : 5 }, () => ({
    "--x": `${8 + r() * 84}%`, "--y": `${8 + r() * 70}%`, "--c": color, "--d": `${200 + Math.round(r() * 700)}ms`,
  })) : [];
  return (
    <div className="pix-splash" aria-hidden data-testid="pixel-splash">
      <span className="pix-ring" />
      {drops.map((s, i) => <span key={`d${i}`} className="pix-drop" style={s} />)}
      {sparks.map((s, i) => <span key={`s${i}`} className="pix-spark" style={s} data-testid="pixel-spark" />)}
    </div>
  );
}
