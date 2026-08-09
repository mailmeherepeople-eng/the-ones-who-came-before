// All canonical dates and figures live HERE and nowhere else.
// Sources: NCERT fees104.pdf (verified visually 2026-08-07, spec addendum §2).
// Negative years = BCE, positive = CE. There is no year zero (4.13):
// year -1 (1 BCE) steps directly to year 1 (1 CE).

export const YEARS = {
  // Fig 4.1 — evolution of life (years ago unless noted)
  EARTH_BYA: 4.54,
  OXYGEN_BYA: 2.33,
  PRIMATES_YA: 10_000_000,
  FIRE_YA: 1_000_000,
  HOMO_SAPIENS_YA: 300_000, // "three lakh" — never 40,000 (4.31)
  WRITING_YA: 6_500,

  // Fig 4.3 — human history (BCE as negative years)
  HOMO_SAPIENS_BCE: -300000,
  ROCK_ART_BCE: -40000, // first examples of rock art in the world
  ICE_AGE_TICK_BCE: -14000, // unlabeled axis tick inside the Ice Age band
  ICE_AGE_END_BCE: -12000, // figure's arrow (body text 4.41 says "around 12,000 years ago")
  SETTLEMENTS_BCE: -8000, // first settlements and beginning of agriculture
  POTTERY_BCE: -6000, // pottery technology in the Indian Subcontinent
  MESOPOTAMIA_BCE: -4200, // "just before 4000 BCE", no printed date in figure
  COPPER_BCE: -4100, // "just before 4000 BCE", no printed date in figure
  INDUS_SARASVATI_BCE: -2600, // civilisation 2600-1900 BCE
  INDUS_SARASVATI_END_BCE: -1900,
  BUDDHA_BCE: -560,
  ASHOKA_BCE: -250,
  JESUS_CE: 1,
  TODAY_CE: 2026,

  // The textbook's own worked example (4.15) — taught VERBATIM as the book's example.
  BOOK_EXAMPLE_CE: 2024,
  BOOK_EXAMPLE_GAP: 2583, // 560 + 2024 - 1

  // Act anchors (spec addendum §1.2 — Scene A after the world's first rock art)
  SCENE_A_YEAR: -36000, // ~38,000 years ago
  SCENE_B_YEAR: -10000, // just after the ice-age end marker
  SCENE_C_YEAR: -7000, // settling down, after 8000 BCE
  SCENE_D_YEAR: -5400, // village with pottery, after 6000 BCE
};

export const UNITS = {
  DECADE: 10,
  CENTURY: 100,
  MILLENNIUM: 1000,
};

// Gap across the BCE/CE boundary: add both, subtract 1 (4.14).
export function gapYears(bce, ce) {
  return Math.abs(bce) + ce - 1;
}

// Format a signed year for display ("560 BCE", "2026 CE", "12,000 BCE" —
// commas only on five digits and up, matching the textbook's figures).
export function fmtYear(y) {
  const abs = Math.abs(y);
  const n = abs >= 10000 ? fmtNum(abs) : String(abs);
  return y < 0 ? `${n} BCE` : `${n} CE`;
}

export function fmtNum(n) {
  return n.toLocaleString('en-IN');
}

export const WORLD = {
  SIZE_X: 128,
  SIZE_Z: 128,
  SIZE_Y: 24,
  CHUNK: 16,
  WATER_LEVEL: 5,
};

// ---------------------------------------------------------------------------
// Quality tiers
//
// Only settings that genuinely TRADE VISUALS FOR SPEED live here. The two big
// wins of the 2026-08-10 performance pass — folding part-meshes (world/merge.js)
// and draining the Act 2 rebuild across frames (acts/act2.js) — cost nothing
// visually, so they run everywhere and are deliberately not tier-gated. Gating
// them would only create two code paths to test for no benefit.
//
// Detection is a guess and will stay one: `pointer: coarse` catches touchscreen
// laptops and misses phones with a mouse, deviceMemory is Chrome-only and caps
// at 8, and nothing exposes the GPU. A budget Redmi and a flagship Galaxy both
// read "mobile" and differ by roughly 10x. That is why ?q= exists — it is the
// part that actually makes both tiers testable, on either device.
// Two levers were tried and REJECTED on measurement, deliberately not here:
//   farPlane/fogNear 160->120 — saved 2% of draw calls and clipped the world.
//     Act 2's diorama camera sits 150 units from the far map corner, so a 120
//     far plane cuts the valley off mid-air while the fog is still configured
//     to fade at 175. A visible bug for a rounding error of a gain.
//   floraDensity 1->0.6 — ground cover is only ~3,100 of ~187,000 triangles,
//     so thinning it saved 0.4% while being the most visible change of any
//     option considered. Worst possible trade.
const TIERS = {
  high: {
    maxPixelRatio: 1.5,
    clouds: 8,         // sky billboards
    particleCap: 1500, // additive + normal pools combined
    meshBudget: 3,     // chunks remeshed per frame in the ground loop
    drainBudget: 12,   // chunks per frame while an Act 2 era rebuild drains
  },
  low: {
    // The one that actually matters on a phone and cannot be seen on a
    // desktop: at DPR 3, dropping the cap from 1.5 to 1.25 renders 31% fewer
    // pixels. Clouds and particles are large overlapping transparent quads,
    // i.e. pure fill rate, which is what a weak mobile GPU has least of. The
    // two budgets cap how much remeshing can land on a single frame.
    maxPixelRatio: 1.25,
    clouds: 3,
    particleCap: 600,
    meshBudget: 1,
    drainBudget: 5,
  },
};

function pickTier() {
  let forced = null;
  try {
    forced = new URLSearchParams(location.search).get('q');
  } catch { /* no location (tests, tooling): fall through to the default */ }
  if (forced === 'low' || forced === 'high') return forced;

  let coarse = false;
  try { coarse = matchMedia('(pointer: coarse)').matches; } catch { /* older engines */ }
  if (!coarse) return 'high';

  // A coarse pointer alone only says "touch". Drop to low when the device also
  // looks weak, and default UP when the hints are missing — an unnecessarily
  // pretty frame on a strong phone beats a needlessly ugly one on any device.
  const mem = navigator.deviceMemory;        // Chrome only, caps at 8
  const cores = navigator.hardwareConcurrency; // widely supported, still a proxy
  if (mem !== undefined && mem <= 4) return 'low';
  if (cores !== undefined && cores <= 4) return 'low';
  return mem === undefined && cores === undefined ? 'low' : 'high';
}

export const QUALITY_TIER = pickTier();
export const QUALITY = TIERS[QUALITY_TIER];

export const PERF = {
  MAX_PIXEL_RATIO: QUALITY.maxPixelRatio,
  TARGET_FPS: 30,
  // Same on both tiers. Act 2's diorama needs the full 160 to see the far map
  // corner, and shortening it bought almost nothing anyway.
  FAR_PLANE: 160,
  FOG_NEAR: 60,
};

export const PLAYER = {
  EYE_HEIGHT: 1.62,
  SPEED: 5.2, // blocks/sec — valley crossing ≈ 35s, doc §4 pacing accepted
  RADIUS: 0.32,
  GRAVITY: 22,
  JUMP: 9.9, // clears a 2-block step (h = J²/2g ≈ 2.2)
  REACH: 4.2,
};

export const SAVE_KEY = 'towcb-save-v1';
