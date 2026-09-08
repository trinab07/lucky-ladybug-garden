const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../ladybug-engine');
const library=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script id="plant-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const ask=(q,s=E.createSession(),extra={})=>E.answer(q,s,{library,...extra});

test('firm healthy roots are acknowledged without asking for their condition',()=>{
 const r=ask('I thought root rot, but roots are firm and healthy, not mushy.');
 assert.match(r.response,/active root rot less likely/);assert.equal(r.followup,null);assert.doesNotMatch(r.response,/\?/);
});
test('earlier root facts answer later rot question',()=>{
 const s=E.createSession();ask('The roots are firm and healthy, not mushy.',s);
 const r=ask('Could it be root rot?',s);assert.equal(r.followup,null);assert.match(r.response,/less likely/);
});
test('pothos humidity is a direct care answer',()=>{
 const r=ask('Can my pothos handle low humidity?');assert.match(r.response,/Pothos.*household humidity/);
 assert.doesNotMatch(r.response,/diagnos|symptom|rot|stress|depends on the plant/i);assert.equal(r.followup,null);assert.equal(r.health,false);
});
test('pothos propagation gives actionable species-specific steps',()=>{
 const r=ask('How do I propagate pothos?');for(const re of [/below a node/,/lowest leaf/,/above/,/roots/])assert.match(r.response,re);
 assert.doesNotMatch(r.response,/monstera|hoya|depends/i);assert.equal(r.followup,null);
});
test('wet-soil wording is natural and does not ask about known drainage',()=>{
 const r=ask('My pothos has yellow leaves and wet soil. It has drainage holes.');
 assert.match(r.response,/Check deeper around the roots/);assert.doesNotMatch(r.response,/usual watering point|approach|diagnos/);assert.equal(r.followup,null);
});
test('slow Hoya does not invent propagation history',()=>{
 const r=ask('My hoya is growing really slow.');assert.doesNotMatch(r.response,/cutting|node|immature|propagat/);assert.equal(r.followup,'light');
});
test('known light and season inform slow growth without more questions',()=>{
 const s=E.createSession();ask('My hoya is growing really slow.',s);
 const r=ask('It gets bright indirect light. It is winter.',s);assert.equal(r.followup,null);assert.match(r.response,/winter/);assert.doesNotMatch(r.response,/cutting|node/);
});
test('cutting advice requires actual history and uses a supplied node answer',()=>{
 const s=E.createSession();ask('My hoya is growing really slow. It started as a leaf cutting.',s);
 const r=ask('No node.',s);assert.equal(r.facts.node,false);assert.match(r.response,/Without a stem node/);assert.equal(r.followup,null);
});
test('light and humidity answered coherently for known pothos',()=>{
 const r=ask('What light and humidity does my pothos need?');assert.match(r.response,/bright indirect light/);assert.match(r.response,/40–60%/);assert.equal(r.followup,null);assert.ok(r.response.length<500);
});
test('routine care never invokes unused question templates',()=>{
 for(const q of ['Should I rotate it?','How often should I water it?','Should I wipe dusty leaves?','How often should I fertilize?']){
  const s=E.createSession(),r=ask(q,s);assert.equal(r.followup,null,q);assert.deepEqual(s.asked,[],q);assert.doesNotMatch(r.response,/diagnos|root rot|symptoms/i,q);
 }
});
test('unknown plant answer continues original care topic',()=>{
 const s=E.createSession();assert.equal(ask('How do I propagate it?',s).followup,'plant');
 const r=ask('Pothos',s);assert.match(r.response,/cut a healthy vine/);assert.equal(r.followup,null);
});
test('care topic changes preserve relevant conditions',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and wet soil.',s);
 const r=ask('How should I water it?',s);assert.equal(r.intent,'care');assert.equal(r.health,false);assert.equal(r.facts.moisture,'wet');assert.match(r.response,/Do not water while the soil is still wet/);assert.doesNotMatch(r.response,/diagnos|yellow|root rot/);
});
test('care topic changes preserve earlier light and question history',()=>{
 const s=E.createSession();ask('My hoya is growing really slow.',s);ask('It gets low light.',s);ask('What humidity does it need?',s);
 const r=ask('Still growing slow.',s);assert.match(r.response,/low light/);assert.equal(r.followup,null);assert.equal(s.asked.filter(k=>k==='light').length,1);
});
test('care questions do not invent a move or a current light condition',()=>{
 const s=E.createSession();ask('Should I repot my hoya?',s);ask('Does it need bright indirect light?',s);
 assert.equal(s.facts.changes,undefined);assert.equal(s.facts.light,undefined);
});
test('all recognized care topics are answered without arbitrary truncation',()=>{
 const r=ask('What light, humidity, soil and fertilizer does my pothos need?');
 for(const re of [/bright indirect light/,/40–60%/,/aroid mix/,/spring and summer/])assert.match(r.response,re);
 assert.equal(r.followup,null);
});
test('propagation in water does not trigger unrelated watering advice',()=>{
 const r=ask('How do I propagate pothos in water?');assert.match(r.response,/node/);assert.doesNotMatch(r.response,/top 1–2|calendar/);
});
test('rooting-time follow-up answers timing instead of repeating steps',()=>{
 const s=E.createSession();ask('How do I propagate pothos?',s);const r=ask('How long until roots grow?',s);
 assert.match(r.response,/Rooting time/);assert.doesNotMatch(r.response,/Remove the lowest leaf/);
});
test('guide resolver uses shared family fields and refuses inconsistent ones',()=>{
 assert.match(E.resolveProfile('snake plant',library).soilCheck,/completely/);
 assert.deepEqual(E.resolveProfile('test plant',[{name:'Red Test Plant',light:'bright',soil:'airy'},{name:'Blue Test Plant',light:'low',soil:'airy'}]),{soil:'airy'});
});
test('known snake plant receives guide-specific watering',()=>{
 const r=ask('How should I water my snake plant?');assert.match(r.response,/dry completely/);assert.doesNotMatch(r.response,/depends|right drying point/i);
});
test('known calathea receives guide-specific humidity',()=>{
 const r=ask('What humidity does my calathea need?');assert.match(r.response,/50–70%/);assert.equal(r.followup,null);
});
test('same-turn correction replaces earlier moisture',()=>{
 const r=ask('My pothos has yellow leaves. The soil is wet. Actually the soil is dry.');assert.equal(r.facts.moisture,'dry');assert.equal(r.possibilities[0],'dryness');
});
test('root correction clears stale opposing evidence but keeps unrelated facts',()=>{
 const s=E.createSession();ask('Yellow leaves, wet soil, mushy roots.',s);
 const r=ask('Actually the roots are firm and healthy.',s);assert.equal(r.facts.mushy,false);assert.equal(r.facts.moisture,'wet');assert.equal(r.facts.yellow,true);assert.ok(!r.possibilities.includes('root damage'));assert.notEqual(r.followup,'roots');
});
test('root conflict can resolve to a mixture of firm and soft roots',()=>{
 const s=E.createSession();ask('The roots are firm but some roots are mushy.',s);
 const r=ask('Some are soft and the others are firm.',s);assert.equal(r.facts.rootCondition,undefined);assert.equal(r.possibilities[0],'root damage');assert.equal(r.followup,null);assert.doesNotMatch(r.response,/rot less likely/);
});
test('short drainage follow-up supplies the requested fact',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and wet soil.',s);
 const r=ask('Nope',s);assert.equal(r.facts.drainage,false);assert.equal(r.followup,null);assert.match(r.response,/pot with drainage holes/);
});
test('both supplied pest details prevent a redundant question',()=>{
 const r=ask('Tiny black bugs flying around the soil and yellow leaves.');assert.equal(r.followup,null);assert.match(r.response,/soil surface/);
});
test('pest follow-up asks only for the missing appearance',()=>{
 const s=E.createSession();const r=ask('Tiny bugs on the leaves and yellow leaves.',s);
 assert.equal(r.followup,'pestDetail');assert.match(r.response,/What do the bugs look like\?/);assert.doesNotMatch(r.response,/where|are they on/i);
 const next=ask('They are black and crawling.',s);assert.equal(next.followup,null);assert.equal(next.facts.pestLocation,'on the leaves');
});
test('pest follow-up asks only for missing location',()=>{
 const r=ask('Tiny black bugs and yellow leaves.');assert.match(r.response,/Are they on the leaves or around the soil\?/);assert.doesNotMatch(r.response,/What do the bugs look like/);
});
test('negated pest correction does not negate continuing yellow leaves',()=>{
 const s=E.createSession();ask('Tiny black bugs on the leaves and yellow leaves.',s);
 const r=ask('Actually no bugs now, still yellow leaves.',s);assert.equal(r.facts.bugs,false);assert.equal(r.facts.yellow,true);assert.ok(!r.possibilities.includes('pests'));
});
test('dry soil needs no unrelated timing question',()=>{
 const r=ask('My pothos is droopy and the soil is dry.');assert.equal(r.followup,null);assert.doesNotMatch(r.response,/when did|wait until/i);
});
test('clarification respects soil depth instead of preserving a false conflict',()=>{
 const s=E.createSession();ask('Yellow leaves and soil is wet and dry.',s);
 const r=ask('Dry on top but wet deeper down.',s);assert.equal(r.facts.moisture,'wet');assert.notEqual(r.followup,'moisture');
});
test('conflict clarification is not repeated when user cannot answer',()=>{
 const s=E.createSession();ask('Yellow leaves and soil is wet and dry.',s);
 const r=ask('I am not sure.',s);assert.equal(r.followup,null);assert.doesNotMatch(r.response,/\?/);
});
test('saved alias can be referred to by species without losing state',()=>{
 const s=E.createSession('Sunny'),options={aliases:{Sunny:'Golden Pothos'}};
 ask('Yellow leaves and wet soil.',s,options);
 const r=ask('How should I water my pothos?',s,options);assert.equal(r.plant,'Sunny');assert.equal(r.facts.moisture,'wet');assert.match(r.response,/Check deeper around the roots/);
});
test('different plant starts fresh but still gets specific care',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and wet soil.',s);
 const r=ask('What humidity does my calathea need?',s);assert.equal(r.facts.yellow,undefined);assert.equal(r.facts.moisture,undefined);assert.match(r.response,/50–70%/);
});
test('casual care topic and typo preserve plant context',()=>{
 const s=E.createSession();ask('Can my pothus handle low humidty?',s);
 const r=ask('And light?',s);assert.equal(r.plant,'pothos');assert.equal(r.intent,'care');assert.match(r.response,/bright indirect light/);
});

test('guide fragments become natural humidity and light sentences',()=>{
 assert.doesNotMatch(ask('What humidity does my calathea need?').response,/prefers humidity lover|prefers average/);
 const r=ask('What light does my hoya need?');assert.match(r.response,/A little gentle direct sun can help/);
});
test('humidity question does not introduce misting unless asked',()=>{
 assert.doesNotMatch(ask('What humidity does my hoya need?').response,/mist/i);
 assert.match(ask('Should I mist my hoya?').response,/Misting changes humidity only briefly/);
});
test('drainage reply acknowledges the answer rather than repeating a diagnosis',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and wet soil.',s);
 const r=ask('Yes, it has drainage holes.',s);assert.match(r.response,/water has a way out/);assert.doesNotMatch(r.response,/contributing to the yellowing/);
});
test('moisture-loving guide advice does not tell the user to dry the soil completely',()=>{
 const r=ask('How should I water my fern?',E.createSession(),{profile:{soilCheck:'Keep lightly moist; do not leave soggy'}});
 assert.match(r.response,/Keep the soil lightly moist/);assert.doesNotMatch(r.response,/let it dry completely/);
});
test('direct care request is answered even when user adds an observed symptom',()=>{
 const r=ask('What light does my pothos need? Its leaves are yellow.');assert.equal(r.intent,'care');assert.match(r.response,/bright indirect light/);assert.equal(r.followup,null);assert.equal(r.facts.yellow,true);
});
test('thanks does not repeat care advice or lose pending question context',()=>{
 const s=E.createSession();ask('Yellow leaves',s);const r=ask('Thanks!',s);assert.equal(r.response,'You’re welcome!');
 assert.equal(ask('Dry',s).facts.moisture,'dry');
});
test('correction after care topic updates facts rather than replaying the unrelated topic',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and dry soil.',s);ask('What humidity does it need?',s);
 const r=ask('Actually the soil is wet.',s);assert.equal(r.facts.moisture,'wet');assert.equal(r.possibilities[0],'watering stress');assert.doesNotMatch(r.response,/40–60%/);
});

test('short moisture correction uses the earlier soil context',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and dry soil.',s);
 const r=ask("Actually it's wet.",s);assert.equal(r.facts.moisture,'wet');assert.equal(r.possibilities[0],'watering stress');
});
test('denying earlier moisture removes stale evidence without assuming its opposite',()=>{
 const s=E.createSession();ask('Yellow leaves and wet soil.',s);
 const r=ask('Actually the soil is not wet.',s);assert.equal(r.facts.moisture,undefined);assert.ok(!r.possibilities.includes('watering stress'));assert.ok(!r.possibilities.includes('dryness'));assert.doesNotMatch(r.response,/feel wet/);
});
test('short leaf description is not mistaken for a moisture correction',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and wet soil.',s);
 const r=ask('The leaf tips are dry.',s);assert.equal(r.facts.moisture,'wet');
});

test('care replies do not treat a separate condition statement as a requested topic',()=>{
 const r=ask('How should I water my pothos? The soil is wet.');assert.match(r.response,/Do not water while the soil is still wet/);assert.doesNotMatch(r.response,/aroid mix/);
});
test('incidental wet soil in a watering question does not request a soil recipe',()=>{
 const r=ask('How should I water my pothos with wet soil?');assert.doesNotMatch(r.response,/aroid mix/);assert.match(r.response,/Do not water/);
});

test('dry top and wet deeper soil overrides routine pothos surface rule',()=>{
 const r=ask('My pothos has yellow leaves. The soil is dry on top but still wet deeper around the roots.');
 assert.equal(r.facts.deepMoisture,'wet');assert.equal(r.facts.moisture,'wet');assert.match(r.response,/do not water yet/);assert.match(r.response,/Check moisture deeper in the root zone/);assert.doesNotMatch(r.response,/top 1–2/);
});
test('deeper moisture persists through a routine care follow-up and surface-only update',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves. The soil is dry on top but wet deeper down.',s);
 ask('The top of the soil is dry now.',s);const r=ask('How should I water it?',s);
 assert.equal(r.facts.deepMoisture,'wet');assert.match(r.response,/do not water yet/);assert.doesNotMatch(r.response,/top 1–2/);
});
test('saturated root zone receives deeper-moisture advice without explicit soil word',()=>{
 const r=ask('My pothos has yellow leaves and the root zone is saturated.');assert.equal(r.facts.moisture,'wet');assert.match(r.response,/do not water yet/);assert.doesNotMatch(r.response,/top 1–2/);
});
test('very wet soil never falls back to surface-dry permission to water',()=>{
 const r=ask('My pothos has yellow leaves and very wet soil.');assert.match(r.response,/Do not water/);assert.match(r.response,/Check deeper/);assert.doesNotMatch(r.response,/top 1–2/);
});
test('a genuine deeper drying update replaces stored wet conditions',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and the soil is wet deeper down.',s);
 const r=ask('Actually the soil is dry deeper around the roots now.',s);assert.equal(r.facts.deepMoisture,'dry');assert.equal(r.possibilities[0],'dryness');
});
test('denied deep wetness does not persist as stale positive evidence',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and the root zone is wet.',s);
 const r=ask('Actually the root zone is not wet.',s);assert.equal(r.facts.deepMoisture,undefined);assert.equal(r.facts.moisture,undefined);assert.ok(!r.possibilities.includes('watering stress'));
});
test('routine pothos watering still uses the normal guide when no wet evidence exists',()=>{
 const r=ask('How should I water my pothos?');assert.match(r.response,/top 1–2 inches are dry/);assert.doesNotMatch(r.response,/still wet/);
});
test('recovery fertilizer transition is natural without changing schedule',()=>{
 const s=E.createSession();ask('My pothos has yellow leaves and wet soil.',s);const r=ask('How often should I fertilize?',s);
 assert.match(r.response,/Once it is growing normally again, you can feed/);assert.match(r.response,/monthly in spring and summer/);assert.doesNotMatch(r.response,/For regular care:/);
});
