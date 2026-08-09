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

export const PERF = {
  MAX_PIXEL_RATIO: 1.5,
  TARGET_FPS: 30,
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

export const SAVE_KEY = 'towcb-save-v1-baseline'; // BASELINE COPY: separate save so it never collides with the live game
