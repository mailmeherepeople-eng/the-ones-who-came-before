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

Current state: zero console errors across all three acts and in the editor; strings lint green; all three acts passed a screenshot-based visual review ("ship" verdict). Remaining items, roughly by priority:

1. **Player model is not hidden during the Act 2 sky diorama and interstitial flights** — the third-person character keeps standing wherever Act 1 ended while era rebuilds change the terrain under it; it can float or poke through the mound in the overhead shot. Fix: hide the model whenever `G.mode !== 'ground'`.
2. **Intro-sequence input race** — during Act 1's opening card/narrator chain the player can already walk (synthetic input proved it; fast tappers could too), and the script later teleports them back, which reads as a glitch. Fix: hold input disabled until the wake narration completes.
3. **Dig-stroke FX visibility not re-verified up close** — dig particles were moved to pit-rim height and biased toward the camera after review found them invisible; code-verified but the final visual pass hasn't confirmed at real play distance in third person.
4. **Touch/mobile pass for the third-person camera** — drag-look orbit and pinch-for-camera-distance are wired but untested on a real device; the pinch previously did nothing, so muscle memory is unaffected, but feel needs checking.
5. ~~**Performance re-check on low-end Android**~~ — **measured and largely addressed 2026-08-10 (see §12).** Draw calls are down ~36% and the Act 2 dial stall is down 58%. What remains open is genuinely on-device testing: every number so far is emulated work counts, not phone frames.
6. **Clouds read sparse/subtle** — correct shape now (no more duplicate-sun blobs) but reviewers note they're barely there; could use one more density/size pass.
7. **Birch/snag trunks can read concrete-grey in shade** — palette was warmed and spacing enforced, but side faces in shadow still drift grey (seen at the Act 3 spawn vista).
8. **Act 2's P3 "beat the clock" reward is unconditional** — the 30-second counting challenge has no win detection wired (`countdownChallenge` supports it; callers don't use it), so the "make it and the reward is yours" framing is a bluff. Harmless (the formula is the reward) but worth honoring or rewording.
9. **Narrator boxes ignore synthetic/dispatched clicks** — real clicks and Enter work, but automated tests and possibly some assistive tech can't advance `.tap` narrators; the entrance animation also makes automated clickers flaky. Consider a real `<button>` and a keydown handler.
10. **Tab act-menu wipes the save with only a written warning** — the menu text says progress is replaced, but there's no second confirm. Fine for a dev tool; add a confirm if it ships to kids.
11. **Minor dead code** — a few defined-but-unused strings (`S.act2.deepTime_hint`, `S.act2.todayMarker`); NPC `dispose()` intentionally leaks shared cached geometries (by design, but worth a comment audit).
12. **Modern village ambient NPCs vanish at the interviews beat** — by design (they're replaced by the four interviewees), but the swap is a visible pop if you're watching.

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
