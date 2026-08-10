# The Ones Who Came Before — Complete Game Overview

A single-player browser voxel game that teaches **NCERT Class 6 Social Science, Chapter 4 — "Timeline and Sources of History"** — by making the player *live* the history first and *excavate their own past* afterward. You spend Act 1 as an early human leaving traces (a cave painting, a pot with your maker's mark, a burial), Act 2 watching millennia erase and bury those traces, and Act 3 as a five-specialist excavation team digging your own life back up and reasoning about it like a historian.

Made by "Git Gud Studio". One valley, one save file, three acts, ~50 syllabus items covered (see `game/COVERAGE.md` for the item-by-item mapping).

---

## 1. Quick facts

| | |
|---|---|
| Genre | Third-person educational adventure in a voxel sandbox world |
| Platform | Browser (desktop + mobile Chrome), fully offline after first load |
| Engine | Three.js v0.185 (vendored), vanilla JavaScript ES modules, **no build step, no npm dependencies** |
| Rendering | Vertex-colored voxel chunks by default (plus an optional texture-atlas pass for player-painted blocks), Lambert lighting, 30 fps frame limiter tuned for low-end Android |
| Persistence | `localStorage` save, autosave at every beat, resume from title |
| Run | `npx serve -l 8321 game` → http://localhost:8321 (or the `.claude/launch.json` "game" config) |
| Content lint | `node game/tools/lint-strings.mjs` — blocks old-syllabus terms, stray date literals, and edits to protected NCERT phrasings |
| World editor | `?edit` or **F2** — a full in-game scene editor, lazily loaded, host-adapter based so it is reusable in any three.js project. See `game/EDITOR.md` and §7 below |

---

## 2. Tech stack and architecture

Everything lives under `game/`. No framework, no bundler — `index.html` loads `src/main.js` as a module and everything imports relatively. Three.js is vendored in `game/vendor/` so the game works offline.

```
game/src/
├── main.js            boot, title screen, frame loop, act sequencing, Tab act-menu
├── constants.js       world dims, player physics values, canonical dates, SAVE_KEY
├── strings.js         EVERY user-visible string (Hindi swap planned); lint-protected
├── save.js            localStorage save system: records, cards, choices, beat checkpoints
├── audio.js           tiny WebAudio SFX synth (blips, success, hush, trick)
├── engine/
│   ├── renderer.js    scene, camera, sky dome + sun + clouds, lighting, 30fps limiter,
│   │                  hidden-tab heartbeat, context-loss recovery, setSky(skyHex,fogHex)
│   └── input.js       WASD/mouse (pointer-lock + drag fallback), touch joystick +
│                      drag-look + tap-to-interact + pinch zoom, injectInteract()
├── world/
│   ├── voxel.js       flat Uint8 world (128×32×128), get/set, topAt, dirty chunks
│   ├── blocks.js      ~38 block defs + registerBlock() for runtime/custom types
│   ├── atlas.js       lazy 256×256 texture atlas (16×16 tiles) for painted blocks
│   ├── mesher.js      chunk mesher: face culling, per-vertex ambient occlusion,
│   │                  position-noise tinting, crossed-quad flora, water shimmer,
│   │                  optional textured pass for blocks that carry atlas tiles
│   ├── terrain.js     deterministic valley gen (noise heightfield, river, cliff,
│   │                  cave carve, fossil cliff strata, tree/flora scatter), SITES atlas
│   ├── states.js      era world-states 0-7 (ice age → present day), band drift,
│   │                  mound builder, log river crossing, diorama edge strata
│   └── props.js       ~25 prop factories (campfire, chest, pots, baskets, carts,
│                      boulders, butterflies…) — {group, update?} objects, each
│                      group.name-tagged so the editor can list them
├── player/player.js   AABB voxel physics (gravity, jump 2.2 blocks, swim/breach),
│                      third-person camera boom + visible character model,
│                      resolveCharacters() body collision against NPCs/animals
├── npc/
│   ├── npc.js         Npc + Animal classes: footprint collision, slide/detour pathing,
│   │                  wading, separation, player-as-obstacle, carried items, work
│   │                  poses, blob shadows, idle life, icon speech bubbles
│   └── ambient.js     the working-day scheduler: NPCs take tools out of the shared
│                      chest, work a site, and bring them back (see §6)
├── dev/               DEV ONLY — never in the shipped import graph
│   ├── editor.js      the world editor (host-agnostic; see §7)
│   ├── host.js        the ~120-line adapter that describes THIS game to the editor
│   └── voxel-import.js  .glb / .vox / .json importers + block-type registration
├── fx/fx.js           pooled particle toolkit: burst/puff/ring/pillar/pulseWave/
│                      floaties/flash/confetti/flames/smoke — 2 draw calls total
├── acts/
│   ├── beats.js       beat runner: sequential beats w/ per-beat save checkpoints
│   ├── act1.js        Act 1 "LIVE" — scenes A-D (band camp → farming village)
│   ├── act2.js        Act 2 "PASS" — the sky time-dial act
│   └── act3.js        Act 3 "DIG" — the five-specialist excavation
├── sky/
│   ├── dial.js        the draggable timeline dial UI (BCE/CE, markers, step locks)
│   ├── erosion.js     the erosion cutaway panel (layer-by-layer decay canvas)
│   └── interstitial.js  cinematic camera flights with year tickers + letterboxing
└── ui/
    ├── hud.js         objectives, prompts, toasts, narrator boxes, cards, choices
    ├── minigames.js   timing-ring minigame, countdown challenges, number prompts
    ├── paint.js       the cave-painting canvas (ochre palette, stamps, undo)
    ├── pot.js         the pot-shaping wheel (drag profile) + maker's-mark editor
    └── report.js      source cards, claim board, lab tray, satchel, site report
```

### Engine details worth knowing

- **World**: a single 128×32×128 voxel volume. Terrain is deterministic value-noise (no RNG seeds stored) — one valley with a winding river, a north cliff containing a carved rock-shelter cave, plains east, meadow west, and a banded fossil cliff. Every named location lives in `SITES` (terrain.js) — the single source of truth acts script against.
- **Meshing**: 16×16-column chunks, culled faces, indexed geometry. Each chunk emits up to **four** meshes — solid, water, cross-flora, and (only if a painted block is present) textured. Visual richness comes from *vertex color math*, not textures: classic 4-level **ambient occlusion** per vertex, low-frequency position tinting (meadow patches, warm/cool grass drift), per-face jitter, birch-ring banding, depth-graded cave rock, per-vertex water shimmer. Flora blocks (`cross: true`) render as two tapered crossed quads instead of cubes — tall grass, flowers, ferns, berry shrubs, snow tufts, reeds — all `solid: false` so they never block movement.
- **Water surface geometry**: a water cell whose neighbour above is *not* water is the surface cell, and **all** of its faces (top and sides) are emitted at 0.85 of block height. Getting this wrong is visible — when only the top face was lowered, every surface cell had a 0.15 wall standing proud of its own surface and the river read as floating slabs with a gap underneath. Submerged cells stay full height so a column has no internal seams.
- **Walkability is sacred**: riverbank heights are capped (≤1 block above water at the edge, ≤2 one step back) so every stretch of river is exitable; the cave approach is a graded ≤1-block staircase; player jump clears 2.2 blocks; a jump-press in water breaches with enough force to climb 2-block banks. These were hand-verified — terrain height changes are treated as forbidden by default. The one deliberate addition is the **log crossing** (`buildLogCrossing`, states.js): three trunks laid at `WATER_LEVEL + 1`, which is exactly the height the near banks are capped to, so both ends are flush — no step, no jump. It is laid outward from the river centre and stops at the first dry column on each side, so it can never leave planks floating over open ground.
- **Third-person camera** (converted from first person): orbit rig 4.6 blocks behind a head-height pivot, mouse/touch-drag orbits, **wheel/pinch adjusts distance 2.2–7.5**. The boom DDA-marches the voxel grid each frame and snaps in instantly when a wall/ceiling is behind you (never clips), relaxing back out smoothly; under ~1.15 blocks the player model hides (effectively falling back to first person in tight caves). Player physics was untouched by the conversion.
- **Player character**: voxel figure in an ember-orange wrap with the evidence satchel on their back, blob shadow, walk/lean/breathing animation, faces movement direction.
- **NPC AI**: characters ground on a small center footprint with gravity-style falls (no floating), refuse to enter faces >1.05 blocks tall (no wall phasing), slide along obstacles, take perpendicular detours when stuck, and force-complete scripted arrivals after ~12 s worst-case so story beats can never hang. They wade rivers, avoid idling on ledge lips, push apart so they never stack, look at the player when near, and have faces, hashed hair styles, blob shadows, and per-species animal silhouettes (deer antlers, goat horns, cattle bulk, low prowling predator).
- **Bodies are solid, both ways.** `player.resolveCharacters(list)` pushes the player out of any character cylinder *through `moveAxis`*, so being crowded can never shove you through a wall, and it cancels the velocity component heading into the body so holding W against someone reads as a firm stop rather than a jitter. On the character side, `npc.js` holds a module-level `PLAYER_BODY` (registered once from main.js) and `tryMove` rejects any step that **closes the gap** on the player while always allowing a step that opens it — so a character can be pressed against you but never wedged inside you. Both sides settle at exactly the sum of the radii (0.62 blocks).
- **Characters can hold things and work.** `npc.carry(kind)` parents a small item group to an arm (so it inherits the walk swing, exactly like the player's `equip`), and `npc.pose(name)` applies a work pose — `aim / cast / pick / chop / tend` — *only while standing still*, so the walk cycle is never fought. A `busy` flag suppresses both idle wandering and the "turn to watch the player" idle churn while an errand owns the character.
- **FX system**: one pooled Points system per blend mode (additive + normal, 1500 particle cap, oldest-steal, zero steady-state allocation) plus small mesh pools for rings/pillars/waves. Emitters: `burst, puff, ring, pillar (persistent, pulsing), pulseWave, floaties, trail, flash, confetti, flames, smoke`. The whole particle load is 2 draw calls.
- **Sky/atmosphere**: gradient sky dome (canvas texture derived from each act's two `setSky` hex colors), additive sun disc + glow, drifting cloud sprites, warm key light + cool hemisphere + weak opposite fill so characters never go black.
- **Save system**: `records` (physical things you made — these are literally what Act 3 digs up, including your actual painting PNG and pot profile/mark), `cards` (Act 3 evidence), `choices`, per-beat checkpoints. `?act=N` debug jumps seed stand-in records so any act is playable standalone.
- **UI skin**: parchment/ember palette via CSS custom properties, no images or external fonts — everything is CSS gradients and system fonts. Speech bubbles are DOM elements projected from 3D positions.

---

## 3. Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | WASD / arrows | left virtual joystick |
| Look (orbit camera) | mouse drag, or click canvas for pointer lock | drag right side of screen |
| Interact | **E** or Enter, or **click the prompt pill** | tap the world / tap the prompt pill |
| Jump | Space | ↥ button |
| Camera distance | scroll wheel | pinch |
| Rise to the sky act | 🔍− HUD button (when offered) | same |
| **Act select (dev/testing)** | **Tab** → choose Act 1 / 2 / 3 | — |
| **World editor (dev)** | **F2** (or `?edit`) | — |

Interaction model: walk near an interactable → a pill with its emoji (🫐 ⛏️ 🎣 …) pops at the top of the screen → press E / tap / click the pill. Minigames and dialogs are DOM overlays; the world pauses interaction but keeps rendering.

Story text (the `.narrator` box) is **centred on screen**, not docked to the bottom edge — it is the thing being read, and on a phone the bottom edge is where the thumb rest and the joystick are. The sky-mode variant sits slightly above centre to clear the time dial.

---

## 4. The world

One valley, persistent across all three acts, ~128×128 blocks:

- **The river** snakes north–south through the middle (sand banks, reeds, cattails, driftwood, wading NPCs). Water is deep blue-teal with per-vertex shimmer. At **z ≈ 37**, on the walking line from Camp A to the eastern plains, three logs lie across it — the ford the band has always used, and the player's dry way over. It is set dressing that reads as history *and* a mobility fix: before it, reaching the hunting ground meant swimming.
- **The north cliff** (top of the map) rises in banded rock terraces. Carved into it at (42,14): the **rock shelter** — a real walk-in cave with a graded approach path, dark banded interior rock, stalactite noses at the mouth, drifting dust motes, and the painting wall deep inside where your Act 1 art physically persists.
- **Camp A** (40,24), just south of the shelter mouth: campfire with live flames and smoke, knapping stone, the band's home in the cold era.
- **The berry meadow** (west, ~x22–34): berry-bush blobs with red flecks, butterflies, flower drifts.
- **The plains** (east, x~96): open hunting ground where deer herds wander.
- **The fossil cliff** (102,12; far northeast): an exposed reading face with four distinct sedimentary strata bands — the "layers = time" teaching visual.
- **The village** (76,80) grows through the eras: fields by the river, animal pen, granary, kiln, huts — then decays into ruins, then a grassed **mound**, then the **present-day** landscape: modern village (24,106) with lanes, a well and shade trees, the **dig camp** (66,92) with tents, and the survey mound.
- Ground cover everywhere: clustered sage tall-grass drifts, flower patches, ferns under trees, snow tufts and dead bushes in the ice era; four tree species (rounded oak, pale birch, flat acacia, dead snag) with canopy tint variation, stumps and fallen logs.

Era look is driven by `setSky` + world states: the ice age is pale and crisp (frozen river, ice sheet in the far north, snow-grass, mostly snags), the settled eras are warm and lush, the present day is tidy.

---

## 5. Full playthrough

### Boot
Title screen (animated parchment glow, floating motes) → **Begin**. With an existing save: **Continue your journey** / Begin (asks "Start over?" first). Opening cards: *"History is the study of the human past." / "This is the story of how we know it."*

---

### ACT 1 — "LIVE" (you are the history)

Four scenes. In each, you physically walk to glowing objective sites and interact. Every meaningful thing you make is stored as a **record** with its position — Act 3 will excavate these exact objects.

#### Scene A — Ice (about 38,000 years ago)
Cold world: snow-grass, frozen river, ice sheet in the north, sparse dead trees. **You wake inside the rock shelter**, on the cave floor, facing the mouth — the camp is framed through the opening. (This needs an explicit spawn Y: `topAt` at those columns returns the *cliff top above the cave*, so the ordinary surface rule would drop you on the roof. `player.teleport(x, z, yaw, y?)` takes an optional Y for exactly this.)

Your band of six is **already at work when the scene fades in** — one hunter is out on the meadow loosing arrows at deer, one is walking home with a fishing rod, one is heading out with a basket. Nobody is queued at the store waiting to start. The elder and the child stay at the fire. See §6 for how that runs.

1. **Take a basket from the band's store** — the shared **chest** by the camp (44,22). It has two real states: the lid swings open on its hinge and the contents (basket, bow, upright arrows, a rolled hide) become visible; closed, it is a plain lidded chest with an antler latch and a spear propped against the side. It opens for you exactly as it opens for the NPCs. *Teaching: the band's tools belong to everyone — take what the task needs, bring it back for the next hands.*
2. **Gather berries** — walk to a berry bush (🫐 prompt), press E. The bush visibly goes bare. Collect 4 of 5; confetti on the last. *Teaching: hunter-gatherers take what the land gives.*
3. **Take the bow, join the hunt** — swap the basket for the bow at the chest, walk east (the log crossing gets you over the river dry), and **actually shoot**: an aim dot appears, each interact press looses a real arrow along the camera ray with gravity and an up-bias; a hit downs a deer (it falls onto its side and stays as a carcass), misses stick in the ground and spook the nearby herd. Then pick up the meat (🍖).
4. **Predator scare** — a predator spawns and actively chases you (speed 2.4). Objective: *"RUN. It does not like the fire."* Reach within 5 blocks of the campfire; the predator breaks off and flees. No damage/death — it's a tension beat.
5. **Fishing** — take the rod from the chest, then at the river fish spot (🎣) the fastest timing ring in the act (1 round). Blue splash on the catch.
6. **The fire circle** — sit with the band; the elder speaks in **icon bubbles** (`◈ ﬦ ◇ ᨏ` — invented pictograms, deliberately unreadable). *Teaching: their rich languages are lost; sound does not fossilise.*
7. **Knapping** — at the knapping stone (🪨), a 3-round timing game shapes axe → blade → arrowhead, with sparks per strike. Creates the `arrowheads` and `hearth` records.
8. **Cave painting** — inside the shelter at the painting wall (🎨): a real painting canvas — mottled rock texture, five ochre pigments, five stamps (deer, hand, human, sun, zigzag), freehand drawing, undo. Your PNG is **saved verbatim** and immediately mounted on the cave wall in 3D. Act 3 will reveal this exact image by lantern light.
9. **Shells & beads** — collect 3 shells along the river (🐚), then drill them into beads at the knapping stone (📿, 2-round timing game). The bead record is pre-positioned at the future grave.
10. **The trade** — a strange band approaches; meet them at the camp edge (🤝). They speak unintelligible icons but hold up obsidian. Choice: offer your beads or hold them close (refusing loops gently until you trade). *Teaching: exchange between groups without shared language.*
11. **Depletion & the move** — the working day stops (every worker is handed back to the script), every berry bush goes bare, both herds walk off, the elder points beyond the horizon. *"A temporary camp is a tool, not a home."*
12. **The burial** — a low hush tone, then: *"That winter, the elder does not wake."* The band gathers around a grave mound by the river. You place her bead string (📿) and her favourite blade (🔪) in the grave. One slow, muted ring — no confetti, no chime. *Teaching (protected verbatim): "Perhaps they believed something continued."* The burial with its goods becomes a record.

#### Scene B — Thaw (36,000 → 10,000 BCE)
Pure cinematic: the camera rises with letterbox bars while a year ticker spins 26,000 years; mid-flight the world swaps — ice gone, river wider and faster, everything green. Caption (protected verbatim): *"The last Ice Age lasted from over 100,000 years ago to around 12,000 years ago."* You arrive at the band's second camp downstream.

#### Scene C — Roots (7,000 BCE)
The band has stopped walking. A hamlet: three huts, granary, animal pen, unplanted fields, a chieftain.

1. **Plant grain** — 4 field spots by the river (🌾): each press turns the block to farmland with a crop. *Teaching: cultivation near rivers — water plus fertile soil.* Creates the `crops` and (burnt) `grain` records.
2. **Herd the goats** — no minigame: walk close to a goat and it **follows you**; lead both through the pen gate, where they settle. The cattle follows on its own.
3. **The granary question** — the harvest goes to the community store. Choice: *"Which grain sack is yours?"* — biggest one (corrected), all of them, none of them, or *"all of them — and none of them"* (any of the last three accepted). *Teaching: no individual ownership.*
4. **The chieftain's task** — carry a waterskin (💧) from the granary ~30 blocks to the far field (🌾). *Teaching: shared work.*
5. **The water dispute** — scripted scene: two farmers argue in icon bubbles; the chieftain walks the boundary and re-marks it with stones. *Teaching: chieftains settle quarrels; in the lean week she opens the store and shares grain out.*

#### Scene D — Fire and Clay (7,000 → 5,400 BCE)
Sky-glimpse time jump; the hamlet has grown — six huts, a kiln, a path to a neighbouring village.

1. **The pot** — at the kiln (🏺): shape a pot on a wheel by **dragging its silhouette's sides** (8-row radius profile, 3 starting shapes), then **engrave your maker's mark** on a 96×96 clay canvas. The kiln fires it behind a fade. Your exact profile + mark are saved. Confetti.
2. **The basket** — one tap at the reeds (🧺), deliberately effortless. *"Reeds are easy. Remember that."* (the preservation-bias setup)
3. **The shelf** — place pot and basket side by side in your hut (🏺🧺). *"Clay and reed. Remember them both."*
4. **The copper trader** — a trader arrives with a copper bangle. *Teaching: copper first, iron much later.*
5. **The delivery run** — take a grain sack from the granary (it rides on your head), walk the ~50-block cart path to the neighbouring village (🤝), trade for cloth, walk back. *Teaching: villages exchange food, clothing, tools; routes become networks; one village is becoming a town.*
6. **The lingering shot** — walk home; input locks. *"Your pot. Your basket. Your wall. Your people. Remember where everything is."* Fade to black.

---

### ACT 2 — "PASS" (time does what time does)

The camera hard-cuts to a fixed museum-diorama shot 74 units above the village (a dark parchment "display base" skirt hides the world edges). Ground input is off for the whole act; your only instrument is the **time dial** docked at the bottom: a draggable timeline track with a fixed playhead, a big year readout ("5400 BCE" … "2026 CE"), era markers (🖐️ rock art 40,000 BCE … 🧊 ice-age end … ☸️ Buddha 560 BCE … 📍 today), and a calendar-face chip.

**The no-year-zero rule is baked into the data model** — internally 1 BCE and 1 CE are adjacent integers; the dial *cannot display* a year 0.

As you scrub: the valley rebuilds through 8 era stages (ice camp → hamlet → village → ruins → grassed mound → present day), ground cover churns in 400-year bands, the mound visibly greens over millennia, and each era flip fires a radar-style pulse wave over the village.

1. **P1 — The Erosion Window**: a cutaway panel (docked top-right) shows *your* hut underground: your actual pot silhouette, your basket, and (if the burial happened) the elder's grave. Objective: scrub ~5,200 years forward. Layer by layer you watch: the basket **fray and vanish** by ~2,000 years (replaced by a hatched void), the pot **chip but survive**, flesh and cloth fade while **bones, beads and the stone blade persist**, the hut collapse into a mound, soil bury everything. *"Every object from the past is a piece of a jigsaw. Some pieces are gone forever."*
2. **The Long Bar**: a full-screen log-scale deep-time strip from Earth's formation (4.54 bya) to now — Homo sapiens is a red sliver at 300,000 years, writing at 6,500. Read and continue.
3. **Free scrub**: all era markers go live; drag from 5400 BCE to near today, watching the whole valley transform.
4. **P2 — The Trick**: extreme close-up on the BCE/CE boundary. CE counts forward from the conventional year of the birth of Jesus (formerly AD); BCE counts backward (formerly BC). Then a 30-second challenge: *"Find the year ZERO on the dial."* **You can't — it doesn't exist.** TRICK QUESTION card: *"1 BCE steps straight to 1 CE."*
5. **P3 — The Gap**: first you're made to *count* the Buddha→2024 gap on the dial against a 30-second timer (tedious on purpose; skippable) — then the reward: **add both numbers, subtract 1** — the book's own example, verbatim: 560 + 2024 − 1 = **2,583 years**. Then practice: type the answer for 250 BCE → 2026 CE (2,275); wrong answers are corrected, never punished.
6. **P4 — Steps of Time**: the dial locks to fixed strides with +/− buttons: **decade** (3 clicks), **century** (step back to Aśhoka — the first click crosses the missing zero), **millennium** (5 strides), and finally two *unlabeled* flags: *"Which happened first?"* — *"You did not need the dates. A timeline shows ORDER all by itself."*
7. **P5 — Faces of the Calendar**: the Gregorian face (12 months, 365 days, leap-year 400 rule: 1800 ✗ 1900 ✗ 2000 ✓) swaps to the **Indian luni-solar face** (every tick gains ☾; the pañchānga predicts eclipses and festival dates). *"Swap the face: the world beneath does not change. Only the counting does."*
8. **P6 — Arrival**: a long ride to 2026 CE; the camera descends to the grassed mound; a **survey flag** is planted in the turf with a small celebration. Fade out.

---

### ACT 3 — "DIG" (excavate your own past)

Back on the ground at the **dig camp**, present day, as a five-person specialist team. A toolbar at the bottom holds the five specialists — **you click one to "become" them**, and every interactable is gated to the right specialist. Using the wrong one produces a grey fizzle-puff and a gentle teaching toast (that mapping *is* the exam content). Each specialist has a signature color that all their FX use:

| Specialist | Color | Verb |
|---|---|---|
| ⛰️ Geologist | earth-teal | reads the ground |
| ⛏️ Archaeologist | ember-amber | digs everything physical — tools, pots, beads, bones, burnt grain |
| 🦴 Palaeontologist | violet | reads only deep-time fossils |
| 🗣️ Anthropologist | rose | talks to people |
| 📜 Epigraphist | ink-blue | reads signs and marks |

A pulsing teal **beacon pillar** with breadcrumb stubs guides you from the dig camp to the mound. A satchel (🧺) tracks **evidence: n/18** source cards with ghost slots for the ones you haven't found.

1. **Survey** (Geologist) — at the mound (🔍): teal radar pulse-waves sweep the valley; translucent "ground vision" overlays fade in — green worthwhile dig zones (your hut, the granary, the grave, the shelter), pale sterile soil, and the blue ghost of the river's old course. Each dig zone gets a soft green pillar.
2. **The digs** (Archaeologist) — four dig sites, each a ⛏️ interactable: every press carves one layer of a real 2×2 pit into the terrain with a dirt burst; the **third** press reveals the find with warm light and confetti as a **source card** (parchment collectible with a dig-layer chip): your actual pot (a flashback shows your own maker's mark), the burnt grain, the elder's grave (handled quietly — beads and blade placed as 3D props, and the narrator is careful: *inference, not fact*), the arrowheads. In your hut layer there's also the **empty basket slot** — the flagship absence: card "∅ ORGANIC — NOT PRESERVED". At the shelter, a lantern (🏮) relights the painting wall — your Act 1 painting fades in from the soot, revealed exactly as you drew it.
3. **The fossils** (Palaeontologist) — at the banded fossil cliff, read three fossil plates (🦴) with violet floaties; the third fires a deep-time pulse. *Fossils are impressions in rock layers, millions of years old — not the archaeologist's job.*
4. **The mark** (Epigraphist) — read the potsherd's maker's mark (📜) — your own mark, shown full screen. *Signs carry meaning across millennia.*
5. **The interviews** (Anthropologist) — in the modern village, talk (💬) to the grandmother, a farmer, and the teacher (plus one villager whose story contradicts the others). Oral history becomes source cards too.
6. **The claim board** — drag/judge claims against your evidence: sources confirm or contradict; historians judge. *"A source is anything that tells us about the past."*
7. **The lab** — send three finds to the lab tray (climate, chemistry, kinship genetics). *Science as a source.*
8. **The site report** — assemble the final certificate-styled report from your cards; three confetti bursts; closing cards mirror the opening: history is the study of the human past — and now you know *how* we know it. End screen offers a fresh start.

---

## 6. Living world systems (how the valley runs itself)

Three systems make the world feel inhabited rather than staged. All three are ordinary game code — no ECS, no behaviour trees, no scheduler framework.

### 6.1 Ambient life — `src/npc/ambient.js`

The problem: a camp where NPCs only wander looks like a diorama, and the game's central lesson ("the band's tools belong to everyone") was carried by one line of narration. The fix is to make the lesson the *ambient behaviour*.

**The loop.** Every worker runs a small state machine:

```
idle (wander near home)
  → toChest   walk to the standing spot in front of the chest
  → take      chest OPENS, tool appears in their hand, bubble icon
  → toSite    walk out to the job's work site
  → work      pose + a periodic FX "beat" (arrows loosed, splashes, chips…)
  → back      walk to the chest
  → put       chest OPENS, tool leaves their hand
  → idle      random dwell, then the next job in their rotation
```

**A job is data**, not a subclass:

```js
{ id, item, icon, doneIcon, pose, at: {x,z}, face?, work: [min,max], beat, onBeat(ctx, npc) }
```

`jobHunt / jobFish / jobGather / jobWood / jobTend` are factories that fill that shape; the scene passes a `{ id: job }` map and each worker gets a **rotation** of job ids it cycles through. Moving a job's `at` moves where the workers go next — which is why the editor can retarget an errand by clicking the ground.

**Seeding is the important part.** `assign(npc, jobIds, seed)` accepts `'work' | 'return' | 'outbound' | 'idle'` and drops the worker *mid-cycle* before the scene fades in: one hunter is already on the meadow with the bow drawn, one is 40 % of the way home with a rod, one is heading out with a basket. A scene that starts everyone at `idle` reveals the machine — you watch three people walk to a box in single file. Mid-cycle seeding hides it. Seeded placement slides toward the (always open) work site if the interpolated spot lands on a structure, so nobody opens the scene standing on a hut roof.

**Ownership rules** (the part that keeps a story game safe):

- `npc.busy` is held for the whole errand, so the character's own idle wander never fights the errand, and it is released the instant the errand ends.
- Scripted act beats always win. A scene calls `ambient.stop()` before any beat that moves the band by hand (the burial, the camp move, the water dispute), and every worker is handed back empty-handed with its original home and speed restored.
- A leg that cannot finish (blocked path, unreachable site) times out after 45 s and the errand is *abandoned*, not retried forever. Nothing can hang a beat.

**Hunting reads as hunting.** The hunter faces the nearest live animal, plays the `aim` pose, and every beat looses a real arrow mesh that flies to the prey, puffs, and makes the animal trot clear of the shot — `spook()` moves it relative to its *own home*, not a blind 18-block flee, so the herd stays on its range instead of scattering off the map after a few volleys. The ambient herd is deliberately a **second, smaller herd** on the west meadow, far from `SITES.plains`, so ambient shots can never disturb the herd the player is stalking during the hunt beat.

Arrows use fresh geometry per instance and are registered in `G.props`, because `disposeGroup` disposes geometry unconditionally — a module-cached arrow geometry would be destroyed for every later arrow.

### 6.2 Props with state — the community chest

`makeCommunityChest(x, y, z)` returns `{ group, isOpen, setOpen(v), hold(), releaseHold(), openFor(ms), update(dt) }`.

- The lid is a **pivot group at the chest's back top edge**; opening is a negative `rotation.x`, tweened in the prop's own `update`.
- Contents (basket, bow, upright arrows, hide roll) are one group toggled by visibility once the lid clears them.
- Open state is **refcounted**: `hold()`/`releaseHold()` so several NPCs — or an NPC and the player — can be at it at once without one closing the lid on the other. `openFor(ms)` is the player's one-shot path, used by the act's own "take from the store" beats.

This is the pattern for any stateful prop: the factory owns the animation, the caller owns the intent.

### 6.3 Character collision

Covered mechanically in §2; the design rule is worth stating: **the player is pushed out of characters, and characters refuse to move into the player.** Doing only the first makes NPCs shove you around; doing only the second makes you able to stand inside people. Doing both, with "moving away is always allowed", gives a firm stop with no possibility of a wedge.

---

## 7. The world editor (`?edit` / F2)

A full in-game scene editor, written to be **reusable in any three.js project**. Full user documentation is in `game/EDITOR.md`; this is the architecture.

### 7.1 Shape

```
src/dev/editor.js         ~1,400 lines. Imports THREE and nothing else from the game.
src/dev/host.js           ~120 lines. Describes THIS game to the editor.
src/dev/voxel-import.js   .glb / .vox / .json importers.
vendor/gltf/              GLTFLoader + 2 utils (168 KB), vendored, dynamically imported.
```

`main.js` loads it lazily — `?edit` on boot, or F2 at any time:

```js
const [{ initEditor }, { makeHost }] = await Promise.all([
  import('./dev/editor.js'), import('./dev/host.js')]);
initEditor(G.host ??= makeHost(G));
```

Nothing of the editor is in the shipped module graph until one of those happens, and a plain load creates no editor DOM, no atlas canvas, no extra materials.

### 7.2 The host adapter (why it ports)

The editor never touches `G`. Everything goes through an object with this shape (every field except the first line is optional — a missing capability just hides the features that need it):

```js
{
  scene, camera, renderer, dom, label(),
  frame: { add(fn), setScale(n), setPaused(b) },   // one wrap of the render loop
  cameraControl: { take(), release() },            // lets the editor fly
  input: { setEnabled(bool) },
  voxel: { SX, SY, SZ, ids, defs, name(id), get, set, topAt, remesh, materials() },
  props(), addProp, removeProp, propKinds(), spawnProp(kind,x,y,z), addImported(g,x,y,z),
  characters(), characterKinds(), spawnCharacter(kind,x,z), removeCharacter(c),
  sites(), ambient(), setSky(skyHex, fogHex),
  player: { obj, pos, teleport, model(), tune, world },
}
```

Two host details are load-bearing:

- **`frame.add`** wraps the game's existing `renderer.onFrame` exactly once. That single wrap gives the editor its tick, the time-scale dial (`dt * scale`) and pause (`dt = 0`) — without the game knowing.
- **`cameraControl.take()`** stubs *both* `player.syncCamera` **and** `player._cameraUnclip`. Stubbing only the first is what made the earlier freecam feel broken: the unclip probe is a camera-safety feature that shoves the camera out of solid blocks, so flying into terrain yanked you back out. With both stubbed the world keeps simulating (NPCs carry on with their errands) while the editor owns the viewpoint.

### 7.3 Interaction model

- **Always flying** on open: WASD, E/Q up-down, Shift ×3.2, Ctrl ×0.25, drag to look, wheel = fly speed. A `fly` toggle hands control back to the player.
- **Hover → outline + name; click → select.** A click only counts if the pointer moved ≤ 5 px, so the end of a camera drag never selects anything. Raycast against prop and character groups, falling through to a **voxel ray-march** for terrain. The player's own body is excluded from the raycast — in third person it sits dead centre and swallowed nearly every click.
- **Alt + click places a block** against the clicked face; **Alt + right-click removes exactly one cell** and leaves the now-empty cell selected, so a hole stays addressable.
- **Modal picks**: any "click where it goes / click who they follow" flow sets `pickMode = {prompt, cb}`, shows a banner, and routes the next world click to the callback. Used by placement, spawning, job re-siting and every NPC targeting control.

### 7.4 What it can change

| Area | Controls |
|---|---|
| Transform | position (fields, nudge keys, buttons, hold **G** to drag on the ground), rotation, scale, duplicate, hide, delete, rename |
| Characters | speed, wander, home, walk-to, follow player / follow a character, face, freeze, pose, carried item, bubble text, ambient job + full job rotation; animals get flee / down |
| Terrain | block palette, brush (paint / erase / raise / lower / flatten / smooth), cube or sphere, radius 0–8 |
| Layout | x-ray (material transparency), wireframe, **Y-slice cutaway** (`renderer.clippingPlanes`), plan view over the map centre |
| Create | spawn any prop factory, spawn any character kind, import files, **paint your own block** |
| World | sky + fog colours, every light, fog range, FOV, live player tuning (speed/jump/gravity/reach), time scale 0–8×, pause, screenshot, grid, fps / draw calls / triangles |

Map **size** is deliberately recorded-only: the world `Uint8Array` and the chunk grid are sized at module load, so a resize is a source change plus a reload, not a live edit.

### 7.5 The change list (the reason the editor exists)

Live edits are not the deliverable — the **instruction list** is. Every action appends a typed entry (`move / remove / add / block / terrain / behaviour / import / set`) carrying the object's name, its old value, its new value, the scene it happened in, and the source file that owns it. On export, repeats of the same target collapse into one first-value → last-value line:

```
## a1.sceneA
1. MOVE prop `communityChest` (44, 10, 22) → (45, 10, 22.5)   [src/acts/act1.js …]
2. BLOCK (73, 7, 37) AIR → WOOD
3. TERRAIN raise r=2 at (52, 10, 33) with GRASS — 13 cell(s)
4. SET npc `band0`.speed 1.5 → 2.4                            [src/acts/act1.js …]
5. BEHAVIOUR `elder` goTo(41.5, 27)                           [src/acts/act1.js]
```

The list persists in `localStorage` and **re-apply** replays it onto a freshly built scene (props matched by name + original position, blocks and terrain cells by coordinate). So the workflow is: fly around, tweak until it looks right, copy the request, and have the source edited to match — the editor never becomes a second source of truth.

### 7.6 Painted blocks — how custom blocks actually render

The world is vertex-coloured. Rather than convert it, painted blocks are an **additive fourth pass**:

1. `world/atlas.js` lazily creates a 256×256 canvas holding 256 tiles of 16×16, exposed as a `CanvasTexture` with `NearestFilter` and no mipmaps (so neighbouring tiles cannot bleed). A tile is a plain array of 256 CSS colour strings — the same format the JSON importer reads and the designer exports, so it is hand-editable and diffable.
2. `registerBlock({ …, tex: { top, side, bottom } })` stores tile indices on the block def. Custom ids start at 64, clear of the built-ins.
3. In the mesher, `painted = !water && !!def.tex` routes those faces into a fourth bucket with UVs (each face declares which corner axes map to U and V, so side faces stand upright), and their **vertex colour becomes pure light** — face shade × jitter × AO — so the texture carries the hue and a custom block is lit and ambient-occluded exactly like the terrain around it.
4. The textured material is created on first sight of a painted block; if you never paint one, none of this allocates.

The editor's designer is a 16×16 painter per face with pencil / fill / erase / eyedropper, flat-fill, **grain-fill** (flat colour plus per-pixel grain — the thing that makes a custom block sit next to the hand-textured ones), noise, copy-to-all-faces, and "start from" an existing block. *Create / update* re-registers in place, so re-painting updates every instance already placed in the world.

### 7.7 Imports

| Format | Path | Notes |
|---|---|---|
| `.glb` (glTF 2.0) | vendored `GLTFLoader`, dynamically imported | Recentred on its own base, placed by click, scale slider. Materials/textures come through; animations detected but not played. Use `.glb`, not `.gltf` — a `.gltf` referencing external `.bin`/`.png` can't resolve them from a drag-drop. |
| `.vox` (MagicaVoxel) | own ~90-line parser | RIFF-ish chunk walk for SIZE / XYZI / RGBA, Z-up → Y-up. If the file omits the palette chunk (untouched default palette) colours are approximated from the index and the status bar says so. |
| `.json` model | cell list `[x,y,z,colour]` | Meshed by `cellsToGroup`, which emits only faces touching empty space, so a 32³ import is one cheap mesh. |
| `.json` block | colours and/or 16×16 tiles | Registered immediately and becomes the paint block. |

**What does not port from other engines:** behaviour. Geometry and materials travel through glTF; scripts, prefabs and components do not. Anything a Unity/Unreal script did has to be re-authored as game code — which is what the change list is for.

---

## 8. The records system (the game's central trick)

Act 1 doesn't just *tell* you about sources — it manufactures them from your play:

| You make it (Act 1) | Time treats it (Act 2) | You find it (Act 3) |
|---|---|---|
| Cave painting (your PNG, verbatim) | survives, sooted over | lantern reveal, your exact image |
| Pot (your profile + maker's mark) | chips but survives | dug up; mark read by the epigraphist |
| Basket (one effortless tap) | **gone in ~2,000 years** | the empty slot — "not preserved" |
| Shell beads + stone blade | persist | grave goods |
| The elder's burial | flesh/cloth go, bones stay | the quiet dig; inference about belief |
| Burnt grain, hearth, arrowheads, obsidian | persist | dug up by the archaeologist |

Debug jumps (`?act=2/3`, or the Tab menu) seed stand-in records so every act works standalone.

---

## 9. Debug & testing tools

- **Tab** anywhere → act-select menu (Act 1 / 2 / 3 / stay). Jumps reset progress and use the seeded-records path.
- **F2** / `?edit` — the world editor (§7). `window.__editor` is the instance; `G.host` is the adapter.
- `?act=N` — jump straight to an act (requires no saved progress).
- `?fast` — 3-second countdown challenges instead of 30.
- `?dev` — exposes `window.G` (game state) for console inspection.
- `?tp=x,z` — one-shot teleport once ground mode starts.
- `node game/tools/lint-strings.mjs` — content lint (must stay green).

**Testing notes for whoever picks this up.** The game is driven end-to-end from the console, which is how every change here was verified:

- Jump to a scene by writing the save directly: `localStorage.setItem('towcb-save-v1', JSON.stringify({version:1, act:1, beat:'a1.sceneC', records:[], choices:{}, cards:[], claims:{}, labUsed:[], beatTimes:{}}))` then reload. Seeding `records` skips the beats that already produced them.
- A scripted playthrough driver is a ~20-line `setInterval`: dismiss `.card-overlay button` / `.narrator` / `.choice-box .btn`, then teleport to the first enabled `G.interactables` entry and call `G.input.injectInteract()`. Beats that only need proximity (`reach()`) are satisfied by cycling the player through a list of site coordinates.
- Narrator boxes take a dispatched `pointerdown`, not `.click()`.
- The embedded browser pane starves compositing when hidden, so screenshots time out — use a headless browser for real frames. `G.mode = 'ui'` freezes the world if you want to park a camera for a clean shot.
- Timed-out `javascript_exec` calls keep running in-page; guard any driver with a `window.__drvOn` flag or two of them will fight each other.

---

## 10. Known bugs and to-fix list

Current state: zero console errors across all three acts and in the editor;
strings lint green; all three acts passed a screenshot-based visual review
("ship" verdict).

**All twelve items below are now closed** (§14, 2026-08-10 14:10 IST). They are
kept here with their outcomes because several record a decision, not just a
fix.

1. ~~**Player model is not hidden during the Act 2 sky diorama and interstitial flights**~~ — **fixed.** `player.setModelHidden()`, set by `skyGlimpse` and for the whole of Act 2. Note the fix is NOT the obvious `G.mode !== 'ground'`: Act 1's closing shot deliberately sits in `'ui'` mode with the character in frame, and that blanket rule would have emptied it.
2. ~~**Intro-sequence input race**~~ — **fixed.** `sceneA` disables input at `G.mode='ground'` and restores it after the wake line. On touch this also hides the joystick and jump button, so the opening reads as a cutscene rather than a game with dead controls.
3. ~~**Dig-stroke FX visibility not re-verified up close**~~ — **verified, no change needed.** Measured at a real standing third-person pose: pit floor y=9, rim y=12, all 37 stroke particles at y 12.60 to 12.79, 37/37 inside the camera frustum and on the camera side of the pit.
4. ~~**Touch/mobile pass for the third-person camera**~~ — **closed by on-device testing, 2026-08-10.**
5. ~~**Performance re-check on low-end Android**~~ — **measured and addressed (§12), then confirmed on a real phone 2026-08-10.**
6. ~~**Clouds read sparse/subtle**~~ — **fixed.** Sprite opacity 0.42-0.52 to 0.58-0.70 and a denser cloud texture, both free (identical pixel count and blend). Sprite *size* is deliberately unchanged on every tier: see §14.2, the first attempt grew it on the "high" tier believing that meant desktop, which is false.
7. ~~**Birch/snag trunks can read concrete-grey in shade**~~ — **fixed.** Trunk side faces get a warm bias in the mesher. The cause was lighting, not palette: side faces are lit almost entirely by the cool hemisphere and fill lights.
8. ~~**Act 2's P3 "beat the clock" reward is unconditional**~~ — **honoured rather than reworded.** `countdownChallenge` takes an optional `answer` and renders a numeric box; a correct answer before the clock earns confetti and its own line. The formula is still taught either way, because beating the clock proves you can count, not that you know the shortcut.
9. ~~**Narrator boxes ignore synthetic/dispatched clicks**~~ — **fixed.** Listeners attach immediately and the 350 ms guard became a timestamp; the old delayed-attach swallowed any click aimed at the box. Kept a div with `role="button"` and `tabIndex=0` rather than a real `<button>`, which would have dragged in a UA style reset for no behavioural gain.
10. ~~**Tab act-menu wipes the save with only a written warning**~~ — **fixed.** A second confirm, shown only when `Save.hasProgress`, since with nothing to lose the extra tap is noise.
11. ~~**Minor dead code**~~ — **fixed.** `S.act2.deepTime_hint` and `S.act2.todayMarker` removed. The `dispose()` comment audit found the existing comments already accurate (shared module caches, detach only, never `disposeGroup`), so nothing changed there.
12. ~~**Modern village ambient NPCs vanish at the interviews beat**~~ — **improved, with a known residual.** `retireAmbients()` sends them outward and disposes them once they are out of the camera frustum (or past 26 units), capped at 14 s. In the normal case, where the player is still walking to the village, they are gone within 700 ms and the pop is unobservable. A player who stands in the village and watches them for the full 14 s still sees them go. Fading is not available: character materials are shared module caches, so changing opacity would affect every character. `disposeAmbients()` remains the hard sweep for teardown and resumed sessions.

---

## 11. Handoff: what changed in the latest pass

Everything below was added or fixed after the "three acts ship" review, and is live and verified. Nothing in the story structure, beat order, records format or save schema changed — all of it is additive or a bug fix.

### 11.1 Gameplay and world

| # | Change | Files |
|---|---|---|
| 1 | **Ambient band life** — NPCs take tools out of the shared chest, work a site, and bring them back, on a loop, seeded mid-cycle so the valley is already busy on fade-in (§6.1) | `npc/ambient.js` (new), `acts/act1.js` |
| 2 | **Carried items + work poses on NPCs**, `busy` flag, distance-gated speech bubbles | `npc/npc.js` |
| 3 | **Community chest with open/closed states**, refcounted so several actors can use it at once (§6.2) | `world/props.js`, `acts/act1.js` |
| 4 | **Log crossing over the river** at z≈37, flush with both banks | `world/states.js` |
| 5 | **Character collision both ways** — player pushed out of bodies, bodies refuse to close on the player | `player/player.js`, `npc/npc.js`, `main.js` |
| 6 | **Wake inside the rock shelter** — `teleport()` gained an optional explicit Y (the old spawn landed on the cliff roof) | `player/player.js`, `acts/act1.js` |
| 7 | **Story box centred on screen** instead of docked to the bottom edge | `css/style.css` |
| 8 | **Water surface fix** — the 0.85 drop now applies to a surface cell's side faces too; the river no longer reads as floating slabs with a gap under them | `world/mesher.js` |
| 9 | `Input.poll()` returns zeros while disabled — held keys used to keep walking the player through cutscenes | `engine/input.js` |
| 10 | Every prop factory tags `group.name`, so props are listable and nameable | `world/props.js` |

### 11.2 The world editor

| # | Change | Files |
|---|---|---|
| 11 | **The editor itself** — flight, click-select, transform, terrain brush, x-ray/slice/plan view, spawning, character control, world/render controls, change list (§7) | `dev/editor.js` (new) |
| 12 | **Host adapter** so the editor is game-agnostic and portable | `dev/host.js` (new), `main.js` |
| 13 | **Importers** — `.glb`, `.vox`, `.json` model, `.json` block | `dev/voxel-import.js` (new), `vendor/gltf/` (vendored loader) |
| 14 | **Painted blocks** — texture atlas + a fourth mesher pass + a 16×16 per-face painter in the editor (§7.6) | `world/atlas.js` (new), `world/blocks.js`, `world/mesher.js`, `dev/editor.js` |
| 15 | **Runtime block registration** — `registerBlock()`, custom ids from 64 | `world/blocks.js` |

### 11.3 Where to start reading

If you are picking this up cold:

1. `game/EDITOR.md` — then open the game with `?edit` and fly around. Ten minutes there explains the world faster than any document.
2. `src/acts/act1.js` — the act scripts are the game's screenplay: linear `await`-driven beats over shared systems. Reading Scene A top to bottom shows how a beat is built (objective cue → beacon → interactable → FX → narrator → `Save.addRecord`).
3. `src/npc/ambient.js` — the clearest example of a self-contained system that has to *yield* to those scripts.
4. `src/world/mesher.js` — where the game's whole look comes from.

### 11.4 Conventions worth keeping

- **`SITES` is the single source of truth** for named locations. Act scripts never hard-code a coordinate that has a site name.
- **All user-visible text lives in `strings.js`** and the lint enforces it (plus old-syllabus terms and stray date literals). Run it before any commit.
- **Terrain heights are treated as frozen.** Walkability (bank caps, cave approach, jump height, water breach) was hand-verified across all four world states; the log crossing was added at the one height that keeps it true.
- **Systems yield to scripts.** Anything autonomous (ambient life, idle wander) must expose a `stop()` and be stopped before a scripted beat moves the same characters.
- **Dev tooling stays out of the shipped graph.** `src/dev/*` is only ever reached by a dynamic `import()` behind `?edit` / F2.

---

## 12. The mobile performance pass (2026-08-10)

Measured first, then fixed. Everything below is instrumented numbers from
`renderer.gl.info` and GPU pixel readback, at **fixed camera poses** — a
wandering player makes every reading incomparable, which invalidated the first
round of measurements before this was noticed.

### What was actually wrong

Not what you would guess. Triangles and fill rate were never the problem:
`MAX_PIXEL_RATIO: 1.5` means a DPR-3 phone renders *fewer* pixels than a
1280×720 desktop. The problem was **draw calls**, and they came from people and
props, not terrain. 11 NPCs were 157 meshes and 21 props were 173, so **330 of
~490 renderables carried 6% of the triangles**. Mobile GPU drivers bill per
draw call.

The second problem was the Act 2 era flip: `buildStage` + `remeshAll` froze one
frame for 40–59 ms on a fast desktop, and it fires while dragging the time
dial, which is Act 2's entire interaction.

### What changed

| | Fix | Result |
|---|---|---|
| **A1** | `world/merge.js` folds static part-meshes into one vertex-coloured geometry per animated part (§12.1) | 1014 → 647 draw calls across four fixed poses (−36%) |
| **A3** | Act 2 era flip gets a 120 ms settle debounce and drains the remesh a few chunks per frame | worst frame 59.9 → 24.9 ms (−58%), nothing over the 33 ms budget |
| **A4** | Service worker + manifest | real offline, installable, no 562 KB refetch |
| **B** | `QUALITY` tier in `constants.js`, `?q=high\|low` | pixel ratio, clouds, particle caps and remesh budgets scale down on weak devices |

### 12.1 Mesh folding — `world/merge.js`

`foldStatic(root, keep)` bakes each part's material colour into vertex colours
and welds the geometries into one, against a single shared vertex-coloured
material. Same technique `world/mesher.js` already uses for terrain, so the
pixels are unchanged; only the call count drops.

**The rule that keeps it safe:** anything the game animates goes in `keep`. A
folded part loses its own transform, so a mesh that is rotated, scaled or moved
per frame must stay a separate object. Beyond that, `foldStatic` declines
non-Lambert, transparent, DoubleSide, textured and Group children by itself —
which is why campfire flames, butterfly wings, blob shadows and the chest's lid
pivot survive with no list to maintain.

For props, `foldIfStatic` folds only factories that return **nothing but
`group`**. Any other key is a handle that probably reaches a child —
`makeBerryBush` has no `update` but does expose `setBerries`, which is exactly
the trap. That test is self-maintaining: add a method to a factory and it drops
out of folding automatically.

Verified by GPU pixel readback against the frozen `game-baseline/` build:
- A character, frozen in a fixed pose against a bare scene: 20 meshes → 12,
  **0 of 168,795 pixels differ**.
- The community chest: 30 → 16 meshes, **10 pixels differ** (0.006%), all on
  one lid silhouette edge — antialiasing tie-breaking.

### 12.2 Two tier levers that were tried and rejected

Both looked sensible and both failed on measurement. Recorded so nobody
re-adds them:

- **Shorter far plane on mobile** (160 → 120) saved 2% of draw calls and
  **clipped the world**. Act 2's diorama camera sits 150 units from the far map
  corner, so the valley was cut off in mid-air while the act's own fog was
  still configured to fade at 175.
- **Thinner ground cover** (`floraDensity` 0.6) saved 0.4%. Cross-flora is only
  ~3,100 of ~187,000 triangles, so it was the most *visible* change available
  for almost no gain.

One optimisation was also written and reverted: removing the AO inner loop's
per-corner array allocations produced no measurable change (34.4 ms vs 34.0 ms)
because V8 already elides them. `computeVertexNormals` is ~16% of a remesh and
remains the obvious next target if the mesher ever needs to be faster.

### 12.3 Comparing builds

`game-baseline/` is a frozen copy of the pre-pass game, byte-identical except
for its own `SAVE_KEY` and a `BASELINE` tab title. Because Pages serves the
repo root it deploys alongside the live game, so both are playable on a phone
at once. `compare.html` at the repo root is the launcher. **This directory is
temporary** and comes out once the results have been judged; the revert point
for the whole pass is tag `v1-pre-perf`, and each fix is its own commit so any
one of them can be reverted alone.

---

## 13. Change log (2026-08-09 22:34 IST)

Ten requested changes. Each is its own commit, so any one can be reverted
alone; the revert point for the whole performance pass before it is tag
`v1-pre-perf`.

### 13.1 Standing rules (now enforced, not remembered)

**GitHub carries the shipped game only.** No planning documents, idea
documents, specs, research notes or review screenshots, ever. `.gitignore`
blocks the category by pattern (`*-design-doc.md`, `ideas*.md`, `plan*.md`,
`/specs/`, `review-*.png`), not just the names that existed on the day. The
repo went from ~53 MB to 5.8 MB. Everything removed is still on disk.

**No em dash or en dash in anything the player reads.** 77 lines scrubbed
across `strings.js`, `act3.js`, `report.js` and `dial.js`, rewritten per
sentence rather than blanket-replaced: a colon where the dash labelled, a full
stop where it joined clauses, parentheses where a pair bracketed. `lint-strings`
now strips comments and fails on a dash inside any quoted string, so it cannot
come back. `src/dev/*` is exempt as developer-only UI.

Both rules live in `CLAUDE.md` at the repo root.

### 13.2 Gameplay and content

| | Change |
|---|---|
| Wording | "band" is **"tribe"** everywhere the player reads it; the band's store is the **Community Chest**. The village granary keeps the word "store", it is a different object and the Scene C lesson depends on the distinction. |
| Hunt | Asks for **three deer**, not one. Herd raised 4 to 6 so a scattered herd cannot strand the player. Live (n/3) objective count. |
| Hunt | **Take Aim / Fire** on a right-hand action rail. Take Aim drops to first person with a crosshair; the rail swaps to Fire and Lower bow. Two big thumb targets on a phone, and E/Enter still fire for keyboard players. |
| Sharing | Everything gathered must be **placed in the store box** beside the Community Chest, not merely carried home. Berries, meat and fish each hold the next task until the deposit happens. The box fills visibly as the day's haul accumulates. |
| Tribe | Tribe members are **talkable** (💬). They reply in pictograms, never words: Act 1 teaches that their language is lost, and English would undo it. |
| Predator | The prowler is now a **bear**: roughly double a deer in every dimension, shoulder hump, blunt muzzle, and slowed from 2.4 to 1.7 against a player who moves at 5.2. Big and unhurried beats small and fast. |
| NPCs | Step-ups are **hopped, not glided**, and characters try level ground before allowing a climb, so they walk around obstacles rather than over them. |
| Camera | **Settings panel** (gear, top left) with "Lock camera behind me": the camera swings around to stay behind you, so crossing the valley needs no dragging. Preference persists outside the save file. |

### 13.3 Details worth knowing before touching these

- **The store box is the lesson, not busywork.** The chapter teaches that the
  tribe's food belongs to everyone. Being made to hand your catch over before
  you may do anything else carries that better than the narrator line that used
  to carry it alone. Do not "streamline" it away.
- **Talk replies must stay pictographic.** `npc.talk.icons`, edited in the
  world editor's "when talked to" section. The section carries the rule as an
  on-screen note.
- **Interactables can follow a moving target** (`follow`, see `interactAt` in
  main.js). That is how a talk prompt tracks a walking character.
- **The NPC step ceiling stays at 1.05 blocks.** Terrain heights are integers,
  so every rise in this world is a full block; lowering the ceiling strands
  characters on open ground. The fix for "they float over things" was the hop
  and the level-first search, not a smaller ceiling.
- **Settings are not in the save file.** `src/settings.js` has its own key, so
  "start over" and `?act=N` never lose them.
- **The service worker is off on localhost.** It was serving stale modules
  during development, which is the staleness footgun called out in §12.

---

## 15. Act 1: borrowed tools, inventory and audio (2026-08-10 16:45 IST)

Act 1 only; acts 2 and 3 are untouched. Ten requested changes, but they are not
ten features. The spine is one idea made mechanical:

> **The community chest lends tools. The store box receives food. You own
> nothing.**

That used to be a single narrator line (`storeLesson`) while the game quietly
contradicted it: the basket vanished the instant you picked a berry, and the
bow was gone two beats before the bear ever appeared. Now the tool stays in
your hands until you put it back, which is why item 6's restructure needed the
inventory first.

### 15.1 What is new

| Area | Change | Files |
|---|---|---|
| Inventory | Item table, containers (`player` / `chest` / `store`), counts, persistence | `src/inventory.js` (new) |
| Container UI | Square-slot grid, take and deposit by tapping, carry view | `src/ui/container.js` (new) |
| Act 1 loop | Borrow, use, deposit, **return** for basket, bow and rod | `src/acts/act1.js` |
| The bear | A second hunt that is a ruse; bear spawns at the plains, 73 blocks from camp | `src/acts/act1.js` |
| Wild berries | ~110 harvestable `B.SHRUB_BERRY` blocks across the valley | `src/acts/act1.js` |
| Herds | 6 to 10 plains deer, plus a distance gate so far animals sleep | `src/acts/act1.js`, `src/npc/npc.js` |
| Fishing | 1 spot to 4, derived from `riverX()` so they are on the water | `src/acts/act1.js` |
| Readability | Narrator, cards, objective and prompt all substantially larger | `css/style.css` |
| Prompts | Icon **and** verb ("Pick berries"), 16 labelled interactables | `src/ui/hud.js`, `src/main.js` |
| Audio | Files layered over the synth: voice, music, sfx | `src/sound.js` (new), `game/audio/` |

### 15.2 Things not to undo

- **Tools and harvests are carried together.** `Inv.contents('player')` returning
  `[{basket,1},{berry,15}]` is the whole point. `player.equip()` stays visual and
  one-slot; `syncEquip()` decides what the hands show (tool first, else the
  carried harvest).
- **The second hunt is a ruse and has no deer in it.** Its only job is to walk
  the player to the plains still holding the bow so the bear appears 73 blocks
  from safety. The old version spawned it beside the store box and the "run to
  camp" was a seven block stroll. It is now save-guarded (`bear` record), which
  it never was.
- **Wild berries are BLOCKS, not props.** `B.SHRUB_BERRY` is cross flora and all
  cross flora in a chunk merges into one mesh, so ~110 of them cost **zero**
  extra draw calls. As props they would have cost ~220. Scene A needs the
  explicit `scatterWildBerries` pass because terrain's bush-blob generator is
  skipped entirely when the world is iced.
- **The animal distance gate keys off a module-level `OBSERVER`**, set once in
  main.js, because `Animal` is constructed without a camera (unlike `Npc`).
  `followTarget` is exempt so a chasing bear never sleeps.
- **A tap takes one TOOL but the whole STACK of a harvest.** Taking one bow is
  obviously right; making a child tap twenty times to hand over twenty berries
  obviously is not.
- **The container panel freezes the player**, and it is the only panel that
  does. The others are read-only, so wandering while they are open is harmless;
  here you are reaching into a box two feet away.

### 15.3 Audio

**AAC in `.m4a`**, single format, because iPhone support was required (Opus is
about twice as efficient for speech but needs iOS 17.5+). Full details and the
recording workflow are in [`game/audio/README.md`](game/audio/README.md).

- **The game plays identically with the folder empty**, and keeps playing as
  clips are added one at a time. A missing file is a silent no-op.
- **Voice ids are `strings.js` key paths.** `S.act1.wake` resolves to
  `voice/act1.wake.m4a` via a value-to-key map built once by walking `S`, so
  **none of the 88 narrator call sites changed.** Template strings (functions)
  get no voice; pass `{ voice: 'id' }` to override.
- **A voiced line auto-advances** when the clip ends, with a progress line and
  tap-to-skip. Unvoiced lines wait for a tap exactly as before.
- **Voice and music stream; only short sfx are decoded.** Decoded audio costs
  ~192 KB per second, so decoding seven minutes of narration would cost ~80 MB
  on a phone.
- Both file audio and the synth bed run through one master gain, so the Sound
  and Music settings cover everything. That also works around iOS treating
  `HTMLAudioElement.volume` as read-only.
- `ctx.resume()` and `visibilitychange` handling were **missing entirely** and
  are now present: a context suspended by a lock screen used to stay suspended
  for the rest of the session.

### 15.3a Recording the narration

`node game/tools/list-voice-lines.mjs` prints every line the game actually
speaks and the filename to record it as. **111 lines: 60 in act 1, 31 in act 2,
18 in act 3.** `--todo` subtracts what is already listed, `--csv` gives a
spreadsheet.

It reports CALL SITES rather than every string, because `S.act1` also holds
objectives, button labels and hints that are never spoken and listing those
would roughly triple the apparent work. It also catches two mistakes that would
otherwise produce a file that silently never plays: a template string has no
fixed text so it cannot be matched by value (`act2.p3_wrong` needs an explicit
`{ voice }` at its call site), and where two keys hold identical text the
value-to-key map gives it to the FIRST one (`act3.title` duplicates
`actMenu.act3`, so recording `act3.title` would do nothing).

### 15.3b Reaching the world editor

**`?edit`, backtick, Ctrl+E, or F2.** F2 alone was not enough. Most laptops map
the F-row to brightness and volume unless you hold Fn, and browsers and Windows
both claim F2, so a working editor can look completely unwired. Backtick and
Ctrl+E toggle; F2 still opens it and does not double-fire against the editor's
own F2 handler; all four ignore keystrokes while a text field has focus.

Opening the editor calls `setObserver(null)`, which turns the animal distance
gate off. The gate measures from the camera and the editor flies that camera,
so without this a herd could fall asleep exactly as you flew over to look at it.

### 15.4 Measured

At the Act 1 spawn, same pose as the previous baseline:

| | Before | After |
|---|---|---|
| Draw calls | 295 | **271** |
| Triangles | 92,236 | 90,312 |
| Plains deer | 6 | 10 |
| Harvestable berries | 5 | **115** |
| Fishing spots | 1 | 4 |

Draw calls went **down** while adding four deer and 110 bushes, because the
distance gate sleeps ten of twelve animals at camp and cross flora is free.

Verified in-game: the borrow loop carries `[{basket,1},{berry,15}]`
simultaneously, the basket survives the berry deposit, returning it puts the
chest back to 4; the bear spawns only on reaching the plains, 73 blocks from
camp, with the bow still held, and the return-bow prompt fires only after it
flees; `showPrompt` performs **0 DOM mutations** across 30 identical calls;
auto-advance fires at 5.6s on a 5.57s clip.

### 15.5 A CSS bug worth remembering

The narrator was **188px wide on a 375px phone** no matter what `max-width`
said. It is absolutely positioned with only `left: 50%`, and for an auto-width
absolute box that makes the containing block the space from the 50% line to the
right edge, so shrink-to-fit clamped it to half the screen. `max-width:
min(620px, 92vw)` was never reachable. An explicit `width` is not subject to
that clamp. **That, not the font size, is why the boxes read as an
afterthought.** Same fix applied to `#hud-prompt` and the story cards.

---

## 14. The known-bugs pass (2026-08-10 14:10 IST)

Every open item in §10 closed. Two of the twelve needed no code (§10.3 and
§10.4/§10.5, verified rather than changed); the rest are one commit each.

### 14.1 What changed

| Area | Change | Files |
|---|---|---|
| Player rig | `setModelHidden()` hard override, honoured by `_cameraUnclip` and applied immediately (a glimpse can end in a mode that never runs one) | `player/player.js`, `sky/interstitial.js`, `acts/act2.js` |
| Act 1 opening | Input held from `G.mode='ground'` until the wake line lands; the controls hint moved to sit with the controls | `acts/act1.js` |
| Narrator | Listeners attach immediately, 350 ms guard is now a timestamp, `pointerdown` **and** `click`, `role="button"`, `tabIndex=0`, single-fire flag | `ui/hud.js` |
| Act menu | Second confirm before `Save.reset()`, only when there is progress to lose | `main.js`, `strings.js` |
| P3 challenge | `countdownChallenge` gained `answer`/`answerLabel`; a correct answer resolves `{won:true}`. Both numeric fields tolerate thousands separators | `ui/minigames.js`, `acts/act2.js`, `strings.js` |
| Sky | Cloud opacity and texture density up on every tier. Sprite size unchanged | `engine/renderer.js` |
| Trunks | Warm bias on wood side faces | `world/mesher.js` |
| Act 3 | `retireAmbients()` sends the villagers outward and disposes them once out of frustum, capped at 14 s | `acts/act3.js` |
| Content | Removed two dead strings **and a stray NUL byte** that was sitting inside `act3.talk_third1` | `strings.js` |

### 14.2 Things worth knowing before touching these

- **Do not "simplify" the model hide to `G.mode !== 'ground'`.** It is the
  obvious rule and it is wrong: Act 1's closing lingering shot sets `'ui'` mode
  on purpose with the character standing at the hut, and the blanket rule
  empties that shot. The hide is scripted per camera move instead.
- **The P2 find-zero challenge must stay win-less.** Running out of time IS the
  lesson (there is no year zero), so it deliberately passes no `answer`. Only
  P3 has a win condition.
- **The P3 answer box is deliberately not autofocused.** On a phone the
  keyboard would cover the dial the player is supposed to be counting on.
- **The "high" quality tier is NOT desktop, and cloud size stays put.** This
  one nearly shipped backwards. Opacity and texture density are free (same
  pixels, same blend), so they rose everywhere; sprite *area* is pure fill rate,
  so it was going to rise on the high tier only. But read `pickTier()`
  (`constants.js`): it returns `'high'` for **any** coarse-pointer device with
  more than 4 cores or more than 4 GB, which is most midrange Androids, and
  those run at `maxPixelRatio: 1.5` on DPR-3 panels. The tier is a capability
  guess, not a form factor, and it is the wrong axis for "can this device
  afford more overdraw". Size is now unchanged on every tier. **If you ever
  want a desktop-only visual, test pointer coarseness, not the tier.**
- **Both numeric answer fields tolerate thousands separators.** The game prints
  "2,583 years" and then asks the child for that number, so typing it back with
  the comma is the normal case. `type="number"` cannot support this: the
  browser blanks `value` the moment the text is not a bare number, so "2,583"
  arrived as an empty string and scored as wrong with nothing to explain it.
  The fields are `type="text" inputmode="numeric"`, which still raises the
  numeric keypad on a phone, and `readNumber()` strips separators.
- **The trunk warm bias is a lighting correction, not a palette one.** The
  hemisphere sky light is `0xaecdea` and the fill is `0xbdd2ec`; a trunk side
  face barely sees the warm sun, so pale bark multiplied by cool light lands
  grey. The bias widens R over B so the cool light lands on cream. It is sized
  to stay under the clipping point.
- **`retireAmbients` claims `ctx.ambients` immediately** (sets it to `null`
  before the walk), so the teardown sweep cannot double-free them.
- **`retireAmbients` moves `home` as well as calling `goTo`.** Idle wander pulls
  toward `home`, and a blocked `goTo` gives up after three failed detours
  (`navTick` in `npc/npc.js`), at which point the old home walked them straight
  back into the beat they were leaving. This is the "systems yield to scripts"
  rule applied to the wander system. Even so, the modern village is dense
  enough that the walk-off covers little ground: **the frustum check is what
  actually removes the pop, not the walk.**

### 14.3 How each fix was verified

Runtime, in the live game, not by inspection:

| Fix | Evidence |
|---|---|
| Model hide | Mid-flight sample of a real `skyGlimpse`: `mode=ui, modelHidden=true, visible=false` at cam y=45.8 and y=68.0, restored to `visible=true` on landing. Act 2 boot: `mode=sky, modelHidden=true`. |
| Input race | At the opening card: `inputEnabled=false`, `poll()` all zeros, player parked at the shelter spawn. Enabled only after the wake line. On mobile the joystick and jump button go `none` then `block`/`flex`. |
| Narrator | A dispatched `.click()` dismissed it (the old code swallowed that). Guard re-tested on a *freshly opened* box: click at t+80 ms and pointerdown at t+140 ms both ignored, click at t+440 ms accepted, promise resolved exactly once. A press *begun* inside the guard and released after it does not slip through (click fires on pointer-up, so the guard alone would have passed it). |
| Act menu | Two-step flow driven end to end; "No, keep my progress" left `hasProgress=true` and `beat=a1.sceneA` intact, no reload. |
| P3 | Expected answer 2583, matching the protected 4.15 example. Wrong answer flags the field and leaves the clock running; right answer resolves `{expired:false, won:true}`. P2's shape still renders no box and still expires. Give-up and timeout paths both still clean up. Separator tolerance: `2,583`, ` 2583 `, `2.583` and `25 83` all accepted, `abc` rejected. |
| Trunks | Scanned all 240,028 vertex colours in the live scene: **948** match the biased birch-side fingerprint (R/B 1.664, G/B 1.454) and **0** match the unbiased one (1.264/1.192). Ratios hold across brightness, confirming shade, jitter and AO scale uniformly. |
| Dig FX | See §10.3. |
| Ambients | Both branches. Player far (the normal case): retired on the first 700 ms poll, never observed alive and on screen. Player parked in the village staring at them: 20 consecutive polls alive and in frustum, released only at the 14 s cap. Both end with exactly the four interviewees. |

### 14.4 A verification trap this pass found

**A hidden browser pane freezes CSS animations at frame 0.** `.cd-card` carries
`fx-pop`, whose keyframe `0%` is `scale(0.7)`, so every
`getBoundingClientRect()` came back at 70% and the new answer box looked like a
35 px touch target. It is not: `getComputedStyle` reports the resting 50 px with
`min-height: 44px`, and `.chip-btn` is honoured. **Trust computed style over
bounding rects for resting size while the pane is hidden.** This is the same
root cause as the screenshot timeouts in §9.

---

## 16. The Scene B black screen (2026-08-10 20:39 IST)

Reported as "after the elder dies and the game crosses time the game is not
loading, it is a black screen, when it shows 10,000 BCE". It was not a crash and
nothing was loading: **Scene C raised its first card underneath the fader, and
on a phone there is no way to dismiss it.**

### What actually happened

`sceneC` opened like this:

```js
await G.hud.fadeOut(400);   // #fader on: opaque black, z-index 50, pointer-events auto
resetStage(G); ... douseFires();
await G.hud.card([S.act1.interstitial_generations]);   // .card-overlay, z-index 30
buildSceneC(G.world); ...
await G.hud.fadeIn(400);    // 70 lines later
```

`.card-overlay` is z-index 30 and `#fader.on` is z-index 50 with
`pointer-events: auto`, so the card sat behind a black sheet that also ate every
tap aimed at its Continue button. `HUD.card()` has a keyboard fallback
(Enter / Space / E) bound to `window`, which z-index cannot block, so **a desktop
player pressed Space and never saw a bug**. A phone has no keyboard, and the act
stopped there permanently. Mobile is the primary target, which is why this shipped
looking fine.

From the player's seat the last thing on screen is Scene B: the glimpse counts up
to 10,000 BCE, the valley thaws, two narrator lines play, and then black. Hence
"when it shows 10,000 BCE" — Scene B is the 10,000 BCE scene, and it dies on the
way out of it.

### The fix

One line, matching what `sceneD` already does (its `G.hud.fadeIn(400)` before the
glimpse carries the comment "was hidden by the fader" — the same bug, found and
fixed there, never swept for elsewhere):

```js
await G.hud.fadeIn(0);      // lift the fader BEFORE the card
await G.hud.card([S.act1.interstitial_generations]);
```

The card overlay is itself a near-opaque black wash
(`rgba(4, 2, 1, 0.94)`), so it covers the world rebuild on its own; the fader was
never the thing hiding it. `fadeIn(0)` removes the class immediately, which
restores `pointer-events: none` at once, and the 0.7 s CSS opacity transition
dissolves behind the card where nobody can see it. The `fadeIn(400)` further down
is left in place: it is now the 400 ms beat before the Scene C card, and a
defensive guarantee that the fader is off before the scene starts.

### Swept, not just fixed

Every other fade window in the game was checked for the same shape, "wait for
player input while `#fader` is on". All clean:

| Where | Between fadeOut and fadeIn | Verdict |
|---|---|---|
| `sceneA` | setup only, no input | fine |
| `sceneC` | **a card, awaiting a tap** | **was the bug** |
| `sceneD` open | already lifts the fader first | fine |
| `sceneD` kiln firing | `wait(600)`, no input | fine |
| Act 1 end into Act 2 | Act 2 calls `fadeIn(600)` before its card | fine |
| Act 2 end into Act 3 | Act 3 calls `fadeIn(600)` before its card | fine |
| Act 3 end screen | `.screen` built dark, revealed by `fadeIn(600)` before the button matters | fine |

### Verified

Reproduced and then re-run at a 375x812 touch viewport, driven with taps only:
every dismissal goes through `document.elementFromPoint` at the button's centre
and dispatches to whatever a real finger would actually hit. No `.click()` on a
covered element, no keyboard.

| | Before | After |
|---|---|---|
| Element under the Continue button | `#fader` | the card's own `button.btn.primary` |
| Card after a real tap | still open | dismissed |
| Reachable without a keyboard | no | yes |
| Where the run ends | black screen, Scene C never starts | Scene C playable, objective "Plant the wild grain by the river (0/4)" |

Zero console errors through the crossing, 8 NPCs and 10 props in Scene C, and the
world editor still opens on backtick (`window.__editor` live, `#wed` at 396x812).

### Worth keeping

- **The keyboard fallback hid this bug for months.** Any UI that waits for input
  needs to be checked on the path that has no keyboard, because a desktop test
  passes straight through a screen a phone cannot leave.
- **Two full-screen overlays are a stacking contract, not a coincidence.** If a
  beat has to hold the screen while it waits for a tap, exactly one cover may be
  up, and it has to be the one carrying the tap target.
- `#fader.on` takes pointer events on purpose (a tap during a fade must not reach
  the world), so raising the card's z-index would have been the wrong lever: it
  would have broken Act 3's end screen, which is deliberately built dark under the
  fader and revealed by it.

---

## 17. The first six narration lines (2026-08-10 21:15 IST)

The opening is voiced. Pressing Begin now runs the game's first six lines by
itself and hands over at "Take a basket from the Community Chest", which is
exactly where the recordings stop.

| # | Line | File |
|---|---|---|
| 1 | "History is the study of the human past." | `voice/openingCard.m4a` |
| 2 | "This is the story of how we know it." | `voice/openingCard2.m4a` |
| 3 | "A valley, about 38,000 years ago." | `voice/act1.sceneA_card.m4a` |
| 4 | "You are one of the ones who came before." | `voice/act1.sceneA_card2.m4a` |
| 5 | "You wake in a rock shelter. Your tribe is stirring." | `voice/act1.wake.m4a` |
| 6 | "Your tribe. Six of you, together..." | `voice/act1.tribeNote.m4a` |

**The filename is the `strings.js` key path.** `S.act1.wake` is
`voice/act1.wake.m4a`, and the id also has to be listed in
`audio/manifest.json` or it is treated as absent. `src/sound.js` resolves a
line by looking its own text back up in `S`, so no act script changes when a
recording appears. Full rules in `game/audio/README.md`; the authoritative list
of what is left is `node game/tools/list-voice-lines.mjs --todo` (105 to go).

### 17.1 Cards can narrate now

The reason this was not simply a drop-the-files job: **four of the six are
CARDS, and `HUD.card()` had no voice path at all.** Only `HUD.narrator()` did.
So the recorded opening would have played line 5 and line 6 and silently skipped
the four before them.

`HUD.card()` now mirrors the narrator exactly:

- id per entry, `entry.voice ?? voiceIdFor(entry.text)`, so `card()` still takes
  plain strings and `{ text, big }` objects unchanged;
- a clip means the card reads itself and closes on `ended`, with a
  `.card-progress` bar under the Continue button so the auto-advance does not
  read as the card vanishing;
- a tap or Enter / Space / E still skips at any point, and cuts the clip with it;
- `Sound.prefetchVoice()` warms the NEXT entry's file while the current one is
  talking, so the gap between cards is not a download. This is what that
  function was written for and it had no caller until now;
- **no clip means the old behaviour, byte for byte**: no bar (it is
  `display: none` until `.on`), wait for the button.

The bar sits under the button as a flex item rather than pinned to the viewport
bottom, which on a phone would put it behind the joystick.

`holdMs` cards stay silent. Nothing in the game uses that branch today, and a
timed card that also carries a clip needs a rule for which of the two wins;
there is no content to design that against yet.

### 17.2 A BOM in manifest.json was silently hiding every recording

`manifest.json` shipped with a UTF-8 BOM. The game never cared, because
`Response.json()` UTF-8-decodes and drops it. `JSON.parse` throws on it, so
`list-voice-lines.mjs` fell into its `catch` and reported all six freshly
recorded lines as `[!] on disk, missing from manifest.json` while the game was
happily playing them.

Fixed at both ends: the BOM is gone from the file, and the tool now strips one
and **prints an error instead of swallowing it**, because a checking tool that
answers "nothing is recorded" when it cannot read its input is worse than one
that crashes. Worth knowing on this machine specifically: PowerShell's
`Set-Content` and `Out-File` add a BOM by default.

The same pass fixed the tool's tally, which counted `done` against the rows it
had just filtered with `--todo` and so always printed "0 done".

### 17.3 Verified

Real browser, one trusted keypress to satisfy autoplay policy, then one click on
Begin and nothing else:

| | |
|---|---|
| Files requested, in order | `openingCard`, `openingCard2`, `act1.sceneA_card`, `act1.sceneA_card2`, `act1.wake`, `act1.tribeNote` — all 206, i.e. streaming |
| Prefetch | `act1.sceneA_card2.m4a` already fetched while card 3 was still talking |
| Where it stops | objective "Take a basket from the Community Chest", input enabled, 17 npcs, 22 props |
| Unrecorded card | still open after 1200 ms, progress bar `display: none`, closes on tap |
| Console errors | zero |
| World editor | opens on backtick, `#wed` at 396x800 |

Note for testing: a *synthetic* click never satisfies autoplay policy, so a
driver-only run makes every clip fail to start, and `playVoice` resolves `ended`
immediately on that failure, which auto-advances the line instantly. That is the
correct production behaviour (a refused clip must not hang the story) but it
looks exactly like the feature being broken. **Grant user activation with a real
keypress before testing audio.**

---

## 18. Character voices (2026-08-10 21:42 IST)

Talking to a tribe member now plays one of their own recorded noises instead of
a synth blip. Eight clips are in for the tribe; the elder has her own folder,
empty for now, and borrows the tribe's until it is filled.

### 18.1 The folder IS the voice

```
audio/sfx/npc/tribe/ooga.m4a                  any tribe member
audio/sfx/npc/tribe/laughing-ooga-booga.m4a
audio/sfx/npc/elder/<anything>.m4a            the elder
```

Everything under one folder is one character's pool and the game picks from it
at random. **The filename is only a variant label** — nothing in the code counts
the files or knows their names, so adding a line to a character's voice is
dropping a file in and re-running the manifest tool. No act script changes, ever.

`Sound.playFromPool(prefix, { fallback })` in `src/sound.js` does the work.
Three rules it enforces:

- **Never the same clip twice running.** With one file in the folder that means
  it repeats, which is the only thing it can do; with two or more it always
  moves on, so a talkative tribe never sounds like a loop.
- **One voice at a time per pool.** An impatient tap-tap-tap on the talk prompt
  interrupts rather than building a chorus, so the previous source is stopped.
- **An empty pool falls back**, then goes quiet, then lets the caller decide.
  The elder borrows `npc/tribe` until her own folder has a file, and with
  nothing recorded at all `makeTalkable` still fires the old synth blip. Every
  stage of a recording session sounds finished.

`Npc` gains `this.voice`, defaulting to `npc/elder` when `elder: true` and
`npc/tribe` otherwise, overridable per character with `{ voice }`. Note the
default catches the Scene C and D **chieftain**, who is also `elder: true`
(that flag means grey hair and a staff). If she should not sound like the Act 1
elder, give her a folder of her own.

**Noises, never words.** This is the same constraint as the pictogram speech
bubbles: Act 1's language beat is that the tribe's speech was rich and is
completely lost, and a recorded English sentence from a tribe member would
quietly undo it. Grunts, laughter and song all belong.

### 18.2 Decoded, not streamed

Voice pools go through `playSfx`'s decoded-AudioBuffer path, not the streaming
path that narration uses, because a grunt that arrives late reads as broken.
The cost, measured rather than estimated: the eight tribe clips are 24.1 seconds
of mono audio and decode to **4.42 MB** once every one has been heard. Decoding
is lazy, so only clips actually played cost anything. That is affordable and worth the latency. It would not be
if someone put a one-minute clip in there. See the RAM rule at the top of
`src/sound.js`.

### 18.3 manifest.json is generated now

`node game/tools/sync-audio-manifest.mjs` walks `audio/{voice,sfx,music}` and
rewrites the manifest from what is on disk. `--check` reports without writing
and exits 1 if stale.

The manifest exists so the game never 404-spams for clips nobody has recorded,
which is the right runtime behaviour and a bad authoring experience: a file you
dropped in and forgot to list is ignored without a word. Hand-editing it is now
off the table. The tool also refuses filenames that would need URL-encoding
(spaces, brackets) and writes without a BOM, which is the trap from §17.2.

### 18.4 Verified

Live, with a trusted keypress first so autoplay policy is satisfied:

| | |
|---|---|
| Voice assignment | `talk-elder` → `npc/elder`, `talk-band0..3` → `npc/tribe` |
| All eight tribe clips reachable | 40 interactions, 40 clips sounded, **8 of 8 distinct**, spread 3 to 7 plays each |
| Never twice running | **0** back-to-back repeats across those 40 |
| Elder with an empty folder | plays a tribe clip, **zero requests to `npc/elder/`** (it never guesses at files that are not there) and zero 404s |
| Elder with one file in her folder | plays only that file, three interactions, one fetch |
| Synth-blip fallback | fired zero times across all of it, i.e. every interaction sounded a real clip |
| Console errors | zero |

The elder-folder case was proved by temporarily copying a tribe clip in,
re-running the sync tool and reloading, then deleting it again. The folder is
kept in git by its own README.

Every play above was fingerprinted by `AudioBuffer.length`, which is unique per
file, rather than by counting network requests. That distinction matters, and it
caught a bad number here. **A clip is fetched exactly once and decoded into a
cache, so after its first play it never touches the network again.** An early
six-interaction sample reported "five distinct clips", which was a statement
about the sample and not about the pool: six interactions cannot surface more
than six of eight clips, and one of those six reused an already-cached clip so
no request appeared for it. The 40-interaction run is what actually establishes
that all eight are reachable. Count what sounds, not what downloads.
