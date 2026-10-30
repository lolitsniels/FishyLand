# The Fishing Lands 2.5D — PRD

## Original problem statement
Started as "Fishing Realm" (2.5D fantasy browser fishing MMO, PixiJS). The user then uploaded the source of their live text MMO
"The Fishing Lands" (TFL, /app/reference/tfl) and asked to turn it into a 2.5D game: keep TFL mechanics (12 waters, ~416 fish, items),
new graphics, walkable animated harbour town, landing page like the old one but in the new style.
Pearls: earned in game only, cosmetics only (no pay-to-win; Angler Pass allowed). Style: League of Angels-like, a bit cartoony, animated.

## User choices (June 2026)
- Walking: tap/click-to-move + arrow/WASD keys
- Waters are reached by travelling (Travel Map / boat); inside a water, walk onto a glowing fishing spot to cast
- Phase-1 menus: Travel Map, Fishdex, Tackle Box (inventory), Shop, Profile
- Show other online players in the same harbour / water

## Architecture
- Backend: TFL FastAPI (/app/backend/server.py + modules). New `world_presence.py` → POST /api/world/pos (in-memory presence, 12s stale)
- game_data.py strips `pearls` cost from all rods/reels/lines/bait (pearls = cosmetics only); offerwall disabled
- Frontend: React 19 + PixiJS v8
  - App.js: GameProvider (TFL context), routes `/` Landing, `/game` World with nested TFL pages shown in a Modal
  - world/World.js: HUD, action bar, spots, keys, presence polling, travel → auto water mode, mode persisted in sessionStorage
  - game/Scene.js: scene builder per location (bg, water shader, weather particles, walking, peers, rod/fight FX)
  - game/scenes.js: walk polygons, spots per location, weather per water
  - Art: public/art/harbour.jpg, public/art/waters/{key}.jpg (+ _thumb) — all 12 waters

## Implemented
- 2026-06: Phase 1 port — walkable harbour (8 signposts: Tackle Shop, Market, Guild Hall, Quest Board, Sea Serpent travel, Pearl Shop, Tournaments, Duel Pier),
  12 unique animated water scenes with 3 glowing fishing spots each, TFL cast/fight/land flow with TensionGame, live multiplayer presence,
  new Landing page (register / login / guest), Fishdex stand-in fish art, "Fish here" on Travel Map, mobile layout (390px) verified.
- Testing: iteration_3 — backend 12/12, frontend all flows pass (testing agent fixed i18n init + reCAPTCHA no-key)

## Backlog
- P1: Unique art for 416 species (currently 10 shared stand-in images, hue-shifted) and missing TFL gear/avatar icons
- P1: Chat bubbles / emotes between players in the harbour; show peers' cosmetics
- P1: Portal (Playgama/GameDistribution) build re-wire to the new App (PortalApp removed during port)
- P2: Guilds, Bosses, Leaderboards with dedicated 2.5D locations; presence via shared store for multi-worker
