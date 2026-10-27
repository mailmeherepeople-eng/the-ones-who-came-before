# Handoff: state and next

Cap 6 KB, only what is current. Read `AGENTS.md` first. When something here is done, take it out (the record goes
in `docs/CHANGELOG.md`).

## Resume here (2026-10-28 01:05 IST)

- Live on Pages: `main` at 65b544d, service worker `towcb-v15`. Slice 1 of the 27 Oct visual plan has shipped:
  Vivid is the default look on every device, a central-Indian palette and trees, a ~90-block training cave, and a
  wordless valley reveal when the player steps out of it (CHANGELOG §29).
- In progress in the main session: torches in the training cave, a waterfall at the river's north end, a better
  player model.
- Docs and gate restructured on branch `worktree-agent-af61166f0c41c6f6c` (this layout, CHANGELOG §30), not merged.
- Waiting for the user's play: slice 1 on a real phone (not measured on one yet).

## Where things stand

| | |
|---|---|
| Game | all three acts play end to end: https://mailmeherepeople-eng.github.io/the-ones-who-came-before/game/ |
| Coverage | 51 tracked Chapter 4 items, each with a beat, a codex entry and a recall route (`docs/COVERAGE.md`) |
| Gate | `node game/tools/check.mjs`: regressions, content lint, undeclared names, audio manifest, precache, control characters, sizes |
| Voice | 6 of 111 narration lines recorded (the opening); 8 tribe noises; no music files yet |
| Performance | fixed-pose desktop numbers in CHANGELOG §29.6; Vivid (default) is cheaper than lit. No floor-phone bench yet |
| Records | save `towcb-save-v1` in localStorage and IndexedDB; teacher export at `?data`; classroom slots at `?pilot` |

## Who is on what

| Agent | Task | Files owned | Since |
|---|---|---|---|
| Main session | cave torches, north waterfall, player model | `game/src/**`, `game/tools/regression.mjs` | 2026-10-28 |
| Docs agent (worktree) | docs and gate restructure; remove this row on merge | root docs, `docs/`, `.gitignore`, `.ignore`, `game/tools/check.mjs` | 2026-10-28 |

## Next, in order

From the 27 Oct improvement brief (`docs/plans/2026-10-27-improvements.md`, git-ignored, on disk only), after slice 1:

1. **Opening and text timing.** Opening cards down to one line, controls taught in the world, teaching text that
   stays until read (brief C1, C8).
2. **The pot as a 3D object.** Shape it on a live lathe, fire it on screen (wet clay to terracotta); quieter rewards,
   silence at the grave (V2, C6).
3. **Act 3 reads as the present day.** Canvas tents, trench grid and ranging poles, a modern village, a look per
   specialist (V1). Bench before and after.
4. **An unfamiliar trench in Act 3**, so inference is not memory of Act 1 (audit F11).
5. **Records honesty.** Record first attempt, hints and delay; mastery only on independent repeat success; a
   persistent review schedule (audit F01, F08).
6. Then: camp and people (V5, V6), Act 2 declutter (V8), dig in layers (V11), `?beat=` jumps and a beat runner (W3),
   a taught-before-used check (W4), a floor-phone bench (P1), silent playtests (P2).

Also open: split `act1.js` along its scenes before slices 2 to 4 grow it (frozen at 1,673 lines); the Hindi strings
swap; vendor the Spectral and Cinzel fonts for offline; retune the lit style for the new palette; the world edge is a
flat wall into fog; `?fast` is dead (no act uses a countdown).

## Open decisions

| Decision | State |
|---|---|
| Engine | Three.js for now (2026-08-28: "restyle Three.js, then decide"). The Godot evaluation lives in ignored `godot/` |
| `game-baseline/` and `compare.html` | kept by the user's call (2026-08-10); do not tidy away |
| Scope | "make Chapter 4 great, start with the look" (2026-10-27); more chapters not decided |
| Main-checkout clutter | untracked shots, design docs and the audit report to move into ignored `docs/archive/`, `docs/design/`, `docs/sources/` (the restructure report lists each path) |
