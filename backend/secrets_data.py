"""Secret catches: species with a 0% normal spawn rate that only bite inside fixed UTC windows."""

SECRET_CHANCE = 0.06  # share of bites that hook the secret species while its window is open

# hours are UTC, [start, end), a window may wrap past midnight
SECRET_FISH = [
    {"id": 282, "name": "Starlight Ray", "water": "coral", "rarity": "legendary", "min_kg": 18.0, "max_kg": 60.0, "behavior": "jumper", "value_mod": 3.4,
     "blurb": "A ray whose back mirrors the night sky. Seen only when the stars are out.", "baitable": False, "secret": True,
     "hours": [22, 4], "window_label": "Night · 22:00–04:00 UTC"},
    {"id": 283, "name": "Dawnfire Carp", "water": "millbrook", "rarity": "epic", "min_kg": 6.0, "max_kg": 22.0, "behavior": "sluggish", "value_mod": 3.0,
     "blurb": "Scales the colour of the first light. It rises with the sun and is gone by breakfast.", "baitable": False, "secret": True,
     "hours": [5, 8], "window_label": "Dawn · 05:00–08:00 UTC"},
    {"id": 284, "name": "Vesper Eel", "water": "blackwater", "rarity": "epic", "min_kg": 8.0, "max_kg": 40.0, "behavior": "diver", "value_mod": 3.1,
     "blurb": "Hunts the mangrove channels in the half hour of red light, then sinks into the mud.", "baitable": False, "secret": True,
     "hours": [17, 20], "window_label": "Dusk · 17:00–20:00 UTC"},
]
SECRET_BY_ID = {f["id"]: f for f in SECRET_FISH}
SECRET_TITLE = "Keeper of Secrets"


def window_open(f, hour: int) -> bool:
    a, b = f["hours"]
    return a <= hour < b if a < b else (hour >= a or hour < b)


def hours_until_open(f, hour: int, minute: int) -> int:
    """Minutes until the window next opens (0 if open now)."""
    if window_open(f, hour):
        return 0
    a = f["hours"][0]
    return ((a - hour) % 24) * 60 - minute


def minutes_until_close(f, hour: int, minute: int) -> int:
    b = f["hours"][1]
    return ((b - hour) % 24) * 60 - minute

# Dockside rumours: vague, never a number. Keyed by species id.
SECRET_RUMOURS = {
    282: ["They say a ray swims the reef with the sky on its back. You'll only see it when the stars are out.",
          "Old divers at Coral Shoals talk of a ray that glitters like a clear night. Nobody has seen it by day."],
    283: ["A carp the colour of first light lives in the village pond. Early risers swear by it; the rest of us never catch it.",
          "If you're at Millbrook when the sun comes up, look for a flash of fire in the shallows. Gone by breakfast, they say."],
    284: ["The mangrove channels turn red for a spell each evening. Something long and dark hunts in that light and sinks when it fades.",
          "Blackwater folk won't cast at dusk. Ask them why and they change the subject. An eel, one told me. Just an eel."],
}
