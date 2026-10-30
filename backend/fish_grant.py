"""Put a granted fish (spin jackpot, duel ladder) straight into an angler's keepnet and journal."""
from server import db, now, iso, add_feed, catch_ledger, roll_weight, fish_value, VARIANTS
from fish_size import fish_length


async def grant_fish(u, f, variant, source, feed_text=None):
    vmult = next(m for n, _, m in VARIANTS if n == variant)
    weight = roll_weight(f)
    uid = str(u["_id"])
    catch = {"user_id": uid, "username": u["username"], "species_id": f["id"], "name": f["name"], "rarity": f["rarity"], "weight": weight,
             "length_cm": fish_length(f, weight), "variant": variant, "value": fish_value(f, weight, vmult), "water": f["water"],
             "caught_at": iso(now()), "listed": False, "mounted": False, "caught_by": uid, "caught_by_name": u["username"], "granted_by": source}
    await db.catches.insert_one(catch)
    await db.catch_log.insert_one(catch_ledger(catch))
    j = await db.journal.find_one({"user_id": uid, "species_id": f["id"]})
    if not j:
        await db.journal.insert_one({"user_id": uid, "species_id": f["id"], "count": 1, "best_kg": weight, "first_at": iso(now()), "variants": [variant]})
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"stats.species": 1}})
    else:
        await db.journal.update_one({"_id": j["_id"]}, {"$inc": {"count": 1}, "$max": {"best_kg": weight}, "$addToSet": {"variants": variant}})
    if feed_text:
        await add_feed(source, u["username"], feed_text.format(name=f["name"], variant=variant, weight=weight), f["rarity"])
    return {"species_id": f["id"], "name": f["name"], "variant": variant, "weight": weight, "rarity": f["rarity"]}
