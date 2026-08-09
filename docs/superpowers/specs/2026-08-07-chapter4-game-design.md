# Spec Addendum — "The Ones Who Came Before" (Chapter 4 game)

**Date:** 2026-08-07
**Base design:** `chapter4-design-doc.md` (approved). This addendum records the deltas approved for implementation. Where this file is silent, the base design doc governs.

## 1. Approved amendments (pedagogy fixes ONLY — scope cuts were declined)

The user approved the four correctness fixes below and declined all scope cuts and simplifications. The predator, fishable river, cart delivery run, chieftain dispute cutscene, freeform pot tweak, deep-time prologue, and calendar face swap all ship as designed in the base doc.

1. **Specialist find allocation (fixes an error in base doc §6).** NCERT 4.5 lists "bones and teeth, burnt grains" as **Archaeologist** finds; Palaeontologists (4.3) study remains *millions of years old*, as fossils. In Act 3: the Palaeontologist's verb is limited to the exposed fossil cliff (footprints/plant/animal impressions in rock layers, 4.7) and *commenting* on the burial; the Archaeologist recovers everything excavated from the mound and grave, including bones, teeth, and burnt grain. Anthropologist talks to people; Archaeologist digs (unchanged, correct in base doc).
2. **Scene A date.** Act 1 Scene A is anchored ~40,000–20,000 years ago (not pre-100,000), so the player's cave painting does not precede Fig 4.3's examinable "first rock art in the world, 40,000 BCE". The Scene B interstitial shows the *tail end* of the Ice Age, with the card preserving the textbook phrasing "over 100,000 years ago to around 12,000 years ago" (4.41).
3. **Afterlife hedge.** Burial narrator line is "Perhaps they believed something continued." (NCERT 4.37 says *possibly*.) Act 3's grave-goods reading presents the afterlife as an inference, not a fact.
4. **Lab genetics.** The bone result returns kinship only ("this individual and the burial by the river were close kin"). No ancestry/migration trace — beyond the textbook and adjacent to blocklisted territory.

## 2. Verified NCERT figures (resolves base doc §10 items 1–2)

Verified visually against `fees104.pdf` pages 60–63 (rendered, not text-extracted) on 2026-08-07.

**Fig 4.1 (evolution of life)** — matches the knowledge map: Earth 4.54 bya · atmospheric oxygen 2.33 bya · first cells · bacteria · sponges and fungi · corals (~700 mya) · fish and vertebrates (~500 mya) · sharks · insects, amphibians (~300 mya) · reptiles, dinosaurs · birds · mammals · flowers and bees (~100 mya) · primates 10 mya · fire 1 mya · **Homo sapiens 300,000 ya** · **writing 6,500 ya**.

**Fig 4.3 (human history since 300,000 BCE)** — verified pairings:

| Date on axis | Event |
|---|---|
| 300,000 BCE | Homo sapiens (start of timeline) |
| 40,000 BCE | First examples of rock art in the world |
| (band ending near 14,000/12,000 BCE) | Ice Age |
| **12,000 BCE** | **End of last ice age** ← corrects the base doc's 10,000 BCE guess |
| 8000 BCE | First settlements and beginning of agriculture |
| 6000 BCE | Pottery technology in the Indian Subcontinent |
| just before 4000 BCE (no printed date) | The world's first cities in Mesopotamia; Beginning of copper metallurgy |
| just before 2000 BCE (no printed date) | Indus-Sarasvatī civilisation |
| between 2000 BCE and 1 CE | Birth of the Buddha (560 BCE per body text), then Aśhoka |
| 1 CE boundary | Birth of Jesus |
| 2000 CE | "We are here" |

Note: body text (4.41) says the ice age ended "around 12,000 years ago" (~10,000 BCE) while the figure's arrow sits at 12,000 BCE. Both are NCERT-printed. Ruling: the dial's era marker uses the figure's 12,000 BCE; narrator cards quote the body text verbatim where 4.41 is taught.

**Gap-formula example ruling:** taught with the textbook's verbatim example — "suppose we are now in the year 2024 CE, then the Buddha was born 560 + 2024 − 1 = 2,583 years ago" — framed as the book's example. Free-practice pairs may use other dates. The dial itself runs to 2026 CE ("We are here" placed at today).

## 3. Architecture

- **Stack:** vanilla JS ES modules, Three.js vendored at `game/vendor/three.module.js`, no build step, no server dependency; localStorage saves; runs from any static host.
- **Layout:** `game/index.html` + `game/css/` + `game/src/` (modules: `constants.js`, `strings.js`, `save.js`, `world/` voxel+mesher+worldstates, `player/` controls+interact, `npc/`, `sky/` dial+skymode, `acts/` act1+act2+act3, `ui/` hud+dialog+minigames, `audio.js`) + `game/tools/lint-strings.mjs`.
- **Rendering rules (low-end Android):** vertex-colored voxels (no block textures), greedy meshing per 16×16×24 chunk, dirty-chunk remesh on dig, capped `devicePixelRatio ≤ 1.5`, fog + short far plane, one directional + hemisphere light, no shadows/postprocessing on mobile tier, deliberate 30fps frame limiter, `webglcontextlost/restored` recovery from CPU-side world data.
- **Controls:** desktop WASD + pointer-lock mouse; touch virtual joystick + drag-look (`touch-action: none`, multi-touch identifier tracking). Zoom verb (scroll/pinch/button) transitions GROUND ↔ SKY.
- **Text and dates:** every user-visible string in `strings.js`; every canonical date/figure in `constants.js`. `lint-strings.mjs` fails on: blocklist terms (Palaeolithic, Mesolithic, Neolithic, Dasas, Dasyus, Aryans-as-a-people, untouchables), date literals outside `constants.js`, and deletion of protected qualifiers ("conventional", "Perhaps", "over 100,000").
- **Save:** autosave after every beat; records every persistent Act 1 object (position, type, player-authored art/shape data, thumbnails); Source Card schema lives beside the save schema in `save.js` — every field a card renders must exist in a record.
- **Recognition support:** small canvas thumbnails captured at craft moments (pot, painting) power Act 3 flashbacks, the claim board's ground-truth recall, and the Site Report's "in situ" photos.

## 4. Coverage checklist obligation

`game/COVERAGE.md` mirrors base doc §9: every knowledge-map item 4.1–4.50 (except 4.20, deliberately untaught) maps to a shipped beat. Maintained as beats land.

## 5. Definition of done (unchanged from base doc §12)

Three acts playable start to finish in mobile Chrome and desktop, ≤70 min, no server; blocklist lint zero hits; verified figures shipped; Site Report renders from distinct playthroughs.
