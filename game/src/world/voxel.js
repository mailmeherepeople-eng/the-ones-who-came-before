// Voxel world data: one flat Uint8Array, chunked dirty-tracking for remeshing.
import { WORLD } from '../constants.js';
import { B, isSolid, isOpaque } from './blocks.js';

const { SIZE_X: SX, SIZE_Y: SY, SIZE_Z: SZ, CHUNK } = WORLD;
export const CHUNKS_X = Math.ceil(SX / CHUNK);
export const CHUNKS_Z = Math.ceil(SZ / CHUNK);

export class VoxelWorld {
  constructor() {
    this.data = new Uint8Array(SX * SY * SZ);
    this.dirty = new Set(); // chunk keys "cx,cz"
  }

  idx(x, y, z) { return x + z * SX + y * SX * SZ; }

  inBounds(x, y, z) { return x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ; }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return B.AIR;
    return this.data[this.idx(x, y, z)];
  }

  set(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    const i = this.idx(x, y, z);
    if (this.data[i] === id) return;
    this.data[i] = id;
    this.markDirtyAround(x, z);
  }

  // set without dirty tracking — for bulk world builds (caller remeshes all)
  setRaw(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = id;
  }

  // NOTE: bulk write — does NOT mark chunks dirty; callers must remeshAll()
  fill(x0, y0, z0, x1, y1, z1, id) {
    for (let y = Math.max(0, y0); y <= Math.min(SY - 1, y1); y++)
      for (let z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x++)
          this.data[this.idx(x, y, z)] = id;
  }

  markDirtyAround(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const nx = cx + dx, nz = cz + dz;
        // only neighbours when on a chunk border
        if (dx !== 0 && Math.floor((x + dx) / CHUNK) === cx) continue;
        if (dz !== 0 && Math.floor((z + dz) / CHUNK) === cz) continue;
        if (nx >= 0 && nx < CHUNKS_X && nz >= 0 && nz < CHUNKS_Z) this.dirty.add(`${nx},${nz}`);
      }
  }

  markAllDirty() {
    for (let cx = 0; cx < CHUNKS_X; cx++)
      for (let cz = 0; cz < CHUNKS_Z; cz++) this.dirty.add(`${cx},${cz}`);
  }

  // highest solid y at (x,z), or -1
  topAt(x, z) {
    for (let y = SY - 1; y >= 0; y--) {
      if (isSolid(this.get(x, y, z))) return y;
    }
    return -1;
  }

  // highest non-air (incl. water) — for sky-view coloring
  surfaceAt(x, z) {
    for (let y = SY - 1; y >= 0; y--) {
      const id = this.get(x, y, z);
      if (id !== B.AIR) return { y, id };
    }
    return { y: 0, id: B.AIR };
  }

  isOpaqueAt(x, y, z) { return isOpaque(this.get(x, y, z)); }
}
