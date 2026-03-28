# Pixel Gunner — Project Instructions

## Memory System

**At the start of every session, read these files before doing any work:**
- `memory/user.md` — who the user is and how they work
- `memory/preferences.md` — coding and communication preferences
- `memory/decisions.md` — key architectural and design decisions already made
- `memory/people.md` — people involved in the project

**At the end of every session (or when something significant changes), update the relevant memory files** to reflect new decisions, preferences, or context discovered during the session. Then commit and push the updates.

## Decision Logging System

When the user describes a meaningful decision, log it to `memory/decisions.csv` using:

```bash
bash scripts/log_decision.sh
```

Or append directly to the CSV with columns: `date, decision, reasoning, expected_outcome, review_date, status`
- `review_date` = 30 days from `date`
- `status` = `PENDING` (checker sets it to `REVIEW DUE` automatically)

**Scripts:**
- `scripts/log_decision.sh` — interactive prompt to add a new decision
- `scripts/check_reviews.py` — run by cron at 9am daily; flags overdue rows as `REVIEW DUE`
- `scripts/review.sh` — shows all `REVIEW DUE` items
- `memory/review.log` — cron output log

**Cron job** is installed and runs daily at 9:00am local time.

---

## Git & GitHub Workflow

**After every meaningful change, commit and push to GitHub. No exceptions.**

- Repository: https://github.com/willcampos87/pixel-gunner
- Branch: `main`
- Remote: `origin`

### Commit rules
- Stage only the files that were changed (never `git add -A` blindly)
- Write descriptive commit messages: what changed and why, not just "update game.js"
- Always push immediately after committing: `git push`
- Never leave work uncommitted — every session should end with a clean `git status`

### Commit message format
```
Short summary (imperative, ≤72 chars)

- Bullet points for key details if needed
- Focus on what changed and why

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Project Overview

Browser-based retro top-down shooter. Two files only:
- `index.html` — canvas shell, CSS scaling
- `game.js` — entire game (~1900 lines, vanilla JS + HTML5 Canvas)

No build tools, no dependencies. Opens directly via `file://` in any browser.

## Tech Notes
- Internal resolution: 480×270, scaled via CSS (`image-rendering: pixelated`)
- Mouse coordinates must be remapped to game space via `getBoundingClientRect`
- All sprites drawn with canvas primitives — no external image assets
- Bullet pooling to avoid GC pressure
- Circle-vs-circle collision with squared distance (no `Math.sqrt`)
