"""Fish mastery: 10 levels per species, earned purely from how many of that species you have landed (journal count)."""
import math

BASE = [2, 5, 10, 20, 35, 60, 100, 150, 220, 300]
SCALE = {"common": 1.0, "uncommon": 0.7, "rare": 0.45, "epic": 0.25, "legendary": 0.1, "mythic": 0.05}
MAX_LEVEL = 10


def thresholds(rarity):
    out, prev = [], 0
    for b in BASE:
        v = max(prev + 1, math.ceil(b * SCALE.get(rarity, 1.0)))
        out.append(v); prev = v
    return out


def level_for(rarity, count):
    return sum(1 for t in thresholds(rarity) if count >= t)


def next_threshold(rarity, count):
    for t in thresholds(rarity):
        if count < t: return t
    return None


def perks(level):
    """Species-specific bonuses at a mastery level."""
    return {"value_mult": 1 + 0.02 * level, "xp_mult": 1 + 0.02 * level,
            "stamina_mult": 1 - (0.15 if level >= 9 else 0.10 if level >= 6 else 0.05 if level >= 3 else 0.0),
            "weight_mult": 1 + (0.10 if level >= 10 else 0.05 if level >= 5 else 0.0),
            "variant_mult": 1.5 if level >= 7 else 1.0}


def perk_lines(level):
    out = []
    if level >= 1: out.append(f"+{2 * level}% vendor price & XP")
    if level >= 3: out.append(f"tires {int(round((1 - perks(level)['stamina_mult']) * 100))}% faster")
    if level >= 5: out.append(f"+{int(round((perks(level)['weight_mult'] - 1) * 100))}% weight roll")
    if level >= 7: out.append("variants 1.5× as likely")
    if level >= 10: out.append("Master title & Pearl")
    return out


def info(rarity, count):
    lvl = level_for(rarity, count)
    return {"level": lvl, "next": next_threshold(rarity, count), "perks": perk_lines(lvl)}
