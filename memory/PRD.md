# Fishing Realms (2.5D) — PRD

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
- 2026-06: Menu reskin — every legacy TFL menu restyled (game-skin.css: gold-framed panels, pill buttons, plaque tables, ring-icon tabs).
  Rebuilt core menus: Shop (gear/bait art cards with tier frames), Tackle Box (loadout bar + keepnet tiles + tackle cards), Fishdex (hero progress,
  water chip strip, collectible cards), Travel Map (art map cards), Profile (hero + portrait + stat tiles). 46 new gear/bait/crate icons in /art/gear.
  Modals full screen on phones, rendered outside the scaled HUD; Escape closes nested dialogs first; missing legacy art falls back to game art.
- 2026-06: Harbour doubled to 2528px wide (art/harbour_wide.jpg, outpainted west quarter: Bait Hut, Fountain, Anchor Tavern, beach).
  New signposts: Crafting, Achievements, Fountain of Fame (leaderboards), Anchor Tavern (contracts), Old Salt's Almanac. Camera scrolls with the angler.
- Testing: iteration_4 (menus) 88% → remaining issues fixed and self-verified; iteration_3 — backend 12/12, frontend all flows pass (testing agent fixed i18n init + reCAPTCHA no-key)

- 2026-06 (iter 7): Renamed to Fishing Realms (UI, index.html, backend strings, news). Menus restyled to smoky black glass + thin gold trim (index.css bottom block).
  Landing catch bar no longer slides (one catch crossfades every 4s). Modal scroll fixed on phones (grid-rows minmax). Mobile action bar auto-fits.
  Living harbour (Scene.js makeLife + scenes.js HARBOUR.life): fountain jets + basin rings, bobbing Sea Serpent & distant boats, water rings at posts,
  flickering lanterns, chimney smoke, 9 gliding seagulls. Tap-to-walk overshoot fixed (Pearl Shop auto-opens). Tension bar green centre / orange-red edges verified.
  Testing: iteration_7 — 8/10 then remaining issues fixed and self-verified.

- 2026-06 (iter 8): Crab cages removed (shop tab, waters slot, cage species out of pools/contracts/crew orders; old ids kept in FISH_BY_ID).
  New tiled map engine (game/tilemap.js + game/maps.js): painted ground textures (art/map/t_*.webp), cut-out objects (art/map/*.webp),
  16px walk grid with object footprints, A* tap-to-walk, follow camera, diagonal sliding. Harbour 3600x2400 + Millbrook 3200x2400 (river, bridge, pond pier,
  4 spots with cast targets). Other 11 waters still old single-image scenes (awaiting user approval). ShopFrame (tabs/banner/grid/side/wallet)
  on Tackle Shop, Pearl Shop (coming-soon cosmetics), Market. ?mapview=1 shows whole map. Testing iteration 8 (forced summary): all flows pass; fixes applied after.

- 2026-06 (iter 9): Painted animated world Travel Map (components/WorldMap.js: 13 pins, boat route, clouds, shimmer, popover travel; "fr-mode" window event switches harbour/water).
  Harbour re-laid out (high street + plaza + notice boards + promenade + piers); building footprints cover the full body; objects in water auto-dropped; fish leaps/sparkles only on water;
  Millbrook plank bridge drawn on its walkway. Painted UI in public/ui.css (loaded last in index.html; CSS urls to /art must live there, not in src css):
  frame panel.webp, btn_gold/btn_dark buttons, tile.webp, close.webp, player card card.webp. Font: Noto Sans everywhere, Cinzel for titles. Fight message readable; dialogs solid.
  Testing iteration_9: all core flows pass; mobile issues fixed after.

- 2026-06 (iter 10-11): Art direction -> modern stylized marina (front-facing buildings, sport boat, modern props, pavers) + nautical UI (teak/brass/navy panel 9-slice slice 195,
  brass buttons, lifebuoy close, porthole player card card2.webp, Lilita One titles). Guild renamed Crew in UI. Travel Map = map only + expedition banner/pin badge.
  Chat (world/ChatBox.js: global/crew/trade, polling, speech bubbles via fx.bubbles drawn in Scene makeBubble). Quick tackle slots (world/QuickTackle.js, POST /shop/equip).
  Guestbook removed from Profile. Land props auto-settle onto dry ground (tilemap settle). Graphic dock/bridge posts (t_post.webp). One reel control in fights.
  Gold/pearl images (/art/hud/gold.webp, pearl.webp) everywhere; tackle-box icon for Tackle Shop. Harbour-only pages blocked at waters (HARBOUR_ONLY in World.js);
  water bar = Travel Map, Fishdex, Tackle Box, Quests, My Angler. Toasts/popups themed. Map rules in /app/memory/MAP_DESIGN.md.

- 2026-06 (iter 12): Crew island (CREW_ISLAND_MAP, mode "crew", presence loc crew:<id>), crew tabs contest/contract/hall/boss removed, "Sail to your crew island" button.
  Founding a crew needs level 30 (CREW_MIN_LEVEL), joining any level. Travel map pins = round water thumbnails, no boat/glow. Leaping fish = species of the water, open water only.
  Props never on bridges/piers (settle deck check; out-of-map counts as water). Map cache for fast re-entry. Image QA rules in MAP_DESIGN.md. Yellow energy bar + lightning icon.
  Testing iteration_12: backend 5/5 (+1 skip), frontend all pass after 2 tester fixes.

- 2026-06 (iter 24): Tutorial finish really grants 10 Pearls + 10 worms + 10 bread (backend/tutorial.py), card sits below the player panel on phones/tablets.
  Crew Pond: 10 pond-only species (ids 950-959, game_data.POND_FISH, art fish_v2/950-959) stocked in order with crew bank gold by leader/officers at
  Pond Keeper Maud (NPC + sign on crew island, world/PondKeeper.js, backend/crew_pond.py GET /crews/{id}/pond, POST /crews/{id}/pond/stock).
  3 fishing rings round the pond; POST /fish/cast {spot:"crew_pond"} rolls only stocked species (water "crew_pond"). Fishdex has a Crew Pond chip.
  Testing iteration_24: backend 12/12, frontend pass (tablet overlap fixed after).

## Backlog
- P0: Fishing Duels as a real duel map: 2 anglers face off, live scoreboard, win/lose result screen
- P0: Convert remaining 11 waters to tiled maps after user approves Harbour + Millbrook (incl. a boat-deck-at-sea map)
- P0: Living-map animations for the 12 waters (per-water props)
- P1: Pearl Shop cosmetics (currently empty)
- P2: Harbour hint pill overlaps Tournaments label on phones
- P0: Widen the 12 waters the same way (outpaint each scene, extend piers/shores, new fishing spots)
- P1: Unique art for 416 species (currently 10 shared stand-in images, hue-shifted); achievement badges, boss and avatar art (currently fallbacks)
- P1: Chat bubbles / emotes between players in the harbour; show peers' cosmetics
- P1: Portal (Playgama/GameDistribution) build re-wire to the new App (PortalApp removed during port)
- P2: Guilds, Bosses, Leaderboards with dedicated 2.5D locations; presence via shared store for multi-worker


## Round 15-16 (June 2026)
- All 15 maps now tiled: new willow, greyfell, saltmarsh, harrow, coral, blackwater, frozen, sunken, ghostlight, temple and cinder maps, each with its own biome art (maps.js / tilemap.js). QA audit: /game?mapview=1&mapcheck=1&map=<key>.
- Map loading: loading veil, LRU map cache (4 maps), idle HTTP prefetch of map art, harbour prebuilt, retry when an asset fails.
- Per-map music (public/audio/*.mp3, ElevenLabs music via fal on the Universal Key). duel_pier has no track of its own yet and plays harrow, because the Universal Key balance ran out.
- New catch popup (CatchCard.js): underwater scene, measuring tape with length, rarity stars, exp, and View in Fishdex / Keep / Sell buttons.
- Realistic fish length: backend/fish_size.py (W = a*L^3 by body shape). All existing catches were backfilled.

## Backlog
- P1: Playgama/Bridge SDK integration; a music track for the duel pier
- P2: crew pond fishing; Pearl Shop cosmetics; species-specific fish art on the catch card

## Rounds 17-19 (Jun 2026)
- Duel Pier casting fixed; duel catches give nothing (no fish/xp/gold/Fishdex, no win gold), only score while the clock runs (duel_live.in_duel)
- Peers follow walk-grid paths (no water walking), presence every 600ms, smooth bob (per-peer seed)
- Rod grip: front fist overlay (art/chars/hand_*.webp) drawn over rod
- Landing: mascot behind sign-up frame, logo above shots, painted wallpaper (art/hud/home_bg.webp), relaxed-arm picker art (art/chars/idle_*.webp), logo checker removed
- Buildings re-cut solid with /app/scripts/solid_buildings.py (raw sources in /app/memory/raw/m_*.jpg; cleaned edits for guild_hall, house, fountain, swamp_shack, charter_boat)
- panel.webp seams blended (no corner gaps); in-game Settings (music, sound, kg/lb, cm/in) in More menu
- Favicon set (Harbourmaster), SEO title/description/og:image (art/og.jpg), VideoGame JSON-LD
- Water texture no longer scrolls (corals stay still); only the ripple displacement drifts

- Crews split: harbour Crew HQ = list of all crews + join/request/create + invites only; island Crew Clubhouse = own crew Home/Members/Manage (settings, requests, emblem, leave). Weekly crew challenge retired (no new contests, /contests upcoming empty, wiki text updated)
- Walk-in Crew Clubhouse (map key clubhouse, mode "clubhouse", yacht club art art/map/club_*.webp, t_clubwall/t_clubfloor): Notice Board (motd editor + broadcast + activity), Member Portraits (faces, promote/demote/kick), Trophy Shelf (GET /crews/{id} trophies), Captain's Desk (joining toggle, invite, colour, bank, leave), Mailbox (join requests). Managers = leader+officers. Island signpost "Enter the Crew Clubhouse"; exit returns near the hall. Presence scoped club:<crew>. Motd no longer needs the Hall perk.


