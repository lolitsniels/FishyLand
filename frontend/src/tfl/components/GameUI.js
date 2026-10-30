import { t as tt } from "../i18n";

export const tierRarity = (t = 1) => (t >= 11 ? "mythic" : t >= 9 ? "legendary" : t >= 7 ? "epic" : t >= 5 ? "rare" : t >= 3 ? "uncommon" : "common");

// Ring-icon tab strip used by every rebuilt menu.
export function GameTabs({ tabs, value, onChange, testid }) {
  return (
    <div className="g-tabs" role="tablist" data-testid={testid}>
      {tabs.map(([id, label, img, count]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} className={`g-tab ${value === id ? "on" : ""}`} onClick={() => onChange(id)} data-testid={`${testid}-${id}`}>
          <img src={img.includes("/") ? `/art/${img}` : `/art/ui/${img}.png`} alt="" />
          <span>{tt(label)}</span>
          {count != null && <span className="cnt">{count}</span>}
        </button>
      ))}
    </div>
  );
}

// Equipped item well (rod, reel, line, bait) for the Tackle Box loadout bar.
export function Slot({ cap, id, name, rarity, onClick, testid, children }) {
  return (
    <button type="button" className={`g-slot rc-${rarity || "common"}`} onClick={onClick} data-testid={testid}>
      <span className="cap">{cap}</span>
      <span className="well">{id ? <img src={`/art/gear/${id}.webp`} alt={name} onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="text-[var(--muted)] text-xs">{tt("empty")}</span>}</span>
      <span className="nm">{name || "-"}</span>
      {children}
    </button>
  );
}
