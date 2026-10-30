"""Harbour Notices: admin-published news / patch notes with markdown bodies and images (Emergent Object Storage)."""
import os, uuid, logging
from datetime import datetime, timezone
from typing import Optional
import requests
from fastapi import Depends, HTTPException, UploadFile, File, Response
from pydantic import BaseModel, Field
from server import app, api, db, oid, get_current_user, require_admin, is_admin_user

log = logging.getLogger("news")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "fishing-lands"
MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}
MAX_IMAGE = 4 * 1024 * 1024
_storage_key = None


def init_storage(force=False):
    global _storage_key
    if _storage_key and not force: return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30); r.raise_for_status()
    _storage_key = r.json()["storage_key"]; return _storage_key


def _put(path, data, ctype):
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(), "Content-Type": ctype}, data=data, timeout=120)
    if r.status_code == 404: r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True), "Content-Type": ctype}, data=data, timeout=120)
    r.raise_for_status(); return r.json()


def _get(path):
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage()}, timeout=60)
    if r.status_code == 404: r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": init_storage(True)}, timeout=60)
    r.raise_for_status(); return r.content, r.headers.get("Content-Type", "application/octet-stream")


def _iso(): return datetime.now(timezone.utc).isoformat()


def out(n):
    return {"id": str(n["_id"]), "title": n["title"], "body": n["body"], "image": n.get("image"), "author": n["author"], "pinned": n.get("pinned", False),
            "created_at": n["created_at"], "updated_at": n.get("updated_at")}


class NewsIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=1, max_length=20000)
    image: Optional[str] = None
    pinned: bool = False
    discord: bool = False


@api.get("/news")
async def list_news(limit: int = 20, user=Depends(get_current_user)):
    rows = await db.news.find({}, sort=[("pinned", -1), ("created_at", -1)]).to_list(min(max(limit, 1), 100))
    return {"items": [out(n) for n in rows], "can_post": is_admin_user(user)}


@api.get("/news/public")
async def public_news(limit: int = 3):
    rows = await db.news.find({}, sort=[("pinned", -1), ("created_at", -1)]).to_list(min(max(limit, 1), 6))
    return {"items": [{k: v for k, v in out(n).items() if k != "updated_at"} for n in rows]}


@api.post("/news")
async def create_news(body: NewsIn, admin=Depends(require_admin)):
    doc = {"title": body.title.strip(), "body": body.body, "image": body.image, "pinned": body.pinned, "author": admin["username"], "created_at": _iso()}
    res = await db.news.insert_one(doc); doc["_id"] = res.inserted_id
    if body.discord:
        import asyncio
        from discord_alerts import post_news
        asyncio.create_task(post_news(doc["title"], doc["body"], doc.get("image")))
    return out(doc)


@api.put("/news/{nid}")
async def update_news(nid: str, body: NewsIn, admin=Depends(require_admin)):
    r = await db.news.find_one_and_update({"_id": oid(nid)}, {"$set": {"title": body.title.strip(), "body": body.body, "image": body.image, "pinned": body.pinned, "updated_at": _iso()}}, return_document=True)
    if not r: raise HTTPException(404, "Notice not found")
    return out(r)


@api.delete("/news/{nid}")
async def delete_news(nid: str, admin=Depends(require_admin)):
    r = await db.news.delete_one({"_id": oid(nid)})
    if not r.deleted_count: raise HTTPException(404, "Notice not found")
    return {"ok": True}


@api.post("/news/upload")
async def upload_image(file: UploadFile = File(...), admin=Depends(require_admin)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in MIME: raise HTTPException(400, "Use a jpg, png, gif or webp image")
    data = await file.read()
    if len(data) > MAX_IMAGE: raise HTTPException(400, "Image too large (max 4 MB)")
    fid = uuid.uuid4().hex
    try: result = _put(f"{APP_NAME}/news/{fid}.{ext}", data, MIME[ext])
    except Exception as e:
        log.error("news upload failed: %s", e); raise HTTPException(502, "Image storage is unavailable right now")
    await db.files.insert_one({"id": fid, "storage_path": result["path"], "original_filename": file.filename, "content_type": MIME[ext], "size": result.get("size", len(data)),
                               "kind": "news", "uploaded_by": admin["username"], "is_deleted": False, "created_at": _iso()})
    return {"url": f"/api/news/img/{fid}", "id": fid}


@api.get("/news/img/{fid}")
async def news_image(fid: str):  # public: <img> tags cannot send auth headers; only admins can upload here
    rec = await db.files.find_one({"id": fid, "kind": "news", "is_deleted": False})
    if not rec: raise HTTPException(404, "Image not found")
    data, ctype = _get(rec["storage_path"])
    return Response(content=data, media_type=rec.get("content_type", ctype), headers={"Cache-Control": "public, max-age=604800"})


HALLOWEEN_NEWS = """The Marsh Witch has set up her stall by the water, and strange things are biting.

**Spooky fish in every water**
12 limited Halloween fish now bite wherever you cast, from the Gourdfin Sunfish to the mythic Banshee of the Shallows. Sell them to the Marsh Witch for **Soul Candles**, the new event currency.

**The Marsh Witch's stall**
Trade your Soul Candles for:
- **Hexwood Rod** (level 30): its Hex Hook power lasts all year. 8% of the fish you land bring a twin of the same species with them, and the rod never wears out.
- **Pumpkin Head portrait** and **Jack-o'-Lantern frame**
- **Witch's Draught**: three energy potions to keep you casting

**The Phantom of Black Water**
Every 6 hours a ghost boss rises at a random water for 30 minutes. Hook it for +15 Soul Candles. Land it for +150 Soul Candles, a boss purse and the title **Ghostbreaker**.

**Quality of life**
- A cleaner top bar, with XP and Energy stacked neatly.
- Catch and boss alerts now float over the page and fade on their own, so they never push your screen down.

The event ends on **1 November**. Everything you earn stays yours forever, Soul Candles included. Tight lines and happy haunting!"""


async def seed_halloween_news():
    # One-time per database: posts the Halloween launch notice on top of the existing notices.
    if await db.meta.find_one({"key": "news_halloween_2026"}): return
    await db.news.insert_one({"title": "Halloween comes to FishyLand!", "body": HALLOWEEN_NEWS, "image": "/art/halloween_banner.jpg", "pinned": True,
                              "author": "Harbourmaster", "created_at": _iso()})
    await db.meta.insert_one({"key": "news_halloween_2026", "at": _iso()})


LANDING_RARITIES = ["rare", "epic", "legendary", "mythic"]


async def _landing_catches():
    rows = await db.catch_log.find({"rarity": {"$in": LANDING_RARITIES}, "species_id": {"$lt": 1000}},
                                   {"_id": 0, "username": 1, "species_id": 1, "name": 1, "rarity": 1, "weight": 1, "variant": 1}).sort("caught_at", -1).limit(40).to_list(40)
    names = list({r["username"] for r in rows if r.get("username")})
    banned = {u["username"] async for u in db.users.find({"username": {"$in": names}, "banned": True}, {"username": 1})} if names else set()
    return [{**r, "lb": round((r.get("weight") or 0) * 2.20462, 1)} for r in rows if r.get("username") and r["username"] not in banned][:24]


@api.get("/news/landing-catches")
async def landing_catches():
    from server import cached
    return await cached("landing_catches", 30, _landing_catches)


UPDATE_SLUG = "update-2026-10-crates-pixel"
UPDATE_TITLE = "The Great Harbour Update: Crates, crate-only rods and a brand new look"
UPDATE_BODY = """Anglers, the harbour has had its biggest refit yet. Here's what's new.

## Loot Crates
Three new crates have washed up on the docks: **Bronze**, **Silver** and **Gold**. Open one and a reel of prizes spins until it lands on yours: gold, Pearls, rare bait, Energy Potions, Tackle Scrap, even a better crate.

Crates are **earned only by playing**, never sold for Pearls or money, and you can trade them on the Market. Every crate shows each prize's exact % chance and value before you open it.

**How to get them**
- **Weekly crew challenge:** every member of the 1st place crew gets a Silver Crate, 2nd and 3rd place crews get Bronze.
- **Weekly lucky draw:** three random anglers with 20+ catches that week win a crate, whatever their rank.
- **Tournaments:** a random angler who scored (not the winner) wins a crate.
- **Bosses and Leviathans:** a small chance to drop one.
- **Fishing:** any fish might come up with a crate tangled in the line. Very, very rarely.

## Six crate-only rods
These never appear in the Tackle Shop:
- **Reefsong Coral Rod:** +5% bite chance, +2 luck
- **Moonreed Rod:** +12% XP, 5% free casts
- **Tempest Fang Rod:** 10% free casts, fish weigh 8% more, never wears out
- **Emerald Wyrm Rod:** +4 luck, fish weigh 12% more, +10% XP, never wears out
- **Starfall Rod:** 10% twin catches, +15% XP, 6% free casts, never wears out
- **Abyssal Crown Rod:** the rarest rod in the Lands. Twin catches, heavier fish, +20% XP, luck, bite and free casts

Pull a legendary or mythic rod and the whole harbour sees a banner with your name on it. Full odds are in the Wiki under Crates, and crate prices are tracked in the Almanac.

## A whole new look
FishyLand is now fully **pixel art**. Every fish, water, boss, rod and portrait has been redrawn, and the most visible art (waters, banners, bosses and top fish) got a second, cleaner pass. The water pictures now show in full.

## Smaller changes
- **Buy as many copies of a rod as you like.** Every copy has its own row, wear and enhancement, and you can equip or sell any of them.
- **Keepnet pages** of 50 fish, plus a new **Event** filter for Halloween and future event fish.
- **Weekly and monthly leaderboards** with a "My rank" view.
- **Sound effects** for casting, bites, catches and level-ups (you can turn them off in Settings).
- **Share your catches and boss kills** for a small daily gold reward.
- The robot check now only appears for anglers whose play looks automated, and never more than once a day.
- Boss sightings are now posted in our **Discord**, so you'll never miss one again.

Tight lines, and may your first crate be a Gold one.
The Harbourmaster"""


@app.on_event("startup")
async def _seed_update_post():
    if await db.news.find_one({"slug": UPDATE_SLUG}): return
    doc = {"slug": UPDATE_SLUG, "title": UPDATE_TITLE, "body": UPDATE_BODY, "image": "/art/news/update_crates_pixel.jpg", "pinned": True,
           "author": os.environ.get("ADMIN_USERNAME") or "Harbourmaster", "created_at": _iso()}
    await db.news.insert_one(doc)
    from discord_alerts import post_news
    await post_news(UPDATE_TITLE, UPDATE_BODY, doc["image"])


EVENTS_SLUG = "update-2026-10-random-events"
EVENTS_TITLE = "Random Events are here, plus crisp new pixel art"
EVENTS_BODY = """Anglers, keep your eyes on the horizon. A few times a day something unexpected now happens in the Lands, and the quickest angler walks away with a crate.

## Random Events
When one starts, a **RANDOM EVENT** banner pops up for everyone online and the Harbourmaster calls it out in Global chat. Each event lasts 30 minutes.

- **Hidden Goldfish:** a tiny golden goldfish is hiding in one of the waters. Nobody knows which one. Pick a water, cast and hope. The first angler to hook it wins a crate.
- **Shipwreck Salvage:** a merchant ship goes down at a water named in the banner. Get there fast: the first **10 anglers** to fish there each pull up a crate.
- **Chat Quick-Draw:** a word appears in the banner. The first angler to type it in **Global chat** wins a crate.

Every prize is a **Bronze, Silver or Gold Crate**, and Gold ones really do come up. There's no schedule, so you never know when the next one will hit.

## Everything is crisp pixel art now
Every fish, water, boss, Leviathan, shopkeeper, avatar and item icon has been redrawn with clean, hard-edged pixels, so nothing looks blurry any more, even small or zoomed in. Epic, Legendary and Mythic fish and top-tier gear now glow in their rarity colour, and Rare fish get a soft blue glow.

## Smaller changes
- **Link items in chat:** show off a fish, rod, crate or bait in Global, Trade or Crew chat. Others can click it to see the full card and message you straight from it.
- **Batch bait crafting:** pick your fish from a sortable table, like the Inventory, and craft up to 50 batches at once.
- **Energy Potions** can now be drunk once every **hour** instead of once a day.
- **New Player Guide:** the Wiki now opens with a step-by-step guide for new anglers. Send it to a friend!
- The Waters page shows 3 waters per row on bigger screens.

Tight lines, and keep one eye on chat.
The Harbourmaster"""


@app.on_event("startup")
async def _seed_events_post():
    if await db.news.find_one({"slug": EVENTS_SLUG}): return
    doc = {"slug": EVENTS_SLUG, "title": EVENTS_TITLE, "body": EVENTS_BODY, "image": "/art/news/update_random_events.jpg", "pinned": True,
           "author": os.environ.get("ADMIN_USERNAME") or "Harbourmaster", "created_at": _iso()}
    await db.news.insert_one(doc)
    await db.news.update_one({"slug": UPDATE_SLUG}, {"$set": {"pinned": False}})
    if "localhost" in os.environ["MONGO_URL"]: return  # preview database: don't post to the live Discord
    from discord_alerts import post_news
    await post_news(EVENTS_TITLE, EVENTS_BODY, doc["image"])



TIDES_SLUG = "update-2026-10-deeper-waters"
TIDES_TITLE = "Deeper waters fight back, a tidier Market and safer chat"
TIDES_BODY = """Anglers, this update makes every new water a real step up, tidies up the screens and gives you new ways to keep chat friendly.

## Every water is a step up
- Each water is now a little tougher than the one before. **Common fish stay fair everywhere.** The **rare, epic, legendary and mythic** fish in deep water fight much harder: a smaller sweet spot, stronger pulls, more tricks and less spare time on the clock. A mythic can now really get away.
- Better gear still helps, so it pays to grind a water for an upgrade before you move on.
- Harder water pays more: catches give **bonus gold and XP**, from +2% at Willow River up to **+20% at The Cinder Trench**.
- Each water's picture now shows how rough it is (**Calm, Choppy, Rough or Wild**) and its bonus.

## A tidier Market
- New **Buy**, **Sell** and **My listings** tabs at the top of the Market.
- **Sell from your bag right in the Market:** fish, bait, ingredients, tackle, crates, passes, potions and scrap, with a search box.

## Cleaner screens
- On PC, side panels are now neat tab buttons at the top of each page, like on phones.
- The Harbour tabs show live counters: anglers online, unread news and fresh notable catches.
- On phones, the fishing fight now shows the art of the water you're fishing.
- Fixed the bobber blinking out for a moment at the start of a fight.

## Crews and prizes
- **Crew bosses now give every angler who helped pull a guaranteed crate**: Bronze from the first three bosses, Silver from the next two, **Gold from The Storm Ray**.
- Tackle Scrap prizes from the daily wheel, crates, the duel ladder and crew bosses have been halved to keep scrap valuable.

## Moderators and reporting
- Trusted players can now be **Moderators**. You'll see a small shield badge next to their name. They can help with spam and rule-breakers in chat.
- **Report button:** tap the little flag next to a message in Global or Trade chat, or under a private message sent to you. The staff get it straight away.

Tight lines, and see you in the deep.
The Harbourmaster"""


@app.on_event("startup")
async def _seed_tides_post():
    if await db.news.find_one({"slug": TIDES_SLUG}): return
    doc = {"slug": TIDES_SLUG, "title": TIDES_TITLE, "body": TIDES_BODY, "image": None, "pinned": True,
           "author": os.environ.get("ADMIN_USERNAME") or "Harbourmaster", "created_at": _iso()}
    await db.news.insert_one(doc)
    await db.news.update_many({"slug": {"$in": [UPDATE_SLUG, EVENTS_SLUG]}}, {"$set": {"pinned": False}})
    if "localhost" in os.environ["MONGO_URL"]: return  # preview database: don't post to the live Discord
    from discord_alerts import post_news
    await post_news(TIDES_TITLE, TIDES_BODY, None)
