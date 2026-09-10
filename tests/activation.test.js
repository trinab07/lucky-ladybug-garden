const {test}=require('node:test'),assert=require('node:assert/strict'),fixture=require('./activation-fixture.cjs');
const valid = result => JSON.parse(result.body).valid;
test('purchase permits one context, retries remain idempotent, invalid receipts consume nothing',async()=>{
  const f=fixture();assert.equal(valid(await f.activate('invalid','one')),false);
  assert.equal(f.stores.get('device-activations').size,0);
  assert.equal(valid(await f.activate('valid','one')),true);
  for(let i=0;i<5;i++)assert.equal(valid(await f.activate('valid','one')),true);
  const denied=await f.activate('valid','two');assert.equal(valid(denied),false);assert.match(JSON.parse(denied.body).message,/one installed app context/);
  assert.deepEqual((await f.getStore({name:'device-activations'}).get('receipt-valid')).devices,['one']);
});
test('simultaneous first activations grant exactly one context',async()=>{
  const f=fixture(),results=await Promise.all(Array.from({length:8},(_,i)=>f.activate('valid-race','context-'+i)));
  assert.equal(results.filter(valid).length,1);
});
test('legacy activations are not erased or silently reassigned',async()=>{
  const f=fixture(),store=f.getStore({name:'device-activations'});
  await store.setJSON('receipt-valid-old',{devices:['old-one','old-two']});
  assert.equal(valid(await f.activate('valid-old','old-one')),true);
  assert.equal(valid(await f.activate('valid-old','new')),false);
  assert.deepEqual((await store.get('receipt-valid-old')).devices,['old-one','old-two']);
});
