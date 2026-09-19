import { S } from '../strings.js';
import { YEARS } from '../constants.js';
import { Save } from '../save.js';
import { activity } from '../ui/activity.js';
import { SFX } from '../audio.js';
import { fmtYear } from '../constants.js';

const anchors = {
  rockArt: YEARS.ROCK_ART_BCE, iceAgeEnd: YEARS.ICE_AGE_END_BCE,
  settlements: YEARS.SETTLEMENTS_BCE, pottery: YEARS.POTTERY_BCE,
  mesopotamia: YEARS.MESOPOTAMIA_BCE, copper: YEARS.COPPER_BCE,
  indus: YEARS.INDUS_SARASVATI_BCE, village: YEARS.SCENE_D_YEAR,
  buddha: YEARS.BUDDHA_BCE, ashoka: YEARS.ASHOKA_BCE,
  jesus: YEARS.JESUS_CE, today: YEARS.TODAY_CE,
};
export const historyImage = id => new URL(`../../assets/history/${id}.svg`,import.meta.url).href;
export function historyMarkers() {
  return Object.entries(anchors).map(([id,year]) => ({id,year,
    label: id === 'village' ? S.act2.youMarker : S.act2.eras[id],
    image:historyImage(id), visited:!!Save.activity('history-'+id).done,
  }));
}
export function discoveryCount() { return Object.keys(anchors).filter(id=>Save.activity('history-'+id).done).length; }

// Explicit exploration opens a card. Passing a date never interrupts playback.
export function openDiscovery(G, marker, onFound) {
  const copy = S.discoveries.entries[marker.id];
  if (!copy) return null;
  const el = document.createElement('section'); el.className = 'history-discovery';
  el.setAttribute('aria-label',copy.title);
  el.innerHTML = `<button class="discovery-dismiss" aria-label="${S.ui.close}">×</button><div class="discovery-art"><img src="${marker.image}" alt="${copy.alt}"><span class="discovery-year">${fmtYear(marker.year)}</span></div>
    <div class="discovery-body"><div class="sky-eyebrow">${S.discoveries.heading}</div><h2>${copy.title}</h2>
    <p>${copy.body}${marker.note ? ' '+marker.note : ''}</p><div class="discovery-question"><h3>${S.discoveries.look}</h3><p>${copy.question}</p>
    <div class="discovery-answers">${copy.options.map((o,i)=>`<button class="btn" data-answer="${i}">${o}</button>`).join('')}</div>
    <p class="discovery-feedback" role="status"></p><button class="discovery-reveal">${S.discoveries.reveal}</button></div>
    <div class="discovery-footer"><span class="discovery-stamp"></span><button class="btn primary discovery-close">${S.discoveries.close}</button></div>
    <p class="discovery-art-note">${S.discoveries.artNote} ${S.discoveries.reference}</p></div>`;
  G.hud.root.append(el); const scope = activity(G.hud.root,el,G.input);
  const feedback = el.querySelector('.discovery-feedback'), stamp=el.querySelector('.discovery-stamp');
  const found = () => {
    feedback.textContent = copy.clue; el.querySelector('.discovery-reveal').hidden=true;
    el.querySelectorAll('[data-answer]').forEach(button=>button.disabled=true);
    const already=!!Save.activity('history-'+marker.id).done;
    if(!already){Save.setActivity('history-'+marker.id,{done:true}); SFX.success?.();}
    stamp.textContent = already ? S.discoveries.again : S.discoveries.found;
    stamp.classList.add('stamped'); marker.visited=true; onFound?.();
  };
  if(Save.activity('history-'+marker.id).done) stamp.textContent=S.discoveries.again;
  el.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
    const right=Number(b.dataset.answer)===copy.answer;
    b.classList.toggle('correct',right);
    if(right) found(); else feedback.textContent=S.discoveries.hint;
  });
  el.querySelector('.discovery-reveal').onclick=found;
  const close=()=>{scope.close();el.remove();};
  el.querySelector('.discovery-close').onclick=close;el.querySelector('.discovery-dismiss').onclick=close;
  el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  return {close,el};
}
