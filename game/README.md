# The Ones Who Came Before

A single-player browser game teaching NCERT Class 6 Social Science, Chapter 4
("Timeline and Sources of History") through play instead of study. Three acts,
one valley, one save file: live as an early human, watch time erase your life,
then excavate your own past as a five-specialist team.

Design: `../chapter4-design-doc.md` + `../docs/superpowers/specs/2026-08-07-chapter4-game-design.md`.
Syllabus coverage: `COVERAGE.md` (every examinable item → shipped beat).

## Run

Any static file server, no build step:

```
npx serve -l 8321 game
```

Then open http://localhost:8321. Works in desktop and mobile Chrome.
Desktop: WASD + mouse-drag (or click for pointer lock) + E + scroll.
Touch: left joystick to move, drag right side to look, tap to interact, pinch to zoom.

## Tech

- Vanilla JS ES modules; Three.js vendored in `vendor/` (offline after first load).
- Vertex-colored voxels, 16×16-chunk culled meshing, dirty-chunk remesh.
- 30 fps frame limiter, capped pixel ratio, context-loss recovery, hidden-tab
  logic heartbeat — tuned for low-end Android.
- Full localStorage and IndexedDB snapshots, activity checkpoints, import/export, and resume from the title screen.
- All text in `src/strings.js`; all canonical dates in `src/constants.js`.

## Content lint

```
node game/tools/lint-strings.mjs
```

Fails on old-syllabus blocklist terms, date literals outside the constants/strings
files, and deletion of protected NCERT phrasings (the "no year zero" trick, the
verbatim 2,583-years example, the "Perhaps they believed" hedge, and more).

## Debug/test parameters (dev only)

- `?fast` — 3-second countdown challenges instead of 30.
- `?act=2` / `?act=3` — jump straight to an act with seeded stand-in records.


## Study and recovery tools

Settings includes a chapter practice notebook, downloadable printable field journal,
full-story import/export, larger text, gentle camera, slower look controls and timing
assistance. Act selection is **Alt+M** or Settings; **Tab** navigates controls normally.
The notebook contains the supplied textbook's Chapter 4 date questions and project
prompts. Real museum visits, interviews and classroom discussion remain teacher-led.

## Checks

Run `node game/tools/check.mjs` from the repository root. With the game server running,
open `/tools/browser-tests.html` for browser integration tests; it uses its own save
slot and restores the previous slot. See `COVERAGE.md` for the textbook audit.
