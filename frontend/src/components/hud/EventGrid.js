import { Gem, Disc3, Feather, PawPrint, Repeat, Store, BadgeCheck, CalendarDays, Timer, Ticket, Gift, Crown, Rocket, TrendingUp, Sparkles, Clock } from "lucide-react";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Ring } from "../fr";
import { useGame } from "../../store";

export const EVENTS = [
  { id: "treasure", label: "Treasure", icon: Gem, color: "#ff7ad9", phase: 6, desc: "Draw rare wings, rod skins and pets with published odds and a pity counter." },
  { id: "wheel", label: "Lucky Wheel", icon: Disc3, color: "#ffd34d", phase: 6, desc: "One free spin every day, more with VIP." },
  { id: "wings", label: "Wings", icon: Feather, color: "#ffffff", phase: 5, desc: "Star-up your wings with feathers. Each tier is a new look and more BR." },
  { id: "pets", label: "Pets", icon: PawPrint, color: "#7ff3ff", phase: 5, desc: "Feed and evolve pets for passive fishing buffs." },
  { id: "exchange", label: "Exchange", icon: Repeat, color: "#9dff9d", phase: 7, desc: "Trade event tokens for rare items." },
  { id: "mall", label: "Mall", icon: Store, color: "#ffb347", phase: 6, desc: "Diamond shop with daily limited deals." },
  { id: "permit", label: "Angel Permit", icon: BadgeCheck, color: "#ffe08a", phase: 6, desc: "Monthly card: diamonds every day for 30 days + auto-fishing." },
  { id: "events", label: "Events", icon: CalendarDays, color: "#c9a7ff", phase: 7, desc: "Calendar of all live events (server time, UTC)." },
  { id: "offer", label: "Limited", icon: Timer, color: "#ff6b6b", phase: 6, desc: "Time-limited bundles." },
  { id: "pass", label: "Fish Pass", icon: Ticket, color: "#5ee3ff", phase: 6, desc: "50-tier season pass with free and premium tracks." },
  { id: "daily", label: "Daily Gift", icon: Gift, color: "#ff9de6", phase: 7, desc: "7/30-day login calendar." },
  { id: "boss", label: "Ocean Lord", icon: Crown, color: "#ffcc33", phase: 7, desc: "World boss twice daily. Everyone reels one giant fish together." },
  { id: "launch", label: "Launch", icon: Rocket, color: "#ff8a5c", phase: 7, desc: "Server Launch: 7 days of gifts and a BR race." },
  { id: "invest", label: "Investment", icon: TrendingUp, color: "#7dffb3", phase: 6, desc: "Pay once, collect returns at level milestones." },
  { id: "spirit", label: "Spirit", icon: Sparkles, color: "#e7a6ff", phase: 5, desc: "Discounted spirit and pet shards." },
  { id: "online", label: "Online Gift", icon: Clock, color: "#a6f0ff", phase: 7, desc: "Chests after 5/15/30/60 minutes online today." },
];

const PER_PAGE = 16;

export default function EventGrid({ compact }) {
  const open = useGame((s) => s.openModal);
  const [page, setPage] = useState(0);
  const [fan, setFan] = useState(false);
  if (compact && !fan) return <Ring icon={Sparkles} color="#ffd34d" label="Events" size={48} testid="events-fan-toggle" onClick={() => setFan(true)} />;
  const pages = Math.ceil(EVENTS.length / PER_PAGE);
  const items = EVENTS.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  return (
    <div className="flex items-center gap-1 rise" style={{ animationDelay: "0.1s" }} data-testid="event-grid">
      {pages > 1 && <button type="button" onClick={() => setPage((page + pages - 1) % pages)} className="text-amber-300"><ChevronLeft /></button>}
      <div className="grid grid-cols-8 gap-x-2 gap-y-1.5">
        {items.map((e) => (
          <Ring key={e.id} icon={e.icon} color={e.color} label={e.label} size={42} testid={`event-icon-${e.id}`}
            onClick={() => open({ type: "soon", title: e.label, desc: e.desc, phase: e.phase })} />
        ))}
      </div>
      {pages > 1 && <button type="button" onClick={() => setPage((page + 1) % pages)} className="text-amber-300"><ChevronRight /></button>}
      {compact && <button type="button" onClick={() => setFan(false)} className="text-amber-300 font-cinzel text-sm ml-1" data-testid="events-fan-close">✕</button>}
    </div>
  );
}
