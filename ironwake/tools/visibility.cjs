'use strict';
// Frozen presentation fixtures, not a simulation pilot or proof of enjoyment.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.IW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.env.IW_SHOTS||'node_modules/.cache/ironwake/sep11-visibility');
const sizes=(process.env.IW_VIEWPORTS||'320x568,390x844,844x390,768x1024,1440x900,3840x2160').split(',').map(s=>s.split('x').map(Number));
const startedAt=new Date().toISOString(),report=[];
function saveReport(status,error){fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({status,startedAt,updatedAt:new Date().toISOString(),evidence:'Frozen presentation fixtures; not real-play or enjoyment evidence.',viewports:report,...(error?{error:String(error)}:{})},null,2));}
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);});});
const visibleMarkers=page=>page.locator('[data-iw-marker]:visible').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.id,marker:el.dataset.iwMarker,kind:el.dataset.kind,disabled:el.dataset.disabled,occluded:el.dataset.occluded,offscreen:el.dataset.offscreen,text:el.textContent,font:parseFloat(getComputedStyle(el).fontSize),bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
async function renderFrozen(page){await page.evaluate(()=>{const before=JSON.stringify(IW.runtime.state);IW.runtime.renderer.render(IW.runtime.state,0);if(before!==JSON.stringify(IW.runtime.state))throw Error('Rendering mutated gameplay');});}
async function fixture(page,name){
 await page.evaluate(name=>{
  const s=IW.runtime.state,fresh=IW.createCampaignState(0);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,fresh);
  s.status='playing';s.time=0;Object.assign(s.player,{x:0,z:0,angle:Math.PI});
  for(const key of ['hazards','strikes','pickups','projectiles','effects','buildings','enemies'])s[key]=[];
  const o=s.objectives[0];Object.assign(o,{id:'fixture-objective',x:140,z:-100});
  const enemy=(id,type,x,z,extra={})=>({id,type,x,z,hp:100,maxHp:100,alive:true,disabled:false,weaponTaken:false,escaped:false,angle:0,radius:1.8,cooldown:2,...extra});
  const tower=(id,x,z,w,d,h)=>({id,x,z,w,d,h,hp:80,maxHp:80,status:'standing',fallX:0,fallZ:-1,fallProgress:0,hitIds:[]});
  if(name==='occlusion'){s.enemies=[enemy('fixture-hidden-tank','tank',-6,-10)];s.buildings=[tower('fixture-tower',-3,14,7,8,36)];}
  else if(name==='salvage')s.enemies=[enemy('fixture-heavy','escort',-5,-3,{alive:false,disabled:true,hp:0}),enemy('fixture-railgun','artillery',5,-3,{alive:false,disabled:true,hp:0})];
  else if(name==='excluded')s.enemies=[enemy('fixture-dead','tank',-8,-7,{alive:false}),enemy('fixture-taken','escort',-4,-7,{alive:false,disabled:true,weaponTaken:true}),enemy('fixture-escaped','tank',4,-7,{escaped:true}),enemy('fixture-distant','tank',500,-7),enemy('fixture-distant-salvage','artillery',-500,-7,{alive:false,disabled:true})];
  else if(name==='crowded-wrecks'){s.enemies=Array.from({length:7},(_,i)=>enemy('fixture-wreck-'+i,'escort',3+i,-3,{alive:false,disabled:true,hp:0}));s.enemies.push(enemy('fixture-live-defender','hunter',-10,-8));o.targets=['fixture-live-defender'];}
  else if(name==='offscreen-threat'){s.enemies=[enemy('fixture-offscreen-tank','tank',0,46)];s.buildings=[tower('fixture-offscreen-wall',0,44,8,2,38)];}
  else if(name==='behind-camera'){o.x=0;o.z=300;}
  else if(name==='distant-front'){o.x=0;o.z=-300;}
  else if(name==='left-edge'){o.x=-300;o.z=-20;}
  else if(name==='right-edge'){o.x=300;o.z=-20;}
 },name);
 await renderFrozen(page);await page.waitForTimeout(180);await renderFrozen(page);
}
async function checkBounds(page,markers,width,height){
 for(const m of markers){const b=m.bounds;assert(b.width>0&&b.height>0&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`${m.id} inside ${width}x${height}: ${JSON.stringify(b)}`);assert(m.font>=11,m.id+' minimum identity font');}
 const failures=await page.locator('[data-iw-marker]:visible').evaluateAll(nodes=>{
  const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const ui=[...document.querySelectorAll('header,#hud,#orders,#radar,#radio,#controls')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().width>0),failures=[];
  for(let i=0;i<nodes.length;i++){
   const el=nodes[i],r=el.getBoundingClientRect();
   for(const other of ui)if(intersects(r,other.getBoundingClientRect()))failures.push(el.dataset.id+' overlaps '+(other.id||other.tagName));
   for(const other of nodes.slice(i+1))if(intersects(r,other.getBoundingClientRect()))failures.push(el.dataset.id+' overlaps '+other.dataset.id);
   for(const text of el.querySelectorAll('b,div')){if(!text.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(text);const content=range.getBoundingClientRect();if(content.left<r.left+1||content.right>r.right-1||content.top<r.top||content.bottom>r.bottom)failures.push(el.dataset.id+' clips text '+text.textContent);}
   if(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-iw-tactical-layer]'))failures.push(el.dataset.id+' steals battlefield input');
  }return failures;
 });
 assert.deepEqual(failures,[],'No HUD/marker overlaps, clipped text, or intercepted input');assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'No horizontal overflow');
}
async function main(){
 fs.mkdirSync(output,{recursive:true});saveReport('running');await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.IW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
 try{for(const [width,height]of sizes){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000}),errors=[],external=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/ironwake/index.html`);await page.waitForFunction(()=>IW.runtime?.renderer);await page.locator('#start').click();await page.evaluate(()=>IW.runtime.stop());await page.waitForTimeout(100);
  for(const name of ['occlusion','salvage','excluded','behind-camera','left-edge','right-edge','crowded-wrecks','offscreen-threat','distant-front']){
   await fixture(page,name);const screenshot=`${width}x${height}-${name}.png`;await page.screenshot({path:path.join(output,screenshot)});
   const markers=await visibleMarkers(page),enemies=markers.filter(m=>m.marker==='enemy'),objective=markers.find(m=>m.marker==='objective');
   assert(objective,`${name}: active objective visible: ${JSON.stringify(markers)}`);assert.equal(objective.offscreen,'true',name+': distant objective edge cue');
   if(name==='occlusion'){const tank=enemies.find(m=>m.id==='fixture-hidden-tank');assert(tank&&tank.text.includes('TANK'),'Occluded tank identity');assert.equal(tank.occluded,'true','Tank is really behind the tower');}
   if(name==='salvage')for(const[id,role,label]of [['fixture-heavy','ESCORT','HEAVY'],['fixture-railgun','ARTILLERY','RAIL']]){const m=enemies.find(m=>m.id===id);assert(m&&m.text.includes(role+' OFF')&&m.text.includes('RIP '+label)&&m.text.includes('m')&&m.disabled==='true',label+' nearby rip affordance includes chassis identity');assert.equal(m.kind,'salvage');}
   if(name==='excluded')assert.deepEqual(enemies,[],'No dead/taken/escaped/distant markers');
   if(name==='crowded-wrecks'){assert(enemies.some(m=>m.id==='fixture-live-defender'&&m.text.includes('HUNTER')),'Seven nearby disabled weapons cannot suppress live objective defender');assert(enemies.some(m=>m.kind==='salvage'&&/RIP/.test(m.text)),'Keep immediately usable weapon visible');}
   if(name==='offscreen-threat'){const tank=enemies.find(m=>m.id==='fixture-offscreen-tank');assert(tank&&tank.offscreen==='true'&&/[↓↙↘]/u.test(tank.text),'Nearby offscreen tank has downward arrow');assert.equal(tank.occluded,'true','Offscreen wall combines arrow and OBSCURED');}
   if(name==='distant-front')assert(/[↑↖↗]/u.test(objective.text),'Beyond far clip plane still points forward/up');
   if(name==='behind-camera')assert(/[↓↙↘]/u.test(objective.text),'Behind-camera objective points backward/down');
   await checkBounds(page,markers,width,height);checks.push({fixture:name,screenshot,markers,gameplayUnchanged:true});
  }
  // Sweep across both aspect-dependent camera planes; no implementation formula.
  await fixture(page,'behind-camera');for(const z of [55,60,65,70,75,80,85]){await page.evaluate(z=>{IW.runtime.state.objectives[0].z=z;},z);await renderFrozen(page);const markers=await visibleMarkers(page);assert(markers.some(m=>m.marker==='objective'),'Objective survives camera plane at '+z);await checkBounds(page,markers,width,height);}
  // Update existing geometry and target ids without rebuilding the world.
  await fixture(page,'occlusion');await page.evaluate(()=>{IW.runtime.state.buildings[0].status='rubble';});await renderFrozen(page);assert.equal((await visibleMarkers(page)).find(m=>m.id==='fixture-hidden-tank').occluded,'false','Destroyed tower clears occlusion');
  await page.evaluate(()=>{Object.assign(IW.runtime.state.enemies[0],{x:12,z:-4});});await renderFrozen(page);assert((await visibleMarkers(page)).find(m=>m.id==='fixture-hidden-tank').text.includes('13 m'),'Moved target refreshes range');
  await page.evaluate(()=>{IW.runtime.state.enemies[0].x=500;});await renderFrozen(page);assert(!(await visibleMarkers(page)).some(m=>m.id==='fixture-hidden-tank'),'Leaving range removes existing label');
  // Authored chapters reuse objective ids; check stage, title and range freshness.
  for(const[chapter,stage,distance]of [[0,0,15],[0,1,22],[1,0,30]]){
   await page.evaluate(({chapter,stage,distance})=>{const s=IW.runtime.state,f=IW.createCampaignState(chapter);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,f);s.status='playing';s.stage=stage;Object.assign(s.player,{x:s.objectives[stage].x,z:s.objectives[stage].z+distance,angle:Math.PI});},{chapter,stage,distance});await renderFrozen(page);
   const m=(await visibleMarkers(page)).find(m=>m.marker==='objective');assert(m&&m.text.includes('OBJECTIVE '+(stage+1))&&m.text.includes(distance+' m'),'Chapter/stage refreshes reused objective');assert.equal(await page.locator('[data-iw-marker=objective]:visible').getAttribute('title'),await page.evaluate(()=>IW.runtime.state.objectives[IW.runtime.state.stage].title),'Current mission title');
  }
  await page.setViewportSize({width:height,height:width});await fixture(page,'salvage');await checkBounds(page,await visibleMarkers(page),height,width);await page.setViewportSize({width,height});await fixture(page,'occlusion');
  await page.locator('#mapButton').click();await renderFrozen(page);assert.equal((await visibleMarkers(page)).length,0,'Map hides labels');await page.locator('#resume').click();await renderFrozen(page);assert((await visibleMarkers(page)).length>0,'Resume restores labels');
  // Defeat fixture followed by the real retry button, not a replacement API.
  await page.evaluate(()=>{IW.runtime.state.status='lost';IW.runtime.resume();});await page.locator('#retry').waitFor({state:'visible'});await page.locator('#retry').click();await page.evaluate(()=>IW.runtime.stop());await page.waitForTimeout(100);
  assert(!(await visibleMarkers(page)).some(m=>m.id.startsWith('fixture-')),'Retry removes old labels');assert.equal(await page.locator('[data-iw-tactical-layer]').count(),1,'Retry cannot leak layers');
  for(const status of ['ready','lost','won']){await page.evaluate(status=>{IW.runtime.state.status=status;},status);await renderFrozen(page);assert.equal((await visibleMarkers(page)).length,0,status+' hides labels');}
  await page.evaluate(()=>IW.runtime.renderer.dispose());assert.equal(await page.locator('[data-iw-tactical-layer]').count(),0,'Dispose removes overlay');assert.deepEqual(errors,[],'No console warnings/errors');assert.deepEqual(external,[],'No external runtime requests');
  report.push({width,height,checks,cameraPlane:true,geometryRefresh:true,chapterRefresh:true,resize:true,pause:true,retry:true,nonPlayingHidden:true,dispose:true,errors,external});saveReport('running');console.log(`${width}x${height}: nine fixtures, text/bounds, camera plane, geometry, chapters, resize, pause, retry, statuses and disposal passed`);await page.close();
 }}finally{await browser.close();}saveReport('passed');
}
main().catch(e=>{console.error(e);saveReport('failed',e);process.exitCode=1;}).finally(()=>server.close());
