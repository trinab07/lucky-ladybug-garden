const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const G=require('../garden-dashboard');
const stamp={date:'2026-09-08',time:'10:30'};
const fixture=()=>({plants:[{id:1,pid:'PLT-001',nickname:'Sunny',profile:'Golden Pothos',soil:'2026-08-01',snoozeUntil:'2026-09-10'},{id:2,nickname:'Spike',profile:'Snake Plant'}],care:[],budget:123,expenses:[{id:8,actual:12}],draft:{type:'expense',values:{item:'Pot'}},prop:[]});
test('page markup outside Dashboard and Care matches the install-first release',()=>{
 const outside=fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<section id="dashboard"[\s\S]*?<\/section>/,'').replace(/<section id="care"[\s\S]*?<\/section>/,'').replace(/<link rel="stylesheet" href="garden-dashboard.css">\s*/,'').replace(/<link rel="stylesheet" href="garden-content.css">\s*/,'').replace(/\s+/g,' ');
 assert.equal(crypto.createHash('sha256').update(outside.trim()).digest('hex'),'3eea1bfac76ee5ccef3aafa61318c097419e6d6198f0478442ba90e9749f2ca9');
});
test('quick concern accepts only plant, optional note and default timestamp',()=>{
 const d=fixture(),[c]=G.quickHealth(d,{plantId:'1',note:'Yellow leaves and wet soil.'},stamp);
 assert.equal(d.care[0],c);assert.equal(c.plantId,1);assert.equal(c.symptoms,'Yellow leaves and wet soil.');assert.equal(c.date,stamp.date);assert.equal(c.time,stamp.time);assert.equal(c.incomplete,true);assert.equal(c.entryKind,'Health');assert.equal(c.pest,undefined);assert.equal(c.follow,undefined);
 assert.equal(G.attention(d,[],stamp.date).due[0].kind,'Finish Health Concern');
});
test('a quick concern can be captured without any note or diagnosis',()=>{const d=fixture();G.quickHealth(d,{plantId:1},stamp);assert.equal(d.care[0].symptoms,'');assert.equal(G.attention(d,[],stamp.date).due.length,1);});
test('Quick Care logs each selected action in normal history with unique IDs',()=>{
 const d=fixture(),records=G.quickCare(d,{plantId:1,actions:['Watered','Rotated','Watered','Pest treatment']},stamp);
 assert.equal(records.length,3);assert.equal(new Set(records.map(c=>c.id)).size,3);assert.ok(records.every(c=>c.entryKind==='Routine'&&!c.incomplete&&!c.follow));assert.equal(d.plants[0].soil,stamp.date);assert.equal(d.plants[0].snoozeUntil,'');assert.equal(records[2].careType,'Other');assert.equal(records[2].notes,'Pest treatment');assert.equal(G.attention(d,[],stamp.date).due.length,0);
});
test('invalid Quick Care is atomic and never inserts a partial selection',()=>{
 const d=fixture();for(const actions of [[],['Watered','Unknown']])assert.throws(()=>G.quickCare(d,{plantId:1,actions},stamp));assert.equal(d.care.length,0);assert.equal(d.plants[0].soil,'2026-08-01');
});
test('archived or missing plants cannot receive new quick records',()=>{
 const d=fixture();d.plants[0].archived=true;for(const id of [1,99]){assert.throws(()=>G.quickHealth(d,{plantId:id},stamp));assert.throws(()=>G.quickCare(d,{plantId:id,actions:['Watered']},stamp));}assert.equal(d.care.length,0);
});
test('Quick Plant preserves all capture fields in a normal incomplete plant',()=>{
 const d=fixture(),[p]=G.quickPlant(d,{nickname:'Fern friend',profile:'Boston Fern',acquired:'2026-09-01'},stamp);
 assert.equal(d.plants.at(-1),p);assert.equal(p.nickname,'Fern friend');assert.equal(p.profile,'Boston Fern');assert.equal(p.acquired,'2026-09-01');assert.equal(p.incomplete,true);assert.equal(G.attention(d,[],stamp.date).due[0].plantId,p.id);
 p.location='Kitchen';p.incomplete=false;assert.equal(G.attention(d,[],stamp.date).due.length,0);assert.equal(p.acquired,'2026-09-01');
});
test('Quick Plant validation leaves existing records alone and avoids duplicate plant IDs',()=>{
 const d=fixture();d.plants[1].pid='PLT-003';assert.throws(()=>G.quickPlant(d,{nickname:'Fern'},stamp));assert.equal(d.plants.length,2);const [p]=G.quickPlant(d,{nickname:'Fern',profile:'Custom fern'},stamp);assert.equal(p.pid,'PLT-004');
});
test('quick captures preserve Budget, other records and an unrelated unsaved draft',()=>{
 const d=fixture(),before=JSON.stringify({budget:d.budget,expenses:d.expenses,draft:d.draft,prop:d.prop});G.quickPlant(d,{nickname:'Fern',profile:'Fern'},stamp);G.quickHealth(d,{plantId:1},stamp);G.quickCare(d,{plantId:2,actions:['Fertilized']},stamp);assert.equal(JSON.stringify({budget:d.budget,expenses:d.expenses,draft:d.draft,prop:d.prop}),before);
});
test('attention reuses scheduled tasks, includes today and separates upcoming',()=>{
 const d=fixture(),tasks=[{plantId:1,name:'Sunny',kind:'Watering due',date:new Date('2026-09-08T12:00:00')},{plantId:2,name:'Spike',kind:'Watering due',date:new Date('2026-09-10T12:00:00')}];
 const a=G.attention(d,tasks,stamp.date);assert.equal(a.due.length,1);assert.equal(a.due[0].action,'water');assert.equal(a.upcoming.length,1);
});
test('one incomplete concern is not duplicated by a scheduled follow-up or attention status',()=>{
 const d=fixture(),[c]=G.quickHealth(d,{plantId:1},stamp);const tasks=[{plantId:1,careId:c.id,date:new Date('2026-09-07T12:00:00')}];assert.equal(G.attention(d,tasks,stamp.date).due.length,1);c.incomplete=false;c.status='Monitoring';const a=G.attention(d,tasks,stamp.date);assert.equal(a.due.length,1);assert.equal(a.due[0].action,'follow');
});
test('completing capture clears unfinished reminder but preserves an intentional future follow-up',()=>{
 const d=fixture(),[c]=G.quickHealth(d,{plantId:1,note:'Yellow leaf'},stamp);c.incomplete=false;c.status='Monitoring';c.follow='2026-09-11';const a=G.attention(d,[{plantId:1,careId:c.id,date:new Date(c.follow+'T12:00:00')}],stamp.date);assert.equal(a.due.length,0);assert.equal(a.upcoming.length,1);assert.equal(c.symptoms,'Yellow leaf');
});
test('legacy and archived records render without migrations or false incomplete flags',()=>{
 const d=fixture();d.care.push({id:20,plantId:1,entryKind:'Health',status:'Resolved'});d.plants[1].archived=true;d.plants[1].incomplete=true;const before=JSON.stringify(d);assert.deepEqual(G.attention(d,[{plantId:2,date:new Date('2026-09-01')},{plantId:1,careId:20,date:new Date('2026-09-01')}],stamp.date),{due:[],upcoming:[]});assert.equal(JSON.stringify(d),before);
});
test('existing unresolved concerns without a scheduled check remain actionable',()=>{
 const d=fixture();d.care.push({id:20,plantId:1,entryKind:'Health',status:'Monitoring',symptoms:'Older concern'});const a=G.attention(d,[],stamp.date);assert.equal(a.due.length,1);assert.equal(a.due[0].kind,'Review Health Concern');assert.equal(a.due[0].careId,20);
});
test('completed quick concern does not return as an unscheduled legacy reminder',()=>{
 const d=fixture(),[c]=G.quickHealth(d,{plantId:1},stamp);c.incomplete=false;c.status='Monitoring';assert.equal(G.attention(d,[],stamp.date).due.length,0);c.status='Needs attention';assert.equal(G.attention(d,[],stamp.date).due.length,1);
});

function installed(){
 const d=fixture(),elements={},events={};
 function element(id){return elements[id]??=( {id,style:{},dataset:{},value:'',children:[],focus(){},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(type,fn){this[type]=fn;}});}
 const document={getElementById:element,activeElement:{isConnected:true,focus(){}},body:{},addEventListener(name,cb){events[name]=cb;},querySelectorAll(){return Object.values(elements).filter(e=>e.id.startsWith('f_'));}};
 const context={db:d,document,Date,console,localISODate:()=>stamp.date,timeNow:()=>stamp.time,carePlantName:p=>p.nickname||p.profile,esc:v=>String(v??''),upcomingCareTasks:()=>[],save(){context.saved=JSON.parse(JSON.stringify(d));},clearDraft(){},recordGardenJournal(){},alert(){},shortLabel:s=>s,timeNow:()=>stamp.time,
  show(markup){context.markup=markup;},closeSheet(){context.closed=true;},renderAll(){},openAskAssistant(){},openCareEntry(){element('f_status').value='Needs attention';},openPlantDetail(){},editCareEntry(){},openFollowUpResolve(){},openWateringSnooze(){}};
 context.window=context;context.globalThis=context;vm.createContext(context);
 const html=fs.readFileSync('index.html','utf8');
 vm.runInContext(html.slice(html.indexOf('function submitCareEntry('),html.indexOf('function isHealthResolved(')),context);
 vm.runInContext(html.slice(html.indexOf('function submitForm('),html.indexOf('function saveAndOpenCareLog(')),context);
 vm.runInContext("const TYPE_KEY={plant:'plants'};",context);
 vm.runInContext(fs.readFileSync('garden-dashboard.js','utf8'),context);
 return {context,d,element};
}
test('full concern save uses real app save logic and clears only the completion flag',()=>{
 const h=installed(),[c]=G.quickHealth(h.d,{plantId:1,note:'Yellow leaves and wet soil.'},stamp);h.context.openCareEntry(1,'health',c.id);assert.equal(h.element('f_status').value,'Monitoring');
 for(const [key,value]of Object.entries({symptoms:c.symptoms,date:c.date,action:'Checked soil',follow:'2026-09-11',followChoice:'date',status:'Monitoring'}))h.element('f_'+key).value=value;
 assert.equal(h.context.submitCareEntry(1,'health',c.id),true);assert.equal(h.d.care.length,1);assert.equal(h.d.care[0].incomplete,false);assert.equal(h.d.care[0].symptoms,c.symptoms);assert.equal(h.d.care[0].date,stamp.date);assert.equal(h.context.saved.care[0].incomplete,false);
});
test('failed full concern validation retains the unfinished reminder',()=>{
 const h=installed(),[c]=G.quickHealth(h.d,{plantId:1},stamp);h.element('f_symptoms').value='';assert.equal(h.context.submitCareEntry(1,'health',c.id),false);assert.equal(c.incomplete,true);assert.equal(G.attention(h.d,[],stamp.date).due.length,1);
});
test('full plant save uses real app edit path and preserves captured date and type',()=>{
 const h=installed(),[p]=G.quickPlant(h.d,{nickname:'Fern',profile:'Boston Fern',acquired:'2026-09-01'},stamp);h.element('f_location').value='Kitchen';assert.equal(h.context.submitForm('plant',p.id),true);const saved=h.d.plants.find(x=>x.id===p.id);assert.equal(saved.incomplete,false);assert.equal(saved.acquired,'2026-09-01');assert.equal(saved.profile,'Boston Fern');assert.equal(saved.location,'Kitchen');assert.equal(h.context.saved.plants.at(-1).incomplete,false);
});
test('quick forms remain minimal and full workflow chooser is distinct',()=>{
 const h=installed();h.context.openGardenQuick('health');assert.match(h.context.markup,/quickPlantId/);assert.match(h.context.markup,/quickNote/);assert.doesNotMatch(h.context.markup,/f_pest|f_follow|formBox|f_symptoms/);
 h.context.openGardenQuick('plant');assert.match(h.context.markup,/quickAcquired/);assert.doesNotMatch(h.context.markup,/f_location|f_pot|formBox/);
 h.context.openGardenQuick('care');assert.match(h.context.markup,/quickAction/);assert.doesNotMatch(h.context.markup,/f_follow|formBox/);
 h.context.openGardenFull('health');assert.match(h.context.markup,/Open full Health Concern form/);assert.doesNotMatch(h.context.markup,/quickNote/);
});
test('Dashboard contains four compact cards and no expanded lists or old hero',()=>{
 const html=fs.readFileSync('index.html','utf8').match(/<section id="dashboard"[\s\S]*?<\/section>/)[0];
 const visible=html.replace(/<div class="gardenLegacyHooks"[\s\S]*?<\/section>/,'');
 assert.equal((visible.match(/class="gardenSummaryCard /g)||[]).length,4);
 for(const removed of ['gardenAttentionList','gardenUpcomingList','Today / upcoming','Garden snapshot','llgDashboardHero','llgGardenPicture','kBudget','dashboardSalesSnapshot'])assert.ok(!visible.includes(removed),removed+' must not occupy the Dashboard');
 assert.match(visible,/openGardenOverview\('attention'\)/);assert.match(visible,/openGardenOverview\('upcoming'\)/);
 assert.match(visible,/go\('plants'\)/);assert.match(visible,/go\('propagation'\)/);
 const headings=['Garden at a glance','Quick Add','Recent Activity'].map(s=>visible.indexOf(s));assert.ok(headings.every((p,i)=>p>=0&&(!i||p>headings[i-1])));
 assert.match(visible,/openGardenQuick\('health'\)/);assert.match(visible,/openGardenQuick\('care'\)/);assert.match(visible,/openGardenQuick\('plant'\)/);
});
test('overview counts use live attention state and details open only on request',()=>{
 const h=installed();G.quickHealth(h.d,{plantId:1,note:'Yellow leaf'},stamp);G.quickPlant(h.d,{nickname:'Fern',profile:'Boston Fern'},stamp);h.d.prop=[{status:'Rooting'},{status:'Rooted',destination:'Sell',saleStatus:'Listed'},{status:'Rooted',destination:'Gift'},{status:'Rooted',destination:'Keep'},{status:'Rooted',saleStatus:'Sold'},{status:"Didn't survive"}];h.context.renderAll();
 assert.equal(h.element('gardenAttentionCount').textContent,2);assert.equal(h.element('gardenDueCount').textContent,0);assert.equal(h.element('kPlantsDash').textContent,3);assert.equal(h.element('kPropDash').textContent,'2');
 h.context.openGardenOverview('attention');assert.match(h.context.markup,/Finish Health Concern/);assert.match(h.context.markup,/Finish plant profile/);assert.match(h.context.markup,/openGardenAttention/);
 h.context.openGardenOverview('upcoming');assert.match(h.context.markup,/No care scheduled/);assert.doesNotMatch(h.context.markup,/Yellow leaf/);
});
test('Due Soon count and detail panel reuse the upcoming care window',()=>{
 const h=installed();h.context.upcomingCareTasks=()=>[{plantId:1,name:'Sunny',kind:'Watering due',date:new Date('2026-09-10T12:00:00')},{plantId:2,name:'Spike',kind:'Watering due',date:new Date('2026-10-01T12:00:00')}];h.context.renderAll();
 assert.equal(h.element('gardenDueCount').textContent,1);h.context.openGardenOverview('upcoming');assert.match(h.context.markup,/Sunny/);assert.doesNotMatch(h.context.markup,/Spike/);
});
test('recent activity is limited to three rows without deleting care history',()=>{
 const h=installed(),recent=h.element('recentActivity');recent.children=[1,2,3,4,5];Object.defineProperty(recent,'lastElementChild',{get(){return {remove(){recent.children.pop();}};}});h.d.care=[{id:1},{id:2},{id:3},{id:4},{id:5}];h.context.renderAll();assert.equal(recent.children.length,3);assert.equal(h.d.care.length,5);
});
test('empty overview panel focuses its close control',()=>{
 const h=installed();let focused=false;h.element('overlay').querySelector=()=>({focus(){focused=true;}});h.context.openGardenOverview('attention');assert.equal(focused,true);
});
