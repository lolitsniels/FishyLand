import { t as tt } from "../../i18n";
import { Tip } from "./shared";

export default function RecruitTips() {
  return (
    <div className="space-y-4 text-[12.5px]" data-testid="recruit-tips-tab">
      <ol className="space-y-3">
        <Tip n="1" title={tt("Start with people you know")}>{tt("Friends, siblings, coworkers and gaming buddies are the recruits who actually stay. A personal message with your link works far better than a public post.")}</Tip>
        <Tip n="2" title={tt("Put your signature everywhere you post")}>{tt("Add your live signature or userbar to every forum you're active on. Each post quietly advertises your angler, and the link recruits for you.")}</Tip>
        <Tip n="3" title={tt("Share your best moments")}>{tt("Legendary and Mythic catches, boss kills and tournament wins make great posts. Use the Share button on the catch card and add your recruit link.")}</Tip>
        <Tip n="4" title={tt("Help your recruits level up")}>{tt("You earn every 10 levels they gain, forever. Invite them to your crew, fish beside them for the friend luck bonus, and point them to the New Player Guide in the Wiki.")}</Tip>
        <Tip n="5" title={tt("Be useful in communities")}>{tt("Answer questions about browser games or fishing games on Reddit and Discord, and mention The Fishing Lands when it fits. Helpful posts get clicks; spam gets you banned there.")}</Tip>
        <Tip n="6" title={tt("Make a short video")}>{tt("A 15-second clip of a boss fight or a big catch on TikTok, YouTube Shorts or Instagram Reels can reach thousands. Put your recruit link in your bio.")}</Tip>
        <Tip n="7" title={tt("Use banners on your own site")}>{tt("Have a blog, stream overlay or gaming site? Drop an animated banner on it from the Banners tab, your link is already inside.")}</Tip>
      </ol>
      <div className="text-[11.5px] text-[var(--muted)] border-t border-[var(--border)] pt-3">{tt("Keep it fair: never spam, never recruit your own alt accounts. Recruits on your network never pay out, and referral abuse leads to an IP ban.")}</div>
    </div>
  );
}
