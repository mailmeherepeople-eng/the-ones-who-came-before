// Non-voxel props: campfire, pots, baskets, flags, shelves, graves, lanterns,
// boulders, driftwood, cattails, butterflies, dust motes.
// Cheap primitives only; every factory returns { group, update? }.
import * as THREE from '../../vendor/three.module.js';

const MAT = {
  wood: new THREE.MeshLambertMaterial({ color: 0x6d5028 }),
  woodDark: new THREE.MeshLambertMaterial({ color: 0x4c3a1e }),
  woodPale: new THREE.MeshLambertMaterial({ color: 0xb5a688 }),
  stone: new THREE.MeshLambertMaterial({ color: 0x777777 }),
  stoneDark: new THREE.MeshLambertMaterial({ color: 0x4a443b }),
  moss: new THREE.MeshLambertMaterial({ color: 0x5e7a3d }),
  clay: new THREE.MeshLambertMaterial({ color: 0xb4633e }),
  clayDark: new THREE.MeshLambertMaterial({ color: 0x8d4c30 }),
  reed: new THREE.MeshLambertMaterial({ color: 0xc9a866, side: THREE.DoubleSide }),
  reedDark: new THREE.MeshLambertMaterial({ color: 0xb08f52, side: THREE.DoubleSide }),
  flame: new THREE.MeshBasicMaterial({ color: 0xff9d3c }),
  flameCore: new THREE.MeshBasicMaterial({ color: 0xffe08a }),
  ember: new THREE.MeshBasicMaterial({ color: 0xffb066 }),
  mote: new THREE.MeshBasicMaterial({ color: 0xd8cfae, transparent: true, opacity: 0.55, depthWrite: false }),
  bone: new THREE.MeshLambertMaterial({ color: 0xe8e0cc }),
  shell: new THREE.MeshLambertMaterial({ color: 0xf2e3c9 }),
  obsidian: new THREE.MeshLambertMaterial({ color: 0x232028 }),
  cloth: new THREE.MeshLambertMaterial({ color: 0xa0563c }),
  flag: new THREE.MeshLambertMaterial({ color: 0xd94f30, side: THREE.DoubleSide }),
  metal: new THREE.MeshLambertMaterial({ color: 0xb87333 }),
  cattail: new THREE.MeshLambertMaterial({ color: 0x6b4a2a }),
  stem: new THREE.MeshLambertMaterial({ color: 0x5f7d3a }),
  bflyA: new THREE.MeshBasicMaterial({ color: 0xe8a33c, side: THREE.DoubleSide }),
  bflyB: new THREE.MeshBasicMaterial({ color: 0x7fb2e0, side: THREE.DoubleSide }),
  bflyC: new THREE.MeshBasicMaterial({ color: 0xe86f5e, side: THREE.DoubleSide }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x4c7a2f }),
  leafLight: new THREE.MeshLambertMaterial({ color: 0x5e8f3a }),
  leafDark: new THREE.MeshLambertMaterial({ color: 0x3f6b28 }),
  berry: new THREE.MeshLambertMaterial({ color: 0xc03030 }),
  berryBright: new THREE.MeshLambertMaterial({ color: 0xd8484f }),
  meat: new THREE.MeshLambertMaterial({ color: 0x9e3f34 }),
  meatDark: new THREE.MeshLambertMaterial({ color: 0x7e2f27 }),
};

function grp(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  return g;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function makeCampfire(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'campfire';
  for (let i = 0; i < 4; i++) {
    const log = box(0.9, 0.14, 0.16, MAT.woodDark);
    log.rotation.y = (i / 4) * Math.PI;
    log.position.y = 0.08;
    g.add(log);
  }
  const stones = 6;
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2;
    g.add(box(0.2, 0.16, 0.2, MAT.stone, Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62));
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 5), MAT.flame);
  flame.position.y = 0.5;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), MAT.flameCore);
  core.position.y = 0.42;
  g.add(flame, core);
  // drifting embers
  const embers = [];
  for (let i = 0; i < 6; i++) {
    const e = box(0.045, 0.045, 0.045, MAT.ember);
    e.userData = {
      off: Math.random(),
      speed: 0.55 + Math.random() * 0.5,
      ax: Math.random() * Math.PI * 2,
    };
    g.add(e);
    embers.push(e);
  }
  const light = new THREE.PointLight(0xff9d3c, 6, 9);
  light.position.y = 0.9;
  g.add(light);
  let t = Math.random() * 10;
  return {
    group: g,
    update(dt) {
      t += dt;
      const s = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.06;
      flame.scale.set(s, s, s);
      core.scale.set(2 - s, s, 2 - s);
      light.intensity = 5 + Math.sin(t * 13) * 1.2;
      for (const e of embers) {
        const u = e.userData;
        const f = (t * u.speed + u.off) % 1;
        e.position.set(
          Math.sin(t * 1.7 + u.ax) * 0.16 * (0.4 + f),
          0.55 + f * 1.5,
          Math.cos(t * 1.4 + u.ax) * 0.16 * (0.4 + f)
        );
        const k = Math.max(0.15, 1 - f);
        e.scale.set(k, k, k);
      }
    },
  };
}

// pot from a saved profile (8 radii bottom→top) + optional mark texture
export function makePot(record, scale = 0.5) {
  const prof = record?.data?.profile ?? [0.32, 0.5, 0.62, 0.66, 0.6, 0.45, 0.34, 0.38];
  const pts = prof.map((r, i) => new THREE.Vector2(Math.max(0.05, r), (i / (prof.length - 1)) * 1.1));
  const geo = new THREE.LatheGeometry(pts, 10);
  const mat = MAT.clay.clone();
  if (record?.data?.mark) {
    // mark is applied as a small decal plane in front of the pot instead of UV work
  }
  const pot = new THREE.Mesh(geo, mat);
  pot.scale.setScalar(scale);
  const g = new THREE.Group();
  g.name = 'pot';
  g.add(pot);
  if (record?.data?.mark) {
    const tex = new THREE.TextureLoader().load(record.data.mark);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dec = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42 * scale * 2, 0.42 * scale * 2),
      new THREE.MeshLambertMaterial({ map: tex, transparent: true })
    );
    const rMid = Math.max(...prof) * scale;
    dec.position.set(0, 0.55 * scale * 1.1 * 2 * 0.5, rMid + 0.012);
    g.add(dec);
  }
  return { group: g };
}

export function makeBasket(scale = 0.5) {
  const g = new THREE.Group();
  g.name = 'basket';
  // coiled weave: stacked, slightly offset open rings read as basketry
  const rings = 4;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const r = (0.34 + t * 0.16) * scale;
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.012 * scale, r - 0.012 * scale, 0.16 * scale, 8, 1, true),
      (i % 2 ? MAT.reedDark : MAT.reed)
    );
    ring.position.y = (0.08 + i * 0.15) * scale;
    ring.rotation.y = i * 0.39; // stagger facets → woven silhouette
    g.add(ring);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5 * scale, 0.035 * scale, 5, 8), MAT.reedDark);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.66 * scale;
  g.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * scale, 0.34 * scale, 0.05 * scale, 8), MAT.reed);
  base.position.y = 0.02;
  g.add(base);
  return { group: g };
}

export function makeShelf(x, y, z, ry = 0) {
  const g = grp(x, y, z);
  g.name = 'shelf';
  g.rotation.y = ry;
  g.add(box(1.6, 0.08, 0.6, MAT.wood, 0, 0.55, 0));
  g.add(box(0.1, 0.55, 0.5, MAT.woodDark, -0.7, 0.27, 0));
  g.add(box(0.1, 0.55, 0.5, MAT.woodDark, 0.7, 0.27, 0));
  // trim: back rail + lip so it reads as joinery, not floating planks
  g.add(box(1.6, 0.1, 0.06, MAT.woodDark, 0, 0.64, -0.27));
  g.add(box(1.44, 0.05, 0.05, MAT.woodDark, 0, 0.53, 0.28));
  return { group: g };
}

export function makeKnapStation(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'knapStation';
  g.add(box(0.9, 0.5, 0.9, MAT.stone, 0, 0.25, 0));
  g.add(box(0.3, 0.18, 0.3, MAT.obsidian, 0.15, 0.6, 0.1));
  // flake scatter around the work stone
  g.add(box(0.12, 0.04, 0.1, MAT.obsidian, -0.55, 0.02, 0.3));
  g.add(box(0.09, 0.04, 0.12, MAT.obsidian, 0.5, 0.02, -0.45));
  g.add(box(0.1, 0.04, 0.08, MAT.stone, -0.4, 0.02, -0.5));
  return { group: g };
}

export function makeFlag(x, y, z, mat = MAT.flag) {
  const g = grp(x, y, z);
  g.name = 'flag';
  g.add(box(0.06, 1.6, 0.06, MAT.wood, 0, 0.8, 0));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.34), mat);
  cloth.position.set(0.32, 1.35, 0);
  g.add(cloth);
  let t = 0;
  return { group: g, update(dt) { t += dt; cloth.rotation.y = Math.sin(t * 2.4) * 0.3; } };
}

export function makeGraveMound(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'graveMound';
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), MAT.stone);
  mound.scale.set(1, 0.42, 0.65);
  g.add(mound);
  return { group: g };
}

export function makeBeads(scale = 1) {
  const g = new THREE.Group();
  g.name = 'beads';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 1.2 - Math.PI * 0.1;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 * scale, 6, 5), MAT.shell);
    b.position.set(Math.cos(a) * 0.22 * scale, 0.05, Math.sin(a) * 0.22 * scale);
    g.add(b);
  }
  return { group: g };
}

export function makeShellPickup(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'shellPickup';
  const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.1, 7), MAT.shell);
  s.rotation.x = Math.PI;
  s.position.y = 0.06;
  g.add(s);
  return { group: g, update(dt) { s.rotation.y += dt; } };
}

export function makeStoneTool(kind = 'axe') {
  const g = new THREE.Group();
  g.name = 'stoneTool';
  if (kind === 'axe') {
    g.add(box(0.08, 0.5, 0.08, MAT.wood, 0, 0.25, 0));
    g.add(box(0.22, 0.16, 0.06, MAT.stone, 0.08, 0.46, 0));
  } else if (kind === 'blade') {
    g.add(box(0.06, 0.3, 0.04, MAT.stone, 0, 0.15, 0));
  } else {
    g.add(box(0.05, 0.12, 0.03, MAT.stone, 0, 0.06, 0));
  }
  return { group: g };
}

export function makeCopperBangle() {
  const g = new THREE.Group();
  g.name = 'copperBangle';
  const t = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12), MAT.metal);
  t.rotation.x = Math.PI / 2;
  t.position.y = 0.1;
  g.add(t);
  return { group: g };
}

export function makeCart(x, y, z, ry = 0) {
  const g = grp(x, y, z);
  g.name = 'cart';
  g.rotation.y = ry;
  g.add(box(1.4, 0.12, 0.9, MAT.wood, 0, 0.5, 0));
  g.add(box(0.1, 0.1, 1.0, MAT.woodDark, -0.75, 0.5, 0));
  // trim: side rails and a tail board so the bed reads as a built cart
  for (const dz of [-0.42, 0.42]) g.add(box(1.4, 0.14, 0.06, MAT.woodDark, 0, 0.63, dz));
  g.add(box(0.06, 0.14, 0.9, MAT.woodDark, 0.68, 0.63, 0));
  for (const dx of [-0.45, 0.45]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8), MAT.woodDark);
    w.rotation.z = Math.PI / 2;
    w.position.set(dx, 0.3, 0.5);
    g.add(w);
    const w2 = w.clone();
    w2.position.z = -0.5;
    g.add(w2);
    // hub caps
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 6), MAT.wood);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(dx, 0.3, 0.5);
    g.add(hub);
    const hub2 = hub.clone();
    hub2.position.z = -0.5;
    g.add(hub2);
  }
  return { group: g };
}

export function makeSack() {
  const g = new THREE.Group();
  g.name = 'sack';
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 7, 6), MAT.reed.clone());
  s.scale.y = 1.15;
  s.position.y = 0.3;
  g.add(s);
  return { group: g };
}

export function makeLantern(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'lantern';
  g.add(box(0.16, 0.22, 0.16, MAT.metal, 0, 0.12, 0));
  const light = new THREE.PointLight(0xffd98a, 0, 10);
  light.position.y = 0.3;
  g.add(light);
  return { group: g, light };
}

export function makeFossilPlate(x, y, z, kind = 0) {
  // an engraved-looking plate on the cliff face: a spiral / leaf / fish shape
  const g = grp(x, y, z);
  g.name = 'fossilPlate';
  const plate = box(0.9, 0.9, 0.06, MAT.stone.clone());
  plate.material.color = new THREE.Color(0x9a9284);
  g.add(plate);
  const markMat = new THREE.MeshLambertMaterial({ color: 0x6e675e });
  if (kind === 0) {
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, r = 0.06 + i * 0.05;
      g.add(box(0.1, 0.1, 0.03, markMat, Math.cos(a) * r, Math.sin(a) * r, 0.04));
    }
  } else if (kind === 1) {
    for (let i = -2; i <= 2; i++) g.add(box(0.34 - Math.abs(i) * 0.1, 0.07, 0.03, markMat, 0, i * 0.12, 0.04));
  } else {
    g.add(box(0.4, 0.1, 0.03, markMat, -0.05, 0, 0.04));
    g.add(box(0.12, 0.22, 0.03, markMat, 0.24, 0, 0.04));
  }
  return { group: g };
}

export function makeSurveyFlag(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'surveyFlag';
  g.add(box(0.04, 1.1, 0.04, MAT.bone, 0, 0.55, 0));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ color: 0xff4d2e, side: THREE.DoubleSide }));
  f.position.set(0.17, 0.95, 0);
  g.add(f);
  return { group: g };
}

// ---- world-dressing props (wave-2 agents place these) ----------------------

// low-poly mossy boulder cluster
export function makeBoulder(x, y, z, scale = 1) {
  const g = grp(x, y, z);
  g.name = 'boulder';
  const main = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * scale, 0), MAT.stone);
  main.scale.set(1, 0.72, 0.88);
  main.rotation.y = (x * 7 + z * 13) % 3.1;
  main.position.y = 0.3 * scale;
  g.add(main);
  const side = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * scale, 0), MAT.stoneDark);
  side.scale.set(1, 0.7, 1);
  side.position.set(0.5 * scale, 0.14 * scale, -0.25 * scale);
  side.rotation.y = 1.1;
  g.add(side);
  const moss = box(0.5 * scale, 0.07 * scale, 0.42 * scale, MAT.moss, -0.08 * scale, 0.62 * scale, 0.05 * scale);
  moss.rotation.y = 0.4;
  g.add(moss);
  return { group: g };
}

// bleached river log with a stub branch
export function makeDriftwood(x, y, z, ry = 0) {
  const g = grp(x, y, z);
  g.name = 'driftwood';
  g.rotation.y = ry;
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 1.5, 6), MAT.woodPale);
  log.rotation.z = Math.PI / 2 - 0.06;
  log.position.y = 0.14;
  g.add(log);
  const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5), MAT.woodPale);
  branch.rotation.z = 0.7;
  branch.position.set(0.35, 0.3, 0.05);
  g.add(branch);
  return { group: g };
}

// swaying cattail cluster for the banks (visual only)
export function makeCattail(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'cattail';
  const stems = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group();
    const h = 0.9 + (i % 2) * 0.25;
    s.add(box(0.045, h, 0.045, MAT.stem, 0, h / 2, 0));
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 6), MAT.cattail);
    head.position.y = h + 0.1;
    s.add(head);
    s.position.set((i - 1) * 0.22, 0, ((i * 7) % 3 - 1) * 0.16);
    s.userData.phase = i * 2.1;
    g.add(s);
    stems.push(s);
  }
  let t = Math.random() * 6;
  return {
    group: g,
    update(dt) {
      t += dt;
      for (const s of stems) s.rotation.z = Math.sin(t * 1.3 + s.userData.phase) * 0.07;
    },
  };
}

// 2–3 tiny butterflies fluttering in a loose orbit
export function makeButterflies(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'butterflies';
  const mats = [MAT.bflyA, MAT.bflyB, MAT.bflyC];
  const flies = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(0.12, 0.09);
    const l = new THREE.Mesh(wingGeo, mats[i % mats.length]);
    const r = new THREE.Mesh(wingGeo, mats[i % mats.length]);
    l.position.x = -0.06;
    r.position.x = 0.06;
    b.add(l, r);
    b.userData = { l, r, phase: i * 2.4, orbit: 0.5 + i * 0.28, hgt: 0.8 + i * 0.35 };
    g.add(b);
    flies.push(b);
  }
  let t = Math.random() * 8;
  return {
    group: g,
    update(dt) {
      t += dt;
      for (const b of flies) {
        const u = b.userData;
        const a = t * (0.5 + u.orbit * 0.3) + u.phase;
        b.position.set(Math.cos(a) * u.orbit, u.hgt + Math.sin(t * 2.2 + u.phase) * 0.16, Math.sin(a * 0.8) * u.orbit);
        b.rotation.y = -a + Math.PI / 2;
        const flap = Math.sin(t * 14 + u.phase) * 0.9;
        u.l.rotation.y = flap;
        u.r.rotation.y = -flap;
      }
    },
  };
}

// slow golden dust drifting in the cave-mouth light shaft
export function makeDustMotes(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'dustMotes';
  const motes = [];
  for (let i = 0; i < 8; i++) {
    const m = box(0.035, 0.035, 0.035, MAT.mote);
    m.userData = {
      off: (i * 0.37) % 1,
      rx: Math.sin(i * 12.3) * 1.1,
      rz: Math.cos(i * 7.7) * 1.1,
      speed: 0.08 + (i % 3) * 0.04,
    };
    g.add(m);
    motes.push(m);
  }
  let t = Math.random() * 20;
  return {
    group: g,
    update(dt) {
      t += dt;
      for (const m of motes) {
        const u = m.userData;
        const f = (t * u.speed + u.off) % 1;
        m.position.set(
          u.rx + Math.sin(t * 0.4 + u.off * 9) * 0.25,
          0.3 + f * 2.2,
          u.rz + Math.cos(t * 0.3 + u.off * 7) * 0.25
        );
      }
    },
  };
}

// small rubble heap for cave walls / dig spoil
export function makeRubblePile(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'rubblePile';
  const spots = [[0, 0.08, 0, 0.3], [0.22, 0.06, 0.14, 0.2], [-0.2, 0.05, -0.1, 0.18], [0.05, 0.05, -0.24, 0.15], [-0.12, 0.16, 0.12, 0.14]];
  spots.forEach(([px, py, pz, s], i) => {
    const r = box(s, s * 0.8, s, i % 2 ? MAT.stoneDark : MAT.stone, px, py, pz);
    r.rotation.y = i * 1.3;
    g.add(r);
  });
  return { group: g };
}

// ---- Act 1 gameplay props ---------------------------------------------------

// shared geometry across all berry-bush / meat instances (module-lived cache)
const BERRY_GEO = new THREE.SphereGeometry(0.07, 6, 5);
const FOLIAGE_GEO = new THREE.IcosahedronGeometry(1, 0); // unit blob, scaled per mesh

// Leafy forage shrub, ~1.2 blocks tall: trunk stub + 3 low-poly foliage blobs
// in different greens + 7 bright berries sitting on the foliage surface.
// API: { group, hasBerries, setBerries(bool) }.
// setBerries(false) hides the berry meshes only — the foliage stays, so a
// picked bush still reads as a bush. hasBerries mirrors the last set value.
export function makeBerryBush(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'berryBush';
  g.rotation.y = (x * 7 + z * 13) % 6.28; // deterministic variety per placement
  g.add(box(0.14, 0.26, 0.14, MAT.woodDark, 0, 0.11, 0)); // trunk stub
  const blobs = [
    [0, 0.68, 0, 0.55, MAT.leaf],
    [0.3, 0.5, 0.18, 0.38, MAT.leafLight],
    [-0.28, 0.55, -0.14, 0.42, MAT.leafDark],
  ];
  for (const [bx, by, bz, s, m] of blobs) {
    const f = new THREE.Mesh(FOLIAGE_GEO, m);
    f.scale.set(s, s * 0.82, s);
    f.position.set(bx, by, bz);
    f.rotation.y = bx * 5 + bz * 3;
    g.add(f);
  }
  // berries scattered over the foliage surface (2 in the brighter red)
  const spots = [
    [0.3, 0.86, 0.3, 0], [-0.36, 0.76, 0.2, 1], [0.46, 0.52, -0.1, 0],
    [-0.16, 0.98, -0.28, 0], [0.1, 1.05, 0.2, 1], [-0.48, 0.5, -0.02, 0],
    [0.2, 0.64, 0.44, 0],
  ];
  const berries = [];
  for (const [px, py, pz, bright] of spots) {
    const b = new THREE.Mesh(BERRY_GEO, bright ? MAT.berryBright : MAT.berry);
    b.position.set(px, py, pz);
    g.add(b);
    berries.push(b);
  }
  const api = {
    group: g,
    hasBerries: true,
    setBerries(v) {
      api.hasBerries = !!v;
      for (const b of berries) b.visible = api.hasBerries;
    },
  };
  return api;
}

// The band's shared store: a real lidded chest (~1.1 × 0.6 × 0.75) with TWO
// states — closed (lid down, contents hidden) and open (lid swung back on its
// hinge, the shared tools visible inside). Front face is +z; a spear stays
// propped against the side in both states so a closed chest still reads as a
// tool store.
//
// API: { group, isOpen, setOpen(v), hold(), releaseHold(), openFor(ms), update(dt) }
//  - setOpen(v)      : drive the lid directly (the tween runs in update)
//  - hold()/release  : refcounted — the chest stays open while anyone is at it
//                      (several NPCs, or an NPC and the player, can overlap)
//  - openFor(ms)     : one-shot open that closes itself again
// The lid pivots at its BACK top edge, so a negative rotation.x swings the
// front of the lid up and back — the natural chest motion.
export function makeCommunityChest(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'communityChest';
  const BODY_Y = 0.07;   // top of the skids
  const BODY_H = 0.46;   // body height
  const LID_Y = BODY_Y + BODY_H;

  // skids, body, plank bands, corner posts
  for (const dz of [-0.28, 0.28]) g.add(box(1.12, 0.07, 0.2, MAT.woodDark, 0, 0.035, dz));
  g.add(box(1.04, BODY_H, 0.7, MAT.wood, 0, BODY_Y + BODY_H / 2, 0));
  for (const by of [0.13, 0.35]) g.add(box(1.07, 0.05, 0.73, MAT.woodDark, 0, BODY_Y + by, 0));
  for (const dx of [-0.5, 0.5]) for (const dz of [-0.33, 0.33])
    g.add(box(0.1, BODY_H, 0.1, MAT.woodDark, dx, BODY_Y + BODY_H / 2, dz));
  g.add(box(0.15, 0.13, 0.05, MAT.bone, 0, LID_Y - 0.11, 0.37)); // antler latch

  // ---- contents: only visible once the lid is up ----
  const inside = new THREE.Group();
  const bskt = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.22, 8, 1, true), MAT.reed);
  bskt.position.set(-0.3, BODY_Y + 0.18, 0.02);
  inside.add(bskt);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 5, 8), MAT.reedDark);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-0.3, BODY_Y + 0.29, 0.02);
  inside.add(rim);
  // bow lying flat across the chest, arrow bundle beside it, rolled hide
  const bow = new THREE.Group();
  bow.add(box(0.05, 0.34, 0.06, MAT.wood, 0, 0, 0));
  const limbT = box(0.045, 0.3, 0.05, MAT.wood, 0, 0.27, 0.04);
  limbT.rotation.x = -0.45;
  const limbB = box(0.045, 0.3, 0.05, MAT.wood, 0, -0.27, 0.04);
  limbB.rotation.x = 0.45;
  bow.add(limbT, limbB);
  bow.add(box(0.014, 0.74, 0.014, MAT.woodDark, 0, 0, 0.14));
  bow.position.set(0.1, BODY_Y + 0.3, -0.04);
  bow.rotation.set(1.15, 0.25, 0.3); // leaning against the back wall, limb proud of the rim
  inside.add(bow);
  for (let i = 0; i < 3; i++) { // arrows stood in the corner like a quiver
    const arrow = box(0.03, 0.62, 0.03, MAT.woodDark, 0.36 + i * 0.06, BODY_Y + 0.3, -0.12 + i * 0.05);
    arrow.rotation.z = 0.1 - i * 0.07;
    inside.add(arrow);
    inside.add(box(0.05, 0.09, 0.05, MAT.bone, 0.36 + i * 0.06, BODY_Y + 0.58, -0.12 + i * 0.05));
  }
  const hide = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 7), MAT.cloth);
  hide.rotation.z = Math.PI / 2;
  hide.position.set(-0.04, BODY_Y + 0.12, 0.22);
  inside.add(hide);
  inside.position.y = 0.14; // ride high so the contents read over the chest lip
  inside.visible = false;
  g.add(inside);

  // ---- lid: pivot group at the back top edge ----
  const lid = new THREE.Group();
  lid.position.set(0, LID_Y, -0.36);
  lid.add(box(1.08, 0.12, 0.74, MAT.wood, 0, 0.06, 0.36));       // slab
  lid.add(box(1.1, 0.05, 0.1, MAT.woodDark, 0, 0.1, 0.71));      // front lip
  for (const dx of [-0.44, 0.44]) lid.add(box(0.07, 0.06, 0.76, MAT.woodDark, dx, 0.12, 0.36)); // straps
  lid.add(box(0.2, 0.07, 0.07, MAT.bone, 0, 0.12, 0.72));        // handle
  g.add(lid);

  // spear propped against the side — dressing in both states
  const spear = new THREE.Group();
  spear.add(box(0.05, 1.5, 0.05, MAT.wood, 0, 0.75, 0));
  spear.add(box(0.09, 0.2, 0.04, MAT.stoneDark, 0, 1.56, 0));
  spear.position.set(0.6, 0, -0.12);
  spear.rotation.z = -0.26;
  g.add(spear);

  const OPEN_ANGLE = -1.95;
  let ang = 0, want = 0, holds = 0, autoT = 0;
  const api = {
    group: g,
    isOpen: false,
    setOpen(v) {
      api.isOpen = !!v;
      want = v ? OPEN_ANGLE : 0;
    },
    hold() { holds++; api.setOpen(true); },
    releaseHold() {
      holds = Math.max(0, holds - 1);
      if (holds === 0 && autoT <= 0) api.setOpen(false);
    },
    openFor(ms = 1400) { autoT = Math.max(autoT, ms / 1000); api.setOpen(true); },
    update(dt) {
      if (autoT > 0) {
        autoT -= dt;
        if (autoT <= 0 && holds === 0) api.setOpen(false);
      }
      if (Math.abs(want - ang) > 0.001) {
        ang += (want - ang) * Math.min(1, 9 * dt);
        lid.rotation.x = ang;
        inside.visible = ang < -0.55; // contents appear once the lid is clear of them
      }
    },
  };
  return api;
}

// name kept for older call sites
export const makeCommunityBox = makeCommunityChest;

// Meat pickup: a haunch (meat-red boxes + bone with a cream cap) that bobs
// and spins so it reads as collectible. API: { group, update(dt) }.
export function makeMeat(x, y, z) {
  const g = grp(x, y, z);
  g.name = 'meat';
  const inner = new THREE.Group();
  inner.add(box(0.28, 0.22, 0.2, MAT.meat, 0, 0, 0));         // haunch
  inner.add(box(0.18, 0.14, 0.15, MAT.meatDark, 0.14, -0.03, 0)); // shank
  const boneShaft = box(0.05, 0.24, 0.05, MAT.bone, -0.14, 0.18, 0);
  boneShaft.rotation.z = 0.35;
  inner.add(boneShaft);
  inner.add(box(0.1, 0.07, 0.1, MAT.bone, -0.22, 0.3, 0));    // bone-cream cap
  inner.position.y = 0.28;
  g.add(inner);
  let t = Math.random() * 6;
  return {
    group: g,
    update(dt) {
      t += dt;
      inner.position.y = 0.28 + Math.sin(t * 2.2) * 0.06;
      inner.rotation.y += dt * 1.4;
    },
  };
}

export const PROP_MATS = MAT;

// Dispose a group's GPU resources: geometries always; materials/textures only
// when not from the shared pool above.
const SHARED_MATS = new Set(Object.values(MAT));
export function disposeGroup(scene, group) {
  scene.remove(group);
  group.traverse?.((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (SHARED_MATS.has(m)) continue;
      m.map?.dispose?.();
      m.dispose?.();
    }
  });
}
