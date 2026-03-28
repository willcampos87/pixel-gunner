# Pixel Gunner

Two files: `index.html`, `game.js` (~1900 lines). Vanilla JS + Canvas, 480×270, opens via `file://`. No build step.

**If you need project context:** `memory/user.md`, `preferences.md`, `decisions.md`, `people.md`. Log meaningful decisions to `memory/decisions.csv` (`bash scripts/log_decision.sh`). Review cron: `scripts/check_reviews.py` / `scripts/review.sh`.

**Git:** `main` → `origin` — https://github.com/willcampos87/pixel-gunner — commit and push real changes; stage only files you touched.

**Tech:** `image-rendering: pixelated`; mouse via `getBoundingClientRect`; circle–circle collision (squared distance); bullet pooling.
