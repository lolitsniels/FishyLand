import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { t as tt } from "../../i18n";

export const recruitLink = (code) => `${window.location.origin}/?ref=${code}`;

export function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = async (id, text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); toast.success(tt("{{v0}} copied", { v0: label })); setTimeout(() => setCopied(""), 1500); }
    catch { toast.error(tt("Could not copy, select it by hand")); }
  };
  return [copied, copy];
}

export const CopyField = ({ id, value, label, copied, copy, testId, gold }) => (
  <div className="flex flex-wrap items-center gap-2">
    <input readOnly className="input !w-auto flex-1 min-w-[200px] num text-[11px]" value={value} onFocus={(e) => e.target.select()} data-testid={`${testId}-input`} />
    <button className={`btn btn-sm inline-flex items-center gap-1 ${gold ? "btn-gold" : ""}`} onClick={() => copy(id, value, label)} data-testid={`${testId}-copy`}>{copied === id ? <Check size={12} /> : <Copy size={12} />} {tt("Copy")} {label}</button>
  </div>
);

export const Tip = ({ n, title, children }) => (
  <li className="flex gap-2.5"><span className="num font-display text-[15px] text-[var(--gold)] w-5 shrink-0">{n}</span><div><b className="text-[#f4ead2]">{title}</b><div className="text-[var(--text-2)]">{children}</div></div></li>
);
