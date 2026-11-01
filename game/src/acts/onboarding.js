import * as THREE from '../../vendor/three.module.js';
import { SITES, TRAINING_CAVE } from '../world/terrain.js';
import { S } from '../strings.js';
import { Save } from '../save.js';
import { Inv } from '../inventory.js';
import { makeBasket, makeTorch, disposeGroup } from '../world/props.js';
import { syncEquipment } from '../ui/equipment.js';
import { activity } from '../ui/activity.js';
import { SFX } from '../audio.js';
import { FX } from '../fx/fx.js';
import { setBeacon } from '../ui/objective.js';
import { setGlows } from '../world/shade.js';
import { valleyReveal } from '../sky/interstitial.js';

export const TRAINING_STEPS = ['look','forward','back','left','right','jump','basket','equip','stow','ready','exit','camp'];
const text = S.onboarding;
const safeStep = n => Number.isInteger(n) ? Math.max(0,Math.min(TRAINING_STEPS.length-1,n)) : 0;

export function tutorialCheckpoint(step) {
  step = safeStep(step);
  if (step < 2) return { ...SITES.trainingStart, yaw: Math.PI-0.8 };
  if (step < 5) return { ...SITES.trainingLight, yaw: Math.PI };
  if (step === 5) return { ...SITES.trainingJump, x:SITES.trainingJump.x-5, yaw:Math.PI/2 };
  if (step < 10) return { ...SITES.trainingBasket, x:SITES.trainingBasket.x-3, yaw:Math.PI/2 };
  if (step === 10) return { ...SITES.trainingBasket, yaw:Math.PI };
  return { ...SITES.trainingExit, yaw:Math.PI/2 };
}

export function needsOnboarding() {
  const state = Save.activity('onboarding');
  return !state.done && (state.started || (!Save.getRecord('woke') && !Save.getRecord('gathered') && !Save.activity('gather').intro && !Save.activity('campStock').ready));
}

export function dressTrainingShelter(G) {
  const group=new THREE.Group();
  // Low, local bounced light keeps controls legible without lighting the valley.
  for (const [site,intensity] of [[SITES.trainingLight,3],[SITES.trainingBasket,2.5]]) {
    const lamp=new THREE.PointLight(0xffdeb0,intensity,14,1.5);
    lamp.position.set(site.x,14,site.z);group.add(lamp);
  }
  // Lit torches on the walls, all the way out. They stay for the whole of
  // Scene A (clearStage retires props and glows together), so the cave is
  // still lit if the player walks back in after the reveal.
  const glows=[{...SITES.trainingLight,y:12,r:7},{...SITES.trainingBasket,y:12,r:6}];
  for (const t of TRAINING_CAVE.torches) {
    const torch=makeTorch(t.x,12.3,t.z,t.face);
    G.renderer.scene.add(torch.group);G.props.push(torch);glows.push(torch.glow);
  }
  // the vivid style ignores scene lights: the lamps and the torches light it
  setGlows(glows);
  const mat=new THREE.Mesh(new THREE.BoxGeometry(1.7,.06,2.2),new THREE.MeshLambertMaterial({color:0x756042}));
  mat.position.set(SITES.trainingStart.x,10.035,SITES.trainingStart.z);group.add(mat);
  G.renderer.scene.add(group);G.props.push({group,_folded:true});
}

// Completion is based on travel/camera changes, never on key presses alone.
export function practiceMovement(key, inp, distance) {
  const direction = key==='back' ? inp.move.y < -0.3 : key==='left' ? inp.move.x < -0.3 : inp.move.x > 0.3;
  return direction ? Math.min(distance,0.4) : 0;
}

// Small pictures of the controls actually on a phone's screen: the movement
// stick pushed the right way, the Jump and Equip buttons, a finger dragging
// the world. Never arrow keys, which a phone does not have (2026-11-01: "it
// shows movement arrows on the phone. when there are no movement buttons").
const STICK_DIR={forward:'up',back:'down',left:'left',right:'right',jump:'up',exit:'up',camp:'up'};
const DRAG='<span class="ctl-drag"><svg viewBox="0 0 48 32"><path d="M8 16h32M14 10l-6 6 6 6M34 10l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="16" r="6" fill="currentColor" opacity=".55"/></svg></span>';
function touchPictures(key){
  const stick=d=>`<span class="ctl-stick" data-dir="${d}"><i></i></span>`;
  const btn=t=>`<span class="ctl-btn">${t}</span>`;
  if(key==='look')return DRAG;
  if(key==='jump')return stick('up')+btn(text.jumpAction);
  if(key==='basket')return `<span class="ctl-pill">${text.takeBasket}</span>`;
  if(key==='equip'||key==='ready')return btn(text.equipAction);
  if(key==='stow')return btn(text.putAway);
  if(key==='exit'||key==='camp')return stick('up')+DRAG;
  return stick(STICK_DIR[key]??'up');
}

export async function runOnboarding(G) {
  if (!needsOnboarding()) return;
  let step = safeStep(Save.activity('onboarding').step);
  const root=G.hud.root, scene=G.renderer.scene;
  const el=document.createElement('section');
  el.className='training-card';
  el.setAttribute('aria-label',text.title);
  el.innerHTML=`<header><span>${text.title}</span><span class="training-progress"></span><button type="button" class="training-fold" aria-expanded="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></header><div class="training-track"><i></i></div><h2></h2><p class="training-instruction"></p><div class="training-keys" aria-hidden="true"></div><footer><button type="button" class="training-help">${text.help}</button><button type="button" class="training-skip">${text.skip}</button></footer>`;
  // The card folds to its one-line heading (2026-11-01: "the instructions
  // should be collapsible"); a tap on the heading or the chevron opens it.
  const fold=el.querySelector('.training-fold');
  const setFolded=(on)=>{el.classList.toggle('folded',on);fold.setAttribute('aria-expanded',String(!on));fold.setAttribute('aria-label',on?text.unfold:text.fold);};
  setFolded(false);
  fold.onclick=()=>setFolded(!el.classList.contains('folded'));
  el.querySelector('h2').onclick=()=>{if(el.classList.contains('folded'))setFolded(false);};
  const heading=el.querySelector('h2'), instruction=el.querySelector('.training-instruction');
  heading.setAttribute('aria-live','polite');
  root.append(el);
  root.classList.add('training-active');
  G.tutorialActive=true;
  G.hud.hideHint(); G.hud.setObjective(null);
  FX.setMotes(null);
  const group=new THREE.Group();
  scene.add(group);
  const basket=makeBasket(1.2);
  basket.group.position.set(SITES.trainingBasket.x,SITES.trainingBasket.y,SITES.trainingBasket.z);
  group.add(basket.group);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.035,6,40),new THREE.MeshBasicMaterial({color:0xffd99a,transparent:true,opacity:.8,depthWrite:false}));
  ring.rotation.x=-Math.PI/2; group.add(ring);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let resolveDone, finished=false, distance=0, looked=0, jumped=false, idle=0, quiet=0, clock=0;
  let last=G.player.pos.clone(), hintScope=null;
  const done=new Promise(resolve=>{resolveDone=resolve;});
  const getBasket=()=>{
    if(!Inv.has('player','basket')) Inv.move('chest','player','basket',1);
    Inv.selectTool('basket',false);
    syncEquipment(G);
    basket.group.visible=false;
  };
  const pickup={id:'training-basket',...SITES.trainingBasket,r:2.5,prompt:'🧺',label:text.takeBasket,enabled:false,
    onInteract(){ if(TRAINING_STEPS[step]!=='basket') return;getBasket();advance(); }};
  G.interactables.push(pickup);
  const marker=()=>{
    const key=TRAINING_STEPS[step];
    const at=['look','forward','back','left','right'].includes(key) ? SITES.trainingLight
      : key==='jump' ? SITES.trainingJump : key==='exit' ? SITES.trainingExit
      : key==='camp' ? SITES.campA : SITES.trainingBasket;
    ring.position.set(at.x,at.y ?? G.world.topAt(at.x,at.z)+1.05,at.z);
    ring.rotation.set(-Math.PI/2,0,0);
    if(key==='jump') {
      // Mark the near face, not the floor hidden behind a solid obstacle.
      ring.position.set(SITES.trainingJump.x-2.04,11.05,SITES.trainingJump.z-1.5);
      ring.rotation.set(0,Math.PI/2,0);
    }
    ring.visible=!['equip','stow','ready'].includes(key);
    setBeacon(G,key==='camp'?SITES.campA:null);
  };
  const paint=()=>{
    const key=TRAINING_STEPS[step];
    heading.textContent=text[key];
    instruction.textContent=text[`${key}${G.input.isTouch?'Touch':'Key'}`];
    el.querySelector('.training-progress').textContent=text.progress(step+1,TRAINING_STEPS.length);
    el.querySelector('.training-track i').style.width=`${step/TRAINING_STEPS.length*100}%`;
    el.querySelector('.training-keys').innerHTML=G.input.isTouch ? touchPictures(key)
      : ({look:['↔'],forward:['W','↑'],back:['S','↓'],left:['A','←'],right:['D','→'],jump:['W','Space'],basket:['E'],equip:['Q'],stow:['Q'],ready:['Q'],exit:['W','A','S','D'],camp:['W','A','S','D']})[key].map(k=>`<kbd>${k}</kbd>`).join('');
    pickup.enabled=key==='basket';
    el.querySelector('.training-skip').hidden=key==='exit'||key==='camp';
    basket.group.visible=!Inv.has('player','basket');
    distance=0;looked=0;jumped=false;idle=0;last.copy(G.player.pos);
    el.classList.remove('training-nudge');
    marker();
    Save.setActivity('onboarding',{started:true,step});Save.persist();
  };
  function resetPosition(){
    const at=tutorialCheckpoint(step);
    G.player.teleport(at.x,at.z,at.yaw,at.y);
    last.copy(G.player.pos);distance=0;looked=0;jumped=false;
  }
  // The first look at the valley (sky/interstitial.js valleyReveal), once per
  // story: on stepping out of the mouth, or straight after Skip practice,
  // which puts the player at the mouth without the walk.
  const playReveal=()=>{
    if(Save.activity('onboarding').revealSeen) return Promise.resolve();
    Save.setActivity('onboarding',{revealSeen:true});
    return valleyReveal(G,{gentle:!!G.player.gentleCamera||reducedMotion.matches});
  };
  function finish(){
    if(finished)return;
    finished=true;
    Save.setActivity('onboarding',{started:true,done:true,step:TRAINING_STEPS.length});Save.persist();
    resolveDone();
  }
  // Skip practice: the lessons go, the walk out stays (2026-11-01: "pressing
  // skip instructions takes us directly to the outside and that should not be
  // a thing"). You get the basket in hand and the light shows the way out; the
  // valley reveal still plays when you step into the daylight.
  function skip(){
    if(TRAINING_STEPS[step]==='exit'||TRAINING_STEPS[step]==='camp')return;
    if(!Inv.has('player','basket'))getBasket();
    Inv.selectTool('basket',true);syncEquipment(G);
    Save.setActivity('onboarding',{skipped:true});
    step=TRAINING_STEPS.indexOf('exit');
    paint();setFolded(true);
  }
  function advance(){
    SFX.blip();
    step++;
    if(step>=TRAINING_STEPS.length){finish();return;}
    if(TRAINING_STEPS[step]==='camp'){
      // out in the light: the card stays hidden for the whole reveal, then a
      // short breath before it comes back with "find your people"
      quiet=Infinity;el.hidden=true;root.classList.add('training-reveal');FX.setMotes('snow');
      playReveal().then(()=>{quiet=1.2;});
    }
    paint();
  }
  function showHelp(){
    if(hintScope)return;
    const panel=document.createElement('div');panel.className='bigpanel training-help-panel';
    const key=TRAINING_STEPS[step];
    panel.innerHTML=`<h2>${text.helpTitle}</h2><p>${text[key]}</p><div class="training-demo" aria-hidden="true">${el.querySelector('.training-keys').innerHTML}</div><p>${instruction.textContent}</p><p>${text.helpBody}</p><button class="btn primary training-try">${text.closeHelp}</button><button class="btn training-reset">${text.retry}</button>`;
    if(key==='basket'||key==='equip') { const note=document.createElement('p');note.textContent=text.basketNote;panel.insertBefore(note,panel.querySelector('.training-demo')); }
    root.append(panel);hintScope=activity(root,panel,G.input);
    const close=()=>{hintScope?.close();hintScope=null;panel.remove();idle=0;G.input.canvas.focus();};
    panel.querySelector('.training-try').onclick=close;
    panel.querySelector('.training-reset').onclick=()=>{resetPosition();close();};
    panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  }
  el.querySelector('.training-help').onclick=showHelp;
  el.querySelector('.training-skip').onclick=skip;
  // a player who switches phone and computer in Settings sees the right controls at once
  const offTouch=G.input.onTouchChange?.(()=>paint());
  if(step>=7 && !Inv.has('player','basket'))getBasket();
  if(step===7 || step===9) Inv.selectTool('basket',false);
  if(step===8) Inv.selectTool('basket',true);
  syncEquipment(G);
  // Scene A already placed the player. Keep the wake camera's gentle handover.
  paint();
  G.tutorialUpdate=(dt,inp)=>{
    if(finished || !G.input.enabled || root.dataset.modal || document.hidden){last.copy(G.player.pos);return;}
    const p=G.player.pos, travelled=Math.hypot(p.x-last.x,p.z-last.z);last.copy(p);
    clock+=dt;idle+=dt;
    ring.material.opacity=reducedMotion.matches ? .8 : .65+Math.sin(clock*2)*.18;
    if(quiet>0){quiet-=dt;if(quiet<=0){el.hidden=false;root.classList.remove('training-reveal');}return;}
    el.classList.toggle('training-nudge',idle>18);
    const key=TRAINING_STEPS[step];
    el.classList.toggle('training-press',!!(inp.move.x||inp.move.y||inp.jump||inp.equip||inp.look.x));
    let complete=false;
    if(key==='look'){
      looked+=Math.abs(inp.look.x)+Math.abs(inp.look.y);
      const desired=Math.atan2(SITES.trainingLight.x-p.x,-(SITES.trainingLight.z-p.z));
      complete=looked>.08 && Math.abs(Math.atan2(Math.sin(desired-G.player.yaw),Math.cos(desired-G.player.yaw)))<.42;
    }else if(key==='forward'){
      if(inp.move.y>.3)distance+=Math.min(travelled,.4);
      complete=distance>1 && Math.hypot(p.x-SITES.trainingLight.x,p.z-SITES.trainingLight.z)<1.8;
    }else if(['back','left','right'].includes(key)){
      distance+=practiceMovement(key,inp,travelled);complete=distance>1.3;
    }else if(key==='jump'){
      if(p.y>11.3 && p.x>18 && p.x<23)jumped=true;
      complete=jumped && p.x>21.5 && G.player.onGround;
    }else if(key==='basket')complete=Inv.has('player','basket');
    else if(key==='equip'||key==='ready')complete=Inv.equippedTool()==='basket';
    else if(key==='stow')complete=Inv.has('player','basket')&&!Inv.equippedTool();
    else if(key==='exit')complete=p.z>=SITES.trainingExit.z && p.y<15;
    else if(key==='camp')complete=Math.hypot(p.x-SITES.campA.x,p.z-SITES.campA.z)<6;
    if(complete)advance();
  };
  try{await done;}finally{
    hintScope?.close();root.querySelector('.training-help-panel')?.remove();
    G.tutorialUpdate=null;G.tutorialActive=false;offTouch?.();
    G.interactables=G.interactables.filter(o=>o!==pickup);
    root.classList.remove('training-active','training-reveal');el.remove();
    setBeacon(G,null);disposeGroup(scene,group);FX.setMotes('snow');G.hud.hidePrompt();
  }
}
