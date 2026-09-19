import { Save } from '../save.js';
import { S } from '../strings.js';
import { codexList } from '../codex.js';
import { claimSpecs, potPortrait } from './report.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const picture = url => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url ?? '') ? `<img src="${url}" alt="">` : '';

export function journalHTML() {
  const painting=Save.getRecord('painting'),pot=Save.getRecord('pot');
  const entries=codexList().filter(e=>e.taught);
  const image=potPortrait(pot);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(S.revision.journalTitle)}</title>
    <style>body{font:18px/1.6 Georgia,serif;color:#382b20;background:#f9f2e2;max-width:850px;margin:40px auto;padding:24px}h1,h2{color:#714923}section{break-inside:avoid;border-top:1px solid #bfa985;padding:16px 0}img{max-width:100%;max-height:230px}small{display:block;color:#67553e}.art{display:flex;gap:30px;flex-wrap:wrap}@media print{body{margin:0;background:white;font-size:12pt}h2{break-after:avoid}}</style>
    <h1>${esc(S.revision.journalTitle)}</h1><p>${esc(S.title)}</p>
    <div class="art">${picture(painting?.data?.png)}${picture(image)}${picture(pot?.data?.mark)}</div>
    <h2>${esc(S.act3.reportWeFound)}</h2>${Save.data.cards.map(c=>`<section><h3>${esc(c.title)}</h3><p>${esc(c.tells)}</p><small>${esc(c.specialist)}</small></section>`).join('')}
    <h2>${esc(S.revision.journalClaims)}</h2>${claimSpecs().filter(c=>Save.data.claims[c.id]).map(c=>`<section><h3>${esc(c.text)}</h3><p>${esc(S.act3.verdicts[Save.data.claims[c.id]])}</p><p>${esc(c.result)}</p><small>${(Save.activity('claim-'+c.id).evidence ?? []).map(id=>esc(S.act3.cards[id]?.title ?? id)).join(', ')}</small></section>`).join('')}
    <h2>${esc(S.revision.journalReview)}</h2>${entries.map(e=>`<section><h3>${esc(e.text.term)}</h3><p>${esc(e.text.tells)}</p><small>${esc(e.mastered?S.revision.journalKnown:S.revision.journalPending)}</small></section>`).join('')}
    <h2>${esc(S.textbook.projectsTitle)}</h2>${S.textbook.projects.map(([id,title,prompt])=>`<section><h3>${esc(title)}</h3><p>${esc(prompt)}</p><p style="white-space:pre-wrap">${esc(Save.activity('project-'+id).text ?? '')}</p></section>`).join('')}
    </html>`;
}
export function downloadJournal() {
  const url=URL.createObjectURL(new Blob([journalHTML()],{type:'text/html;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download='my-history-field-journal.html'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
