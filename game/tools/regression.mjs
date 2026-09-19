// Run directly: node game/tools/regression.mjs. No browser or npm packages.
import assert from 'node:assert/strict';
import { Renderer } from '../src/engine/renderer.js';
import { Player } from '../src/player/player.js';
import * as THREE from '../vendor/three.module.js';
import { B } from '../src/world/blocks.js';
globalThis.localStorage = {getItem:()=>null};
const { CODEX, codexText } = await import('../src/codex.js');
import { TEACHABLE } from '../src/syllabus.js';
import { valleyPhase, LivingValley } from '../src/sky/livingValley.js';
import { VALLEY_YEARS, YEARS } from '../src/constants.js';
import { VoxelWorld } from '../src/world/voxel.js';
import { buildStage } from '../src/world/states.js';
import { yearToT, tToYear } from '../src/sky/dial.js';
import { WORLD } from '../src/constants.js';
import { buildBase, SITES, riverX, groundHeight, noise2 } from '../src/world/terrain.js';
import { makeBerryBush, makeBerryPatch } from '../src/world/props.js';
import { propAnchor, setBeacon } from '../src/ui/objective.js';
import { FX } from '../src/fx/fx.js';

globalThis.requestAnimationFrame = () => {};
const referenceBush=makeBerryBush(0,0,0), berryMeshes=[];
referenceBush.group.traverse(m=>{if(m.isMesh)berryMeshes.push(m);});
const berryPatch=makeBerryPatch([{x:24.5,y:10,z:44.5},{x:97.5,y:11,z:143.5,hasBerries:false}]);
assert.equal(berryPatch.group.children.length,2,'All wild bushes use only two draw calls');
berryPatch.group.children.forEach((mesh,i)=>{
  assert.deepEqual(mesh.geometry.attributes.position.array,berryMeshes[i].geometry.attributes.position.array,'Wild bushes use the exact task-bush geometry');
  assert.deepEqual(mesh.geometry.attributes.color.array,berryMeshes[i].geometry.attributes.color.array);
});
const fruit=berryPatch.group.getObjectByName('berryFruit'),foliage=berryPatch.group.getObjectByName('berryFoliage');
const full=new THREE.Matrix4(),empty=new THREE.Matrix4(),leaves=new THREE.Matrix4();
fruit.getMatrixAt(0,full);berryPatch.plants[0].setBerries(false);fruit.getMatrixAt(0,empty);foliage.getMatrixAt(0,leaves);
assert.equal(empty.determinant(),0);assert.ok(Math.abs(leaves.determinant())>.99);
berryPatch.plants[0].setBerries(true);fruit.getMatrixAt(0,empty);assert.deepEqual(empty.elements,full.elements);
fruit.getMatrixAt(1,empty);assert.equal(Math.abs(empty.determinant()),0,'Saved picked plants reload without fruit');
const markedBush=makeBerryBush(24.5,10,44.5),parent=new THREE.Group();parent.position.set(3,2,-1);parent.add(markedBush.group);
const anchor=propAnchor(markedBush);assert.deepEqual(anchor,{x:27.5,y:12.05,z:43.5});
let beaconPosition;const realPillar=FX.pillar;FX.pillar=p=>{beaconPosition=p;return null;};
try{setBeacon({},anchor);assert.deepEqual(beaconPosition,anchor);}finally{FX.pillar=realPillar;}
console.log('PASS berry models share geometry and colours; harvest preserves foliage; beacon follows the actual plant centre and height');
// Expansion must not move the old river or regenerate the established terrain.
assert.equal(WORLD.SIZE_X*WORLD.SIZE_Z,25600);
for(let z=0;z<128;z++) {
  const rx=60+14*Math.sin(z/128*Math.PI*1.35+.9)+3*noise2(z*.07,3.7);
  assert.equal(riverX(z),rx);
  for(let x=0;x<128;x++) {
    let h=7.5+noise2(x*.06,z*.06)*2.2+noise2(x*.16,z*.16)*1.1;
    h-=Math.max(0,3.2-Math.abs(x-rx)*.35);
    const ex=Math.min(x,127-x),ez=127-z;
    if(ex<10)h+=(10-ex)*.55;if(ez<10)h+=(10-ez)*.5;if(z<18)h+=(18-z)*1.15;
    assert.equal(groundHeight(x,z),Math.max(2,Math.min(20,Math.round(h))));
  }
}
const practiceWorld=new VoxelWorld();buildBase(practiceWorld,{ice:true});
for(const site of [SITES.trainingStart,SITES.trainingLight,SITES.trainingBasket]) {
  assert.equal(practiceWorld.get(site.x,9,site.z),B.ROCK_DARK);
  for(let y=10;y<=16;y++)assert.equal(practiceWorld.get(site.x,y,site.z),B.AIR);
  assert.equal(practiceWorld.get(site.x,17,site.z),B.ROCK_DARK);
}
const trainee=new Player(practiceWorld,new THREE.PerspectiveCamera(),new THREE.Scene());
const walking={move:{x:0,y:1},look:{x:0,y:0},jump:false,jumpHeld:false,zoom:0};
trainee.teleport(17,14,Math.PI/2,10.02);
for(let i=0;i<100;i++)trainee.update(1/60,walking);
assert.ok(trainee.pos.x<20,'The teaching obstacle cannot be auto-stepped');
trainee.teleport(17,14,Math.PI/2,10.02);let didJump=false;
for(let i=0;i<120;i++) {
  walking.jump=!didJump&&trainee.pos.x>18.7;if(walking.jump)didJump=true;
  trainee.update(1/60,walking);
}
assert.ok(trainee.pos.x>22 && trainee.onGround,'Real jump physics must clear the sill and land safely');
console.log('PASS larger world preserves every original terrain height and river column; cave headroom and real jump route are traversable');
for (const hz of [30,60,90,120,144]) {
  let seconds=0;
  const r=Object.assign(Object.create(Renderer.prototype),{paused:false,_last:0,_acc:0,_frameInterval:1/30,
    onFrame(dt){seconds+=dt;},_updateSky(){},_render(){}});
  for(let i=1;i<=hz*60;i++) r._loop(i*1000/hz);
  assert.ok(Math.abs(seconds-60)<0.08, `${hz}Hz advanced ${seconds}s`);
}
console.log('PASS simulation time is independent of display refresh');
const camera=new THREE.PerspectiveCamera(), scene=new THREE.Scene();
const player=new Player({get:(x,y)=>y===9||y===15?B.STONE:B.AIR},camera,scene);
player.pos.set(1,10,1);
for(const lift of [0,0.3,0.8]) {
  player._stepLift=lift;player._updateModel(1/30);
  assert.ok(Math.abs(player.model.position.y+player._blobShadow.position.y-10.045)<1e-6);
}
player.pos.y=12;player._updateModel(1/30);
assert.ok(player._blobShadow.material.opacity<0.1);
assert.ok(player.model.position.y+player._blobShadow.position.y<11,'Contact shadow must stay below the cave roof');
const direction=new THREE.Vector3(40,60,20).normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
const lighting=Object.assign(Object.create(Renderer.prototype),{camera,_focus:new THREE.Vector3(),_shadowRight:right,_shadowUp:new THREE.Vector3().crossVectors(direction,right),sun:new THREE.DirectionalLight(),gl:{shadowMap:{needsUpdate:false}}});
lighting.sun.shadow.mapSize.set(1024,1024);
for(let i=0;i<5;i++) {
  camera.position.x=i*0.03;lighting.gl.shadowMap.needsUpdate=false;lighting._followShadow();
  assert.equal(lighting.gl.shadowMap.needsUpdate,true,'Moving light must refresh its depth map on the same frame');
  const cell=lighting.sun.target.position.dot(right)/(28/1024);
  assert.ok(Math.abs(cell-Math.round(cell))<1e-6);
}
console.log('PASS contact shadow stays grounded across body smoothing; rich shadow grid and depth map stay in sync');
assert.deepEqual(new Set(CODEX.map(e=>e.syllabus)), new Set(TEACHABLE.map(e=>e.id)));
for(const e of CODEX) assert.ok(codexText(e.id)?.term && codexText(e.id)?.tells,`Missing notebook text ${e.id}`);
console.log(`PASS all ${TEACHABLE.length} teachable topics have complete notebook entries`);
const {dateQuestions}=await import('../src/ui/chapterNotebook.js');
assert.deepEqual(dateQuestions().map(q=>q.answer),[4,879,19,119,9977,8000,1901,2000]);
console.log('PASS textbook date exercises use the correct reference year and no year zero');
for(let i=0;i<VALLEY_YEARS.length;i++) assert.equal(valleyPhase(VALLEY_YEARS[i]),i);
for(let i=VALLEY_YEARS.length-1;i>=0;i--) assert.equal(valleyPhase(VALLEY_YEARS[i]),i);
assert.equal(tToYear(yearToT(-1)+1),1);
console.log('PASS valley keyframes reverse deterministically; no year zero');

// Test actual generated river footprints, including rewinding to the opening.
const valleyWorld = new VoxelWorld();
let drawings=[];
const valley=Object.assign(Object.create(LivingValley.prototype),{
  G:{world:valleyWorld},clock:0,moving:{count:0,instanceMatrix:{}},
  box(mesh,x,y,z,w,h,d){mesh.count++;drawings.push({x,y,z,w,h,d});},
});
for(const [year,stage,boatsExpected] of [
  [YEARS.SCENE_D_YEAR,3,false],[YEARS.INDUS_SARASVATI_BCE-1,5,false],
  [YEARS.INDUS_SARASVATI_BCE,5,true],[YEARS.TODAY_CE,7,true],[YEARS.SCENE_D_YEAR,3,false],
]) {
  buildStage(valleyWorld,stage,true);valley.year=year;valley.phase=valleyPhase(year);
  let boats=0,walkers=0;
  for(let frame=0;frame<160;frame++) {
    drawings=[];valley.update(.5);
    for(const item of drawings) {
      if(item.h===1.1){walkers++;assert.ok(valley.dry(item.x,item.z),'Walkers must remain on dry ground');}
      if(item.h===.45){boats++;assert.ok([-.7,.7].every(dx=>[-1.5,0,1.5].every(dz=>valley.wet(item.x+dx,item.z+dz))),'Boat hull stays in water');}
    }
  }
  assert.ok(walkers>0,'Life remains visible on land');
  assert.equal(boats>0,boatsExpected,'River travel follows the local story threshold in both directions');
}
console.log('PASS early and rewound rivers have no boats; walkers and later boat hulls remain on valid terrain');
buildStage(valleyWorld,7,true);drawings=[];
valley.fixed={count:0,instanceMatrix:{}};valley.caption={querySelector:()=>({textContent:''})};valley.phase=-1;
valley.setYear(YEARS.TODAY_CE,7);
const trunks=drawings.filter(item=>item.w===.45&&item.d===.45);
assert.ok(trunks.length>=4,'The orchard remains visible as several individual trees');
for(let i=1;i<trunks.length;i++)assert.ok(Math.hypot(trunks[i].x-trunks[i-1].x,trunks[i].z-trunks[i-1].z)>5,'Orchard crowns have visible separation');
console.log('PASS orchard trees remain visible with separated crowns');

// Isolate persistence in a child-free VM, with controllable browser stores.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/save.js',import.meta.url),'utf8')
  .replace(/^import .*;$/gm,'').replaceAll('export ','');
const local=new Map(),durable=new Map(); let quota=false, diskFailure=false;
// Several saves and a reset in one millisecond must still order correctly.
class FixedDate extends Date { static now(){return 5000;} }
const context=vm.createContext({ console, Date:FixedDate, JSON, CustomEvent,
  SAVE_KEY:'test-story',
  localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){if(quota)throw Error('quota');local.set(k,v);},removeItem:k=>local.delete(k)},
  snapshotRead:async k=>durable.get(k),
  snapshotWrite:async(k,v)=>{if(diskFailure)throw Error('blocked');durable.set(k,structuredClone(v));},
});
vm.runInContext(source+'\nglobalThis.testSave = Save;',context);
const save=context.testSave;
await save.ready;
save.addRecord({id:'painting',type:'painting',data:{png:'data:image/png;base64,AAAA'}});
await save.lastWrite;
quota=true;
save.addRecord({id:'pot',type:'pot',data:{mark:'data:image/png;base64,BBBB'}});
assert.equal(await save.lastWrite,true);
assert.equal(durable.get('test-story').records[0].data.png,'data:image/png;base64,AAAA');
assert.equal(durable.get('test-story').records[1].data.mark,'data:image/png;base64,BBBB');
save.data.records=[];
await save.restoreSnapshot();
// A fresh instance reads localStorage first, then chooses the newer snapshot.
vm.runInContext('globalThis.restored = new SaveSystem();',context);
await context.restored.ready;
assert.equal(context.restored.data.records.length,2);
save.reset(); await save.lastWrite;
vm.runInContext('globalThis.resetSave = new SaveSystem();',context);
await context.resetSave.ready;
assert.equal(context.resetSave.data.records.length,0);
diskFailure=true;
assert.equal(await save.persist(),false);
console.log('PASS quota fallback preserves art, reset cannot resurrect old data, total failure is reported');
quota=false; diskFailure=false;
await save.useSlot('student-a'); save.setActivity('gather',{picked:9}); await save.lastWrite;
await save.useSlot('student-b'); assert.equal(save.activity('gather').picked,undefined);
await save.useSlot('student-a'); assert.equal(save.activity('gather').picked,9);
const before=save.export();
await assert.rejects(()=>save.import('{"version":1,"act":1,"beat":"a","records":[{"id":"painting","type":"painting","data":{"png":"javascript:alert(1)"}}],"cards":[]}'));
assert.equal(save.export(),before);
console.log('PASS slot isolation, partial activity persistence and unsafe import rejection');
