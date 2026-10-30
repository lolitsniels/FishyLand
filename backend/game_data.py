RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic"]
RARITY_WEIGHT = {"common": 50, "uncommon": 26, "rare": 13, "epic": 7, "legendary": 3, "mythic": 1}
RARITY_XP = {"common": 12, "uncommon": 22, "rare": 45, "epic": 90, "legendary": 220, "mythic": 600}
RARITY_TIME = {"common": 20, "uncommon": 24, "rare": 28, "epic": 34, "legendary": 40, "mythic": 45}

VARIANTS = [
    {"id": "ancient", "name": "Ancient", "chance": 0.01, "mult": 5.0},
    {"id": "golden", "name": "Golden", "chance": 0.02, "mult": 3.0},
    {"id": "giant", "name": "Giant", "chance": 0.03, "mult": 2.0},
    {"id": "shiny", "name": "Shiny", "chance": 0.04, "mult": 1.5},
]

WATERS = [
    {"id": "crystal_lagoon", "name": "Crystal Lagoon", "unlock": 1, "rec_br": 0, "playable": True},
    {"id": "lotus_pagoda", "name": "Lotus Pagoda Lake", "unlock": 10, "rec_br": 8000, "playable": False},
    {"id": "thunder_falls", "name": "Thunder Falls", "unlock": 20, "rec_br": 15000, "playable": False},
    {"id": "ice_castle", "name": "Ice-Bound Castle Moat", "unlock": 35, "rec_br": 30000, "playable": False},
    {"id": "coral_sky", "name": "Coral Sky Reef", "unlock": 50, "rec_br": 50000, "playable": False},
    {"id": "shadowfen", "name": "Shadowfen Marsh", "unlock": 65, "rec_br": 80000, "playable": False},
    {"id": "dragon_caldera", "name": "Dragon's Caldera", "unlock": 80, "rec_br": 120000, "playable": False},
    {"id": "abyssal_rift", "name": "Abyssal Rift", "unlock": 100, "rec_br": 180000, "playable": False},
    {"id": "celestial_spring", "name": "Celestial Spring", "unlock": 120, "rec_br": 260000, "playable": False},
    {"id": "ocean_throne", "name": "Ocean Throne", "unlock": 140, "rec_br": 400000, "playable": False},
]


def _f(id, name, rarity, wmin, wmax, value, strength, erratic, behavior, bait, lore):
    return {"id": id, "name": name, "rarity": rarity, "water": "crystal_lagoon", "weight": [wmin, wmax],
            "value": value, "strength": strength, "erratic": erratic, "behavior": behavior,
            "bait": bait, "lore": lore, "img": f"/art/fish/{id}.png", "icon": f"/art/fish/icons/{id}.webp"}


SPECIES = [
    _f("glimmer_minnow", "Glimmer Minnow", "common", 0.1, 0.6, 8, 0.2, 0.25, "steady", "worm", "Schools of them turn the shallows to liquid silver."),
    _f("azure_perch", "Azure Perch", "common", 0.4, 2.2, 14, 0.28, 0.3, "steady", "worm", "Its stripes are said to be painted by the Angel of the Tides."),
    _f("lagoon_carp", "Lagoon Carp", "uncommon", 2, 9, 32, 0.38, 0.32, "thrasher", "worm", "Fat, lazy and stubborn as a temple guard."),
    _f("coral_snapper", "Coral Snapper", "uncommon", 1.5, 7, 40, 0.42, 0.45, "runner", "glow_shrimp", "Grows tiny coral gardens along its spine."),
    _f("moonfin_trout", "Moonfin Trout", "rare", 3, 12, 95, 0.52, 0.5, "jumper", "glow_shrimp", "Only rises when the moons kiss the falls."),
    _f("prism_koi", "Prism Koi", "rare", 4, 16, 120, 0.55, 0.55, "steady", "glow_shrimp", "Splits sunlight into a hundred tiny rainbows."),
    _f("stormscale_pike", "Stormscale Pike", "epic", 10, 40, 320, 0.7, 0.68, "diver", "star_lure", "Its bite carries the thunder of distant storms."),
    _f("crystal_angelfish", "Crystal Angelfish", "epic", 6, 28, 360, 0.68, 0.72, "jumper", "star_lure", "A halo of light follows it wherever it swims."),
    _f("golden_sunray", "Golden Sunray", "legendary", 40, 180, 1500, 0.85, 0.8, "runner", "star_lure", "It glides beneath the lagoon like a fallen sun."),
    _f("starwhale", "Mythic Starwhale", "mythic", 300, 900, 8000, 1.0, 0.9, "diver", "star_lure", "A whole night sky lives inside its body."),
]
SPECIES_BY_ID = {s["id"]: s for s in SPECIES}

BEHAVIOR_TRICKS = {
    "steady": ["rally"], "runner": ["run", "rally"], "thrasher": ["shake", "dive"],
    "diver": ["dive", "dive", "shake"], "jumper": ["shake", "run"],
}

GEAR = {
    "rod": [
        {"tier": 1, "name": "Willow Rod", "stat": 1.0, "price": 0, "level": 1, "br": 300, "dur": 120},
        {"tier": 2, "name": "Coral Spine Rod", "stat": 1.15, "price": 2500, "level": 5, "br": 900, "dur": 160},
        {"tier": 3, "name": "Moonsilver Rod", "stat": 1.3, "price": 12000, "level": 12, "br": 2200, "dur": 200},
        {"tier": 4, "name": "Seraph Wing Rod", "stat": 1.5, "price": 60000, "level": 25, "br": 5200, "dur": 260},
        {"tier": 5, "name": "Celestial Trident Rod", "stat": 1.75, "price": 250000, "level": 40, "br": 11000, "dur": 320},
    ],
    "reel": [
        {"tier": 1, "name": "Brass Reel", "stat": 1.0, "price": 0, "level": 1, "br": 250, "dur": 120},
        {"tier": 2, "name": "Tidecaller Reel", "stat": 1.15, "price": 2000, "level": 5, "br": 750, "dur": 160},
        {"tier": 3, "name": "Pearl Reel", "stat": 1.3, "price": 10000, "level": 12, "br": 1900, "dur": 200},
        {"tier": 4, "name": "Stormheart Reel", "stat": 1.5, "price": 50000, "level": 25, "br": 4500, "dur": 260},
        {"tier": 5, "name": "Leviathan Reel", "stat": 1.75, "price": 200000, "level": 40, "br": 9500, "dur": 320},
    ],
    "line": [
        {"tier": 1, "name": "Hemp Line", "stat": 1.0, "price": 0, "level": 1, "br": 200, "dur": 100},
        {"tier": 2, "name": "Silk Line", "stat": 1.15, "price": 1500, "level": 5, "br": 600, "dur": 140},
        {"tier": 3, "name": "Mithril Line", "stat": 1.3, "price": 7500, "level": 12, "br": 1500, "dur": 180},
        {"tier": 4, "name": "Phoenix Line", "stat": 1.5, "price": 36000, "level": 25, "br": 3600, "dur": 230},
        {"tier": 5, "name": "Starweave Line", "stat": 1.75, "price": 150000, "level": 40, "br": 7800, "dur": 280},
    ],
}
GEAR_SLOTS = ["rod", "reel", "line"]

ENHANCE_MAX = 15
ENHANCE_CHANCE = [1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.28, 0.22, 0.17, 0.13, 0.1]

ITEMS = {
    "worm": {"name": "Basic Worm", "kind": "bait", "price": 0, "luck": 0.0, "desc": "Unlimited. Gets the job done."},
    "glow_shrimp": {"name": "Glow Shrimp", "kind": "bait", "price": 50, "luck": 0.35, "desc": "+35% rare bite chance."},
    "star_lure": {"name": "Starlight Lure", "kind": "bait", "price": 400, "luck": 1.0, "desc": "+100% rare bite chance."},
    "stamina_potion": {"name": "Stamina Potion", "kind": "potion", "price": 300, "desc": "+30 Stamina (can exceed max)."},
    "enhance_stone": {"name": "Enhance Stone", "kind": "material", "price": 150, "desc": "Used to enhance gear."},
    "protection_scroll": {"name": "Protection Scroll", "kind": "material", "price": 2000, "desc": "Prevents enhance level loss on failure."},
}

BASE_STAMINA = 100
STAMINA_REGEN_SEC = 180
WINGS_BR = 2400
PET_BR = 1500
FISHDEX_BR = 80
LEVEL_BR = 150
MAX_LEVEL = 200


def xp_needed(level: int) -> int:
    return int(80 * level ** 1.6)


def gear_def(slot: str, tier: int) -> dict:
    return GEAR[slot][tier - 1]


def public_data() -> dict:
    return {
        "waters": WATERS, "species": SPECIES, "gear": GEAR, "items": ITEMS, "variants": VARIANTS,
        "enhance_chance": ENHANCE_CHANCE, "enhance_max": ENHANCE_MAX,
        "xp_table": [xp_needed(i) for i in range(1, MAX_LEVEL + 1)],
    }
