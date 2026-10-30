import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, wt } from "../../lib/api";
import { useGame } from "../../context/GameContext";
import { Panel } from "../../components/ui-bits";
import TensionGame from "../../components/TensionGame";
import { FishPlate } from "../../components/FishPlate";

const MECHS = [["hookset", "Hook set", "mid-fight: brief warning, then strike the gold mark 3 times"], ["needle", "Needle", "sweet spot shrinks to a thread for a few seconds"], ["rhythm", "Rhythm strike", "fight pauses, press when each note is inside the box"]];
const RARS = ["", "common", "uncommon", "rare", "epic", "legendary", "mythic"];

function Testers() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  useEffect(() => { api.get("/admin/testwater").then((r) => setList(r.data.testers)).catch(() => {}); }, []);
  const set = async (username, grant) => {
    try { const r = await api.post("/admin/testwater", { username, grant }); setList(r.data.testers); setName(""); toast.success(grant ? `${username} can use the test water` : `Access removed for ${username}`); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Panel icon="admin" title="Testers" testId="testwater-testers">
      <div className="flex gap-2 mb-2">
        <input className="input" placeholder="Username" value={name} onChange={(e) => setName(e.target.value)} data-testid="testwater-grant-input" />
        <button className="btn btn-gold" disabled={!name.trim()} onClick={() => set(name.trim(), true)} data-testid="testwater-grant-button">Grant</button>
      </div>
      {list.length === 0 ? <div className="text-[12px] text-[var(--muted)]">Only admins so far.</div> : (
        <div className="flex flex-wrap gap-1.5">{list.map((u) => <span key={u} className="tag inline-flex items-center gap-1.5" data-testid={`tester-${u}`}>{u}<button className="text-[#f0a5a3]" onClick={() => set(u, false)} data-testid={`tester-revoke-${u}`}>✕</button></span>)}</div>
      )}
    </Panel>
  );
}

export default function TestWater() {
  const { user } = useGame();
  const [mechs, setMechs] = useState(MECHS.map((m) => m[0]));
  const [rarity, setRarity] = useState("");
  const [fight, setFight] = useState(null);
  const [stage, setStage] = useState("idle");
  const [log, setLog] = useState([]);
  const cast = async () => {
    try {
      const r = await api.post("/testwater/cast", { mechanics: mechs, rarity });
      setFight(r.data); setStage("fight");
    } catch (e) { toast.error(errMsg(e)); }
  };
  const onFinish = useCallback((ok, elapsed, why) => {
    setLog((l) => [{ ...fight?.fish, ok, why, secs: elapsed.toFixed(1) }, ...l].slice(0, 15)); setStage("idle");
  }, [fight]);
  const f = fight?.fish;
  useEffect(() => { if (stage !== "idle") setTimeout(() => document.querySelector("[data-testid=testwater-fish]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50); }, [stage]);
  if (!user.test_water) return <Panel icon="admin" title="Test water"><div className="text-[12.5px]">No access.</div></Panel>;
  return (
    <div className="space-y-3 fade-in" data-testid="testwater-page">
      <Panel icon="waters" title="The Test Water" right={<span className="text-[11.5px]">sandbox · no energy · nothing is kept</span>}>
        <p className="text-[12.5px] text-[var(--text-2)] mb-3">Every fish here uses the mechanics you tick below, at the hardest water's difficulty with your current gear. Landed fish give no gold, XP or catch.</p>
        <div className="grid sm:grid-cols-2 gap-2 mb-3">
          {MECHS.map(([id, label, desc]) => (
            <label key={id} className={`flex items-start gap-2 p-2 border cursor-pointer ${mechs.includes(id) ? "border-[var(--gold)]" : "border-[var(--border)]"}`} data-testid={`mech-${id}`}>
              <input type="checkbox" checked={mechs.includes(id)} disabled={stage !== "idle"} onChange={(e) => setMechs((m) => e.target.checked ? [...m, id] : m.filter((x) => x !== id))} className="mt-1" />
              <span><span className="block text-[13px]">{label}</span><span className="block text-[11.5px] text-[var(--muted)]">{desc}</span></span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="input !w-40" value={rarity} onChange={(e) => setRarity(e.target.value)} disabled={stage !== "idle"} data-testid="testwater-rarity">{RARS.map((r) => <option key={r} value={r}>{r || "any rarity"}</option>)}</select>
          <button className="btn btn-gold btn-lg" onClick={cast} disabled={stage !== "idle"} data-testid="testwater-cast">Cast line</button>
        </div>
      </Panel>
      {stage !== "idle" && f && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px]" data-testid="testwater-fish"><FishPlate speciesId={f.id} name={f.name} className="w-14 h-8" /><span className={`rar-${f.rarity} font-medium`}>{f.name}</span>{f.variant !== "normal" && <span className="tag tag-variant">{f.variant}</span>}<span className="text-[var(--muted)]">{wt(f.weight)} · {f.rarity}</span></div>
          <TensionGame enc={fight.params} onFinish={onFinish} />
        </div>
      )}
      {log.length > 0 && (
        <Panel icon="quests" title="Test log" bodyClass="!p-0" testId="testwater-log">
          <table className="table"><tbody>{log.map((r, i) => <tr key={i}><td><span className={`rar-${r.rarity}`}>{r.name}</span> <span className="text-[var(--muted)] text-[11px]">{r.rarity}</span></td><td className={r.ok ? "text-[var(--ok)]" : "text-[#f0a5a3]"}>{r.ok ? "Landed" : "Lost"}</td><td className="text-[12px] text-[var(--text-2)]">{r.why}</td><td className="r num text-[11px]">{r.secs ? `${r.secs}s` : ""}</td></tr>)}</tbody></table>
        </Panel>
      )}
      {user.is_admin && <Testers />}
    </div>
  );
}
