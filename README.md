# The Ones Who Came Before

A browser voxel game that teaches **NCERT Class 6 Social Science, Chapter 4 — "Timeline
and Sources of History"** by making you *live* the history first and *excavate your own
past* afterward.

**▶ [Play it](https://mailmeherepeople-eng.github.io/the-ones-who-came-before/game/)** — desktop or phone, no install.

Made by Git Gud Studio. One valley, one save file, three acts, ~50 syllabus items.

---

## The idea

| | |
|---|---|
| **Act 1 — LIVE** | You are an early human. You paint a cave wall, throw a pot and press your maker's mark into it, weave a basket, bury an elder with her beads. Everything you make is stored with its map position. |
| **Act 2 — PASS** | A draggable time dial. You scrub 5,400 BCE → 2026 CE and watch a cutaway of your own hut: the basket frays and vanishes, the pot chips but survives, the hut collapses into a grassed mound. Plus the no-year-zero trick, the BCE/CE gap formula, and the calendar faces. |
| **Act 3 — DIG** | Present day, five-specialist excavation team. You dig up *your own* objects — your actual painting PNG revealed by lantern light, your actual maker's mark read by the epigraphist — and the basket's empty slot: **"∅ ORGANIC — NOT PRESERVED."** |

The preservation bias isn't taught in a text box. You made the basket with one effortless
tap in Act 1, and in Act 3 it is the one thing missing.

## Run it locally

No build step, no npm dependencies:

```bash
npx serve -l 8321 game
```

Then open <http://localhost:8321>.

**Desktop:** WASD + mouse-drag (or click for pointer lock) + E + scroll.
**Touch:** left joystick to move, drag the right side to look, tap to interact, pinch to zoom.

## Tech

Vanilla JavaScript ES modules with Three.js v0.185 vendored into `game/vendor/` — the game
runs offline after first load and has no toolchain at all. Vertex-coloured voxel chunks
(128×24×128) with culled meshing and per-vertex ambient occlusion, a 30 fps limiter, a
capped pixel ratio, WebGL context-loss recovery and a hidden-tab logic heartbeat.
`localStorage` saves with a checkpoint at every beat.

There is also a full in-game **world editor** (`?edit` or **F2**) — flight, click-select,
terrain brush, `.glb`/`.vox` import, a 16×16 per-face block painter — written against a
~120-line host adapter so it ports to any Three.js project.

## Content lint

```bash
node game/tools/lint-strings.mjs
```

Fails on old-syllabus terms, date literals outside `constants.js`/`strings.js`, and any
edit to the protected NCERT phrasings (the no-year-zero trick, the verbatim 2,583-year
worked example, the "Perhaps they believed" hedge). Keep it green.

## Documentation

**Picking this up cold? Read [HANDOFF.md](HANDOFF.md) first.** It is the
five-minute orientation: current state, how to run and test, the rules that
must not be broken, open work, and the traps that cost time here.

| File | What's in it |
|---|---|
| [HANDOFF.md](HANDOFF.md) | Start here. Session-start orientation and current state |
| [GAME-OVERVIEW.md](GAME-OVERVIEW.md) | The complete reference: architecture, every act beat by beat, the living-world systems, the editor, known bugs |
| [game/COVERAGE.md](game/COVERAGE.md) | Every examinable syllabus item → the beat that teaches it |
| [game/EDITOR.md](game/EDITOR.md) | World editor user guide |
| [CLAUDE.md](CLAUDE.md) | Standing rules for this repo, both enforced by tooling |

The design documents, knowledge map and spec are deliberately **not** in this
repo (see CLAUDE.md rule 1). They live on the author's disk and in the vault.

## Debug parameters

`?fast` (3-second countdowns) · `?act=2` / `?act=3` (jump with seeded records) ·
`?dev` (expose `window.G`) · `?tp=x,z` (teleport) · `?edit` (world editor) ·
**Tab** (act menu) · **F2** (editor)

## Not in this repo

`social science textbooks/class 6.zip` (~201 MB) is the NCERT source bundle. It exceeds
GitHub's 100 MB per-file limit and is reference input rather than project output, so it is
gitignored — re-downloadable from NCERT if you need it.
