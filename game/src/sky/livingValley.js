// An illustrative settlement beside the archaeological site. Two instanced
// draws: buildings/fields and moving people/boats. The dated world-history
// markers remain separate from this fictional valley's changes.
import * as THREE from '../../vendor/three.module.js';
import { VALLEY_YEARS, WORLD, YEARS } from '../constants.js';
import { S } from '../strings.js';
import { SITES, riverX } from '../world/terrain.js';
import { B, isCross } from '../world/blocks.js';

export function valleyPhase(year) {
  return Math.max(0, VALLEY_YEARS.reduce((last, value, i) => year >= value ? i : last, 0));
}

export class LivingValley {
  constructor(G) {
    this.G = G;
    this.group = new THREE.Group();
    this.group.name = 'living-timeline-valley';
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.material = new THREE.MeshLambertMaterial();
    this.fixed = new THREE.InstancedMesh(this.geometry, this.material, 650);
    this.moving = new THREE.InstancedMesh(this.geometry, this.material, 100);
    this.fixed.count = this.moving.count = 0;
    this.fixed.frustumCulled = this.moving.frustumCulled = false;
    this.group.add(this.fixed, this.moving);
    G.renderer.scene.add(this.group);
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.phase = -1; this.clock = 0; this.worldStage = -1;
    this.caption = document.createElement('div');
    this.caption.id = 'valley-life';
    this.caption.innerHTML = '<strong></strong><small></small>';
    this.caption.querySelector('small').textContent = S.skyUI.valleyNote;
    G.hud.root.appendChild(this.caption);
  }

  ground(x, z) {
    const natural = [B.GRASS, B.DIRT, B.SAND, B.PATH, B.FARMLAND, B.MOUND, B.SNOWGRASS, B.ROCK];
    for (let y = WORLD.SIZE_Y - 1; y >= 0; y--) if (natural.includes(this.G.world.get(Math.floor(x),y,Math.floor(z)))) return y + 1;
    return WORLD.WATER_LEVEL + 1;
  }

  box(mesh, x,y,z, w,h,d, color, rotation=0) {
    const i = mesh.count++;
    this.dummy.position.set(x,y+h/2,z);
    this.dummy.scale.set(w,h,d); this.dummy.rotation.set(0,rotation,0); this.dummy.updateMatrix();
    mesh.setMatrixAt(i,this.dummy.matrix); mesh.setColorAt(i,this.color.setHex(color));
  }

  clearFootprints() {
    // Sky-only dressing: remove plants that would protrude through the new
    // houses. Soil, rock, water and archaeological structures stay untouched.
    const sites = [[SITES.timelineHomes,12,22],[SITES.timelineMarket,11,10],[SITES.timelineFields,7,6]];
    const trees = [B.WOOD,B.WOOD_BIRCH,B.LEAVES,B.LEAVES_DARK,B.LEAVES_BRIGHT,B.BUSH,B.BUSH_BARE];
    for(const [site,rx,rz] of sites) for(let x=site.x-rx;x<=site.x+rx;x++) for(let z=site.z-6;z<=site.z+rz;z++) {
      if(x <= SITES.pen.x+3 && z >= SITES.granary.z-4) continue;
      for(let y=this.ground(x,z);y<WORLD.SIZE_Y;y++) {
        const block=this.G.world.get(x,y,z);
        if(trees.includes(block)||isCross(block))this.G.world.set(x,y,z,B.AIR);
      }
    }
  }

  setYear(year, stage) {
    const phase = valleyPhase(year);
    this.year = year;
    if (phase === this.phase && stage === this.worldStage) return;
    this.clearFootprints();
    this.phase = phase; this.worldStage = stage; this.fixed.count = 0;
    this.caption.querySelector('strong').textContent = S.revision.valleyPhases[phase];
    const home = SITES.timelineHomes, market = SITES.timelineMarket, field = SITES.timelineFields;
    const n = phase < 2 ? 2 : Math.min(8, phase + 1);
    for (let i=0;i<n;i++) {
      const x = home.x + (i%3-1)*7, z = home.z + Math.floor(i/3)*7;
      const y = this.ground(x,z), height = phase < 2 ? 1.8 : phase > 6 ? 4 : 2.8;
      this.box(this.fixed,x,y,z,4,height,4,phase > 6 ? 0xcbbf9b : 0xb89665);
      this.box(this.fixed,x,y+height,z,4.8,0.8,4.8,phase > 6 ? 0x995638 : 0x967b3b);
      this.box(this.fixed,x,y+0.1,z+2.03,0.8,1.6,0.08,0x493522);
      if (phase > 5) this.box(this.fixed,x+1.2,y+1.6,z+2.04,0.65,0.7,0.08,0x48636d);
    }
    // Cultivated strips rotate between ripe and newly planted across eras.
    if (phase >= 1) for (let row=0;row<6;row++) for (let k=0;k<12;k++) {
      const x=field.x+row*1.6-4,z=field.z+k*0.7-4,y=this.ground(x,z);
      this.box(this.fixed,x,y+0.02,z,1.3,0.12,0.68,0x654b30);
      this.box(this.fixed,x,y+0.14,z,0.7,phase%2 ? 0.8 : 0.4,0.5,phase%2 ? 0xc8a54b : 0x779342);
    }
    if (phase >= 3) {
      // Paths and awnings make exchange legible from the overhead camera.
      for (let k=0;k<26;k++) {
        const x=market.x+(home.x-market.x)*k/25,z=market.z+(home.z-market.z)*k/25;
        this.box(this.fixed,x,this.ground(x,z)+0.04,z,1.8,0.1,1.3,0xbfa57b);
      }
      for (let i=0;i<Math.min(5,phase-1);i++) {
        const x=market.x+(i%3)*5-5,z=market.z+Math.floor(i/3)*6,y=this.ground(x,z);
        for (const dx of [-1.5,1.5]) this.box(this.fixed,x+dx,y,z,0.2,2.5,0.2,0x694927);
        this.box(this.fixed,x,y+2.5,z,3.7,0.3,3, i%2 ? 0xb66a48 : 0xc7b47e);
        this.box(this.fixed,x,y+0.8,z,2.5,0.25,1.2,0x785633);
      }
    }
    if (phase >= 6) for(let i=0;i<6;i++) {
      // Separated, staggered crowns read as orchard trees from above.
      const z=home.z-3+i*5.5,x=Math.max(home.x-14+(i%2)*2.2,riverX(z)+5),y=this.ground(x,z);
      if (!this.dry(x,z,1.6)) continue;
      const h=2.4+(i%3)*.3, color=[0x537541,0x647e45,0x4b6d3c][i%3];
      this.box(this.fixed,x,y,z,.45,h,.45,0x70502f);
      this.box(this.fixed,x,y+h-.7,z,2.5,1.3,2.3,color);
      this.box(this.fixed,x-.25,y+h+.6,z+.15,1.5,.65,1.6,color);
      this.box(this.fixed,x+1.1,y+h,z+.6,.35,.35,.35,0xbb6a39);
    }
    this.fixed.instanceMatrix.needsUpdate = true;
    if (this.fixed.instanceColor) this.fixed.instanceColor.needsUpdate = true;
  }

  dry(x,z,r=.45) {
    for(const dx of [-r,0,r])for(const dz of [-r,0,r]) {
      const xx=Math.floor(x+dx),zz=Math.floor(z+dz);
      if(this.ground(xx,zz)<=WORLD.WATER_LEVEL+1 || this.G.world.get(xx,WORLD.WATER_LEVEL,zz)===B.WATER)return false;
    }
    return true;
  }
  wet(x,z) { return this.G.world.get(Math.floor(x),WORLD.WATER_LEVEL,Math.floor(z))===B.WATER; }

  update(dt) {
    if (this.phase < 0) return;
    this.clock += dt; this.moving.count=0;
    const a=SITES.timelineHomes,b=SITES.timelineMarket;
    for(let i=0;i<Math.min(10,3+this.phase);i++) {
      const t=(this.clock*0.025+i/10)%1, travel=(1-Math.cos(t*Math.PI*2))/2;
      const z=a.z+(b.z-a.z)*travel;
      const x=Math.max(a.x+(b.x-a.x)*travel+(i%2 ? 2.5 : -2.5),riverX(z)+7);
      if(!this.dry(x,z))continue;
      const y=this.ground(x,z), sway=Math.sin(this.clock*5+i)*0.08;
      this.box(this.moving,x,y+sway,z,0.65,1.1,0.6,i%2 ? 0x9c5435 : 0x466c70);
      this.box(this.moving,x,y+1.1+sway,z,0.5,0.5,0.5,0xb68b62);
      if(this.phase>=4 && i%3===0 && this.dry(x+1.6,z,1.1)) {
        this.box(this.moving,x+1.6,y,z,1.5,0.6,2,0x806039);
        this.box(this.moving,x+1.6,y+0.6,z,1.2,0.6,1.5,0xc5aa70);
      }
    }
    // Local story timing, not a claim that boats were invented in this era.
    if(this.year>=YEARS.INDUS_SARASVATI_BCE) for(let i=0;i<2;i++) {
      const z=48+((this.clock*0.8+i*23)%44),x=riverX(z);
      if(![-.7,.7].every(dx=>[-1.5,0,1.5].every(dz=>this.wet(x+dx,z+dz))))continue;
      this.box(this.moving,x,WORLD.WATER_LEVEL+0.88,z,1.1,0.45,3,0x765436);
      this.box(this.moving,x,WORLD.WATER_LEVEL+1.33,z,0.5,1,0.5,0xaf7044);
    }
    this.moving.instanceMatrix.needsUpdate=true;
    if(this.moving.instanceColor) this.moving.instanceColor.needsUpdate=true;
  }
  dispose() { this.group.removeFromParent(); this.geometry.dispose(); this.material.dispose(); this.caption.remove(); }
}
