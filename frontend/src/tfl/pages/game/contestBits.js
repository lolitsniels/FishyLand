import { fmt, wt } from "../../lib/api";
import { Pearls } from "../../components/ui-bits";
import { t as tt } from "../../i18n";

export const contestVal = (unit, v) => (unit === "kg" ? wt(v) : `${fmt(v)} ${unit}`);

export const PrizeRow = ({ c, shared }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 py-1.5 text-[11.5px] text-[var(--muted)] border-b border-[var(--border)]" data-testid={`contest-prizes-${c.kind}-${c.category}`}>
    {c.prizes.map((p, i) => <span key={i}>{["1st", "2nd", "3rd"][i]} <span className="num text-[#ffcfa8]">{fmt(p)}g</span>{shared && <span className="text-[10.5px]"> {shared}</span>}{c.pearls?.[i] ? <> + <Pearls n={c.pearls[i]} className="text-[11px]" />{shared && <span className="text-[10.5px]"> {tt("each")}</span>}</> : null}{i === 0 && c.title && <span className="ml-1 text-[var(--gold)]">{tt("+ title \"")}{c.title}"</span>}</span>)}
  </div>
);
