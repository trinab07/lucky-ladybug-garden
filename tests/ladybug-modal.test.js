const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');

// Focus/lifecycle harness. Real browser acceptance covers layout and native Tab.
function setup(){
 let document;
 class Element {
  constructor(tag='div',id=''){Object.assign(this,{tagName:tag.toUpperCase(),id,children:[],parentElement:null,style:{},dataset:{},value:'',disabled:false,tabIndex:['button','input','textarea','select','a'].includes(tag)?0:-1,inert:false,scrollTop:0,listeners:{}});}
  get childNodes(){return this.children;}
  get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
  appendChild(e){if(e.parentElement)e.parentElement.children=e.parentElement.children.filter(x=>x!==e);this.children.push(e);e.parentElement=this;return e;}
  replaceChildren(...nodes){for(const e of this.children)e.parentElement=null;this.children=[];nodes.forEach(e=>this.appendChild(e));}
  contains(e){return this===e||this.children.some(c=>c.contains(e));}
  all(){return this.children.flatMap(c=>[c,...c.all()]);}
  closest(selector){return selector==='[inert]'?(this.inert?this:this.parentElement?.closest(selector)):null;}
  getClientRects(){return this.hidden?[]:[{}];}
  querySelectorAll(){return this.all().filter(e=>e.tabIndex>=0);}
  focus(){if(!this.closest('[inert]'))document.activeElement=this;}
  addEventListener(name,cb){this.listeners[name]=cb;}
  dispatchEvent(e){this.listeners[e.type]?.(e);}
 }
 const events={};
 document={createElement:tag=>new Element(tag),addEventListener:(name,cb)=>{(events[name]??=[]).push(cb);},getElementById:id=>document.body.all().find(e=>e.id===id),querySelectorAll:selector=>selector==='#formBox [id^=f_]'?document.getElementById('formBox').all().filter(e=>e.id.startsWith('f_')):[]};
 document.body=new Element('body');
 const main=document.body.appendChild(new Element('main'));
 const opener=main.appendChild(new Element('button','opener'));
 const alreadyInert=document.body.appendChild(new Element('aside'));alreadyInert.inert=true;
 const overlay=document.body.appendChild(new Element('div','overlay'));
 let visible=false;overlay.classList={contains:()=>visible};
 const close=overlay.appendChild(new Element('button','close'));
 const sheet=overlay.appendChild(new Element('div','sheet'));
 const db={plants:[{id:7,name:'Sunny'},{id:8,name:'Spike'}],care:[],draft:null};
 const storage={};
 const context={document,overlay,db,LIB:[],Ladybug:require('../ladybug-engine'),carePlantName:p=>p.name,
  localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},Event:class{constructor(type){this.type=type;}},
  show(){visible=true;sheet.replaceChildren();},closeSheet(){visible=false;},
  discardCurrentSheet(){context.closeSheet();sheet.replaceChildren();},
  openAskAssistant(name){context.show();const select=sheet.appendChild(new Element('select','askSavedPlant'));select.value=name||'';sheet.appendChild(new Element('textarea','askQuestion'));sheet.appendChild(new Element('button','submit'));},
  openCareEntry(){throw Error('Round trip must not rebuild or prompt for an earlier draft');}
 };
 context.window=context;vm.createContext(context);
 // Use the app's actual capture logic, including draft metadata and persistence.
 const html=fs.readFileSync('index.html','utf8');
 vm.runInContext(html.slice(html.indexOf('function persistGardenData()'),html.indexOf('function recentCareEntries()')),context);
 vm.runInContext(html.slice(html.indexOf('function captureDraftIfAny()'),html.indexOf('function clearDraft()')),context);
 vm.runInContext(fs.readFileSync('ladybug-ui.js','utf8'),context);
 function key(shiftKey=false){let prevented=false;for(const fn of events.keydown)fn({key:'Tab',shiftKey,preventDefault(){prevented=true;}});return prevented;}
 function care(edit=false){
  context.show();const form=sheet.appendChild(new Element('div','formBox'));
  form.dataset={type:'care',plantid:'7',kind:'health',...(edit?{edit:'91'}:{})};
  for(const [id,value]of Object.entries({date:'2026-09-07',symptoms:'Yellow leaves and wet soil.',pestFlag:'Not sure',action:'Emptied saucer.',followChoice:'none',follow:'',status:'Improving'})){
   const e=form.appendChild(new Element('input','f_'+id));e.value=value;
  }
  const source=form.appendChild(new Element('button','careOpener'));source.focus();
  return {form,source,nodes:[...sheet.childNodes]};
 }
 opener.focus();
 return {context,document,main,alreadyInert,opener,close,sheet,db,storage,key,care,events,isVisible:()=>visible};
}

test('Ladybug focuses question and makes background inert without changing existing inert state',()=>{
 const h=setup();h.context.openAskAssistant();assert.equal(h.document.activeElement.id,'askQuestion');assert.equal(h.main.inert,true);assert.equal(h.alreadyInert.inert,true);
 h.opener.focus();assert.equal(h.document.activeElement.id,'askQuestion');
});
test('Tab and Shift+Tab wrap at both Ladybug boundaries',()=>{
 const h=setup();h.context.openAskAssistant();h.close.focus();assert.equal(h.key(true),true);assert.equal(h.document.activeElement.id,'submit');assert.equal(h.key(),true);assert.equal(h.document.activeElement.id,'close');
 h.document.getElementById('askQuestion').focus();assert.equal(h.key(),false);
});
test('Ladybug X restores opener focus and prior background state',()=>{
 const h=setup();h.context.openAskAssistant();h.context.discardCurrentSheet();assert.equal(h.document.activeElement,h.opener);assert.equal(h.main.inert,false);assert.equal(h.alreadyInert.inert,true);assert.equal(h.isVisible(),false);
});
test('focus trap is released when another panel replaces Ladybug',()=>{
 const h=setup();h.context.openAskAssistant();h.context.show();assert.equal(h.main.inert,false);assert.equal(h.key(),false);
});
for(const edit of [false,true])test(`care round trip preserves every unsaved control and original plant (${edit?'edit':'new'})`,()=>{
 const h=setup(),{form,source}=h.care(edit),controls=form.all();let changes=0;
 controls[0].addEventListener('change',()=>changes++);
 const values=controls.map(e=>e.value);h.context.openAskFromHealth(7);
 assert.equal(h.document.getElementById('askSavedPlant').value,'Sunny');assert.equal(h.document.getElementById('askQuestion').value,'Yellow leaves and wet soil.');
 assert.equal(form.isConnected,false);h.context.selectLadybugPlant('Spike');h.document.getElementById('askQuestion').value='Different question';
 h.sheet.children.at(-1).onclick();
 assert.equal(h.document.getElementById('formBox'),form);assert.deepEqual(controls.map(e=>e.value),values);assert.equal(form.dataset.plantid,'7');assert.equal(form.dataset.edit,edit?'91':undefined);assert.equal(h.document.activeElement,source);
 controls[0].dispatchEvent({type:'change'});assert.equal(changes,1);assert.equal(h.db.care.length,0);assert.equal(h.db.draft.plantId,'7');assert.equal(h.db.draft.values.follow,'');assert.equal(JSON.parse(h.storage.llg_full_app_v58).care.length,0);
});
test('repeated care round trips and X keep latest edits without duplicating or saving',()=>{
 const h=setup(),{form}=h.care();
 for(const notes of ['First notes','Corrected notes']){
  h.document.getElementById('f_symptoms').value=notes;h.context.openAskFromHealth(7);h.context.discardCurrentSheet();assert.equal(h.document.getElementById('formBox'),form);assert.equal(h.document.getElementById('f_symptoms').value,notes);assert.equal(h.sheet.children.length,1);assert.equal(h.db.care.length,0);
 }
});
