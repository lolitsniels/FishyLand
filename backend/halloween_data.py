"""Halloween event data: limited fish (bite in every water while the event runs), the Marsh Witch's shop and the ghost boss."""

HALLOW_WATER = "hallow"
_F = [
    (900, "Gourdfin Sunfish", "common", 0.1, 0.6, "jumper", "A sunfish with a pumpkin-orange belly and ribs that glow like a carved grin."),
    (901, "Candlewick Minnow", "common", 0.02, 0.12, "runner", "Its tail flickers like a candle flame. Shoals of them light the shallows on autumn nights."),
    (902, "Cobweb Carp", "common", 1.0, 8.0, "steady", "Fine grey threads trail from its fins like old cobwebs. Smells faintly of attic dust."),
    (903, "Bone Perch", "uncommon", 0.2, 1.5, "thrasher", "Pale stripes over a near-transparent body. You can count its bones by lantern light."),
    (904, "Witch's Eel", "uncommon", 0.5, 4.0, "thrasher", "Black as a cauldron and twice as slippery. Old wives say it knows your name."),
    (905, "Lantern-Jaw Pike", "rare", 2.0, 15.0, "runner", "A pike with a jaw that glows orange from within, like a jack-o'-lantern with teeth."),
    (906, "Graveyard Gar", "rare", 3.0, 25.0, "diver", "Grey-green and tombstone-still until it strikes. Found wherever old willows lean over water."),
    (907, "Hexscale Koi", "epic", 2.0, 12.0, "jumper", "Every scale carries a tiny violet sigil. Nobody has managed to read them twice the same."),
    (908, "Moonlit Wraithfish", "epic", 5.0, 30.0, "diver", "Half there, half not. It casts no shadow under the full moon."),
    (909, "The Headless Haddock", "legendary", 4.0, 20.0, "thrasher", "It has no head and it still bites. Do not ask how."),
    (910, "The Pumpkin King Carp", "legendary", 20.0, 60.0, "sluggish", "A colossal carp, round and orange as a prize pumpkin, crowned with a stalk-like dorsal fin."),
    (911, "The Banshee of the Shallows", "mythic", 40.0, 150.0, "thrasher", "A pale, long-finned phantom fish whose wail carries across every water on Halloween night."),
]
HALLOW_FISH = [{"id": i, "name": n, "water": HALLOW_WATER, "rarity": r, "min_kg": a, "max_kg": b, "behavior": beh, "value_mod": 1.0, "blurb": bl,
                "baitable": False, "event": "halloween"} for i, n, r, a, b, beh, bl in _F]
HALLOW_IDS = {f["id"] for f in HALLOW_FISH}
CANDLES = {"common": 1, "uncommon": 3, "rare": 6, "epic": 15, "legendary": 40, "mythic": 120}
HALLOW_BITE = 0.10  # share of bites that are Halloween fish while the event runs
HALLOW_MYTHIC_MULT = 4  # the Banshee is 4x likelier than a normal mythic roll (~1 in 2,000 bites)

GHOST_BOSS = {"id": 1099, "water": None, "name": "The Phantom of Black Water", "kind": "colossal translucent ghost sturgeon with glowing orange ribs",
              "behavior": "diver", "min_kg": 600, "max_kg": 1400, "gold": 30000, "xp": 5000, "title": "Ghostbreaker", "ghost": True,
              "blurb": "It rises through every water at once, or so it seems. Whoever lands it is paid in Soul Candles by the Marsh Witch herself."}
GHOST_PERIOD_H = 6
GHOST_WINDOW_MIN = 30
GHOST_CANDLES = 150      # to the angler who lands it
GHOST_HOOK_CANDLES = 15  # to every angler who hooks it, landed or not

SHOP = [
    {"id": "rod_hexwood", "kind": "gear", "name": "Hexwood Rod", "price": 550, "level": 30,
     "desc": "Carved from a lightning-struck witch elm. Hex Hook: 8% of the fish you land bring a twin of the same species, in every water, all year. Never wears out."},
    {"id": "frame_jackolantern", "kind": "frame", "name": "Jack-o'-Lantern frame", "price": 220, "desc": "A carved pumpkin rim that flickers with candlelight."},
    {"id": "av_pumpkin", "kind": "avatar", "name": "Pumpkin Head portrait", "price": 140, "desc": "A grinning jack-o'-lantern angler in a tattered coat."},
    {"id": "potion_witch", "kind": "potion", "name": "Witch's Draught (3 energy potions)", "price": 30, "qty": 3, "desc": "Bubbling green brew. Three bottles of full energy potions."},
]
SHOP_BY_ID = {s["id"]: s for s in SHOP}
