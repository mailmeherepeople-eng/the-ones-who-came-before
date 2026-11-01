// The great bear: a boss with a home (2026-11-01). The user's rules:
//  - "give a home to the bear. the bear should come out when players go near
//    the bear cave."
//  - "The bear becomes a boss fight. A health bar and everything should be
//    shown of the bear. It should give a Dark souls feel. players should know
//    that a bear is gonna be super difficult to kill. make the bear run at the
//    player if they try to attack it."
//  - "arrows should do 3 damage and the bear's health is 100."
//  - "if we get hit by bear twice, we die. sets the bear at full health
//    again" and you "wake by the fire".
//  - "yes player can win boss fight alone. but very hard. we need to
//    implement a dodging mechanic" (player.dodge(), the Dodge button).
//
// How it plays: the bear sleeps in its den. Come within WAKE of the mouth (or
// shoot it) and it comes out roaring; its name and a long health bar fill the
// bottom of the screen and your two hearts show. It lumbers after you (you can
// outwalk it), rears up before a swipe (the tell: dodge then), and every arrow
// that lands makes it charge straight at you, fast. Lead it far from its den,
// or reach the camp fire, and it goes home keeping its wounds. Two swipes and
// you are down: you wake by the fire and the bear is whole again.
import * as THREE from '../../vendor/three.module.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { FX } from '../fx/fx.js';
import { Sound } from '../sound.js';
import { SFX } from '../audio.js';
import { Animal } from '../npc/npc.js';
import { bodyTarget, ARROW_DAMAGE } from './freebow.js';
import { YEARS } from '../constants.js';

export const BEAR = {
  HEALTH: 100,
  WAKE: 15,          // blocks from the den mouth that wake it
  LEASH: 58,         // past this from the mouth it gives up and goes home
  FIRE_FEAR: 9,      // it will not come this close to the camp fire
  WALK: 3.1,         // the chase: slower than the player's 5.2
  CHARGE: 8.5,       // a charge after an arrow: faster than you, dodge it
  CHARGE_TIME: 1.4,
  CHARGE_COOL: 2.2,
  REACH: 2.5,        // it starts a swipe this close
  SWIPE_REACH: 3.0,  // and the swipe lands inside this
  WINDUP: 0.62,      // the tell: it rears up this long before the swipe
  RECOVER: 0.9,
  PLAYER_HEARTS: 2,
};

export function installBear(G, { den, mouth, fire }) {
  const bear = new Animal(G.renderer.scene, { kind: 'predator', x: den.x, z: den.z, world: G.world, wander: 1, speed: BEAR.WALK });
  bear.frozen = true;
  G.npcs.push(bear);
  let state = 'den', hp = BEAR.HEALTH, hearts = BEAR.PLAYER_HEARTS;
  let t = 0, chargeCool = 0, hurtT = 0, scripted = false;
  const snap = new THREE.Vector3();

  // ---------- the boss bar and the hearts ----------
  const ui = document.createElement('div');
  ui.className = 'boss-ui';
  ui.innerHTML = '<div class="boss-hearts" aria-hidden="true"></div><div class="boss-bar"><b></b><div class="boss-track"><i class="trail"></i><i class="fill"></i></div></div><div class="boss-banner"></div>';
  ui.querySelector('b').textContent = S.bear.name;
  G.hud.root.appendChild(ui);
  const fill = ui.querySelector('.fill'), trail = ui.querySelector('.trail'), heartsEl = ui.querySelector('.boss-hearts'), banner = ui.querySelector('.boss-banner');
  const paint = () => {
    const f = `${Math.max(0, hp / BEAR.HEALTH) * 100}%`;
    fill.style.width = f;
    setTimeout(() => { trail.style.width = f; }, 450); // the chunk you took lingers a moment
    heartsEl.innerHTML = Array.from({ length: BEAR.PLAYER_HEARTS }, (_, i) => `<span class="${i < hearts ? 'on' : ''}"></span>`).join('');
  };
  const showUI = (on) => { ui.classList.toggle('on', on); document.body.classList.toggle('boss-fight', on); };
  const say = (text, ms = 2600) => {
    banner.textContent = text;
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
    clearTimeout(banner._t); banner._t = setTimeout(() => banner.classList.remove('show'), ms);
  };
  paint();

  const target = bodyTarget(() => bear.pos, 1.05, 1.15, {
    bear: true,
    parent: () => bear.fig,
    onArrow(hit, bow, dmg = ARROW_DAMAGE) {
      if (state === 'dead') return;
      if (state === 'den' || state === 'home') wake();
      hp = Math.max(0, hp - dmg);
      hurtT = 0.12;
      paint();
      bow.popup(`-${dmg}`, 1);
      FX.puff(hit.point, { count: 6, size: 0.2, life: 0.4, color: 0x6b4a2e });
      if (hp <= 0) { slain(); return; }
      // "make the bear run at the player if they try to attack it"
      if (chargeCool <= 0 && state === 'out') startCharge();
    },
  });

  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const playerPos = () => G.player.pos;

  function wake() {
    if (state === 'out' || state === 'dead') return;
    state = 'out';
    bear.frozen = false;
    bear.speed = BEAR.WALK;
    bear.followTarget = playerPos();
    Sound.playSfx('bear-roar');
    Sound.playMusic('act1.chase', { fade: 0.4 });
    G.player.addTrauma(0.55);
    FX.puff(bear.pos, { count: 12, size: 0.34, life: 0.7, color: 0xb0a184 });
    hearts = BEAR.PLAYER_HEARTS;
    paint();
    showUI(true);
    say(S.bear.wakes, 2800);
    api.onWake?.();
  }

  function startCharge() {
    state = 'charge';
    t = 0;
    snap.copy(playerPos());
    // run past where you stood, so a dodge to the side makes it miss
    const dx = snap.x - bear.pos.x, dz = snap.z - bear.pos.z, d = Math.hypot(dx, dz) || 1;
    snap.x += (dx / d) * 3; snap.z += (dz / d) * 3;
    bear.speed = BEAR.CHARGE;
    bear.followTarget = snap;
    SFX.thud?.();
    chargeCool = BEAR.CHARGE_COOL;
  }

  function goHome(reason) {
    state = 'home';
    bear.speed = BEAR.WALK;
    bear.followTarget = null;
    bear.goTo(den.x, den.z);
    bear.fig.rotation.x = 0;
    showUI(false);
    Sound.playMusic('act1.camp', { fade: 2.0 });
    api.onGone?.(reason);
  }

  function hitPlayer() {
    if (G.player.invulnerable?.()) { say(S.bear.dodged, 900); return; }
    hearts--;
    paint();
    G.player.addTrauma(0.9);
    G.player.knock?.(bear.pos, 7);
    FX.flash({ x: G.player.pos.x, y: G.player.pos.y + 1, z: G.player.pos.z }, { color: 0xff3a2a, size: 1.6, life: 0.25 });
    document.body.classList.remove('hurt'); void document.body.offsetWidth; document.body.classList.add('hurt');
    if (hearts <= 0) playerDown();
    else say(S.bear.oneMore, 2200);
  }

  async function playerDown() {
    state = 'reset';
    bear.followTarget = null;
    bear.frozen = true;
    showUI(false);
    G.input.setEnabled(false);
    await G.hud.fadeOut(900);
    // the bear goes home whole; you wake by the fire with the band
    hp = BEAR.HEALTH;
    hearts = BEAR.PLAYER_HEARTS;
    paint();
    bear.pos.set(den.x, 0, den.z);
    bear.snapToGround();
    bear.fig.rotation.x = 0;
    state = 'den';
    G.player.teleport(fire.x + 2, fire.z + 2, G.player.yaw);
    Sound.playMusic('act1.camp', { fade: 2.0 });
    await G.hud.fadeIn(900);
    G.input.setEnabled(true);
    await G.hud.narrator(S.bear.wokeByFire);
    api.onGone?.('down');
  }

  function slain() {
    state = 'dead';
    bear.followTarget = null;
    bear.down();
    say(S.bear.slain, 5200);
    banner.classList.add('victory');
    setTimeout(() => { showUI(false); banner.classList.remove('victory'); }, 5400);
    Sound.playMusic('act1.camp', { fade: 3.0 });
    FX.confetti?.({ x: bear.pos.x, y: bear.pos.y + 1.4, z: bear.pos.z }, { count: 30 });
    if (!Save.getRecord('bearSlain')) {
      Save.addRecord({ id: 'bearSlain', type: 'camp', pos: { x: bear.pos.x, z: bear.pos.z }, made: YEARS.SCENE_A_YEAR, data: { label: 'bear' } });
    }
    api.onGone?.('slain');
  }

  const api = {
    _folded: true,
    bear,
    target,
    get state() { return state; },
    get health() { return hp; },
    // the "more meat" errand leads past the den; while it runs, the camp fire
    // ends the chase as it always did
    setScripted(on) { scripted = on; },
    wake,
    onWake: null,
    onGone: null,
    update(dt) {
      if (Save.getRecord('bearSlain') && state !== 'dead') { state = 'dead'; bear.down(); }
      chargeCool = Math.max(0, chargeCool - dt);
      if (hurtT > 0) { hurtT -= dt; bear.body.scale.x = 1 + hurtT; }
      else bear.body.scale.x = 1;
      if (state === 'den') {
        if (G.mode === 'ground' && dist(playerPos(), mouth) < BEAR.WAKE) wake();
        return;
      }
      if (state === 'home') {
        if (dist(bear.pos, den) < 1.2) { state = 'den'; bear.frozen = true; }
        else if (G.mode === 'ground' && dist(playerPos(), mouth) < BEAR.WAKE * 0.6) wake();
        return;
      }
      if (state === 'dead' || state === 'reset') return;
      if (G.mode !== 'ground') return;
      // too far from home, or you made the fire: it gives up
      if (dist(playerPos(), mouth) > BEAR.LEASH && !scripted) { say(S.bear.givesUp, 2400); goHome('leash'); return; }
      if (dist(bear.pos, fire) < BEAR.FIRE_FEAR || dist(playerPos(), fire) < BEAR.FIRE_FEAR - 3) { say(S.bear.fire, 2600); goHome('fire'); return; }
      const d = dist(bear.pos, playerPos());
      t += dt;
      if (state === 'charge') {
        if (d < 1.7) { hitPlayer(); state = 'recover'; t = 0; bear.followTarget = null; bear.speed = BEAR.WALK; return; }
        if (t > BEAR.CHARGE_TIME || dist(bear.pos, snap) < 1.9) { state = 'recover'; t = 0; bear.followTarget = null; bear.speed = BEAR.WALK; }
        return;
      }
      if (state === 'windup') {
        // the tell: up on the hind legs
        bear.fig.rotation.x = -0.55 * Math.min(1, t / 0.25);
        if (t >= BEAR.WINDUP) {
          bear.fig.rotation.x = 0.15;
          SFX.thud?.();
          if (d < BEAR.SWIPE_REACH) hitPlayer();
          if (state === 'windup') { state = 'recover'; t = 0; }
        }
        return;
      }
      if (state === 'recover') {
        bear.fig.rotation.x *= 0.85;
        if (t >= BEAR.RECOVER) { state = 'out'; t = 0; bear.followTarget = playerPos(); }
        return;
      }
      // out: lumbering after you
      bear.followTarget = playerPos();
      if (d < BEAR.REACH) { state = 'windup'; t = 0; bear.followTarget = null; Sound.playSfx('bear-roar', { gain: 0.5 }); }
    },
    dispose() { ui.remove(); document.body.classList.remove('boss-fight', 'hurt'); },
  };
  G.props.push(api);
  return api;
}
