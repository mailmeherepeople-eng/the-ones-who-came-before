# HANDOFF — start here

Written for a session starting cold with no memory of this project. Read this
top to bottom (five minutes), then open the two files in §7.

Last updated **2026-08-11 01:20 IST**.

---

## 1. What this is

**The Ones Who Came Before** — a browser voxel game teaching NCERT Class 6
Social Science, Chapter 4 ("Timeline and Sources of History"). Three acts: you
LIVE as an early human and leave traces, time buries them, then you excavate
your own past as a five-specialist team. Made by Git Gud Studio.

| | |
|---|---|
| **Play** | https://mailmeherepeople-eng.github.io/the-ones-who-came-before/game/ |
| **Compare builds** | https://mailmeherepeople-eng.github.io/the-ones-who-came-before/compare.html |
| **Repo** | https://github.com/mailmeherepeople-eng/the-ones-who-came-before (public) |
| **Local** | `C:\Users\user\Documents\GitHub\Social studies game - Claude` |
| **Stack** | Vanilla JS ES modules, Three.js v0.185 vendored. **No build step, no npm deps.** |

Public because free-plan GitHub Pages will not serve a private repo, and the
point was to play it on a phone.

## 2. Run it

```
npx serve -l 8321 game
```

Or use `.claude/launch.json`: **`game`** (port 8321, serves `game/`) or
**`compare`** (port 8323, serves the REPO ROOT so `/game/` and
`/game-baseline/` are both reachable, same as Pages).

Before every commit, one command for everything a machine can check (content
lint, audio manifest in sync, service worker precache complete, no control
characters in source):

```
node game/tools/check.mjs
```

Which narration lines still need recording, and what to name each file:

```
node game/tools/list-voice-lines.mjs --todo
```

**6 of 111 lines are recorded** (the opening, through to "take a basket from the
Community Chest"). The filename IS the `strings.js` key path. Character noises
live in `audio/sfx/npc/<voice>/`, where the FOLDER is the voice and the game
picks from it at random (§18).

After adding or removing ANY audio file:

```
node game/tools/sync-audio-manifest.mjs
```

Anything not in `manifest.json` is treated as silent, and that file is
generated now, so do not hand-edit it. See `game/audio/README.md`, §17, §18.

## 3. Debug parameters

`?dev` exposes `window.G` · `?fast` 3-second countdowns · `?act=1|2|3` jump to
an act with seeded records (only works with no saved progress) ·
`?q=high|low` force a quality tier · `?tp=x,z` teleport · **Tab** act menu.

**World editor: `?edit`, or `` ` `` (backtick), or Ctrl+E, or F2.** Four routes
because F2 alone was not reliable enough: most laptops need Fn to send it at
all, and browsers and Windows both claim it, which once made a perfectly
working editor look unwired. Backtick and Ctrl+E toggle it open and shut; F2
still works and does not double-fire. Opening it turns the animal distance gate
off, since the editor flies the camera the gate measures from.

## 4. Rules that must not be broken

Full text in [CLAUDE.md](CLAUDE.md). The two that are enforced by tooling:

1. **GitHub carries the shipped game only.** No planning docs, idea docs,
   specs, research notes or review screenshots, ever. `.gitignore` blocks the
   category by pattern. Add new files to it *before* the first commit.
2. **No em dash or en dash in anything the player reads.** Use a comma, full
   stop, colon or parentheses. `lint-strings.mjs` fails the build on one.

Inherited conventions that will bite if ignored:

- All user-visible text lives in `game/src/strings.js`. All canonical dates in
  `game/src/constants.js`. Both lint-enforced.
- `SITES` in `world/terrain.js` is the single source of truth for named
  locations. Act scripts never hard-code a coordinate that has a site name.
- **Terrain heights are frozen.** Bank caps, the cave approach, jump height and
  the water breach were hand-verified across all four world states.
- Systems yield to scripts: anything autonomous exposes `stop()` and is stopped
  before a scripted beat moves the same characters.
- `src/dev/*` never enters the shipped import graph (dynamic import behind
  `?edit` / F2 only).
- `world/merge.js` folds static part-meshes for performance. **Anything
  animated must be passed in `keep`** or it loses its transform.

## 5. Current state (2026-08-11)

All three acts play. Content lint green (38 files). Zero console errors across
Acts 1, 2 and 3 and the world editor, on desktop and at a 375×812 touch
viewport.

Seven passes have landed, all documented in `GAME-OVERVIEW.md`:

- **§12 — mobile performance.** Draw calls 1014 → 647 over four fixed camera
  poses (−36%). Act 2 dial stall: worst frame 59.9 → 24.9 ms (−58%). Real
  offline via service worker. A `QUALITY` tier picked per device, forced with
  `?q=`. **Since confirmed on a real phone.**
- **§13 — ten requested changes.** Both standing rules above, plus: tribe
  wording, three-deer hunt, Take Aim/Fire first-person bow, the store box
  deposit loop, talkable tribe members, the bear, NPC jumping, and the camera
  lock setting.
- **§14 — the known-bugs pass.** Every open item in §10 closed, each verified
  at runtime rather than by inspection. §14.2 lists the ones that carry a
  decision you should not undo (especially: do **not** simplify the player
  model hide to `G.mode !== 'ground'`, and P2's challenge must stay win-less).
- **§15 — Act 1: borrowed tools, inventory and audio.** The chest lends, the
  store box receives, and every tool must go back; the bear beat is now a ruse
  that walks you out to the plains still holding the bow. Adds `src/inventory.js`,
  `src/ui/container.js` and `src/sound.js`. §15.2 is the do-not-undo list.
- **§16 — the Scene B black screen.** Act 1 stopped dead on a phone at the
  10,000 BCE crossing: Scene C raised its first card *underneath* `#fader`
  (z-index 50, `pointer-events: auto`, card at 30), so the card was invisible
  and its Continue button ate no taps. Only the keyboard fallback could clear
  it, which is why desktop never saw it. One line: lift the fader before the
  card, as `sceneD` already does. Every other fade window swept and clean.
- **§17 — the opening is voiced.** Six recordings in, and `HUD.card()` learned
  to narrate: four of the six are cards, and only `narrator()` had a voice path,
  so the opening would have skipped them. A voiced card reads itself and closes
  on `ended`; an unvoiced one is untouched. Also: a UTF-8 BOM in
  `manifest.json` made the tooling report every recorded line as unregistered.
- **§18 — character voices.** Talking to a tribe member plays one of their own
  recorded noises. **The folder is the voice** (`sfx/npc/tribe/`,
  `sfx/npc/elder/`) and the filename is only a variant label, so adding a line
  never touches code. Never the same clip twice running, one voice at a time
  per pool, and an empty pool falls back to `npc/tribe` then to the old synth
  blip. `manifest.json` is generated by a tool now. **§18.5**: on iOS the silent
  switch used to silence character noises while narration played on regardless,
  because one is Web Audio and the other is a media element. A silent looping
  element now holds the session so everything behaves alike.

**Act 1 is the current focus.** Acts 2 and 3 are deliberately untouched by §15.

## 6. Movement rules, because they are subtle

Terrain heights here are **integers**, so every rise in the world is a full
block. That single fact drives all of it:

| | |
|---|---|
| Player | Walks up to **1.05 blocks** automatically (`_stepMove`), jumps 2.2. |
| NPCs and animals | Step 1.05 with a visible hop, and **jump 2.2 using the player's own impulse and gravity**, so both can walk exactly the same ground. |
| Blocked NPCs | Try the direct move first (step allowed), then a level way round, then a climbing one. If still stuck for 0.5 s they jump anyway, with a 0.65 s cooldown. |

Do **not** lower the 1.05 ceiling. It was tried: because rises are whole
blocks, a smaller ceiling strands characters on open ground. And do not
reorder `tryMove` to try level candidates before the direct one, also tried:
characters then prefer sliding sideways along an obstacle over crossing it.

## 7. Where to start reading

1. **`GAME-OVERVIEW.md`** — the full reference. Architecture, every act beat by
   beat, the living-world systems, the editor, §12 performance, §13 changes.
2. **`game/EDITOR.md`**, then open the game with `?edit` and fly around. Ten
   minutes there explains the world faster than any document.
3. `game/src/acts/act1.js` — the act scripts are the screenplay: linear
   `await`-driven beats over shared systems.
4. `game/src/npc/ambient.js` — the clearest example of a system that must
   yield to those scripts.
5. `game/src/world/mesher.js` — where the game's whole look comes from.

## 8. Open work

- **`game-baseline/` and `compare.html` stay, deliberately.** The frozen copy of
  the pre-performance build was originally meant to be deleted once the
  side-by-side comparison had served its purpose. That comparison was run on a
  real phone on 2026-08-10 and the current build won, and the pair is being kept
  anyway: it is the only standing reminder of what the performance work actually
  bought, and it costs nothing to leave in place. Do not "tidy" it away.
- **Hindi string swap.** All text is already isolated in `strings.js`, and the
  two dead strings are gone, so the file is now exactly what needs translating.
  The lint rules (no em/en dash, the protected NCERT phrasings) would need
  extending to cover a second language.
- **Nothing else is outstanding.** `GAME-OVERVIEW.md` §10 is fully closed as of
  §14; the entries are kept there for the decisions they record.

## 9. Undoing things

| | |
|---|---|
| Whole day's work | `git reset --hard v1-pre-perf` |
| One change | `git revert <sha>` — every change is its own commit, see `git log --oneline` |
| Phone looks too sparse or too slow | numbers in `QUALITY.low`, `game/src/constants.js`. No revert needed. |
| See the old build | still live at `<site>/game-baseline/` |

## 10. Traps that cost real time here

- **Verify a deploy from a purged browser.** A warm service worker will happily
  serve the previous build's modules against fresh HTML and tell you the deploy
  worked. It shipped a build that appeared to have none of its new features.
  The worker is network-first now and skips localhost entirely, but check with
  a hard reload anyway.
- **Unregistering the worker is not enough: the HTTP cache is a second layer.**
  Pages sets a ten minute max-age, so after a push the browser keeps serving the
  old modules even with no worker and an empty Cache Storage. Two things follow.
  First, `fetch(url, {cache:'no-store'})` proves the SERVER has the new build but
  does nothing for the running page, because no-store deliberately does not
  write through; use `{cache:'reload'}` on the changed files, which bypasses the
  cache AND repopulates it, then reload. Second, confirm what is actually
  running before trusting any check: read something that cannot exist in the old
  build (a new string key, or a deleted one now `undefined`). Every check run
  against a stale bundle is worse than no check, because it looks like evidence.
- **`gh api repos/OWNER/REPO/pages/builds` tells you if Pages has caught up.**
  It reports the built commit sha and status, which separates "not deployed yet"
  from "deployed, and my browser is lying to me". Those need opposite responses.
- **Fixed camera poses for any performance measurement.** A wandering player
  makes readings incomparable; a whole first round of numbers was junk.
- **The `high` quality tier is not "desktop".** `pickTier()` returns `high` for
  any coarse-pointer device with more than 4 cores or more than 4 GB, i.e. most
  midrange Androids, and they run at DPR 3. Gating an expensive visual on the
  tier and calling it a desktop-only treat puts the cost straight onto the
  phones this game is built for. It nearly shipped that way in the §14 pass.
  **Test pointer coarseness if you mean form factor.**
- **Hide everything but the object under test when diffing pixels.** A pulsing
  objective beacon masqueraded as a geometry regression.
- **A synthetic click never satisfies autoplay policy, so audio tests lie.**
  With no user activation every clip fails to start, `playVoice` resolves
  `ended` on that failure (correct: a refused clip must not hang the story), and
  the line auto-advances instantly, which looks exactly like the feature being
  broken. Grant activation with a real keypress first (`computer` → `key`), then
  drive the rest however you like. `navigator.userActivation.hasBeenActive` and
  `SFX.ctx.state === 'running'` confirm it took.
- **A keyboard fallback will hide a phone-fatal bug from every desktop test.**
  `HUD.card()` and `HUD.narrator()` also resolve on Enter / Space / E, bound to
  `window`, where no z-index can block them. Act 1 shipped with a card raised
  under `#fader` (opaque, z-index 50, `pointer-events: auto`) and desktop walked
  straight through it on the spacebar while every phone stopped dead on a black
  screen (§16). **Test any input-gated beat the way a finger meets it**: read
  `document.elementFromPoint` at the button's centre and dispatch to *that*, not
  to the element you meant to press. A `.click()` on a covered node proves
  nothing, because it ignores `pointer-events` entirely.
- **The browser pane starves compositing when hidden**, so screenshots time
  out. Read `renderer.gl.info` and the scene graph via JS instead, which is
  more reliable anyway.
- **A hidden pane also freezes CSS animations at frame 0**, which is the same
  root cause wearing a different hat. `fx-pop` starts at `scale(0.7)`, so every
  `getBoundingClientRect()` on a popped-in panel reads 70% of its real size and
  a 44 px touch target looks like a 35 px one. **Trust `getComputedStyle` over
  bounding rects for resting size**, or `offsetWidth`/`offsetHeight`, which are
  layout boxes and immune to transforms. This cost a real detour in §14 and
  again in §15.
- **A hidden pane throttles `setTimeout` to about once per second.** A driver
  loop with forty 300 ms sleeps takes forty seconds, not twelve, and the tool
  call dies at its 30 s limit looking exactly like a crash. **Keep driver loops
  to a handful of awaits**, and prefer synchronous work (`mesher.flush()` in a
  plain `for`) over polling. The script keeps running in the page after the
  timeout, so probe the result in a second call rather than re-running it.
- **`innerWidth` can be 0** when the pane is fully collapsed, which silently
  makes `auto-fill` grids resolve to one column and every layout measurement
  meaningless. Check the viewport before trusting a layout number, and
  `resize_window` to a real size first.
- **For colour questions, read vertex colours, not pixels.** Trees and flora
  block the shot, and the mesher's face shade, jitter, tint and AO are all
  scalar multipliers, so a block's R:G:B *ratio* is an exact fingerprint that
  survives all of them. Scanning the scene's colour attributes proved the trunk
  fix in one call after two failed attempts at aiming a camera at a trunk.
- **`javascript_exec` calls share one scope**, so a repeated `const G` throws.
  Wrap probes in an IIFE. Timed-out calls also keep running in the page: guard
  drivers with a `window.__drvOn` flag or two will fight.
- **Narrator boxes need a dispatched `pointerdown`**, not `.click()`.
- Ambient life reclaims characters. Call `ambient.stop()` before any test that
  drives an NPC by hand, or it will wander off mid-measurement.

## 11. Not in this repo (but on disk)

Gitignored by rule 1, still in the project folder locally:
`chapter4-design-doc.md`, `class6-history-knowledge-map.md`,
`ideas for game dev for each concept.md`, `two-mode-allocation.md`,
`docs/superpowers/specs/`, `screenshots-visual-overhaul/`, and
`social science textbooks/class 6.zip` (~201 MB, also over GitHub's file
limit).

**`docs/ai/` is worth opening first.** Nine documents adapted from the AI
Collaboration Field Guide, on disk and mirrored to the vault at
`20 Areas/Claude Code Chats/ai-docs/`:

| | |
|---|---|
| `ARCHITECTURE.md` | the shape of the system |
| `FLOW.md` | how execution actually travels, boot to frame loop to audio |
| `CONSTRAINTS.md` | what must never happen without asking |
| `DECISIONS.md` | every do-not-undo in one index |
| `TEST-CHECKLIST.md` | what a machine can check, and the human half that matters more |
| `ROLLBACK.md` | the way back out |
| `BUGS-AND-FEATURES.md` | index of the traces in §12 to §18, plus the template |
| `HANDOVER.md` | how this continuity system fits together |
| `COMMENTS.md` | the commenting standard |

A fresh clone will not have them, which is what the vault mirror is for.

Session history lives in the Obsidian vault at
`~/Documents/GitHub/Brain/brain/20 Areas/Claude Code Chats/`, and the project
note at `10 Projects/NCERT History Game/`.
