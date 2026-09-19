import { S } from '../strings.js';
import { fmtYear } from '../constants.js';
import { yearToT, tToYear } from './dial.js';
import { Settings } from '../settings.js';
import { Save } from '../save.js';
import { openDiscovery, discoveryCount } from './discoveries.js';

export const TIME_SPEEDS = [1, 10, 100, 250, 500];

// Act-local UI owner. Lessons keep their existing progression and saved beats.
export class SkyInterface {
  constructor(G, dial) {
    this.G = G; this.dial = dial; this.speed = 100; this.direction = 1; this.playing = false; this.playbackAllowed = false;
    const root = G.hud.root, text = S.skyUI;
    this.el = document.createElement('aside'); this.el.id = 'sky-notebook';
    this.el.setAttribute('aria-label', text.notebook);
    this.el.innerHTML = `<div class="sky-eyebrow">${text.eyebrow}</div><h2>${text.title}</h2>
      <div class="sky-pages"><p class="sky-intro">${text.compactIntro}</p><div class="sky-objective"></div>
      <section class="sky-context"><small></small><h3></h3><p></p></section></div>`;
    root.append(this.el);
    this.el.querySelector('.sky-objective').append(G.hud.objectiveEl);
    G.hud.narrationRoot = null;
    this.evidence = document.createElement('aside'); this.evidence.id = 'sky-evidence';
    this.evidence.setAttribute('aria-label',text.underground);
    this.evidence.innerHTML = `<div class="sky-eyebrow">${text.beneathSoil}</div>`;
    root.append(this.evidence);
    this.context = this.el.querySelector('.sky-context');
    this.collection = document.createElement('button'); this.collection.className='sky-collection';
    this.collection.setAttribute('aria-label',S.discoveries.next); this.el.append(this.collection);
    this.collection.title=S.discoveries.next;
    this.updateCollection();
    this.collection.onclick=()=>{
      if(!this.playbackAllowed || !dial.canInteract()) return;
      const candidates=dial.markers.filter(m=>m.id&&!Save.activity('history-'+m.id).done);
      candidates.sort((a,b)=>Math.abs(a.t-dial.t)-Math.abs(b.t-dial.t));
      if(candidates[0]) dial.selectMarker(candidates[0]);
    };
    this.watch = document.createElement('div'); this.watch.id = 'sky-watch';
    this.watch.innerHTML = `<div class="sky-watch-title">${text.watchTitle}</div>
      <div class="sky-transport"><button id="sky-rewind" aria-label="${text.rewind}" aria-pressed="false">◀◀</button>
      <button id="sky-play" aria-label="${text.play}" aria-pressed="false">▶</button>
      <button id="sky-forward" aria-label="${text.forward}" aria-pressed="true">▶▶</button></div>
      <div id="sky-speeds"><input id="sky-speed" type="range" min="0" max="4" step="1" value="2" aria-label="${text.speedTitle}">
      <div class="sky-speed-labels">${TIME_SPEEDS.map((speed,i)=>`<button data-speed="${speed}" data-index="${i}" aria-label="${text.speedChoice(speed)}">${speed}×</button>`).join('')}</div></div><p class="sky-rate"></p>`;
    dial.el.append(this.watch);
    this.playButton = this.watch.querySelector('#sky-play'); this.speedPanel = this.watch.querySelector('#sky-speeds');
    this.speedInput = this.watch.querySelector('#sky-speed');
    this.rewindButton = this.watch.querySelector('#sky-rewind'); this.forwardButton = this.watch.querySelector('#sky-forward');
    this.playButton.onclick = () => {
      if (!this.playbackAllowed || !dial.canInteract() || dial.lockStep !== null) return;
      if (this.playing) { this.pause(true); return; }
      if (this.atEnd()) return;
      this.closeDate(); this.playing = true; this.dial.el.classList.add('time-running');
      this.playButton.textContent = 'Ⅱ'; this.playButton.setAttribute('aria-label',text.pause); this.playButton.setAttribute('aria-pressed','true');
      dial.statusEl.textContent = text.moving;
    };
    this.rewindButton.onclick = () => this.setDirection(-1);
    this.forwardButton.onclick = () => this.setDirection(1);
    this.speedInput.oninput = () => { this.speed = TIME_SPEEDS[Number(this.speedInput.value)]; this.updateRate(); };
    this.watch.querySelectorAll('[data-speed]').forEach(button => button.onclick = () => {
      this.speedInput.value = button.dataset.index; this.speedInput.oninput();
    });
    this.editor = document.createElement('form'); this.editor.id = 'sky-date-editor'; this.editor.hidden = true;
    this.editor.innerHTML = `<div class="sky-panel-heading"><label for="sky-exact-year">${text.dateTitle}</label><button type="button" class="sky-close" aria-label="${S.ui.close}">×</button></div>
      <div class="sky-date-fields"><input id="sky-exact-year" inputmode="numeric" autocomplete="off" aria-label="${text.yearNumber}"><select aria-label="${text.era}"><option value="bce">${text.bce}</option><option value="ce">${text.ce}</option></select><button class="btn" type="submit">${text.go}</button></div><p role="status"></p>`;
    dial.el.append(this.editor);
    dial.yearEl.setAttribute('aria-controls', 'sky-date-editor'); dial.yearEl.setAttribute('aria-expanded','false');
    dial.yearEl.onclick = () => {
      if (!dial.canInteract() || dial.lockStep !== null) return;
      if (!this.editor.hidden) { this.closeDate(true); return; }
      this.pause(); this.editor.hidden = false; root.classList.add('sky-date-open');
      dial.yearEl.setAttribute('aria-expanded','true');
      this.editor.querySelector('input').value = Math.abs(dial.year);
      this.editor.querySelector('select').value = dial.year < 0 ? 'bce' : 'ce';
      this.editor.querySelector('p').textContent = text.noZero;
      this.editor.querySelector('input').focus(); this.editor.querySelector('input').select();
    };
    this.editor.querySelector('.sky-close').onclick = () => this.closeDate(true);
    this.editor.onsubmit = e => {
      e.preventDefault(); if (!dial.canInteract() || dial.lockStep !== null) return;
      const raw = this.editor.querySelector('input').value.trim().replace(/,/g,'');
      const error = this.editor.querySelector('p');
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) === 0) { error.textContent = text.invalidYear; return; }
      const year = Number(raw) * (this.editor.querySelector('select').value === 'bce' ? -1 : 1);
      const t = yearToT(year);
      if (t < dial.minT || t > dial.maxT) { error.textContent = text.range(fmtYear(tToYear(dial.minT)),fmtYear(tToYear(dial.maxT))); return; }
      dial.setYear(year); dial.settle(); this.closeDate(true);
    };
    this.editor.onkeydown = e => e.stopPropagation();
    this.onEscape = e => {
      if (e.key !== 'Escape') return;
      this.closeDate(true); this.pause(true);
    };
    this.editor.addEventListener('keydown', this.onEscape);
    root.addEventListener('keydown', this.onEscape);
    this.onVisibility = () => { if (document.hidden) this.pause(true); };
    document.addEventListener('visibilitychange', this.onVisibility);
    dial.onInput = () => { this.pause(); this.closeDate(); };
    dial.onYearTick = (count, seconds) => { if (Settings.get('sound')) G.audio?.timelineTicks(count,seconds); };
    dial.isBlocked = () => root.dataset.modal === 'true' || !!root.querySelector('.narrator, #deeptime') || G.mode !== 'sky';
    this.resize = new ResizeObserver(() => {
      root.style.setProperty('--sky-dial-height',dial.el.getBoundingClientRect().height+'px');
      root.style.setProperty('--sky-soil-bottom',(this.evidence.getBoundingClientRect().bottom+8)+'px');
    });
    this.resize.observe(dial.el);
    this.resize.observe(this.evidence);
    this.observer = new MutationObserver(() => {
      if (dial.isBlocked()) { this.pause(); this.closeDate(); }
    });
    this.observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-modal']});
    dial.statusEl.textContent = text.selected;
    this.updateRate(); this.updateYear(dial.year);
  }
  atEnd() { return this.direction === 1 ? this.dial.t >= this.dial.maxT : this.dial.t <= this.dial.minT; }
  setDirection(direction) {
    if (!this.playbackAllowed || !this.dial.canInteract() || this.dial.lockStep !== null) return;
    this.direction = direction; this.closeDate();
    this.rewindButton.setAttribute('aria-pressed',String(direction === -1));
    this.forwardButton.setAttribute('aria-pressed',String(direction === 1));
    this.updateRate(); this.tick(0);
  }
  closeDate(focus = false) {
    if (this.editor.hidden) return;
    this.editor.hidden = true; this.G.hud.root.classList.remove('sky-date-open');
    this.dial.yearEl.setAttribute('aria-expanded','false'); if (focus) this.dial.yearEl.focus();
  }
  pause(soft = false) {
    const wasPlaying = this.playing; this.playing = false; this.dial.el.classList.remove('time-running');
    if (this.playButton.textContent !== '▶') this.playButton.textContent = '▶';
    this.playButton.setAttribute('aria-label',S.skyUI.play);
    this.playButton.setAttribute('aria-pressed','false');
    if (wasPlaying) { if (soft) this.dial.settle(); else this.dial.statusEl.textContent = S.skyUI.selected; }
  }
  updateRate() {
    this.dial.el.dataset.direction=this.direction < 0 ? 'backward' : 'forward';
    this.dial.el.style.setProperty('--flow-speed',Math.max(.6,3-Math.log10(this.speed))+'s');
    this.watch.querySelector('.sky-rate').textContent = S.skyUI.directionRate(this.speed,this.direction < 0);
    this.speedInput.setAttribute('aria-valuetext',S.skyUI.speedChoice(this.speed));
    this.watch.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed',String(Number(b.dataset.speed)===this.speed)));
  }
  tick(dt) {
    const blocked = !this.playbackAllowed || !this.dial.canInteract() || this.dial.lockStep !== null;
    this.playButton.disabled = blocked || (!this.playing && this.atEnd());
    this.rewindButton.disabled = this.forwardButton.disabled = blocked;
    if (blocked) { if (this.playing) this.pause(true); return; }
    if (!this.playing) return;
    const from = this.dial.t, seconds = Math.min(dt,.1);
    this.dial.setT(from + seconds*this.speed*this.direction);
    this.dial.soundYears(from,seconds);
    if (this.atEnd()) this.pause(true);
  }
  setPhase(id) {
    this.discovery?.close(); this.discovery=null;
    this.pause(true); this.closeDate(); this.playbackAllowed = ['a2.p1','a2.scrub'].includes(id);
    this.el.querySelector('h2').textContent = S.skyUI.compactTitles[id] ?? S.skyUI.notebook;
    this.el.querySelector('.sky-intro').textContent = id === 'a2.p4' ? S.skyUI.compactSteps : S.skyUI.compactIntro;
    this.reference = null; this.updateYear(this.dial.year);
    this.updateCollection();
  }
  updateYear(year) {
    if (this.reference && performance.now() < this.reference.until && Math.abs(yearToT(year)-yearToT(this.reference.year)) < 2000) return;
    this.context.querySelector('small').textContent = S.skyUI.observing(fmtYear(year));
    this.context.querySelector('h3').textContent = S.skyUI.compactContextTitle;
    this.context.querySelector('p').textContent = '';
    this.context.querySelector('.sky-discovery-open')?.remove();
  }
  updateCollection() {
    const total=this.dial.markers.filter(m=>m.id).length;
    this.collection.textContent=S.discoveries.count(discoveryCount(),total);
    this.collection.disabled=!this.playbackAllowed || discoveryCount()>=total;
  }
  showEra(marker, selected = false) {
    this.reference = {year:marker.year,until:performance.now()+8000};
    this.context.querySelector('small').textContent = S.skyUI.reference(fmtYear(marker.year));
    this.context.querySelector('h3').textContent = S.discoveries.entries[marker.id]?.title ?? marker.label;
    this.context.querySelector('p').textContent = '';
    this.context.querySelector('.sky-discovery-open')?.remove();
    if(marker.image){
      const button=document.createElement('button');button.className='sky-discovery-open';
      button.setAttribute('aria-label',`${S.discoveries.open}: ${S.discoveries.entries[marker.id]?.title ?? marker.label}`);
      button.innerHTML=`<img src="${marker.image}" alt=""><span>${S.discoveries.entries[marker.id]?.title ?? marker.label} ↗</span>`;
      button.onclick=()=>{if(this.dial.canInteract())this.explore(marker);}; this.context.append(button);
      if(selected) this.explore(marker);
    }
  }
  explore(marker) {
    this.pause(true);this.closeDate();this.discovery?.close();
    this.discovery=openDiscovery(this.G,marker,()=>{this.updateCollection();this.dial.render();});
  }
  dispose() {
    this.discovery?.close();
    this.pause(); this.observer.disconnect(); this.resize.disconnect();
    document.removeEventListener('visibilitychange',this.onVisibility); this.G.hud.root.removeEventListener('keydown',this.onEscape);
    this.G.hud.root.prepend(this.G.hud.objectiveEl); this.G.hud.narrationRoot = null;
    this.G.hud.root.classList.remove('sky-speed-open','sky-date-open','sky-descending');
    this.G.hud.root.style.removeProperty('--sky-dial-height');
    this.G.hud.root.style.removeProperty('--sky-soil-bottom');
    this.el.remove(); this.evidence.remove(); this.watch.remove(); this.editor.remove(); this.dial.onInput = null; this.dial.isBlocked = null; this.dial.onYearTick = null;
  }
}
