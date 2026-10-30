# Fishing Realm — PRD

## Original problem statement
Full build brief "FISHING REALM — Complete Build Brief" (2.5D high-fantasy browser fishing MMO in League of Angels style; 8 build phases; server-authoritative fishing; VIP/recharge; guilds; world boss; admin + anti-bot). Build phase by phase.

## Owner choices (ask_human)
- Art: agent picks what fits the over-the-top League of Angels look → Emergent-managed image generation (Gemini image), cut-outs cleaned locally (chroma/black keying, no halos)
- Login: email + password (+ guest play from brief)
- Payments: later
- Gear durability: ON (gear wears out, repair with gold)
- Logo: agent-designed

## Architecture
- Frontend: React 19 + PixiJS v8 (+ pixi-filters: Godray, AdvancedBloom, Glow, Displacement), zustand store, React DOM HUD over the canvas, WebAudio SFX, i18n file (src/i18n.js)
- Backend: FastAPI + Motor. Modules: server.py, db.py, auth.py (JWT access/refresh, bcrypt, brute-force lockout via X-Forwarded-For, guest + claim), player.py (stamina regen/banking, BR, XP), game.py (cast/land/inventory/shop/gear), game_data.py (waters, 10 species, gear, items), sim.py
- Fight: deterministic 30 Hz simulation (mulberry32 seed) shared byte-for-byte by backend/sim.py and frontend/src/game/sim.js (parity 300/300). Server replays the client's hold intervals → server decides outcome; rejects empty input, too-fast fights (real-time check vs bite_at), reused/expired encounters, inhuman toggle rates; cast cooldown 1.5 s; optimistic `rev` lock on user writes.
- Art in /frontend/public/art (scene, landing, angler, wings, pet, logo, 10 fish + 256px webp icons). Script tools: /app/scripts/cutout.py, /app/scripts/e2e_fishing.py

## Implemented (2026-06, Phase 1 + 2)
- Landing (login / register / guest), owner seed (see memory/test_credentials.md)
- Crystal Lagoon Pixi scene: water displacement shader, waterfall streaks, mist, clouds, sparkles, petals, god rays, bloom, ambient leaping fish; winged angler + pet + rod/line with tension bending, bobber, bite "!", leaping hooked fish with rarity aura, catch fly-in, screen shake; auto low-graphics on slow devices
- Tension minigame (hold/release, zones, catch meter, timer, tricks: dive/run/shake/rally)
- Catch popup with rarity frames, variants (Golden/Shiny/Giant/Ancient), drops, world alert for Legendary/Mythic in World chat tab
- Level/XP (level-up refills stamina, banking up to 2×), stamina regen 1/3 min, potions
- Inventory (sell selected / batch sell), items, Fishdex (10 species, lore), bait shop, gear forge (5 tiers × rod/reel/line, buy/equip, enhance +15 with chances, stones, protection scroll, durability + repair), BR breakdown in HUD
- Full HUD layout: player panel, event icon grid (placeholders), minimap + channel, Fishing Tracker, left rail, chat tabs (System/World live; General/Guild Phase 4), quick slots, big FISH button, menus; compact mobile-landscape HUD + rotate overlay

## Backlog
- P0 Phase 3: quests (main/daily/weekly) + real Tracker, 9 more waters (3 painted), 250 fish, settings expansion
- P1 Phase 4: WebSocket channels, other players visible, chat, friends
- P1 Phase 5: wings/mounts/pets/fashion/rod skins/titles/skills/spirit systems
- P1 Phase 6: diamonds, recharge (provider TBD by owner), VIP, mall, pass, gacha with odds + pity, wheel, auto-fishing
- P2 Phase 7/8: events scheduler, world boss, guilds, market, tournaments, rankings, admin panel, bot catcher, analytics, SEO pages, portal flag
