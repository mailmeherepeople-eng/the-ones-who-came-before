# Design Doc — "Chapter 4" (working title: *The Ones Who Came Before*)

**Project:** NCERT Class 6 history game, Chapter 4 — Timeline and Sources of History
**Studio:** Git Gud Studio
**Date:** 2026-08-04
**Status:** Approved design, ready for implementation planning
**Handoff target:** Claude Code

This document is self-contained. It assumes no access to prior conversation context. Companion reference docs (same directory as this design when handed off): `class6-history-knowledge-map.md` (full examinable-item audit) and `two-mode-allocation.md` (mode split rationale).

---

## 0. One-paragraph summary

A single-player browser game in which the player first **lives** as an early human (first-person voxel world), then watches **time erase most of their life** (top-down time-dial mode), then returns as a team of modern specialists to **excavate their own past** and defend conclusions against contradicting sources. The game teaches every examinable item of NCERT Class 6 Social Science Chapter 4 ("Timeline and Sources of History", *Exploring Society: India and Beyond*, 2026-27 reprint) as mechanics rather than as quiz content. Three acts, one world, one save file.

## 1. Why this design (context for the implementer)

- **Audience:** Indian students around age 11–12 (Class 6), playing on low-to-mid Android phones and school/home browsers. Assume touch-first, mouse-second, low GPU, unreliable network after first load.
- **Pedagogical claim being made:** a student who finishes the game can answer exam questions on this chapter *without separately studying it*. This claim is audited against a 50-item knowledge map (see companion doc). Items are covered by mechanics, not by text dumps.
- **Design thesis:** the chapter is about *how we know the past*. The game makes the player the ground truth: they create the historical record in Act 1, watch it decay in Act 2, and reconstruct it in Act 3. Every epistemological lesson (sources, missing pieces, contradicting accounts, dating) lands because the player has privileged knowledge of what actually happened.
- **Visual language:** Minecraft-style voxels. Chosen deliberately: kids parse it instantly as "a real game", assets are cheap (cubes + small textures), and digging/building are native verbs of the style.

## 2. Hard constraints

1. **Tech:** Three.js, vanilla JS, single-page web app. No engine (no Unity/Godot). Must run in mobile Chrome on a ₹10k Android phone at playable framerate. Target: small voxel world (see §7), not infinite terrain. No server dependency for gameplay; localStorage for save state. (Supabase telemetry can come later; do not build it now.)
2. **Content authority:** the ONLY content source is the NCERT textbook chapter itself (fees104.pdf, "Timeline and Sources of History"). Do NOT source facts from coaching sites (Vedantu, StudyRankers, etc.) — several are wrong against the current syllabus. Where this doc marks a figure ⚠️, it must be verified against the printed NCERT page before the text enters the game.
3. **Old-syllabus contamination guard:** the terms *Palaeolithic, Mesolithic, Neolithic, Dasas/Dasyus, Aryans (as a people), untouchables* must NOT appear anywhere in the game. They are from the pre-2024 book and are not in the current syllabus. Human origins figure is **300,000 years** (three lakh), never 40,000.
4. **Language:** English v1. All strings in a single strings file from day one (Hindi later).
5. **No real-person likenesses** (no Sachin Tendulkar image for the century joke — use a generic batsman).
6. **No user-generated content leaves the device.** No video/audio recording features. The family-history activity is an on-device text journal only.
7. **Age-appropriateness:** no blood, no death animations beyond "the hunt succeeds" abstraction. Burial scene is respectful and non-graphic (see A1-B7).

## 3. Structure: three acts, two modes

**GROUND mode** = first-person voxel. Minutes-scale. You are a person.
**SKY mode** = top-down view of the same world + a draggable time dial. Centuries-scale. You are nobody; you are a viewpoint. Dragging the dial forward advances world state.

Transition verb is **zoom** (pinch / scroll / button). Zooming out enters SKY and accelerates time; zooming in returns to GROUND. This relationship is itself lesson content (timescale ↔ altitude).

- **Act 1 — LIVE (GROUND, ~25 min):** play an early human across the settlement's growth. Player *creates* artifacts and events that become Act 3's archaeological record.
- **Act 2 — PASS (SKY, ~10 min):** the time dial. Player scrubs from their life to the present day, watching decay, ice retreat, settlement growth, and era markers. Teaches all measurement-of-time content.
- **Act 3 — DIG (GROUND, ~25 min):** return to the same coordinates as a modern excavation team. Excavate Act 1's remains. Judge contradicting sources. Finish with an in-game "site report" that is, functionally, exam revision the player wants to read.

The save file records every Act 1 player action that produces a persistent object (pot fired, painting made, beads traded, burial performed, crop planted, camp locations). Act 3 world-gen reads this record. **This is the core system. Everything else serves it.**

## 4. Act 1 — LIVE

### World
One valley: a river, a cave/rock-shelter area, a plains area, herds of simple animals (deer-like; one hostile predator type for tension), berry bushes, a fishable river. World is small: the player should cross it in ~90 seconds.

### Progression: four "scenes" inside Act 1
Act 1 internally advances through mini time-skips (a short SKY interstitial between scenes — a few seconds of dial motion, foreshadowing Act 2's full mechanic).

**Scene A — Band (hunter-gatherer camp)**
- Player wakes in a band of ~6 NPCs. [4.32: lived in bands/groups, helping each other]
- Verbs: gather berries/fruits, hunt (simple bow/spear timing minigame), sleep in rock shelter. [4.33 hunters and gatherers; 4.34 temporary camps, rock shelters, caves]
- NPCs speak in an invented pictogram/speech-blob language with readable *intent* icons but no words. One elder addresses the player at a fire; the player hears structured, clearly meaningful, untranslatable speech. Tooltip (present-day narrator voice): "They had rich languages. Every one of them is lost. No recording, no writing — sound does not fossilise." [4.35]
- Fire is lit at camp; player crafts improved stone axe → blade → arrowheads at a knapping station (3-step tap minigame). [4.36]
- **Cave painting (A1-B4):** player paints on the shelter wall with a simple palette (finger/mouse drawing, stamp shapes for animals/hands/symbols). Whatever they paint is SAVED verbatim — it returns in Act 3. [4.38]
- **Ornament + exchange (A1-B5):** player collects shells at the river, drills them at the knapping station into beads; a visiting band arrives and an exchange scene occurs (their obsidian for your beads, gesture-based, no shared language). [4.39]
- **Resource depletion beat:** berry bushes visibly empty, herds wander off-map. Elder points to horizon; camp packs up. SKY interstitial shows the band's camps *moving* across the valley over years — the player sees WHY hunter-gatherers move (food exhausted, animals moved, seasons, water). [feeds the classic 5-mark "reasons hunter-gatherers move" causal chain]
- **Burial (A1-B7):** an elder NPC dies (off-screen; band gathers). Guided, gentle scene: the band buries them WITH GOODS — a bead string and a favourite tool placed in the grave by the player. Narrator: "They believed something continued." [4.37 beliefs, afterlife]. Grave coordinates saved.

**Scene B — Thaw (end of the Ice Age)**
- SKY interstitial: ice sheet at valley's north edge retreats as dial moves from ~100,000 ya to ~12,000 ya (compressed); meltwater visibly swells the river. [4.40 Ice Age definition; 4.41 last Ice Age >100,000 → ~12,000 years ago; 4.42 melt → rivers swell → oceans]
- Back on GROUND: valley is greener, river is wider.

**Scene C — Roots (first farming)**
- Player receives wild grain, plants a test plot by the river; fast-grow feedback. NPC dialogue: soil near the river grows more. [4.43 settling, cultivating cereals; 4.44 rivers = water + fertile soil]
- Player pens two goats / cattle (lead-animal-to-pen task). [4.43 domestication]
- Camp becomes permanent: huts replace tents (auto-build around player between visits, not player-commanded — the player is a citizen, not a commander).
- **Community store (A1-C4):** ALL gathered/produced items go into one shared granary chest. There is deliberately NO personal inventory UI beyond a small "hands" slot. If the player tries to hoard, an NPC gently takes items to the store. Post-harvest, a prompt asks: "Which grain sack is yours?" — correct answer is "all of them / none of them". [4.46 no individual ownership, collective sowing/harvest]
- A chieftain NPC coordinates: assigns the player tasks, resolves a dispute in a short cutscene, distributes stored grain in a lean week. [4.45 chieftains responsible for well-being]

**Scene D — Fire and Clay (village)**
- Settlement is now a village ("Your hamlet has grown" — the word *hamlet* is used and glossed in-line). [4.50, 4.47]
- **THE POT (A1-D2):** the player makes a pot at a new kiln: shape it (drag profile curve — keep it very simple, 3 preset-ish shapes + freeform tweak), stamp a decoration (player chooses/draws a mark), fire it. The pot's exact shape + mark are SAVED. The player also weaves a reed basket (one-tap craft, deliberately effortless) and stores both side by side in their hut. [4.49 pottery]
- Copper beat: a trader NPC arrives with a copper bangle; village smith begins cold-working copper trinkets. One line of narrator: "Copper first. Iron comes much later." [4.49 copper first, iron later]
- Villages exchange: a cart path forms to a neighbouring village; the player runs one delivery (food out, cloth back). SKY interstitial shows 3–4 villages with exchange lines forming a small network; one node visibly larger ("becoming a town"). [4.47 goods exchanged: food, clothing, tools; 4.48 networks; villages → towns]
- Act 1 ends with the player placing the pot and basket in their hut, camera lingering, cut to black.

### Act 1 exclusions (explicit)
- No RTS layer. No unit commands. World growth happens via time-skips.
- No multiplayer. The collective-store mechanic is single-player (NPC-enforced).
- No combat system beyond the hunt minigame.

## 5. Act 2 — PASS

The full SKY mode. The valley from above; a large horizontal **time dial** at the bottom edge; the player drags it.

### Dial behaviour
- Range for the main scrub: from the player's Act 1 life (marked "YOU") to 2026 CE.
- As the dial moves: the village grows/changes and eventually (for this valley's fiction) is abandoned and buried; vegetation shifts; the river meanders slightly; a mound forms where the village was. [sets up 4.26 and Act 3's mound]
- **Era markers** appear on the dial as it's crossed, each with a 1-line card: end of last Ice Age (~10,000 BCE) · first settlements & agriculture (8000 BCE) · pottery in the Indian Subcontinent (6000 BCE) · copper metallurgy · first cities, Mesopotamia (4000 BCE ⚠️ verify against Fig 4.3) · Indus-Sarasvatī civilisation (2600–1900 BCE) · birth of the Buddha (560 BCE) · Aśhoka (~250 BCE) · birth of Jesus (1 CE boundary) · today. [4.8 eras begin at major events; Fig 4.3 content ⚠️ verify pairings against printed page]
- **Deep-time prologue (optional pull left):** dial zooms out logarithmically to Fig 4.1's evolution timeline (Earth 4.54 bya → … → primates ~10 mya → Homo sapiens 300,000 ya → writing 6,500 ya). Presented as "pull further to see how small our whole story is". The visual: the human portion of the bar is a sliver. [4.31 Homo sapiens 300,000 years; Fig 4.1]

### Set-piece beats (in order)

**P1 — The Erosion Window.** Dial stops at the player's hut; a cutaway "soil column" view shows the pot and basket buried side by side. Player scrubs centuries: the basket darkens, frays, vanishes over ~2 seconds of scrubbing; the pot chips but persists; the elder's grave nearby keeps its beads and stone tool while cloth and body reduce to bone. Narrator: "Every object is a piece of a jigsaw. Some pieces are gone forever." [4.26 — THE flagship mechanic of the game. Get this one perfect before anything else.]

**P2 — BCE/CE and the missing zero.** Dial's central region marks the CE/BCE boundary (Jesus' birth as the conventional origin; forward = CE, formerly AD; backward = BCE, formerly BC). [4.11, 4.12] Then a challenge: "Find the year 0. 30 seconds." Timer runs; there is no zero on the dial; on expiry: "TRICK QUESTION. There is no year zero. 1 BCE steps straight to 1 CE." (The word TRICK displayed big — deliberate memory anchor, per Kuroi's note.) [4.13]

**P3 — The gap formula, earned.** Task: "How many years from the Buddha's birth (560 BCE) to 2024 CE? Count on the dial. 30 seconds, reward if you make it." Counting is deliberately too slow; on expiry, teach: **add both, subtract 1** → 560 + 2024 − 1 = 2,583. Then one practice rep with a different pair, using the formula, instantly rewarding. [4.14, 4.15]

**P4 — Step locks.** Dial's step size can be locked: ×10 (decade), ×100 (century), ×1000 (millennium). Mini-tasks: "reach Aśhoka using century steps — how many clicks?" Century framing uses a cricket beat (generic batsman raises bat; "100 runs = a century; 100 years = a century"). Century numbering shown by highlighting: 21st century CE = 2001–2100; 3rd century BCE = 300–201 BCE; millenniums likewise (3rd millennium CE = 2001–3000; 1st millennium BCE = 1000–1 BCE). [4.16–4.19]
- The "order without dates" lesson: two unlabeled event flags; player states which came first purely from dial position. [4.21]

**P5 — Calendar faces (one beat, not a system).** A single toggle swaps the dial's face: Gregorian ↔ one Indian luni-solar face. World doesn't change; markers re-label. Two lines of narrator: Gregorian = 12 months/365 days/leap years every 4 years, EXCEPT century years must divide by 400 (1800 ✗ 1900 ✗ 2000 ✓); many Indian calendars follow sun & moon positions, tabulated in a pañchānga (eclipses, sunrise/sunset, festivals). [4.9, 4.10, 4.22, 4.23 — all four items in ~30 seconds of content; deliberately shallow in v1]

**P6 — Arrival at today.** Dial reaches 2026. Camera descends toward the mound. Smash cut: a survey flag plants in the grass. Act 3 begins.

## 6. Act 3 — DIG

### Setup
Same valley, present day. The village is a low mound [the word *mound* glossed — it's in the textbook's source diagram]. The player now controls a five-person team, switched via a bottom toolbar (party, not classes — the player uses ALL of them; never a choose-one-class screen):

| Specialist | Tool/verb | Teaches |
|---|---|---|
| **Geologist** | "Ground vision" overlay: reads soil layers, marks diggable vs sterile ground, reads the old river course | 4.2 |
| **Palaeontologist** | Recovers/reads *organic* remains: bones, teeth, burnt grain — anything once alive; reads fossils in the exposed cliff | 4.3, 4.7 |
| **Archaeologist** | The excavation verb itself: grid-square careful digging; recovers made objects (pot, beads, tools, brick traces) | 4.5 |
| **Anthropologist** | Talks to present-day villagers nearby; collects oral tradition | 4.4, 4.27 |
| **Epigraphist** | ONE scripted beat in v1: examines the cave wall's painted symbols; distinguishes "picture" from "possible sign"; explains inscriptions are their domain | 4.6 (cameo; stars in Chapter 6) |

Wrong-specialist attempts fail gently with a hint ("These are bones — my colleague should look at this"), which IS the teaching mechanic for who-does-what. This mapping is exam content (match-the-columns), so it must be strictly correct: **anthropologist talks to people; archaeologist digs.** (An earlier draft had this reversed. It is wrong. Do not ship it reversed.)

### The dig
- Voxel excavation on the mound in layer-locked grid squares (deeper = older — stratigraphy shown by layer colour, never named with jargon).
- Finds are the player's OWN Act 1 objects, read from the save file: the pot (their shape, their mark — chipped per Act 2 erosion), the drilled shell beads, arrowheads, hearth charcoal, the burial (handled respectfully: music drops, no manipulation of remains beyond the Palaeontologist's reading; the grave goods tell the afterlife story back to the player) [4.37 payoff], and the cave painting — revealed by lantern in the shelter, exactly as the player painted it. **This recognition loop is the emotional payload of the game.** The basket is nowhere. A find-slot for it sits permanently empty in the site inventory, labelled "organic — not preserved." [4.26 payoff]
- Each find generates a **Source Card** (photo, find-layer, specialist who read it, what it tells us). Cards accumulate into the Site Report. Cards are typed by source category (archaeological / oral / artistic / literary-absent-here / inscription-none-yet), teaching the categories by sorting real finds, not by memorising the textbook's 25-node diagram (explicitly non-examinable). [4.24, 4.25]

### The contradiction scene [4.27, 4.28]
Present-day villagers (via Anthropologist) hold an oral tradition about "the old mound." Three accounts:
- Grandmother: matches truth on settlement + farming, wrong on one vivid detail ("a great king's fort").
- Farmer: repeats a rumour (his account traces to the same single storyteller as a third NPC — the player can discover both cite "old Mastanamma said so").
- Retired teacher: cautious, partially right, cites what she read.
The player, holding Act 1 ground truth + excavated Source Cards, adjudicates each CLAIM (not each person) on a claim board: supported / contradicted / can't tell. Key designed insights: (a) more agreeing voices ≠ more true when they share one origin; (b) a mostly-wrong source can still carry one true piece; (c) evidence types can confirm each other (painting + bones + oral memory of "animal drives"). Narrator caps it: historians gather every source they can, sources confirm or contradict, and the historian must judge which to trust — with help from archaeologists, epigraphists, anthropologists, language experts. [4.27, 4.28]

### The lab [4.29, 4.30]
A "Send to Lab" tray (3 uses in v1): burnt grain → species ID + date range; hearth charcoal → date; bone → **genetics** result: "this individual and the burial by the river were close kin" + ancestry trace showing movement from elsewhere — the lesson: some questions (kinship, migration) were unanswerable until ~50 years ago; science (climate studies, chemistry, genetics) is history's newest source. A closing line notes that for RECENT history (last 2–3 centuries) we also get newspapers, then electronic media — shown as a single "sources timeline" strip in the report. [4.29, 4.30]

### The Site Report (finale + revision artifact)
Auto-compiled scrapbook: every Source Card, the claim board verdicts, the timeline of the site, the empty basket slot, the player's painting photographed "in situ". Written in first person plural ("We found…"). This document IS the revision notes for the chapter, and the player made all of it. Exportable as an image (nice-to-have v1.1).
- Final screen: E.H. Carr's dialogue-between-present-and-past idea, in kid words: "You just talked to yourself across ten thousand years."
- [4.1 "history = study of the human past" is the literal first line of the game's opening card and the last line of the report.]

## 7. Systems summary (build order priority)

1. **Save-record system** — Act 1 actions → persistent object records (position, type, player-authored art/shape data). Everything depends on this.
2. **Voxel world core** — small fixed-size chunked world, two world-states (Act 1 valley, Act 3 mound), first-person controls (touch joystick + look; WASD+mouse on desktop), block dig/place limited to designated zones (this is NOT free-build Minecraft; digging is contextual).
3. **Time dial (SKY)** — camera lift, dial UI, era markers, world-state interpolation (village growth stages = swap prebuilt block layouts; erosion = per-object decay curves).
4. **Dialogue/scene system** — icon-based Act 1 speech; text dialogue Act 3; claim board UI.
5. **Craft minigames** — knapping (3-tap), pot (curve + stamp), painting (canvas on a wall plane), planting/penning (simple interactions).
6. **Source Cards + Site Report** — data-driven from save record.
7. **Audio** — ambient + 3–4 stingers. Web Audio, synthesized/free assets.

**Performance budget:** world ≤ ~128×128×24 blocks per state, greedy-meshed; target 30fps on low-end Android. Instanced meshes for vegetation/NPCs. No shadows on mobile tier.

## 8. Explicit cut list (v1)

| Cut | Reason | Where it went |
|---|---|---|
| Multiplayer collective-store | Scope; lesson works single-player | NPC-enforced shared granary |
| Solar-system calendar view | Days of work for two 1-mark items | One dial-face toggle + 2 narrator lines (P5) |
| Full calendar-switching system | Same | Same |
| Epigraphist as full tool | Ch 4 gives them almost nothing to read | Scripted cameo; full tool in Ch 6 |
| Choose-your-class RPG start | Guarantees coverage gaps | Party of five, all used |
| RTS command layer | Genre conflict with first-person | Citizen + time-skip growth |
| Video-recorded family interviews | DPDP/COPPA/moderation risk | On-device text journal (v1.1, optional) |
| Any real-person likeness | IP | Generic batsman for the century joke |
| NPC majority-vote truth | Teaches false epistemology | Claim board + source-origin tracing |
| Free-build / free-mine anywhere | Scope + off-syllabus play | Contextual dig/build zones |
| Supabase/telemetry/auth | Not needed to prove the game | localStorage only |

## 9. Coverage audit (the guarantee)

All 50 items of the knowledge map route through a beat above except:
- **4.20** (plural of millennium) — deliberately untaught (trivia; NCERT marks nothing on it).
- **4.9/4.10/4.22/4.23** — taught shallow (P5). Acceptable for 1-markers; revisit if a current-syllabus sample paper shows heavier weighting.
Everything else: taught by mechanic, with the erosion window (4.26), the trick-question zero (4.13), the earned formula (4.14–15), the specialist party (4.2–4.6), the contradiction scene (4.27) and the recognition dig as the six load-bearing beats.

## 10. Open items / pre-build verification

1. ⚠️ **Verify Fig 4.3 date↔event pairings against the printed NCERT page** (PDF text extraction scrambled the column order). Affects Act 2 era markers. Ten minutes with the physical book.
2. ⚠️ Verify Fig 4.1 figures likewise (4.54 bya etc. extracted cleanly but confirm).
3. **Obtain a post-2024-syllabus CBSE sample paper** to validate question-format weighting (the previously reviewed paper was old-syllabus and is void for content).
4. Name check: working title only; do not spend time on branding.
5. Chapter 5 and 6 integration points exist (Epigraphist cameo, copper line, Indus-Sarasvatī dial marker) but build NOTHING for them in v1.

## 11. Vertical slice (build this first, before the full plan)

**The Pot Loop.** One weekend-scale proof, one HTML file:
1. GROUND: shape a pot (curve + stamp), place it in a hut beside an auto-given basket.
2. SKY: dial + soil-column cutaway; scrub 10,000 years; basket rots, pot chips and survives.
3. GROUND (mound): 5×5 grid dig; find YOUR pot, your mark visible; Source Card generates; the basket's slot shows empty.

Success criterion: a playtester (ideally an actual 11-year-old) sees their own mark on the excavated pot and reacts. If the recognition moment doesn't land in the slice, the three-act structure needs rethinking before further build. If it lands, proceed to full implementation plan.

## 12. Definition of done (v1)

- All three acts playable start to finish on a mid-range Android phone in mobile Chrome, ≤ 70 minutes total, no server.
- Every knowledge-map item except 4.20 traceable to a shipped beat (maintain a coverage checklist in the repo mirroring §9).
- Zero occurrences of old-syllabus terms (automated string lint for the §2.3 blocklist).
- ⚠️ items resolved against the printed textbook.
- Site Report renders correctly from at least three distinct playthrough save files (different paintings/pot marks/choices).
