import { useEffect, useState } from "react";
import { api, ago } from "../../lib/api";
import { Panel, Empty } from "../ui-bits";

export function Doubles({ onPickPlayer }) {
  const [d, setD] = useState(null);
  const [hideGuests, setHideGuests] = useState(false);
  useEffect(() => { api.get("/admin/doubles").then((r) => setD(r.data)).catch(() => {}); }, []);
  if (!d) return <Empty>Loading...</Empty>;
  const groups = hideGuests ? d.groups.map((g) => ({ ...g, members: g.members.filter((m) => !m.guest) })).filter((g) => g.members.length >= 2) : d.groups;
  return (
    <div className="space-y-3" data-testid="admin-doubles">
      <Panel title="Double accounts · same connection" right={<label className="text-[11px] text-[var(--muted)] inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={hideGuests} onChange={(e) => setHideGuests(e.target.checked)} data-testid="doubles-hide-guests" /> hide guests</label>} bodyClass="!p-0" testId="doubles-list">
        <p className="text-[12px] text-[var(--text-2)] p-3 pb-2">Accounts seen from the same connection (IP, stored hashed), at sign-up, at login or while playing. Households and phone + PC will show up here too, so treat it as a lead, not a verdict: look at levels, gold and whether they trade with each other. <b>{groups.length}</b> group{groups.length === 1 ? "" : "s"} · <b>{groups.reduce((n, g) => n + g.members.length, 0)}</b> accounts.</p>
        {groups.length === 0 ? <Empty>No two accounts share a connection.</Empty> : (
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Connection</th><th>Accounts</th><th className="r">Lv</th><th className="r">Gold</th><th className="r">Catches</th><th className="r">Joined</th><th className="r">Last seen</th></tr></thead><tbody>
            {groups.map((g) => g.members.map((m, i) => (
              <tr key={g.key + m.username} className={`${i === 0 ? "border-t-2 border-[var(--border-strong,#3a2f1c)]" : ""} ${g.banned ? "bg-[rgba(217,83,79,.08)]" : ""}`} data-testid={`doubles-${m.username}`}>
                <td className="num text-[11px] text-[var(--muted)] whitespace-nowrap">{i === 0 ? <span title={`connections: ${g.connections.join(", ")}`} data-testid={`doubles-group-${g.key}`}>#{g.key} <span className="text-[var(--text-2)]">×{g.members.length}</span></span> : ""}</td>
                <td className="whitespace-nowrap"><button className="underline decoration-dotted" onClick={() => onPickPlayer(m.username)} data-testid={`doubles-open-${m.username}`}>{m.username}</button>{m.guest && <span className="tag ml-1">guest</span>}{m.admin && <span className="tag ml-1 text-[var(--gold)]">admin</span>}{m.banned && <span className="tag ml-1 text-[#f0a5a3]">banned</span>}{m.current !== m.signup && m.signup && <span className="text-[10px] text-[var(--muted)] ml-1" title={`signed up from #${m.signup}, now on #${m.current}`}>moved</span>}</td>
                <td className="num r text-[var(--text-2)]">{m.level}</td>
                <td className="num r text-[var(--text-2)]">{m.gold.toLocaleString()}</td>
                <td className="num r text-[var(--text-2)]">{m.catches}</td>
                <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{m.created_at ? ago(m.created_at) : "-"}</td>
                <td className="r text-[11px] text-[var(--muted)] whitespace-nowrap">{m.last_seen ? ago(m.last_seen) : "-"}</td>
              </tr>
            )))}
          </tbody></table></div>
        )}
      </Panel>
    </div>
  );
}
