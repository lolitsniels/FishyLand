"""Patron NPCs of the Harbour Contract Board and their favour ranks/perks. No server imports, server.py imports this."""

RANKS = ["Stranger", "Acquaintance", "Trusted", "Partner", "Old Friend"]
RANK_AT = [0, 100, 300, 650, 1200]  # favour points needed for rank 1..5
RANK_REWARDS = [None, {"gold": 400, "pearls": 0}, {"gold": 1200, "pearls": 1}, {"gold": 3000, "pearls": 2}, {"gold": 7500, "pearls": 3}]

PATRONS = {
    "harbourmaster": {"id": "harbourmaster", "name": "Harbourmaster Aldous Crane", "short": "the Harbourmaster", "role": "Keeper of the Ledger", "portrait": "/art/npc/harbourmaster.webp",
                      "wants": "bulk orders of everyday fish for the dock stores",
                      "perks": [{"key": "repair", "label": "-{n}% gear repair costs", "per": [0, 5, 10, 15, 20]}], "title": "Crane's Confidant"},
    "baitseller": {"id": "baitseller", "name": "Nettie Marsh", "short": "Nettie", "role": "Bait Seller", "portrait": "/art/npc/baitseller.webp",
                   "wants": "small fish for her bait tubs and odd-looking specimens for the curious",
                   "perks": [{"key": "bait", "label": "-{n}% on bait at the Tackle Shop", "per": [0, 5, 10, 15, 20]}], "title": "Nettie's Favourite"},
    "sailor": {"id": "sailor", "name": "Old Tobias", "short": "Old Tobias", "role": "Retired Sailor", "portrait": "/art/npc/sailor.webp",
               "wants": "heavy trophies and proof of skill from the far waters",
               "perks": [{"key": "slot", "label": "+{n} contract slot", "per": [0, 0, 1, 1, 1]}, {"key": "fee", "label": "-{n}% market fee on your sales", "per": [0, 0, 0, 0, 1]}], "title": "Tobias's Shipmate"},
    "cook": {"id": "cook", "name": "Cook Marisol Vane", "short": "the Cook", "role": "Galley Cook", "portrait": "/art/npc/cook.webp",
             "wants": "fish by the kilo for the galley pots and the finest cuts for the captain's table",
             "perks": [{"key": "gold", "label": "+{n}% gold on every contract", "per": [0, 5, 10, 15, 25]}, {"key": "frame", "label": "the Galley Copper portrait frame", "per": [0, 0, 0, 0, 1]}], "title": "Cook's Choice"},
}
COOK_FRAME = "frame_galley"


def rank_for(points):
    r = 1
    for i, at in enumerate(RANK_AT):
        if points >= at: r = i + 1
    return r


def patron_rank(user, pid):
    """Highest rank ever reached with a patron (favour spent on abandoning never demotes)."""
    pts = ((user.get("favour") or {}).get(pid, 0))
    return max(rank_for(pts), ((user.get("favour_rank") or {}).get(pid, 1)))


def perk_val(user, key):
    total = 0
    for pid, p in PATRONS.items():
        r = patron_rank(user, pid)
        for perk in p["perks"]:
            if perk["key"] == key: total += perk["per"][r - 1]
    return total
