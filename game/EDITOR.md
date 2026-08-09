# World editor

A live scene editor for this game — and, deliberately, for any three.js project.
Dev-only and lazily loaded: nothing of it exists in the game until you ask for it.

**Open it:** add `?edit` to the URL, or press **F2** at any time.

```
http://localhost:8321/?edit
http://localhost:8321/?edit&fast&dev
```

It opens **in flight**, so you are never stuck where the player is standing.

---

## The idea

Edits are **live but not permanent** — the source files stay the source of truth.
Every change is written to a running list; the *Changes* tab turns it into a
precise request you paste back into the chat:

```
# World edit request

## a1.sceneA
1. MOVE prop `communityChest` (44, 10, 22) → (45, 10, 22.5)   [src/acts/act1.js …]
2. BLOCK (73, 7, 37) AIR → WOOD
3. TERRAIN raise r=2 at (52, 10, 33) with GRASS — 13 cell(s)
4. SET npc `band0`.speed 1.5 → 2.4                            [src/acts/act1.js …]
5. BEHAVIOUR `elder` goTo(41.5, 27)                           [src/acts/act1.js]
6. ADD prop `Campfire` at (52, 9, 36)                         [src/acts/act1.js]
```

The list survives reloads (localStorage) and **re-apply** puts your live tweaks
back after a refresh or a scene change.

---

## Controls

### Camera — always flying

| Action | Does |
| --- | --- |
| **W A S D** | Fly forward / left / back / right |
| **E** / **Q** | Up / down |
| **Shift** / **Ctrl** | 3× faster / 4× slower |
| **drag** | Look around (cursor stays visible — no pointer lock) |
| **wheel** | Fly speed |
| **fly** button | Turn flight off and drive the player normally instead |
| **plan** button | Jump to a top-down view of the whole map |

The world keeps simulating while you fly — NPCs carry on with their errands.
Story beats that wait for the *player* to reach a place will pause until you turn
flight off (they track the player's body, not the camera).

### Selecting

| Action | Does |
| --- | --- |
| **hover** | Blue outline + name in the status bar |
| **click** | Select it, open it in *Inspect* |
| **click** (Scene tab row) | Same, for things off-screen |
| **Esc** | Deselect / cancel a "click where…" prompt |

Your own character is not clickable (in third person it sits dead centre and
would swallow every click) — select it from the last row of the Scene list.

### Moving the selection

| Action | Does |
| --- | --- |
| **← →** | ±X · **↑ ↓** ±Z · **PgUp / PgDn** ±Y |
| **Shift** / **Alt** held | ×5 / ×0.2 the step |
| hold **G** + move mouse | Drag it along the ground |
| **R** | Rotate 22.5° |
| **Delete** | Remove it (props, characters) / erase it (blocks) |
| **place…** button | Then click anywhere to drop it there |

### Blocks

| Action | Does |
| --- | --- |
| **Alt + click** | Place the current paint block against the face you clicked |
| **Alt + right-click** | Remove exactly that one block |
| **click** (Terrain tab open) | Apply the brush |

Removing a block clears **only that cell** and leaves the now-empty cell
selected, so you can keep working in the hole — put something back, keep
digging, or step the selection up/down the column with the buttons in *Inspect*.

---

## Tabs

**Scene** — outliner of everything: props by name, characters with their live
ambient job and state, ambient jobs, named sites, sky, player. Filter box at the
top.

**Inspect** — the selection. Position, rotation, scale, and per-type controls:

- *props*: open/close a chest, berries on/off, rename, duplicate, hide, delete
- *characters*: see below
- *jobs*: tool, pose, work duration, beat, icons, and "move site by click"
- *blocks*: retype, erase, step up/down the column
- *sites*: coordinates (recorded — structures already built don't move)

**Terrain** — paint block picker (incl. any block you imported), brush with
**paint / erase / raise / lower / flatten / smooth**, cube or sphere, radius
0–8. Plus the layout tools: **x-ray**, **wireframe**, **plan view**, and a
**slice Y** slider that cuts everything above a height away for a clean cutaway.

**Create** — place any prop factory in the game, spawn any character kind
(person, child, elder, deer, goat, cattle, predator), and import your own voxels.

**World** — FOV, fly speed, grid, screenshot, sky/fog colours, every light's
intensity, fog near/far, live player tuning (speed, jump, gravity, reach), draw
calls and triangle count, and map size (recorded — a resize needs a rebuild).

**Changes** — the list, copy request, copy JSON, re-apply, delete individual
entries.

---

## Full control over characters

Select any person or animal and *Inspect* gives you:

| Group | Controls |
| --- | --- |
| Movement | speed, wander radius, home X/Z, **walk to…** (click a spot), **home here**, **stop**, **freeze** |
| Relationships | **follow player**, **follow…** (click who), **face…** (click what), **bring to me** |
| Actions | pose (aim / cast / pick / chop / tend), carried item (bow / rod / basket / spear / axe / firewood), busy flag |
| Speech | type the bubble text, **say it** |
| Errands | which job they're on now, their whole job **rotation** (comma-separated), restart the errand, send them home, or give an unemployed character a job |
| Animals | flee from me, down it |

Everything you do is recorded, so "make the elder greet you first, then walk to
the fire" comes back as a behaviour list I can write into the act script.

---

## Painting your own blocks

*Create → design your own block.* A 16×16 pixel painter for each face of a
cube — this is real texture painting, not just a colour swap.

1. Pick a face (**top / side / bottom**).
2. Paint: **pencil**, **fill** (bucket), **erase**, **pick** (eyedropper), plus
   one-click **flat fill**, **grain fill** (a flat colour with per-pixel grain,
   which is what makes a block sit next to the hand-textured ones), **noise**
   and **clear**. Drag to paint continuously.
3. **copy to all faces** if one texture is enough, or paint the top and sides
   separately (grass-on-dirt style).
4. **start from** an existing block to inherit its colours as a base.
5. **create / update block** — it registers immediately, becomes your paint
   block, and the world remeshes. Alt+click to place it.

Press **create / update** again after more painting and it repaints in place
everywhere it has been used.

**copy JSON** gives you the whole definition — name, flags and all three
16×16 tiles — as a file you can drop back in later, or hand to me to make it a
permanent block in `src/world/blocks.js`.

How it works: painted faces go into a 256×256 texture atlas and are meshed in a
separate pass with UVs; the untouched vertex-coloured path is exactly as it was,
and the atlas is only created the first time a painted block exists. Face
shading and ambient occlusion still multiply over your texture, so a custom
block lights the same way the rest of the world does.

---

## Importing models

Drag a file onto the panel, or use the file picker in *Create*.

### 0. Anything from a 3D tool — `.glb` (glTF 2.0)

The loader is vendored, so `.glb` just works: drop it, it appears under
"imported this session", click it, then click in the world. There's a **place at
scale** slider because exports come in wildly different units. Materials and
textures come through; animations are detected and reported but not played.

Use **`.glb`** (single self-contained file), not `.gltf` — a `.gltf` referencing
external `.bin`/`.png` files can't resolve them from a drag-and-drop.

### 1. A model — MagicaVoxel `.vox`

The easy path. [MagicaVoxel](https://ephtracy.github.io/) is free; build a
chest, a hut, a tree, save as `.vox`, drop it in. It appears under "imported
this session" — click it, then click in the world to place it. Colours come from
the file's palette (if the file uses the untouched default palette, MagicaVoxel
omits the palette chunk and colours are approximated — the status bar says so;
nudging any colour in MagicaVoxel makes it write a real palette).

### 2. A model — plain JSON (no tools needed)

```json
{
  "name": "torch",
  "scale": 0.15,
  "cells": [
    [0, 0, 0, "#6d5028"],
    [0, 1, 0, "#6d5028"],
    [0, 2, 0, "#ffcc55"]
  ]
}
```

`cells` are `[x, y, z, colour]` in voxel units, Y up. `scale` is world units per
voxel (0.1 ≈ a small hand prop, 1.0 = the same size as terrain blocks). A
`palette` shorthand also works:

```json
{ "name": "torch", "scale": 0.15,
  "palette": { "w": "#6d5028", "f": "#ffcc55" },
  "cells": [[0,0,0,"w"], [0,1,0,"w"], [0,2,0,"f"]] }
```

### 3. A new terrain block type — JSON

```json
{ "block": "MOSSY_STONE", "top": "#6f7a4a", "side": "#5d6440", "bottom": "#4c5236", "solid": true }
```

A painted block is the same file with tiles instead of (or as well as) flat
colours — this is what the block designer's **copy JSON** produces:

```json
{ "block": "MY_BRICK", "solid": true,
  "tiles": { "top": ["#8a5a3a", "…256 colours…"], "side": [], "bottom": [] } }
```

Drop it in and it is registered immediately, becomes the paint block, and shows
up in the Terrain dropdown — paint with it right away. Optional: `"cross": true`
makes it walk-through crossed-quad flora (like grass tufts) and then `"accent"`,
`"crossH"`, `"crossTaper"` apply.

Imports live for the session; the change list records them so they can be made
permanent in `src/world/blocks.js` / `src/world/props.js`.

---

## Reusing this editor in another three.js project

The editor imports **nothing** from this game. Everything it touches goes
through a host adapter:

```
src/dev/editor.js         the editor (generic)
src/dev/voxel-import.js   .vox / .json importers (generic)
src/dev/host.js           ~120 lines describing THIS game
```

To reuse it, copy `editor.js` + `voxel-import.js`, write your own `host.js`, and
call `initEditor(host)`. The contract is documented at the top of `editor.js`;
the short version:

```js
initEditor({
  scene, camera, renderer, dom,            // required
  label: () => 'level-1',
  frame: { add(fn), setScale(n), setPaused(b) },
  cameraControl: { take(), release() },    // so the editor can fly
  // everything below is optional — features appear only if you provide them
  voxel: { SX, SY, SZ, ids, name(id), get, set, topAt, remesh, materials() },
  props: () => [...], addProp, removeProp, propKinds(), spawnProp(kind,x,y,z),
  characters: () => [...], characterKinds(), spawnCharacter(kind,x,z), removeCharacter,
  sites: () => ({}), ambient: () => scheduler,
  player: { obj, pos, teleport, model(), tune, world },
  input: { setEnabled(bool) },
  setSky(skyHex, fogHex),
});
```

Leave `voxel` out and the Terrain tab disappears; leave `characters` out and the
character tools disappear. A plain three.js scene with just
`{scene, camera, renderer, dom, frame, cameraControl}` still gets flight,
click-select, transform, duplicate/delete, spawn-from-import, screenshots,
sky/light control and the change list.

---

## Where to get files to drop in

All of these give you `.glb` (or `.vox`) directly — no account needed for the
first four.

| Site | What's there |
| --- | --- |
| **poly.pizza** | Thousands of free low-poly models, one-click **glTF/.glb** download, CC0 or CC-BY. The fastest place to grab a tree, a barrel, an animal. |
| **kenney.nl/assets** | Big, tidy, fully **CC0** packs (nature, medieval, survival, voxel). Downloads are zips containing `.glb`/`.gltf` per model. |
| **quaternius.com** | Free **CC0** low-poly packs (animals, plants, buildings, characters) with `.glb` included. Style matches this game well. |
| **polyhaven.com/models** | **CC0**, higher fidelity than this game's look, but the props are excellent. |
| **sketchfab.com** | Huge library — filter **Downloadable** + a Creative Commons licence, then choose the **glTF** download. Free account required. |
| **itch.io** (game-assets → 3D) | Lots of small indie packs, many free; check the licence per pack. |
| **MagicaVoxel** — ephtracy.github.io | The tool, not a library: make your own `.vox` in minutes. Free, tiny, Windows/Mac. |
| **Blender** — blender.org | Model or convert anything, then *File → Export → glTF 2.0 (.glb)*. Also how you turn `.obj`/`.fbx`/`.dae` into something this editor can read. |

Check the licence before shipping anything in a classroom build: **CC0** needs
no attribution, **CC-BY** needs a credit line.

## Importing from other engines

| Source | How |
| --- | --- |
| **Blender, Unity, Unreal, Godot, Maya, C4D** | Export **glTF 2.0 (`.glb`)** — supported now, loader vendored under `vendor/gltf/`. |
| **MagicaVoxel** | `.vox` — supported. |
| **Minecraft schematics / structure blocks** | `.schem` / `.nbt` are gzipped NBT; a parser is small and the block palette maps onto this game's blocks. Worth doing only if you actually have builds to bring in. |
| **Unity prefabs / Unreal assets directly** | No — those are engine-internal formats with engine-specific components (materials, scripts, physics). Export the mesh to `.glb` first; behaviour never transfers, it has to be rewritten as game code. |
| **OBJ / FBX** | Possible (`OBJLoader` / `FBXLoader`), but `.glb` is better in every way — one file, materials included, correct scale. |

The rule of thumb: **geometry and materials port through glTF; behaviour never
ports.** Anything a script did in the other engine has to be re-authored here —
which is exactly what the change list is for.
