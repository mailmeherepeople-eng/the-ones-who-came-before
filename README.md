# The Ones Who Came Before

A browser voxel game that teaches **NCERT Class 6 Social Science, Chapter 4, "Timeline and Sources of History"**
by making you *live* the history first and *excavate your own past* afterward.

**▶ [Play it](https://mailmeherepeople-eng.github.io/the-ones-who-came-before/game/)** on a phone or desktop, no install.

Made by Git Gud Studio. One valley, one save file, three acts, 51 syllabus items.

## The idea

| | |
|---|---|
| **Act 1: LIVE** | You are an early human. You paint a cave wall, throw a pot and press your maker's mark into it, weave a basket, bury an elder with her beads. Everything you make is stored with its place on the map. |
| **Act 2: PASS** | A time dial over your valley. Scrub from 5,400 BCE to 2026 CE and watch your own hut underground: the basket frays and vanishes, the pot chips but survives, the hut becomes a grassed mound. Then walk the missing year zero, count gaps between dates, and swap calendar faces. |
| **Act 3: DIG** | The present day, as a five-specialist team. You dig up *your own* objects (your actual painting revealed by lantern light, your actual maker's mark read by the epigraphist) and find the basket's empty slot: **"ORGANIC: NOT PRESERVED."** |

The preservation bias is not taught in a text box. You made the basket with one effortless tap in Act 1, and in
Act 3 it is the one thing missing.

## Run it locally

No build step, no npm dependencies:

```bash
npx serve -l 8321 game
```

Then open <http://localhost:8321>.

**Desktop:** WASD, mouse drag (or click for pointer lock), E to interact, Q to equip, scroll to zoom.
**Touch:** left joystick to move, drag the right side to look, tap to interact, pinch to zoom.

Before any commit: `node game/tools/check.mjs` (regressions, content lint, undeclared names, audio manifest,
offline precache, control characters, file sizes).

## Tech

Vanilla JavaScript ES modules with Three.js 0.185 vendored into `game/vendor/`, so the game runs offline after its
first load and has no toolchain. Vertex-coloured voxel chunks (160 x 24 x 160) with culled meshing, ambient
occlusion and baked sun shadows, a flat storybook default look, a 30 fps limiter, a capped pixel ratio and quality
tiers for cheap phones. Saves are full snapshots in localStorage and IndexedDB, including the player's original
artwork. A full in-game world editor (`?edit` or backtick) is loaded only on demand.

## Documentation

| File | What is in it |
|---|---|
| [AGENTS.md](AGENTS.md) | The rules for anyone (or any agent) working here. Start here |
| [HANDOFF.md](HANDOFF.md) | Current state, who is on what, what is next |
| [docs/GAME.md](docs/GAME.md) | What the game is: learners, goal, pillars, the three acts |
| [docs/REFERENCE.md](docs/REFERENCE.md) | How it works now: code map, controls, every beat, systems, debug tools |
| [docs/COVERAGE.md](docs/COVERAGE.md) | Every examinable syllabus item and the beat that teaches it |
| [docs/EDITOR.md](docs/EDITOR.md) | World editor guide |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | History of what shipped and why |

Design documents, plans and research are deliberately not in this repo (AGENTS.md rule 1). The NCERT textbook used
as the content source is reference input, so it is not here either.

`game-baseline/` is a frozen copy of the build before the mobile performance pass, playable side by side through
[compare.html](compare.html).
