# The Ones Who Came Before: rules for every agent

A browser voxel game teaching NCERT Class 6 History, Chapter 4 ("Timeline and Sources of History"), to 11-year-olds
in India on cheap Android phones. Vanilla JS modules, Three.js 0.185 vendored, no build, no npm. Code in `game/`.
Public repo (free GitHub Pages), served from `main`. Git Gud Studio: agents write the code; one person directs and plays.

This is the only rule file (`CLAUDE.md` is `@AGENTS.md`). Cap 8 KB, enforced by the gate. A session that adds a
rule removes or shortens one.

## Read before starting, in this order, and nothing else

1. This file.
2. `HANDOFF.md`: state, who is on what, next (cap 6 KB).
3. On demand, only the part you need: `docs/GAME.md` (canon; before touching direction or scope),
   `docs/REFERENCE.md` (code map, controls, beats, systems, debug, traps), `docs/COVERAGE.md` (concept to beat),
   `docs/EDITOR.md` (world editor), `docs/TASKS.md` (open asks; git-ignored, on disk only).

Never read `docs/CHANGELOG.md` to start: grep it for why something is the way it is (code comments cite its
section numbers). `.ignore` keeps `game-baseline/`, vendored code and `godot/` out of rg, Grep and Glob
(`--no-ignore` to search them).

At session start: `git worktree list`, `git branch -a --no-merged main`; a branch ahead of `main` goes to the user
first. Two agents at once: each writes its task and owned files in HANDOFF's "Who is on what" before editing. One
owner per file; hub files (`main.js`, `strings.js`, `act1.js`, `sw.js`) belong to one agent at a time.

## Run and check

| | |
|---|---|
| Serve | `npx serve -l 8321 game` (or `.claude/launch.json`: `game` 8321; `compare` 8323 serves the repo root) |
| Gate | `node game/tools/check.mjs` before every commit. Red is fixed, never committed round. Never chain a commit on a pipe |
| Audio | `node game/tools/sync-audio-manifest.mjs` after adding or removing a clip |

## Standing rules

1. **The public repo carries the shipped game and nothing else.** No plans, ideas, specs, research, audits, briefs,
   tasks, session logs or review screenshots, ever. They go in git-ignored `docs/` folders (`plans/`, `design/`,
   `sources/`, `archive/`, `sessions/`, `shots/`, `ai/`) or the vault (`~/Documents/GitHub/Brain/brain/10 Projects/NCERT History Game/`).
   Before committing a new file ask: does the game need it to run, or does a developer need it to understand what
   shipped? If neither, add it to `.gitignore` **before** the first commit; after is forever. Tracked docs:
   `AGENTS.md`, `CLAUDE.md`, `HANDOFF.md`, `README.md`, `docs/{GAME,REFERENCE,COVERAGE,EDITOR,CHANGELOG}.md`,
   `game/README.md`, `game/audio/README.md`.
2. **No em dash or en dash in anything the player sees** (strings, HUD, buttons, cards, narrator, `alt`/`aria`).
   Use a comma, full stop, colon or parentheses. `lint-strings.mjs` fails on one.
3. **Keep the docs true.** When behaviour changes, in the same commit: fix `docs/REFERENCE.md` (and COVERAGE if a
   beat moved), add a `docs/CHANGELOG.md` entry stamped in IST (Asia/Kolkata), bring `HANDOFF.md` up to date.

## Conventions (do not break)

- Player text only in `game/src/strings.js`; canonical dates only in `game/src/constants.js`. The lint enforces
  both, the old-syllabus blocklist and the protected NCERT phrasings (`PROTECTED` in `lint-strings.mjs`).
- `SITES` in `world/terrain.js` is the one source of named places. Act scripts never hard-code a named coordinate.
- **Terrain heights are frozen** (bank caps, cave approach, jump 2.2, water breach were hand-verified in every world
  state). The training cave is the one exception; `regression.mjs` walks it.
- **Systems yield to scripts.** Anything autonomous (ambient life, idle wander) exposes `stop()` and is stopped
  before a scripted beat moves the same characters.
- **Dev tooling stays out of the shipped graph.** `src/dev/*` only by dynamic `import()` behind `?edit`, backtick,
  Ctrl+E or F2.
- **Check the world editor opens, every pass.** Nothing imports it, so no check notices it broke. Press backtick.
- `world/merge.js` folds static meshes: anything animated goes in `keep`, or it loses its transform (CL §12.1).
- Every new runtime module goes in `game/sw.js` ASSETS (the gate checks); bump `CACHE` when shipped files change.
- No `game/src` file over 1,500 lines. `act1.js` (1,673) and `dev/editor.js` (1,615) are frozen: shrink, never grow.

## Verification traps

- **Deploys: verify from a purged browser.** A warm service worker or the 10-minute HTTP cache serves old modules
  against new HTML. `fetch(url, {cache:'reload'})` repopulates (`no-store` does not). Read something only the new
  build has. `gh api repos/mailmeherepeople-eng/the-ones-who-came-before/pages/builds` says if Pages caught up.
- **Tap, do not click.** Enter, Space and E on `window` walk through screens a phone cannot leave. Dispatch to
  `document.elementFromPoint` at the button's centre; `.click()` ignores `pointer-events`.
- **Performance: fixed camera poses only**, from `renderer.gl.info`, machine recorded. The `high` tier is not
  desktop (midrange phones get it at DPR 3): test pointer coarseness when you mean form factor.
- **Hidden browser pane:** timers about once a second, CSS animations frozen at frame 0, screenshots time out. Few
  awaits per driver; size by `offsetWidth`; wrap `javascript_exec` probes in an IIFE.
- **Audio:** a synthetic click never satisfies autoplay. One real key press first.

More traps and the console driver: `docs/REFERENCE.md` §9.

## Do not undo (the why is in that CHANGELOG section)

| Decision | CL § |
|---|---|
| Player model hide is scripted per camera move, never `G.mode !== 'ground'` | 14.2 |
| Nothing that waits for input sits under `#fader` | 16 |
| NPC step ceiling 1.05; `tryMove` tries the direct move first (REFERENCE §6) | 13.3 |
| Store box deposit, borrowed tools returned, tool and harvest carried together | 13.3, 15.2 |
| Tribe speech is pictograms, voices are noises, never words | 13.3, 18.1 |
| The second hunt is a ruse with no deer; the bear spawns 73 blocks out | 15.2 |
| Wild berries are blocks and shared instances, not props | 15.2, 26 |
| Numeric answers are `type="text" inputmode="numeric"`, separators tolerated | 14.2 |
| Time lessons are user-paced: no timer, no speed reward | 23 |
| AAC `.m4a`, not Opus; voice streams, sfx decode; the folder is the voice; manifest generated, no BOM | 15.3, 17.2, 18 |
| Service worker network-first and off on localhost; `.m4a` not precached | 12, 13.3 |
| `game-baseline/` and `compare.html` stay (user's call, 2026-08-10) | 12.3 |

## Before you say done

- [ ] `check.mjs` every line PASS (read the numbers; exit 0 alone proves nothing). Read the whole diff.
- [ ] The world editor opens on backtick.
- [ ] Player-facing change: play that beat at 375x812 by tapping, no keyboard; look at the pictures.
- [ ] Audio: real key press first; count what sounds (`AudioBuffer.length`), not what downloads.
- [ ] Visual: before and after at fixed poses; colour questions read vertex colours, not pixels.
- [ ] Deploy: Pages build sha matches, purged browser, a new-only string read.
- [ ] REFERENCE, CHANGELOG (IST) and HANDOFF updated in the same commit.
- [ ] Say "built, waiting for your play" until the user has played it.

## Asks and records

- A new ask goes into `docs/TASKS.md` at once, dated, in the user's words. Done: the row leaves; its CHANGELOG
  entry names the commit.
- Never delete files git does not track: write the list and the command; the user runs it.
- Screenshots and scratch go in `docs/shots/` (ignored) or the session scratchpad, never the repo root.
- Session logs: the vault's `20 Areas/Claude Code Chats/` (global rule).
- Writing for agents: tables and bullets, short lines, present tense, no history, no em dashes.
