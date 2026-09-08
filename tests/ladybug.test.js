const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const E=require('../ladybug-engine');
const cases=[
 ['rotate vs rot','Should I rotate my pothos?',r=>{assert.equal(r.intent,'care');assert.equal(r.facts.rot,undefined);assert.match(r.response,/Turn the pot/)}],
 ['yellow pot','How often should I water my pothos in a yellow pot?',r=>{assert.equal(r.intent,'care');assert.equal(r.health,false)}],
 ['negated pests','My leaves are yellow. No bugs, no webbing, not sticky.',r=>{assert.equal(r.facts.bugs,false);assert.equal(r.facts.webbing,false);assert.equal(r.facts.sticky,false);assert.ok(!r.possibilities.includes('pests'))}],
 ['wet yellow','My pothos has yellow leaves and wet soil.',r=>assert.equal(r.possibilities[0],'watering stress')],
 ['dry yellow','My pothos has yellow leaves and dry soil.',r=>assert.equal(r.possibilities[0],'dryness')],
 ['one old leaf','One old yellow leaf on my pothos.',r=>assert.equal(r.possibilities[0],'normal leaf aging')],
 ['widespread','Most leaves are yellow.',r=>{assert.equal(r.facts.extent,'widespread');assert.ok(!r.possibilities.includes('normal leaf aging'))}],
 ['healthy roots','I thought root rot, but roots are firm and healthy, not mushy.',r=>{assert.equal(r.facts.mushy,false);assert.match(r.response,/Keep those roots intact/);assert.ok(!r.possibilities.includes('root damage'))}],
 ['yellow and bugs','My pothos has yellow leaves and tiny bugs.',r=>assert.equal(r.possibilities[0],'pests')],
 ['humidity','Can my pothos handle low humidity?',r=>{assert.equal(r.intent,'care');assert.match(r.response,/humidity/)}],
 ['typos','My pothus has yelow leavs and wet siol.',r=>{assert.equal(r.plant,'pothos');assert.equal(r.possibilities[0],'watering stress')}],
 ['conflicting moisture','Yellow leaves and soil is wet and dry.',r=>{assert.equal(r.facts.moisture,'conflict');assert.match(r.response,/hold off/)}],
 ['negated mush','Yellow leaves, wet soil, roots not mushy.',r=>assert.ok(!r.possibilities.includes('root damage'))],
 ['watering','How often should I water my snake plant?',r=>assert.match(r.response,/moisture/)],
 ['light','What is bright indirect light?',r=>assert.match(r.response,/without strong direct rays/)],
 ['repot','When should I repot my monstera?',r=>assert.match(r.response,/roots crowd/)],
 ['fertilizer','How often should I fertilize?',r=>assert.match(r.response,/active growth/)],
 ['propagation','How do I propagate pothos?',r=>assert.match(r.response,/node/)],
 ['dust','Should I clean dusty leaves?',r=>assert.match(r.response,/soft damp cloth/)],
 ['slow hoya','My hoya is growing really slow.',r=>{assert.doesNotMatch(r.response,/node|cutting|propagat/i);assert.equal(r.followup,'light')}],
 ['multiple care','What light and humidity does my pothos need?',r=>{assert.match(r.response,/humidity/);assert.match(r.response,/indirect/)}]
];for(const [name,q,check]of cases)test(name,()=>check(E.answer(q)));
test('conversation uses moisture and correction',()=>{const s=E.createSession();E.answer('Yellow leaves',s);const r=E.answer('Dry',s);assert.equal(r.possibilities[0],'dryness');assert.notEqual(r.followup,'moisture');const c=E.answer('Actually the soil is wet',s);assert.equal(c.possibilities[0],'watering stress')});
test('no repeated question',()=>{const s=E.createSession();const results=['yellow leaves',"I do not know","I do not know","I do not know"].map(q=>E.answer(q,s));const keys=results.map(r=>r.followup).filter(Boolean);assert.equal(new Set(keys).size,keys.length)});
test('new plant resets old symptoms',()=>{const s=E.createSession();E.answer('My pothos has yellow leaves and wet soil',s);E.answer('My hoya is growing slow',s);assert.equal(s.facts.yellow,undefined)});
test('new care question leaves symptom context',()=>{const s=E.createSession();E.answer('Yellow leaves',s);assert.equal(E.answer('How often should I fertilize?',s).health,false)});
test('all page scripts parse and unrelated page content preserved',()=>{const html=fs.readFileSync('index.html','utf8');for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){if(!m[1].includes('application/json'))new vm.Script(m[2]);}const strip=s=>s.replace(/<script[\s\S]*?<\/script>/g,'').replace(/\s+/g,' ');assert.equal(require('crypto').createHash('sha256').update(strip(html)).digest('hex'),'d4867d6d2aa265ff7eee00bbf3d36923be53e874222065b15ae4f5a9758669e9');assert.ok(html.includes('ladybug-engine.js'));});
function ui(){const html=fs.readFileSync('index.html','utf8');const elements={askQuestion:{value:'',focus(){}},askAssistantResult:{children:[],appendChild(x){this.children.push(x)},insertAdjacentHTML(){}},askSavedPlant:{value:''}};const make=()=>({children:[],appendChild(x){this.children.push(x)},scrollIntoView(){}});const ctx={Ladybug:E,db:{plants:[{id:7,name:'My Pothos',profile:'Golden Pothos'}]},LIB:[{name:'Golden Pothos',soilCheck:'top 1–2 in are dry'}],carePlantName:p=>p.name,alphaStrip:x=>x,esc:x=>x,meta:{},document:{getElementById:id=>elements[id],createElement:make,createTextNode:text=>({textContent:text}),addEventListener(){}},show(h){ctx.markup=h},openHealthFromAsk(...args){ctx.handoff=args}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(html.match(/<script id="ll-mod-16">([\s\S]*?)<\/script>/)[1],ctx);vm.runInContext(fs.readFileSync('ladybug-ui.js','utf8'),ctx);return {ctx,elements};}
test('saved plant selection executes without askCtx error',()=>{const {ctx,elements}=ui();ctx.openAskAssistant();assert.ok(ctx.markup.includes('selectLadybugPlant(this.value)'));ctx.selectLadybugPlant('My Pothos');elements.askQuestion.value='How should I water it?';ctx.runAskAssistant();assert.match(elements.askAssistantResult.children[1].children[1].textContent,/top 1–2/)});
test('Health Concern button preserves plant and full conversation',()=>{const {ctx,elements}=ui();ctx.openAskAssistant('My Pothos');for(const q of ['Yellow leaves',"Actually the soil is wet. It's soggy."]){elements.askQuestion.value=q;ctx.runAskAssistant();}const bot=elements.askAssistantResult.children.at(-1);bot.children.at(-1).children[0].onclick();assert.equal(ctx.handoff[0],7);assert.match(ctx.handoff[1],/Yellow leaves\nActually/)});
test('care produces no Health Concern button',()=>{const {ctx,elements}=ui();ctx.openAskAssistant('My Pothos');elements.askQuestion.value='Should I rotate it?';ctx.runAskAssistant();assert.equal(elements.askAssistantResult.children[1].children.length,2)});

test('conflicting roots require clarification',()=>{const r=E.answer('The roots are firm but some roots are mushy.');assert.match(r.response,/hold off/);assert.ok(r.followup)});
test('same-turn correction overrides earlier symptom',()=>{const r=E.answer('There are bugs. Actually no bugs. Yellow leaves.');assert.equal(r.facts.bugs,false)});
test('absent webbing does not cancel visible bugs',()=>{const r=E.answer('No webbing, but tiny bugs on yellow leaves.');assert.equal(r.facts.webbing,false);assert.equal(r.possibilities[0],'pests')});
