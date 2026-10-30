import random
from secrets_data import SECRET_RUMOURS
from datetime import timedelta

from fastapi import Depends, Request

from server import localize, api, db, now, iso, online_cutoff, get_current_user, level_from_xp, conditions_for, current_expedition, crew_standings, period_bounds, WATER_BY_KEY, FISH, FISH_BY_WATER, BAIT_BY_ID

BAIT_TIPS = {
    "harbourmaster": "Ledger says the {fish} at {water} only ever come in on {baits}. Anything else and you're feeding the water.",
    "baitseller": "Fishing {water}? Then you'll want {baits}, the {fish} there won't look at anything else. I happen to sell it.",
    "sailor": "Want the {fish} at {water}? {baits}. My father knew it, his father knew it. Now you know it.",
    "cook": "The {fish} from {water} is the sweetest eating there is, and it only takes {baits}. Ask Nettie.",
}


def bait_tip(npc, c, rnd):
    """A hint about one fussy (bait-only) species at the angler's current water."""
    fussy = [f for f in FISH_BY_WATER[c["water"]["key"]] if f.get("bait_only")]
    if not fussy:
        return None
    f = rnd.choice(fussy)
    names = [BAIT_BY_ID[b]["name"] for b in f["bait_only"] if b in BAIT_BY_ID]
    baits = names[0] if len(names) == 1 else ", ".join(names[:-1]) + " or " + names[-1]
    return BAIT_TIPS[npc].format(fish=f["name"], water=c["water"]["name"], baits=baits)
from bosses import current_boss, boss_public

NPCS = [
    {"id": "harbourmaster", "name": "Harbourmaster Aldous Crane", "role": "Keeper of the Ledger", "portrait": "/art/npc/harbourmaster.webp"},
    {"id": "baitseller", "name": "Nettie Marsh", "role": "Bait Seller", "portrait": "/art/npc/baitseller.webp"},
    {"id": "sailor", "name": "Old Tobias", "role": "Retired Sailor", "portrait": "/art/npc/sailor.webp"},
    {"id": "cook", "name": "Cook Marisol Vane", "role": "Galley Cook", "portrait": "/art/npc/cook.webp"},
]
CONTRACT_LINES = {
    "harbourmaster": "I've {n} order{s} posted for you on the contract board. The stores don't fill themselves.",
    "baitseller": "There's {n} of my order{s} pinned on the board. Bring me the fish and I'll remember your face kindly.",
    "sailor": "Left {n} job{s} for you on the board. Nothing a real angler couldn't manage.",
    "cook": "{n} order{s} from my galley on the board. Fresh fish, fair coin, and I don't forget who delivers.",
}


async def npc_context(user):
    t = now()
    ws, we = period_bounds("weekly", t)
    heavy = await db.catches.find_one({"caught_at": {"$gte": iso(ws)}}, sort=[("weight", -1)])
    top_crew = (await crew_standings(iso(ws), iso(we), 1) or [None])[0]
    exp, nxt = current_expedition(t)
    boss = boss_public(await current_boss())
    last_boss = await db.boss_kills.find_one({}, sort=[("at", -1)])
    return {"user": user, "level": level_from_xp(user["xp"])[0], "water": WATER_BY_KEY[user["water"]], "cond": conditions_for(user["water"], t),
            "heavy": heavy, "top_crew": top_crew, "exp": exp, "nxt": nxt, "boss": boss, "last_boss": last_boss,
            "online": await db.users.count_documents({"last_seen": {"$gte": online_cutoff(t)}}),
            "listings": await db.listings.count_documents({"status": "open"}),
            "legend_week": await db.catches.count_documents({"caught_at": {"$gte": iso(ws)}, "rarity": "legendary"}),
            "hour": t.hour, "offers": await _offers_by_patron(user)}


async def _offers_by_patron(user):
    out = {}
    async for c in db.contracts.find({"user_id": str(user["_id"]), "status": "offered"}, {"patron": 1}):
        out[c["patron"]] = out.get(c["patron"], 0) + 1
    return out


def _lines(npc, c):
    u, s, w, cond = c["user"], c["user"]["stats"], c["water"], c["cond"]
    out = []
    if npc == "harbourmaster":
        out += [f"Welcome back, {u['username']}. The ledger shows {s.get('catches', 0):,} fish to your name. Keep it honest.",
                f"{c['online']} anglers on the water right now. A good day for the harbour.",
                "Every catch is written down. Every lie, too. The ledger forgets nothing."]
        if c["heavy"]: out.append(f"Heaviest this week: {c['heavy']['username']}'s {c['heavy']['name']} at {c['heavy']['weight']} kg. Beat that and I'll write your name in red ink.")
        if c["top_crew"]: out.append(f"Crew {c['top_crew']['username']} leads the weekly standings with {c['top_crew']['value']} kg. The others had better wake up.")
        if c["boss"]: out.append(f"I have a report of something enormous at {c['boss']['water_name']}. If you value your line, stay away. If you value your name, go.")
        elif c["last_boss"]: out.append(f"The last great beast slain was {c['last_boss']['username']}'s doing. {c['last_boss']['weight']} kg. I still don't quite believe it.")
        if c["exp"]: out.append(f"{c['exp']['name']} is underway at {c['exp']['water_name']}. Rare fish for anyone quick enough.")
        else: out.append(f"Next expedition: {c['nxt']['name']} at {c['nxt']['water_name']}. Mark it in your log.")
        if c["legend_week"]: out.append(f"{c['legend_week']} legendary fish recorded this week. The waters are generous, or restless.")
    elif npc == "baitseller":
        out += ["Worms, maggots, squid strips. Fresh this morning, mostly.",
                f"Fishing {w['name']}? {cond['text']} I'd take something with a bit of scent."]
        bait = u.get("active_bait")
        total = sum(u.get("bait", {}).values())
        if total < 10: out.append(f"You're down to {total} bait. Don't come crying to me when the big one swims off with your last hook.")
        else: out.append(f"{total} bait in your box. Good. A prepared angler is a paid angler.")
        if not bait: out.append("No bait on your line? You'll catch a cold and nothing else.")
        if cond["weather"] == "rain": out.append("Rain on the water means worms on the surface. Fish know it. So should you.")
        if cond["weather"] == "storm": out.append("Storm coming in. Strange things come up in weather like this. Strange things bite, too.")
        if cond["period"] == "night": out.append("Night fishing, is it? The legendary ones feed after dark. So do the eels. Watch your fingers.")
        if cond["period"] == "dawn": out.append("Dawn's the best hour. Fish are hungry and haven't learned the day's tricks yet.")
        out.append(f"{c['listings']} things for sale on the market right now. Some of it's mine. Buy the crafted stuff, it's worth the coin.")
        if c["exp"]: out.append(f"Everyone's rushing to {c['exp']['water_name']}. You'll want bait for that water, not whatever you've got.")
    elif npc == "cook":
        out += ["A fish is only as good as the hour it left the water. Bring me fresh, or don't bring me anything.",
                "The captain wants something rare on the table tonight. The crew wants anything at all. Guess who I cook for first.",
                f"{w['name']} fish, is it? {cond['text']} Salt, butter, a hot pan. Everything else is vanity."]
        if s.get("catches", 0) < 20: out.append("New hands. Good. New hands haven't learned to lie about the weight yet.")
        else: out.append(f"{s.get('catches', 0):,} fish landed and how many did you eat? None, I'd wager. Anglers never eat what they catch.")
        if cond["weather"] == "storm": out.append("Storm weather makes for hungry crews. Whatever comes in today sells twice over.")
        if c["heavy"]: out.append(f"{c['heavy']['weight']} kg of {c['heavy']['name']} this week, {c['heavy']['username']}'s. That's forty portions, or one very good story.")
        out.append(f"{c['listings']} things on the market and half of it should be in a pan by now.")
    else:
        out += ["Forty years at sea and I never once saw the bottom of the Sunken Deep. Nobody has. That's the point of it.",
                "Hold when it pulls, give when it runs. That's fishing. That's marriage too, come to think of it.",
                f"The water at {w['name']}: {cond['text'].lower()} I've seen worse. I've seen much worse."]
        if c["level"] < 5: out.append("New to the harbour? Buy a proper rod before anything else. A cane pole is a prayer, not a tool.")
        elif c["level"] < 15: out.append("You're finding your feet. The estuary's where the real fish start. Save your coin for the passage.")
        else: out.append(f"Level {c['level']}. You've earned some salt. The deep waters will still humble you.")
        if s.get("heaviest_kg"): out.append(f"Your best is {s['heaviest_kg']} kg, the {s.get('heaviest_name')}. Mine was a halibut the size of a door. Or so I tell it.")
        if s.get("escaped", 0) > s.get("catches", 0) / 2 and s.get("casts", 0) > 20: out.append("You lose a lot of fish, friend. Loosen your grip. The line is not a rope.")
        if c["boss"]: out.append(f"Something at {c['boss']['water_name']} that shouldn't be there. I felt it in my knee before the Harbourmaster said a word.")
        if c["heavy"] and c["heavy"]["username"] == u["username"]: out.append("That was you with the big one this week? Ha! The whole dock's talking. Don't let it go to your head.")
        if c["hour"] >= 22 or c["hour"] < 5: out.append("Up this late? The ghostlight fish are too. So is the Wyrm. Don't say I didn't warn you.")
        if c["cond"]["tide"]: out.append(f"Tide's {c['cond']['tide']}. Salt fish move with it, cast along the current, not across it.")
        out.append(f"{len(FISH)} species out there and no one's caught them all. Not yet. Maybe you.")
    n = c["offers"].get(npc, 0)
    if n: out.append(CONTRACT_LINES[npc].format(n=n, s="" if n == 1 else "s"))
    # One vague secret-catch rumour per NPC, rotating by hour; never a time.
    rum = random.Random(f"rumour:{npc}:{c['hour']}:{now().strftime('%j')}")
    sid = rum.choice(list(SECRET_RUMOURS))
    out.append(rum.choice(SECRET_RUMOURS[sid]))
    return out


@api.get("/npcs")
async def npcs(request: Request, user=Depends(get_current_user)):
    c = await npc_context(user)
    seed = f"{now().strftime('%Y%m%d%H')}:{user['_id']}"
    out = []
    for n in NPCS:
        lines = _lines(n["id"], c)
        rumour = lines.pop()  # always keep one secret-catch rumour in the set
        rnd = random.Random(f"{n['id']}:{seed}")
        rnd.shuffle(lines)
        tip = bait_tip(n["id"], c, rnd)
        lines = lines[:2 if tip else 3]
        lines.insert(rnd.randrange(len(lines) + 1), rumour)
        if tip:
            lines.insert(rnd.randrange(len(lines) + 1), tip)
        out.append({**n, "lines": lines})
    return localize({"npcs": out}, request)
