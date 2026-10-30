"""Real-world style length from weight: W(g) = a * L(cm)^3, with `a` set by body shape."""
import re

EEL = ("eel", "moray", "lamprey", "oarfish", "ribbonfish", "serpent", "wyrm")
SLENDER = ("pike", "gar", "garfish", "barracuda", "needlefish", "muskie", "muskellunge", "zander", "pickerel", "wahoo", "marlin", "sailfish",
           "swordfish", "trumpetfish", "sturgeon", "catfish", "shark")
DEEP = ("bluegill", "sunfish", "crappie", "pumpkinseed", "bream", "carp", "koi", "piranha", "pomfret", "angelfish", "tang", "discus", "butterflyfish",
        "opah", "pacu", "grouper", "puffer", "boxfish", "batfish", "turbot", "halibut", "flounder", "ray", "manta", "skate", "moonfish", "mola")


def shape_a(name):
    words = re.findall(r"[a-z]+", (name or "").lower())
    has = lambda keys: any(w == k or w.endswith(k) for w in words for k in keys)
    if has(EEL):
        return 0.0018
    if has(SLENDER):
        return 0.0075
    if has(DEEP):
        return 0.028
    return 0.013


def fish_length(f, weight):
    return round(((max(weight, 0.001) * 1000) / shape_a(f.get("name"))) ** (1 / 3), 1)
