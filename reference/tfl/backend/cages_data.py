"""Crab Cages: single-use AFK traps placed at a water. Each water has 5 cage-only species (one per rarity, common to legendary)."""

CAGES = [
    {"id": "cage_wicker", "name": "Wicker Crab Cage", "price": 300, "pearls": 0, "level": 1, "gap": (45, 60),
     "weights": {"common": 60, "uncommon": 28, "rare": 10, "epic": 2, "legendary": 0},
     "desc": "A woven willow basket with a bait cup. Cheap, catches the common stuff."},
    {"id": "cage_iron", "name": "Iron Crab Cage", "price": 1500, "pearls": 0, "level": 10, "gap": (30, 50),
     "weights": {"common": 40, "uncommon": 33, "rare": 19, "epic": 7, "legendary": 1},
     "desc": "A heavy tarred iron frame. Fills faster and tempts bigger, rarer critters."},
    {"id": "cage_abyssal", "name": "Abyssal Crab Cage", "price": 0, "pearls": 4, "level": 1, "gap": (20, 35),
     "weights": {"common": 25, "uncommon": 32, "rare": 26, "epic": 13, "legendary": 4},
     "desc": "Brass-bound and glowing faintly. The fastest cage and the best shot at a legendary."},
]
CAGE_BY_ID = {c["id"]: c for c in CAGES}
MAX_SOAK_H = 8
CAGE_XP_MULT = 0.5  # AFK catches give half the XP of a fought fish

_KG = {"common": (0.05, 0.5), "uncommon": (0.1, 1.2), "rare": (0.3, 3.0), "epic": (1.0, 8.0), "legendary": (2.0, 14.0)}
_R = ["common", "uncommon", "rare", "epic", "legendary"]
_SPECIES = {
    "millbrook": [("Mudbug Crayfish", "A little brown crayfish that backs into the pond silt when lifted."),
                  ("Swan Mussel", "A broad green-brown freshwater mussel, often as big as a hand."),
                  ("Great Diving Beetle", "A glossy olive water beetle with a gold rim, fierce for its size."),
                  ("Mill Eel", "A dark eel that slips through the old mill race at night."),
                  ("Golden Crayfish", "A crayfish with a shell like polished brass. Millers called it luck.")],
    "willow": [("River Crayfish", "A speckled crayfish that hides under willow roots."),
               ("Mitten Crab", "A small crab with furry claws that wanders up from the sea."),
               ("Brook Lamprey", "A slender, eel-like jawless fish with a round sucker mouth."),
               ("Noble Crayfish", "A big dark crayfish with red-tipped claws."),
               ("Silver Willow Eel", "A pale silver eel that shines like moonlight on the river.")],
    "greyfell": [("Tarn Shrimp", "A clear little shrimp from the cold mountain water."),
                 ("Pearl Mussel", "A dark, ridged mussel. One in a thousand holds a pearl."),
                 ("Highland Crayfish", "A stocky blue-grey crayfish built for icy lakes."),
                 ("Frost Eel", "A blue-white eel that hunts beneath the lake ice."),
                 ("Greyfell Glass Crab", "A see-through crab with a faint glowing heart.")],
    "saltmarsh": [("Shore Crab", "A green little crab that scuttles across the mudflats."),
                  ("Mud Shrimp", "A pink burrowing shrimp with one oversized claw."),
                  ("Blue Swimmer Crab", "A sky-blue crab with paddle-shaped back legs."),
                  ("Conger Eel", "A thick grey sea eel with a wide, grumpy mouth."),
                  ("Saltmarsh King Crab", "A huge spiny crab, wide as a cartwheel.")],
    "harrow": [("Velvet Crab", "A feisty crab with red eyes and a velvety brown shell."),
               ("Common Whelk", "A big spiralled sea snail with a cream shell."),
               ("Edible Crab", "A chunky orange crab with a pie-crust edged shell."),
               ("European Lobster", "A deep blue-black lobster with heavy claws."),
               ("Harrow Blue Lobster", "A lobster coloured bright cobalt blue. Very rare.")],
    "coral": [("Hermit Crab", "A little crab living in a borrowed spiral shell."),
              ("Long-spined Urchin", "A black sea urchin bristling with long spines."),
              ("Spiny Lobster", "A spotted orange lobster with long spiky antennae and no claws."),
              ("Peacock Mantis Shrimp", "A rainbow-coloured shrimp with a punch like a hammer."),
              ("Rainbow Slipper Lobster", "A flat, shovel-headed lobster striped in every colour.")],
    "blackwater": [("Fiddler Crab", "A small crab with one giant bright orange claw."),
                   ("Mangrove Snail", "A striped snail that climbs mangrove roots."),
                   ("Mud Crab", "A big dark green crab with crushing claws."),
                   ("Swamp Moray", "A spotted yellow-brown moray eel with needle teeth."),
                   ("Blackwater Shadow Crab", "A jet-black crab with glowing violet eyes.")],
    "frozen": [("Ice Shrimp", "A pale pink shrimp from under the sea ice."),
               ("Snow Crab", "A long-legged orange-white crab from the frozen deep."),
               ("Arctic Whelk", "A frosted white spiral sea snail."),
               ("Red King Crab", "A giant spiky red crab with long legs."),
               ("Glacier Isopod", "A huge ice-blue armoured sea bug, like a giant woodlouse.")],
    "sunken": [("Decorator Crab", "A crab covered in bits of sponge and weed as a disguise."),
               ("Sea Spider", "A spindly long-legged sea creature with a tiny body."),
               ("Ruin Lobster", "A lobster with a mossy stone-grey shell from the sunken city."),
               ("Giant Isopod", "A big pale armoured sea bug the size of a cat."),
               ("Crowned Relic Crab", "A crab wearing a tiny golden crown it found in the ruins.")],
    "ghostlight": [("Glow Shrimp", "A shrimp that glows soft cyan in the dark."),
                   ("Lantern Squidling", "A tiny squid with a glowing lantern spot."),
                   ("Ghost Crab", "A pale, almost white crab with big stalked eyes."),
                   ("Phantom Eel", "A see-through eel with glowing blue bones."),
                   ("Spectral Crab", "A ghostly glowing teal crab, half there and half not.")],
    "temple": [("Jade Shrimp", "A green shrimp the colour of temple jade."),
               ("Temple Snail", "A snail with a golden spiral shell carved like a temple roof."),
               ("Gilded Crayfish", "A crayfish with gold leaf patterns on its shell."),
               ("Serpent Eel", "A green and gold eel patterned like the temple serpents."),
               ("Idol Crab", "A crab with a shell shaped like a stone idol face.")],
    "cinder": [("Ash Shrimp", "A grey shrimp dusted with volcanic ash."),
               ("Vent Snail", "A snail with a black iron-plated shell from the hot vents."),
               ("Ember Crab", "A crab with glowing orange cracks in its black shell."),
               ("Magma Eel", "A black eel with glowing lava-red stripes."),
               ("Obsidian Lobster", "A glassy black lobster with glowing orange claws.")],
}

CAGE_FISH = []
_WATERS = list(_SPECIES)
for _wi, (_wk, _list) in enumerate(_SPECIES.items()):
    for _ri, (_name, _blurb) in enumerate(_list):
        _mn, _mx = _KG[_R[_ri]]
        _big = 3.0 if any(w in _name for w in ("Eel", "Lobster", "King", "Moray", "Lamprey", "Isopod")) else 1.0
        CAGE_FISH.append({"id": 601 + _wi * 5 + _ri, "name": _name, "water": _wk, "rarity": _R[_ri], "min_kg": round(_mn * _big, 2), "max_kg": round(_mx * _big, 2),
                          "behavior": "steady", "value_mod": round(1.0 + _wi * 0.12, 2), "blurb": _blurb, "baitable": True, "cage": True})
CAGE_FISH_BY_WATER = {w: [f for f in CAGE_FISH if f["water"] == w] for w in _WATERS}
