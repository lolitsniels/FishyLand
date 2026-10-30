import { ScrollText, CalendarCheck, PartyPopper, Ticket, Trophy } from "lucide-react";
import { Ring } from "../fr";
import { useGame } from "../../store";

const RAIL = [
  { id: "quests", label: "Quests", icon: ScrollText, phase: 3, desc: "Main story chapters with the Angel of the Tides." },
  { id: "daily", label: "Daily", icon: CalendarCheck, phase: 3, desc: "5 daily and 5 weekly quests with chest rewards." },
  { id: "events", label: "Events", icon: PartyPopper, phase: 7, desc: "Deep Sea Hunt, Big Catch weeks and tournaments." },
  { id: "pass", label: "Pass", icon: Ticket, phase: 6, desc: "Fishing Pass season rewards." },
  { id: "ranks", label: "Ranks", icon: Trophy, phase: 7, desc: "BR, Level, Biggest Fish and Guild rankings." },
];

export default function LeftRail() {
  const open = useGame((s) => s.openModal);
  return (
    <div className="flex flex-col gap-2.5 rise" style={{ animationDelay: "0.25s" }} data-testid="left-rail">
      {RAIL.map((r) => (
        <Ring key={r.id} icon={r.icon} label={r.label} size={44} testid={`rail-${r.id}`}
          onClick={() => open({ type: "soon", title: r.label, desc: r.desc, phase: r.phase })} />
      ))}
    </div>
  );
}
