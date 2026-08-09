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
  // warmer, softer grass with a clear grass-rim/soil contrast on the sides
  [B.GRASS]: { top: C(0x87a556), side: C(0x8a6742), bottom: C(0x74542f), opaque: true, solid: true },
  [B.DIRT]: { top: C(0x8a6440), side: C(0x7e5a39), bottom: C(0x704e30), opaque: true, solid: true },
  [B.STONE]: { top: C(0x9a948b), side: C(0x8b867d), bottom: C(0x7c7770), opaque: true, solid: true },
  [B.SAND]: { top: C(0xe3cf9a), side: C(0xd6c085), bottom: C(0xc6ae70), opaque: true, solid: true },
  // deeper blue-teal river water
  [B.WATER]: { top: C(0x2f7490), side: C(0x286680), bottom: C(0x1e5069), opaque: false, solid: false, water: true },
  [B.ICE]: { top: C(0xd6ecf6), side: C(0xb9d8ea), bottom: C(0xa3c6dc), opaque: true, solid: true },
  [B.ROCK]: { top: C(0x77705f), side: C(0x6a6355), bottom: C(0x5c564a), opaque: true, solid: true },
  [B.WOOD]: { top: C(0x9b7746), side: C(0x74562c), bottom: C(0x9b7746), opaque: true, solid: true },
  [B.LEAVES]: { top: C(0x5b8a3c), side: C(0x527d38), bottom: C(0x497031), opaque: true, solid: true },
  [B.BUSH]: { top: C(0x47823a), side: C(0xa63d30), bottom: C(0x38622c), opaque: true, solid: true },
  [B.BUSH_BARE]: { top: C(0x6b7448), side: C(0x5f6841), bottom: C(0x525a38), opaque: true, solid: true },
  [B.THATCH]: { top: C(0xd2a95f), side: C(0xc0954e), bottom: C(0xac8343), opaque: true, solid: true },
  [B.WATTLE]: { top: C(0xa07b4a), side: C(0x8f6c40), bottom: C(0x7c5c36), opaque: true, solid: true },
  [B.PATH]: { top: C(0xb59a67), side: C(0x9d8557), bottom: C(0x87724b), opaque: true, solid: true },
  [B.FARMLAND]: { top: C(0x5f4527), side: C(0x6f5230), bottom: C(0x63482a), opaque: true, solid: true },
  [B.CROP]: { top: C(0xa8bf55), side: C(0x8ba847), bottom: C(0x5f4527), opaque: true, solid: true },
  [B.MUDBRICK]: { top: C(0xbb9159), side: C(0xac814c), bottom: C(0x997242), opaque: true, solid: true },
  // walk-through vegetation — must never wall off the riverbank (solid stays false)
  [B.REED]: flora(0x7fa04c, 0xa9c26a, { crossH: 1.0, crossTaper: 0.25 }),
  [B.MOUND]: { top: C(0x967c4b), side: C(0x88703f), bottom: C(0x7a6437), opaque: true, solid: true },
  [B.STERILE]: { top: C(0xcbb896), side: C(0xbca887), bottom: C(0xac9877), opaque: true, solid: true },
  [B.CHARCOAL]: { top: C(0x2e2a26), side: C(0x282420), bottom: C(0x22201c), opaque: true, solid: true },
  // warm off-white snow top (B lowest channel) — a blue-white top made the
  // whole cold basin cast grey-blue under the scene-A sky
  [B.SNOWGRASS]: { top: C(0xeaeee2), side: C(0x8a6742), bottom: C(0x74542f), opaque: true, solid: true },
  // ---- decorative flora (all walk-through, all crossed quads) ----
  [B.TALLGRASS]: flora(0x7ea24f, 0x9ab55f),
  // flowers keep more top width than grass so the bloom still reads
  [B.FLOWER_RED]: flora(0x5f8c44, 0xd8503c, { crossTaper: 0.3 }),
  [B.FLOWER_YELLOW]: flora(0x5f8c44, 0xeac944, { crossTaper: 0.3 }),
  [B.FLOWER_WHITE]: flora(0x5f8c44, 0xf0eee2, { crossTaper: 0.3 }),
  [B.FERN]: flora(0x39682f, 0x4d8038, { crossTaper: 0.4 }),
  [B.SHRUB_BERRY]: flora(0x3f7434, 0xc03a2c, { fleck: true, crossTaper: 0.35 }),
  // dry straw-brown tuft, lighter seed heads — sits naturally on the grass hue
  [B.DEADBUSH]: flora(0x8a6a3c, 0xa89058, { crossTaper: 0.45 }),
  // frost tuft: CLEARLY green sage body, warm pale tip. The mesher paints the
  // accent full-strength on both top verts and gradients it down the quad, so
  // the body must stay saturated-green (wide R/G/B spread) and the tip must
  // keep blue as its LOWEST channel — a near-grey body (old 0xb9c4ae) read as
  // blue plywood under the cold sky even at moderate density. Shorter and
  // spikier than meadow grass so act1's dense cold scatter reads as frost.
  [B.SNOWTUFT]: flora(0xa2b183, 0xdce4cb, { crossH: 0.6, crossTaper: 0.62 }),
  // ---- tree / rock / strata variants (cube blocks) ----
  [B.LEAVES_DARK]: { top: C(0x41682e), side: C(0x3b5f2b), bottom: C(0x345526), opaque: true, solid: true },
  [B.LEAVES_BRIGHT]: { top: C(0x74a341), side: C(0x69963c), bottom: C(0x5d8636), opaque: true, solid: true },
  // pale WARM birch bark — creamy, never concrete grey (banding via mesher jitter)
  [B.WOOD_BIRCH]: { top: C(0xbfa87e), side: C(0xe6d9b6), bottom: C(0xbfa87e), opaque: true, solid: true },
  [B.ROCK_DARK]: { top: C(0x453f37), side: C(0x3d3831), bottom: C(0x36322b), opaque: true, solid: true },
  // sedimentary bands for the fossil-cliff reading face ("layers = time")
  [B.STRATA_A]: { top: C(0x8a5138), side: C(0x8a5138), bottom: C(0x7c4832), opaque: true, solid: true },
  [B.STRATA_B]: { top: C(0xc9a468), side: C(0xc9a468), bottom: C(0xb8945c), opaque: true, solid: true },
  [B.STRATA_C]: { top: C(0x8b8b6d), side: C(0x8b8b6d), bottom: C(0x7d7d62), opaque: true, solid: true },
  [B.STRATA_D]: { top: C(0xd9bd85), side: C(0xd9bd85), bottom: C(0xc8ad77), opaque: true, solid: true },
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
