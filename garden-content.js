// User-owned guide entries and personal writing share the app's existing database.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GardenContent=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const fields=['name','botanical','careGroup','growthHabit','tags','petNote','tip','light','soilCheck','humidity','soil','fertilizer','interval'];
 const normalize=s=>String(s||'').trim().toLowerCase();
 function init(data){data.customPlants ||= [];data.personalJournal ||= [];return data;}
 function library(curated,data){init(data);return [...curated,...data.customPlants.filter(p=>!p.deleted)];}
 function resolve(data,id){return (data.customPlants||[]).find(p=>p.id===id);}
 function link(data){
  init(data);const byName=name=>data.customPlants.find(p=>!p.deleted&&normalize(p.name)===normalize(name));
  for(const p of data.plants||[]){const found=byName(p.profile);if(found)p.guideId=found.id;else if(p.guideId&&resolve(data,p.guideId)&&p.profile!==resolve(data,p.guideId).name)delete p.guideId;}
  for(const key of ['wish','expenses','garden'])for(const r of data[key]||[]){const p=byName(r.variety||r.profile||r.name||r.plant);if(p)r.guideId=p.id;}
  for(const r of data.expenses||[]){const p=(data.plants||[]).find(p=>normalize(p.nickname||p.profile||p.name)===normalize(r.plant));if(p){r.plantId=p.id;if(p.guideId)r.guideId=p.guideId;}const wish=(data.wish||[]).find(w=>w.id===r.wishId);if(wish?.guideId)r.guideId=wish.guideId;}
  for(const r of data.prop||[]){const p=(data.plants||[]).find(p=>normalize(p.nickname||p.profile||p.name)===normalize(r.parent));if(p){r.parentPlantId=p.id;if(p.guideId)r.guideId=p.guideId;}}
  for(const r of data.journal||[]){const p=(data.plants||[]).find(p=>normalize(p.nickname||p.profile||p.name)===normalize(r.plant));if(p&&!r.plantId)r.plantId=p.id;const c=byName(r.plant);if(c&&!r.plantId)r.guideId=c.id;}
 }
 function upsertPlant(data,curated,values,id,makeId){
  init(data);const old=id?resolve(data,id):null;if(id&&!old)throw Error('This entry is no longer available.');
  const name=String(values.name||'').trim();if(!name)throw Error('Add a plant name.');
  if([...curated,...data.customPlants].some(p=>p.id!==id&&normalize(p.name)===normalize(name)))throw Error('That plant name is already in your guide. Choose a different name.');
  const interval=values.interval===''?0:Number(values.interval||0);if(!Number.isInteger(interval)||interval<0||interval>3650)throw Error('Use a whole-number check interval from 0 to 3650 days.');
  if(!curated.some(p=>p.name===values.avatar))throw Error('Choose one of the included plant avatars.');
  link(data);const record={id:old?.id||makeId(),...Object.fromEntries(fields.map(k=>[k,k==='interval'?interval:String(values[k]||'').trim()])),avatar:values.avatar};
  if(old){const previous=old.name;Object.assign(old,record);
   for(const key of ['plants','wish','expenses','garden','prop','journal'])for(const r of data[key]||[]){if(r.guideId!==id)continue;for(const field of ['profile','variety','name','plant','parent'])if(r[field]===previous)r[field]=name;}
  }else data.customPlants.push(record);return record;
 }
 function references(data,id){return ['plants','wish','expenses','garden','prop','journal','personalJournal'].flatMap(key=>(data[key]||[]).filter(r=>r.guideId===id).map(r=>({key,id:r.id})));}
 function deletePlant(data,id){link(data);const p=resolve(data,id);if(!p)throw Error('This entry is no longer available.');if(references(data,id).length){p.deleted=true;return 'archived';}data.customPlants=data.customPlants.filter(p=>p.id!==id);return 'deleted';}
 function writeJournal(data,values,id,makeId,now){
  init(data);const old=id?data.personalJournal.find(e=>e.id===id):null;if(id&&!old)throw Error('This journal entry is no longer available.');
  const body=String(values.body||'').trim();if(!body)throw Error('Write something in your journal first.');
  const relation=String(values.association||'');let plantId=null,guideId=null,plantLabel='';
  if(relation.startsWith('plant:')){const p=(data.plants||[]).find(p=>String(p.id)===relation.slice(6));if(!p)throw Error('Choose an available plant.');plantId=p.id;plantLabel=p.nickname||p.profile||p.name;}
  else if(relation.startsWith('guide:')){const p=resolve(data,relation.slice(6));if(!p)throw Error('Choose an available plant.');guideId=p.id;plantLabel=p.name;}
  else if(relation)throw Error('Choose an available plant.');
  const entryAt=values.entryAt||old?.entryAt||old?.createdAt||now;if(!Number.isFinite(Date.parse(entryAt)))throw Error('Choose a valid entry date and time.');
  const record={id:old?.id||makeId(),title:String(values.title||'').trim(),body,createdAt:old?.createdAt||now,entryAt,updatedAt:now,plantId,guideId,plantLabel};
  if(old)Object.assign(old,record);else data.personalJournal.push(record);return record;
 }
 function journalEntries(data){return [...(data.personalJournal||[])].sort((a,b)=>(b.entryAt||b.createdAt).localeCompare(a.entryAt||a.createdAt)||b.createdAt.localeCompare(a.createdAt));}
 function journalLabel(data,e){return e.plantId?((data.plants||[]).find(p=>p.id===e.plantId)?.nickname||(data.plants||[]).find(p=>p.id===e.plantId)?.profile||e.plantLabel):e.guideId?resolve(data,e.guideId)?.name||e.plantLabel:'';}
 function searchFAQ(entries,query,category=''){
  const aliases={dirt:'soil',insects:'bugs',insect:'bugs',bug:'bugs',watering:'water'};
  const tokens=s=>normalize(s).replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w&&!['in','the','my','a','are','is','on','of','to','and'].includes(w)).map(w=>aliases[w]||w);
  const q=tokens(query);return entries.filter(e=>!category||e.category===category).filter(e=>{const text=tokens(e.question+' '+e.answer+' '+e.keywords).join(' ');return q.every(w=>text.includes(w));});
 }
 return {fields,init,library,resolve,link,upsertPlant,references,deletePlant,writeJournal,journalEntries,journalLabel,searchFAQ};
});
