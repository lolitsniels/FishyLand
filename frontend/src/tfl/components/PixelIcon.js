import { PIXEL_ICONS } from "./pixelIconData";

const toPath = (rows, ch) => rows.flatMap((r, y) => [...r].map((c, x) => (c === ch ? `M${x} ${y}h1v1h-1z` : ""))).join("");
const cache = {};
const paths = (name) => (cache[name] ||= [toPath(PIXEL_ICONS[name], "#"), toPath(PIXEL_ICONS[name], "o")]);

import { Bell, Check, X, Shield, UserMinus, ShieldCheck, Skull, Lamp, MessageSquare, MessageCircle, ThumbsUp, Ghost, Circle, Bug, Settings } from "lucide-react";

const IMG = {
  coin: "/art/hud/gold.webp", pearl: "/art/hud/pearl.webp", shop: "/art/hud/tackle.webp", harbour: "/art/ui/map.png", waters: "/art/ui/map.png", compass: "/art/ui/map.png",
  fish: "/art/ui/fishdex.png", journal: "/art/ui/fishdex.png", wiki: "/art/ui/fishdex.png", almanac: "/art/ui/fishdex.png", duel: "/art/ui/guild.png",
  quests: "/art/ui/quests.png", contracts: "/art/ui/daily.png", chest: "/art/ui/daily.png", inventory: "/art/ui/inventory.png", bait: "/art/ui/bait.png", worm: "/art/ui/bait.png", net: "/art/ui/bait.png",
  market: "/art/ui/market.png", rankings: "/art/ui/rankings.png", tournaments: "/art/ui/rankings.png", crews: "/art/ui/crew.png", recruit: "/art/ui/crew.png", angler: "/art/ui/crew.png",
  achievements: "/art/ui/skills.png", gear: "/art/ui/rod.png", potion: "/art/ui/craft.png",
};
const VEC = { bell: Bell, check: Check, cross: X, mod: Shield, unfriend: UserMinus, admin: ShieldCheck, skull: Skull, lantern: Lamp, messages: MessageSquare, chat: MessageCircle, vote: ThumbsUp, halloween: Ghost, bobber: Circle, crab: Bug, discord: MessageCircle };

export function PixelIcon({ name, size = 16, className = "", ...rest }) {
  if (IMG[name]) return <img src={IMG[name]} alt="" aria-hidden="true" width={size + 4} height={size + 4} className={`px-icon object-contain shrink-0 ${className}`} style={{ width: size + 4, height: size + 4 }} {...rest} />;
  const V = VEC[name] || (PIXEL_ICONS[name] ? null : Settings);
  if (V) return <V size={size} className={`px-icon ${className}`} aria-hidden="true" {...rest} />;
  const [solid, half] = paths(name);
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" shapeRendering="crispEdges" className={`px-icon ${className}`} aria-hidden="true" {...rest}>
      <path d={solid} /><path d={half} opacity=".45" />
    </svg>
  );
}

// Drop-in replacement for a lucide icon component.
export const pixelIcon = (name) => {
  const C = (p) => <PixelIcon name={name} {...p} />;
  C.displayName = `PixelIcon(${name})`;
  return C;
};
