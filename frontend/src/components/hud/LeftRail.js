import { Ring } from "../fr";
import { useGame } from "../../store";

export const RAIL = [
  { id: "quests", label: "Quests", img: "quests", phase: 3, desc: "Main story chapters with the Angel of the Tides." },
  { id: "daily", label: "Daily", img: "daily", phase: 3, desc: "5 daily and 5 weekly quests with chest rewards." },
  { id: "events", label: "Events", img: "skills", phase: 7, desc: "Deep Sea Hunt, Big Catch weeks and tournaments." },
  { id: "pass", label: "Pass", img: "pass", phase: 6, desc: "Fishing Pass season rewards." },
  { id: "ranks", label: "Ranks", img: "rankings", phase: 7, desc: "BR, Level, Biggest Fish and Guild rankings." },
];

export default function LeftRail() {
  const open = useGame((s) => s.openModal);
  return (
    <div className="flex flex-col gap-2.5 rise" style={{ animationDelay: "0.25s" }} data-testid="left-rail">
      {RAIL.map((r) => (
        <Ring key={r.id} img={r.img} label={r.label} size={50} testid={`rail-${r.id}`}
          onClick={() => open({ type: "soon", title: r.label, desc: r.desc, phase: r.phase })} />
      ))}
    </div>
  );
}
