p = '/app/backend/login_chest.py'
s = open(p).read()


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


a = s.index('# (id, kind, amount, weight, rarity).')
b = s.index('def _segment(')
s = s[:a] + '''SKIN_PRIZES = ["skin_kraken", "skin_inferno", "skin_galleon"]
SKIN_NAMES = {"skin_kraken": "Krakenjaw Rod Skin", "skin_inferno": "Inferno Wyrm Rod Skin", "skin_galleon": "Ghost Galleon Rod Skin"}
SKIN_FALLBACK_PEARLS = 25
GOLDEN_BONUS_PEARLS = 5

# (id, kind, amount, weight, rarity). Gold amounts are base values that scale with level; weights sum to 100.
WHEEL = [
    ("gold_s", "gold", 150, 28, "common"), ("bait", "bait", 8, 18, "common"), ("gold_m", "gold", 400, 18, "uncommon"), ("crafted", "crafted", 3, 12, "uncommon"),
    ("pearls_s", "pearls", 1, 8, "uncommon"), ("gold_l", "gold", 900, 8, "rare"), ("pearls_m", "pearls", 3, 4, "rare"), ("fish_rare", "fish", 1, 4, "rare"),
]
BETTER_WHEEL = [
    ("gold_l", "gold", 1500, 20, "uncommon"), ("pearls_5", "pearls", 5, 18, "rare"), ("crafted", "crafted", 10, 14, "rare"), ("pearls_10", "pearls", 10, 12, "epic"),
    ("gold_xl", "gold", 4000, 10, "epic"), ("fish_epic", "fish", 1, 10, "epic"), ("pearls_20", "pearls", 20, 5, "legendary"), ("fish_legendary", "fish", 1, 5, "legendary"),
    ("skin", "skin", 1, 3, "legendary"), ("jackpot", "mythic", 1, 3, "mythic"),
]
for _w in (WHEEL, BETTER_WHEEL): assert sum(s[3] for s in _w) == 100


''' + s[b:]
rep('''    elif kind == "mythic": out["name"] = "Mythic fish (rare variant)"''', '''    elif kind == "mythic": out["name"] = "Mythic fish (rare variant)"
    elif kind == "fish": out["name"] = f"Mystery {rarity} fish"
    elif kind == "skin": out.update(item="skin_galleon", name="Rare rod skin")''')
rep('''    if k == "mythic": return "Mythic jackpot"''', '''    if k == "mythic": return "Mythic jackpot"
    if k == "fish": return s["name"]''')
rep('''async def _apply(u, seg):''', '''async def _grant_rarity_fish(u, rarity):
    from fish_grant import grant_fish
    pool = [f for f in FISH if f["rarity"] == rarity and not f.get("boss") and f.get("water") != "crew_pond"] or [f for f in FISH if f["rarity"] == rarity]
    return await grant_fish(u, random.choice(pool), "normal", "spin", "{name} won a {rarity} fish on the Wheel of Fortune".replace("{name}", u["username"]).replace("{rarity}", rarity) + ": {name} ({weight} kg)!")


async def _grant_skin(u):
    owned = set(u.get("owned_rod_skins") or [])
    left = [k for k in SKIN_PRIZES if k not in owned]
    if not left:
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"pearls": SKIN_FALLBACK_PEARLS, "stats.pearls_earned": SKIN_FALLBACK_PEARLS}})
        return f"{SKIN_FALLBACK_PEARLS} Pearls (you own every wheel skin)"
    k = random.choice(left)
    await db.users.update_one({"_id": u["_id"]}, {"$addToSet": {"owned_rod_skins": k}})
    await add_feed("spin", u["username"], f"{u['username']} won the {SKIN_NAMES[k]} on the golden Wheel of Fortune!", "legendary")
    return SKIN_NAMES[k]


async def _apply(u, seg):''')
rep('''    if k == "mythic":
        return await _grant_mythic(u)
    return None''', '''    if k == "mythic":
        return await _grant_mythic(u)
    if k == "fish":
        return await _grant_rarity_fish(u, seg["rarity"])
    return None''')
rep('''    fish = await _apply(user, seg)
    if fish:''', '''    if seg["kind"] == "skin":
        result["label"] = await _grant_skin(user)
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"login_chest.last_result": result}})
    fish = await _apply(user, seg)
    if s["better"]:
        await db.users.update_one({"_id": user["_id"]}, {"$inc": {"pearls": GOLDEN_BONUS_PEARLS, "stats.pearls_earned": GOLDEN_BONUS_PEARLS}})
        result["bonus_pearls"] = GOLDEN_BONUS_PEARLS
        await db.users.update_one({"_id": user["_id"]}, {"$set": {"login_chest.last_result": result}})
    if fish:''')
open(p, 'w').write(s)
print("ok")
