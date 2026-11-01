# Handoff: state and next

Cap 6 KB, only what is current. Read `AGENTS.md` first. When something here is done, take it out (the record goes
in `docs/CHANGELOG.md`).

## Resume here (2026-11-01 night IST)

- **Start with `docs/plans/2026-11-01-handoff-for-tomorrow.md`** (ignored; copy in the vault, `10 Projects/NCERT
  History Game/2026-11-01 Handoff for tomorrow.md`): the user's play checklist for 27 Oct to 1 Nov, every change
  by area, their words and open threads (the diorama idea, the playground ideas, the 27 Oct brief).
- Live, waiting for the user's play: the 224 world (§39), the 19-issue phone playtest (§40: phone rig, device
  setting, follow camera on phones, bow anywhere, both bow views, the bear boss and dodge, world look, herds, 30 s
  sweep), bow round 2 (§41: mouse look, click to shoot, rabbits, wary animals, health bars, Skyrim stance, tabs),
  real arrow drop and the Oblivion Remastered first-person bow (§42). Cache `towcb-v23`.
- Open questions to the user: first person as the default bow view; medals at the post under arrow drop; mouse
  look not yet tried with a real mouse; nothing played on a real phone since the playtest.

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

0. **Task boards for the hamlet and the village** (the user's order, 11-01: map first, then these): plant, goats and
   the chief's errand in any order; pot and basket in any order. Same arms as the camp (CL §37).

From the 30 Oct playground proposal (`docs/plans/2026-10-30-playground.md`), the user's call ("its a game +
education. right now its just education and very little game"):

1. **More rounds at the post:** birds, a rolling hoop, specialist targets (date targets built, §36).
2. **Fill the new land** (grown in §39): the grassland hunt with stalking, paintings in the Painted Rocks' shelters
   as collectibles, a lake fishing contest, a forest trail race.
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

Also open: a leftover
worktree branch `claude/infallible-almeida-b0bbe1` whose one fix is already on `main` (the user's call to delete); the Hindi strings
swap; vendor the Spectral and Cinzel fonts for offline; retune the lit style for the new palette; the world edge is a
flat wall into fog; `?fast` is dead (no act uses a countdown).

## Open decisions

| Decision | State |
|---|---|
| Engine | Three.js for now (2026-08-28: "restyle Three.js, then decide"). The Godot evaluation lives in ignored `godot/` |
| `game-baseline/` and `compare.html` | kept by the user's call (2026-08-10); do not tidy away |
| Scope | "make Chapter 4 great, start with the look" (2026-10-27); more chapters not decided |
