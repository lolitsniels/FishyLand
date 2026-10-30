export const itemImg = (id) => `art/items/${id}.png`;

// Ornate square gold tile with a painted icon that pops out of the frame.
export const Ring = ({ icon: Icon, img, label, onClick, size = 46, dot, dim, testid, color = "#ffe08a", children }) => (
  <button type="button" onClick={onClick} data-testid={testid} className="fr-tile-btn flex flex-col items-center gap-1 group" title={label}>
    <span className={`fr-tile ${dim ? "dim" : ""}`} style={{ width: size * 1.18, height: size * 1.18 }}>
      {img && <img src={img.includes("/") ? img : `art/ui/${img}.png`} alt="" draggable={false} className="tile-img" style={{ width: size * 1.22, height: size * 1.22 }} />}
      {!img && Icon && <Icon size={size * 0.5} color={color} strokeWidth={2.2} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />}
      {children}
      {dot && <span className="fr-dot">!</span>}
    </span>
    {label && <span className="fr-tile-label">{label}</span>}
  </button>
);

export const Bar = ({ value, max, color = "linear-gradient(90deg,#1fd3ff,#7ff3ff)", testid, className = "" }) => (
  <div className={`fr-bar ${className}`} data-testid={testid}>
    <i style={{ width: `${Math.min(100, (100 * value) / Math.max(1, max))}%`, background: color }} />
  </div>
);
