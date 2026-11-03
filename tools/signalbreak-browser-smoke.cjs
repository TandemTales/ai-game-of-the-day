const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'node_modules/.cache/signalbreak/browser-smoke');fs.mkdirSync(out,{recursive:true});
const api=[],results=[];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){const item={method:req.method,url:url.pathname+url.search};if(url.pathname.startsWith('/api/leaderboard/'))api.push(item);let body='';req.on('data',d=>body+=d);req.on('end',()=>{if(body)item.body=JSON.parse(body);res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({rank:1,success:true}));});return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end();}res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(data);});
});
async function tile(page,x,y,touch=false){
  await page.locator('#map').scrollIntoViewIfNeeded();
  await page.waitForTimeout(30);
  const p=await page.evaluate(({x,y})=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),s=SB.Game.getState(),v=SB.Game.getView(),d=Math.min(devicePixelRatio,2);const P=SB.Render.projection(c.width,c.height,s,{...v,panX:v.panX*d,panY:v.panY*d}),p=P.point(x,y,0);return{x:r.x+p.x*r.width/c.width,y:r.y+p.y*r.height/c.height};},{x,y});
  if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);
}
async function plan(page){return page.evaluate(()=>{
  const s=SB.Game.getState(),L=SB.Logic;
  for(const u of s.squad){if(!L.living(u)||!u.ap)continue;
    let p=[L.preview(s,u.id,'hack',s.node.x,s.node.y),L.preview(s,u.id,'rescue',s.rescue.x,s.rescue.y),L.preview(s,u.id,'extract',u.x,u.y)].find(p=>p.legal);
    if(!p)p=s.enemies.filter(L.living).map(e=>L.preview(s,u.id,'attack',e.x,e.y)).filter(p=>p.legal).sort((a,b)=>b.damage-a.damage)[0];
    if(!p){const enemies=s.enemies.filter(L.living);const goal=!s.network?s.node:enemies.length?enemies.sort((a,b)=>Math.abs(u.x-a.x)+Math.abs(u.y-a.y)-Math.abs(u.x-b.x)-Math.abs(u.y-b.y))[0]:!s.rescued?s.rescue:{x:15,y:10};let best=null;
      for(let y=1;y<s.height-1;y++)for(let x=1;x<s.width-1;x++){const q=L.preview(s,u.id,'move',x,y);if(!q.legal)continue;const value=(Math.abs(x-goal.x)+Math.abs(y-goal.y))*10+q.cost-L.cover(s,{x,y},goal)*.5;if(!best||value<best.value)best={value,p:q};}if(best)p=best.p;}
    if(p)return p;
  }return{kind:'end'};
});}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(edge)?edge:undefined});
  try{
    for(const[width,height]of[[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]]){
      const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[],external=[];
      page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(url))external.push(r.url());});
      await page.goto(url+'/signalbreak/index.html');await page.screenshot({path:path.join(out,`${width}x${height}-title.png`)});
      assert(await page.evaluate(()=>{const a=document.querySelector('.map-wrap').getBoundingClientRect(),b=document.querySelector('#start').getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom&&b.left>=a.left&&b.right<=a.right;}),'title CTA fits '+width);
      await page.locator('#start').click();assert.equal(await page.evaluate(()=>SB.Game.getMode()),'playing');
      await page.keyboard.press('ArrowRight');const before=await page.evaluate(()=>({...SB.Game.getState().squad[0]}));
      assert(await page.evaluate(()=>SB.Game.getPreview().legal));assert.equal(await page.evaluate(()=>SB.Game.getState().squad[0].x),before.x,'preview does not move');
      await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>SB.Game.getState().squad[0].x),before.x+1);
      await page.locator('[data-unit="rook"]').tap();assert.equal(await page.evaluate(()=>SB.Game.getView().selected),'rook');
      await tile(page,3,6,true);assert(await page.evaluate(()=>SB.Game.getPreview().legal));await page.locator('#cancel').tap();assert.equal(await page.evaluate(()=>SB.Game.getPreview()),null);
      await tile(page,3,6,true);await page.locator('#confirm').tap();assert.equal(await page.evaluate(()=>SB.Game.getState().squad[2].x),3,'native touch move/confirm');
      await page.locator('#zoom-in').tap();assert(await page.evaluate(()=>SB.Game.getView().zoom>1));
      await page.locator('#zoom-out').tap();await page.locator('#end-turn').tap();assert.equal(await page.evaluate(()=>SB.Game.getState().turn),2);
      await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`${width}x${height}-play.png`)});
      await page.locator('#pause').click();assert.equal(await page.evaluate(()=>SB.Game.getMode()),'paused');await page.locator('#start').click();
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,mode:SB.Game.getMode(),controls:[...document.querySelectorAll('.actions button,.confirmation button,.unit,.map-tools button')].map(b=>{const r=b.getBoundingClientRect();return{w:r.width,h:r.height};})}));assert.equal(metrics.overflow,false);metrics.controls.forEach(b=>assert(b.w>=44&&b.h>=44,'44px controls'));
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({viewport:[width,height],...metrics,errors,external});await page.close();
    }
    const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true}),errors=[],actions=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept('Signal QA'));
    await page.goto(url+'/signalbreak/index.html');await page.locator('#start').click();let circuitSeen=false;
    for(let i=0;i<180&&await page.evaluate(()=>SB.Game.getState().phase==='player');i++){
      const p=await plan(page);actions.push(p);
      if(p.kind==='end'){await page.locator('#end-turn').click();continue;}
      const idx=await page.evaluate(id=>SB.Game.getState().squad.findIndex(u=>u.id===id),p.actorId);await page.keyboard.press(String(idx+1));
      await page.locator(`[data-action="${p.kind}"]`).click();
      if(['move','attack','heal'].includes(p.kind))await tile(page,p.x,p.y);
      const shown=await page.evaluate(()=>SB.Game.getPreview());assert(shown&&shown.legal&&shown.kind===p.kind,JSON.stringify({wanted:p,shown}));
      await page.locator('#confirm').click();
      if(!circuitSeen&&await page.evaluate(()=>SB.Game.getState().network)){circuitSeen=true;await page.screenshot({path:path.join(out,'circuit-captured.png')});}
    }
    const final=await page.evaluate(()=>({phase:SB.Game.getState().phase,score:SB.Game.getState().score,turn:SB.Game.getState().turn,rescued:SB.Game.getState().rescued,extracted:SB.Game.getState().squad.filter(u=>u.extracted).length}));
    assert.equal(final.phase,'won');assert.equal(final.rescued,true);await page.screenshot({path:path.join(out,'operation-won.png')});await page.waitForTimeout(150);
    assert.equal(api.length,2);assert.equal(api[0].method,'GET');assert.equal(api[1].method,'POST');assert.equal(api[1].body.gameId,'signalbreak');assert.equal(api[1].body.score,final.score);
    await page.locator('#start').click();assert.equal(await page.evaluate(()=>SB.Game.getState().score),0);
    // Loss fixture is separate from the legal-input, live-AI victory above.
    await page.evaluate(()=>SB.Game.getState().squad.forEach(u=>u.hp=0));await page.locator('#end-turn').click();await page.screenshot({path:path.join(out,'operation-lost.png')});assert.equal(await page.evaluate(()=>SB.Game.getState().phase),'lost');
    assert.deepEqual(errors,[]);await page.close();
    const offline=await browser.newPage();await offline.goto('file:///'+path.join(root,'signalbreak/index.html').replace(/\\/g,'/'));await offline.locator('#start').click();assert.equal(await offline.evaluate(()=>SB.Game.getMode()),'playing');await offline.close();
    const retina=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});await retina.goto(url+'/signalbreak/index.html');await retina.locator('#start').click();assert(await retina.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return c.width===Math.round(r.width*2)&&c.height===Math.round(r.height*2);}));await retina.screenshot({path:path.join(out,'dpr2-phone.png')});await retina.close();
    const catalog=await browser.newPage({viewport:{width:1440,height:1000}});await catalog.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.fulfill({status:204}));await catalog.goto(url+'/index.html');
    assert.equal(await catalog.locator('.feature-visual').getAttribute('href'),'signalbreak/index.html');assert.equal(await catalog.locator('.featured .rate').getAttribute('data-id'),'signalbreak');
    assert.equal(await catalog.locator('#games .game-card').count(),15);assert.equal(await catalog.locator('#games .game-card[data-id="tidelock"]').count(),1);assert.equal(await catalog.locator('#games .game-card[data-id="gearwell"]').count(),1);
    assert(await catalog.locator('.feature-visual img').evaluate(i=>i.complete&&i.naturalWidth>0));await catalog.locator('.featured').screenshot({path:path.join(out,'catalog-feature.png')});await catalog.close();
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,api,final,actions,checks:'real keyboard/touch preview-confirm-cancel, turns, zoom, pause, full legal-input victory, fixture loss, retry, file boot, DPR2'},null,2));console.log(JSON.stringify({viewports:results.length,final,actions:actions.length,checks:'PASS'}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
