const {test}=require('node:test'),assert=require('node:assert/strict');
const {createUI}=require('./ladybug-ui-harness');
const scenarios=require('./ladybug-review-scenarios');
for(const scenario of scenarios)test('review conversation: '+scenario.title,()=>{
 const ui=createUI();
 for(const turn of scenario.turns){
  if(turn.select){ui.select(turn.select);continue;}
  const r=ui.ask(turn),bot=ui.lastBot();
  assert.equal(bot.children[r.plant?1:0].textContent,r.response);
  assert.ok(r.response.length>10);assert.ok(r.response.length<1000,turn);
  assert.ok((r.response.match(/\?/g)||[]).length<=1,turn);
  assert.doesNotMatch(r.response,/undefined|\[object Object\]|usual watering point|not a diagnosis/);
 }
});
test('saved plant switch uses a fresh profile and no old symptom handoff',()=>{
 const ui=createUI();ui.select('Sunny');ui.ask('Yellow leaves and wet soil.');
 ui.select('Spike');const r=ui.ask('How should I water it?');
 assert.equal(r.plant,'Spike');assert.equal(r.facts.moisture,undefined);assert.equal(r.health,false);assert.match(r.response,/dry completely/);assert.equal(ui.lastBot().children.length,2);
});
test('saved nickname survives species reference and Health Concern keeps its ID',()=>{
 const ui=createUI();ui.select('Sunny');ui.ask('Yellow leaves and wet soil.');
 const care=ui.ask('How should I water my pothos?');assert.equal(care.plant,'Sunny');assert.match(care.response,/Check deeper around the roots/);
 ui.ask('Still yellow leaves. It has drainage holes.');ui.lastBot().children.at(-1).children[0].onclick();
 assert.equal(ui.context.handoff[0],7);assert.match(ui.context.handoff[1],/Yellow leaves and wet soil\./);assert.match(ui.context.handoff[1],/How should I water my pothos\?/);
});
test('saved plant switching changes the Health Concern target',()=>{
 const ui=createUI();ui.select('Sunny');ui.ask('Yellow leaves and wet soil.');
 ui.select('Spike');ui.ask('Yellow leaves and wet soil.');ui.lastBot().children.at(-1).children[0].onclick();assert.equal(ui.context.handoff[0],8);assert.equal(ui.context.handoff[1],'Yellow leaves and wet soil.');
});
