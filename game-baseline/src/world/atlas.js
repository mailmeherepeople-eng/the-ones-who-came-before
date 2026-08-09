// Block texture atlas — the surface painter's backing store.
//
// The world is vertex-coloured by default and stays that way: this atlas only
// exists once something actually asks for a painted face. One 256×256 canvas
// holds 256 tiles of 16×16; a block def that carries `tex: {top, side, bottom}`
// (tile indices) is meshed into a separate textured pass by the chunk mesher,
// so the untextured path is byte-for-byte what it was.
//
// Tiles are plain 16×16 arrays of colour strings (or null for a transparent
// pixel), which is also the on-disk format the editor exports — hand-editable,
// diffable, no binary blobs.
import * as THREE from '../../vendor/three.module.js';

export const TILE = 16;      // pixels per tile edge
export const COLS = 16;      // tiles per atlas row
export const ATLAS_PX = TILE * COLS;

let canvas = null, ctx = null, texture = null, next = 0;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_PX;
  ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);
  texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter; // no mips: neighbouring tiles can't bleed
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
}

export function atlasTexture() { ensure(); return texture; }
export function atlasReady() { return !!canvas; }

/**
 * Paint a tile into the atlas.
 * @param pixels 16×16 row-major array of CSS colours (null/'' = transparent)
 * @param index  reuse an existing slot (repaint in place), or omit for a new one
 * @returns the tile index
 */
export function addTile(pixels, index = null) {
  ensure();
  const i = index ?? next++;
  const ox = (i % COLS) * TILE, oy = Math.floor(i / COLS) * TILE;
  ctx.clearRect(ox, oy, TILE, TILE);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const c = pixels[y * TILE + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  texture.needsUpdate = true;
  return i;
}

// UV rect for a tile, inset by half a texel so nearest sampling can never
// pick up the neighbouring tile's edge column.
const HALF = 0.5 / ATLAS_PX;
export function tileUV(i) {
  const cx = i % COLS, cy = Math.floor(i / COLS);
  const u0 = cx / COLS + HALF, u1 = (cx + 1) / COLS - HALF;
  // CanvasTexture is flipY, so row 0 of the canvas is the TOP of UV space
  const v1 = 1 - cy / COLS - HALF, v0 = 1 - (cy + 1) / COLS + HALF;
  return { u0, v0, u1, v1 };
}

// Solid-colour tile with a little per-pixel grain — the quickest way to make a
// painted block sit next to the hand-textured vertex-coloured ones.
export function grainTile(hex, amount = 0.08) {
  const c = new THREE.Color(hex);
  const out = new Array(TILE * TILE);
  for (let i = 0; i < out.length; i++) {
    const j = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const k = 1 + (j - 0.5) * 2 * amount;
    out[i] = '#' + new THREE.Color(
      Math.min(1, c.r * k), Math.min(1, c.g * k), Math.min(1, c.b * k),
    ).getHexString();
  }
  return out;
}
