"""Real-world style length from weight: W(g) = a * L(cm)^3, with `a` set by body shape."""

EEL = ("eel", "lamprey", "oarfish", "ribbon", "serpent", "snake", "wyrm")
SLENDER = ("pike", "gar", "barracuda", "needle", "muskie", "muskellunge", "zander", "pickerel", "wahoo", "marlin", "sailfish", "swordfish", "trumpet", "lance", "sturgeon", "catfish")
DEEP = ("gill", "sunfish", "crappie", "pumpkinseed", "bream", "carp", "koi", "piranha", "pomfret", "angel", "tang", "discus", "butterfly", "opah", "pacu", "grouper", "puffer", "boxfish", "batfish", "turbot", "halibut", "flounder", "ray", "skate", "moonfish", "mola")


def shape_a(name):
    n = (name or "").lower()
    if any(k in n for k in EEL):
        return 0.0018
    if any(k in n for k in SLENDER):
        return 0.0075
    if any(k in n for k in DEEP):
        return 0.028
    return 0.013


def fish_length(f, weight):
    return round(((max(weight, 0.001) * 1000) / shape_a(f.get("name"))) ** (1 / 3), 1)
