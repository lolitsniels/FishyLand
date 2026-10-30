import { Children, Fragment, useEffect, useState } from "react";
import { X } from "lucide-react";
import { t as tt } from "../i18n";

const MQ = "(max-width: 1023px)";

export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(MQ).matches);
  useEffect(() => {
    const q = window.matchMedia(MQ), on = () => setM(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return m;
}

// Desktop: renders the panels as they are. Phones: a row of buttons, each opening its panel in a bottom sheet.
export function MobileSheets({ items, testId = "msheets", onOpen }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(null);
  const list = items.filter(Boolean);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!mobile) return <>{list.map((i) => <Fragment key={i.id}>{i.node}</Fragment>)}</>;
  const cur = list.find((i) => i.id === open);
  return (
    <>
      <div className="msheet-bar" style={{ gridTemplateColumns: `repeat(${Math.min(list.length, 4)}, minmax(0, 1fr))` }} data-testid={testId}>
        {list.map(({ id, label, Icon, badge, tone }) => (
          <button key={id} type="button" className="msheet-btn" onClick={() => { setOpen(id); onOpen?.(id); }} data-testid={`${testId}-${id}`}>
            <Icon size={18} /><span className="truncate max-w-full">{tt(label)}</span>
            {badge ? <span className={`msheet-badge num ${tone ? `msheet-badge-${tone}` : ""}`} data-testid={`${testId}-${id}-badge`}>{badge}</span> : null}
          </button>
        ))}
      </div>
      {cur && (
        <div className="msheet" role="dialog" aria-label={tt(cur.label)} data-testid={`${testId}-sheet`}>
          <div className="msheet-backdrop" onClick={() => setOpen(null)} />
          <div className="msheet-panel">
            <div className="msheet-head"><span className="msheet-handle" /><button type="button" className="msheet-close" onClick={() => setOpen(null)} aria-label={tt("Close")} data-testid={`${testId}-close`}><X size={16} /></button></div>
            <div className="msheet-body">{cur.node}</div>
          </div>
        </div>
      )}
    </>
  );
}

// Wraps a column of panels: desktop keeps the column; phones get one button per panel ([label, Icon] per child, in order).
export function MobileGroup({ children, items, className = "space-y-3", testId }) {
  const mobile = useIsMobile();
  const kids = Children.toArray(children).filter(Boolean);
  if (!mobile) return <div className={className}>{kids}</div>;
  return <MobileSheets testId={testId} items={kids.map((node, i) => items[i] && { id: String(i), label: items[i][0], Icon: items[i][1], badge: items[i][2], node })} />;
}

// Desktop: same button bar as the phone sheets, the chosen panel shows right below it.
// initial=null: every tab starts closed. A second click closes a tab unless pinned. inline: fixed-width buttons for wide columns.
export function DeskTabs({ items, testId = "dtabs", initial = null, inline = false, pinned = false, value, onChange, onOpen }) {
  const list = items.filter(Boolean);
  const [own, setOwn] = useState(initial);
  const open = value !== undefined ? value : own;
  const setOpen = onChange || setOwn;
  const cur = list.find((i) => i.id === open);
  const click = (id) => { const next = !pinned && open === id ? null : id; setOpen(next); if (next) onOpen?.(next); };
  const cols = inline ? `repeat(${list.length}, minmax(0, 150px))` : `repeat(${Math.min(list.length, 4)}, minmax(0, 1fr))`;
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="msheet-bar" style={{ gridTemplateColumns: cols }}>
        {list.map(({ id, label, Icon, badge, tone }) => (
          <button key={id} type="button" className={`msheet-btn ${cur?.id === id ? "on" : ""}`} onClick={() => click(id)} aria-pressed={cur?.id === id} data-testid={`${testId}-${id}`}>
            <Icon size={18} /><span className="truncate max-w-full">{tt(label)}</span>
            {badge ? <span className={`msheet-badge num ${tone ? `msheet-badge-${tone}` : ""}`} data-testid={`${testId}-${id}-badge`}>{badge}</span> : null}
          </button>
        ))}
      </div>
      {cur && <div key={cur.id} className="fade-in" data-testid={`${testId}-panel`}>{cur.node}</div>}
    </div>
  );
}

// Phones: bottom-sheet buttons. PC: tab buttons (closed by default).
export function InfoTabs(props) {
  const mobile = useIsMobile();
  return mobile ? <MobileSheets items={props.items} testId={props.testId} onOpen={props.onOpen} /> : <DeskTabs {...props} />;
}
