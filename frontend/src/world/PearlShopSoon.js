import { useState } from "react";
import { useGame } from "../tfl/context/GameContext";
import { lookSprite } from "../game/look";
import { ShopFrame, ShopBanner, SideDeal } from "../tfl/components/ShopFrame";

const TABS = [["outfits", "Outfits"], ["skins", "Rod Skins"], ["pets", "Pets"], ["emotes", "Emotes"]];
const EARN = [["quests", "Daily quests", "A few pearls for each daily set"], ["rankings", "Tournaments", "Top finishers win pearls"], ["skills", "Achievements", "Milestones pay out pearls"], ["daily", "Login chest", "Open it every day"]];

// Pearl Shop: cosmetics only, pearls are earned in game. The catalogue is not stocked yet.
export default function PearlShop() {
  const { user } = useGame();
  const [tab, setTab] = useState("outfits");
  const side = (
    <>
      <div className="sf-side-h">How to earn pearls</div>
      {EARN.map(([ic, n, sub]) => <SideDeal key={n} testid={`pearl-earn-${ic}`} img={`/art/ui/${ic}.png`} name={n} sub={sub} />)}
    </>
  );
  return (
    <div className="fade-in" data-testid="pearl-shop-soon">
      <ShopFrame testid="pearl-shop" tabs={TABS} value={tab} onChange={setTab} side={side} wallet={{ pearls: user.pearls || 0 }}>
        <ShopBanner testid="pearl-shop-feature" kicker="Cosmetics only" title="Make your angler your own" bg="/art/harbour_wide.jpg" img={`/${lookSprite(user.avatar)}`}
          sub="Pearls are earned by fishing, quests and events, never bought, and they only ever buy looks." />
        <div className="sf-empty" data-testid="pearl-shop-empty">
          <div className="sf-banner-t !text-lg">{TABS.find(([id]) => id === tab)[1]} arrive soon</div>
          <p className="sf-item-sub mt-1">Keep saving: you have <b className="text-[#e8d6ae]" data-testid="pearl-balance">{(user.pearls || 0).toLocaleString()}</b> pearls.</p>
        </div>
      </ShopFrame>
    </div>
  );
}
