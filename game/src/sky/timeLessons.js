import { S } from '../strings.js';
import { YEARS, TIME_PRACTICE, fmtYear, fmtNum, gapYears } from '../constants.js';
import { Save } from '../save.js';
import { activity } from '../ui/activity.js';
import { SFX } from '../audio.js';
import { historyImage } from './discoveries.js';

// User-paced, repeatable experiments. A wrong idea receives a clue, never a timer.
export function runTimeLesson(G,dial,kind) {
  const t=S.timeLearning;
  const pages=kind==='labels' ? [
    {title:t.labelsTitle,text:t.labelsIntro,note:t.labelsNote,labels:true},
    {title:t.bridgeTitle,text:t.bridgeIntro,bridge:TIME_PRACTICE.labels,why:t.bridgeFound},
    {title:t.labelsTitle,text:t.aliasQ,options:t.aliasOptions,answer:0,why:t.aliasWhy,id:'4.12',labels:true},
    {title:t.orderTitle,text:t.orderQ,options:t.orderOptions,answer:1,why:t.orderWhy,id:'4.12'},
  ] : [
    {title:t.gapTitle,text:t.gapIntro,bridge:TIME_PRACTICE.gaps,why:t.gapFound},
    {title:t.formulaTitle,text:t.formulaIntro,formula:t.formulaSmall},
    {title:t.buddhaTitle,text:t.buddhaIntro,worked:true},
    {title:t.practiceTitle,text:t.practiceQ,options:t.practiceOptions,answer:0,why:t.practiceWhy,id:'4.14'},
    {title:t.sameTitle,text:t.sameQ,options:t.sameOptions,answer:1,why:t.sameWhy,id:'4.14'},
    {title:t.finalTitle,text:t.finalQ(fmtYear(YEARS.ASHOKA_BCE),fmtYear(YEARS.TODAY_CE)),number:true,
      answer:gapYears(YEARS.ASHOKA_BCE,YEARS.TODAY_CE),id:'4.14',
      why:t.finalWhy(fmtNum(Math.abs(YEARS.ASHOKA_BCE)),fmtNum(YEARS.TODAY_CE),fmtNum(gapYears(YEARS.ASHOKA_BCE,YEARS.TODAY_CE)))},
  ];
  return new Promise(resolve=>{
    const el=document.createElement('section'); el.className='time-lesson';
    el.innerHTML=`<header><span class="sky-eyebrow">${t.badge}</span><span class="lesson-position"></span></header><div class="lesson-dots"></div><div class="lesson-content"></div><footer><button class="btn lesson-back">${S.ui.back}</button><button class="btn primary lesson-next"></button></footer>`;
    G.hud.root.append(el); const scope=activity(G.hud.root,el,G.input);
    const next=el.querySelector('.lesson-next'),back=el.querySelector('.lesson-back'),content=el.querySelector('.lesson-content');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const animations=new Set(), pageCleanups=[];
    const animate=(node,frames,options={})=>{
      node.getAnimations().forEach(a=>a.cancel());
      if(motion.matches) return;
      const animation=node.animate(frames,{duration:360,easing:'cubic-bezier(.2,.8,.25,1)',...options});
      animations.add(animation);
      animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
    };
    const clearMotion=()=>{animations.forEach(a=>a.cancel());animations.clear();};
    const clearPage=()=>{clearMotion();pageCleanups.splice(0).forEach(fn=>fn());};
    const motionChange=()=>{if(motion.matches)clearMotion();};
    motion.addEventListener('change',motionChange);
    scope.cleanup(()=>{clearPage();motion.removeEventListener('change',motionChange);});
    let index=0; const states=pages.map(()=>({step:0,done:false,feedback:''}));
    const close=()=>{scope.close();el.remove();resolve();};
    const draw=()=>{
      clearPage();
      const p=pages[index],state=states[index];
      el.setAttribute('aria-label',p.title);
      el.querySelector('.lesson-position').textContent=t.progress(index+1,pages.length);
      el.querySelector('.lesson-dots').innerHTML=pages.map((_,i)=>`<i class="${i===index?'filled current':i<index?'filled':''}"></i>`).join('');
      back.disabled=index===0; next.textContent=index===pages.length-1?t.finish:t.next;
      content.innerHTML=`<h2>${p.title}</h2><p class="lesson-intro">${p.text}</p>`;
      const feedback=document.createElement('p');feedback.className='lesson-feedback';feedback.setAttribute('role','status');
      const complete=()=>{state.done=true;next.disabled=false;content.querySelectorAll('.lesson-choices button,.lesson-help,.lesson-answer button,.lesson-answer input').forEach(control=>control.disabled=true);};
      next.disabled=!!(p.bridge||p.worked||p.options||p.number)&&!state.done;
      if(p.labels){
        const labels=document.createElement('div');labels.className='date-passports';
        labels.innerHTML='<span><b>BCE</b><small>BC</small></span><span><b>CE</b><small>AD</small></span>';content.append(labels);
        [...labels.children].forEach((card,i)=>animate(card,[{opacity:.3,transform:'translateY(8px) rotateX(-12deg)'},{opacity:1,transform:'none'}],{delay:i*120,duration:450}));
      }
      if(p.note){const note=document.createElement('p');note.className='lesson-note';note.textContent=p.note;content.append(note);}
      if(p.formula){
        const f=document.createElement('div');f.className='lesson-formula';f.setAttribute('role','math');f.setAttribute('aria-label',p.formula);
        S.timeLearning.formulaPieces.forEach((piece,i)=>{const term=document.createElement('span');term.textContent=piece;term.setAttribute('aria-hidden','true');f.append(term);animate(term,[{opacity:.25,transform:'translateY(9px)'},{opacity:1,transform:'none'}],{delay:i*140,duration:340});});content.append(f);
      }
      if(p.bridge){
        const bridge=document.createElement('div');bridge.className='time-bridge';
        bridge.innerHTML=p.bridge.map((year,i)=>`<span class="bridge-stone" data-stone="${i}"><b>${Math.abs(year)}</b><small>${year<0?S.skyUI.bce:S.skyUI.ce}</small></span>`).join('');
        const traveller=document.createElement('span');traveller.className='bridge-traveller';traveller.setAttribute('aria-hidden','true');
        traveller.innerHTML='<svg viewBox="0 0 28 34"><ellipse cx="14" cy="32" rx="8" ry="2" fill="#0004"/><path d="M11 17 8 29m8-12 5 12M10 13l-6 8m13-8 7 7" stroke="#f8d691" stroke-width="3" stroke-linecap="round"/><path d="M10 11h7l3 10H7z" fill="#dca451"/><circle cx="14" cy="6" r="4.5" fill="#ffe3aa"/></svg>';
        bridge.append(traveller);
        const figure=traveller.querySelector('svg');
        const boundary=p.bridge.findIndex(year=>year>0);
        const crossing=document.createElement('p');crossing.className='bridge-crossing-note';crossing.setAttribute('role','status');
        const placeTraveller=()=>{const stone=bridge.querySelector(`[data-stone="${state.step}"]`);traveller.style.left=(stone.offsetLeft+stone.offsetWidth/2)+'px';};
        const resize=new ResizeObserver(()=>{figure.getAnimations().forEach(a=>a.cancel());placeTraveller();});resize.observe(bridge);pageCleanups.push(()=>resize.disconnect());
        const jump=document.createElement('button');jump.className='btn bridge-jump';jump.textContent=t.later;
        const count=document.createElement('p');count.className='bridge-count';
        const update=(hopping=false)=>{
          const previousX=figure.getBoundingClientRect().left+figure.getBoundingClientRect().width/2-bridge.getBoundingClientRect().left;
          bridge.querySelectorAll('[data-stone]').forEach((stone,i)=>{stone.classList.toggle('crossed',i<state.step);stone.classList.toggle('current',i===state.step);});
          placeTraveller();
          if(hopping){const dx=previousX-parseFloat(traveller.style.left);animate(figure,[{transform:`translate(${dx}px,0)`},{transform:`translate(${dx*.5}px,-22px) rotate(-9deg)`,offset:.48},{transform:'none'}],{duration:430});
            const landing=bridge.querySelector(`[data-stone="${state.step}"]`);
            animate(landing,[{boxShadow:'0 0 0 0 #e9c48299'},{boxShadow:'0 0 0 9px #e9c48200'}],{duration:500});
            animate(count,[{transform:'scale(1.08)',color:'#ffe0a1'},{transform:'none',color:'#ccdbb5'}],{duration:300});
          }
          crossing.textContent=state.step>=boundary?t.crossing:'';
          if(hopping&&state.step===boundary)animate(crossing,[{opacity:.2,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:500});
          dial.setZoom(.45);dial.setYear(p.bridge[state.step],false);count.textContent=t.jumps(state.step);
          if(state.step===p.bridge.length-1){jump.disabled=true;feedback.textContent=p.why;complete();}
        };
        jump.onclick=()=>{if(state.step<p.bridge.length-1){state.step++;update(true);dial.onYearTick?.(1,.04);}};
        content.append(bridge,count,crossing,jump);update();
      }
      if(p.worked){
        const visual=document.createElement('div');visual.className='worked-history';visual.innerHTML=`<img src="${historyImage('buddha')}" alt="${S.discoveries.entries.buddha.alt}"><div class="worked-parts"></div>`;
        const reveal=document.createElement('button');reveal.className='btn';reveal.textContent=t.revealStep;
        const sum=document.createElement('div');sum.className='worked-sum';sum.setAttribute('aria-label',t.sumLabel);sum.setAttribute('aria-live','polite');sum.setAttribute('aria-atomic','true');
        const values=[Math.abs(YEARS.BUDDHA_BCE)-1,1,YEARS.BOOK_EXAMPLE_CE-1];
        const parts=visual.querySelector('.worked-parts');
        const update=(revealing=false)=>{
          while(parts.children.length<state.step){const i=parts.children.length,row=document.createElement('p');row.innerHTML=`<b>${i+1}</b><span>${t.workedSteps[i]}</span>`;parts.append(row);
            if(revealing)animate(row,[{opacity:.1,transform:'translateX(12px)'},{opacity:1,transform:'none'}]);
            const term=document.createElement('span');term.textContent=(i?' + ':'')+fmtNum(values[i]);sum.append(term);
            if(revealing)animate(term,[{opacity:.2,transform:'translateY(-12px) scale(.9)'},{opacity:1,transform:'none'}],{duration:450});
          }
          if(state.step===3&&!sum.querySelector('strong')){const total=document.createElement('strong');total.textContent=' = '+fmtNum(YEARS.BOOK_EXAMPLE_GAP);sum.append(total);if(revealing)animate(total,[{opacity:.2,transform:'scale(.8)'},{opacity:1,transform:'scale(1.06)',offset:.7},{transform:'none'}],{duration:550});}
          if(state.step===3){feedback.textContent=t.workedTotal;reveal.disabled=true;complete();}
        };
        reveal.onclick=()=>{state.step++;update(true);};content.append(visual,sum,reveal);dial.setZoom(6);dial.setYear(YEARS.BUDDHA_BCE,false);update();
      }
      if(p.options||p.number){
        const answer=value=>{
          const right=value===p.answer;Save.recordRecall(p.id,right);
          state.feedback=right?`${t.success} ${p.why}`:`${t.retry} ${p.why}`;
          feedback.textContent=state.feedback;feedback.classList.toggle('correct',right);
          animate(feedback,[{opacity:.25,transform:'translateY(6px)'},{opacity:1,transform:'none'}]);
          if(right)animate(next,[{boxShadow:'0 0 0 0 #e9c48288'},{boxShadow:'0 0 0 9px #e9c48200'}],{duration:600});
          if(right){complete();SFX.success?.();}
        };
        if(p.options){const choices=document.createElement('div');choices.className='lesson-choices';
          p.options.forEach((option,i)=>{const button=document.createElement('button');button.className='btn';button.textContent=option;button.onclick=()=>answer(i);choices.append(button);});content.append(choices);
        }else{
          const form=document.createElement('form');form.className='lesson-answer';
          form.innerHTML=`<label>${t.years}<input inputmode="numeric" autocomplete="off" aria-label="${t.years}"></label><button class="btn" type="submit">${t.check}</button>`;
          form.onsubmit=e=>{e.preventDefault();const value=form.querySelector('input').value.trim().replace(/,/g,'');if(!/^\d+$/.test(value)){feedback.textContent=S.skyUI.invalidYear;return;}answer(Number(value));};content.append(form);
        }
        const help=document.createElement('button');help.className='lesson-help';help.textContent=t.help;
        help.onclick=()=>{Save.recordRecall(p.id,false);state.feedback=p.why;feedback.textContent=p.why;complete();};content.append(help);
      }
      if(state.feedback) feedback.textContent=state.feedback;
      if(state.done) complete();
      content.append(feedback);
      content.scrollTop=0;
      const focusFrame=requestAnimationFrame(()=>{if(el.isConnected)(content.querySelector('button:not(:disabled),input:not(:disabled)')??next).focus();});
      pageCleanups.push(()=>cancelAnimationFrame(focusFrame));
    };
    next.onclick=()=>{if(index===pages.length-1)close();else{index++;draw();}};
    back.onclick=()=>{if(index){index--;draw();}};
    draw();
  });
}
