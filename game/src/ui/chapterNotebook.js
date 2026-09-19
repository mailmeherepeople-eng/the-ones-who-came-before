import { S } from '../strings.js';
import { Save } from '../save.js';
import { BOOK_PRACTICE as B, YEARS, fmtYear, gapYears } from '../constants.js';
import { activity } from './activity.js';

export function dateQuestions() {
  return [
    {id:'chandra-century',item:'4.17',q:S.textbook.centuryQ(fmtYear(B.CHANDRAGUPTA)),answer:Math.ceil(B.CHANDRAGUPTA/100),why:S.textbook.centuryReason},
    {id:'chandra-gap',item:'4.14',q:S.textbook.gapQ(fmtYear(YEARS.BUDDHA_BCE),fmtYear(B.CHANDRAGUPTA)),answer:gapYears(YEARS.BUDDHA_BCE,B.CHANDRAGUPTA),why:S.textbook.gapReason},
    {id:'rani-century',item:'4.17',q:S.textbook.centuryQ(fmtYear(B.RANI)),answer:Math.ceil(B.RANI/100),why:S.textbook.centuryReason},
    {id:'rani-gap',item:'4.14',q:S.textbook.gapQ(fmtYear(B.RANI),fmtYear(B.INDEPENDENCE)),answer:B.INDEPENDENCE-B.RANI,why:S.textbook.gapReason},
    {id:'ago',item:'4.14',q:S.textbook.agoQ(B.YEARS_AGO,fmtYear(B.REFERENCE_CE)),answer:B.YEARS_AGO-B.REFERENCE_CE+1,why:S.textbook.agoReason},
    {id:'millennium',item:'4.19',q:S.textbook.millenniumQ,answer:Math.abs(B.EIGHTH_MILLENNIUM_START),why:S.textbook.millenniumReason},
    {id:'century-start',item:'4.17',q:S.textbook.centuryStartQ,answer:B.TWENTIETH_START,why:S.textbook.centuryReason},
    {id:'century-end',item:'4.17',q:S.textbook.centuryEndQ,answer:B.TWENTIETH_END,why:S.textbook.centuryReason},
  ];
}

export function chapterNotebook(root) {
  return new Promise(resolve => {
    const el=document.createElement('div'); el.className='bigpanel chapter-notebook';
    const scope=activity(root,el);
    const add=(tag,text,parent=el)=>{const n=document.createElement(tag);n.textContent=text;parent.appendChild(n);return n;};
    const close=()=>{scope.close();el.remove();resolve();};
    const x=add('button',S.ui.close);x.className='btn small';x.addEventListener('click',close);
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
    add('h2',S.textbook.title); add('p',S.textbook.intro);
    add('h3',S.textbook.dateTitle); add('p',S.textbook.dateIntro);
    const order=add('section','');order.className='claim';add('p',S.textbook.orderPrompt,order);
    const dates=add('div','',order), track=add('p','',order), feedback=add('p','',order);feedback.setAttribute('role','status');
    const validOrder=[...B.ORDER].sort((a,b)=>a-b);
    const count=Math.max(0,Math.min(B.ORDER.length,Save.activity('book-order').count ?? 0));
    const picked=validOrder.slice(0,count);
    function renderOrder(){
      dates.replaceChildren();track.textContent=picked.map(fmtYear).join(' → ');
      const left=B.ORDER.filter(y=>!picked.includes(y));
      if(!left.length){feedback.textContent=S.textbook.orderDone;return;}
      for(const year of left){
        const b=add('button',fmtYear(year),dates);b.className='btn small';
        b.addEventListener('click',()=>{
          const right=year===Math.min(...left);Save.recordRecall('4.21',right);
          if(right){picked.push(year);Save.setActivity('book-order',{count:picked.length});feedback.textContent='';renderOrder();}
          else feedback.textContent=S.textbook.orderHint;
        });
      }
    }
    renderOrder();
    for(const question of dateQuestions()){
      const section=add('section','');section.className='claim';
      const label=add('label',question.q,section),input=add('input','',label);input.type='text';input.inputMode='numeric';input.className='num-input';
      const previous=Save.activity('book-'+question.id); input.value=previous.value ?? '';
      const button=add('button',S.textbook.check,section);button.className='btn small';
      const out=add('p',previous.done?S.textbook.correct:'',section);out.setAttribute('role','status');
      const details=add('details','',section);add('summary',S.revision.evidenceInspect,details);add('p',question.why,details);
      const submit=()=>{
        const raw=input.value.replace(/[,\s]/g,'');
        const right=raw!=='' && Number(raw)===question.answer;
        Save.recordRecall(question.item,right);
        Save.setActivity('book-'+question.id,{done:right,value:input.value});
        out.textContent=right?S.textbook.correct:S.textbook.wrong(question.answer);
        if(!right)details.open=true;
      };
      button.addEventListener('click',submit);input.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
    }
    add('h3',S.textbook.sourceTitle);add('p',S.textbook.sourceIntro);
    for(const [heading,text] of S.textbook.sourceGroups){const section=add('section','');add('h4',heading,section);add('p',text,section);}
    add('p',S.textbook.glossary);add('p',S.textbook.roles);add('p',S.textbook.calendarDetail);
    add('h3',S.textbook.projectsTitle);add('p',S.textbook.projectsIntro);
    for(const [id,title,prompt] of S.textbook.projects){
      const section=add('section','');section.className='claim';add('h4',title,section);
      const label=add('label',prompt,section), field=add('textarea','',label);field.rows=5;field.maxLength=8000;
      field.value=Save.activity('project-'+id).text ?? '';
      const status=add('small','',section);let timer;
      const save=()=>{clearTimeout(timer);Save.setActivity('project-'+id,{text:field.value});status.textContent=S.textbook.notesSaved;};
      field.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(save,350);});
      scope.cleanup(()=>{clearTimeout(timer);if(field.value!==(Save.activity('project-'+id).text ?? ''))save();});
    }
    root.appendChild(el);
  });
}
