/*
 * FishyLand. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel } from "./ui-bits";
import { t as tt } from "../i18n";
import { useIsMobile } from "./MobileSheets";

function Npc({ n }) {
  const [i, setI] = useState(0);
  useEffect(() => setI(0), [n.lines]);
  return (
    <div className="flex gap-3 min-w-0" data-testid={`npc-${n.id}`}>
      <button className="shrink-0 w-[72px] h-[72px] border border-[var(--gold-dim)] overflow-hidden bg-[var(--bg-2)] hover:border-[var(--gold)]" onClick={() => setI((x) => (x + 1) % n.lines.length)} title={tt("Talk")} data-testid={`npc-talk-${n.id}`}>
        <img src={n.portrait} alt={n.name} className="w-full h-full object-cover" style={{ objectPosition: "center 20%" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[12.5px] text-[#f4ead2] leading-tight">{n.name}</div>
        <div className="label !text-[9.5px] mb-1">{n.role}</div>
        <div className="relative border border-[var(--border-2)] bg-[var(--bg-2)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-2)] italic" data-testid={`npc-line-${n.id}`}>
          <span className="absolute -left-[6px] top-3 w-2.5 h-2.5 rotate-45 bg-[var(--bg-2)] border-l border-b border-[var(--border-2)]" />
          “{n.lines[i]}”
          <button className="not-italic text-[10.5px] text-[var(--muted)] hover:text-[var(--gold)] ml-2" onClick={() => setI((x) => (x + 1) % n.lines.length)}>{tt("more ›")}</button>
        </div>
      </div>
    </div>
  );
}

function MobileDock({ npcs }) {
  const [sel, setSel] = useState(0);
  const [line, setLine] = useState(0);
  const n = npcs[sel];
  const pick = (i) => { if (i === sel) setLine((x) => (x + 1) % n.lines.length); else { setSel(i); setLine(0); } };
  return (
    <div className="space-y-2.5" data-testid="dockside-mobile">
      <div className="grid grid-cols-4 gap-2">{npcs.map((x, i) => (
        <button key={x.id} type="button" onClick={() => pick(i)} className={`text-center space-y-1 ${i === sel ? "" : "opacity-70"}`} data-testid={`npc-talk-${x.id}`}>
          <span className={`block aspect-square border overflow-hidden bg-[var(--bg-2)] ${i === sel ? "border-[var(--gold)] shadow-[0_0_10px_rgba(242,123,53,.35)]" : "border-[var(--gold-dim)]"}`}><img src={x.portrait} alt={x.name} className="w-full h-full object-cover" style={{ objectPosition: "center 20%" }} /></span>
          <span className="block text-[10.5px] leading-tight text-[var(--text-2)] truncate">{x.name.split(" ").slice(-1)[0]}</span>
        </button>
      ))}</div>
      <div className="border border-[var(--border-2)] bg-[var(--bg-2)] px-2.5 py-2 text-[12.5px] text-[var(--text-2)]" data-testid={`npc-line-${n.id}`}>
        <div className="font-display text-[12px] text-[#f4ead2] not-italic">{n.name} <span className="label !text-[9px] ml-1">{n.role}</span></div>
        <div className="italic mt-0.5">“{n.lines[line]}”</div>
      </div>
    </div>
  );
}

export default function Dockside() {
  const mobile = useIsMobile();
  const [d, setD] = useState(null);
  useEffect(() => {
    const load = () => api.get("/npcs").then((r) => setD(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 120000);
    return () => clearInterval(t);
  }, []);
  if (!d) return null;
  return (
    <Panel icon="chat" title={tt("Dockside")} right={<span>{mobile ? tt("tap a face") : tt("click a face to talk")}</span>} testId="dockside">
      <div className="text-[12px] text-[var(--text-2)] mb-3 flex items-center gap-2 flex-wrap" data-testid="dockside-contracts-hint">{tt("The patrons post delivery orders on the")} <Link to="/game/contracts" className="underline text-[var(--gold)]" data-testid="dockside-contracts-link">{tt("Contract Board")}</Link>{tt(": fill them for gold, Pearls and favour.")}</div>
      {mobile ? <MobileDock npcs={d.npcs} /> : <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">{d.npcs.map((n) => <Npc key={n.id} n={n} />)}</div>}
    </Panel>
  );
}
