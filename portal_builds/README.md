# Fishing Realm — Portal build (Playgama + GameDistribution)

One build works on both portals: it uses the **Playgama Bridge SDK**, which also supports GameDistribution (`game_distribution` platform).

## Build
```
GD_GAME_ID=<your GameDistribution game id> bash /app/scripts/build_portal.sh
```
Output in `/app/portal_builds/`:
- `fishing-realm-portal.zip` — upload this archive (index.html at root, `playgama-bridge-config.json` next to it)
- `thumbnails/thumb_512x512.jpg`, `thumb_512x384.jpg`, `thumb_200x120.jpg` (GameDistribution required sizes)

## What the portal build does
- Fully self-contained: no backend calls, no login, no email, no personal data. Progress is saved through `bridge.storage` (never localStorage).
- Only external script: the Playgama Bridge SDK (first script in `<head>`). Google Fonts, analytics and preview scripts are stripped; fonts are bundled.
- `game_ready` is sent when the first playable frame renders.
- Interstitials at natural pauses only (Play button = pre-roll, after each catch/lost fish = mid-roll). Bridge/platform decides frequency (config sets 120 s minimum).
- Game pauses + mutes on ad open, tab hidden, platform pause or platform audio off; after an ad a "Tap to Continue" screen resumes play.
- No outgoing links, no store links, no VIP/recharge, no real-money purchases, no "coming soon" buttons, no chat, no typed player names.
- Music + SFX with separate toggles, 4-step "How to Fish" tutorial (replay from Settings), English default, keyboard/mouse + touch, rotate-device screen in portrait, tuned for 800×600 iframe.

## Store listing text (200–500 chars each)
**Description:** Fishing Realm is a high-fantasy fishing adventure in the floating Crystal Lagoon. Cast your glowing rod from golden docks, fight ten magical species from the Glimmer Minnow to the Mythic Starwhale, and keep the tension needle in the green zone to land them. Sell your catch, buy better bait, enhance and repair your rod, reel and line, fill the Fishdex and raise your Battle Rating.

**Instructions:** Press the FISH button or Space to cast. When a fish bites, hold FISH or Space (or touch and hold) to pull and raise line tension, release to ease off. Keep the needle in the green zone to fill the catch meter; stay out of red or the line snaps. Sell fish in the Inventory, buy bait in the Bait shop and upgrade or repair gear in the Rod forge.

Suggested genre: Casual / Simulation · Tags: fishing, fantasy, idle, relaxing, collection · Age: 7+ (no blood).

## Before submitting
- Create the game on GameDistribution to get the Game ID, rebuild with `GD_GAME_ID`.
- Run Playgama's QA Tool on the uploaded build.
- Portal version and web version differ (web has accounts/server). GameDistribution's terms ask the build to stay identical to other platforms — mention in submission that the web MMO is a separate online edition.
