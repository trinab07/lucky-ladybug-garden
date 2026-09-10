// Isolated fake Etsy/Blobs adapters; never use customer receipts or production storage.
const fs = require('node:fs'), vm = require('node:vm');
module.exports = function fixture() {
  const stores = new Map(); let requests = 0;
  function getStore({name}) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return {
      async get(key) { return map.has(key) ? structuredClone(map.get(key).data) : null; },
      async getWithMetadata(key) { return map.has(key) ? structuredClone(map.get(key)) : null; },
      async setJSON(key, data, options = {}) {
        const old = map.get(key);
        if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch)) return {modified:false};
        const etag = String(Number(old?.etag || 0) + 1);
        map.set(key, {data:structuredClone(data),etag}); return {modified:true,etag};
      }
    };
  }
  getStore({name:'etsy-auth'}).setJSON('shop-refresh-token',{refresh_token:'isolated-fixture'});
  const exports = {};
  vm.runInNewContext(fs.readFileSync('netlify/functions/etsy-verify.js','utf8'), {
    exports, require: () => ({getStore}), URLSearchParams, console, Date,
    process:{env:{ETSY_SHOP_ID:'fixture',ETSY_API_KEY:'fixture',ETSY_SHARED_SECRET:'fixture'}},
    fetch: async url => {
      if (url.includes('/oauth/token')) return {ok:true,json:async()=>({access_token:'fixture',refresh_token:'fixture'})};
      const valid = /\/receipts\/valid[-\w]*$/.test(url);
      return {ok:valid,status:valid?200:404,json:async()=>({}),text:async()=>''};
    }
  });
  return {stores, getStore, get requests(){return requests;}, async activate(code,deviceId){requests++;return exports.handler({httpMethod:'POST',body:JSON.stringify({code,deviceId})});}};
};
