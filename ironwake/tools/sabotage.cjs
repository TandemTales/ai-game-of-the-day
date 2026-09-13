'use strict';
// Deliberately injected positions/enemy removal isolate relay UI and native hold
// behavior. These fixtures are separate from the normal-clock critic playthrough.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.IW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.env.IW_SHOTS||'node_modules/.cache/ironwake/sabotage');
const sizes=(process.env.IW_VIEWPORTS||'320x568,390x844,844x390,768x1024,1440x900,3840x2160').split(',').map(s=>s.split('x').map(Number));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);});});
async function main(){
 fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const report={started:new Date().toISOString(),evidence:'Injected state fixtures; native held input at ordinary simulation speed; not gameplay or enjoyment proof.',viewports:[]};
 const browser=await chromium.launch({headless:true,executablePath:process.env.IW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
 try{for(const [width,height]of sizes){
  const touch=width<1000,page=await browser.newPage({viewport:{width,height},hasTouch:touch}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))errors.push('External: '+r.url());});
  const activate=async selector=>{const e=page.locator(selector);await e.scrollIntoViewIfNeeded();await(touch?e.tap():e.click());};
  const shot=async name=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'no horizontal overflow');await page.screenshot({path:path.join(output,`${width}x${height}-${name}.png`)});};
  await page.goto(`http://127.0.0.1:${server.address().port}/ironwake/index.html`);await page.waitForFunction(()=>IW.runtime);await activate('#start');await activate('#mapButton');await activate('#signalsButton');
  assert.equal(await page.locator('[data-cache-id="battery-relay-0"]').count(),0,'locked relay concealed');assert.match(await page.locator('[data-cache-id="cache-0-0"]').textContent(),/command codes/);await shot('archive-route');await activate('#resume');
  await page.evaluate(()=>{const s=IW.runtime.state,c=s.pickups.find(c=>c.id==='cache-0-0');s.enemies=[];Object.assign(s.player,{x:c.x,z:c.z});});
  await page.waitForFunction(()=>!IW.runtime.state.pickups.find(c=>c.type==='relay').locked);await activate('#mapButton');await activate('#signalsButton');
  const row=page.locator('[data-cache-id="battery-relay-0"]');await row.scrollIntoViewIfNeeded();assert.match(await row.textContent(),/5 uninterrupted seconds/);assert(await row.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'relay instructions fit');await shot('relay-map');await activate('#resume');
  await page.evaluate(()=>{const s=IW.runtime.state,c=s.pickups.find(c=>c.type==='relay');Object.assign(s.player,{x:c.x,z:c.z});s.radioTime=0;});
  await page.waitForFunction(()=>document.querySelector('#context').textContent.includes('RELAY'));await page.locator('[data-iw-marker="relay"]').waitFor({state:'visible'});await shot('relay-world');
  const cdp=touch?await page.context().newCDPSession(page):null;
  const hold=async()=>{if(touch){const b=await page.locator('[data-action=interact]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:b.x+b.width/2,y:b.y+b.height/2}]});}else await page.keyboard.down('f');};
  const release=async()=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('f');};
  await hold();await page.waitForFunction(()=>IW.runtime.state.pickups.find(c=>c.type==='relay').progress>.5);await release();await page.waitForFunction(()=>IW.runtime.state.pickups.find(c=>c.type==='relay').progress===0);
  await hold();await page.waitForFunction(()=>IW.runtime.state.pickups.find(c=>c.type==='relay').progress>1);await shot('relay-hold');await page.waitForFunction(()=>IW.runtime.state.pickups.find(c=>c.type==='relay').taken,{},{timeout:20000});await release();await shot('relay-complete');
  assert.equal(await page.locator('[data-iw-marker="relay"]:visible').count(),0,'completed world marker clears');
  await activate('#mapButton');await activate('#signalsButton');assert.equal(await row.count(),0,'completed relay leaves signal list');assert.match(await page.locator('#archiveEntries').textContent(),/BATTERY SABOTAGED/);await activate('#resume');
  // A completed-objective fixture tests persistent outcome copy, not level play.
  await page.evaluate(()=>{const s=IW.runtime.state;s.stage=3;Object.assign(s.player,{x:s.objectives[3].x,z:s.objectives[3].z});});await page.waitForFunction(()=>IW.runtime.state.status==='won');
  await activate('#debriefJournal summary');assert.match(await page.locator('#debriefArchiveEntries').textContent(),/BATTERY SABOTAGED/);await page.locator('#debriefArchiveEntries li p').last().scrollIntoViewIfNeeded();await shot('relay-debrief');
  await page.reload();await page.waitForFunction(()=>IW.runtime?.state.status==='won');await activate('#debriefJournal summary');assert.match(await page.locator('#debriefArchiveEntries').textContent(),/BATTERY SABOTAGED/,'won reload preserves outcome');await activate('#retry');
  assert(await page.evaluate(()=>{const c=IW.runtime.state.pickups.find(c=>c.type==='relay');return c.locked&&!c.taken&&c.progress===0;}),'retry clears codes and sabotage');
  assert.deepEqual(errors,[]);report.viewports.push({width,height,status:'passed',input:touch?'native touch hold':'keyboard hold',checks:['locked route concealed','archive unlock map copy','world relay marker','release resets progress','continuous hold completes','completed relay absent','debrief and reload retain outcome','retry resets','console/overflow clean']});await page.close();console.log(`${width}x${height}: relay fixtures passed`);
 }}finally{report.completed=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
