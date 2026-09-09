const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../ladybug-engine');
const html=fs.readFileSync('index.html','utf8');
const data=id=>JSON.parse(html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'))[1]);
const options={library:data('plant-data'),pests:data('pests-data')};
const groups=[
 [/direct sun|direct exposure/i,['Is this plant getting too much light?','Could my plant be getting too much sun?','Is it too bright?','Are the leaves sunburned?']],
 [/growth|growing/i,['Why isn’t my plant growing?','My plant stopped growing.','Why is growth so slow?','Why did my plant stop growing?','My plant isn’t growing.']],
 [/every leaf|roots.*alive/i,['Can I save a plant with no leaves?','My plant lost every leaf. Can it recover?','My plant lost all its leaves. Is it dead?','Can a plant grow back after losing every leaf?']],
 [/spider mites.*local guide/i,['What should I do about spider mites?','I found spider mites. What now?']],
 [/outdoor.*sun|outdoor suitability/i,['Can I put this plant outside?','Can my houseplant go outdoors?','Can my pothos go outside?','Is it safe to move this outdoors?']],
 [/smaller new leaves/i,['Why are new leaves smaller?','Why is the new growth tiny?','Why is my plant putting out tiny leaves?','New growth is smaller than the old growth.']],
 [/overwatering and underwatering/i,['What does overwatering look like compared with underwatering?','How do I tell too much water from too little?','How can I tell if I’m overwatering or underwatering?','Is my plant too wet or too dry?']]
];
for(const [pattern,questions]of groups)for(const q of questions)test('Launch topic: '+q,()=>{
 const r=E.answer(q,E.createSession(),options);assert.match(r.response,pattern);assert.doesNotMatch(r.response,/what change are you seeing|tell me a little more about what/i);assert.ok((r.response.match(/\?/g)||[]).length<=1);
});
for(const pest of options.pests)test('Named local guide pest: '+pest.pest,()=>{
 const r=E.answer('I found '+pest.pest+'. What now?',E.createSession('pothos'),options);
 assert.ok(r.response.includes(pest.response));assert.ok(r.response.includes(pest.followup));assert.doesNotMatch(r.response,/what do the bugs look like/i);
});
test('Named pests respect negation and corrections',()=>{
 const s=E.createSession('pothos');E.answer('I found spider mites',s,options);
 const r=E.answer('Actually no spider mites. No bugs or webbing.',s,options);assert.equal(r.facts.namedPest,null);assert.doesNotMatch(r.response,/local guide says|labeled treatment/i);
 const next=E.answer('Actually these are aphids',s,options);assert.match(next.response,/for aphids/i);
});
test('Scale for weighing is not a pest observation',()=>{const r=E.answer('Can I use a kitchen scale to weigh my pot?',E.createSession(),options);assert.notEqual(r.facts.namedPest,'scale');});
test('Known plant and direct-sun facts prevent redundant light questions',()=>{
 const s=E.createSession('Golden Pothos');const r=E.answer('My pothos gets 4 hours of direct sun. Is it too bright?',s,options);
 assert.match(r.response,/4 hours/);assert.match(r.response,/guide.*pothos/i);assert.notEqual(r.followup,'plant');assert.notEqual(r.followup,'sunHours');
});
test('Outdoor follow-up uses the newly supplied plant and temperature',()=>{
 const s=E.createSession();E.answer('Can this plant go outside?',s,options);const r=E.answer('Pothos. Nights are 60 F.',s,options);
 assert.match(r.response,/outdoor|outdoors/i);assert.match(r.response,/60 F/);assert.equal(r.followup,null);
});
test('Leafless recovery accepts already-known living tissue and roots',()=>{
 const s=E.createSession('pothos');const r=E.answer('My pothos lost every leaf, but the stems are firm and roots are healthy, not mushy.',s,options);
 assert.match(r.response,/encouraging/);assert.equal(r.followup,null);assert.doesNotMatch(r.response,/throw|discard|are the stems|do they feel/i);
 const next=E.answer('It has leaves now.',s,options);assert.match(next.response,/encouraging sign of recovery/);
});
test('Small-leaf context persists and known moisture is not asked again',()=>{
 const s=E.createSession('pothos');E.answer('Why are new leaves smaller?',s,options);const r=E.answer('It gets bright indirect light and the soil is dry.',s,options);
 assert.match(r.response,/smaller new leaves/i);assert.match(r.response,/support/);assert.equal(r.followup,null);
});
test('Water comparison uses existing soil facts without forcing certainty',()=>{
 const s=E.createSession('pothos');E.answer('The soil is wet.',s,options);const r=E.answer('How do I tell overwatering from underwatering?',s,options);
 assert.match(r.response,/both cause/);assert.match(r.response,/already described wet soil/);assert.notEqual(r.followup,'moisture');
});
test('Focused and routine topics can be answered together',()=>{
 const r=E.answer('Can my pothos go outdoors, and what humidity does it need?',E.createSession(),options);assert.match(r.response,/outdoor/i);assert.match(r.response,/humidity|40–60/);
});
test('General watering comparison needs no personal follow-up',()=>{const r=E.answer('What does overwatering look like compared with underwatering?',E.createSession(),options);assert.equal(r.followup,null);});
test('Explicitly absent direct sun is not positive exposure evidence',()=>{
 const r=E.answer('My pothos gets no direct sun. Is this too much light?',E.createSession(),options);assert.equal(r.facts.sunHours,0);assert.notEqual(r.facts.light,'direct sun');assert.notEqual(r.followup,'sunHours');
});
