"""Angler avatar portraits. price 0 = free starter face (pickable at registration)."""

AVATARS = [
    # --- starters ---
    {"id": "av_lad", "name": "Millbrook Lad", "sex": "m", "price": 0,
     "look": "a freckled young man of about nineteen with tousled sandy hair under a worn flat cap, an eager grin, a simple cane rod resting on his shoulder, soft morning light over a reedy pond"},
    {"id": "av_lass", "name": "Millbrook Lass", "sex": "f", "price": 0,
     "look": "a cheerful young woman with a thick auburn braid under a wide straw hat, sun-browned cheeks, a linen shirt with rolled sleeves, willows and a calm pond behind"},
    {"id": "av_riverman", "name": "Riverman", "sex": "m", "price": 0,
     "look": "a middle-aged man with a full dark beard flecked with grey, a waxed canvas jacket, a clay pipe in the corner of his mouth, calm knowing eyes, a misty river bank behind"},
    {"id": "av_netmender", "name": "Net Mender", "sex": "f", "price": 0,
     "look": "an older woman with a deeply weathered kind face, a faded blue headscarf, holding a wooden net needle, coils of fishing net over her shoulder, a harbour wall behind"},
    {"id": "av_dockhand", "name": "Dockhand", "sex": "m", "price": 0,
     "look": "a stocky broad-shouldered young man with a wool beanie, stubble, a striped jersey with sleeves rolled to the elbow, rope over one shoulder, wooden dock pilings behind"},
    {"id": "av_ferrywoman", "name": "Ferrywoman", "sex": "f", "price": 0,
     "look": "a strong woman in her thirties in a dark oilskin coat with the hood thrown back, wind-blown black hair, steady grey eyes, an estuary with a small ferry boat behind"},
    # --- premium (Pearls) ---
    {"id": "av_captain", "name": "Storm Captain", "sex": "m", "price": 10,
     "look": "a grizzled sea captain with a thick grey beard, a peaked navy cap with tarnished gold braid, a heavy double-breasted coat, rain on his face, a dramatic lightning storm and black waves behind"},
    {"id": "av_lanternkeeper", "name": "Lantern Keeper", "sex": "f", "price": 10,
     "look": "a woman with pale skin and long dark hair holding up a glowing brass lantern that lights her face warmly from below, thick fog and the faint shapes of moored boats at night behind"},
    {"id": "av_lighthouse", "name": "Lighthouse Keeper", "sex": "m", "price": 15,
     "look": "an elderly man with round brass spectacles, a white walrus moustache, a knitted cable jumper and sou'wester hat, the sweeping beam of a lighthouse cutting through a night storm behind"},
    {"id": "av_harpooner", "name": "Harpooner", "sex": "m", "price": 15,
     "look": "a fierce weather-beaten man with a shaved head, a long scar across one cheek, dark nautical tattoos on his neck, gripping a whalebone harpoon, sea spray and a breaching whale tail behind"},
    {"id": "av_pearldiver", "name": "Pearl Diver", "sex": "f", "price": 15,
     "look": "a young woman with wet dark hair slicked back, water droplets on bronze skin, a necklace of luminous pearls and a shell knife, shafts of turquoise sunlight through clear water behind"},
    {"id": "av_brassdiver", "name": "Deepwater Diver", "sex": "m", "price": 20,
     "look": "a man wearing an antique riveted brass diving helmet with the round front visor open showing his intense face, a canvas diving suit, rising bubbles and dark green deep water behind"},
    {"id": "av_tidewitch", "name": "Tide Witch", "sex": "f", "price": 20,
     "look": "a mysterious woman with silver-streaked hair, a shawl woven from dark kelp and fishing net, jewellery of glowing green sea glass, piercing eyes, a moonlit tide and wet black rocks behind"},
    {"id": "av_ghostangler", "name": "Ghostlight Angler", "sex": "m", "price": 25,
     "look": "a gaunt pale angler with hollow cheeks and a long wet coat, a faint cold blue glow on his face from a luminous lure he holds up, ghostly blue will-o'-the-wisp lights over a black marsh behind"},
    {"id": "av_saltqueen", "name": "Salt Queen", "sex": "f", "price": 25,
     "look": "a regal woman with dark skin and proud bearing, a crown of white coral, pearls and gold, a high collar of scale-patterned cloth, a sunset over a glittering salt flat behind"},
    {"id": "av_krakenhunter", "name": "Kraken Hunter", "sex": "f", "price": 25,
     "look": "a fierce woman with a leather eyepatch, wild red hair, a heavy coat with claw and sucker scars across it, a coil of chain over her shoulder, the massive shadow of a kraken tentacle rising from dark water behind"},
    # --- creatures & vessels (Pearls) ---
    {"id": "av_shellback", "name": "Old Shellback", "sex": "x", "kind": "creature", "price": 15,
     "look": "an ancient giant sea turtle, its wise wrinkled head and beak turned toward the viewer, barnacles and moss on its shell, small fish sheltering beside it, warm shafts of sunlight through blue-green water"},
    {"id": "av_reefoctopus", "name": "Reef Octopus", "sex": "x", "kind": "creature", "price": 15,
     "look": "a large intelligent octopus with rust-red mottled skin and one huge golden eye fixed on the viewer, curling patterned arms with pale suckers, a sunlit coral reef softly behind"},
    {"id": "av_lanternfish", "name": "Abyss Lantern", "sex": "x", "kind": "creature", "price": 20,
     "look": "a fearsome deep-sea anglerfish, needle teeth, glassy eyes, its glowing lure casting cold blue-green light over its head, absolute black water behind"},
    {"id": "av_hammerhead", "name": "Hammerhead", "sex": "x", "kind": "creature", "price": 20,
     "look": "a great hammerhead shark seen head-on and slightly from below, wide flat head, scarred grey skin, silver light rippling from the surface above, deep blue open ocean behind"},
    {"id": "av_bluemarlin", "name": "Blue Marlin", "sex": "x", "kind": "creature", "price": 20,
     "look": "a mighty blue marlin bursting from the sea, head and long spear-like bill dominant, electric cobalt and silver flanks, sea spray flying, a golden storm-lit horizon behind"},
    {"id": "av_orca", "name": "Orca", "sex": "x", "kind": "creature", "price": 25,
     "look": "a powerful orca surfacing head-first, glossy black and white markings, a piercing dark eye, water sheeting from its head, grey northern fjord cliffs and mist behind"},
    {"id": "av_leviathan", "name": "Leviathan", "sex": "x", "kind": "creature", "price": 35,
     "look": "a colossal sea serpent's head rising from a black storm sea, armoured emerald and bronze scales, a spined crest, a glowing amber eye and a mouth of long teeth, lightning behind"},
    {"id": "av_kraken", "name": "The Kraken", "sex": "x", "kind": "creature", "price": 40,
     "look": "the head of a monstrous kraken filling the frame, a vast unblinking eye glowing faintly gold, wet mottled crimson-black skin, enormous tentacles rising around it, a doomed lantern-lit ship tiny in the storm behind"},
    {"id": "av_lanternketch", "name": "Lantern Ketch", "sex": "x", "kind": "vessel", "price": 20,
     "look": "a handsome wooden motor-sailing ketch from around 1920 with a dark green hull, tan sails half set, warm oil lanterns glowing along the rigging, anchored in a calm violet dusk harbour"},
    {"id": "av_irontrawler", "name": "Iron Trawler", "sex": "x", "kind": "vessel", "price": 25,
     "look": "a rugged early-twentieth-century iron steam trawler with a tall black funnel trailing smoke, a rust-red streaked hull, seen close from the bow ploughing head-on through a heavy grey-green sea"},
    {"id": "av_pumpkin", "name": "Pumpkin Head", "sex": "m", "price": None, "event": "halloween", "earned": "Traded for Soul Candles at the Marsh Witch (Halloween)",
     "look": "a tall angler whose head is a grinning carved jack-o'-lantern glowing orange from within, a tattered black oilskin coat, a fishing rod over his shoulder, autumn night mist behind"},
    # --- duel marks only ---
    {"id": "av_duellist", "name": "The Duellist", "sex": "m", "price": None, "duel": 25,
     "look": "a lean sharp-eyed angler in his thirties with a dark waxed moustache, a black wide-brimmed hat, a high-collared charcoal coat with a single gold rod-pin at the lapel, two fishing rods crossed behind his shoulders like duelling swords, a cold grey dawn over a still lake behind"},
]
AVATARS += [
    # --- grand portraits ---
    {"id": "av_stormwarden", "name": "Storm Warden", "sex": "m", "price": 30,
     "look": "a towering grey-bearded harbour warden in a rain-lashed oilskin hood, lightning reflected in fierce pale eyes, a brass storm-lantern held high, black clouds and whitecaps behind"},
    {"id": "av_sirenshoals", "name": "Siren of the Shoals", "sex": "f", "price": 35,
     "look": "a haunting sea-siren with wet silver-green hair threaded with pearls and tiny shells, luminous eyes, mother-of-pearl scales along her cheekbones and collarbones, moonlit shoals behind"},
    {"id": "av_abyssangler", "name": "Abyssal Anglerfish", "sex": "x", "kind": "creature", "price": 35,
     "look": "a monstrous deep-sea anglerfish, its glowing lure casting the only light in pitch-black water, needle teeth, translucent skin showing veins, motes drifting in the dark"},
    {"id": "av_moonwhale", "name": "Moon Whale", "sex": "x", "kind": "creature", "price": 40,
     "look": "a colossal pale whale breaching at night beneath a huge full moon, water cascading off its barnacled head, glowing bioluminescent patterns along its skin, stars above"},
    {"id": "av_drownedcaptain", "name": "The Drowned Captain", "sex": "m", "price": 45,
     "look": "a ghostly drowned sea captain, waterlogged tricorn hat dripping, pale translucent skin with a faint green phosphorescent glow, barnacles on his coat, eyes like distant lanterns, sunken ship timbers behind"},
    {"id": "av_coralempress", "name": "Coral Empress", "sex": "f", "price": 45,
     "look": "a regal dark-skinned empress crowned with living branching coral in crimson and gold, a collar of anemones and nautilus shells, calm commanding gaze, sunlit turquoise reef water filling the whole background edge to edge, no picture frame, no border"},
    {"id": "av_seadragon", "name": "Sea Dragon", "sex": "x", "kind": "creature", "price": 55,
     "look": "a magnificent sea dragon rising from a storm swell, jade and sapphire scales streaming water, fin-like whiskers, golden eyes, lightning glinting on its horns"},
    {"id": "av_goldenkoi", "name": "Golden Koi Spirit", "sex": "x", "kind": "creature", "price": 60,
     "look": "a mythical giant golden koi spirit swimming through air among drifting cherry blossom and lantern light, scales like molten gold leaf, trailing wisps of light, a sacred pond at dusk behind"},
 # --- personal, never sold (granted by code) ---
    {"id": "av_niels", "name": "Niels", "sex": "m", "price": None, "look": "the game owner's own portrait"},
    {"id": "av_storm_titan", "name": "Storm Titan", "sex": "x", "price": None, "shop": True, "animated": True, "earned": "Donate page cosmetic", "look": "a giant of living lightning"},
    {"id": "av_kraken_lord", "name": "Kraken Lord", "sex": "x", "price": None, "shop": True, "animated": True, "earned": "Donate page cosmetic", "look": "a monocled kraken captain"},
    {"id": "av_leviathan_king", "name": "Leviathan King", "sex": "m", "price": None, "shop": True, "animated": True, "earned": "Donate page cosmetic", "look": "a crowned madman riding a sea serpent through a lightning storm"},
    {"id": "av_founder", "name": "Golden Founder", "sex": "m", "price": None, "shop": True, "animated": True, "earned": "Limited Golden Founder Pack (only 10 ever sold)", "look": "a golden captain against a rising sun"},
]
AVATAR_BY_ID = {a["id"]: a for a in AVATARS}
STARTER_AVATARS = [a["id"] for a in AVATARS if a["price"] == 0]

# Chat name colours (Pearl Shop). Default name colour is free and always available.
NAME_COLOURS = [
    {"id": "col_kelp", "name": "Kelp Green", "hex": "#6fd18a", "price": 8},
    {"id": "col_lagoon", "name": "Lagoon Blue", "hex": "#5ec8e8", "price": 8},
    {"id": "col_coral", "name": "Coral", "hex": "#ff8a70", "price": 10},
    {"id": "col_sunset", "name": "Harbour Sunset", "hex": "#f6a53a", "price": 10},
    {"id": "col_seaglass", "name": "Sea Glass", "hex": "#9ff2d8", "price": 12},
    {"id": "col_lavender", "name": "Tide Lavender", "hex": "#c9a6ff", "price": 12},
    {"id": "col_rose", "name": "Rosefin Pink", "hex": "#ff9ad5", "price": 12},
    {"id": "col_abyss", "name": "Abyssal Teal", "hex": "#2fd6c1", "price": 15},
    {"id": "col_ember", "name": "Lantern Ember", "hex": "#ff5f4a", "price": 15},
    {"id": "col_moonlit", "name": "Moonlit Silver", "hex": "#e8eef7", "price": 15},
    {"id": "col_duel", "name": "Duelling Crimson", "hex": "#e34a4a", "price": None, "duel": 30, "earned": "Retired: sold in the old Duellist's Shop"},
]
COLOUR_BY_ID = {c["id"]: c for c in NAME_COLOURS}

# Portrait frames (Pearl Shop). Rendered with CSS classes av-frame-<id>; "none" is the default plain border.
FRAMES = [
    {"id": "frame_rope", "name": "Hemp Rope", "price": 10, "desc": "A coil of tarred dock rope."},
    {"id": "frame_driftwood", "name": "Driftwood", "price": 12, "desc": "Sun-bleached planks, salt in the grain."},
    {"id": "frame_brass", "name": "Brass Bezel", "price": 12, "desc": "Polished brass with four rivets, like a ship's gauge."},
    {"id": "frame_kelp", "name": "Kelp Wreath", "price": 15, "desc": "Deep green fronds knotted round the edge."},
    {"id": "frame_coral", "name": "Coral Reef", "price": 15, "desc": "Warm reef coral and a hint of sunlit water."},
    {"id": "frame_seaglass", "name": "Sea Glass", "price": 18, "desc": "Frosted teal glass with a soft inner glow."},
    {"id": "frame_abyss", "name": "Abyssal", "price": 20, "desc": "Black depths and a slow blue pulse."},
    {"id": "frame_ghostlight", "name": "Ghostlight", "price": 25, "desc": "A cold cavern glow that breathes."},
    {"id": "frame_duel", "name": "Crossed Rods", "price": None, "duel": 15, "earned": "Retired: sold in the old Duellist's Shop", "desc": "Two rods crossed in gold, worn by those who have stood the duel clock."},
    {"id": "frame_laurel", "name": "Champion's Laurel", "price": None, "duel": 60, "earned": "Retired: sold in the old Duellist's Shop", "desc": "A wreath of gilded laurel over deep crimson. Only pier champions wear it."},
    {"id": "frame_tidekeeper", "name": "Loyal Tidekeeper", "price": None, "earned": "Keep an Angler Pass renewing for 3 months in a row", "desc": "Silver tide-rings around a warm ember heart, worn by the harbour's most loyal supporters."},
    {"id": "frame_dragonfire", "name": "Dragonfire Ring", "price": None, "shop": True, "animated": True, "earned": "Donate page cosmetic", "desc": "Flames and a fire-breathing dragon."},
    {"id": "frame_frost", "name": "Frozen Abyss", "price": None, "shop": True, "animated": True, "earned": "Donate page cosmetic", "desc": "Ice spikes and a frost serpent."},
    {"id": "frame_maw", "name": "Abyssal Maw", "price": None, "shop": True, "animated": True, "earned": "Donate page cosmetic", "desc": "The breathing jaws of an abyssal anglerfish."},
    {"id": "frame_founder", "name": "Founder's Sun", "price": None, "shop": True, "animated": True, "earned": "Limited Golden Founder Pack (only 10 ever sold)", "desc": "Gilded sun rays, a crown and two golden koi."},
    {"id": "frame_owner", "name": "Game Owner", "price": None, "owner": True, "earned": "Worn only by the creator of FishyLand", "desc": "A gilded crown-topped frame, worn only by the creator of FishyLand."},
    {"id": "frame_galley", "name": "Galley Copper", "price": None, "earned": "Become an Old Friend of Cook Marisol Vane on the Contract Board", "desc": "Hammered copper with a warm hearth glow, straight from the galley."},
    {"id": "frame_app", "name": "App Angler", "price": None, "earned": "Play once from the installed app (phone or PC)", "desc": "A night-blue bezel with a soft screen glow, for anglers who keep the docks one tap away."},
    {"id": "frame_jackolantern", "name": "Jack-o'-Lantern", "price": None, "event": "halloween", "earned": "Traded for Soul Candles at the Marsh Witch (Halloween)", "desc": "A carved pumpkin rim that flickers with candlelight."},
    {"id": "frame_legend", "name": "Legend's Gold", "price": 30, "desc": "Ornate gold that catches the light. For those who have earned it."},
]
FRAME_BY_ID = {f["id"]: f for f in FRAMES}


# Guestbook wall themes (Pearl Shop). Rendered with CSS classes gb-wall-<id>; "none" is the default panel.
WALLS = [
    {"id": "wall_parchment", "name": "Aged Parchment", "price": 12, "desc": "Cream vellum, ink-stained edges. Reads like a captain's journal."},
    {"id": "wall_driftwood", "name": "Driftwood Board", "price": 15, "desc": "Salt-bleached planks nailed to the dockside notice board."},
    {"id": "wall_brass", "name": "Brass Plaque", "price": 18, "desc": "Polished brass with riveted corners and a warm gold sheen."},
    {"id": "wall_kelp", "name": "Kelp Grotto", "price": 20, "desc": "Cool green fronds drape the frame; a quiet cove of a page."},
    {"id": "wall_ghostlight", "name": "Ghostlight Cavern", "price": 25, "desc": "A cold cavern glow breathes across the parchment. Whispers only."},
    {"id": "wall_legend", "name": "Legend's Ledger", "price": 30, "desc": "Ornate gold trim, deep leather, and a slow shine. For the truly named."},
    # --- painted walls (image backgrounds, /art/walls/<id>.jpg) ---
    {"id": "wall_starlit", "name": "Starlit Deck", "price": 30, "art": True, "desc": "The night sky over a quiet deck, the Milky Way spilling across the page.",
     "scene": "the wooden deck rail of an old sailing ship at night under a vast Milky Way full of stars, calm dark sea, a single hanging lantern, deep blues and indigo"},
    {"id": "wall_coralreef", "name": "Sunlit Reef", "price": 35, "art": True, "desc": "Shafts of sunlight over a living coral reef; shoals drift past your entries.",
     "scene": "an underwater coral reef with shafts of sunlight falling from the surface, shoals of small silver fish, anemones, turquoise water, soft and dreamy"},
    {"id": "wall_wreck", "name": "Sunken Wreck", "price": 40, "art": True, "desc": "The ribs of a lost galleon in green gloom, treasure glinting between the timbers.",
     "scene": "the interior of a sunken galleon wreck in murky green-blue water, broken timbers, a scattering of gold coins glinting, a shaft of pale light, ghostly and atmospheric"},
    {"id": "wall_storm", "name": "Storm Sea", "price": 45, "art": True, "desc": "Black clouds, white spray and a fork of lightning across the horizon.",
     "scene": "a dramatic storm at sea, towering dark waves with white spray, black rolling clouds, a fork of lightning on the horizon, painterly and cinematic"},
    {"id": "wall_koipond", "name": "Golden Koi Pond", "price": 50, "art": True, "desc": "Golden koi glide under drifting blossom on still dusk water.",
     "scene": "a serene pond at dusk seen from above with large golden and orange koi gliding beneath the surface, drifting pink cherry blossom petals, soft lantern light reflections"},
    {"id": "wall_dragon", "name": "Sea Dragon's Hoard", "price": 60, "art": True, "desc": "A jade sea dragon coiled around a hoard of pearls in a lightning-lit grotto. The rarest wall in the harbour.",
     "scene": "a majestic jade and sapphire sea dragon coiled around a glowing hoard of giant pearls inside a dark sea grotto, lightning flickering through the cave mouth, epic fantasy painting"},
]
WALL_BY_ID = {w["id"]: w for w in WALLS}


def colour_hex(u):
    c = COLOUR_BY_ID.get(u.get("name_colour") or "")
    return c["hex"] if c else None
