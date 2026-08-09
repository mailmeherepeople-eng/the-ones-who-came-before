// Voxel import for the world editor. Three formats, all drag-and-droppable:
//
//  1. `.vox`  — MagicaVoxel. The usual way to model a blocky object. Z-up in the
//               file, converted to Y-up here.
//  2. `.json` model — hand-writable, no tools needed:
//        { "name": "torch", "scale": 0.1,
//          "cells": [ [0,0,0,"#8a5a3a"], [0,1,0,"#ffcc55"] ] }   // x,y,z,colour
//     or the same with a palette:
//        { "name": "torch", "palette": { "w": "#8a5a3a", "f": "#ffcc55" },
//          "cells": [ [0,0,0,"w"], [0,1,0,"f"] ] }
//  3. `.json` block type — adds a new BLOCK to the painter (a full 1×1×1 cube
//     type the terrain is made of):
//        { "block": "MOSSY_STONE", "top": "#6f7a4a", "side": "#5d6440",
//          "bottom": "#4c5236", "solid": true }
//
// A model becomes a THREE.Group of merged faces with vertex colours — one mesh,
// only the faces that touch empty space, so a 32³ import is still cheap.
import * as THREE from '../../vendor/three.module.js';
import { registerBlock } from '../world/blocks.js';
import { addTile, TILE } from '../world/atlas.js';

const FACES = [
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.55 },
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.72 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.9 },
];

function hexToRgb(h) {
  if (typeof h === 'number') return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
  const s = String(h).replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

/**
 * Build one mesh from a cell list.
 * @param cells [{x,y,z,rgb:[r,g,b]}] in model space (integers)
 * @param opts  { scale = 0.1, center = true }  scale: world units per voxel
 * @returns { group, count, size }
 */
export function cellsToGroup(cells, { scale = 0.1, center = true, name = 'import' } = {}) {
  const filled = new Set(cells.map((c) => `${c.x},${c.y},${c.z}`));
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
  }
  const ox = center ? (minX + maxX + 1) / 2 : 0;
  const oy = center ? minY : 0;             // sit on the ground, not through it
  const oz = center ? (minZ + maxZ + 1) / 2 : 0;

  const pos = [], col = [], idx = [];
  for (const c of cells) {
    for (const f of FACES) {
      if (filled.has(`${c.x + f.d[0]},${c.y + f.d[1]},${c.z + f.d[2]}`)) continue;
      const vi = pos.length / 3;
      for (const cn of f.c) {
        pos.push((c.x + cn[0] - ox) * scale, (c.y + cn[1] - oy) * scale, (c.z + cn[2] - oz) * scale);
        col.push(c.rgb[0] * f.s, c.rgb[1] * f.s, c.rgb[2] * f.s);
      }
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const group = new THREE.Group();
  group.name = name;
  group.add(mesh);
  return {
    group, count: cells.length,
    size: { x: maxX - minX + 1, y: maxY - minY + 1, z: maxZ - minZ + 1 },
  };
}

// ---- MagicaVoxel .vox --------------------------------------------------------
// RIFF-ish: "VOX " + version, then nested chunks. We only need SIZE, XYZI and
// RGBA; everything else (materials, scene graph, layers) is skipped by length.
// MagicaVoxel is Z-up, so (x, y, z)file → (x, z, y)world.
export function parseVox(buffer) {
  const dv = new DataView(buffer);
  const tag = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (tag !== 'VOX ') throw new Error('not a MagicaVoxel .vox file');
  let p = 8; // skip magic + version
  let palette = null;
  const models = [];
  let size = null;

  const readChunk = (end) => {
    while (p < end) {
      const id = String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3));
      const content = dv.getUint32(p + 4, true);
      const children = dv.getUint32(p + 8, true);
      const body = p + 12;
      if (id === 'MAIN') {
        p = body;
        readChunk(body + content + children);
        return;
      }
      if (id === 'SIZE') {
        size = { x: dv.getUint32(body, true), y: dv.getUint32(body + 4, true), z: dv.getUint32(body + 8, true) };
      } else if (id === 'XYZI') {
        const n = dv.getUint32(body, true);
        const voxels = [];
        for (let i = 0; i < n; i++) {
          const o = body + 4 + i * 4;
          voxels.push([dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3)]);
        }
        models.push(voxels);
      } else if (id === 'RGBA') {
        palette = [];
        for (let i = 0; i < 256; i++) {
          const o = body + i * 4;
          palette.push([dv.getUint8(o) / 255, dv.getUint8(o + 1) / 255, dv.getUint8(o + 2) / 255]);
        }
      }
      p = body + content + children;
    }
  };
  readChunk(dv.byteLength);

  if (!models.length) throw new Error('no voxels in that .vox file');
  const voxels = models[0]; // first model only — MagicaVoxel scenes are rare here
  const cells = voxels.map(([x, y, z, ci]) => ({
    x, y: z, z: y, // Z-up → Y-up
    rgb: palette ? palette[(ci - 1) & 255] : fallbackColor(ci),
  }));
  return { cells, size: size ? { x: size.x, y: size.z, z: size.y } : null, hadPalette: !!palette };
}

// MagicaVoxel omits RGBA when the default palette is untouched. Rather than
// carry 256 baked colours, derive a stable, readable hue ramp from the index —
// close enough to judge shape and silhouette, and the status line says so.
function fallbackColor(i) {
  const h = ((i * 37) % 360) / 360, s = 0.45, v = 0.55 + ((i * 13) % 40) / 100;
  const k = (n) => (n + h * 6) % 6;
  const f = (n) => v - v * s * Math.max(0, Math.min(Math.min(k(n), 4 - k(n)), 1));
  return [f(5), f(3), f(1)];
}

// ---- JSON forms --------------------------------------------------------------

export function parseModelJson(obj) {
  const pal = obj.palette || {};
  const cells = (obj.cells || []).map((c) => {
    const [x, y, z, col] = c;
    const raw = pal[col] ?? col ?? '#b0b0b0';
    return { x, y, z, rgb: hexToRgb(raw) };
  });
  if (!cells.length) throw new Error('no "cells" in that model json');
  return { cells, name: obj.name || 'model', scale: obj.scale };
}

// A block definition. Colours alone keep the vertex-coloured path; supply
// `tile` (one 16×16 face for every side) or `tiles: {top, side, bottom}` and the
// block becomes a PAINTED block, meshed against the texture atlas.
// Tiles are row-major arrays of 256 CSS colours (null = transparent).
export function parseBlockJson(obj, reuse = null) {
  const hexNum = (v, fb) => (v == null ? fb : parseInt(String(v).replace('#', ''), 16));
  const top = hexNum(obj.top, 0xb0b0b0);
  let tex = null;
  const tiles = obj.tiles || (obj.tile ? { top: obj.tile, side: obj.tile, bottom: obj.tile } : null);
  if (tiles) {
    const slot = (px, prev) => (px && px.length === TILE * TILE ? addTile(px, prev ?? null) : null);
    tex = {
      top: slot(tiles.top ?? tiles.side, reuse?.top),
      side: slot(tiles.side ?? tiles.top, reuse?.side),
      bottom: slot(tiles.bottom ?? tiles.side ?? tiles.top, reuse?.bottom),
    };
  }
  return registerBlock({
    name: obj.block || obj.name,
    top,
    side: hexNum(obj.side, top),
    bottom: hexNum(obj.bottom, top),
    solid: obj.solid !== false,
    opaque: obj.opaque !== false,
    cross: !!obj.cross,
    accent: obj.accent != null ? hexNum(obj.accent, null) : null,
    crossH: obj.crossH, crossTaper: obj.crossTaper, fleck: obj.fleck,
    tex,
  });
}

// ---- glTF / GLB --------------------------------------------------------------
// The loader is vendored under vendor/gltf/ and imported on demand, so it costs
// nothing until someone actually drops a model in. `.glb` (one self-contained
// file) is the format to use — a `.gltf` that references external .bin/.png
// files cannot resolve them from a drag-and-drop.
let GLTF = null;
async function gltfLoader() {
  if (!GLTF) ({ GLTFLoader: GLTF } = await import('../../vendor/gltf/GLTFLoader.js'));
  return new GLTF();
}

export async function parseGltf(buffer, name) {
  const loader = await gltfLoader();
  const gltf = await new Promise((res, rej) => loader.parse(buffer, '', res, rej));
  const group = gltf.scene;
  group.name = name;
  // normalise: drop it on the origin and report a sensible default scale
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3(); box.getSize(size);
  const centre = new THREE.Vector3(); box.getCenter(centre);
  group.position.set(-centre.x, -box.min.y, -centre.z);
  const wrap = new THREE.Group();
  wrap.name = name;
  wrap.add(group);
  return { group: wrap, size, animations: gltf.animations?.length ?? 0 };
}

/**
 * Route a dropped/selected File to the right parser.
 * @returns {Promise<{kind:'model'|'block', ...}>}
 */
export async function importFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.vox')) {
    const buf = await file.arrayBuffer();
    const { cells, size, hadPalette } = parseVox(buf);
    return { kind: 'model', name: file.name.replace(/\.vox$/i, ''), cells, size, hadPalette };
  }
  if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
    const name = file.name.replace(/\.(glb|gltf)$/i, '');
    const { group, size, animations } = await parseGltf(await file.arrayBuffer(), name);
    return { kind: 'mesh', name, group, size, animations };
  }
  if (lower.endsWith('.json')) {
    const obj = JSON.parse(await file.text());
    if (obj.block || obj.tile || obj.tiles || (obj.top && !obj.cells)) {
      return { kind: 'block', name: obj.block || obj.name, id: parseBlockJson(obj), painted: !!(obj.tile || obj.tiles) };
    }
    const m = parseModelJson(obj);
    return { kind: 'model', name: m.name, cells: m.cells, scale: m.scale, hadPalette: true };
  }
  throw new Error(`${file.name}: use .glb / .vox / .json`);
}
