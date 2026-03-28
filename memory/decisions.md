# Project Decisions

## Architecture
- **Two files only:** `index.html` + `game.js` — no build tools, opens via `file://`
- **480×270 internal resolution** scaled via CSS `image-rendering: pixelated`
- **Vanilla JS + HTML5 Canvas** — no frameworks, no dependencies

## Game Design
- **5 levels** with wave-based enemy spawning, then difficulty loops
- **6 enemy types:** Chaser, Shooter, Tank, Dasher, Hive, Sentinel (boss)
- **Health system:** 3 lives × 2 half-hearts = 6 pips
- **Score** persisted in `localStorage` as `pgHighScore`
- **All sprites drawn with canvas primitives** — no external image assets

## Technical
- Circle-vs-circle collision with squared distance (avoids `Math.sqrt`)
- Bullet pooling to avoid GC pressure
- Flat particle array, plain objects (no class allocation in hot path)
- Mouse remapped to game space via `getBoundingClientRect` scale factors
- 50ms delta-time cap to prevent spiral-of-death when tab is backgrounded
