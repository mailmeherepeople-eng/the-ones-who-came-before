// Host adapter: everything the (game-agnostic) world editor needs to know about
// THIS game. The editor imports nothing from the game — it only ever talks to
// the object built here, so dropping editor.js + voxel-import.js into another
// three.js project means writing a file like this one and nothing else.
//
// Every capability is optional. Leave a field out and the editor simply hides
// the features that depend on it (no voxel → no Terrain tab, no characters →
// no character tools, and so on).
import * as THREE from '../../vendor/three.module.js';
import * as P from '../world/props.js';
import { Npc, Animal } from '../npc/npc.js';
import { B, BLOCK_DEFS } from '../world/blocks.js';
import { SITES } from '../world/terrain.js';
import { Save } from '../save.js';
import { WORLD, PLAYER } from '../constants.js';

// prop factories that take (x, y, z) — the editor can place these anywhere
const PLACEABLE = [
  'makeCampfire', 'makeCommunityChest', 'makeKnapStation', 'makeShelf', 'makeBerryBush',
  'makeBoulder', 'makeRubblePile', 'makeDriftwood', 'makeCattail', 'makeButterflies',
  'makeDustMotes', 'makeGraveMound', 'makeShellPickup', 'makeMeat', 'makeCart',
  'makeLantern', 'makeFlag', 'makeFossilPlate', 'makeSurveyFlag',
];
// factories that build at the origin — placed by moving the group afterwards
const ORIGIN_PROPS = ['makeBasket', 'makeBeads', 'makeStoneTool', 'makeCopperBangle', 'makeSack', 'makePot'];

export function makeHost(G) {
  // one wrap of the render loop, shared by the editor's tick, time scale and pause
  const subs = [];
  let scale = 1, paused = false;
  const origFrame = G.renderer.onFrame;
  G.renderer.onFrame = (dt) => {
    const real = Math.min(0.25, dt);
    origFrame(paused ? 0 : Math.min(0.25, real * scale));
    for (const fn of subs) fn(real);
  };

  // camera hand-off: while the editor flies, the player's own camera sync AND
  // its wall-unclip probe become no-ops, so the world keeps simulating while
  // the editor owns the viewpoint (the unclip would otherwise shove the camera
  // out of any terrain you fly through)
  let syncBak = null, unclipBak = null;

  return {
    name: 'chapter4',
    scene: G.renderer.scene,
    camera: G.renderer.camera,
    renderer: G.renderer.gl,
    dom: G.renderer.gl.domElement,
    label: () => Save.data.beat || 'scene',

    frame: {
      add: (fn) => subs.push(fn),
      setScale: (s) => { scale = s; },
      setPaused: (p) => { paused = p; },
      get paused() { return paused; },
    },

    cameraControl: {
      take() {
        if (syncBak) return;
        syncBak = G.player.syncCamera;
        unclipBak = G.player._cameraUnclip;
        G.player.syncCamera = () => {};
        G.player._cameraUnclip = () => {};
      },
      release() {
        if (!syncBak) return;
        G.player.syncCamera = syncBak;
        G.player._cameraUnclip = unclipBak;
        syncBak = unclipBak = null;
        G.player._snapCam = true;
        G.player.syncCamera();
      },
      get held() { return !!syncBak; },
    },

    setSky: (skyHex, fogHex) => G.renderer.setSky(skyHex, fogHex),

    input: { setEnabled: (on) => G.input.setEnabled(on) },

    voxel: {
      SX: WORLD.SIZE_X, SY: WORLD.SIZE_Y, SZ: WORLD.SIZE_Z,
      ids: B,
      defs: BLOCK_DEFS,
      name: (id) => Object.keys(B).find((k) => B[k] === id) ?? `#${id}`,
      get: (x, y, z) => G.world.get(x, y, z),
      set: (x, y, z, id) => G.world.set(x, y, z, id),
      topAt: (x, z) => G.world.topAt(x, z),
      remesh: () => G.mesher.flush(Infinity),
      remeshAll: () => G.mesher.remeshAll(),
      // materials the X-ray / wireframe toggles work on
      materials: () => [G.mesher.solidMat, G.mesher.crossMat],
    },

    props: () => G.props,
    removeProp: (p) => {
      if (p.group) P.disposeGroup(G.renderer.scene, p.group);
      G.props = G.props.filter((q) => q !== p);
    },
    addProp: (prop) => { G.renderer.scene.add(prop.group); G.props.push(prop); return prop; },
    propKinds: () => [...PLACEABLE, ...ORIGIN_PROPS].map((k) => k.replace(/^make/, '')),
    spawnProp: (kind, x, y, z) => {
      const fn = P[`make${kind}`];
      if (!fn) throw new Error(`no prop factory "${kind}"`);
      const prop = PLACEABLE.includes(`make${kind}`) ? fn(x, y, z) : fn();
      if (!PLACEABLE.includes(`make${kind}`)) prop.group.position.set(x, y, z);
      if (!prop.group.name) prop.group.name = kind[0].toLowerCase() + kind.slice(1);
      G.renderer.scene.add(prop.group);
      G.props.push(prop);
      return prop;
    },
    // a mesh imported from a file becomes an ordinary prop
    addImported: (group, x, y, z) => {
      group.position.set(x, y, z);
      const prop = { group, imported: true };
      G.renderer.scene.add(group);
      G.props.push(prop);
      return prop;
    },

    characters: () => G.npcs,
    characterKinds: () => ['npc', 'npc-child', 'npc-elder', 'deer', 'goat', 'cattle', 'predator'],
    spawnCharacter: (kind, x, z) => {
      let c;
      if (kind.startsWith('npc')) {
        c = new Npc(G.renderer.scene, G.hud.root, G.renderer.camera, {
          x, z, world: G.world, name: `new${G.npcs.length}`,
          child: kind === 'npc-child', elder: kind === 'npc-elder', wander: 3,
        });
      } else {
        c = new Animal(G.renderer.scene, { kind, x, z, world: G.world, wander: 4 });
      }
      G.npcs.push(c);
      return c;
    },
    removeCharacter: (c) => { c.dispose(); G.npcs = G.npcs.filter((n) => n !== c); },

    sites: () => SITES,
    // the ambient-life scheduler, when the current scene has one
    ambient: () => G.props.find((p) => p.workers),

    player: {
      obj: G.player,
      pos: G.player.pos,
      teleport: (x, z, yaw, y) => G.player.teleport(x, z, yaw ?? G.player.yaw, y),
      model: () => G.player.model,
      tune: PLAYER,          // SPEED / JUMP / GRAVITY / REACH — live-editable
      world: WORLD,          // SIZE_X / SIZE_Y / SIZE_Z — recorded, needs a rebuild
    },

    THREE,
  };
}
