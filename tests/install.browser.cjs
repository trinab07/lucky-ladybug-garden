// Real Edge rendering with simulated standalone platform signals, isolated data/receipts.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=require('./activation-fixture.cjs')();
const root=path.resolve('.'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(route==='/.netlify/functions/etsy-verify'){
    let body='';for await(const c of req)body+=c;
    const data=JSON.parse(body),result=await fixture.activate(data.code,data.deviceId);res.writeHead(result.statusCode,result.headers);return res.end(result.body);
  }
  const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]||!fs.existsSync(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',mime[path.extname(file)]);res.end(fs.readFileSync(file));
});
const checks=[];function check(name,value){assert.ok(value,name);checks.push(name);console.log('PASS',name);}
async function installed(context,ios=false){
  await context.addInitScript(ios ? ()=>Object.defineProperty(navigator,'standalone',{get:()=>true}) : ()=>{
    const original=window.matchMedia.bind(window);window.matchMedia=query=>query==='(display-mode: standalone)'?{matches:true,addEventListener(){},removeEventListener(){}}:original(query);
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const normal=await browser.newContext({viewport:{width:393,height:852}}),page=await normal.newPage();
    await page.goto(url);await page.locator('#installSteps').waitFor();
    check('ordinary browser hides activation and garden',!(await page.locator('#activationForm').isVisible())&&!(await page.locator('#gardenApp').isVisible()));
    check('ordinary browser does not initialize garden or create garden records',await page.evaluate(()=>typeof window.go==='undefined'&&localStorage.getItem('llg_full_app_v58')===null));
    await page.evaluate(()=>{localStorage.setItem('llg_unlocked_v1','yes');localStorage.setItem('llg_full_app_v58',JSON.stringify({plants:[{id:9,nickname:'Existing record'}]}));});
    await page.reload();check('old browser unlock cannot bypass install gate',!(await page.locator('#gardenApp').isVisible()));
    check('existing browser records unchanged',await page.evaluate(()=>JSON.parse(localStorage.getItem('llg_full_app_v58')).plants[0].nickname==='Existing record'));
    await page.locator('#activationForm').evaluate(el=>el.dispatchEvent(new Event('submit',{cancelable:true})));
    check('browser submit makes no activation request',fixture.requests===0);
    if(process.env.TEST_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.TEST_ARTIFACT_DIR,'install-browser.png')});
    await normal.close();
    for(const platform of ['Android','iPhone']){
      const context=await browser.newContext({viewport:{width:393,height:852},userAgent:platform==='iPhone'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'});
      await installed(context,platform==='iPhone');const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      await p.goto(url);await p.locator('#activationForm').waitFor({state:'visible'});
      await p.locator('#llgUnlockInput').fill('invalid');await p.locator('#llgUnlockBtn').click();await p.locator('#llgUnlockError').filter({hasText:/find an order/}).waitFor();
      check(platform+' invalid code stays locked',!(await p.locator('#gardenApp').isVisible()));
      await p.locator('#llgUnlockInput').fill('valid-'+platform);await p.locator('#llgUnlockBtn').click();await p.locator('#gardenApp').waitFor({state:'visible'});
      await p.evaluate(()=>go('plants'));await p.getByRole('button',{name:/Add plant/}).click();
      await p.locator('#f_nickname').fill('Install test '+platform);await p.getByRole('button',{name:'Save plant',exact:true}).click();
      const stored=await p.evaluate(()=>localStorage.getItem('llg_full_app_v58')),requestCount=fixture.requests;
      for(let i=0;i<3;i++){await p.reload();await p.locator('#gardenApp').waitFor({state:'visible'});}
      check(platform+' refresh preserves records and activation',fixture.requests===requestCount&&await p.evaluate(name=>JSON.parse(localStorage.getItem('llg_full_app_v58')).plants.some(x=>x.nickname===name),'Install test '+platform));
      await p.goto(url+'/manifest.webmanifest');await p.goBack();await p.locator('#gardenApp').waitFor({state:'visible'});
      await p.close();const reopened=await context.newPage();await reopened.goto(url);await reopened.locator('#gardenApp').waitFor({state:'visible'});
      check(platform+' reopen and back do not reactivate',fixture.requests===requestCount);
      if(process.env.TEST_ARTIFACT_DIR)await reopened.screenshot({path:path.join(process.env.TEST_ARTIFACT_DIR,'installed-'+platform+'.png')});
      const other=await browser.newContext();await installed(other);const q=await other.newPage();await q.goto(url);await q.locator('#llgUnlockInput').fill('valid-'+platform);await q.locator('#llgUnlockBtn').click();await q.locator('#llgUnlockError').filter({hasText:/one installed app context/}).waitFor();
      check(platform+' second context denied',!(await q.locator('#gardenApp').isVisible()));await other.close();
      await reopened.evaluate(()=>localStorage.clear());await reopened.reload();await reopened.locator('#activationForm').waitFor({state:'visible'});await reopened.locator('#llgUnlockInput').fill('valid-'+platform);await reopened.locator('#llgUnlockBtn').click();await reopened.locator('#llgUnlockError').filter({hasText:/one installed app context/}).waitFor();
      check(platform+' cleared storage does not grant another activation',!(await reopened.locator('#gardenApp').isVisible()));
      check(platform+' no runtime errors',errors.length===0);await context.close();
    }
    const manifest=await (await fetch(url+'/manifest.webmanifest')).json();check('manifest stable origin and supplied icon paths',manifest.start_url==='/'&&manifest.name==='Lucky Lady Bug Garden'&&manifest.icons.length===3);
    for(const icon of manifest.icons)check(icon.src,(await fetch(url+icon.src)).ok);
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'llg-install-restart-'));
    let persistent=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true});
    await installed(persistent);let rp=await persistent.newPage();await rp.goto(url);
    await rp.locator('#llgUnlockInput').fill('valid-restart');await rp.locator('#llgUnlockBtn').click();await rp.locator('#gardenApp').waitFor({state:'visible'});
    await rp.evaluate(()=>go('plants'));await rp.getByRole('button',{name:/Add plant/}).click();await rp.locator('#f_nickname').fill('Full browser restart');await rp.getByRole('button',{name:'Save plant',exact:true}).click();
    const countBeforeRestart=fixture.requests;await persistent.close();
    persistent=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true});await installed(persistent);rp=await persistent.newPage();await rp.goto(url);await rp.locator('#gardenApp').waitFor({state:'visible'});
    check('full browser process restart preserves saved plant and unlock without request',fixture.requests===countBeforeRestart&&await rp.evaluate(()=>JSON.parse(localStorage.getItem('llg_full_app_v58')).plants.some(p=>p.nickname==='Full browser restart')));
    await persistent.close();
    const blocked=await browser.newContext();await installed(blocked);await blocked.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('blocked','SecurityError');};});
    const bp=await blocked.newPage();await bp.goto(url);const requestsBeforeBlocked=fixture.requests;await bp.locator('#llgUnlockInput').fill('valid-blocked');await bp.locator('#llgUnlockBtn').click();await bp.locator('#llgUnlockError').filter({hasText:/Storage is unavailable/}).waitFor();
    check('unwritable storage blocked before consuming activation',fixture.requests===requestsBeforeBlocked);await blocked.close();
    console.log(JSON.stringify({passed:checks.length,physicalPhoneInstall:'NOT TESTED',checks},null,2));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
