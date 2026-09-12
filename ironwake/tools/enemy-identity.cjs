'use strict';
// Frozen renderer fixtures: visual/lifecycle evidence, never a gameplay or fun claim.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.IW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.env.IW_SHOTS||'node_modules/.cache/ironwake/enemy-identity');
const sizes=(process.env.IW_VIEWPORTS||'320x568,390x844,844x390,768x1024,1440x900,3840x2160').split(',').map(s=>s.split('x').map(Number));
const report={startedAt:new Date().toISOString(),evidence:'Frozen presentation fixtures, not normal combat or enjoyment evidence.',viewports:[]};
const save=(status,error)=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({...report,status,updatedAt:new Date().toISOString(),...(error?{error:String(error)}:{})},null,2));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);});});
async function renderFrozen(page,dt=0){await page.evaluate(dt=>{const before=JSON.stringify(IW.runtime.state);IW.runtime.renderer.render(IW.runtime.state,dt);if(before!==JSON.stringify(IW.runtime.state))throw Error('Renderer mutated simulation state');},dt);}
async function fixture(page,mode='lineup'){
 await page.evaluate(mode=>{
  const s=IW.runtime.state,fresh=IW.createCampaignState(0);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,fresh);
  s.status='playing';s.time=1;Object.assign(s.player,{x:0,z:5,angle:Math.PI});
  for(const key of ['hazards','strikes','pickups','projectiles','effects','buildings','enemies'])s[key]=[];
  s.objectives.forEach(o=>o.done=true);
  const types=['escort','hunter','tank','artillery'];
  s.enemies=types.map((type,i)=>({id:'identity-'+type,type,x:i%2?-5:5,z:i<2?-1:-13,hp:120,maxHp:120,alive:true,disabled:false,weaponTaken:false,escaped:false,angle:Math.PI*.15,radius:type==='tank'?1.6:1.2,cooldown:1.2}));
  if(mode==='disabled')for(const e of s.enemies)Object.assign(e,{alive:false,disabled:['escort','artillery'].includes(e.type),hp:0});
 },mode);await renderFrozen(page);await page.waitForTimeout(180);await renderFrozen(page);
}
async function markers(page){return page.locator('[data-iw-marker=enemy]:visible').evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.id,kind:el.dataset.kind,name:el.querySelector('b').textContent,detail:el.children[1].textContent,hpWidth:el.children[2].style.width,hpHidden:el.children[2].hidden})));}
async function checkRings(page){
 const failures=await page.evaluate(()=>{
  const scene=globalThis.__identityScene,s=IW.runtime.state,failures=[];
  for(const ring of scene.children.filter(n=>n.name==='player-ring'||n.name.startsWith('enemy-ring:'))){
   const actor=ring.name==='player-ring'?s.player:s.enemies.find(e=>e.id===ring.name.slice(11));
   if(!actor){failures.push(ring.name+' has no actor');continue;}
   if(Math.abs(ring.position.x-actor.x)>.001||Math.abs(ring.position.z-actor.z)>.001||Math.abs(ring.position.y-.05)>.001)failures.push(ring.name+' does not follow its actor on the ground');
  }return failures;
 });assert.deepEqual(failures,[],'Actor rings follow positions and are removed with owners');
}
async function inspect(page){return page.evaluate(()=>{
 const T=globalThis.__identityThree,scene=globalThis.__identityScene;
 const round=n=>Math.round(n*10000)/10000;
 const result={};scene.updateMatrixWorld(true);
 for(const root of scene.children.filter(n=>n.name.startsWith('enemy:'))){
  const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),parts=[],visibleParts=[],materials=new Set();
  const weapon=root.getObjectByName('weapon');
  root.traverse(n=>{if(!n.isMesh)return;let visible=true;for(let p=n;p&&p!==root.parent;p=p.parent)if(!p.visible)visible=false;
   n.geometry.computeBoundingBox();const transform=new T.Matrix4().multiplyMatrices(inverse,n.matrixWorld),b=n.geometry.boundingBox.clone().applyMatrix4(transform);
   const record={bounds:[b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(round),vertices:n.geometry.attributes.position.count};parts.push(record);if(visible){visibleParts.push(record);for(const m of [].concat(n.material))if(m.color)materials.add(m.color.getHexString());}
  });
  const bodyBounds=new T.Box3();for(const p of visibleParts){bodyBounds.expandByPoint(new T.Vector3(...p.bounds.slice(0,3)));bodyBounds.expandByPoint(new T.Vector3(...p.bounds.slice(3)));}
  const arms=root.getObjectByName('hunter-arms'),rails=root.getObjectByName('artillery-rails');
  result[root.name.slice(6)]={uuid:root.uuid,type:root.userData.enemyType,visible:root.visible,scale:root.scale.toArray(),rotation:root.rotation.toArray().slice(0,3),parts,visibleParts,materials:[...materials].sort(),bounds:bodyBounds.getSize(new T.Vector3()).toArray().map(round),weapon:weapon?{visible:weapon.visible,position:weapon.position.toArray(),children:weapon.children.length}:null,attackPose:arms?(round(arms.position.y)||0):rails?(round(rails.position.z)||0):null};
 }
 return result;
});}
async function main(){
 fs.mkdirSync(output,{recursive:true});save('running');await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{browser=await chromium.launch({headless:true,executablePath:process.env.IW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
 for(const [width,height]of sizes){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<1000}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
  // Capture the real scene by instrumenting the module only in this browser.
  // Production exports and gameplay state remain untouched.
  await page.route('**/ironwake/assets/js/render.js',async route=>{const response=await route.fetch(),source=await response.text(),needle='renderer.render(scene,camera);';assert(source.includes(needle),'Render capture point exists');await route.fulfill({response,body:source.replace(needle,'globalThis.__identityScene=scene;globalThis.__identityThree=THREE;'+needle)});});
  await page.goto(`http://127.0.0.1:${server.address().port}/ironwake/index.html`);await page.waitForFunction(()=>IW.runtime?.renderer);await page.locator('#start').click();await page.evaluate(()=>IW.runtime.stop());await page.waitForTimeout(100);
  await fixture(page);await page.screenshot({path:path.join(output,`${width}x${height}-lineup.png`)});
  if(process.env.IW_BASELINE==='1'){report.viewports.push({width,height,baseline:true});await page.close();save('running');continue;}
  const lineup=await inspect(page);assert.equal(Object.keys(lineup).length,4,'Four live scene chassis');
  for(const [a,b]of [['escort','hunter'],['tank','artillery']])assert.notDeepEqual(lineup['identity-'+a].parts,lineup['identity-'+b].parts,a+' and '+b+' have distinct geometry, independent of labels and colors');
  for(const e of Object.values(lineup))assert(e.bounds.every(v=>v>0)&&e.visibleParts.length>5,'Chassis has visible three-dimensional geometry');
  // Only actual pending strikes may drive a source animation. Cooldown changes
  // or a different enemy's identically timed strike cannot predict an attack.
  await page.evaluate(()=>{for(const e of IW.runtime.state.enemies)e.cooldown=.01;});await renderFrozen(page,.1);
  let cues=await inspect(page);assert.equal(cues['identity-hunter'].attackPose,0);assert.equal(cues['identity-artillery'].attackPose,0);
  await page.evaluate(()=>{IW.runtime.state.strikes=[{id:'strike-a',sourceId:'identity-artillery',x:-3,z:3,radius:4,life:.7,maxLife:1,damage:24}];});await renderFrozen(page);
  cues=await inspect(page);assert(cues['identity-artillery'].attackPose<0,'Artillery reacts to its own live strike');assert.equal(cues['identity-hunter'].attackPose,0,'Other attacker remains idle');
  await page.evaluate(()=>{IW.runtime.state.strikes.push({id:'strike-h',sourceId:'identity-hunter',x:3,z:3,radius:3,life:.7,maxLife:1,damage:18});});await renderFrozen(page);
  await page.screenshot({path:path.join(output,`${width}x${height}-action.png`)});const action=await inspect(page);assert(action['identity-hunter'].attackPose<0&&action['identity-artillery'].attackPose<0,'Both identified live sources animate');
  await page.evaluate(()=>{IW.runtime.state.strikes[0].life=.1;});await renderFrozen(page);
  cues=await inspect(page);assert.equal(cues['identity-artillery'].attackPose,0,'Artillery recovers according to its own fuse');assert(cues['identity-hunter'].attackPose<0,'Independent hunter fuse remains active');
  await page.evaluate(()=>{for(const s of IW.runtime.state.strikes){delete s.sourceId;s.life=.7;}});await renderFrozen(page);
  cues=await inspect(page);assert.equal(cues['identity-hunter'].attackPose,0);assert.equal(cues['identity-artillery'].attackPose,0,'Unattributed strikes cannot animate a guessed source');
  await page.evaluate(()=>{IW.runtime.state.strikes[0].sourceId='identity-artillery';Object.assign(IW.runtime.state.enemies.find(e=>e.type==='artillery'),{alive:false,disabled:true,hp:0});});await renderFrozen(page);
  assert.equal((await inspect(page))['identity-artillery'].attackPose,0,'A destroyed source cannot display a live attack');
  await fixture(page,'disabled');await page.screenshot({path:path.join(output,`${width}x${height}-disabled.png`)});const disabled=await inspect(page);
  await checkRings(page);
  assert(!(await markers(page)).some(m=>['identity-hunter','identity-tank'].includes(m.id)),'Destroyed hunter and tank offer no salvage');
  // Take each salvage weapon on the existing chassis. Healthy peers must retain theirs.
  for(const type of ['escort','artillery']){
   const id='identity-'+type;assert(disabled[id].weapon?.visible,type+' disabled weapon available');
   await page.evaluate(id=>{IW.runtime.state.enemies.find(e=>e.id===id).weaponTaken=true;},id);await renderFrozen(page);
   assert.equal((await inspect(page))[id].weapon.visible,false,type+' gun disappears after rip');assert(!(await markers(page)).some(m=>m.id===id),'Taken weapon label removed');
  }
  await page.screenshot({path:path.join(output,`${width}x${height}-ripped.png`)});
  // A fresh array with the same IDs must rebuild the scene, including damaged poses.
  await fixture(page);const rebuilt=await inspect(page);for(const id of Object.keys(lineup)){assert.notEqual(rebuilt[id].uuid,disabled[id].uuid,'Scene rebuild replaces '+id);assert.deepEqual(rebuilt[id].scale,lineup[id].scale,'Fresh deployment restores scale');assert.deepEqual(rebuilt[id].rotation,lineup[id].rotation,'Fresh deployment restores pose');}
  await page.evaluate(()=>{IW.runtime.state.enemies.find(e=>e.type==='tank').alive=false;});await renderFrozen(page);
  await page.evaluate(()=>{IW.runtime.state.enemies.find(e=>e.type==='tank').alive=true;});await renderFrozen(page);
  const revived=(await inspect(page))['identity-tank'];assert.equal(revived.uuid,rebuilt['identity-tank'].uuid,'Pose reset is checked on the same scene object');assert.deepEqual(revived.rotation,rebuilt['identity-tank'].rotation,'Revived tank has no stale wreck tilt');assert.deepEqual(revived.scale,rebuilt['identity-tank'].scale,'Revived tank has no stale flattened scale');
  await page.evaluate(()=>{IW.runtime.state.enemies.find(e=>e.type==='hunter').type='escort';});await renderFrozen(page);
  const changed=await inspect(page);assert.equal(Object.keys(changed).length,4,'Same-ID type change keeps exactly one chassis');assert.notEqual(changed['identity-hunter'].uuid,rebuilt['identity-hunter'].uuid,'Same-ID type change replaces geometry');assert(changed['identity-hunter'].weapon?.visible,'Replacement escort has its actual gun');
  const labelChecks=[];
  for(const type of ['escort','hunter','tank','artillery']){
   await fixture(page);await page.evaluate(type=>{const s=IW.runtime.state,e=s.enemies.find(e=>e.type===type);s.enemies=[e];Object.assign(e,{x:0,z:0,hp:30,maxHp:120});},type);await renderFrozen(page);
   assert.deepEqual(Object.keys(await inspect(page)),['identity-'+type],'Removed enemies cannot leave ghost chassis');
   await checkRings(page);
   if(['hunter','artillery'].includes(type)){
    await page.screenshot({path:path.join(output,`${width}x${height}-${type}-solo.png`)});
    await page.evaluate(()=>{const e=IW.runtime.state.enemies[0];IW.runtime.state.strikes=[{id:'solo-strike',sourceId:e.id,x:0,z:5,radius:3,life:.7,maxLife:1,damage:20}];});await renderFrozen(page);
    await page.screenshot({path:path.join(output,`${width}x${height}-${type}-solo-action.png`)});
    await page.evaluate(()=>{IW.runtime.state.strikes=[];});await renderFrozen(page);
   }
   const label=(await markers(page))[0];assert(label&&label.name===type.toUpperCase(),type+' exact identity');assert.equal(label.hpWidth,'25%','HP bar shows actual hp/maxHp');assert.equal(label.hpHidden,false,'Living health bar visible');
   await page.evaluate(()=>{IW.runtime.state.enemies[0].hp=90;});await renderFrozen(page);assert.equal((await markers(page))[0].hpWidth,'75%','Existing HP bar updates');
   if(['escort','artillery'].includes(type)){
    await page.evaluate(()=>{Object.assign(IW.runtime.state.enemies[0],{alive:false,disabled:true,hp:0});});await renderFrozen(page);
    const salvage=(await markers(page))[0];assert.equal(salvage.name,type.toUpperCase()+' OFF','Disabled chassis identity remains visible');assert.equal(salvage.detail,'RIP '+(type==='artillery'?'RAIL':'HEAVY')+' 5m','In-range salvage action and distance');assert.equal(salvage.hpHidden,true,'Disabled weapon has no live HP');
    await page.evaluate(()=>{IW.runtime.state.enemies[0].weaponTaken=true;});await renderFrozen(page);assert.equal((await markers(page)).length,0,'Ripped salvage is removed');
   }else{
    await page.evaluate(()=>{Object.assign(IW.runtime.state.enemies[0],{alive:false,disabled:false,hp:0});});await renderFrozen(page);
    assert.equal((await markers(page)).length,0,'Destroyed '+type+' cannot offer a weapon');
   }labelChecks.push(type);
  }
  await fixture(page);await page.setViewportSize({width:height,height:width});await renderFrozen(page);assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Resize no horizontal overflow');await page.setViewportSize({width,height});await renderFrozen(page);
  // Actual UI retry must remove fixture roots and its tactical labels.
  await page.evaluate(()=>{IW.runtime.state.status='lost';IW.runtime.resume();});await page.locator('#retry').waitFor({state:'visible'});await page.locator('#retry').click();await page.evaluate(()=>IW.runtime.stop());await page.waitForTimeout(100);await renderFrozen(page);
  assert(!Object.keys(await inspect(page)).some(id=>id.startsWith('identity-')),'Retry removes old chassis');assert(!(await markers(page)).some(m=>m.id.startsWith('identity-')),'Retry removes old labels');assert.equal(await page.locator('[data-iw-tactical-layer]').count(),1,'Retry keeps one overlay');
  const disposal=await page.evaluate(()=>{
   const geometries=new Set(),materials=new Set(),counts={geometries:0,materials:0};
   globalThis.__identityScene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of [].concat(n.material||[]))materials.add(m);});
   for(const g of geometries)g.addEventListener('dispose',()=>counts.geometries++);for(const m of materials)m.addEventListener('dispose',()=>counts.materials++);
   IW.runtime.renderer.dispose();return counts;
  });assert(disposal.geometries>0&&disposal.materials>0,'Dispose releases real scene geometry/material resources');assert.equal(await page.locator('[data-iw-tactical-layer]').count(),0,'Dispose removes overlay');
  assert.deepEqual(errors,[],'No console warnings/errors');assert.deepEqual(external,[],'No external runtime requests');
  report.viewports.push({width,height,lineup,action,disabled,labelChecks,nonMutating:true,rebuild:true,resize:true,retry:true,disposal,errors,external});save('running');console.log(`${width}x${height}: identity, source HP/salvage, gun removal, scene rebuild, retry and disposal passed`);await page.close();
 }
 save('passed');}finally{if(browser)await browser.close();}
}
main().catch(e=>{console.error(e);save('failed',e);process.exitCode=1;}).finally(()=>server.close());
