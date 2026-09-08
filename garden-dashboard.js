(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else {root.GardenDashboard=api;api.install();}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const careActions=['Watered','Fertilized','Pruned / trimmed','Repotted','Rotated','Cleaned leaves','Pest treatment','Other'];
 const plantName=p=>p.nickname||p.profile||p.name||'Plant';
 const health=c=>/health/i.test(c.entryKind||c.type||'');
 const activePlant=(data,id)=>data.plants.find(p=>String(p.id)===String(id)&&!p.archived);
 function nextId(data){
  const used=new Set([...data.plants,...data.care].map(r=>r.id));let id=Date.now();
  while(used.has(id))id++;return id;
 }
 function quickHealth(data,values,stamp){
  const plant=activePlant(data,values.plantId);if(!plant)throw Error('Choose a plant first.');
  const record={id:nextId(data),plantId:plant.id,plant:plantName(plant),entryKind:'Health',type:'Health issue',activity:'Health concern',symptoms:String(values.note||'').trim(),date:stamp.date,time:stamp.time,status:'Needs attention',incomplete:true};
  data.care.unshift(record);return [record];
 }
 function quickCare(data,values,stamp){
  const plant=activePlant(data,values.plantId);if(!plant)throw Error('Choose a plant first.');
  const actions=[...new Set(values.actions||[])];
  if(!actions.length||actions.some(a=>!careActions.includes(a)))throw Error('Choose at least one care action.');
  return actions.map(action=>{
   // The full routine form already supports Other; retain the treatment label in notes.
   const record={id:nextId(data),plantId:plant.id,plant:plantName(plant),entryKind:'Routine',careType:action==='Pest treatment'?'Other':action,activity:action,notes:action==='Pest treatment'?'Pest treatment':'',date:stamp.date,time:stamp.time};
   data.care.unshift(record);
   if(action==='Watered'){plant.soil=stamp.date;plant.snoozeUntil='';}
   return record;
  });
 }
 function quickPlant(data,values,stamp){
  const nickname=String(values.nickname||'').trim(),profile=String(values.profile||'').trim(),acquired=values.acquired||stamp.date;
  if(!nickname||!profile)throw Error('Add a name and plant type first.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(acquired)||isNaN(new Date(acquired+'T12:00:00')))throw Error('Choose an acquired date.');
  let number=data.plants.length+1,pid;
  do{pid='PLT-'+String(number++).padStart(3,'0');}while(data.plants.some(p=>p.pid===pid));
  const record={id:nextId(data),pid,nickname,profile,acquired,incomplete:true};
  data.plants.push(record);return [record];
 }
 function attention(data,tasks,today){
  const due=[],upcoming=[],seen=new Set();
  const add=item=>{if(!seen.has(item.key)){seen.add(item.key);due.push(item);}};
  for(const plant of data.plants.filter(p=>!p.archived&&p.incomplete===true))add({key:'plant:'+plant.id,plantId:plant.id,name:plantName(plant),kind:'Finish plant profile',action:'plant',detail:'Add the rest of your plant details.'});
  for(const entry of data.care){
   if(!activePlant(data,entry.plantId))continue;
   if(entry.incomplete===true&&health(entry))add({key:'care:'+entry.id,careId:entry.id,plantId:entry.plantId,name:plantName(activePlant(data,entry.plantId)),kind:'Finish Health Concern',action:'care',detail:entry.symptoms||'Add what you noticed when you have a moment.'});
  }
  const end=new Date(today+'T23:59:59'),windowEnd=new Date(end);windowEnd.setDate(windowEnd.getDate()+7);
  for(const task of tasks){
   if(!activePlant(data,task.plantId)||isNaN(task.date))continue;
   const entry=task.careId!=null?data.care.find(c=>c.id===task.careId):null;
   if(entry&&(entry.incomplete===true||/resolved/i.test(entry.status||'')))continue;
   const item={...task,key:task.careId!=null?'care:'+task.careId:'water:'+task.plantId,action:task.careId!=null?'follow':'water'};
   if(task.date<=end)add(item);else if(task.date<=windowEnd)upcoming.push(item);
  }
  for(const entry of data.care){
   if(health(entry)&&!/resolved/i.test(entry.status||'')&&(entry.status==='Needs attention'||(!entry.follow&&entry.incomplete!==false))&&activePlant(data,entry.plantId))add({key:'care:'+entry.id,careId:entry.id,plantId:entry.plantId,name:plantName(activePlant(data,entry.plantId)),kind:'Review Health Concern',action:'care',detail:entry.symptoms||entry.activity||''});
  }
  return {due,upcoming:upcoming.filter(item=>!seen.has(item.key))};
 }
 function install(){
  const byId=id=>document.getElementById(id);
  let managed=null;
  const baseShow=window.show,baseClose=window.closeSheet;
  function release(){if(!managed)return;for(const [el,inert]of managed.background)el.inert=inert;managed=null;}
  window.show=function(...args){release();return baseShow.apply(this,args);};
  window.closeSheet=function(...args){const source=managed?.source;release();const result=baseClose.apply(this,args);if(source?.isConnected)source.focus();return result;};
  function focusPanel(source){
   const overlay=byId('overlay'),background=[];
   for(let branch=overlay;branch&&branch!==document.body;branch=branch.parentElement)for(const sibling of branch.parentElement?.children||[])if(sibling!==branch){background.push([sibling,sibling.inert]);sibling.inert=true;}
   managed={source,background};
   (byId('sheet').querySelector('input:not([type=hidden]),select,textarea,button')||overlay.querySelector('button'))?.focus();
  }
  document.addEventListener('keydown',event=>{
   if(!managed||event.key!=='Tab')return;
   const overlay=byId('overlay'),items=[...overlay.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length&&!e.closest('[inert]'));
   if(!items.length){event.preventDefault();return;}
   const first=items[0],last=items.at(-1),current=document.activeElement;
   if(!overlay.contains(current)||(event.shiftKey?current===first:current===last)){event.preventDefault();(event.shiftKey?last:first).focus();}
  },true);
  function plantOptions(){return db.plants.filter(p=>!p.archived).map(p=>'<option value="'+esc(p.id)+'">'+esc(carePlantName(p))+'</option>').join('');}
  function plantField(){return '<div class="field"><label for="quickPlantId">Plant</label><select id="quickPlantId" required><option value="">Choose a plant</option>'+plantOptions()+'</select></div>';}
  function showQuick(kind){
   const source=document.activeElement;
   const title={health:'Quick Health Concern',care:'Quick Care',plant:'Quick Plant'}[kind];
   let body='';
   if(kind==='plant')body='<div class="field"><label for="quickNickname">Plant name / nickname</label><input id="quickNickname" required maxlength="120"></div><div class="field"><label for="quickProfile">Plant type / species</label><input id="quickProfile" list="plantTypeList" required maxlength="160"></div><div class="field"><label for="quickAcquired">Acquired / purchase date</label><input id="quickAcquired" type="date" value="'+localISODate()+'" required></div>';
   else if(!plantOptions())body='<p>Add a plant first so this entry has a home.</p><button type="button" class="btn green" onclick="openGardenQuick(\'plant\')">Quick Plant</button>';
   else {
    body=plantField();
    if(kind==='health')body+='<div class="field"><label for="quickNote">Short note (optional)</label><textarea id="quickNote" rows="2" maxlength="500" placeholder="What caught your eye?"></textarea></div>';
    else body+='<fieldset class="gardenCareChoices"><legend>What did you do?</legend>'+careActions.map(action=>'<label><input type="checkbox" name="quickAction" value="'+esc(action)+'"> '+esc(action)+'</label>').join('')+'</fieldset>';
   }
   const canSave=kind==='plant'||!!plantOptions();
   show('<h2>'+title+'</h2><p class="sub">'+(kind==='care'?'Log today’s care in a few taps.':kind==='plant'?'Capture the basics now; finish the profile later.':'Save what you noticed; add the details later.')+'</p><form id="gardenQuickForm">'+body+'<p id="gardenQuickError" role="alert"></p>'+(canSave?'<button class="btn green" type="submit">'+(kind==='care'?'Save care':'Save for later')+'</button>':'')+'</form>');
   focusPanel(source);
   byId('gardenQuickForm').addEventListener('submit',event=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity())return;
    try{
     const stamp={date:localISODate(),time:timeNow()};
     const values={plantId:byId('quickPlantId')?.value,note:byId('quickNote')?.value,nickname:byId('quickNickname')?.value,profile:byId('quickProfile')?.value,acquired:byId('quickAcquired')?.value,actions:[...document.querySelectorAll('input[name="quickAction"]:checked')].map(e=>e.value)};
     const records=({health:quickHealth,care:quickCare,plant:quickPlant}[kind])(db,values,stamp);
     for(const record of records)recordGardenJournal(kind==='plant'?'plants':'care',kind==='plant'?'Plant added to My Plants':record.activity,{date:record.date||record.acquired,time:record.time||stamp.time,plant:kind==='plant'?carePlantName(record):record.plant,plantId:kind==='plant'?record.id:record.plantId,detail:record.symptoms||record.notes||'Added with Quick Add'});
     closeSheet();save();
     byId('gardenQuickStatus').textContent=kind==='care'?'Care saved to your log.':'Saved. You can finish it from Needs your attention.';
    }catch(error){byId('gardenQuickError').textContent=error.message;}
   });
  }
  window.openGardenQuick=showQuick;
  window.openGardenFull=function(kind){
   const source=document.activeElement;
   show('<h2>'+(kind==='health'?'Add Health Concern':'Log Care')+'</h2><form id="gardenFullChooser">'+plantField()+'<button type="submit" class="btn green">Open full '+(kind==='health'?'Health Concern':'Care')+' form</button></form>');
   focusPanel(source);
   byId('gardenFullChooser').addEventListener('submit',event=>{event.preventDefault();if(!event.currentTarget.reportValidity())return;const plant=activePlant(db,byId('quickPlantId').value);if(!plant)return;openCareEntry(plant.id,kind);focusPanel(source);});
  };
  window.openGardenAttention=function(action,id){
   const source=managed?.source||document.activeElement;
   if(action==='plant')openPlantDetail(id);
   else if(action==='care')editCareEntry(id);
   else if(action==='follow')openFollowUpResolve(id);
   else openWateringSnooze(id);
   focusPanel(source);
  };
  window.openGardenOverview=function(kind){
   const source=document.activeElement,items=attention(db,upcomingCareTasks(),localISODate());
   const upcoming=kind==='upcoming';
   show('<h2>'+(upcoming?'Due Soon':'Needs your attention')+'</h2><p>'+(upcoming?'Care coming up in the next seven days.':'Choose an item to check on it or finish the entry.')+'</p><div id="gardenOverviewDetails">'+cards(upcoming?items.upcoming:items.due,upcoming?'No care scheduled in the next seven days.':'Your garden is all caught up.')+'</div>');
   focusPanel(source);
  };
  // Clear only Quick Add's completion flag, only after the full save succeeds.
  const baseCare=window.submitCareEntry,basePlant=window.submitForm,baseOpenCare=window.openCareEntry;
  window.openCareEntry=function(plantId,kind,id){
   const result=baseOpenCare.apply(this,arguments),record=db.care.find(c=>c.id===id);
   // Quick capture's attention marker is not a clinical status chosen by the user.
   if(record?.incomplete===true&&byId('f_status')?.value==='Needs attention')byId('f_status').value='Monitoring';
   return result;
  };
  window.submitCareEntry=function(plantId,kind,id){
   const record=db.care.find(c=>c.id===id),incomplete=record?.incomplete===true;
   if(incomplete)record.incomplete=false;
   let result;
   try{result=baseCare.apply(this,arguments);}finally{if(incomplete&&!result){const current=db.care.find(c=>c.id===id);if(current)current.incomplete=true;}}
   return result;
  };
  window.submitForm=function(type,id){
   const record=type==='plant'?db.plants.find(p=>p.id===id):null,incomplete=record?.incomplete===true;
   if(incomplete)record.incomplete=false;
   let result;
   try{result=basePlant.apply(this,arguments);}finally{if(incomplete&&result!==true){const current=db.plants.find(p=>p.id===id);if(current)current.incomplete=true;}}
   return result;
  };
  function cards(items,empty){
   return items.length?items.map(item=>'<button type="button" class="gardenAttentionItem" data-garden-key="'+esc(item.key)+'" onclick="openGardenAttention(\''+item.action+'\','+Number(item.careId??item.plantId)+')"><span><b>'+esc(item.name)+'</b><span>'+esc(item.kind)+'</span><small>'+esc(item.detail||'')+(item.date?' · '+esc(item.date.toLocaleDateString()):'')+'</small></span><span aria-hidden="true">›</span></button>').join(''):'<div class="empty">'+empty+'</div>';
  }
  function render(){
   const items=attention(db,upcomingCareTasks(),localISODate());
   byId('gardenAttentionCount').textContent=items.due.length;
   byId('gardenDueCount').textContent=items.upcoming.length;
   byId('careAttentionList').innerHTML=cards(items.due,'Nothing needs attention right now.');
   // Preserve the existing active-propagation and collection definitions.
   byId('kPlantsDash').textContent=db.plants.filter(p=>!p.archived).length;
   byId('kPropDash').textContent=byId('kProp').textContent||'0';
   byId('kAttention').textContent=items.due.length;
   byId('dashAttentionLine').style.display='none';
   // Keep the overview short; the full log remains one click away.
   const recent=byId('recentActivity');
   while(recent.children?.length>3)recent.lastElementChild.remove();
  }
  const baseRender=window.renderAll;
  window.renderAll=function(...args){
   const focused=document.activeElement,list=focused?.closest?.('#careAttentionList'),key=focused?.dataset?.gardenKey;
   const result=baseRender.apply(this,args);render();
   if(list){
    const replacement=[...list.querySelectorAll('[data-garden-key]')].find(e=>e.dataset.gardenKey===key);
    const target=replacement||(list.id==='careAttentionList'?list:byId('gardenAttentionSummary'));
    if(!replacement)target.tabIndex=-1;target.focus();
   }
   return result;
  };
  render();
 }
 return {careActions,quickHealth,quickCare,quickPlant,attention,install};
});
