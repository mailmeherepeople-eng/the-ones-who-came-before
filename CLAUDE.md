# Project rules — The Ones Who Came Before

Standing rules for this repo. These are not suggestions; both are enforced by
tooling and both have bitten before.

---

## 1. GitHub carries the shipped game and nothing else

**No planning documents. No idea documents. Ever.**

That includes design docs, specs, research notes, knowledge maps, allocation
tables, brainstorms, drafts, handoff scratch and review screenshots. They live
on disk and in the Obsidian vault, which is where thinking belongs.

`.gitignore` already blocks the known names and a set of patterns
(`*-design-doc.md`, `ideas*.md`, `plan*.md`, `/specs/`, `review-*.png`, and
more). Before committing a new file, ask:

> Does the game need this to run, or does a developer need it to understand
> what shipped?

If neither, add it to `.gitignore` **before** the first commit. Adding it after
means it is in the public history forever.

Currently kept: `README.md`, `GAME-OVERVIEW.md`, `game/README.md`,
`game/COVERAGE.md`, `game/EDITOR.md`, `game/`, and the Pages entry files.

## 2. No em dashes in anything the player sees

**Never use `—` (em dash) or `–` (en dash) in player-facing content.** Use a
comma, a full stop, a colon, or parentheses.

This covers `src/strings.js`, any inline string in an act or UI file, HUD
labels, button text, card copy, narrator lines and `alt`/`aria` text. It does
not apply to code comments or to documentation like this file.

`node game/tools/lint-strings.mjs` fails on any em dash or en dash in the
string files and in inline quoted strings across `src/`. Run it before every
commit — it is the same lint that guards the syllabus wording.

## 3. Keep GAME-OVERVIEW.md current

`GAME-OVERVIEW.md` is the handoff document and is expected to describe what is
actually shipped. When behaviour changes, update it in the same commit, and
timestamp the entry in **IST** (`Asia/Kolkata`).

---

## Conventions inherited from the build (do not break these)

- **All user-visible text lives in `src/strings.js`.** The lint enforces it,
  along with the old-syllabus blocklist, stray date literals, and the protected
  NCERT phrasings (the no-year-zero trick, the verbatim 2,583-year example, the
  "Perhaps they believed" hedge).
- **All canonical dates live in `src/constants.js`** and nowhere else.
- **`SITES` in `world/terrain.js` is the single source of truth** for named
  locations. Act scripts never hard-code a coordinate that has a site name.
- **Terrain heights are frozen.** Walkability (bank caps, the cave approach,
  jump height, water breach) was hand-verified across all four world states.
- **Systems yield to scripts.** Anything autonomous (ambient life, idle wander)
  exposes a `stop()` and is stopped before a scripted beat moves the same
  characters.
- **Dev tooling stays out of the shipped graph.** `src/dev/*` is only ever
  reached by a dynamic `import()` behind `?edit`, backtick, Ctrl+E or F2.
- **Check the world editor still opens, every pass.** It is loaded lazily and
  imported by nothing, so no lint and no act playthrough will ever tell you it
  broke. It has four entry routes because F2 alone is unreliable (laptops need
  Fn, browsers and Windows both claim it), which once made a working editor look
  unwired. Verifying it is one line: open the game and press backtick.
- **Folded meshes:** `world/merge.js` welds static part-meshes for performance.
  Anything animated must be passed in `keep`, or it loses its transform. See
  GAME-OVERVIEW §12.

## Run and check

```
npx serve -l 8321 game        # or the .claude/launch.json "game" config
node game/tools/lint-strings.mjs
```
