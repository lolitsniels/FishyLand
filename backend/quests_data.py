"""Story quest chain + daily/weekly quest templates for Fishing Realms."""


def _q(id_, name, level, story, desc, event, target, reward, flt=None, measure=None, title=None):
    return {"id": id_, "name": name, "level": level, "story": story, "desc": desc,
            "objective": {"event": event, "filter": flt or {}, "measure": measure}, "target": target,
            "reward": {"gold": reward[0], "xp": reward[1], "title": title, "pearls": 3 if title else 2}}


# Guest onboarding chain, auto-accepted for guest accounts on signup. Three tight steps that
# introduce cast → land → sell. `sequential: True`, step N+1 activates only after N is done.
GUEST_QUESTS = [
    {"id": "guest_cast", "name": "Pick Up the Rod", "step": 1,
     "story": "The harbourmaster nods at the water. \"Every angler starts with a single cast. Give the line to the pond and see what it gives back.\"",
     "desc": "Cast your line once at Millbrook Pond.",
     "objective": {"event": "cast", "filter": {}, "measure": None},
     "target": 1, "reward": {"gold": 25, "xp": 10, "title": None}},
    {"id": "guest_land", "name": "Your First Fish", "step": 2,
     "story": "\"Now hold the line steady in the green when it bites. Land one and it's yours, the first of thousands, if you stay.\"",
     "desc": "Land your first fish.",
     "objective": {"event": "catch", "filter": {}, "measure": None},
     "target": 1, "reward": {"gold": 60, "xp": 30, "title": None}},
    {"id": "guest_sell", "name": "Coin for the Catch", "step": 3,
     "story": "\"Fish is currency here. Take it to Ada at the vendor, or list it on the market and let another angler pay you more than she will.\"",
     "desc": "Sell a fish to the vendor or on the market.",
     "objective": {"event": "sell", "filter": {}, "measure": None},
     "target": 1, "reward": {"gold": 100, "xp": 40, "title": "Newcomer"}},
]
GUEST_BY_ID = {q["id"]: q for q in GUEST_QUESTS}
GUEST_ORDER = [q["id"] for q in GUEST_QUESTS]


STORY_QUESTS = [
    _q("casting_off", "Casting Off", 1,
       "The harbourmaster presses a battered cane rod into your hands. \"Everyone starts at Millbrook. Show me you can keep a fish on the line.\"",
       "Land 3 fish.", "catch", 3, (60, 40)),
    _q("millers_complaint", "The Miller's Complaint", 1,
       "Old Hobb the miller swears something in the pond has been snatching his ducklings. He wants the shallows thinned out before he loses another.",
       "Land 6 fish at Millbrook Pond.", "catch", 6, (110, 60), {"water": "millbrook"}),
    _q("fair_price", "A Fair Price", 2,
       "Ada runs the fishmonger's stall by the quay. \"Bring me stock and I'll teach you what a fish is really worth, and what it isn't.\"",
       "Sell 5 fish to the vendor or on the market.", "sell", 5, (90, 60)),
    _q("down_the_willow", "Down the Willow", 3,
       "A bargeman tells of fat chub and pike beneath the willows upriver. The ferry costs coin, but the river pays it back.",
       "Travel to Willow River.", "travel", 1, (200, 90), {"water": "willow"}),
    _q("river_colours", "River Colours", 3,
       "The village schoolmistress is compiling a book of local fishes and needs drawings from life. Every new species you land is a page for her.",
       "Discover 6 new species.", "catch", 6, (260, 120), {"new_species": True}),
    _q("something_in_reeds", "Something in the Reeds", 4,
       "Reed-cutters have seen a shape moving in the margins at dusk that none of them can name. Whatever it is, it isn't common.",
       "Land a rare-or-better fish.", "catch", 1, (420, 160), {"min_rarity": "rare"}, title="Reed Stalker"),
    _q("missing_catch", "The Missing Catch", 7,
       "An old fisherman claims something enormous lives beneath Greyfell Lake. He lost his best line to it forty years ago and has never stopped talking about it.",
       "Land a fish over 20 kg at Greyfell Lake.", "catch", 1, (2000, 320), {"water": "greyfell", "min_kg": 20}, title="Lakewatcher"),
    _q("night_watch", "Night Watch", 8,
       "The lamplighter at Greyfell says the lake is a different animal after dark. \"Sit out with me one night. You'll see.\"",
       "Land 10 fish after dark.", "catch", 10, (650, 240), {"period": "night"}),
    _q("salt_on_wind", "Salt on the Wind", 11,
       "A letter arrives from a cousin at the Saltmarsh: the estuary is running thick with bass and the flats need another pair of hands.",
       "Travel to Saltmarsh Estuary.", "travel", 1, (800, 300), {"water": "saltmarsh"}),
    _q("tide_tables", "Tide Tables", 11,
       "Your cousin hands you a smudged tide table. \"Fish the flood, rest the ebb. Learn it in your bones and the marsh will feed you for life.\"",
       "Land 15 fish at Saltmarsh Estuary.", "catch", 15, (950, 360), {"water": "saltmarsh"}),
    _q("merchants_wager", "The Merchant's Wager", 12,
       "Ada wagers you can't move stock to other anglers without her help. Prove her wrong on the open market.",
       "List 3 fish on the player market.", "list", 3, (700, 300)),
    _q("harrows_teeth", "Harrow's Teeth", 15,
       "Harrow Point breaks boats and men alike. The lighthouse keeper keeps a ledger of every notable fish taken off the rocks, and there is a blank line with your name on it.",
       "Land 5 rare-or-better fish at Harrow Point.", "catch", 5, (1500, 600), {"water": "harrow", "min_rarity": "rare"}, title="Harrow Hand"),
    _q("old_salts_recipe", "Old Salt's Recipe", 15,
       "Brannigan, the oldest angler on the quay, offers to teach you his cured-bait recipe. \"Fresh fish, sea salt, patience. Mostly patience.\"",
       "Craft 3 baits at the crafting bench.", "craft", 3, (1000, 450)),
    _q("colours_of_reef", "Colours of the Reef", 20,
       "The schoolmistress's book has become a serious work of natural history. She needs the reef fishes, and only the Coral Shoals have them.",
       "Discover 10 new species at Coral Shoals.", "catch", 10, (3000, 900), {"water": "coral", "new_species": True}),
    _q("golden_rumour", "The Golden Rumour", 22,
       "Tavern talk of fish that shine wrong, pale as ghosts, scarred like old warriors, or gleaming like coin. Most anglers never see one.",
       "Land any variant fish (scarred, giant, albino or golden).", "catch", 1, (2500, 800), {"variant": True}, title="Rumour Chaser"),
    _q("into_the_black", "Into the Black", 25,
       "The mangrove guides refuse to pole past the third bend. Something down there upends canoes. Something heavy.",
       "Land a fish over 40 kg at Blackwater Mangroves.", "catch", 1, (5000, 1400), {"water": "blackwater", "min_kg": 40}),
    _q("ice_breaker", "The Long Cold", 31,
       "The Frozen Reach demands a different kind of angler. Twenty fish through the ice and the northern crews will call you one of their own.",
       "Land 20 fish at The Frozen Reach.", "catch", 20, (8000, 2200), {"water": "frozen"}, title="Ice Breaker"),
    _q("what_deep_keeps", "What the Deep Keeps", 38,
       "Sailors speak of the Sunken Deep in whispers. Bring back proof of what lives below the light and the harbourmaster will drink to your name.",
       "Land an epic-or-better fish at The Sunken Deep.", "catch", 1, (15000, 4000), {"water": "sunken", "min_rarity": "epic"}, title="Deepwater Witness"),
    _q("light_in_dark", "Light in the Dark", 45,
       "The last page of the schoolmistress's book is blank. It waits for a legend, and legends do not come to those who wait at home.",
       "Land a legendary fish.", "catch", 1, (50000, 12000), {"min_rarity": "legendary"}, title="Light in the Dark"),
]
STORY_BY_ID = {q["id"]: q for q in STORY_QUESTS}
STORY_ORDER = [q["id"] for q in STORY_QUESTS]


def _t(id_, name, desc, event, target, mult=1.0, flt=None, measure=None, needs=None):
    return {"id": id_, "name": name, "desc": desc, "event": event, "target": target, "mult": mult, "filter": flt or {}, "measure": measure, "needs": needs}


def daily_pool(rnd, ctx):
    w = ctx["waters"][rnd.randrange(len(ctx["waters"]))]
    heavy = max(2, round(w["median_kg"] * 0.6))
    return [
        _t("d_catch", "Busy Lines", "Land {n} fish anywhere.", "catch", rnd.choice([8, 12, 15])),
        _t("d_water", "Local Waters", f"Land {{n}} fish at {w['name']}.", "catch", rnd.choice([5, 8]), 1.1, {"water": w["key"]}),
        _t("d_uncommon", "Better Stock", "Land {n} uncommon-or-better fish.", "catch", rnd.choice([3, 5]), 1.2, {"min_rarity": "uncommon"}),
        _t("d_heavy", "The Big One", f"Land a fish over {heavy} kg.", "catch", 1, 1.3, {"min_kg": heavy}),
        _t("d_sell", "Market Day", "Sell {n} fish to the vendor or on the market.", "sell", rnd.choice([5, 10])),
        _t("d_cast", "Patience", "Cast your line {n} times.", "cast", rnd.choice([15, 25]), 0.8),
        _t("d_contract", "Honest Work", "Fill a harbour contract for one of the dockside patrons.", "contract", 1, 1.2),
        _t("d_rare", "Something Special", "Land a rare-or-better fish.", "catch", 1, 1.5, {"min_rarity": "rare"}, needs="mid"),
        _t("d_discover", "New Entry", "Discover a species you have never caught.", "catch", 1, 1.3, {"new_species": True}, needs="undiscovered"),
        _t("d_duel", "Pier Regular", "Fish {n} duels on the Duelling Pier.", "duel", rnd.choice([2, 3]), 1.2, needs="duel"),
        _t("d_duel_win", "Pier Winner", "Win a duel on the Duelling Pier.", "duel", 1, 1.3, {"won": True}, needs="duel"),
    ]


def weekly_pool(rnd, ctx):
    w = ctx["waters"][rnd.randrange(len(ctx["waters"]))]
    lvl = ctx["level"]
    return [
        _t("w_catch", "Long Week on the Water", "Land {n} fish this week.", "catch", rnd.choice([50, 75])),
        _t("w_rare", "Rare Haul", "Land {n} rare-or-better fish.", "catch", rnd.choice([4, 6]), 1.3, {"min_rarity": "rare"}, needs="mid"),
        _t("w_discover", "Field Notes", "Discover {n} new species.", "catch", min(rnd.choice([3, 5]), ctx.get("undiscovered_left") or 1), 1.2, {"new_species": True}, needs="undiscovered"),
        _t("w_gold", "Coin Purse", "Earn {n} gold selling fish.", "sell", (300 + lvl * 60) // 10 * 10, 1.0, None, "gold"),
        _t("w_kg", "Heavy Nets", "Land {n} kg of fish in total.", "catch", 20 + lvl * 4, 1.1, None, "kg"),
        _t("w_market", "Trader", "List {n} items on the player market.", "list", 3, 0.9),
        _t("w_water", "Far Waters", f"Land {{n}} fish at {w['name']}.", "catch", 25, 1.15, {"water": w["key"]}),
        _t("w_duel", "Pier Season", "Fish {n} duels this week.", "duel", rnd.choice([8, 10]), 1.2, needs="duel"),
        _t("w_duel_win", "Pier Champion's Week", "Win {n} duels this week.", "duel", rnd.choice([4, 5]), 1.35, {"won": True}, needs="duel"),
    ]
