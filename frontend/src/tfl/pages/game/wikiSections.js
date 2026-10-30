/*
 * Fishing Realms. Copyright © 2026. All rights reserved.
 * This source code is proprietary and confidential. Unauthorized copying, reproduction,
 * modification, distribution or use of this file, in whole or in part, via any medium,
 * is strictly prohibited without prior written permission from the owner.
 */
import { Link } from "react-router-dom";
import { fmt, wtRange, weightUnit } from "../../lib/api";
import { Rarity } from "../../components/ui-bits";
import { t as tt } from "../../i18n";

const SPIN_KIND = { gold: "Gold", xp: "XP", bait: "Live Bait", crafted: "Random crafted bait", ingredient: "Random ingredient", scrap: "Tackle scrap", potion: "Energy Potion", pearls: "Pearls", crate_bronze: "Bronze Crate", crate_silver: "Silver Crate", mythic: "Jackpot: mythic fish, albino or golden" };

export const Sec = ({ id, title, children }) => (
  <section id={id} className="panel scroll-mt-4" data-testid={`wiki-${id}`}>
    <header className="panel-head"><span>{title}</span></header>
    <div className="p-3 text-[12.5px] text-[var(--text-2)] space-y-2 wiki-body">{children}</div>
  </section>
);
export const H = ({ children }) => <div className="label label-gold pt-1">{children}</div>;
const isNum = (c) => typeof c === "number" || (typeof c === "string" && /^[\d.,+\-–×%\s]*(g|kg|lb|XP|%)?$/.test(c));
export const T = ({ head, rows, testId }) => {
  const numCol = head.map((_, j) => j > 0 && rows.length > 0 && rows.every((r) => isNum(r[j]) || r[j] === "-"));
  return (
    <div className="overflow-x-auto"><table className="table text-[12px]" data-testid={testId}><thead><tr>{head.map((h, i) => <th key={i} className={numCol[i] ? "r" : ""}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={numCol[j] ? "r num" : ""}>{c}</td>)}</tr>)}</tbody></table></div>
  );
};
const pct = (n) => `${n > 0 ? "+" : ""}${n}`;

const Step = ({ n, title, children }) => (
  <div className="guide-step" data-testid={`guide-step-${n}`}>
    <div className="guide-step-n">{n}</div>
    <div className="min-w-0"><div className="font-display text-[14px] text-[#ffcf8a] mb-1">{title}</div><ul className="list-disc pl-5 space-y-0.5">{children}</ul></div>
  </div>
);
const L = ({ to, children }) => <Link to={to} className="underline">{children}</Link>;

export function NewPlayerGuide({ w }) {
  return (
    <Sec id="guide" title={tt("New player guide")}>
      <p data-testid="guide-intro">{tt("Welcome to the Lands! This page tells you what to do first, what to focus on, and which mistakes to skip. Everything else in this wiki is detail you can look up later.")}</p>

      <H>{tt("Your path, step by step")}</H>
      <div className="space-y-2.5">
        <Step n="1" title={tt("Your first hour (level 1 to 3)")}>
          <li>{tt("Open")} <L to="/game/fish">{tt("Fishing")}</L> {tt("and cast at Millbrook Pond. When something bites, hold")} <b>{tt("Reel")}</b> {tt("(or Space) and keep the needle in the green zone. Let go when it drifts into the red.")}</li>
          <li>{tt("Follow your")} <L to="/game/quests">{tt("Quests")}</L>{tt(". The first story quests teach the basics and pay gold, XP and Pearls.")}</li>
          <li>{tt("Sell common fish to the vendor from your")} <L to="/game/inventory">{tt("Inventory")}</L>{tt(". Keep anything rare or better: it is worth more on the")} <L to="/game/market">{tt("Market")}</L>.</li>
          <li>{tt("Open your daily chest on the")} <L to="/game">{tt("Harbour")}</L>{tt(". Come back every day: the streak makes it better.")}</li>
        </Step>
        <Step n="2" title={tt("Your first upgrades (level 3 to 10)")}>
          <li>{tt("Buy the")} <b>{tt("Fibreglass Rod")}</b> {tt("(250g) in the")} <L to="/game/shop">{tt("Tackle Shop")}</L> {tt("as your first upgrade, then a better reel and line. Better tackle makes every fight easier.")}</li>
          <li>{tt("Always fish with bait. Cheap bait like Earthworms and Maggots already gives you more bites and more luck than an empty hook.")}</li>
          <li>{tt("Unlock")} <b>{tt("Willow River")}</b> {tt("at level 3 (150g) and")} <b>{tt("Greyfell Lake")}</b> {tt("at level 7 (800g) on the")} <L to="/game/waters">{tt("Waters")}</L> {tt("page. New waters have new fish and more XP.")}</li>
          <li>{tt("Take jobs from the")} <L to="/game/contracts">{tt("Contract Board")}</L> {tt("for steady extra gold.")}</li>
        </Step>
        <Step n="3" title={tt("Join the community (level 10+)")}>
          <li><b>{tt("Join a")}</b> <L to="/game/crews">{tt("crew")}</L>{tt(". Anyone can join one, and from level 10 you can found your own. Crews unlock perks, the crew hall, Leviathan fights and the weekly challenge, where the top crews win crates.")}</li>
          <li>{tt("The")} <L to="/game/duel">{tt("Duelling pier")}</L> {tt("opens at level 10. Each duel costs 5 energy. Win duels to climb the weekly Duel Ladder for prizes, the top 3 each week win big.")}</li>
          <li>{tt("Enter")} <L to="/game/tournaments">{tt("tournaments")}</L>{tt(". Even if you don't win, a random angler who scored wins a crate.")}</li>
          <li>{tt("Add friends. An online friend fishing at the same water gives you both extra luck.")}</li>
        </Step>
        <Step n="4" title={tt("Chasing the big ones (level 15+)")}>
          <li>{tt("Keep pushing deeper: Harrow Point (15), Coral Shoals (20), Blackwater Mangroves (25) and beyond. Deeper waters mean heavier, rarer and more valuable fish.")}</li>
          <li>{tt("Watch for")} <b>{tt("boss alerts")}</b>{tt(". When a boss surfaces at a water you have unlocked, travel there and cast. Landing it pays big and can drop a crate.")}</li>
          <li>{tt("Fill your")} <L to="/game/journal">{tt("Fish Journal")}</L> {tt("and earn")} <L to="/game/achievements">{tt("achievements")}</L>{tt(". Catching a species again and again also builds its mastery.")}</li>
          <li>{tt("Enhance your favourite tackle once you have the gold, and repair it before it wears out.")}</li>
        </Step>
      </div>

      <H>{tt("Quick tips")}</H>
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]" data-testid="guide-tips">
        <div><b className="text-[var(--text)]">{tt("Energy")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Each cast costs")} {w.energy.cast_cost} {tt("energy, and you get 1 back every")} {w.energy.regen_sec}{tt("s.")}</li><li>{tt("Out of energy? Drink an Energy Potion (one per hour), or go sell, trade and chat while it refills.")}</li><li>{tt("Level-ups and potions add on top of a full bar, so nothing is wasted: you can bank up to double your max (200, or 300 with the Angler Pass).")}</li></ul></div>
        <div><b className="text-[var(--text)]">{tt("Gold")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Heavier fish are worth more, and golden, giant and scarred variants are worth a lot more.")}</li><li>{tt("Check the Market before you sell anything rare to the vendor. Other players often pay more.")}</li></ul></div>
        <div><b className="text-[var(--text)]">{tt("Luck & bites")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Night and dawn/dusk bring extra luck. Rare fish like to feed at night.")}</li><li>{tt("Use bait made for the water you fish. Elsewhere it only works at a third of its strength.")}</li></ul></div>
        <div><b className="text-[var(--text)]">{tt("The fight")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Read the \"Expect\" tags at the start of a fight: they warn you about dives, runs and leaps.")}</li><li>{tt("Lose a lot of fights? You need a better rod (power) or reel and line, not faster clicking.")}</li></ul></div>
        <div><b className="text-[var(--text)]">{tt("Crates")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Crates come from crew challenges, lucky draws, tournaments, bosses and, very rarely, any fish you land.")}</li><li>{tt("Every crate shows each prize's chance. You can open it or sell it on the Market.")}</li></ul></div>
        <div data-testid="guide-tip-cages"><b className="text-[var(--text)]">{tt("Crab Cages")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Buy a cage in the Tackle Shop, then drop it from the water's picture on the Waters page. One cage per water.")}</li><li>{tt("It catches something every 20-60 minutes for up to 8 hours, even while you're offline. Come back to that water and haul it up. Each water has 5 critters you can only catch this way.")}</li></ul></div>

        <div><b className="text-[var(--text)]">{tt("Don't")}</b><ul className="list-disc pl-5 space-y-0.5"><li>{tt("Don't spend all your gold on bait before you have a better rod.")}</li><li>{tt("Don't use macros or auto-clickers. They are detected and can cost you your account.")}</li></ul></div>
      </div>
      <p className="text-[12px] text-[var(--muted)] mt-3">{tt("Stuck or have a question? Ask in the chat: other anglers are happy to help.")}</p>
    </Sec>
  );
}

export function Basics({ w }) {
  return (
    <Sec id="basics" title={tt("1 · Getting started")}>
      <p><b className="text-[var(--text)]">{tt("Fishing Realms")}</b> {tt("is a persistent online world where every angler shares the same waters, market, chat and events. You start at Millbrook Pond with a cane pole, a few coins and a handful of bait. Everything you do, every cast, sale, quest and crew contest, is written down and visible to other players.")}</p>
      <H>{tt("The loop")}</H>
      <ul className="list-disc pl-5 space-y-0.5">
        <li><b>{tt("Account")}</b>{tt(": sign in with your angler name or the email you registered. Added an email? Use")} <i>{tt("Forgot password?")}</i> {tt("on the sign-in box to get a single-use reset link (valid 30 minutes). Without an email, an admin can reset it for you, email Support@TheFishingLands.com. Change your password or add/change your email any time from the small gear icon (⚙) in the top bar (your current password is required).")}</li>
        <li><Link to="/game/fish" className="underline">{tt("Cast")}</Link> {tt("at your current water. Each cast costs")} <b>{w.energy.cast_cost} {tt("energy")}</b>{tt("; you hold")} {w.energy.max} {tt("and regain 1 every")} {w.energy.regen_sec}{tt("s, faster with the Galley Rations crew perk, and")} {w.energy.boost_mult || 1.5}{tt("× faster while a server-wide booster is live (the two stack).")}</li>
        <li>{tt("When something bites, win the")} <b>{tt("tension fight")}</b> {tt("to land it.")}</li>
        <li>{tt("Keep the catch in your")} <Link to="/game/inventory" className="underline">{tt("Inventory")}</Link>{tt(", sell it to the vendor, list it on the")} <Link to="/game/market" className="underline">{tt("Market")}</Link>{tt(", use it as live bait, mount it on your trophy wall, or turn it into crafted bait. Fish tagged")} <b>{tt("crafting/bait")}</b> {tt("in the keepnet are the ones that work as live bait and crafting ingredients, use the \"Any use\" filter to see only those.")}</li>
        <li>{tt("Spend gold on better")} <Link to="/game/shop" className="underline">{tt("tackle")}</Link>{tt(", bait and passage to new")} <Link to="/game/waters" className="underline">{tt("waters")}</Link>{tt(". Level up to unlock deeper, richer waters.")}</li>
        <li>{tt("Visit the")} <Link to="/game" className="underline">{tt("Harbour")}</Link> {tt("daily for your chest, the Contract Board and dockside gossip.")}</li>
      </ul>
      <H>{tt("Fair play")}</H>
      <p data-testid="wiki-humancheck">{tt("Macros and auto-clickers are not allowed. The server watches for mechanical rhythms (recasting on an exact timer, identical fight input fight after fight, casting round the clock). Only an angler whose play has looked mechanical several times within the last day gets the Harbourmaster's check, a quick \"I'm not a robot\" box before the next cast, and never more than once a day. Normal anglers do not see it. Three failed checks count as a strike.")}</p>
    </Sec>
  );
}

export function FishingRules({ w, data }) {
  return (
    <Sec id="fishing" title={tt("2 · Casting, bites & the tension fight")}>
      <H>{tt("Bite chance")}</H>
      <p>{tt("Each cast has a base")} <b>{w.bite.base_pct}%</b> {tt("chance of a bite, plus a")} <b>{tt("bite bonus")}</b> {tt("from bait, time of day, weather, tide and expeditions. Bonuses are added as percentage points.")}</p>
      <H>{tt("Luck")}</H>
      <p><b>{tt("Luck")}</b> {tt("shifts the rarity roll: every point moves weight away from common fish toward uncommon, rare, epic, legendary and mythic species. Sources: bait (only its full value at waters it is made for, otherwise a third), night (+")}{w.luck.period.night}{tt(") and dawn/dusk (+")}{w.luck.period.dawn}{tt("), weather and tide, an active expedition at your water (+")}{w.luck.expedition}{tt("), an online friend at the same water (+")}{w.luck.friend}{tt("), rod tier (+1 per tier), and the crew Lucky Charms perk (+1/+2/+3). Groundbait ignores luck entirely.")}</p>
      {w.luck_table && <T testId="wiki-luck-table" head={["Total luck", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"]} rows={w.luck_table.map((r) => [r.luck, `${r.common}%`, `${r.uncommon}%`, `${r.rare}%`, `${r.epic}%`, `${r.legendary}%`, `${r.mythic}%`])} />}
      <p data-testid="wiki-luck-live-note">{tt("You never have to work this out yourself: on the Fishing page, hover or tap the")} <b>{tt("luck")}</b> {tt("figure beside the weather to see the exact odds of your next cast at your current water with your bait, rod, friends and crew perks, next to the odds at luck 0.")}</p>
      {w.groundbait && <p data-testid="wiki-groundbait-luck-note">{tt("Common fish never drop below the floor shown, but a high-level angler with a top rod and premium bait will still spend most casts on rare-and-up species. If you")} <i>{tt("want")}</i> {tt("the everyday fish, for contracts, the journal or species mastery, use")} <b>{w.groundbait.name}</b> {tt("from the Tackle Shop: it ignores your luck entirely (see")} <a href="#bait" className="underline">{tt("Bait")}</a>).</p>}
      <H>{tt("The fight")}</H>
      <p>{tt("Hold")} <b>{tt("Reel")}</b> {tt("(mouse, touch or Space) to raise tension, release to let it fall. Keep the needle inside the green")} <b>{tt("sweet spot")}</b> {tt("to fill the progress bar; the fish's pull, runs and jerks push you out of it. Tension in the red for too long snaps the line; slack for too long lets it slip the hook. Each species has a fighting style:")}</p>
      <T head={["Style", "Strength", "Erratic", "Feels like"]} rows={Object.entries(data.behaviors).map(([k, b]) => [k, b.strength, b.erratic, b.desc])} />
      <p>{tt("Your")} <b>{tt("rod power")}</b> {tt("shortens how long you must hold the sweet spot,")} <b>{tt("rod control")}</b> {tt("widens it,")} <b>{tt("reel recovery")}</b> {tt("brings tension back faster after a run, and")} <b>{tt("line tolerance")}</b> {tt("lets you survive longer in the red. Fights are checked server-side: hold timing that does not match a real fight is rejected.")}</p>
      <H>{tt("Fish tricks")}</H>
      <p>{tt("Small common fish fight plainly. The rarer and bigger the fish (rarity, size for its species, a scarred/giant/golden variant, and a little for far-off waters), the more")} <b>{tt("tricks")}</b> {tt("it brings, shown as \"Expect\" tags when the fight starts, and hinted at in the bite text:")}</p>
      <T head={["Trick", "Who", "What happens"]} rows={[
        ["Dive", "divers, sluggish fish", "The sweet spot drops low for ~3s: ease off."],
        ["Burst run", "runners", "The sweet spot climbs high for ~3s: keep the pressure on."],
        ["Leap", "jumpers, thrashers", "Tension spikes, then the line goes slack: take it up quickly."],
        ["Second wind", "steady fish, every legendary", "At 60% progress it rallies for 5s: narrower sweet spot, harder pull."],
        ["Tiring zone", "score 4+", "The sweet spot narrows as progress climbs (to 75%, or 60% for the toughest)."],
        ["Panic", "score 6+", "In the last 20% its jerks come twice as often."],
      ]} />
      <p className="text-[var(--muted)]">{tt("Trick score = rarity (common 0 … legendary 4, mythic 5) + 1 if big + 1 if monstrous + 1 if a variant + 1 per four waters out. Score 2 unlocks the behaviour trick, 4 adds Tiring zone, 5 repeats the behaviour trick, 6 adds Panic.")}</p>
    </Sec>
  );
}

export function Conditions({ w }) {
  return (
    <Sec id="conditions" title={tt("3 · Time of day, weather & tides")}>
      <p>{tt("The world clock is UTC.")} <b>{tt("Dawn")}</b> 05–08, <b>{tt("day")}</b> 08–17, <b>{tt("dusk")}</b> 17–20, <b>{tt("night")}</b> {tt("20–05. Every species has an active period (legendary and sluggish fish are night feeders) and is about twice as likely to bite during it. Weather changes every few hours per water; salt waters also run a tide.")}</p>
      <div className="grid md:grid-cols-2 gap-3">
        <T head={["Period", "Bite", "Luck"]} rows={Object.keys(w.bite.period).map((p) => [p, pct(w.bite.period[p]), pct(w.luck.period[p])])} />
        <T head={["Tide", "Bite", "Luck"]} rows={w.tides.map((t) => [t.key, pct(t.bite), pct(t.luck)])} />
      </div>
      <T head={["Weather", "Bite", "Luck", "Report"]} rows={w.weather.map((x) => [x.key, pct(x.bite), pct(x.luck), x.text])} />
    </Sec>
  );
}

export function WatersSec({ data }) {
  return (
    <Sec id="waters" title={tt("4 · Waters")}>
      <p>{tt("Twelve waters, from a village pond to a volcanic sea trench. Each needs a minimum level and a one-time passage fee. Travel is free once unlocked. Deeper waters hold heavier, rarer and more valuable fish, and a legendary boss.")}</p>
      <p>{tt("Every unlocked water card shows your")} <b>{tt("progress")}</b> {tt("there: species recorded in your journal out of the pool, and how many of those you have also caught as a scarred, giant, golden or other variant. Record every species and the water is stamped")} <b>{tt("Complete")}</b>.</p>
      <T testId="wiki-waters-table" head={["Water", "Type", "Level", "Passage", "Species", "Legendary", "Mythic"]} rows={data.waters.map((x) => {
        const pool = data.fish.filter((f) => f.water === x.key);
        return [<span className="text-[var(--text)]">{x.name}</span>, x.type, x.level, x.fee ? `${fmt(x.fee)}g` : "free", pool.length, pool.filter((f) => f.rarity === "legendary").length, pool.filter((f) => f.rarity === "mythic").length];
      })} />
    </Sec>
  );
}

export function FishSec({ w, data }) {
  return (
    <Sec id="fish" title={tt("5 · Fish, rarity & variants")}>
      <p><b>{data.fish.length} {tt("species")}</b> {tt("live in the Lands. Every species has a natural-history plate, a weight range, a fighting style and a value modifier. Discover them to fill your")} <Link to="/game/journal" className="underline">{tt("Fish Journal")}</Link>{tt("; click any entry for its full record and server-wide records.")}</p>
      <H>{tt("Rarity")}</H>
      <T head={["Rarity", "Roll weight", "Base value", "XP"]} rows={w.rarity.map((r) => [<Rarity r={r.key} />, r.weight, `${r.value}g`, r.xp])} />
      <p data-testid="wiki-mythic-note"><b className="rar-mythic">{tt("Mythic")}</b> {tt("sits above legendary: one per water, real species that belong there, roughly one in 650 bites at base luck. They fight at 1.8× strength with far more stamina than a legendary, so a matched high-tier set is all but required to land one. Hooking one raises a server-wide alert just like a legendary, and landing one counts toward the Legendary Hunter contest and the \"Myth Made Flesh\" / \"Keeper of Myths\" achievements.")}</p>
      <p>{tt("Value = base × species modifier × (0.7 → 2.0 by how close the weight is to the species maximum) × variant multiplier. XP = rarity XP + 3×√weight.")}</p>
      <H>{tt("Variants")}</H>
      <T head={["Variant", "Chance", "Value"]} rows={w.variants.map((v) => [v.key, `${v.chance_pct}%`, `×${v.value_mult}`])} />
      <p>{tt("Variants are rolled independently of rarity. A golden mythic is the rarest thing in the game.")}</p>
    </Sec>
  );
}

const gearPrice = (g) => (g.price ? `${fmt(g.price)}g${g.pearls ? ` + ${g.pearls} Pearls` : ""}` : "-");

export function Tackle({ data, w }) {
  const d = w?.durability;
  return (
    <Sec id="tackle" title={tt("7 · Tackle")}>
      <p>{tt("Buy at the")} <Link to="/game/shop" className="underline">{tt("Tackle Shop")}</Link>{tt(". Only one rod, reel and line are equipped at a time. Some tackle is")} <b>{tt("level-locked")}</b> {tt("and the finest pieces cost gold")} <i>{tt("and")}</i> {tt("Pearls: earn Pearls from weekly quests, contests, bosses, streaks and the day-7 Harbour Chest.")} <b>{tt("Matched set bonus")}</b>{tt(": equip a rod, reel")} <i>{tt("and")}</i> {tt("line of the")} <b>{tt("same tier")}</b> {tt("and you get +")}{w?.rare_set?.power_pct ?? 5}{tt("% fight power and")} {w?.rare_set?.wear_skip_pct ?? 50}{tt("% of all durability wear is skipped, your tackle lasts twice as long. Mixed tiers get no set bonus, so complete the set at every step up.")}</p>
      <H>{tt("Why upgrade? Every tier pays")}</H>
      <p>{tt("Besides shorter, safer fights, each piece of tackle carries a bonus that grows with its tier (T1 = none): the")} <b>{tt("rod adds +")}{w?.gear_bonus?.rod_luck_per_tier ?? 1} {tt("luck per tier")}</b> {tt("on every cast (rarer species and variants, a T8 rod is +7 luck, about the same as a dawn bite in good weather), the")} <b>{tt("reel adds +")}{w?.gear_bonus?.reel_value_pct_per_tier ?? 2}{tt("% vendor price per tier")}</b> {tt("whenever you sell fish to the vendor (it uses the reel you are wearing at the moment of sale, so upgrading pays off on every fish already in your keepnet), and the")} <b>{tt("line adds +")}{w?.gear_bonus?.line_xp_pct_per_tier ?? 2}{tt("% XP per tier")}</b>{tt(". A fish's listed value is the same for every angler, the reel and mastery bonuses are added only at the vendor, never on the Market or in contests. These stack with crew perks and are listed on every shop card.")}</p>
      <T head={["Tier", "Repair cost per point"]} rows={Object.entries(w?.gear_bonus?.repair_bands || {}).map(([t, g]) => [t, g ? `${g} gold` : "free"])} />
      <p>{tt("Repair cost depends on the tier band only, never on the price you paid, so a top rod is not a money pit to maintain.")}</p>
      <div className="grid md:grid-cols-2 2xl:grid-cols-3 gap-3">
        <T head={["Rod", "Tier", "Power", "Control", "Luck", "Price", "Lv"]} rows={[...data.rods].filter((g) => !g.event && !g.crate).sort((a, b) => a.power - b.power).map((g) => [`${g.name}`, `T${g.tier}`, g.power, g.control, g.tier > 1 ? `+${g.tier - 1}` : "-", gearPrice(g), g.level || "-"])} />
        <T head={["Reel", "Tier", "Recovery", "Vendor price", "Price", "Lv"]} rows={[...data.reels].sort((a, b) => a.recovery - b.recovery).map((g) => [`${g.name}`, `T${g.tier}`, g.recovery, g.tier > 1 ? `+${(g.tier - 1) * 2}%` : "-", gearPrice(g), g.level || "-"])} />
        <T head={["Line", "Tier", "Tolerance", "XP", "Price", "Lv"]} rows={[...data.lines].sort((a, b) => a.tolerance - b.tolerance).map((g) => [`${g.name}`, `T${g.tier}`, g.tolerance, g.tier > 1 ? `+${(g.tier - 1) * 2}%` : "-", gearPrice(g), g.level || "-"])} />
      </div>
      {d && (
        <>
          <H>{tt("Durability & repair")}</H>
          <p>{tt("Every item has")} <b>{d.max}/{d.max}</b> {tt("durability. Each fish you fight (landed or lost) takes 1 point off your equipped rod, reel and line. Tackle never breaks and never stops you fishing: at")} <b>0</b> {tt("it still works but at")} <b>{100 - d.worn_penalty_pct}%</b> {tt("of its fight stats")} <i>{tt("and")}</i> {tt("of its tier perk (rod luck, reel sell bonus, line XP, rounded down) until repaired. The luck readout on the Fishing page shows a worn rod as \"rod T8 (worn, 70%)\". Below")} {d.warn_below} {tt("the condition readout turns amber.")}</p>
          <p>{tt("Repair everything in one click from your")} <Link to="/game/inventory?tab=tackle" className="underline">{tt("Inventory")}</Link> {tt("tackle box or the Tackle panel while fishing. Cost is a flat amount per point set by the item's")} <b>{tt("tier band")}</b> {tt("(see the table under Tackle above, 5 gold at T2 up to 50 gold at T9), never a percentage of the price; the free starter gear is repaired for nothing.")}</p>
        </>
      )}
    </Sec>
  );
}

export function RecruitSec({ w }) {
  const r = w.referrals;
  if (!r) return null;
  return (
    <Sec id="recruit" title={tt("21 · Recruit an Angler")}>
      <p>{tt("Every full account has a recruit code and link on the")} <Link to="/game/recruit" className="underline">{tt("Recruit")}</Link> {tt("page. A friend who registers (or plays as guest, then claims) with your code is your recruit. Every 10 levels they gain, forever, you get a crate and Pearls and they get a few Pearls too. Payouts happen automatically.")}</p>
      <T head={["Recruit reaches", "You get", "They get"]} rows={r.milestones.map((m) => [`Level ${m.level}${m.level === 40 ? ", 50, 60…" : ""}`, `${{ crate_bronze: "Bronze", crate_silver: "Silver", crate_gold: "Gold" }[m.crate]} Crate + ${m.pearls} Pearls${m.level === r.title_level ? ` + title "${r.mentor_title}"` : ""}`, `${r.recruit_pearls} Pearls`])} />
      <H>{tt("Fair play")}</H>
      <p>{tt("Recruits who share a network with you are linked but never pay out. There is no limit on how many anglers you may recruit. Existing accounts may enter a code only within")} {r.apply_window_hours} {tt("hours of creation and before")} {r.apply_max_catches} {tt("fish landed. Guests must claim a real account before rewards count. Fights are validated server-side, so milestones cannot be scripted.")}</p>
    </Sec>
  );
}

export function PearlsSec({ w }) {
  const p = w.pearls;
  return (
    <Sec id="pearls" title={tt("20 · Pearls, portraits & names")}>
      <p><b>{tt("Pearls")}</b> {tt("are a rare second currency spent only on cosmetics: angler portraits and name changes. They cannot be bought with gold or traded.")}</p>
      <H>{tt("Earning Pearls")}</H>
      <T head={["Source", "Pearls"]} rows={[
        ["Story chapter completed", `${p.story[0]} (${p.story[1]} if it grants a title)`], ["Weekly quest completed", p.weekly], [`Daily quest streak bonus (every 7 days)`, p.streak],
        ["Daily Spin, Better Wheel (day 7, 12% slice)", p.spin_pearls], ["Legendary boss slain", p.boss], ["Daily contest podium 1st / 2nd / 3rd", (p.contest.daily || p.contest).join(" / ")], ["Weekly contest podium 1st / 2nd / 3rd", (p.contest.weekly || p.contest).join(" / ")], ["Crew challenge podium (each member)", (p.contest.crew || p.contest).join(" / ")], ["Achievement that grants a title", p.title_achievement],
      ]} />
      <H>{tt("Spending Pearls")}</H>
      <p>{tt("Buy premium portraits and name changes in the")} <Link to="/game/pearl-shop" className="underline">{tt("Pearl Shop")}</Link>{tt("; swap between portraits you own from")} <Link to="/game/profile" className="underline">{tt("My Angler")}</Link>{tt(". Six village faces are free (you pick one when you register; guests get a random one). Premium portraits are bought once and kept forever. A name change costs")} <b>{p.rename_cost}</b> {tt("Pearls and carries all your history with it.")}</p>
      <T head={["Portrait", "Pearls"]} rows={p.avatars.map((a) => [a.name, a.price === 0 ? "free" : a.price])} />
      {p.colours && (
        <>
          <H>{tt("Chat name colours")}</H>
          <p>{tt("Colour your name in chat and on your profile. Buy once, switch freely between owned colours; the default is always free.")}</p>
          <T head={["Colour", "Pearls"]} rows={p.colours.map((c) => [<span key={c.name} style={{ color: c.hex }}>{c.name}</span>, c.price])} />
        </>
      )}
      {p.frames && (
        <>
          <H>{tt("Portrait frames")}</H>
          <p>{tt("A frame wraps your portrait in the header, on your profile, on the rankings and in the online list. Buy once, switch freely; the plain border is always free.")}</p>
          <T head={["Frame", "Pearls", "Look"]} rows={p.frames.map((f) => [f.name, f.price, f.desc])} />
        </>
      )}
    </Sec>
  );
}

const unitOne = (u) => ({ catches: tt("catch"), species: tt("species"), variants: tt("variant"), pts: tt("point"), kg: "kg" }[u] || u);

export function EnhanceSec({ w, data }) {
  const e = w.enhance;
  const wname = Object.fromEntries(data.waters.map((x) => [x.key, x.name]));
  return (
    <Sec id="enhance" title={tt("7b · Salvage & tackle enhancement")}>
      <p>{tt("About")} <b>{e.trash_pct}%</b> {tt("of empty casts (\"nothing bites\") haul up")} <b>{tt("trash")}</b> {tt("instead, it costs the normal cast energy, gives no XP and never replaces a fish. Trash stacks in the")} <Link to="/game/inventory?tab=other" className="underline">{tt("Inventory")}</Link> {tt("Salvage box, where it is")} <b>{tt("recycled into Tackle Scrap")}</b>{tt(". Deep and sea waters (")}{e.deep_waters.map((k) => wname[k] || k).join(", ")}{tt(") give heavier junk, hooks, planks and anchor chain, so more scrap per hour.")} {tt("A bottle has a")} {e.bottle_gold_pct}% {tt("chance to hold a note with gold and a")} {e.bottle_seal_pct}% {tt("chance to hold a Harbourmaster's Seal.")}</p>
      <T head={["Trash", "Scrap", ""]} rows={e.trash.map((t) => [t.name, t.scrap, t.desc])} />
      <H>{tt("Enhancing tackle (+1 … +{{v0}})", { v0: e.max_level })}</H>
      <p>{tt("At the")} <Link to="/game/shop?tab=enhance" className="underline">{tt("Tackle Shop → Enhance")}</Link> {tt("bench every owned rod, reel and line can be raised level by level. Each level adds")} <b>+{e.stat_pct}%</b> {tt("to the item's fight stat (rod power & control, reel recovery, line tolerance). On top: the")} <b>{tt("rod gains +1 luck at every even level")}</b> {tt("(+5 at +10), the")} <b>{tt("reel +1% vendor price per level")}</b> {tt("and the")} <b>{tt("line +1% XP per level")}</b>{tt(". Enhancement sticks to the item and shows as \"+N\" after its name. Cost for level n is")} <b>8·n² {tt("scrap")}</b> {tt("plus gold equal to")} <b>10% × n</b> {tt("of the item's shop price (starter gear counts as 500 gold). +1 always succeeds; every step after that can fail, losing the scrap and gold, and from +")}{e.drop_from} {tt("a failure also knocks the item down one level.")}</p>
      <T head={["Level", ...Object.keys(e.success).map((n) => `+${n}`)]} rows={[[tt("Success"), ...Object.values(e.success).map((c) => `${c}%`)], [tt("Scrap"), ...e.costs.map((c) => c.scrap)], [tt("Gold (% of price)"), ...e.costs.map((c) => `${c.gold_pct}%`)]]} />
      <p><b>{tt("Harbourmaster's Seal")}</b> {tt(" is no longer sold for Pearls. Earn one on the weekly Duel Ladder (some weeks a top milestone holds one, and the #1 podium prize always does) or, very rarely, find one in a recycled trash bottle. Spend one on an attempt and it cannot fail. One Seal per attempt. Groundbait still ignores all luck, enhanced rod included.")}</p>
    </Sec>
  );
}

export function BaitSec({ data, w }) {
  const byId = Object.fromEntries([...data.baits, ...data.ingredients].map((b) => [b.id, b]));
  const wname = Object.fromEntries(data.waters.map((x) => [x.key, x.name]));
  return (
    <Sec id="bait" title={tt("8 · Bait & crafting")}>
      <p>{tt("Bait is consumed one per cast. Select it on the Fishing page. Each bait gives its full luck and bite at the waters it suits; elsewhere only a third of its luck.")} <b>{tt("Live bait")}</b> {tt("is made from your own catches (+")}{w?.live_bait_per_fish ?? 1} {tt("per fish, one small fish, one hook). Crafted baits out-luck the shop bait of their tier without costing Pearls (Angler's Secret is the strongest bait of all) and can only be made at")} <Link to="/game/crafting" className="underline">{tt("Bait Crafting")}</Link> {tt("from fish plus vendor ingredients, or bought from other anglers on the market.")}</p>
      <H>{tt("Groundbait, fishing for the everyday fish")}</H>
      {w?.groundbait && <p data-testid="wiki-groundbait">{tt("The better your rod, bait and crew perks, the harder it becomes to land a plain common or uncommon fish, which is exactly what many Harbour contracts, journal gaps and mastery levels ask for.")} <b>{w.groundbait.name}</b> ({w.groundbait.price}{tt("g, Tackle Shop, no level needed, every water) solves this: while it's on the hook")} <b>{tt("your luck is ignored")}</b> {tt("for the rarity roll and common and uncommon fish are twice as likely. The odds are the same for everyone, whatever their level: about")} <b>{w.groundbait.common}{tt("% common,")} {w.groundbait.uncommon}{tt("% uncommon,")} {w.groundbait.rare}{tt("% rare,")} {w.groundbait.epic}{tt("% epic,")} {w.groundbait.legendary}{tt("% legendary and")} {w.groundbait.mythic}{tt("% mythic")}</b>{tt(". It has the highest bite bonus of any bait (+")}{w.groundbait.bite}{tt("%) so grinding casts rarely come back empty. Everything else is untouched, variant chance, secret fish windows, boss hooks, bait-only species, time-of-day bonuses and weight rolls. Rule of thumb:")} <i>{tt("Groundbait to fill orders, Chum and Glow to hunt trophies.")}</i></p>}
      <H>{tt("Bait-only species")}</H>
      <p>{tt("Some fish are fussy. The species below")} <b>{tt("only take the listed baits")}</b>{tt("; with anything else they bite at a token")} {w?.bait_only?.other_pct ?? 4}{tt("% of their normal rate, so for practical purposes you will not catch them. The Bait panel on the Fishing page tells you which local species your current bait unlocks.")}</p>
      {w?.bait_only && <T testId="wiki-bait-only-table" head={["Fish", "Water", "Rarity", "Takes only"]} rows={w.bait_only.list.map((x) => [<span className={`rar-${x.rarity}`}>{x.name}</span>, x.water, x.rarity, x.baits.join(", ")])} />}
      <H>{tt("All baits")}</H>
      <T head={["Bait", "Luck", "Bite", "Size", "Price", "Lv", "Best at"]} rows={[...data.baits].sort((a, b) => a.luck - b.luck).map((b) => [b.name + (b.crafted ? " ✦" : "") + (b.ground ? " ◇" : ""), b.ground ? "ignored" : pct(b.luck), pct(b.bite), `${b.size || 0}/5`, b.price ? `${b.price}g${b.pearls ? ` + ${b.pearls} Pearl${b.pearls > 1 ? "s" : ""}` : ""}${b.pack ? ` per ${b.pack}` : ""}` : b.crafted ? "crafted" : "-", b.level || "-", b.waters ? b.waters.map((k) => wname[k]).join(", ") : "all waters"])} />
      <p className="text-[11px] text-[var(--muted)]">{tt("✦ crafted · ◇ luck ignored, common & uncommon doubled")}</p>
      <H>{tt("Bigger fish, the Size grade")}</H>
      <p data-testid="wiki-bait-size">{tt("Every bait has a Size grade from 0 to 5. The grade flattens the weight roll toward heavy specimens (an average catch sits around 31% of the species' weight range with a grade-0 bait and around 55% at grade 5) and multiplies the (small) variant odds by 1 + 0.15 per grade, e.g. Golden is 0.6% of catches with plain bait and about 1.05% with a grade-5 bait; Giant goes from 2% to 3.5%. Heavier fish sell for more, fight harder and set records, so a high-grade bait pays for itself even before the extra rare and legendary bites. Shop prices are set at about half of the extra fish value a bait brings in at its own waters; the Tackle Shop shows the expected net gold per cast at the water you are standing at.")}</p>
      <H>{tt("Recipes")}</H>
      <T head={["Makes", "Fish needed", "Ingredients", "Yield"]} rows={data.recipes.map((r) => [byId[r.id]?.name, r.fish, Object.entries(r.ingredients).map(([k, n]) => `${n}× ${byId[k]?.name}`).join(", "), r.yield])} />
      <H>{tt("Ingredient stock")}</H>
      <p>{tt("The dockside vendor sells each angler a limited stock of every ingredient per UTC day; the allowance resets at midnight UTC together with daily quests. Crafting itself is never capped, if you run out, buy ingredients from other anglers on the")} <Link to="/game/market" className="underline">{tt("Market")}</Link> {tt("(filter \"Ingredients only\") or sell your spare stock with the Sell button in your")} <Link to="/game/inventory" className="underline">{tt("Inventory")}</Link>{tt(". Guests must claim their account before listing ingredients. Ingredients from the Harbour Chest do not count against the cap.")}</p>
      <T head={["Ingredient", "Vendor price", "Daily stock"]} rows={data.ingredients.map((i) => [i.name, `${i.price}g`, i.daily_cap])} />
    </Sec>
  );
}

export function Economy({ w }) {
  return (
    <Sec id="economy" title={tt("9 · Economy & market")}>
      <ul className="list-disc pl-5 space-y-0.5">
        <li><b>{tt("Vendor")}</b>{tt(": instant sale at")} {Math.round(w.economy.vendor_rate * 100)}{tt("% of a fish's value, plus your reel tier and species mastery bonuses (shown on the Sell button).")}</li>
        <li><b>{tt("Market")}</b>{tt(": list fish or bait at your own price. Buyers pay the price, you receive it minus a")} {Math.round(w.economy.market_fee * 100)}{tt("% harbour fee. You may hold")} {w.economy.market_slots} {tt("open listings (more with the crew Trade Licence perk). Cancel any time.")}</li>
        <li data-testid="wiki-sell-items"><b>{tt("Selling other things")}</b>{tt(": bait, crafting ingredients, Tackle Scrap, Energy Potions and unequipped tackle all have a Sell button in your Inventory that offers either an instant vendor sale or a Market listing. The vendor pays 40% of shop price for tackle (less when worn, a little more when enhanced), 400g for an Energy Potion, half price for bait and ingredients and 5g per scrap. Listed tackle carries its durability and enhancement level to the buyer; a buyer who already owns the same piece can't buy it, and village starter gear can't be sold. Angler Passes are Market-only.")}</li>
        <li><b>{tt("Trade chat")}</b>{tt(": a dedicated channel for haggling; whisper any angler from their profile.")}</li>
        <li><b>{tt("Trophy wall")}</b>{tt(": mount up to")} {w.economy.max_trophies} {tt("record catches on your profile (they cannot be sold while mounted).")}</li>
      </ul>
    </Sec>
  );
}

export function Levels({ w }) {
  return (
    <Sec id="levels" title={tt("10 · Levels & titles")}>
      <p>{tt("XP to reach the next level = 80 × level")}<sup>1.55</sup>{tt(". Titles shown by default follow level; land 3 legendary fish for")} <b>{tt("Living Legend")}</b>{tt(". The ladder goes to level 250: levels 100, 150, 200 and 250 carry their own titles (and achievements) that outrank everything but the Harbour Warden. Titles earned from achievements, story quests and bosses can be chosen on")} <Link to="/game/profile" className="underline">{tt("My Angler")}</Link>.</p>
      <T head={["Level", "XP for this level", "Default title"]} rows={w.levels.map((l) => [l.level, fmt(l.xp), l.title])} />
    </Sec>
  );
}

export function QuestsSec({ w }) {
  return (
    <Sec id="quests" title={tt("11 · Quests & streaks")}>
      <p>{tt("The")} <Link to="/game/quests" className="underline">{tt("Quest log")}</Link> {tt("has three kinds.")} <b>{tt("Daily")}</b> ({w.quests.daily} {tt("per day) and")} <b>{tt("weekly")}</b> ({w.quests.weekly} {tt("per week) quests are rolled from templates for your level. Finish all dailies to extend your")} <b>{tt("quest streak")}</b>{tt("; every")} {w.quests.streak_days}{tt("th day pays a big streak bonus, and an alive streak boosts your Harbour chest.")} <b>{tt("Story")}</b> {tt("chapters unlock by level and tell the tale of the harbour; a \"!\" on the Quests tab means a new chapter is ready.")}</p>
      <T testId="wiki-story-table" head={["Chapter", "Level", "Objective", "Title"]} rows={w.quests.story.map((q) => [q.name, q.level, q.desc, q.title || "-"])} />
    </Sec>
  );
}

export function HarbourSec({ w, data }) {
  const bait = Object.fromEntries(data.baits.map((b) => [b.id, b.name]));
  return (
    <Sec id="harbour" title={tt("12 · The Harbour: daily spin & dockside")}>
      <H>{tt("Daily Spin (daily login)")}</H>
      <p>{tt("Spin the Harbourmaster's wheel once per UTC day. Consecutive days climb a 7-day ladder; miss a day and it resets to day 1. Day 7 spins the Better Wheel, then the ladder starts again. Gold and XP scale with your level. Guests get gold instead of crates. A gold dot on the Harbour tab means today's spin is waiting.")}</p>
      <T head={["Daily wheel (days 1-6)", "Base amount", "Chance"]} rows={w.spin.wheel.map((s) => [SPIN_KIND[s.kind] || s.kind, s.base, `${s.chance}%`])} />
      <T head={["Better Wheel (day 7)", "Base amount", "Chance"]} rows={w.spin.better.map((s) => [SPIN_KIND[s.kind] || s.kind, s.base, `${s.chance}%`])} />
      <H>{tt("Dockside characters")}</H>
      <p>{tt("Harbourmaster Aldous Crane, bait seller Nettie Marsh, Old Tobias and Cook Marisol Vane stand on the quay. Click a face to hear them talk, their lines change hourly and refer to real happenings: the week's heaviest catch, the leading crew, active expeditions and bosses, the weather where you fish, and your own record.")}</p>
    </Sec>
  );
}

export function ContractsSec({ w }) {
  const c = w.contracts;
  return (
    <Sec id="contracts" title={tt("12b · The Contract Board & patron favour")}>
      <p>{tt("The")} <Link to="/game/contracts" className="underline">{tt("Contract Board")}</Link> {tt("replaces the old bounty of the day. Four dockside")} <b>{tt("patrons")}</b> {tt("post delivery orders, a personal board of")} {c.board} {tt("offers at a time, each on the board for")} {c.offer_hours[0]},{c.offer_hours[1]} {tt("hours before a fresh one takes its place; when you accept an offer its slot is re-posted")} {c.refill_hours} {tt("hours later, and filled contracts stay listed under \"Your contracts\" for a day.")} <b>{tt("Accept")}</b> {tt("an order (you can hold")} {c.slots} {tt("at once; Old Tobias grants a third at Trusted rank) and you have")} {c.accept_hours} {tt("hours to fill it. At most")} <b>{c.daily_cap} {tt("contracts can be filled per day")}</b>{tt(", the board is a steady side income, deliberately smaller than fishing itself, and server boosters do not touch it. Hand in fish from your inventory in any number of trips, caught fresh or")} <b>{tt("bought on the Market")}</b>{tt(", it makes no difference. Fish handed in leave your inventory for good (your journal, mastery, contests and crew tallies already counted them). One offer per day can be")} <b>{tt("swapped")}</b> {tt("for another; abandoning an accepted contract costs")} {c.abandon_favour} {tt("favour with that patron.")}</p>
      <H>{tt("Order types")}</H>
      <ul className="list-disc pl-4 space-y-0.5">
        <li><b>{tt("Bulk")}</b>{tt(": N× of a species (Harbourmaster, Nettie, the Cook).")}</li>
        <li><b>{tt("By weight")}</b>{tt(": a total of X kg of a species, any mix of sizes, heaviest go in first (the Cook, Harbourmaster).")}</li>
        <li><b>{tt("Trophy")}</b>{tt(": one specimen over a stated weight (Old Tobias). The lightest fish that qualifies is handed in, so your record stays.")}</li>
        <li><b>{tt("Curiosity")}</b>{tt(": one scarred, giant, albino or golden specimen of a species (Nettie).")}</li>
        <li><b>{tt("Far waters")}</b>{tt(": three rare-or-better fish from a named water (Old Tobias, the Cook).")}</li>
      </ul>
      <H>{tt("Rewards")}</H>
      <p>{tt("Orders are tiered 1,4 by the rarity of what they ask for (T1 common, T2 uncommon, T3 rare, T4 epic/legendary; trophy and curiosity orders are at least T2). Gold is the fish's plain value ×")}{c.value_mult} {tt("plus a tier bonus that scales with your level and the water's level, always more than the vendor pays, and usually more than the Market. XP scales with your level; a Pearl comes with")} {c.tier_pearl_pct.join("/")}{tt("% of T1,T4 orders and always with a special order. Every filled order adds")} <b>{tt("favour")}</b> ({c.tier_favour.join("/")} {tt("by tier,")} {c.special_favour} {tt("for a special order) with that patron. Hand-ins are also handed in cheapest-first, so your valuable fish stay in the keepnet.")}</p>
      <H>{tt("Favour ranks & perks")}</H>
      <T head={["Rank", "Favour", "One-off reward"]} rows={c.ranks.map((r, i) => [r, c.rank_at[i], c.rank_rewards[i] ? `${c.rank_rewards[i].gold} gold${c.rank_rewards[i].pearls ? ` + ${c.rank_rewards[i].pearls} Pearls` : ""}${i === 4 ? " + the patron's title" : ""}` : "-"])} />
      <p className="mt-2">{tt("Ranks never fall (abandoning only spends points). Each patron's perk is passive and permanent once unlocked, and stacks with crew perks:")}</p>
      <T head={["Patron", "Wants", "Perk at full rank"]} rows={c.patrons.map((p) => [p.name, p.wants, p.perks.map((k) => `${k.label} (from ${k.ranks[0]})`).join("; ")])} />
      <p className="mt-2"><b>{tt("Old Friends")}</b> ({c.ranks[4]}{tt(") receive that patron's title and, now and then, a")} <b>{tt("special order")}</b> {tt("on their board: tier-4 pay, a guaranteed Pearl and")} {c.special_favour} {tt("favour. A daily quest (\"Honest Work\") sometimes asks for one filled contract, and achievements reward 10 and 50 contracts and Old Friend status.")}</p>
    </Sec>
  );
}

export function Events({ w }) {
  return (
    <Sec id="events" title={tt("13 · Expeditions & alerts")}>
      <p>{tt("Every")} {w.expedition.every_h} {tt("hours an")} <b>{tt("expedition")}</b> {tt("opens at one water for")} {w.expedition.length_min} {tt("minutes, giving everyone there +")}{w.expedition.luck} {tt("luck and +")}{w.expedition.bite} {tt("bite. The Harbour and Fishing pages show the current and next expedition with a travel button.")}</p>
      <p>{tt("The")} <b>{tt("alert bar")}</b> {tt("at the top of the game shows live legendary and mythic hooks, landings and losses across the server for")} {w.expedition.alert_window_min} {tt("minutes, plus expedition and boss windows. Cheer other anglers on from the bar.")}</p>
      <p><b>{tt("Browser notifications")}</b> {tt("(off by default): open Settings (⚙ in the top bar) and turn on alerts for boss spawns, expeditions, random events and/or a full energy bar to get one ping per window even when the tab is closed. Works on desktop browsers and Android; on iPhone/iPad only after adding the game to your Home Screen. Guests must claim their account first.")}</p>
    </Sec>
  );
}

export function BossesSec({ w, data }) {
  const wname = Object.fromEntries(data.waters.map((x) => [x.key, x.name]));
  const b = w.bosses;
  return (
    <Sec id="bosses" title={tt("14 · Legendary bosses")}>
      <p>{tt("One monster haunts every water. Roughly every")} {b.period_h} {tt("hours one boss rises for a")} <b>{b.window_min}{tt("-minute window")}</b> {tt("on a hidden timer; the whole server is told \"Something enormous is stirring at …\". While it is up,")} <b>{b.hook_pct}{tt("% of bites")}</b> {tt("at that water are the boss itself. The fight has")} <b>{tt("two phases")}</b>{tt(": at half progress it rallies, the sweet spot narrows and its pull jumps. Slaying it pays gold, XP and a unique title, records the kill in the Journal's ☠ Bosses tab, and pays online crewmates fishing the same water a")} {b.crew_share_pct}{tt("% share. One kill per angler per window. Mount up to")} {b.max_mounts} {tt("bosses as gold plaques on your profile.")}</p>
      <T testId="wiki-boss-table" head={["Boss", "Water", "Style", "Weight", "Gold", "XP", "Title"]} rows={b.list.map((x) => [<span className="text-[var(--r-legendary)]">{x.name}</span>, wname[x.water], x.behavior, wtRange(x.min_kg, x.max_kg), fmt(x.gold), fmt(x.xp), x.title])} />
    </Sec>
  );
}

export function SecretsSec({ w }) {
  const sc = w.secrets;
  if (!sc) return null;
  return (
    <Sec id="secrets" title={tt("15 · Secret catches")}>
      <p>{tt("Three species have a")} <b>{tt("0% spawn rate")}</b> {tt("for most of the day. Each one only bites during a fixed")} <b>{tt("real-world window in server time")}</b> {tt("(the clock above the World feed runs on UTC), and")} <b>{tt("nobody will tell you when")}</b>{tt(": the hours are not written anywhere in the game. Read the lore, watch the water, compare notes with other anglers. While a window is open at its water, about")} <b>{sc.chance_pct}{tt("% of bites")}</b> {tt("there are the secret fish, and there is no announcement.")} <b>{tt("Any bait works")}</b>{tt("; they are not fussy eaters. They never count toward a water's Complete stamp, sit in your Journal as \"???\" until landed, and landing all three grants the title")} <b>{sc.title}</b>.</p>
      <T testId="wiki-secrets-table" head={["Secret catch", "Water", "Rarity", "What the old salts say"]} rows={sc.list.map((x) => [<span className={`rar-${x.rarity}`}>{x.name}</span>, x.water, x.rarity, <i>{x.blurb}</i>])} />
    </Sec>
  );
}

export function DuelSec({ w }) {
  const d = w.duel;
  const rar = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
  return (
    <Sec id="duel" title={tt("16c · Fishing duels & the Duel Ladder")}>
      <p>{tt("From level")} {d.level} {tt("the")} <Link to="/game/duel" className="underline">{tt("Duelling Pier")}</Link> {tt("is open. Entering the queue costs")} {d.cost} {tt("energy (refunded if nobody turns up within")} {d.queue_timeout}{tt(" s). Two anglers are paired and fish the same water, chosen at random from the waters both have unlocked, for")} {d.seconds / 60} {tt("minutes. Two anglers on the same internet connection are never paired and can't rematch each other. Casts inside the duel are free, and you both fight with your own rod, reel and line (duels never wear gear down). Landing a species you have mastered adds")} +{d.mastery_pts_pct}{tt("% points per mastery level (up to +15% at level 10). Duel fish never enter your inventory or journal. Most points wins; ties go to total weight, then fewer lost fish. A fish hooked before the buzzer may still be fought (at most")} {d.overtime_max} {tt("s of overtime). Leaving the pier for")} {d.idle_forfeit} {tt("s forfeits the duel.")}</p>
      <T head={["Rarity landed", "Points"]} rows={rar.map((r) => [<span className={`rar-${r}`}>{r}</span>, `${d.points[r]} (+ up to 50% for size, +25% for a variant)`])} />
      <H>{tt("The weekly Duel Ladder")}</H>
      <p>{tt("Every duel you win moves you up this week's ladder by")} +{d.ladder.points_for.win}{tt(". Draws and losses never move you back. Crossing a milestone pays its reward straight away, once per week. Anglers on the same connection can't be matched against each other. The ladder and its rewards reset every Monday 00:00 UTC, and each week has a different set of rewards: gold, XP, all kinds of bait (including the duel-only")} {d.bait.name}{tt("), tackle scrap, Energy Potions, Pearls, crates, fish in rare variants put straight into your keepnet and sometimes a Harbourmaster's Seal on one of the top milestones. Every reward is random each week. The Duelling Pier page shows this week's full list.")}</p>
      <T head={["Milestone", "Ladder points", "Reward tier"]} rows={d.ladder.milestones.map((p, i) => [i + 1, p, ["Small", "Medium", "Big", "Top"][d.ladder.tiers[i]]])} />
      <H>{tt("Weekly podium")}</H>
      <p>{tt("The three anglers with the most duel wins in the week (ties: more ladder points, then fewer losses) are paid when the week ends:")}</p>
      <T head={["Place", "Prize"]} rows={d.ladder.podium.map((p, i) => [`#${i + 1}`, p])} />
      <p>{tt("The #1 angler takes the title")} "{d.ladder.title}" {tt("and wears it until another angler wins a week. Anglers who bought the title in the old Duellist's Shop keep theirs. Duel Marks and the Duellist's Shop have been retired; cosmetics bought there stay yours.")}</p>
    </Sec>
  );
}

export function CrewsSec({ w }) {
  const c = w.crews;
  return (
    <Sec id="crews" title={tt("16 · Crews & the crew hall")}>
      <p>{tt("Found a")} <Link to="/game/crews" className="underline">{tt("crew")}</Link> {tt("for")} {fmt(c.cost)} {tt("gold or join one (open crews accept instantly; invite-only crews take applications and leaders can whisper invites). Base capacity")} {c.max} {tt("anglers. Crews share a private chat channel and compete in a rotating weekly")} <b>{tt("crew challenge")}</b> {tt("(total weight, species landed or rarity points) that pays gold to split and Pearls to every member.")}</p>
      <H>{tt("Crew hall")}</H>
      <p>{tt("Every member can deposit gold into the")} <b>{tt("crew bank")}</b>{tt("; the leader spends it on perks that apply to all members. Hall tiers:")} {c.hall_names.join(" → ")}.</p>
      <p><b>{tt("Ranks.")}</b> {tt("The leader can appoint")} <b>{tt("officers")}</b> {tt("from the roster (badges show next to names). Officers can build hall upgrades, write the notice board, invite anglers and approve or decline join requests; only the leader can kick, promote, demote or change crew settings. If a leader leaves, an officer takes the helm. The leader and officers can also send one")} <b>{tt("crew message")}</b> {tt("per 24 hours that lands in every member's inbox and the crew chat.")}</p>
      <T head={["Perk", "Tier 1", "Tier 2", "Tier 3"]} rows={c.perks.map((p) => [p.name, ...p.tiers.map((t, i) => `${t} (${fmt(p.costs[i])}g)`)])} />
      <p><b>{tt("Tier requirements.")}</b> {tt("Every perk's tier 2 needs")} {c.tier_reqs[1].members} {tt("crew members and")} {c.tier_reqs[1].orders} {tt("weekly crew orders filled; tier 3 needs")} {c.tier_reqs[2].members} {tt("members,")} {c.tier_reqs[2].orders} {tt("crew orders filled and")} {c.tier_reqs[2].bosses} {tt("crew boss (Leviathan) landed. Tiers a crew already built stay built.")}</p>
      <H>{tt("Weekly crew order")}</H>
      <p>{tt("Every week each crew receives one")} <b>{tt("big delivery order")}</b> {tt("from a rotating dockside patron, sized to the roster (3–20 members counted): a bulk line of a common species, a bulk line of an uncommon species, a total weight of fish from one water (any species) and a handful of rare-or-better fish from anywhere. Species come from waters at least half the crew has unlocked, so everyone can pitch in. Any member hands fish in from their own inventory on the crew page; cheapest fish go first.")} <b>{tt("All four lines must be filled before the week ends or nobody is paid")}</b>{tt(". On completion the pool (fish value ×2 plus")} {w.crew_order.per_member} {tt("gold per member) is split:")} {w.crew_order.bank_pct}{tt("% into the crew bank for perks, the rest among everyone who delivered in proportion to their share of the work (rare fish count 4×). Each contributor also gets XP,")} {w.crew_order.pearls[0]} {tt("Pearl (")}{w.crew_order.pearls[1]} {tt("with a ≥")}{w.crew_order.big_share_pct}{tt("% share) and +")}{w.crew_order.favour} {tt("favour with that patron. The daily 4-contract cap does not apply to the crew order.")}</p>
    </Sec>
  );
}

export function Social({ w }) {
  return (
    <Sec id="social" title={tt("17 · Friends, chat & whispers")}>
      <ul className="list-disc pl-5 space-y-0.5">
        <li><b>{tt("Chat")}</b>{tt(": Global and Trade channels in the right-hand panel, plus a Crew channel for crew members. Angler levels are shown beside names, and each line carries a small HH:MM timestamp (turn it off in Settings ⚙ → Display).")}</li>
        <li><b>{tt("Whispers")}</b>{tt(": private messages from any profile or the")} <Link to="/game/messages" className="underline">{tt("Messages")}</Link> {tt("page; unread count shows on the tab.")}</li>
        <li><b>{tt("Friends")}</b>{tt(": send requests from a profile or the sidebar. The Friends panel shows who is online and where. Fishing at the same water as an online friend gives")} <b>+{w.luck.friend} {tt("luck")}</b> {tt("on every cast; the Fishing page shows a gold \"Fishing together\" panel with who is beside you while the bonus is active, and points you to friends fishing elsewhere.")}</li>
        <li><b>{tt("Profiles")}</b>{tt(": record, tackle, trophy wall, boss plaques, contest wins and displayed title.")}</li>
        <li><b>{tt("Conduct")}</b>{tt(": the Harbourmaster's staff can remove messages, mute anglers from chat (one hour up to permanent) and ban or delete accounts that cheat or abuse others. A banned account cannot sign in and its market listings are taken down. Gold notices at the top of the game are official server announcements.")}</li>
      </ul>
    </Sec>
  );
}

export function Contests({ w }) {
  const c = w.contests;
  const t = w.tournaments;
  const p = c.prizes;
  const pearls = c.pearls || {};
  const crewPool = c.crew_pool || ["crew"];
  return (
    <Sec id="contests" title={tt("18 · Tournaments & crew challenges")}>
      {t && <>
        <p><Link to="/game/tournaments" className="underline">{tt("Tournaments")}</Link> {tt("are scheduled contests you buy into, one every 3 hours, alternating gold and Pearls, never back to back. Gold tournaments start at")} {t.gold_hours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")} {tt("UTC and Pearl tournaments at")} {t.pearl_hours.map((h) => `${String(h).padStart(2, "0")}:00`).join(", ")} {tt("UTC. Buy-in opens")} {t.signup_h} {tt("hour before the start and closes when it begins; each runs")} {t.durations.join(" or ")} {tt("hours. Gold buy-ins are")} {t.fees.gold.join(" / ")} {tt("gold, Pearl buy-ins")} {t.fees.pearls.join(" / ")} {tt("Pearls, the amount, the length and the category are drawn per tournament and shown in advance. A tournament needs at least")} {t.min_entrants} {tt("anglers or it is called off and every fee is refunded. You can hold one ticket at a time, guests cannot buy in, and only fish you hook yourself during the window count.")}</p>
        <p>{tt("The fee is a fee, not a prize pool. Every angler is paid for their")} <b>{tt("own score")}</b>{tt(": a rate per unit (fish, kilo, species, variant or point) that scales with the buy-in, the table shows the rate at the top buy-in (1000 gold / 5 Pearls); a 500-gold tournament pays half as much per unit, and so on. Payouts are capped at")} {t.cap_mult_gold}{tt("× the buy-in in gold tournaments and at")} {t.cap_pearls} {tt("Pearls in Pearl tournaments. The top three also take a podium bonus in the other currency (")}{t.podium.gold[1].join("/")} {tt("Pearls in gold tournaments,")} {t.podium.pearls[1].join("/")} {tt("gold in Pearl tournaments) and the winner keeps the title")} <b>"{t.title}"</b>.</p>
        <T head={["Tournament", "What counts", "Gold per unit", "Pearls per unit"]} rows={Object.entries(t.categories).map(([k, v]) => [<span className="inline-flex items-center gap-2"><img src={`/art/tournaments/${k}.webp`} alt="" width={22} height={22} />{v.label}</span>, v.desc, `${v.rate.gold} / ${unitOne(v.unit)}`, `${v.rate.pearls} / ${unitOne(v.unit)}`])} />
      </>}
      <p>{tt("Crews get their own weekly challenge on the")} <Link to="/game/crews" className="underline">{tt("Crews page")}</Link>{tt(", drawn from")} {crewPool.map((k) => c.labels[k]).join(", ")}{tt(". It resets on Monday 00:00 UTC; the top three crews split gold between their members and every member takes Pearls.")}</p>
      {c.rarity_points && <p className="text-[12px]">{tt("Rarity points:")} {Object.entries(c.rarity_points).map(([r, n]) => `${r} ${n}`).join(", ")}.</p>}
      <T head={["Crew challenge", "1st", "2nd", "3rd"]} rows={[["weekly crew (gold split)", ...p.crew.map((g, i) => `${fmt(g)}g${pearls.crew?.[i] ? ` + ${pearls.crew[i]} Pearls each` : ""}`)]]} />
    </Sec>
  );
}

export function AchievementsSec({ w }) {
  return (
    <Sec id="achievements" title={tt("19 · Achievements")}>
      <p>{w.achievements.length} {tt("achievements pay gold once and some grant a title. See your progress on the")} <Link to="/game/achievements" className="underline">{tt("Achievements")}</Link> {tt("page.")}</p>
      <T head={["Achievement", "Requirement", "Gold", "Title"]} rows={w.achievements.map((a) => [a.name, a.desc, fmt(a.reward), a.title || "-"])} />
    </Sec>
  );
}

export function VoteSec({ w }) {
  const v = w.vote;
  if (!v || v.sites.length === 0) return null;
  return (
    <Sec id="vote" title={tt("22 · Vote for the game")}>
      <p>{tt("The")} <Link to="/game/vote" className="underline">{tt("Vote")}</Link> {tt("page lists game toplists where you can vote for Fishing Realms. Click a site, vote there, and the harbour pays you the moment the toplist confirms it.")}</p>
      <T head={["Site", "Vote again after", "Reward"]} rows={v.sites.map((s) => [s.name, `${s.cooldown_h} hours`, `${s.gold} gold${s.pearls ? ` + ${s.pearls} Pearl${s.pearls > 1 ? "s" : ""}` : ""}`])} />
      <p>{tt("Rewards are paid once per site per cooldown, only after the toplist confirms the vote. A dot on the Vote tab means a reward is waiting to be earned.")}</p>
    </Sec>
  );
}

export function MasterySec({ w }) {
  const m = w.mastery;
  if (!m) return null;
  return (
    <Sec id="mastery" title={tt("6 · Fish mastery")}>
      <p>{tt("Every species has its own")} <b>{tt("mastery")}</b>{tt(", levels 1–10, earned simply by landing more of it. Progress shows on each Fish Journal card and in the catch result. Rarer fish master in far fewer catches, but a common takes 300 to master, so a full bar is a real badge.")}</p>
      <T head={["Rarity", ...m.levels.map((l) => `Lv ${l}`)]} rows={Object.entries(m.thresholds).map(([r, t]) => [r, ...t.map((n) => `${n}`)])} />
      <H>{tt("Perks (for that species only)")}</H>
      <T head={["Level", "Perk"]} rows={m.perks.map(([l, p]) => [`Lv ${l}`, p])} />
      <p>{tt("Reaching Lv 10 grants the")} <b>{tt("\"[Fish] Master\"")}</b> {tt("title, a Pearl and a feed shout-out. Your total mastery levels are shown on your profile and rank on the")} <Link to="/game/leaderboards" className="underline">{tt("Fish masters")}</Link> {tt("board.")}</p>
    </Sec>
  );
}

const cpct = (c) => (c == null ? "-" : c >= 1 ? `${+c.toFixed(2)}%` : `${+c.toPrecision(2)}%`);
export function CratesSec({ w }) {
  const k = w.crates;
  if (!k) return null;
  const chanceIn = (crate, id) => crate.contents.find((p) => p.id === id && p.kind === "rod")?.chance;
  const name = (id) => k.crates.find((c) => c.id === id)?.name;
  return (
    <Sec id="crates" title={tt("7a · Crates")}>
      <p>{tt("Crates are rare loot boxes in three tiers:")} <b>Bronze</b>, <b>Silver</b> {tt("and")} <b>Gold</b>. {tt("They are only ever earned by playing, never sold for Pearls or money. You can open them from your")} <Link to="/game/inventory?tab=other" className="underline">{tt("Inventory")}</Link> {tt("(Crates & more) or sell them unopened on the")} <Link to="/game/market" className="underline">{tt("Market")}</Link>.</p>
      <p>{tt("Every opening is a fresh roll with the chances below. Nothing carries over between openings: there is no pity counter, no guarantee and no progress towards a prize. A rod you already own goes into your Tackle box as a spare that you can sell.")}</p>
      <H>{tt("How to get crates")}</H>
      <ul className="list-disc pl-5 space-y-0.5">{k.how_to_get.map((h) => <li key={h}>{h}</li>)}</ul>
      <T head={["Source", "Bronze", "Silver", "Gold"]} testId="wiki-crate-sources" rows={[
        ["Each fish you land", cpct(k.fish_drop.crate_bronze), cpct(k.fish_drop.crate_silver), cpct(k.fish_drop.crate_gold)],
        ["Slaying a boss", cpct(k.boss_drop.crate_bronze), cpct(k.boss_drop.crate_silver), cpct(k.boss_drop.crate_gold)],
        ["Pulling on a crew Leviathan", cpct(k.leviathan_drop.crate_bronze), cpct(k.leviathan_drop.crate_silver), cpct(k.leviathan_drop.crate_gold)],
      ]} />
      {k.crates.map((c) => (
        <div key={c.id}>
          <H>{c.name} · {tt("expected value")} {fmt(c.expected_value)}g</H>
          <p className="text-[12px]">{c.desc}</p>
          <T head={["Prize", "Chance", "Value"]} testId={`wiki-crate-${c.id}`} rows={[...c.contents].sort((a, b) => b.chance - a.chance).map((p) => [<span className={`rar-${p.rarity}`}>{p.label}</span>, cpct(p.chance), `${fmt(p.value)}g`])} />
        </div>
      ))}
      <H>{tt("Crate-only rods")}</H>
      <p>{tt("These six rods are never sold in the Tackle Shop. They only come out of crates, or from another angler on the Market. You need the listed level to equip one.")}</p>
      <T head={["Rod", "Tier", "Lv", "Power", "Control", "Bonuses", name("crate_bronze"), name("crate_silver"), name("crate_gold")]} testId="wiki-crate-rods" rows={k.rods.map((r) => [
        <span className={`rar-${r.crate_rarity} font-semibold`}>{r.name}</span>, `T${r.tier}`, r.level, r.power, r.control, r.perk,
        ...k.crates.map((c) => cpct(chanceIn(c, r.id))),
      ])} />
    </Sec>
  );
}
