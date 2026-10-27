// Block registry. Vertex-colored voxels — no textures (spec addendum §3).
// Each block: top / side / bottom RGB, plus flags.
//  - opaque: occludes neighbouring faces in the mesher
//  - solid:  blocks movement (collision). Decorative flora is NEVER solid.
//  - cross:  rendered as two crossed quads (walk-through flora), never a cube
//  - accent: second color for cross flora (bloom / berries / seed heads)
//  - fleck:  accent is sprinkled per-vertex instead of a bottom→top gradient
export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  ICE: 6,
  ROCK: 7,
  WOOD: 8,
  LEAVES: 9,
  BUSH: 10,
  BUSH_BARE: 11,
  THATCH: 12,
  WATTLE: 13,
  PATH: 14,
  FARMLAND: 15,
  CROP: 16,
  MUDBRICK: 17,
  REED: 18,
  MOUND: 19,
  STERILE: 20,
  CHARCOAL: 21,
  SNOWGRASS: 22,
  // ---- visual-upgrade additions (ids stable from here on) ----
  TALLGRASS: 23,
  FLOWER_RED: 24,
  FLOWER_YELLOW: 25,
  FLOWER_WHITE: 26,
  FERN: 27,
  SHRUB_BERRY: 28,
  DEADBUSH: 29,
  SNOWTUFT: 30,
  LEAVES_DARK: 31,
  LEAVES_BRIGHT: 32,
  WOOD_BIRCH: 33,
  ROCK_DARK: 34,
  STRATA_A: 35,
  STRATA_B: 36,
  STRATA_C: 37,
  STRATA_D: 38,
  ROOTS: 39, // banyan aerial roots (slice 1)
};

// [topColor, sideColor, bottomColor, opaque, solid]
const C = (hex) => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];

// cross-flora helper: walk-through, never occludes, two crossed quads.
// Optional extras read by the mesher:
//  - crossH:     nominal quad height in blocks (default 0.7; REED stays 1.0)
//  - crossTaper: how far the TOP verts pull toward the centre (0..1,
//                default 0.5 → trapezoid tuft; flowers keep more top width)
const flora = (base, accent, extra = {}) => ({
  top: C(base), side: C(base), bottom: C(base),
  accent: accent != null ? C(accent) : null,
  opaque: false, solid: false, cross: true, ...extra,
});

export const BLOCK_DEFS = {
  [B.AIR]: { opaque: false, solid: false },
  // grass: a real green (was 0x87a556, a khaki that sat in the same value
  // band as sand and dirt, so the valley read as one beige sheet), with a
  // clear grass-rim/soil contrast on the sides
  // Slice 1 (2026-10-27): an Indian palette, central India in the style of
  // the Bhimbetka hills. Monsoon green over red laterite soil, buff and rose
  // sandstone, murram paths, mud-walled huts. Ids are untouched (saves).
  [B.GRASS]: { top: C(0x6d9c3d), side: C(0x955a3d), bottom: C(0x80492f), opaque: true, solid: true },
  [B.DIRT]: { top: C(0x9c5e40), side: C(0x8f5439), bottom: C(0x7f4830), opaque: true, solid: true },
  [B.STONE]: { top: C(0xab917b), side: C(0x9c836e), bottom: C(0x8c7562), opaque: true, solid: true },
  [B.SAND]: { top: C(0xe2cb98), side: C(0xd4ba84), bottom: C(0xc3a770), opaque: true, solid: true },
  // deeper blue-teal river water
  [B.WATER]: { top: C(0x2b7a9c), side: C(0x256b88), bottom: C(0x1b526e), opaque: false, solid: false, water: true },
  [B.ICE]: { top: C(0xd6ecf6), side: C(0xb9d8ea), bottom: C(0xa3c6dc), opaque: true, solid: true },
  // Vindhyan sandstone: rose-buff faces, the colour of the Bhimbetka shelters
  [B.ROCK]: { top: C(0xb3856a), side: C(0xa4775d), bottom: C(0x8f6650), opaque: true, solid: true },
  [B.WOOD]: { top: C(0x9a7247), side: C(0x6b4a2f), bottom: C(0x9a7247), opaque: true, solid: true },
  [B.LEAVES]: { top: C(0x46802b), side: C(0x3e7227), bottom: C(0x356222), opaque: true, solid: true },
  [B.BUSH]: { top: C(0x47823a), side: C(0xa63d30), bottom: C(0x38622c), opaque: true, solid: true },
  [B.BUSH_BARE]: { top: C(0x6b7448), side: C(0x5f6841), bottom: C(0x525a38), opaque: true, solid: true },
  [B.THATCH]: { top: C(0xd4a856), side: C(0xc29447), bottom: C(0xab803c), opaque: true, solid: true },
  // mud-plastered walls, the red-brown of the soil they are made from
  [B.WATTLE]: { top: C(0xae7650), side: C(0x9e6846), bottom: C(0x88583b), opaque: true, solid: true },
  // murram: the beaten red laterite of a village path
  [B.PATH]: { top: C(0xc08452), side: C(0xa96f45), bottom: C(0x925e3b), opaque: true, solid: true },
  [B.FARMLAND]: { top: C(0x5f4527), side: C(0x6f5230), bottom: C(0x63482a), opaque: true, solid: true },
  [B.CROP]: { top: C(0xa8bf55), side: C(0x8ba847), bottom: C(0x5f4527), opaque: true, solid: true },
  [B.MUDBRICK]: { top: C(0xbe8656), side: C(0xae7749), bottom: C(0x99673e), opaque: true, solid: true },
  // walk-through vegetation — must never wall off the riverbank (solid stays false)
  // kans grass (kaash): the tall riverbank grass whose white plumes open
  // after the monsoon. Same id and placement as the old reeds.
  [B.REED]: flora(0x93a352, 0xf3efe2, { crossH: 1.0, crossTaper: 0.25 }),
  [B.MOUND]: { top: C(0x9c7049), side: C(0x8d633f), bottom: C(0x7d5636), opaque: true, solid: true },
  [B.STERILE]: { top: C(0xceb08a), side: C(0xbea07b), bottom: C(0xad906c), opaque: true, solid: true },
  [B.CHARCOAL]: { top: C(0x2e2a26), side: C(0x282420), bottom: C(0x22201c), opaque: true, solid: true },
  // warm off-white snow top (B lowest channel) — a blue-white top made the
  // whole cold basin cast grey-blue under the scene-A sky
  [B.SNOWGRASS]: { top: C(0xeaeee2), side: C(0x8a6742), bottom: C(0x74542f), opaque: true, solid: true },
  // ---- decorative flora (all walk-through, all crossed quads) ----
  [B.TALLGRASS]: flora(0x6c963c, 0xa8b45c),
  // flowers keep more top width than grass so the bloom still reads
  [B.FLOWER_RED]: flora(0x5f8c44, 0xd8503c, { crossTaper: 0.3 }),
  // marigold orange-yellow
  [B.FLOWER_YELLOW]: flora(0x5f8c44, 0xf2ad2e, { crossTaper: 0.3 }),
  // pink rather than white: a white bloom read as litter or snow at range
  [B.FLOWER_WHITE]: flora(0x5f8c44, 0xe48db5, { crossTaper: 0.3 }),
  [B.FERN]: flora(0x39682f, 0x4d8038, { crossTaper: 0.4 }),
  [B.SHRUB_BERRY]: flora(0x3f7434, 0xc03a2c, { fleck: true, crossTaper: 0.35 }),
  // dry straw-brown tuft, lighter seed heads — sits naturally on the grass hue
  [B.DEADBUSH]: flora(0x9a7240, 0xc2a462, { crossTaper: 0.45 }),
  // frost tuft: CLEARLY green sage body, warm pale tip. The mesher paints the
  // accent full-strength on both top verts and gradients it down the quad, so
  // the body must stay saturated-green (wide R/G/B spread) and the tip must
  // keep blue as its LOWEST channel — a near-grey body (old 0xb9c4ae) read as
  // blue plywood under the cold sky even at moderate density. Shorter and
  // spikier than meadow grass so act1's dense cold scatter reads as frost.
  [B.SNOWTUFT]: flora(0xa2b183, 0xdce4cb, { crossH: 0.6, crossTaper: 0.62 }),
  // ---- tree / rock / strata variants (cube blocks) ----
  // banyan and mango: deep glossy green
  [B.LEAVES_DARK]: { top: C(0x30652a), side: C(0x2b5a25), bottom: C(0x244d20), opaque: true, solid: true },
  // peepal and date-palm fronds: lighter, yellower green
  [B.LEAVES_BRIGHT]: { top: C(0x6aa037), side: C(0x5f9132), bottom: C(0x527e2c), opaque: true, solid: true },
  // pale WARM birch bark — creamy, never concrete grey (banding via mesher jitter)
  // date-palm trunk (was pale birch): ringed grey-brown, the mesher's ring
  // banding for this id now reads as old frond scars. Also the log crossing.
  [B.WOOD_BIRCH]: { top: C(0x8e7a5c), side: C(0xa48d6a), bottom: C(0x8e7a5c), opaque: true, solid: true },
  // weathered, smoke-darkened sandstone: cave walls and shelter interiors
  [B.ROCK_DARK]: { top: C(0x6b4c3c), side: C(0x5f4335), bottom: C(0x523a2e), opaque: true, solid: true },
  // sedimentary bands for the fossil-cliff reading face ("layers = time")
  [B.STRATA_A]: { top: C(0x8a5138), side: C(0x8a5138), bottom: C(0x7c4832), opaque: true, solid: true },
  [B.STRATA_B]: { top: C(0xc9a468), side: C(0xc9a468), bottom: C(0xb8945c), opaque: true, solid: true },
  [B.STRATA_C]: { top: C(0x8b8b6d), side: C(0x8b8b6d), bottom: C(0x7d7d62), opaque: true, solid: true },
  [B.STRATA_D]: { top: C(0xd9bd85), side: C(0xd9bd85), bottom: C(0xc8ad77), opaque: true, solid: true },
  // banyan aerial roots: hanging cords, walk-through like any flora, so a
  // banyan's skirt of roots never walls off a path
  [B.ROOTS]: flora(0x76563a, 0x8d6c4c, { crossH: 1.0, crossTaper: 0.05 }),
};

// Runtime block registration — the world editor's block importer uses this to
// add a type without a source edit, so a new block can be tried out in the live
// world before it is written into the table above. Returns the new id.
// `def` takes hex numbers: { name, top, side, bottom, solid, opaque, cross,
// accent, crossH, crossTaper }.
let NEXT_ID = 64; // well clear of the ids above; ids stay stable for saves
export function registerBlock(def) {
  const key = String(def.name || `CUSTOM_${NEXT_ID}`).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const existing = B[key];
  const id = existing ?? NEXT_ID++;
  const C1 = (hex, fb) => (hex == null ? fb : [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]);
  const top = C1(def.top, [0.7, 0.7, 0.7]);
  B[key] = id;
  BLOCK_DEFS[id] = {
    top, side: C1(def.side, top), bottom: C1(def.bottom, top),
    accent: def.accent != null ? C1(def.accent, null) : null,
    opaque: def.cross ? false : def.opaque !== false,
    solid: def.cross ? false : def.solid !== false,
    cross: !!def.cross,
    crossH: def.crossH, crossTaper: def.crossTaper, fleck: !!def.fleck,
    // painted faces: atlas tile indices, allocated by whoever registers the
    // block (world/atlas.js). Absent = the ordinary vertex-coloured path.
    tex: def.tex ?? null,
  };
  return id;
}

// re-registering the same name repaints in place; callers that need to know
export function blockIdOf(name) { return B[String(name).toUpperCase()]; }

export function isOpaque(id) { return BLOCK_DEFS[id]?.opaque === true; }
export function isSolid(id) { return BLOCK_DEFS[id]?.solid === true; }
export function isWater(id) { return BLOCK_DEFS[id]?.water === true; }
export function isCross(id) { return BLOCK_DEFS[id]?.cross === true; }
