def patch(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:90]); s = s.replace(a, b, 1)
    open(p, 'w').write(s)
F = '/app/frontend/src/'
patch(F + 'App.js', [('import Duel from "./tfl/pages/game/Duel";\n', '')])
# painted icons replace the old pixel-art set everywhere
patch(F + 'tfl/components/PixelIcon.js', [
    ('export function PixelIcon({ name, size = 16, className = "", ...rest }) {\n  const [solid, half] = paths(name);', '''import { Bell, Check, X, Shield, UserMinus, ShieldCheck, Skull, Lamp, MessageSquare, MessageCircle, ThumbsUp, Ghost, Circle, Bug, Settings } from "lucide-react";

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
  const [solid, half] = paths(name);'''),
])
patch(F + 'tfl/components/ui-bits.js', [('<a href="https://policies.google.com/privac', '<span data-href="https://policies.google.com/privac')])
s = open(F + 'tfl/components/ui-bits.js').read()
i = s.index('<span data-href="https://policies.google.com/privac')
j = s.index('</a>', i)
seg = s[i:j + 4]
seg2 = seg.replace('</a>', '</span>')
import re
seg2 = re.sub(r' (target|rel)="[^"]*"', '', seg2)
s = s[:i] + seg2 + s[j + 4:]
s = s.replace('<a href="https://policies.google.com/terms"', '<span data-href="https://policies.google.com/terms"', 1)
open(F + 'tfl/components/ui-bits.js', 'w').write(s)
print('ok')
