import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { Panel } from "../ui-bits";

const pct = (v) => (v == null ? "-" : `${v}%`);

function summary(s) {
  const r = s.retention;
  return [
    `The Fishing Lands (thefishinglands.com), browser fishing MMO. Stats from our server, ${s.generated_at.slice(0, 10)}:`,
    `- MAU (unique players, last 30 days): ${s.mau}`,
    `- DAU: ${s.dau_7} average over the last 7 days, ${s.dau_30} over 30 days (peak ${s.dau_peak})`,
    `- WAU: ${s.wau}  |  DAU/MAU: ${pct(s.stickiness)}`,
    `- Retention (new players who played): D1 ${pct(r.d1.exact)}, D7 ${pct(r.d7.exact)}, D30 ${pct(r.d30.exact)}`,
    `  (returned on day N or later: D1 ${pct(r.d1.rolling)}, D7 ${pct(r.d7.rolling)}, D30 ${pct(r.d30.rolling)})`,
    `- Average playtime per daily player: ${s.playtime_min_per_dau ?? "-"} min/day, ${s.sessions_per_day ?? "-"} sessions/day, average session ${s.session_min ?? "-"} min`,
    `- Registered accounts: ${s.accounts}`,
  ].join("\n");
}

function Stat({ label, value, hint, id }) {
  return (
    <div className="border border-[var(--border)] px-3 py-2 min-w-[120px]" data-testid={`pstat-${id}`}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
      <div className="text-[20px] num text-[var(--gold)] leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function PlatformStats() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(false);
  const load = (fresh) => { setErr(false); setS(null); api.get("/admin/platform-stats", { params: fresh ? { fresh: 1 } : {}, timeout: 120000 }).then((r) => setS(r.data)).catch(() => setErr(true)); };
  useEffect(() => { load(false); }, []);
  const copy = () => navigator.clipboard.writeText(summary(s)).then(() => toast.success("Copied, paste it into your reply")).catch(() => toast.error("Could not copy"));
  const r = s?.retention;
  return (
    <Panel title="Platform stats (for distributors)" testId="platform-stats"
      right={s && <span className="flex gap-1"><button type="button" className="btn btn-sm" onClick={() => load(true)} data-testid="platform-stats-refresh">Refresh</button><button type="button" className="btn btn-sm" onClick={copy} data-testid="platform-stats-copy">Copy as text</button></span>}>
      {err ? <div className="text-[12px] text-[#f0a5a3]" data-testid="platform-stats-error">Could not load the stats. <button type="button" className="underline" onClick={() => load(false)}>Try again</button></div>
        : !s ? <div className="text-[12px] text-[var(--muted)]">Crunching the numbers...</div> : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Stat id="mau" label="MAU" value={s.mau} hint="last 30 days" />
            <Stat id="dau" label="DAU" value={s.dau_7} hint={`7-day avg · 30d ${s.dau_30} · peak ${s.dau_peak}`} />
            <Stat id="wau" label="WAU" value={s.wau} hint={`DAU/MAU ${pct(s.stickiness)}`} />
            <Stat id="d1" label="D1 retention" value={pct(r.d1.exact)} hint={`${r.d1.cohort} new players`} />
            <Stat id="d7" label="D7 retention" value={pct(r.d7.exact)} hint={`${r.d7.cohort} new players`} />
            <Stat id="d30" label="D30 retention" value={pct(r.d30.exact)} hint={`${r.d30.cohort} new players`} />
            <Stat id="playtime" label="Playtime" value={`${s.playtime_min_per_dau ?? "-"} min`} hint={`per player per day · ${s.sessions_per_day ?? "-"} sessions`} />
          </div>
          <p className="text-[11px] text-[var(--muted)]">Active = landed at least one fish that day. Built from the catch log since {s.history_from || "-"}; banned players are left out. Retention counts new players who came back exactly on day 1, 7 and 30.</p>
        </div>
      )}
    </Panel>
  );
}
