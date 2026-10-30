export const itemImg = (id) => `art/items/${id}.png`;

export const Ring = ({ icon: Icon, img, label, onClick, size = 46, dot, dim, testid, color = "#ffe08a", children }) => (

  <button type="button" onClick={onClick} data-testid={testid} className="flex flex-col items-center gap-1 group" title={label}>
    <span className={`fr-ring ${img ? "has-img" : ""} ${dim ? "dim" : ""}`} style={{ width: size, height: size }}>
      {img && <img src={`art/ui/${img}.png`} alt="" draggable={false} className="ring-img" style={{ width: size * 1.08, height: size * 1.08 }} />}
      {!img && Icon && <Icon size={size * 0.46} color={color} strokeWidth={2.2} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />}
      {children}
      {dot && <span className="fr-dot">!</span>}
    </span>
    {label && <span className="font-cinzel text-[10px] font-bold leading-none text-amber-100 outline-text whitespace-nowrap">{label}</span>}
  </button>
);

export const Bar = ({ value, max, color = "linear-gradient(90deg,#1fd3ff,#7ff3ff)", testid, className = "" }) => (
  <div className={`fr-bar ${className}`} data-testid={testid}>
    <i style={{ width: `${Math.min(100, (100 * value) / Math.max(1, max))}%`, background: color }} />
  </div>
);
