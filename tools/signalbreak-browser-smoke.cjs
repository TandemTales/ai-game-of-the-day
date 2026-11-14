const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const {nextOrder}=require('./signalbreak-route.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.SIGNALBREAK_SMOKE_OUT||path.join(root,'node_modules/.cache/signalbreak/browser-smoke'));fs.mkdirSync(out,{recursive:true});
const api=[],results=[];
const crypto=require('crypto'),sources=['signalbreak/index.html','signalbreak/assets/css/game.css',...['missions','logic','campaign','render','audio','game'].map(f=>'signalbreak/assets/js/'+f+'.js')];
const sourceSnapshot=()=>sources.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}));
const initialSources=sourceSnapshot();
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){const item={method:req.method,url:url.pathname+url.search};if(url.pathname.startsWith('/api/leaderboard/'))api.push(item);let body='';req.on('data',d=>body+=d);req.on('end',()=>{if(body)item.body=JSON.parse(body);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({rank:1,success:true}));});return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(data);});
});
async function tile(page,x,y,touch=false){
  await page.locator('#map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  const p=await page.evaluate(({x,y})=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),s=SB.Game.getState(),v=SB.Game.getView(),d=Math.min(devicePixelRatio,2);const P=SB.Render.projection(c.width,c.height,s,{...v,panX:v.panX*d,panY:v.panY*d}),p=P.point(x,y,SB.Logic.height(s,x,y));return{x:r.x+p.x*r.width/c.width,y:r.y+p.y*r.height/c.height};},{x,y});
  await page.evaluate(p=>{window.lastTap={p,rect:document.querySelector('canvas').getBoundingClientRect().toJSON(),target:document.elementFromPoint(p.x,p.y)?.id};},p);
  if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
}
async function plan(page,options){return page.evaluate(({source,options})=>Function('return ('+source+')')()(SB,SB.Game.getState(),options),{source:nextOrder.toString(),options});}
async function drive(page,touch=false,options={}){
  const actions=[];let circuit='';
  const suffix=options.useSiding?'-siding':'';
  for(let i=0;i<350&&await page.evaluate(()=>SB.Game.getState().phase==='player');i++){
    const p=await plan(page,options);actions.push(p);
    if(p.kind==='end'){await page.locator('#end-turn').click();continue;}
    if(touch)await page.locator(`[data-unit="${p.actorId}"]`).tap();
    else{const idx=await page.evaluate(id=>SB.Game.getState().squad.findIndex(u=>u.id===id),p.actorId);await page.keyboard.press(String(idx+1));}
    await page.locator(`[data-action="${p.kind}"]`).click();
    if(['move','attack','heal','hack'].includes(p.kind))await tile(page,p.x,p.y,touch);
    const shown=await page.evaluate(()=>SB.Game.getPreview());assert(shown&&shown.legal&&shown.kind===p.kind&&shown.x===p.x&&shown.y===p.y,JSON.stringify({wanted:p,shown}));
    await page.locator('#confirm').click();
    const current=await page.evaluate(()=>{const s=SB.Game.getState();return{id:s.id,key:JSON.stringify([s.circuits||s.network,s.keyPair])};});
    if(current.key!==circuit){circuit=current.key;await page.locator('.map-wrap').screenshot({path:path.join(out,current.id+suffix+'-circuit-'+i+'.png')});}
  }
  const final=await page.evaluate(()=>({id:SB.Game.getState().id,phase:SB.Game.getState().phase,score:SB.Game.getState().score,turn:SB.Game.getState().turn,rescued:SB.Game.getState().rescued,extracted:SB.Game.getState().squad.filter(u=>u.extracted).length}));
  assert.equal(final.phase,'won');assert.equal(final.extracted,4);assert.equal(final.rescued,true);
  await page.locator('.map-wrap').screenshot({path:path.join(out,final.id+suffix+'-won.png')});return{final,actions};
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(edge)?edge:undefined});
  try{
    for(const[width,height]of[[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[],external=[];
      page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
      await page.goto(url+'/signalbreak/index.html');assert.deepEqual(errors,[],'boot console');await page.waitForFunction(()=>window.SB&&SB.Game);await page.screenshot({path:path.join(out,`${width}x${height}-title.png`)});
      assert(await page.evaluate(()=>!document.querySelector('#operation-picker').open&&document.querySelector('#map').getBoundingClientRect().top<innerHeight),'map starts in viewport '+width);
      assert(await page.evaluate(()=>{const a=document.querySelector('.map-wrap').getBoundingClientRect(),b=document.querySelector('#start').getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom&&b.left>=a.left&&b.right<=a.right;}),'title CTA fits '+width);
      await page.locator('#start').click();assert.equal(await page.evaluate(()=>SB.Game.getMode()),'playing');
      await page.keyboard.press('ArrowRight');const before=await page.evaluate(()=>({...SB.Game.getState().squad[0]}));
      assert(await page.evaluate(()=>SB.Game.getPreview().legal));assert.equal(await page.evaluate(()=>SB.Game.getState().squad[0].x),before.x,'preview does not move');
      await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>SB.Game.getState().squad[0].x),before.x+1);
      await page.locator('[data-unit="rook"]').tap();assert.equal(await page.evaluate(()=>SB.Game.getView().selected),'rook');
      await tile(page,3,6,true);assert(await page.evaluate(()=>SB.Game.getPreview()&&SB.Game.getPreview().legal),'native touch preview '+width+' '+JSON.stringify(await page.evaluate(()=>({lastTap,mode:SB.Game.getMode(),rect:document.querySelector('canvas').getBoundingClientRect().toJSON()}))));await page.locator('#cancel').tap();assert.equal(await page.evaluate(()=>SB.Game.getPreview()),null);
      await tile(page,3,6,true);await page.locator('#confirm').tap();assert.equal(await page.evaluate(()=>SB.Game.getState().squad[2].x),3,'native touch move/confirm');
      await page.locator('#zoom-in').tap();assert(await page.evaluate(()=>SB.Game.getView().zoom>1));
      await page.locator('#zoom-out').tap();await page.locator('#end-turn').tap();assert.equal(await page.evaluate(()=>SB.Game.getState().turn),2);
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`${width}x${height}-play.png`)});
      await page.locator('#pause').click();assert.equal(await page.evaluate(()=>SB.Game.getMode()),'paused');await page.locator('#start').click();
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,mode:SB.Game.getMode(),controls:[...document.querySelectorAll('.actions button,.confirmation button,.unit,.map-tools button')].map(b=>{const r=b.getBoundingClientRect();return{w:r.width,h:r.height};})}));assert.equal(metrics.overflow,false);metrics.controls.forEach(b=>assert(b.w>=44&&b.h>=44,'44px controls'));
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({viewport:[width,height],...metrics,errors,external});await page.close();
    }
    const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true}),errors=[],dialogs=[],campaignRuns=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});
    page.on('dialog',d=>{dialogs.push(d.message());d.accept('Signal QA');});
    // Hold the first rank response until after Next has replaced global state.
    // The eventual POST must retain the completed operation's original score.
    let rankHeld=null;await page.route('**/api/leaderboard/rank?**',route=>{rankHeld=route;},{times:1});
    await page.goto(url+'/signalbreak/index.html');
    const operationIds=await page.evaluate(()=>SB.Missions.operations.map(m=>m.id));
    for(const [index,id]of operationIds.entries()){
      assert.equal(await page.evaluate(()=>SB.Game.getState().id),id);
      if(index===0){await page.locator('#prep-summary').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>SB.Game.getMode()),'title');assert(await page.locator('.preparation').evaluate(e=>e.open));await page.locator('#prep-summary').click();}
      if(index===1){
        await page.locator('#prep-summary').click();await page.locator('[data-gear="nia"]').selectOption('armor');
        assert.equal(await page.evaluate(()=>SB.Game.getState().squad[0].gear),'armor');await page.reload();assert.equal(await page.locator('[data-gear="nia"]').inputValue(),'armor');
        await page.locator('#prep-summary').click();await page.locator('[data-gear="nia"]').selectOption('standard');await page.locator('#prep-summary').click();
      }
      await page.locator('.map-wrap').screenshot({path:path.join(out,id+'-briefing.png')});await page.locator('#start').click();
      assert(await page.locator('[data-gear="nia"]').isDisabled());
      const run=await drive(page,index===1||index===3||index>=4);campaignRuns.push(run);
      if(index===1)assert((await page.locator('#tip').innerText()).includes('registrar names the clinic'));
      if(index===0){
        assert(rankHeld,'rank request held');await page.locator('#next-operation').click();assert.equal(await page.evaluate(()=>SB.Game.getState().id),'locked-manifest');
        await rankHeld.fulfill({status:200,contentType:'application/json',body:'{"rank":1}'});
      }
      await page.waitForFunction(n=>window.SB&&localStorage.getItem(SB.Campaign.key)&&Object.keys(JSON.parse(localStorage.getItem(SB.Campaign.key)).results).length===n,index+1);
      await page.waitForTimeout(100);await page.reload();
      assert.equal(await page.evaluate(()=>SB.Game.getMode()),'title');
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem(SB.Campaign.key)));assert(data.results[id]);
      if(index+1<operationIds.length)assert.equal(await page.evaluate(()=>SB.Game.getState().id),operationIds[index+1]);
    }
    assert.equal(api.length,operationIds.length*2-1,'held GET is intercepted, remaining server API calls are recorded');
    assert.equal(api[0].method,'POST');assert.equal(api[0].body.score,campaignRuns[0].final.score);assert(dialogs[0].startsWith('Live Wire operation score'));
    for(let i=1;i<api.length;i+=2){assert.equal(api[i].method,'GET');assert.equal(api[i+1].method,'POST');assert.equal(api[i+1].body.score,campaignRuns[(i+1)/2].final.score);}
    const campaignStorage=await page.context().storageState();
    const trained=await page.evaluate(()=>JSON.parse(localStorage.getItem(SB.Campaign.key)));assert.equal(trained.roster.nia.xp,operationIds.length);
    const archive=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,storageState:campaignStorage});
    await archive.goto(url+'/signalbreak/index.html');await archive.locator('#operation-picker summary').tap();await archive.locator('[data-mission="paper-trail"]').tap();await archive.locator('#start').tap();
    const callsBeforePurge=api.length;
    for(let turn=1;turn<=9;turn++)await archive.locator('#end-turn').tap();
    assert.equal(await archive.locator('#title').innerText(),'Archive purged.');
    assert.match(await archive.locator('#tip').innerText(),/deadline expired before the evidence was copied/);
    assert.equal(api.length,callsBeforePurge);await archive.locator('.map-wrap').screenshot({path:path.join(out,'paper-trail-purged-phone.png')});
    await archive.locator('#start').tap();assert.equal(await archive.evaluate(()=>SB.Logic.archiveStatus(SB.Game.getState()).remaining),9);await archive.close();
    const convoy=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,storageState:campaignStorage});
    const convoyErrors=[];
    convoy.on('pageerror',e=>convoyErrors.push(String(e)));convoy.on('console',m=>{if(['warning','error'].includes(m.type()))convoyErrors.push(m.text());});
    convoy.on('dialog',d=>d.dismiss());
    await convoy.goto(url+'/signalbreak/index.html');await convoy.locator('#operation-picker summary').tap();await convoy.locator('[data-mission="stolen-convoy"]').tap();await convoy.locator('#start').tap();
    const beforeEscape=api.length;
    const startConvoy=await convoy.evaluate(()=>SB.Logic.convoyStatus(SB.Game.getState()));
    for(let turn=1;turn<=startConvoy.departureTurn;turn++)await convoy.locator('#end-turn').tap();
    assert.equal(await convoy.locator('#title').innerText(),'Convoy escaped.');
    assert.match(await convoy.locator('#tip').innerText(),/civilian manifests are gone/);
    assert.equal(api.length,beforeEscape);
    await convoy.locator('.map-wrap').screenshot({path:path.join(out,'stolen-convoy-escaped-phone.png')});
    await convoy.locator('#start').tap();
    assert.deepEqual(await convoy.evaluate(()=>SB.Logic.convoyStatus(SB.Game.getState())),startConvoy);
    const sidingRun=await drive(convoy,true,{useSiding:true});
    const sidingStatus=await convoy.evaluate(()=>SB.Logic.convoyStatus(SB.Game.getState()));
    assert.equal(sidingStatus.stoppedBy,'convoy-siding');assert.equal(sidingStatus.secured,true);
    assert.deepEqual(convoyErrors,[]);await convoy.close();
    // Treatment fixture: represent a saved mission-boundary injury explicitly.
    const recovery=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,storageState:campaignStorage});
    await recovery.goto(url+'/signalbreak/index.html');await recovery.evaluate(()=>{const c=JSON.parse(localStorage.getItem(SB.Campaign.key));c.roster.nia.injury=2;localStorage.setItem(SB.Campaign.key,JSON.stringify(c));});await recovery.reload();
    await recovery.locator('#prep-summary').tap();const beforeRecovery=await recovery.evaluate(()=>({hp:SB.Game.getState().squad[0].maxHp,c:JSON.parse(localStorage.getItem(SB.Campaign.key))}));
    await recovery.locator('[data-treat="nia"]').tap();const afterRecovery=await recovery.evaluate(()=>({hp:SB.Game.getState().squad[0].maxHp,c:JSON.parse(localStorage.getItem(SB.Campaign.key))}));
    assert.equal(afterRecovery.hp,beforeRecovery.hp+4);assert.equal(afterRecovery.c.supplies,beforeRecovery.c.supplies-1);assert.equal(afterRecovery.c.roster.nia.injury,0);
    await recovery.locator('.preparation').screenshot({path:path.join(out,'squad-preparation-phone.png')});assert.equal(await recovery.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await recovery.close();
    // Six-size new-mission sweep with earned unlocks. No tactical state injection.
    const newMissionSweeps=[];
    for(const[width,height]of[[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]])for(const id of operationIds.slice(1)){
      const p=await browser.newPage({viewport:{width,height},hasTouch:true,storageState:campaignStorage}),logs=[],external=[];
      p.on('pageerror',e=>logs.push(String(e)));p.on('console',m=>{if(['warning','error'].includes(m.type()))logs.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
      await p.goto(url+'/signalbreak/index.html');await p.locator('#operation-picker summary').tap();await p.locator(`[data-mission="${id}"]`).click();assert.equal(await p.locator('#operation-picker').evaluate(e=>e.open),false);await p.locator('.map-wrap').screenshot({path:path.join(out,`${id}-${width}x${height}-title.png`)});
      await p.locator('#start').scrollIntoViewIfNeeded();assert(await p.locator('#start').isVisible(),'briefing CTA reachable by scrolling');await p.locator('#start').click();const move=await p.evaluate(()=>{const s=SB.Game.getState(),u=s.squad[0];return [[1,0],[0,-1],[-1,0],[0,1]].map(([dx,dy])=>SB.Logic.preview(s,u.id,'move',u.x+dx,u.y+dy)).find(p=>p.legal);});assert(move,'reachable adjacent touch target '+id);await tile(p,move.x,move.y,true);assert(await p.evaluate(()=>SB.Game.getPreview()?.legal));await p.locator('#confirm').tap();
      const raised=await p.evaluate(()=>SB.Game.getState().heights[0]||SB.Game.getState().node);await p.locator('[data-action="attack"]').tap();await tile(p,raised.x,raised.y,true);
      const picked=await p.evaluate(()=>SB.Game.getPreview());assert.equal(picked.x,raised.x);assert.equal(picked.y,raised.y);await p.locator('#cancel').tap();
      const mastery=await p.evaluate(()=>SB.Game.getState().mastery);
      assert((await p.locator('#mastery-goal').innerText()).includes(mastery));
      await p.locator('.map-wrap').screenshot({path:path.join(out,`${id}-${width}x${height}-play.png`)});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(logs,[]);assert.deepEqual(external,[]);newMissionSweeps.push({id,width,height,logs,external});await p.close();
    }
    await page.locator('#start').click();assert.equal(await page.evaluate(()=>SB.Game.getState().score),0);
    // Loss fixture remains separate from legal-input, live-AI victories.
    await page.evaluate(()=>SB.Game.getState().squad.forEach(u=>u.hp=0));await page.locator('#end-turn').click();assert.equal(await page.evaluate(()=>SB.Game.getState().phase),'lost');
    assert.deepEqual(errors,[]);await page.close();
    const unavailable=await browser.newPage();await unavailable.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('unavailable');}}));await unavailable.goto(url+'/signalbreak/index.html');assert((await unavailable.locator('#save-status').innerText()).startsWith('Saving unavailable'));await unavailable.locator('#start').click();assert.equal(await unavailable.evaluate(()=>SB.Game.getMode()),'playing');await unavailable.close();
    const offline=await browser.newPage();await offline.goto('file:///'+path.join(root,'signalbreak/index.html').replace(/\\/g,'/'));await offline.locator('#start').click();assert.equal(await offline.evaluate(()=>SB.Game.getMode()),'playing');await offline.close();
    const retina=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});await retina.goto(url+'/signalbreak/index.html');await retina.locator('#start').click();assert(await retina.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return c.width===Math.round(r.width*2)&&c.height===Math.round(r.height*2);}));await retina.screenshot({path:path.join(out,'dpr2-phone.png')});await retina.close();
    const catalog=await browser.newPage({viewport:{width:1440,height:1000}});await catalog.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.fulfill({status:204}));await catalog.goto(url+'/index.html');
    assert.equal(await catalog.locator('.feature-visual').getAttribute('href'),'signalbreak/index.html');assert.equal(await catalog.locator('.featured .rate').getAttribute('data-id'),'signalbreak');
    assert.equal(await catalog.locator('#games .game-card').count(),15);assert.equal(await catalog.locator('#games .game-card[data-id="tidelock"]').count(),1);assert.equal(await catalog.locator('#games .game-card[data-id="gearwell"]').count(),1);
    assert(await catalog.locator('.feature-visual img').evaluate(i=>i.complete&&i.naturalWidth>0));await catalog.locator('.featured').screenshot({path:path.join(out,'catalog-feature.png')});await catalog.close();
    assert.deepEqual(sourceSnapshot(),initialSources,'runtime sources must remain unchanged throughout browser verification');
    fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({at:new Date().toISOString(),sources:initialSources},null,2));
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,newMissionSweeps,api,campaignRuns,sidingRun,dialogs,checks:'real keyboard/touch preview-confirm-cancel, raised tile picking, native-touch operations, '+campaignRuns.length+' legal-input live-AI campaign victories, convoy escape/retry and siding replay, earned unlock/save/reload, denied storage, delayed rank snapshot, file boot, DPR2'},null,2));console.log(JSON.stringify({viewports:results.length,newMissionViewports:newMissionSweeps.length,campaign:campaignRuns.map(r=>({...r.final,actions:r.actions.length})),siding:{...sidingRun.final,actions:sidingRun.actions.length},checks:'PASS'}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
