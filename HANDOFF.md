# Handoff: state and next

Cap 6 KB, only what is current. Read `AGENTS.md` first. When something here is done, take it out (the record goes
in `docs/CHANGELOG.md`).

## Resume here (2026-10-31 IST)

- Live on Pages: the bow (dd65fa8, §33, §34) and the crosshair on equip, no Take Aim (§35, the commit after it),
  service worker `towcb-v19`. The bow: hold to
  draw, honest crosshair, stuck arrows, the hunt in `games/hunt.js`, a training post at `SITES.trainingPost` (Scene
  A practice stop, title-screen rounds, medals, a local board), an erratic running deer, hunt deer that bolt in
  zigzags. The user played it in the browser ("it is fine").
- Waiting for the user's play: the bow on a real phone; everything since slice 1 on one.
- The 10-30 playground proposal (more game, a bigger world, from the textbook) is
  `docs/plans/2026-10-30-playground.md` (ignored). Phase 1 of it is §33.

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
| (none) | | | |

## Next, in order

From the 30 Oct playground proposal (`docs/plans/2026-10-30-playground.md`), the user's call ("its a game +
education. right now its just education and very little game"):

1. **More rounds at the post:** birds, a rolling hoop, date targets (oldest first, no clock), specialist targets.
2. **Grow the world east and south to about 224** (cost table in the proposal): grassland hunt with stalking, the
   Painted Rocks collectible, the lake, the sal forest.
3. **Compare without a server:** a date-seeded daily challenge and challenge codes; the Act 3 museum and trophy
   hall; arrows lost at the post dug up in Act 3.

Then the 27 Oct brief (`docs/plans/2026-10-27-improvements.md`):

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

Also open: split `act1.js` along its scenes before slices 2 to 4 grow it (frozen at 1,547 lines); a leftover
worktree branch `claude/infallible-almeida-b0bbe1` whose one fix is already on `main` (the user's call to delete); the Hindi strings
swap; vendor the Spectral and Cinzel fonts for offline; retune the lit style for the new palette; the world edge is a
flat wall into fog; `?fast` is dead (no act uses a countdown).

## Open decisions

| Decision | State |
|---|---|
| Engine | Three.js for now (2026-08-28: "restyle Three.js, then decide"). The Godot evaluation lives in ignored `godot/` |
| `game-baseline/` and `compare.html` | kept by the user's call (2026-08-10); do not tidy away |
| Scope | "make Chapter 4 great, start with the look" (2026-10-27); more chapters not decided |
