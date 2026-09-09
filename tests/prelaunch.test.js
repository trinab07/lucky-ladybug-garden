const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=require('node:fs').readFileSync('index.html','utf8');
function context(extra={}){const c={...extra};c.window=c;vm.createContext(c);return c;}
test('Recent Activity orders dates and both 12-hour and 24-hour times without mutating history',()=>{
 const care=[{id:1,date:'2020-01-01'},{id:2,date:'2026-09-08',time:'9:00 AM'},{id:3,date:'2026-09-08',time:'2:00 PM'},{id:4,date:'2026-09-08',time:'23:00'}];
 const c=context({db:{care}});vm.runInContext(html.slice(html.indexOf('function recentCareEntries()'),html.indexOf('async function setBudget()')),c);
 assert.deepEqual(Array.from(c.recentCareEntries(),x=>x.id),[4,3,2]);assert.deepEqual(care.map(x=>x.id),[1,2,3,4]);
});
test('failed persistence restores previous data and keeps the full form open',()=>{
 const db={plants:[{id:1},{id:2}]},messages=[];let opened=false;
 const c=context({db,localStorage:{getItem:()=>JSON.stringify({plants:[{id:1}]}),setItem(){throw Error('full');}},document:{getElementById(id){return id==='gardenQuickForm'?null:{classList:{add(){opened=true;},contains(){return true;}}};}},alert:m=>messages.push(m)});
 vm.runInContext(html.slice(html.indexOf('function persistGardenData()'),html.indexOf('function recentCareEntries()')),c);
 assert.throws(()=>c.persistGardenData(),/full/);assert.equal(db.plants.length,1);assert.ok(opened);assert.equal(messages.length,1);
});
for(const completed of [false,true])test('purchase journal waits for amount panel '+(completed?'save':'cancel'),async()=>{
 let finish;const logs=[];const c=context({db:{expenses:[{id:1,actual:0,item:'Pot',category:'Pots'}]},markExpensePurchased:()=>new Promise(r=>finish=r),_0x5c9c4a:(...a)=>logs.push(a),money:n=>'$'+n});
 vm.runInContext(html.slice(html.indexOf("const _0x50233c=window['markExpensePurchased']"),html.indexOf("const _0x584d78=window['saveBudgetSetup']")),c);
 const pending=c.markExpensePurchased(1);assert.equal(logs.length,0);c.db.expenses[0].actual=24.65;finish(completed);await pending;assert.equal(logs.length,completed?1:0);if(completed)assert.match(logs[0][2].detail,/24\.65/);
});
test('category transfer journal waits for the completed transfer',async()=>{
 let finish;const logs=[];const c=context({db:{settings:{categoryBudgets:{Plants:50,Pots:20}}},transferBudgetMoney:()=>new Promise(r=>finish=r),_0x5c9c4a:(...a)=>logs.push(a),money:n=>'$'+n});
 vm.runInContext(html.slice(html.indexOf("const _0x28732c=window['transferBudgetMoney']"),html.indexOf("const _0x2a08f8=window['confirmArchivePlant']")),c);
 const pending=c.transferBudgetMoney('Plants','Pots',12.35);assert.equal(logs.length,0);c.db.settings.categoryBudgets.Pots=32.35;finish();await pending;assert.equal(logs.length,1);assert.match(logs[0][2].detail,/12\.35/);
});
test('Wishlist category totals only count purchased expenses as spent',()=>{
 const c=context({db:{expenses:[{category:'Wishlist Plants',purchaseStatus:'planned',plannedAmount:100},{category:'Wishlist Plants',purchaseStatus:'purchased',actual:12.35,date:'2026-09-08'}]},_0x5e1e76:v=>v,_0x450dbf:()=>true,_0x28def6:()=>100});
 vm.runInContext(html.slice(html.indexOf('function _0x1ef1c8('),html.indexOf('function _0xe8a024(')),c);assert.equal(c._0x1ef1c8('Wishlist Plants'),12.35);
});
for(const [value,expected]of [['0',true],['12.35',true],['1000000.25',true],['abc',false],['-10',false],['1.234',false],['Infinity',false]])test('currency validation: '+value,()=>{
 let focused=false;const c=context({document:{getElementById:()=>({value,focus(){focused=true;}})},alert(){}});
 vm.runInContext(html.slice(html.indexOf('function validMoneyFields('),html.indexOf('function isActivePropagation(')),c);
 assert.equal(c.validMoneyFields(['amount']),expected);assert.equal(focused,!expected);
});
test('active propagation excludes kept gifted sold and failed records',()=>{
 const c=context();vm.runInContext(html.slice(html.indexOf('function isActivePropagation('),html.indexOf('function recentCareEntries()')),c);
 assert.equal(c.isActivePropagation({status:'Rooting'}),true);
 assert.equal(c.isActivePropagation({status:'Rooted',destination:'Sell',saleStatus:'Listed'}),true);
 for(const p of [{destination:'Keep'},{destination:'Gift'},{destination:'Share'},{saleStatus:'Sold'},{status:"Didn't survive"}])assert.equal(c.isActivePropagation(p),false);
});
