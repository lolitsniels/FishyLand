p = '/app/frontend/src/tfl/pages/game/Crews.js'
s = open(p).read()
a = s.index('const left = (end) => {'); b = s.index('function CreateCrew(')
s = s[:a] + s[b:]
R = [
('import { contestVal, PrizeRow } from "./contestBits";\n', ''),
('import { t as tt } from "../../i18n";', 'import { t as tt } from "../../i18n";\nimport { fx } from "../../../game/fx";'),
('        {cur === "contest" && <CrewChallenges myCrewId={mine?.id} focusCrewId={crew.id} />}\n', ''),
('''  if (id && crew) {
    const isLeader''', '''  if (id && crew) {
    if (!onIsland) {
      // harbour Crew HQ: public crew card only; running the crew happens in the island clubhouse
      return (
        <div className="space-y-3 fade-in" data-testid="crew-detail-page">
          {mine?.id === crew.id && <SailBtn />}
          <CrewHome crew={crew} member={false} mine={mine} onJoin={() => act(`/crews/${crew.id}/join`, `You joined ${crew.name}`)} onRequest={() => apply(crew)} />
        </div>
      );
    }
    const isLeader'''),
('''      {user.crew && <button type="button" className="btn btn-gold w-full" onClick={() => window.dispatchEvent(new CustomEvent("fr-mode", { detail: "crew" }))} data-testid="go-crew-island">{tt("Sail to your crew island")}</button>}
        <div className="panel px-3 py-2''', '''        <div className="panel px-3 py-2'''),
('''{cur === "home" && <CrewHome crew={crew}''', '''{cur === "home" && <CrewHome island crew={crew}'''),
('''      {user.crew && <button type="button" className="btn btn-gold w-full" onClick={() => window.dispatchEvent(new CustomEvent("fr-mode", { detail: "crew" }))} data-testid="go-crew-island">{tt("Sail to your crew island")}</button>}
      <Panel icon="crews" title={tt("Crews")} right={<span className="num">{tt("weekly contest ends in")} {Math.max(0, Math.floor((new Date(d.week_end) - Date.now()) / 3600000))}h</span>}>''', '''      {user.crew && <SailBtn />}
      <Panel icon="crews" title={tt("Crews")}>'''),
('''data-testid="my-crew-link">[{mine.tag}] {mine.name}</button></div>''', '''data-testid="my-crew-link">[{mine.tag}] {mine.name}</button>. {tt("Members, settings and crew tools are in the clubhouse on your crew island.")}</div>'''),
('''<Panel icon="rankings" title={tt("Crew standings · this week")} bodyClass="!p-0" testId="crew-standings">''', '''<Panel icon="crews" title={tt("All crews")} bodyClass="!p-0" testId="crew-standings">'''),
('''<thead><tr><th></th><th>{tt("Crew")}</th><th>{tt("Leader")}</th><th className="r">{tt("Members")}</th><th className="r">{tt("Wins")}</th><th className="r">{tt("Weekly")} {weightUnit()}</th><th></th></tr></thead>''', '''<thead><tr><th>{tt("Crew")}</th><th>{tt("Leader")}</th><th className="r">{tt("Members")}</th><th className="r">{tt("Joining")}</th><th></th></tr></thead>'''),
('''              <td className="num text-[var(--muted)] w-8">{i + 1}</td>\n''', ''),
('''{d.crews.map((c, i) => <tr''', '''{d.crews.map((c) => <tr'''),
('''<td className="num r">{c.wins}</td><td className="num r text-[#ffcfa8]">{kg(c.weekly_kg)}</td>''', '''<td className="r text-[12px]">{c.open ? tt("Open") : tt("Invite only")}</td>'''),
('''  if (!d) return null;
  const mine = user.crew;''', '''  const mine = user.crew;
  const onIsland = fx.mode === "crew";
  useEffect(() => { if (onIsland && mine && !id) nav(`/game/crews/${mine.id}`, { replace: true }); }, [onIsland, mine, id]); // eslint-disable-line
  if (!d) return null;'''),
('export default function Crews() {', '''const SailBtn = () => <button type="button" className="btn btn-gold w-full" onClick={() => window.dispatchEvent(new CustomEvent("fr-mode", { detail: "crew" }))} data-testid="go-crew-island">{tt("Sail to your crew island")}</button>;

export default function Crews() {'''),
('import { api, errMsg, fmt, kg, wt, weightUnit, ago } from "../../lib/api";', 'import { api, errMsg, fmt, wt, ago } from "../../lib/api";'),
]
for x, y in R:
    assert x in s, x[:60]
    s = s.replace(x, y)
open(p, 'w').write(s)
print("ok")
