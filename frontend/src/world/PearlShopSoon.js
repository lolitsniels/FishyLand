import { useGame } from "../tfl/context/GameContext";
import { lookSprite } from "../game/look";

// Pearl Shop placeholder: cosmetics (outfits, wings, pets) are coming; pearls are only earned in game.
export default function PearlShopSoon() {
  const { user } = useGame();
  return (
    <div className="g-hero p-5 flex items-end gap-5 !min-h-[240px]" style={{ backgroundImage: "url(/art/harbour_wide.jpg)", backgroundPosition: "30% 60%" }} data-testid="pearl-shop-soon">
      <img src={`/${lookSprite(user.avatar)}`} alt="" className="h-[190px] w-auto drop-shadow-[0_6px_8px_rgba(0,0,0,.7)]" />
      <div className="pb-2">
        <div className="font-deco gold-text text-2xl">Coming soon</div>
        <p className="text-sm text-amber-50/85 mt-2 max-w-md">Outfits, wings and pets to make your angler your own will arrive here. Pearls are earned by fishing, quests and events, never bought, and only ever buy looks.</p>
        <div className="mt-3 fr-chip inline-block px-3 py-1 font-cinzel text-sm" data-testid="pearl-balance">You have {(user.pearls || 0).toLocaleString()} pearls saved</div>
      </div>
    </div>
  );
}
