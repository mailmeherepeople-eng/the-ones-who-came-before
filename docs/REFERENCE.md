# Reference: how the game works now

Read the section you need, not the file. Sections 1 to 9 keep the numbers of the old GAME-OVERVIEW sections, so a
"§7" in `docs/CHANGELOG.md` points here. History and the why behind decisions: grep `docs/CHANGELOG.md` (CL below).
Spot-checked against `game/src` on 2026-10-28 (beat order, keys, params, settings, sites, save, tiers); the rest
is condensed from the changelog, and anything doubtful is marked (unverified).

## 1. Quick facts and commands

| | |
|---|---|
| Genre | third-person educational adventure in a voxel valley |
| Platform | browser, phone first (cheap Android at 30 fps is the floor), desktop works; offline after first load |
| Engine | Three.js 0.185 vendored in `game/vendor/`, vanilla JS ES modules, no build step, no npm dependencies |
| Look | Vivid (flat storybook palette with soft baked light) is the default everywhere; the lit pipeline is a setting |
| World | one 160 x 24 x 160 voxel valley across all three acts; 16 x 16 column chunks; water level 5 |
| Saves | `towcb-save-v1`, full snapshots in localStorage and IndexedDB; settings separate (`towcb-settings-v1`) |
| Deploy | GitHub Pages serves `main` (repo root, so `/game/`, `/game-baseline/`, `/compare.html`). A push is a deploy |
| Offline | `game/sw.js`, network-first, cache `towcb-v15`, off on localhost; `.m4a` clips cached on first play only |

| Command | What |
|---|---|
| `npx serve -l 8321 game` | serve the game at http://localhost:8321 (`.claude/launch.json`: `game` 8321, `game-alt` 8322, `compare` 8323 serves the repo root) |
| `node game/tools/check.mjs` | the gate: regressions, content lint, undeclared names and imports, audio manifest, precache list, control characters, sizes |
| `node game/tools/lint-strings.mjs` | content lint alone |
| `node game/tools/regression.mjs` | gameplay regressions alone (berry models, frozen terrain and the training cave walk, timing across refresh rates, contact shadow, codex entries, textbook dates, valley phases, storage and slots) |
| `node game/tools/undeclared.mjs` | undeclared names and broken imports alone (acorn vendored in `game/tools/vendor/`) |
| `node game/tools/list-voice-lines.mjs --todo` | narration lines still to record and their filenames (`--csv` for a sheet) |
| `node game/tools/sync-audio-manifest.mjs` | rewrite `audio/manifest.json` from disk after adding or removing audio (`--check` reports only) |
| `/tools/browser-tests.html` | browser integration tests (served game); uses its own save slot and restores yours |

## 2. Architecture and code map

`game/index.html` loads `src/main.js` as a module; everything imports relatively. Shared modules in `src/` may import
strings, save, constants and ui, and never import from `src/acts/`. Acts are linear `await`-driven beats over shared
systems; `acts/beats.js` checkpoints each beat, and a beat whose record exists is skipped on resume.

| File | Owns |
|---|---|
| `main.js` | boot, title (valley orbiting behind it), frame loop, act sequencing, interactables, Alt+M act menu, editor entry routes, codex button |
| `constants.js` | world size, physics, `QUALITY` tiers and `pickTier()`, every canonical date (`YEARS`), `SAVE_KEY` |
| `strings.js` | every player-visible string (lint-protected); voice ids are its key paths |
| `syllabus.js` | the 51 COVERAGE items as data |
| `save.js`, `storage.js` | the save (records, cards, choices, checkpoints, inventory, codex, mastery, activities); LS + IndexedDB snapshots |
| `settings.js` | player settings, own key, built from the `SETTINGS` list |
| `inventory.js` | items and the `player` / `chest` / `store` containers |
| `codex.js`, `recall.js` | taught vs mastered terms; retrieval questions in fiction |
| `results.js` | teacher results (`?data`), CSV/JSON export, `?pilot` identity, the `SINKS` seam |
| `audio.js`, `sound.js` | synth bed and stingers; file audio (voice streams, sfx decode, voice pools, iOS session) |
| `engine/renderer.js` | scene, camera, sky dome, sun, clouds, lights, 30 fps limiter, hidden-tab heartbeat, context loss, `setSky`, `setRich`, shadows |
| `engine/post.js` | the Rich tier's one full-screen pass (FXAA, grade, ACES; FXAA only under Vivid) |
| `engine/input.js` | keyboard, mouse, pointer lock, touch joystick, drag-look, tap, pinch, `injectInteract()` |
| `world/voxel.js`, `blocks.js` | the Uint8Array world and dirty chunks; ~40 block defs, `registerBlock()` (custom ids from 64) |
| `world/terrain.js` | deterministic valley, river, cliffs, shelter, training cave, trees and flora, `SITES`, `TRAINING_CAVE` |
| `world/states.js` | era world-states 0 to 7, band drift, mound, log crossing, present day |
| `world/mesher.js` | chunk meshing: culled faces, AO, tint, baked sun mask, sway, water, cross flora, painted pass |
| `world/shade.js` | `enhance()` for every material: sun mask, mist, clouds, sway, water, Vivid light model, dark zone, glows |
| `world/props.js`, `merge.js`, `atlas.js` | ~25 prop factories; `foldStatic` mesh folding; the painted-block texture atlas |
| `player/player.js` | AABB physics, jump, swim and breach, camera boom, model (face, topknot, fur, beads, hide wrap; each moving part folded, CL §31.3), equip, trauma shake, character collision |
| `npc/npc.js`, `npc/ambient.js` | `Npc` and `Animal`: movement, carry, poses, bubbles, talk voice, looks (`LOOKS` per named character, a hashed mix otherwise, `modern: true` for Act 3; CL §32.2); the working-day scheduler |
| `fx/fx.js` | pooled particles (2 draw calls), rings, pillars, waves, motes |
| `acts/act1.js` | Act 1 scenes A to D (1,673 lines: frozen, split it before it grows) |
| `acts/onboarding.js`, `gathering.js` | the 12-stage cave tutorial and valley reveal call; the resumable first gathering task |
| `acts/act2.js`, `acts/act3.js` | Act 2 phases P1 to P6; Act 3 beats |
| `sky/dial.js`, `interface.js` | the timeline ruler, steps and settling; Act 2 notebook panel and playback |
| `sky/erosion.js`, `livingValley.js` | the soil cutaway; the illustrative Act 2 settlement (two instanced draws) |
| `sky/discoveries.js`, `timeLessons.js` | twelve illustrated landmark cards; the user-paced BCE/CE and gap lessons |
| `sky/interstitial.js` | sky glimpses between scenes, `valleyReveal`, `tween()` |
| `ui/hud.js` | objective, prompts, toasts, narrator, cards, choices, fader, satchel |
| `ui/objective.js`, `activity.js` | objective cue and the one beacon; one owner for a modal's input, focus and timers |
| `ui/minigames.js`, `paint.js`, `pot.js` | timing ring, number prompt (and an unused countdown); cave painting; pot wheel and mark |
| `ui/container.js`, `equipment.js` | chest and store-box slots, carry view; the equip control and tool selector |
| `ui/report.js`, `codexPanel.js` | source cards, claim board, lab, site report; the codex panel |
| `ui/chapterNotebook.js`, `journal.js`, `icons.js` | textbook notebook; printable field journal; stroke SVG prompt icons |
| `dev/editor.js`, `host.js`, `voxel-import.js` | the world editor (1,615 lines, frozen), its game adapter, importers. Dev only |

Engine details worth knowing:

- **Meshing:** each chunk emits up to four meshes (solid, water, cross flora, painted). Richness is vertex-colour
  maths (AO, tint, jitter, face shade), not textures. Flora is two crossed quads, `solid: false`.
- **Water surface:** a surface cell emits all its faces at 0.85 height, sides included (CL §11.1).
- **Baked sun:** each face corner marches toward the sun; the per-vertex `sun` mask dims light 0 only, so shade never
  goes black. Never add a DirectionalLight before the sun (CL §20.1).
- **Vivid** (`setVivid`): overwrites the lit result with albedo times a fixed face shade, then a storybook light
  model: soft sun mask (floor 0.7), `setDarkZone(TRAINING_CAVE)` (0.52), `setGlows()` (any number; `updateGlows`
  hands the shader the 8 nearest the camera within 40 blocks each frame; fire light adds), water glint, per-scene
  tint from `setSky(sky, fog, vividTint)`. Under Vivid the shadow map is neither enabled nor rendered. Folded meshes
  pass `enhance(mat, { linearColors: true })` so Vivid does not darken them twice (CL §27, §29.1, §31.1, §31.4).
- **Rich** (Settings, default on the `high` tier): shadow map, cloud shadows, one post pass (CL §20.6).
- **Quality tier** (`?q=high|low`): pixel ratio cap, clouds, particle caps, remesh budgets. `high` is a capability
  guess and lands on midrange phones at DPR 3; it is not "desktop" (CL §14.2).
- **Mesh folding:** `foldStatic(root, keep)` welds static parts into one draw; anything animated goes in `keep`.
  `foldIfStatic` folds only factories that return nothing but `group` (CL §12.1).
- **Shader time** wraps at 200 PI; every frequency in `shade.js` is a multiple of 0.01 (CL §20.4).

## 3. Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD or arrows | left joystick |
| Look | drag, or click for pointer lock | drag the right side |
| Interact | E or Enter, or click the prompt pill | tap the world or the pill |
| Jump | Space | jump button |
| Equip / put away | Q, or the equipment button | equipment button; a selector appears with several tools |
| Bow | Take Aim, then Fire or Lower bow on the right rail; E or Enter also fire | the rail |
| Camera distance | wheel (2.2 to 7.5 blocks) | pinch |
| Act menu | Alt+M, or Settings (confirms before wiping progress) | Settings |
| World editor | backtick, Ctrl+E, F2, or `?edit` (dev) | `?edit` |
| Focus | Tab moves between controls normally | |

- Prompts show an SVG icon and a verb ("Pick berries"). Narrator boxes sit centred, not at the bottom edge.
- Settings (gear, top left): larger text, gentle camera (default from reduced motion), assisted timing, slower look,
  auto-advance narration, lock camera behind me, sound, music, Rich graphics, Vivid style, Controls refresher,
  chapter notebook, story export and import.

## 4. The world

- 160 x 160 blocks. The original 128-block valley keeps its river formula and terrain seed (`CORE_SIZE`); an eastern
  grove and a southern meadow lie beyond the old boundary ridges.
- Central-Indian palette: monsoon green over red laterite, rose-buff sandstone cliffs, dark sandstone in caves,
  murram paths, mud walls and golden thatch, kans grass by the river. Trees: sal, banyan (walk-through `B.ROOTS`
  aerial roots), peepal, date palm, babul, the odd snag (CL §29.2, §29.3).
- Places come from `SITES` in `world/terrain.js`. Key ones: training cave rooms (`training*`, northwest), rock shelter
  (42,14) with the painting wall (42,9), Camp A (40,24), berry meadow (west), plains and herds (96,48), log crossing
  over the river at z about 37, village (76,80) that becomes the Act 3 mound, neighbour village (108,112), fossil
  cliff (102,12), modern village (24,106), dig camp (66,92).
- **Training cave:** a ~90-block single passage from the basket nook to the mouth (north, west, south, east), two
  sunlit cracks from y 14 up. The rock mass is x 1..36, z 1..22. `regression.mjs` walks it (CL §29.4). Twelve wall
  torches (`TRAINING_CAVE.torches`, `props.makeTorch`, no scene lights) for all of Scene A; the practice rooms have
  pale sandstone walls, the passage out stays dark (CL §31.1).
- **Waterfall:** the river begins at `WATERFALL` (`world/terrain.js`): a rock headwall (y 22) behind the gorge mouth
  holds the upper river at y 20, which falls 15 blocks off a lip at z 12 into the plunge pool. `props.makeWaterfall`
  (made once in `main.js`, ticked every frame) shows while the lip holds water, which is every era: it flows from
  Act 1, fed by the glacier in the ice age. The world is 24 tall; going higher means raising `WORLD.SIZE_Y`, which
  costs every remesh on a phone (CL §31.2, §32.3).
- Eras come from `world/states.js` stages: ice camp, thaw, hamlet, village, ruins, grassed mound, present day.
  Ice-age Scene A is pale and cold, but its river runs (only thin shore ice at the edges, z < 26); settled eras warm;
  Act 3 has a light morning mist (0.22).
- Not done: the world edge is a flat wall into fog; the lit style was not retuned for the new palette.

## 5. The playthrough, beat by beat

**Boot.** Title over the orbiting valley. Begin, or Continue (Start over asks first). A new game shows one promise
card ("Make a life here. Leave something behind.") and the era card. A resumed game shows its saved objective.

**Act 1, LIVE** (`acts/act1.js`). Every made thing is saved as a record with its position; Act 3 digs these up.

| Scene | Beats |
|---|---|
| A, Ice (about 38,000 years ago) | Wake lying in the training cave, tap to rise (once per story). 12-stage tutorial: look, walk, back, strafe left and right, jump the sill, pick up the basket, equip, put away, equip, exit, reach camp (Skip practice exists). Valley reveal on stepping out (about 13.6 s, skippable, once). Gather: basket equipped, 12 berries, deposit in the store box, return the basket. Hunt: borrow the bow, reach the plains, Take Aim and Fire real arrows, down 3 deer, take and deposit the meat. Second hunt is a ruse: the bear appears 73 blocks from camp, run to the fire, return the bow. Fish: borrow the rod, timing ring at one of 4 spots, deposit, return. Fire circle: the elder speaks in pictograms; recall `band`. Knapping (timing, 3 strikes). Cave painting on a rock canvas, saved verbatim and mounted on the shelter wall. Three shells, beads at the knapping stone. Trade with a strange band; recall `huntGather`. Depletion and the move. The burial: place beads and blade; "Perhaps they believed something continued." |
| B, Thaw (to 10,000 BCE) | Cinematic glimpse; the world thaws; protected caption on the last Ice Age |
| C, Roots (7,000 BCE) | Plant 4 fields, lead the goats into the pen, the granary question (no one sack is yours), recall `lostTongues`, the chieftain's waterskin task, the water dispute and the lean week |
| D, Fire and Clay (to 5,400 BCE) | Shape a pot and engrave your maker's mark (saved), weave a basket in one tap, shelf both in your hut, the copper trader, the grain delivery run to the neighbour village, recall `farming`, the lingering shot |

Tools are borrowed from the Community Chest and returned; food goes in the store box. Tribe members are talkable and
answer in pictograms and recorded noises, never words.

**Act 2, PASS** (`acts/act2.js`). A fixed diorama camera above the valley; no ground input. Left: a compact dark
notebook for the task and reference. Top right: the soil cutaway of your hut. Bottom: the timeline ruler with a big
year, one-year arrows, exact BCE/CE entry by clicking the year, landmark buttons, and playback (1x to 500x, default
100x, forward and back). An illustrative settlement grows and moves across ten phases (labelled imagined, not a claim
about this site). The dial has no year zero in its data model.

| Phase | What the player does |
|---|---|
| P1 erosion | predict which materials survive, then scrub about 5,200 years: basket gone, pot chipped, bones and beads stay |
| Deep time | a log-scale strip from Earth's formation to now |
| Free scrub | all markers live; twelve illustrated discovery cards with an observation question and a clue |
| P2 BCE/CE | user-paced lesson, four stops: names and aliases, the year bridge (no stone for zero), BC to BCE matching, which BCE object is older |
| P3 gap | six stops: count jumps, the shortcut, the Buddha to 2024 sum in three parts (560 + 2024 − 1 = 2,583, protected), a short crossing, a same-era gap, a typed final gap |
| P4 steps | put three changes in order, then decade, century (CE and BCE), millennium strides; two unlabelled flags: which happened first |
| P5 calendars | Gregorian face (leap rule 1800, 1900, 2000) swaps to the Indian luni-solar face (pañchānga) |
| P6 arrival | a three-question practice (4.13, 4.26, 4.16), ride to 2026 CE, descend to the mound, plant the survey flag |

No timer, impossible task or speed reward remains in the time lessons; Back and Show me how support review.

**Act 3, DIG** (`acts/act3.js`). Present day at the dig camp, as a five-specialist team chosen from a toolbar. Every
interactable is gated to its specialist; the wrong one fizzles with a teaching hint.

| Specialist | Verb |
|---|---|
| Geologist (teal) | survey the mound: ground vision shows dig zones, sterile soil, the old river |
| Archaeologist (amber) | four 3-layer pits: your pot, burnt grain, the elder's grave (inference, not fact), arrowheads; the empty basket slot ("ORGANIC: NOT PRESERVED"); the lantern reveals your painting |
| Palaeontologist (violet) | three fossil plates at the fossil cliff |
| Epigraphist (ink blue) | reads your maker's mark; reveals the narrator has been her field notes |
| Anthropologist (rose) | interviews in the modern village, one account contradicting the others |

Then the claim board (four claims, each needs selected sources and a verdict: supported, contradicted or cannot
tell), the lab (grain, charcoal, bone), and the finale: the gender-role caution with an application question, the
Site Report, and the closing definition of history. Act 3 still uses the Act 1 player model and an ancient-looking
village (later slices change both).

## 6. Living-world systems

- **Ambient life** (`npc/ambient.js`): each worker loops idle, to chest, take (lid opens, tool in hand), to site,
  work (pose plus an FX beat), back, put. A job is data (`{ id, item, at, pose, work, beat, onBeat }`); workers get a
  rotation. `assign(npc, jobs, 'work'|'return'|'outbound'|'idle')` seeds them mid-cycle so the camp is busy on
  fade-in. `npc.busy` holds the errand; a leg that cannot finish is abandoned after 45 s.
- **Systems yield to scripts:** a scene calls `ambient.stop()` before any beat that moves the band by hand; workers
  come back empty-handed with home and speed restored. Tests that drive NPCs must call it too.
- **Hunting ambience:** a second, small herd on the west meadow, far from `SITES.plains`, so ambient arrows never
  scatter the player's herd. Arrows use fresh geometry per instance (shared geometry is disposed per arrow).
- **Stateful props:** `makeCommunityChest` has a hinged lid and refcounted `hold()`/`releaseHold()`, plus `openFor(ms)`
  for the player. The factory owns the animation, the caller owns the intent.
- **Collision both ways:** the player is pushed out of character cylinders through `moveAxis`; characters refuse any
  step that closes the gap on the player. Both settle at 0.62 blocks.
- **Movement:** terrain heights are integers, so every rise is a full block. The player auto-steps 1.05 and jumps
  2.2; NPCs and animals step 1.05 with a hop and jump 2.2 with the player's impulse and gravity. Blocked NPCs try the
  direct move first, then a level detour, then a climbing one, and jump after 0.5 s stuck (0.65 s cooldown). Do not
  lower 1.05 or reorder `tryMove`: both were tried.
- **Animal distance gate:** far animals sleep, measured from a module-level `OBSERVER` set in `main.js`; a
  `followTarget` (the bear) never sleeps; opening the editor turns the gate off.
- **Inventory:** tools and harvests are carried together; a tap takes one tool but a whole stack of harvest. The
  container panel freezes the player (the only panel that does).
- **Act 3 villagers** retire outward and are disposed once out of the frustum (cap 14 s); fading is impossible
  because character materials are shared.

## 7. The world editor

Usage is in `docs/EDITOR.md`. Architecture:

- `src/dev/editor.js` imports THREE and nothing else from the game; `src/dev/host.js` (~150 lines) describes this
  game; `voxel-import.js` reads `.glb`, `.vox` and `.json`; `vendor/gltf/` is loaded on demand.
- `main.js` imports both dynamically on `?edit`, backtick, Ctrl+E or F2 (keys ignored while a text field has focus).
  A plain load creates no editor DOM. `window.__editor` is the instance, `G.host` the adapter.
- The host is an object (scene, camera, renderer, frame, cameraControl, input, voxel, props, characters, sites,
  ambient, setSky, player); a missing capability hides the features that need it. `frame.add` wraps
  `renderer.onFrame` once (time scale and pause); `cameraControl.take()` stubs both `player.syncCamera` and
  `player._cameraUnclip`.
- The deliverable is the **change list**: typed entries (move, remove, add, block, terrain, behaviour, import, set)
  exported as instructions for editing the source. Re-apply replays it onto a fresh scene. The editor is never a
  second source of truth.
- Painted blocks are a fourth mesher pass over a 256 x 256 atlas of 16 x 16 tiles; their vertex colour is pure light.
- Map size is recorded only: a resize is a source change and a reload.

## 8. Records, saves and learning data

| You make it (Act 1) | Time treats it (Act 2) | You find it (Act 3) |
|---|---|---|
| Cave painting (your PNG, verbatim) | survives, sooted | lantern reveal of your exact image |
| Pot (your profile and maker's mark) | chips, survives | dug up; mark read by the epigraphist |
| Basket (one tap) | gone within about 2,000 years | the empty slot, "not preserved" |
| Shell beads, stone blade, the burial | flesh and cloth go; bones, beads, blade stay | the quiet grave dig |
| Burnt grain, hearth, arrowheads, obsidian | persist | dug up by the archaeologist |

- **Save:** `Save.data` holds records, cards, choices, claims, labUsed, beatTimes, activities, objective, inventory,
  codex, mastery, session and `activeMs`. `load()` merges `{...FRESH(), ...parsed}`, so new top-level keys need no
  version bump. Marker records (`woke`, `hunted`, `bear`, `fished`...) guard one-time beats.
- **Storage:** full snapshots to localStorage and IndexedDB; boot takes the newer valid one; quota failures keep the
  art; reset writes an empty snapshot so old async data cannot revive; autosave runs periodically and on page hide.
  Settings export and import the story with validation.
- **Codex:** taught (the line fired, a ghost slot) vs mastered (retrieved later). All 51 items have entries.
- **Recall** (`recall.js`): spaced (drains an earlier miss first), no penalty, corrective feedback in the codex's
  words, in fiction (nobody says "quiz"), options shuffled. No recall at the burial. Misses are queued in memory
  only (no persistent schedule yet).
- **Results:** `?data` shows what this device recorded; CSV or JSON, one row per syllabus item; formula-like labels
  escaped. `submit(payloads, sink)` has one sink, `localDownload`; a backend is a new `SINKS` entry.
- **`?pilot`:** optional identity step that namespaces the save for shared classroom tablets. Off by default, no path
  from the title.
- **Notebook and journal:** the chapter notebook (Settings, Site Report) holds the textbook exercises and project
  prompts; notes persist; the field journal downloads as a printable HTML file with the player's art and evidence.

## 9. Debug, testing and traps

| Param or key | Effect |
|---|---|
| `?dev` | exposes `window.G` |
| `?act=1/2/3` | jump to an act with seeded stand-in records; only with no saved progress |
| `?q=high` / `?q=low` | force the quality tier |
| `?tp=x,z` | one-shot teleport once ground mode starts |
| `?edit`, backtick, Ctrl+E, F2 | the world editor |
| `?data`, `?pilot` | teacher results; classroom identity |
| `?fast` | 3-second countdowns, but no act uses a countdown now, so it does nothing visible |
| Alt+M | act menu (also in Settings) |

Driving the game from the console:

- Jump to a scene by writing the save: `localStorage.setItem('towcb-save-v1', JSON.stringify({version:1,
  updatedAt:Date.now(), act:1, beat:'a1.sceneC', records:[]}))`, then reload. Missing keys are backfilled. Boot also
  reads the IndexedDB copy (database `towcb-stories`) and takes whichever has the larger `updatedAt`, so a write
  without a fresh `updatedAt` silently loses (read from `save.js`, not run).
- The game re-saves on unload: clear storage from a non-game page on the same origin (`/README.md`) before `?act=`.
- A playthrough driver: dismiss `.card-overlay button`, `.narrator`, `.choice-box .btn`; teleport to the first enabled
  `G.interactables` entry; `G.input.injectInteract()`. Narrator boxes take a dispatched `pointerdown`.
- `G.mode = 'ui'` freezes the world for a clean shot. For a fixed camera, wrap `G.renderer._render` to set the camera
  before each frame. A hidden pane freezes frames: use Playwright for real pictures.
- Guard drivers with a `window.__drvOn` flag; timed-out `javascript_exec` calls keep running in the page.

Traps that cost real time:

- **Deploys:** a warm service worker serves old modules against fresh HTML, and Pages' 10-minute HTTP cache is a
  second layer. `{cache:'no-store'}` proves the server; `{cache:'reload'}` repopulates. Read something only the new
  build has. `gh api repos/mailmeherepeople-eng/the-ones-who-came-before/pages/builds` gives the built sha.
- **Keyboard fallbacks hide phone-fatal bugs.** `card()` and `narrator()` resolve on Enter, Space and E on `window`.
  Test input-gated beats by dispatching to `document.elementFromPoint` at the button's centre (CL §16).
- **Autoplay:** a synthetic click never grants activation; a refused clip resolves `ended` and the line skips. Press
  a real key first; check `navigator.userActivation.hasBeenActive` and `SFX.ctx.state === 'running'`.
- **Count what sounds, not what downloads:** a clip is fetched once and cached; fingerprint by `AudioBuffer.length`.
- **Hidden browser pane:** screenshots time out, CSS animations freeze at frame 0 (a popped panel measures 70%),
  `setTimeout` runs about once a second, `innerWidth` can be 0. Read `renderer.gl.info` and the scene graph; trust
  `getComputedStyle` or `offsetWidth`; keep driver loops to a few awaits; `resize_window` first.
- **Performance:** fixed camera poses only; a wandering player makes numbers incomparable.
- **Colour questions:** read vertex colours, not pixels; a block's R:G:B ratio survives shade, jitter, tint and AO.
- **Pixel diffs:** hide everything but the object under test (a pulsing beacon once looked like a regression).
- **`javascript_exec` calls share one scope:** wrap probes in an IIFE.
- **Boot-time errors:** a `let` read before its line (TDZ) or a statement wedged between `if` and `else` kills the
  whole module graph, and `node --check` may not see it. The gate's undeclared scan catches missing names only.
- **PowerShell `Set-Content`/`Out-File` add a BOM;** a BOM in `manifest.json` broke the tooling once.

| Revert | How |
|---|---|
| one change | `git revert <sha>`; every change is its own commit |
| the performance pass | tag `v1-pre-perf` |
| phone too slow or sparse | numbers in `QUALITY.low`, `constants.js` |
| see the pre-performance build | `/game-baseline/` and `/compare.html` (kept on purpose) |
