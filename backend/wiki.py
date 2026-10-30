"""Public rules/constants feed for the in-game Wiki. Add new tunables here whenever a feature ships."""
import enhance  # noqa: E402
from server import (api, db, MAX_ENERGY, ENERGY_REGEN_SEC, BOOST_ENERGY_MULT, CAST_COST, LIVE_BAIT_PER_FISH, VENDOR_RATE, MARKET_FEE, MAX_TROPHIES, CONTEST_PRIZES, CONTEST_LABEL, CREW_COST, CREW_MAX,
                    RARITY_BASE_VALUE, RARITY_XP, RARITY_WEIGHT, VARIANTS, WEATHERS, TIDES, WEATHER_TEXT, EVENT_PERIOD, EVENT_LENGTH, EVENT_LUCK, EVENT_BITE,
                    ACHIEVEMENTS, DAILY_COUNT, WEEKLY_COUNT, STREAK_DAYS, ALERT_WINDOW_MIN, xp_for_level,
                    MAX_DURABILITY, WORN_PENALTY, REPAIR_RATE, WEEKLY_PEARLS, STREAK_PEARLS, TITLE_ACH_PEARLS, BOSS_PEARLS, CONTEST_PEARLS,
                    CONTEST_DESC, CONTEST_UNIT, CONTEST_POOL, CREW_CONTEST_POOL, RARITY_POINTS, WEEKLY_CHAMPION_TITLE, WATER_BY_KEY, rarity_weights)
from secrets_data import SECRET_FISH, SECRET_CHANCE, SECRET_TITLE
from game_data import BAIT_ONLY_OTHER, RARE_SET_WEAR_SKIP, BAIT_BY_ID, FISH
from cosmetics import RENAME_COST
from avatars_data import AVATARS, NAME_COLOURS, FRAMES
from referrals_data import MENTOR_TITLE, APPLY_WINDOW_HOURS, APPLY_MAX_CATCHES, LEVEL_STEP, RECRUIT_LEVEL_PEARLS, TITLE_LEVEL, level_milestone
from quests_data import STORY_QUESTS
from bosses import BOSS_PERIOD, BOSS_WINDOW, BOSS_HOOK_CHANCE, CREW_SHARE, MAX_BOSS_MOUNTS
from bosses_data import BOSSES
from crew_hall import PERKS, HALL_NAMES, MARKET_SLOTS, TIER_REQS
from friends import FRIEND_LUCK
from login_chest import WHEEL, BETTER_WHEEL
import duel_ladder as _dl
import duel as _duel
import tournaments as _tour
from contracts import BOARD_SIZE, BASE_SLOTS, OFFER_HOURS, ACCEPT_HOURS, ABANDON_FAVOUR, DAILY_CAP, REFILL_HOURS, TIER_FAVOUR, SPECIAL_FAVOUR, TIER_PEARL, VALUE_MULT
from contracts_data import PATRONS, RANKS, RANK_AT, RANK_REWARDS
from crew_orders import BANK_SHARE, PER_MEMBER_GOLD, FAVOUR as ORDER_FAVOUR, PEARLS_BIG, PEARLS_SMALL, BIG_SHARE
import mastery

TITLES_BY_LEVEL = [(1, "Greenhorn"), (5, "Pond Regular"), (10, "River Warden"), (20, "Sea Hand"), (30, "Deepwater Captain"), (45, "Master Angler"), (70, "Grand Angler"), (100, "Centurion of the Deep"), (150, "Tidecaller"), (200, "Fathom Lord"), (250, "Living Myth")]


def _shares(w):
    tot = sum(w.values())
    return {k: round(v / tot * 100, 2) for k, v in w.items()}


@api.get("/wiki")
async def wiki():
    from crates import wiki_data as _crates
    return {
        "crates": _crates(),
        "energy": {"max": MAX_ENERGY, "regen_sec": ENERGY_REGEN_SEC, "cast_cost": CAST_COST, "boost_mult": BOOST_ENERGY_MULT},
        "live_bait_per_fish": LIVE_BAIT_PER_FISH,
        "enhance": {"trash_pct": round(enhance.TRASH_CHANCE * 100), "trash": [{k: t[k] for k in ("name", "scrap", "desc")} for t in enhance.TRASH], "deep_waters": sorted(enhance.DEEP_WATERS),
                    "max_level": enhance.MAX_LEVEL, "success": enhance.SUCCESS, "drop_from": enhance.DROP_FROM, "stat_pct": round(enhance.STAT_PER_LEVEL * 100), 
                    "costs": [{"level": n, "scrap": 8 * n * n, "gold_pct": 10 * n} for n in range(1, enhance.MAX_LEVEL + 1)], "bottle_gold_pct": round(enhance.BOTTLE_GOLD_CHANCE * 100), "bottle_seal_pct": enhance.BOTTLE_SEAL_CHANCE * 100},
        "bite": {"base_pct": 28, "period": {"dawn": 6, "day": 0, "dusk": 6, "night": -4}},
        "luck": {"period": {"dawn": 2, "day": 0, "dusk": 2, "night": 4}, "friend": FRIEND_LUCK, "expedition": EVENT_LUCK},
        "weather": [{"key": k, "bite": v[0], "luck": v[1], "text": WEATHER_TEXT[k]} for k, v in WEATHERS.items()],
        "tides": [{"key": k, "bite": v[0], "luck": v[1]} for k, v in TIDES.items()],
        "rarity": [{"key": k, "weight": RARITY_WEIGHT[k], "value": RARITY_BASE_VALUE[k], "xp": RARITY_XP[k]} for k in RARITY_BASE_VALUE],
        "luck_table": [{"luck": l, **_shares(rarity_weights(l))} for l in (0, 10, 20, 30, 40)],
        "groundbait": {"name": BAIT_BY_ID["bait_ground"]["name"], "price": BAIT_BY_ID["bait_ground"]["price"], "bite": BAIT_BY_ID["bait_ground"]["bite"], **_shares(rarity_weights(99, "bait_ground"))},
        "variants": [{"key": v[0], "chance_pct": round(v[1] * 100, 1), "value_mult": v[2]} for v in VARIANTS],
        "economy": {"vendor_rate": VENDOR_RATE, "market_fee": MARKET_FEE, "market_slots": MARKET_SLOTS, "max_trophies": MAX_TROPHIES},
        "levels": [{"level": lv, "xp": xp_for_level(lv), "title": next((t for l, t in reversed(TITLES_BY_LEVEL) if lv >= l), "Greenhorn")} for lv in (1, 5, 10, 20, 30, 45, 70, 100, 150, 200, 250)],
        "quests": {"daily": DAILY_COUNT, "weekly": WEEKLY_COUNT, "streak_days": STREAK_DAYS,
                   "story": [{"name": q["name"], "level": q["level"], "desc": q["desc"], "title": q["reward"]["title"]} for q in STORY_QUESTS]},
        "spin": {"wheel": [{"kind": s[1], "base": s[2], "chance": s[3]} for s in WHEEL], "better": [{"kind": s[1], "base": s[2], "chance": s[3]} for s in BETTER_WHEEL]},
        "crew_order": {"bank_pct": int(BANK_SHARE * 100), "per_member": PER_MEMBER_GOLD, "favour": ORDER_FAVOUR, "pearls": [PEARLS_SMALL, PEARLS_BIG], "big_share_pct": int(BIG_SHARE * 100)},
        "duel": {"level": _duel.DUEL_LEVEL, "cost": _duel.DUEL_COST, "seconds": _duel.DUEL_SECONDS, "overtime_max": _duel.OVERTIME_MAX, "accept_seconds": _duel.ACCEPT_SECONDS, "queue_timeout": _duel.QUEUE_TIMEOUT,
                 "idle_forfeit": _duel.IDLE_FORFEIT, "bite_pct": _duel.BITE_PCT, "points": _duel.POINTS, "mastery_pts_pct": _duel.MASTERY_PTS * 100, "ladder": {"points_for": _dl.POINTS_FOR, "milestones": _dl.MILESTONES, "tiers": _dl.TIER_OF, "podium": [_dl.podium_label(p) for p in _dl.PODIUM], "title": _dl.CHAMPION_TITLE},
                 "bait": {"name": BAIT_BY_ID["bait_duel"]["name"], "luck": BAIT_BY_ID["bait_duel"]["luck"], "bite": BAIT_BY_ID["bait_duel"]["bite"]}},
        "contracts": {"board": BOARD_SIZE, "slots": BASE_SLOTS, "daily_cap": DAILY_CAP, "refill_hours": REFILL_HOURS, "offer_hours": list(OFFER_HOURS), "accept_hours": ACCEPT_HOURS, "abandon_favour": ABANDON_FAVOUR, "tier_favour": TIER_FAVOUR,
                      "special_favour": SPECIAL_FAVOUR, "tier_pearl_pct": [int(x * 100) for x in TIER_PEARL], "value_mult": VALUE_MULT, "ranks": RANKS, "rank_at": RANK_AT,
                      "rank_rewards": RANK_REWARDS, "patrons": [{"id": p["id"], "name": p["name"], "role": p["role"], "wants": p["wants"], "title": p["title"],
                                                                  "perks": [{"label": k["label"].format(n=k["per"][-1]), "ranks": [RANKS[i] for i, x in enumerate(k["per"]) if x][:1]} for k in p["perks"]]} for p in PATRONS.values()]},
        "mastery": {"levels": list(range(1, 11)), "thresholds": {r: mastery.thresholds(r) for r in ("common", "uncommon", "rare", "epic", "legendary", "mythic")},
                    "perks": [[1, "+2% vendor price and XP per level (up to +20%; the price bonus is applied when you sell to the vendor, so it counts for every fish of that species you still hold)"], [3, "fish tires 5% faster (10% at Lv 6, 15% at Lv 9)"], [5, "+5% on the weight roll (+10% at Lv 10): a mastered species can weigh up to 10% more than the journal range shows"], [7, "giant / albino / golden variants 1.5× as likely"], [10, "Master title, 1 Pearl, feed shout-out"]]},
        "expedition": {"every_h": EVENT_PERIOD // 3600, "length_min": EVENT_LENGTH // 60, "luck": EVENT_LUCK, "bite": EVENT_BITE, "alert_window_min": ALERT_WINDOW_MIN},
        "bosses": {"period_h": BOSS_PERIOD // 3600, "window_min": BOSS_WINDOW // 60, "hook_pct": int(BOSS_HOOK_CHANCE * 100), "crew_share_pct": int(CREW_SHARE * 100), "max_mounts": MAX_BOSS_MOUNTS,
                   "list": [{"id": b["id"], "name": b["name"], "water": b["water"], "behavior": b["behavior"], "min_kg": b["min_kg"], "max_kg": b["max_kg"], "gold": b["gold"], "xp": b["xp"], "title": b["title"], "blurb": b["blurb"]} for b in BOSSES]},
        "crews": {"cost": CREW_COST, "max": CREW_MAX, "hall_names": HALL_NAMES,
                  "perks": [{"key": k, "name": p["name"], "costs": p["costs"], "tiers": [p["unit"].format(n=n) for n in p["per"]]} for k, p in PERKS.items()], "tier_reqs": TIER_REQS},
        "bait_only": {"other_pct": round(BAIT_ONLY_OTHER * 100), "list": [{"name": f["name"], "water": WATER_BY_KEY[f["water"]]["name"], "rarity": f["rarity"], "baits": [BAIT_BY_ID[b]["name"] for b in f["bait_only"]]} for f in FISH if f.get("bait_only")]},
        "rare_set": {"wear_skip_pct": int(RARE_SET_WEAR_SKIP * 100), "power_pct": 5},
        "gear_bonus": {"rod_luck_per_tier": 1, "reel_value_pct_per_tier": 2, "line_xp_pct_per_tier": 2, "repair_bands": {"T1": 0, "T2": 5, "T3-4": 10, "T5-6": 20, "T7-8": 35, "T9": 50}},
        "secrets": {"chance_pct": round(SECRET_CHANCE * 100), "title": SECRET_TITLE,
                    "list": [{"id": f["id"], "name": f["name"], "water": WATER_BY_KEY[f["water"]]["name"], "rarity": f["rarity"], "blurb": f["blurb"]} for f in SECRET_FISH]},
        "tournaments": {"categories": {k: {"label": _tour.CATS[k]["label"], "unit": _tour.CATS[k]["unit"], "desc": _tour.CATS[k]["desc"], "rate": _tour.RATES[k]} for k in _tour.CAT_KEYS}, "fees": _tour.FEES, "durations": _tour.DURATIONS_H, "signup_h": _tour.SIGNUP_H,
                        "min_entrants": _tour.MIN_ENTRANTS, "gold_hours": _tour.GOLD_HOURS, "pearl_hours": _tour.PEARL_HOURS, "cap_mult_gold": _tour.CAP_MULT_GOLD, "cap_pearls": _tour.CAP_PEARLS, "podium": _tour.PODIUM_BONUS, "title": _tour.CHAMPION_TITLE},
        "contests": {"prizes": CONTEST_PRIZES, "pearls": CONTEST_PEARLS, "labels": CONTEST_LABEL, "desc": CONTEST_DESC, "units": CONTEST_UNIT,
                     "pool": CONTEST_POOL, "crew_pool": CREW_CONTEST_POOL, "rarity_points": RARITY_POINTS, "weekly_title": WEEKLY_CHAMPION_TITLE},
        "achievements": [{"name": a["name"], "desc": a["desc"], "reward": a["reward"], "title": a["title"]} for a in ACHIEVEMENTS],
        "durability": {"max": MAX_DURABILITY, "worn_penalty_pct": int(round((1 - WORN_PENALTY) * 100)), "repair_rate_pct": REPAIR_RATE * 100, "warn_below": 25},
        "referrals": {"milestones": [{"level": m, **level_milestone(m)} for m in (10, 20, 30, 40)], "step": LEVEL_STEP, "recruit_pearls": RECRUIT_LEVEL_PEARLS, "title_level": TITLE_LEVEL,
                      "mentor_title": MENTOR_TITLE, "apply_window_hours": APPLY_WINDOW_HOURS, "apply_max_catches": APPLY_MAX_CATCHES},
        "vote": {"sites": [{"name": s["name"], "cooldown_h": s["cooldown_h"], "gold": s["gold"], "pearls": s["pearls"]} async for s in db.vote_sites.find({}).sort("order", 1)]},
        "pearls": {"story": [2, 3], "weekly": WEEKLY_PEARLS, "streak": STREAK_PEARLS, "title_achievement": TITLE_ACH_PEARLS, "boss": BOSS_PEARLS,
                   "contest": CONTEST_PEARLS, "spin_pearls": next(s[2] for s in BETTER_WHEEL if s[1] == "pearls"), "rename_cost": RENAME_COST,
                   "avatars": [{"id": a["id"], "name": a["name"], "price": a["price"]} for a in AVATARS],
                   "colours": [{"name": c["name"], "hex": c["hex"], "price": c["price"]} for c in NAME_COLOURS],
                   "frames": [{"name": f["name"], "price": f["price"], "desc": f["desc"]} for f in FRAMES if not f.get("owner")]},
    }
