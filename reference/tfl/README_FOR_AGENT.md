# The Fishing Lands: source code for a 2.5D remake

Hand this zip to the new agent with this message:

> "This zip is the complete source of my browser fishing MMO **The Fishing Lands** (FastAPI + MongoDB + React). I want a **new, separate game** with the **same mechanics**, but as a full graphical **2.5D game** in the art style I'll show you. Read `README_FOR_AGENT.md` first, then rebuild it phase by phase. Nothing from this project's live server or accounts carries over."

---

## For the agent: what this is

- This is a **reference implementation**, not something to deploy as-is. It is a text/pixel-art MMO whose UI is mostly menus and panels. Your job is to keep the **rules, numbers and systems** and replace the presentation with a real 2.5D game world: a scene per water, animated anglers on docks, fish leaping during the fight, other players visible, and a game HUD instead of web pages.
- The owner already has the 2.5D art style. Ask for their reference images before you make any art.
- Start a fresh project. Copy the backend logic module by module where it fits, and rewrite the frontend.
- **No secrets are included.** Create your own `.env` files (`MONGO_URL`, `DB_NAME`, `REACT_APP_BACKEND_URL`, plus a key per integration you keep).

## Where to look

| What | Where |
|---|---|
| Every rule, constant and odds value in one feed | `backend/wiki.py` → `GET /api/wiki` |
| All fish (416 species), waters, bait and gear with numbers | `backend/game_data.py`; real snapshot in `data/game_data_snapshot.json` |
| Cast → bite → fight → land flow, energy, XP, gold, luck, rarity odds | `backend/server.py` (search `@api.post("/fish/` and `def rarity_weights`, `encounter_params`, `fight_tricks`) |
| The tension fight (client) | `frontend/src/components/TensionGame.js` |
| Fish mastery | `backend/mastery.py` |
| Quests (story chain + daily/weekly) | `backend/quests_data.py`, server.py `/quests` |
| Contracts (patron delivery orders) | `backend/contracts.py`, `contracts_data.py` |
| Market (player trading) | server.py `/market` routes |
| Crews, crew hall, crew bosses, weekly orders | `crew_hall.py`, `crew_boss.py`, `crew_orders.py`, `crew_extras.py` |
| Legendary/mythic world bosses | `bosses.py`, `bosses_data.py` |
| PvP duels + weekly ladder | `duel.py`, `duel_ladder.py` |
| Tournaments | `tournaments.py` |
| Random events | `random_events.py` |
| Gear enhancement, salvage | `enhance.py` |
| Loot crates | `crates.py` |
| Crab cages (AFK) | `crab_cages.py`, `cages_data.py` |
| Daily spin / login rewards | `login_chest.py` |
| Achievements, friends, guestbook, journal | server.py, `friends.py`, `guestbook.py` |
| Seasonal event (Halloween) | `halloween.py`, `halloween_data.py` |
| Secret time-window fish | `secrets_data.py` |
| Leaderboards (all-time, weekly, monthly) | `leaderboards_period.py`, server.py |
| Tutorial | `tutorial.py` |
| Referrals | `referrals.py` |
| Premium (Angler Pass), Pearls, cosmetics, boosters | `premium.py`, `cosmetics.py`, `cosmetic_shop.py`, `boosters.py` |
| Anti-bot (detector, bot catcher, human check) | server.py `SIGNALS`/`flag_suspicious`, `botwatch.py`, `humancheck.py` |
| Admin + moderator tools | `admin_tools.py`, `moderation.py`, `frontend/src/pages/game/Admin.js`, `ModPanel.js` |
| Analytics (traffic, DAU/MAU/retention) | `traffic.py`, `platform_stats.py` |
| Full feature history and decisions | `FEATURES_AND_HISTORY.md` |

## Lessons to keep (the owner cares about these)

1. **The server decides everything.** A cast creates a one-use pending encounter and the server validates the fight before paying out. Never trust the client.
2. **Bots:** detect them quietly (rhythm signals), put suspects in an admin Bot catcher, and let a human ban. No automatic bans, no automatic trading blocks, and **never** surprise mini-games in normal players' fights.
3. Same-IP accounts can't duel or trade with each other (checks the last 10 IPs).
4. Energy banking: a level-up adds a full bar on top of current energy (up to 2× max), and potions stack.
5. Duels: each player uses their own gear, and the ladder only moves on a win.
6. Owner's taste: no blurry upscaled images, no white halos around cut-outs, no generic "AI" look, short punchy texts.
7. Portal builds (Playgama, GameDistribution, etc.) must hide real-money shops and external links. See `frontend/src/lib/portal.js`.
8. Public pages need pre-rendered HTML with unique titles, or AdSense rejects the site as "low value content". See `frontend/scripts/prerender.js`.

## What's left out

Art files (the new game gets new art), marketing media, the one-off art-generation scripts, tests and all `.env` secrets.
