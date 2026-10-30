"""One-off announcement posts that publish themselves the first time a server starts with them (i.e. on go-live)."""
import asyncio

from server import db, now, iso

RELEASES = [{
    "key": "release_2026_06_harbour_refit",
    "title": "The Harbour Refit: new look, a mobile overhaul and a brand-new Duelling Pier",
    "body": """The harbour has had a fresh coat of paint, anglers! Here's what's new.

**A new pixel look**
Every page now has crisp pixel-art panels, the Duelling Pier has a new scene, and the menus use new fishing icons (crossed rods for duels, a bottle for messages, a lighthouse for the wiki and more). Every section heading has its own little picture.

**Reworked mobile interface**
- Swipe right anywhere to open the menu (and left to close it)
- A bottom quick bar on Fishing, Harbour, Duel, Contracts and Crafting, so everything fits on one screen
- The Tackle Shop is now tidy cards on phones, no more overlapping text

**The Duelling Pier, reworked**
- Duels now cost only **5 energy**
- Both anglers use the same standard tackle. Landing a species you've mastered gives a few extra points
- New **weekly Duel Ladder**: a win is +3, a draw +1, a loss -1. Cross a milestone and its reward is yours for the week, even if you drop back later. The rewards are random every week: gold, XP, bait, scrap, potions, Pearls, crates, rare-variant fish and sometimes even a Harbourmaster's Seal
- **Weekly board**: the top 3 by wins get big prizes, and #1 wears the **Pier Champion** title until someone takes it
- **Rematch** straight from the result screen (5 energy each)
- Duel Marks and the Duellist's Shop have been retired
- Anglers on the same internet connection can no longer duel each other

**Crew hall upgrades**
Building the higher tiers now takes some crew work: tier 2 needs 5 members and 5 crew orders filled, tier 3 needs 10 members, 15 crew orders and a crew boss landed. Upgrades also cost about 25% more gold. Tiers your crew already built stay built.

**Daily Spin**
The daily chest is gone. The Harbourmaster now has a prize wheel: spin once a day, and on day 7 you get the **Better Wheel**, with a mythic jackpot.

**Smaller changes**
- Duel quests in the daily and weekly quest pools
- A crew boss pull now costs 20 energy (was 25)
- Crew orders: choose exactly which fish you hand in, so the ones you want to keep stay in your inventory
- Big-catch notices stay up longer and no longer close when you cheer, so you can watch the cheers roll in
- Crate openings no longer hide behind the page
- Seals are no longer sold in the Pearl Shop. Earn them on the Duel Ladder (or, very rarely, from a recycled bottle)

Tight lines, and see you on the pier!""",
}, {
    "key": "release_2026_06_rod_rebalance",
    "title": "Rod rebalance",
    "body": """- Higher rod tiers now give a wider sweet spot and shorter fights in every water, including the deepest ones
- Leaping fish are gentler: you can now fight back during a leap

Tight lines!""",
}, {
    "key": "release_2026_06_crew_boss",
    "title": "Crew bosses made easier",
    "body": """- Leviathans start closer, drift back much slower and each pull hauls more. Small crews can land them too, and bosses already up have been adjusted

Tight lines!""",
}, {
    "key": "release_2026_10_duel_gear_energy",
    "title": "Duels use your gear, energy stacks",
    "body": """- Duels now use your own rod, reel and line, and you can see your opponent's gear. Duels never wear gear down
- Level-ups and Energy Potions now add on top of a full bar, up to double your max

Tight lines!""",
}]


async def publish_pending():
    for rel in RELEASES:
        r = await db.meta.update_one({"key": rel["key"]}, {"$setOnInsert": {"key": rel["key"], "value": iso(now())}}, upsert=True)
        if not r.upserted_id:
            continue
        await db.news.insert_one({"title": rel["title"], "body": rel["body"], "image": None, "pinned": False, "author": "Niels", "created_at": iso(now())})
        from discord_alerts import post_news
        asyncio.create_task(post_news(rel["title"], rel["body"], None))
