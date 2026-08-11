// Wayfinding: the objective line, the cue ring, and the one beacon pillar.
//
// This lived inside acts/act1.js and was module-private to it, which meant act
// 2 and act 3 had no way to point a player at anything and simply went without.
// Moved out verbatim (same behaviour, same numbers, same comments) so the act 2
// and act 3 reworks can call it instead of either reinventing it or reaching
// into act 1 and dragging act 1 into their blast radius.
//
// ISOLATION RULE: no imports from src/acts/.

import { FX } from '../fx/fx.js';

// ground-level anchor at a world column. OUTDOOR COLUMNS ONLY: inside the rock
// shelter topAt reads the cliff above it, so cave callers must pass an explicit
// y (see the `at.y !== undefined` branches below).
export function groundAnchor(G, x, z, dy = 0) {
  return { x, y: G.world.topAt(Math.round(x), Math.round(z)) + 1 + dy, z };
}

// ONE persistent pulsing pillar marks the current objective site (the FX pillar
// pool has 6 slots, and this module owns AT MOST one at a time). Planting a new
// beacon retires the old; objectiveCue with no site (or no text) sweeps it, and
// every scene sweeps on setup/teardown so a beacon can never outlive its beat.
// `at` may carry an explicit y for cave interiors. Always sweep via setBeacon
// BEFORE FX.clear() so this handle never goes stale against a recycled slot.
let beaconH = null;

export function setBeacon(G, at, color = 0xffd28a) {
  if (beaconH) { FX.removeHandle(beaconH); beaconH = null; }
  if (!at) return;
  const p = at.y !== undefined ? { x: at.x, y: at.y, z: at.z } : groundAnchor(G, at.x, at.z);
  // 0.22: at 0.45 the additive column saturates to a blinding white wall when
  // the player stands near it. Distant visibility is still fine.
  beaconH = FX.pillar(p, { color, height: 10, life: 0, opacity: 0.22, pulse: true });
}

// nearest of several candidate sites. Multi-target beats (berries, shells) keep
// the single beacon on the closest remaining target.
export function nearestSite(G, sites) {
  let best = null, bd = Infinity;
  for (const s of sites) {
    const d = Math.hypot(G.player.pos.x - s.x, G.player.pos.z - s.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// objective handoff cue: objective text, a subtle ring at the marker (when the
// target site is known) or under the player, plus the persistent beacon pillar
// at the site. Passing no site (or no text) retires the beacon.
export function objectiveCue(G, text, at = null, color = 0xffe9a8) {
  G.hud.setObjective(text);
  setBeacon(G, text ? at : null, color === 0xffe9a8 ? 0xffd28a : color);
  if (!text) return;
  const p = at
    ? (at.y !== undefined ? { x: at.x, y: at.y, z: at.z } : groundAnchor(G, at.x, at.z))
    : { x: G.player.pos.x, y: G.player.pos.y, z: G.player.pos.z };
  FX.ring(p, { color, radius: 2.0, life: 0.55 });
}
