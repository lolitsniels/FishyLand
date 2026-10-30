# Map design rules (Fishing Realms tiled maps)

Learned from user feedback. Follow these for every new map in `frontend/src/game/maps.js`.

## Art direction
- Modern stylized marina / seaside, NOT medieval. "Fantasy but not a simulator": polished mobile-game art.
- Buildings: front-facing (straight elevation, slight top-down tilt) so they line up with paths. Sideways/isometric only on a crossing.
- Props: modern (street lamps, fish crates/coolers, buoys, motor dinghy, sport-fishing boat). No castles, barrels-and-torches, wings.
- Generate with background "transparent" -> comes back as JPEG with fake checkerboard -> ALWAYS run rembg (isnet-general-use), crop to alpha bbox, check bottom rows for dithered shadows (kill alpha < 230 in the bottom band).
- UI = polished teak + brass + navy (panel.webp 9-slice, slice 195), Noto Sans body, Lilita One titles. Gold = /art/hud/gold.webp, pearls = /art/hud/pearl.webp everywhere.
- "Guild" is called "Crew" in all player-facing text.

## Layout
- Buildings sit in rows along a street with their base on the street edge; doors face the path. Signpost spot = door point just in front of base (y + 50..60).
- Notice/quest boards stand at the town square edge facing the path, never random.
- Every bridge must connect land to land and be walkable end to end (use `bridges: [{a, b, w}]` which draws planks exactly on the walkway). Never use a bridge sprite that doesn't match the walkway.
- Docks/piers start on land and run into water; posts use the post image (t_post.webp).
- Fishing spots: on banks, bridges or pier ends, each with a `cast` point that is in water.

## Placement safety (enforced in tilemap.js `settle`)
- Land props (trees, reeds, lamps, rocks, bushes, buildings) are auto-nudged to dry ground if any base point is in water. Only `wet` objects (boats) may sit in water; `ground` objects (none now) are flat.
- Still place props deliberately: keep trees/reeds >= 40px from the shoreline band (bank width ~80-110px).
- Fish leaps and sparkles are only spawned where `isWater` is true.
- Building footprints are rectangles covering the whole visual body (fp height ~0.6 * width) so players cannot walk into or behind them.

## Verification
- Use `/game?mapview=1` to see the whole map; check nothing overlaps paths, nothing half in water, all spots reachable.

## More rules (round 12 feedback)
- Never put lamps/props ON bridges, piers or their ends: keep >= 40px clear of bridge corridors and dock rectangles (enforced by `deck()` in settle), place lamps beside the path at bridge ends.
- Overlapping ground shapes: draw all soft shadows first, then all fills (no dark seams where paths meet plazas).
- Leaping fish: only species of that water (fx.leapArt), whole arc over open water (isWater && !walk at 5 points + above) - never from grass, never over bridges/piers.
- Image QA after every generation: composite on magenta and look. rembg can eat light-coloured walls (pastel houses) -> try `u2net` model if `isnet-general-use` leaves holes. Kill semi-transparent dithering (alpha < 200 -> 0). Round buttons: force alpha=255 inside the circle. Check bottom bands for leftover checkerboard.
- Islands: water `{ invert: poly }` = sea everywhere outside the island (even-odd fill).
- Travel map: no moving boat, no glow/cloud overlays; pins are round water thumbnails.

## Round 15 (all 15 maps tiled)
- Every water now has its own tiled map in `maps.js` (willow, greyfell, saltmarsh, harrow, coral, blackwater, frozen, sunken, ghostlight, temple, cinder). Biome tiles: t_snow/ice/moss/marsh/mud/rock/cave/ash/jungle/flag + waters t_lake/estuary/swamp/lagoon/deep/cavewater/jade/vent. Art pipeline: `scripts/biome_art.py`.
- QA tool: `/game?mapview=1&mapcheck=1&map=<key>` renders any map and sets `window.__mapAudit` = { moved, dropped, onPath, wetBad, spots, spawn }. Every list must be empty and spawn true before shipping a map.
- Tall props (jungle_tree/palm ~1.5x their width high) need y >= their height or the canopy is cut off at the map top. Props south of water: canopy must not paint over the water.
- Frozen Reach: the frozen bay is walkable `ice` ground; fishing holes are small water circles; spots sit ~85px south of each hole, cast = hole centre.
- Music: `public/audio/<map>.mp3` (ElevenLabs music via fal), played by `setMusicPlace()` in sfx.js. duel_pier and crew_island reuse harrow/coral until their own tracks are generated (scripts/gen_music.py duel_pier crew_island).
