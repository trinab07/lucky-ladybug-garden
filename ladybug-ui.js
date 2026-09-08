(function(){
let session=Ladybug.createSession();
const originalOpen=window.openAskAssistant;
window.selectLadybugPlant=function(name){session=Ladybug.createSession(name);};
window.openAskAssistant=function(name){originalOpen(name);session=Ladybug.createSession(name||'');};
window.runAskAssistant=function(){
 const input=document.getElementById('askQuestion'),output=document.getElementById('askAssistantResult');
 const question=input?.value.trim();if(!question){output.insertAdjacentHTML('beforeend','<div class="askBubble bot">Tell me what your plant is doing, or ask a care question.</div>');return;}
 const plants=db.plants.filter(p=>!p.archived),names=[...LIB.map(p=>p.name),...plants.map(carePlantName)];
 const aliases=Object.fromEntries(plants.filter(p=>p.profile).map(p=>[carePlantName(p),p.profile]));
 const extracted=Ladybug.extract(question,session,names);
 const name=extracted.plant&&Ladybug.samePlantName(extracted.plant,session.plant,aliases)?session.plant:extracted.plant||session.plant;
 const saved=plants.find(p=>carePlantName(p).toLowerCase()===String(name).toLowerCase());
 const profile=Ladybug.resolveProfile(saved?.profile||name,LIB);
 const result=Ladybug.answer(question,session,{names,profile,library:LIB,aliases});
 const user=document.createElement('div');user.className='askBubble user';user.textContent=question;output.appendChild(user);
 const bot=document.createElement('div');bot.className='askBubble bot';
 if(result.plant){const chip=document.createElement('span');chip.className='askContextChip';chip.textContent='🌿 '+result.plant;bot.appendChild(chip);}
 const text=document.createElement('div');text.textContent=result.response;bot.appendChild(text);
 if(result.health){const handoff=document.createElement('div');handoff.className='askHealthHandoff';handoff.textContent='If this continues, log a Health Concern to track changes and follow-up reminders.';
 const matches=plants.filter(p=>carePlantName(p).toLowerCase()===String(result.plant).toLowerCase());
 if(matches.length===1){const button=document.createElement('button');button.type='button';button.className='btn green';button.textContent='Log Health Concern →';const notes=session.turns.map(t=>t.user).join('\n');button.onclick=()=>openHealthFromAsk(matches[0].id,notes);handoff.appendChild(button);}else handoff.appendChild(document.createTextNode(' Use Care & Health Log in My Plants.'));
 bot.appendChild(handoff);}
 output.appendChild(bot);input.value='';input.placeholder='Keep talking — you can answer the follow-up in your own words…';input.focus();bot.scrollIntoView?.({behavior:'smooth',block:'nearest'});
};
})();

// Ladybug's modal lifecycle is separate from its plant-care decision engine.
(function(){
 const baseOpen=window.openAskAssistant,baseShow=window.show,baseClose=window.closeSheet,baseDiscard=window.discardCurrentSheet;
 let active=false,opener=null,background=[],returnToCare=null;
 const panel=()=>document.getElementById('overlay');
 const question=()=>document.getElementById('askQuestion');
 function release(){
  active=false;
  for(const [element,inert] of background)element.inert=inert;
  background=[];
 }
 function focusOpener(target){if(target?.isConnected)target.focus();}
 window.show=function(...args){release();returnToCare=null;return baseShow.apply(this,args);};
 window.openAskAssistant=function(...args){
  const source=document.activeElement;
  baseOpen.apply(this,args);
  const modal=panel();if(!modal)return;
  opener=source;active=true;
  // Inert only siblings outside the modal, preserving their previous state.
  for(let branch=modal;branch&&branch!==document.body;branch=branch.parentElement){
   for(const sibling of branch.parentElement?.children||[]){
    if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}
   }
  }
  question()?.focus();
 };
 window.closeSheet=function(...args){
  if(active&&returnToCare){returnToCare();return;}
  const target=active?opener:null;
  release();returnToCare=null;
  const result=baseClose.apply(this,args);focusOpener(target);return result;
 };
 window.discardCurrentSheet=function(...args){
  if(active&&returnToCare){returnToCare();return;}
  return baseDiscard.apply(this,args);
 };
 document.addEventListener('keydown',event=>{
  if(!active||event.key!=='Tab')return;
  const modal=panel();
  const controls=[...modal.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')]
   .filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[inert]')&&el.getClientRects().length);
  if(!controls.length){event.preventDefault();return;}
  const first=controls[0],last=controls.at(-1),current=document.activeElement;
  if(!modal.contains(current)||(event.shiftKey?current===first:current===last)){
   event.preventDefault();(event.shiftKey?last:first).focus();
  }
 },true);
 document.addEventListener('focusin',event=>{
  if(active&&!panel()?.contains(event.target))question()?.focus();
 });
 window.openAskFromHealth=function(plantId){
  const form=document.getElementById('formBox'),sheet=document.getElementById('sheet');
  if(!form||!sheet||form.dataset.type!=='care')return;
  const plant=db.plants.find(p=>String(p.id)===String(form.dataset.plantid||plantId));
  const source=document.activeElement,notes=document.getElementById('f_symptoms')?.value||'';
  captureDraftIfAny();
  // Keep the actual form controls, including listeners, checked state, and blanks.
  // Rebuilding the form would invoke the unrelated earlier-draft confirmation.
  const draft=db.draft?JSON.parse(JSON.stringify(db.draft)):null;
  const nodes=[...sheet.childNodes],scrollTop=sheet.scrollTop;
  window.openAskAssistant(plant?carePlantName(plant):'');
  question().value=notes;
  const restore=()=>{
   release();returnToCare=null;
   sheet.replaceChildren(...nodes);sheet.scrollTop=scrollTop;
   db.draft=draft;
   localStorage.setItem('llg_full_app_v58',JSON.stringify(db));
   focusOpener(source);
  };
  returnToCare=restore;
  const back=document.createElement('button');
  back.type='button';back.className='btn ghost backToCareEntryLink';
  back.style.cssText='width:100%;margin-top:10px';back.textContent='← Back to your care entry';
  back.onclick=restore;sheet.appendChild(back);
 };
})();
