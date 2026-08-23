// Inline SVG icons for the HUD.
//
// Act scripts name their interact prompts with an emoji (a berry, a fishing
// rod, a pot) because that is the quickest thing to write. Emoji are what
// the player sees though, and on Android they render as coloured chat
// stickers that differ from phone to phone and sit oddly inside an ember
// coloured pill. These are stroke-only glyphs drawn in currentColor, so
// they take the pill's colour and look the same everywhere. Anything not in
// the table falls back to the emoji, so a new prompt never breaks.
//
// Each path is a 24x24 viewBox, 1.8px strokes, round caps. Hand-drawn to keep
// the repo asset-free (CLAUDE.md: GitHub carries the shipped game only).
const P = {
  // three berries on a sprig
  '🫐': '<circle cx="8" cy="14" r="3.2"/><circle cx="15.5" cy="15" r="3.2"/><circle cx="12" cy="8.5" r="3.2"/><path d="M12 5.3V3M10.2 3.8 12 3l1.8.8"/>',
  // an ear of grain
  '🌾': '<path d="M12 21V9"/><path d="M12 9c-3-1-4-3.5-4-5 2 0 4 1.5 4 5Zm0 0c3-1 4-3.5 4-5-2 0-4 1.5-4 5Z"/><path d="M12 13c-3-1-4-3.5-4-5 2 0 4 1.5 4 5Zm0 0c3-1 4-3.5 4-5-2 0-4 1.5-4 5Z"/><path d="M12 17c-3-1-4-3.5-4-5 2 0 4 1.5 4 5Zm0 0c3-1 4-3.5 4-5-2 0-4 1.5-4 5Z"/>',
  // two people, the agreement
  '🤝': '<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="8" r="2.6"/><path d="M3.5 19c.5-3.5 2.3-5.5 4.5-5.5s4 2 4.5 5.5M11.5 19c.5-3.5 2.3-5.5 4.5-5.5s4 2 4.5 5.5"/>',
  // a string of beads
  '📿': '<path d="M5 7c0 6 3 10 7 10s7-4 7-10"/><circle cx="5" cy="7" r="1.6"/><circle cx="7.2" cy="12.5" r="1.6"/><circle cx="12" cy="17" r="1.6"/><circle cx="16.8" cy="12.5" r="1.6"/><circle cx="19" cy="7" r="1.6"/><circle cx="12" cy="21" r="1.3"/>',
  // a rock
  '🪨': '<path d="M6 18 3.5 13l3-5 6.5-2 6 3.5 1.5 5.5-3 3Z"/><path d="M9.5 8 8 13l4 5"/>',
  // a basket with a handle
  '🧺': '<path d="M4 11h16l-1.5 9h-13Z"/><path d="M8 11c0-4 1.8-6 4-6s4 2 4 6"/><path d="M7.5 14.5h9M7 17.5h10M10 11v9M14 11v9"/>',
  // a toolbox
  '🧰': '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M9 9V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V9M3 14h18"/>',
  // a bone
  '🦴': '<path d="M7.5 9.5 14.5 16.5"/><path d="M6 5.5a2 2 0 1 1 2.6 2.6 2 2 0 1 1-2.6-2.6Zm12 12a2 2 0 1 1-2.6-2.6 2 2 0 1 1 2.6 2.6Z"/>',
  // a flint blade
  '🔪': '<path d="M4 20l4-4"/><path d="M8 16 18 4c2 3 2 7-1 10l-5 3Z"/>',
  // a magnifier
  '🔍': '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
  // a box
  '📦': '<path d="M3.5 8 12 4l8.5 4v9L12 21l-8.5-4Z"/><path d="M3.5 8 12 12l8.5-4M12 12v9"/>',
  // a scroll
  '📜': '<path d="M6 4h11a3 3 0 0 1 3 3v1h-4"/><path d="M6 4a2.5 2.5 0 0 0-2.5 2.5V8h4V6.5"/><path d="M7.5 8v9.5A2.5 2.5 0 0 1 5 20h11a2.5 2.5 0 0 0 2.5-2.5V8"/><path d="M10.5 11h5M10.5 14.5h5"/>',
  // a speech bubble
  '💬': '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5Z"/><circle cx="8.5" cy="10" r=".6"/><circle cx="12" cy="10" r=".6"/><circle cx="15.5" cy="10" r=".6"/>',
  // a drop
  '💧': '<path d="M12 3.5s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/><path d="M9.2 14.5c0 1.6.9 2.8 2.3 3.2"/>',
  // a shell
  '🐚': '<path d="M12 20 4.5 12a7.5 7.5 0 0 1 15 0Z"/><path d="M12 20V7M12 20 8 9.5M12 20l4-10.5"/>',
  // a pot
  '🏺': '<path d="M9 3.5h6v2.5h-6Z"/><path d="M9.5 6c-4 1.5-5.5 5-4 9 1 2.5 2.5 4.5 3 5.5h7c.5-1 2-3 3-5.5 1.5-4 0-7.5-4-9"/><path d="M6.5 12h11"/>',
  '🏺🧺': '<path d="M9 3.5h6v2.5h-6Z"/><path d="M9.5 6c-4 1.5-5.5 5-4 9 1 2.5 2.5 4.5 3 5.5h7c.5-1 2-3 3-5.5 1.5-4 0-7.5-4-9"/><path d="M6.5 12h11"/>',
  // a flame (the kiln)
  '🏮': '<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-3 2-5 3-7.5 1 1.5 1.5 2.5 1.5 4 1-2 1.5-5 2.5-8 3 3 6 6 6 11.5 0 3.4-2.5 6-6.5 6Z"/><path d="M12 21c-1.8 0-3-1.3-3-3 0-1.5 1.5-2.5 3-4.5 1.5 2 3 3 3 4.5 0 1.7-1.2 3-3 3Z"/>',
  // a hut
  '🏠': '<path d="M3.5 12 12 4l8.5 8"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
  // a hand print: the cave painting
  '🎨': '<path d="M8 13.5V7.2a1.3 1.3 0 0 1 2.6 0V12m0-6.2V4.3a1.3 1.3 0 0 1 2.6 0V12m0-6.6V5.3a1.3 1.3 0 0 1 2.6 0V12m0-4.5a1.3 1.3 0 0 1 2.6 0v6.2c0 4-2.5 6.8-6 6.8-3 0-4.6-1.6-6.4-4.6l-1.9-3.1a1.3 1.3 0 0 1 2.2-1.4L8 13.5"/>',
  // a rod and line
  '🎣': '<path d="M4 20 17 4"/><path d="M17 4c2 3 2 6 .5 9"/><path d="M17.5 13v2.5a2 2 0 0 1-4 0"/><path d="M9 14.5 4 20"/>',
  // meat on the bone
  '🍖': '<path d="M14.5 4.5a5.5 5.5 0 0 1 5 5c0 3.5-3 6-6.5 6.5L8 19.5l-3.5-3.5 3.5-5C8.5 7.5 11 4.5 14.5 4.5Z"/><path d="M6.5 16 4 18.5M8 17.5 5.5 20"/>',
  // a book (the codex button)
  '📖': '<path d="M3.5 5.5c2.5-1 5.5-1 8.5.8v13c-3-1.8-6-1.8-8.5-.8Z"/><path d="M20.5 5.5c-2.5-1-5.5-1-8.5.8v13c3-1.8 6-1.8 8.5-.8Z"/>',
};

const SVG_OPEN = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/** SVG markup for an emoji prompt key, or null when there is no glyph for it. */
export function iconFor(key) {
  const d = P[key];
  return d ? SVG_OPEN + d + '</svg>' : null;
}
