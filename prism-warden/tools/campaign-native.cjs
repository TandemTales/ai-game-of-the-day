'use strict';
// Real clock and native browser controls. State informs planning, never game mutation.
// Failed attempts are retained. This is not human discovery or enjoyment evidence.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require(process.env.PW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),mode=process.argv[2]||'keyboard',touch=mode==='touch';
const out=path.resolve(process.env.PW_SHOTS||'node_modules/.cache/prism-warden/sep27-native');fs.mkdirSync(out,{recursive:true});
const aq=require('./aqueduct-pilot.cjs'),engine=aq.loadPW();
const pilots={
 'tidal-abbey':require('./abbey-pilot.cjs').createPilot(engine),
 'verdant-aqueduct':aq.createPilot(engine),
 'glass-kiln':require('./kiln-pilot.cjs').createPilot(engine),
 'night-observatory':require('./observatory-pilot.cjs').createPilot(),
 'drowned-crown':require('./crown-pilot.cjs').createPilot()
};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'text/html');res.end(data);});});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;
 const report={mode,evidence:'Native inputs, persistent touch contacts, ordinary game clock, read-only hidden-state planning; no human play claim',rooms:[],retries:[],a2Trace:[],errors:[],started:new Date().toISOString()};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
  page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1440,height:900},hasTouch:touch});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);await page.locator('#begin').click();
  const cdp=await page.context().newCDPSession(page);let minorDuty=.5;let keys=new Set(),activeTouch=false,touchContacts=[],lastRoom='',roomStart=0,lastSlash=-1,lastPlace=-1,lastBurst=-1,lastDash=-1,lastA2Trace=-1,lastA2Hp=-1;
  const begin=Date.now(),limit=Number(process.env.PW_MAX_SECONDS||900)*1000;
  const boxes=await page.evaluate(()=>Object.fromEntries(['movePad','mirrorPad','slash','dash','prism','burst','polarity'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}];})));
  async function release(){for(const key of keys)await page.keyboard.up(key);keys.clear();if(activeTouch){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:touchContacts});touchContacts=[];activeTouch=false;}}
  while(Date.now()-begin<limit){
   const snapshot=await page.evaluate(()=>{const s=PW.game,r=document.getElementById('scene').getBoundingClientRect(),v=PW.view(s,r.width,r.height);return{s:JSON.parse(JSON.stringify({...s,_entry:null,_regionEntry:null,roomStates:{},particles:[]})),view:{...v,left:r.left,top:r.top,width:r.width,height:r.height},boxes:Object.fromEntries(['movePad','mirrorPad','slash','dash','prism','burst','polarity'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return[id,{x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}];}))};});
   const s=snapshot.s,p=s.player;
   if(s.regionId==='tidal-abbey'&&s.roomId==='sluice'&&s.status==='playing'&&(s.roomTime-lastA2Trace>=1||p.hp!==lastA2Hp)){
    report.a2Trace.push({attempt:report.retries.filter(r=>r.room==='sluice').length+1,roomTime:+s.roomTime.toFixed(2),time:+s.time.toFixed(2),x:+p.x.toFixed(1),y:+p.y.toFixed(1),hp:p.hp,hits:s.hits,wading:p.wading,wade:+s._wade.toFixed(2),water:s.water.filter(w=>w.active&&p.x>=w.x&&p.x<=w.x+w.w&&p.y>=w.y&&p.y<=w.y+w.h).map(w=>w.id),tideHigh:s.tide.high,tideNext:+s.tide.next.toFixed(2),seal:{active:s.receivers[0].active,charge:+s.receivers[0].charge.toFixed(2)},breakwaters:s.breakwaters.map(b=>({id:b.id,risen:b.risen})),message:s.message});
    lastA2Trace=s.roomTime;lastA2Hp=p.hp;
   }
   if(s.roomId!==lastRoom){lastRoom=s.roomId;roomStart=Date.now();const entry={room:s.roomId,time:s.time,hp:p.hp,wallSeconds:(Date.now()-begin)/1000};report.rooms.push(entry);console.log(mode+' '+JSON.stringify(entry));await page.screenshot({path:path.join(out,`${mode}-${String(report.rooms.length).padStart(2,'0')}-${s.roomId}.png`)});}
   if(s.status==='cleared'){
    await release();const pick={'tidal-abbey':'mobile-reflection','verdant-aqueduct':'heavy-strike','glass-kiln':'prism-recall','night-observatory':'lasting-bridge'}[s.regionId];
    await page.locator(`[data-equipment="${pick}"]`).click();
    if(s.regionId==='night-observatory')await page.locator('[data-restoration="channels"]').click();
    await page.locator('#begin').click();continue;
   }
   if(s.status==='lost'&&report.retries.filter(r=>r.room===s.roomId).length<2&&report.retries.length<6){
    if(s.roomId==='sluice')await page.screenshot({path:path.join(out,`${mode}-a2-loss-${report.retries.filter(r=>r.room==='sluice').length+1}.png`)});
    await release();report.retries.push({room:s.roomId,time:s.time,hp:p.hp,wallSeconds:(Date.now()-begin)/1000});
    const moduleName={'tidal-abbey':'abbey','verdant-aqueduct':'aqueduct','glass-kiln':'kiln','night-observatory':'observatory','drowned-crown':'crown'}[s.regionId];
    pilots[s.regionId]=require('./'+moduleName+'-pilot.cjs').createPilot(...(['observatory','crown'].includes(moduleName)?[]:[engine]));
    await page.locator('#begin').click();await page.waitForFunction(()=>PW.game.status==='playing');roomStart=Date.now();lastSlash=lastPlace=lastBurst=lastDash=-1;minorDuty=.5;lastA2Trace=-1;lastA2Hp=-1;console.log(mode+' retry '+s.roomId);continue;
   }
   if(s.status!=='playing'){report.outcome={status:s.status,time:s.time,hp:p.hp,hits:s.hits,score:s.score,cleared:s.cleared,flags:s.flags,wallSeconds:(Date.now()-begin)/1000};break;}
   if(Date.now()-roomStart>180000){report.failure='Three-minute room timeout at '+s.roomId;break;}
   const i=pilots[s.regionId](s);if(i.slash)i.reflect=false;
   // One actual key/pointer press per action; held-input edge state is not injected.
   const actions=[];
   if(i.slash&&s.time-lastSlash>.1){actions.push(['slash','j']);lastSlash=s.time;}
   if(i.place&&s.time-lastPlace>.22){actions.push(['prism','q']);lastPlace=s.time;}
   if(i.burst&&s.time-lastBurst>.22){actions.push(['burst','r']);lastBurst=s.time;}
   if(i.dash&&s.time-lastDash>.22){actions.push(['dash','Space']);lastDash=s.time;}
   if(i.polarity)actions.push(['polarity','f']);
   if(touch){
    const move=snapshot.boxes.movePad,mirror=snapshot.boxes.mirrorPad,desired=new Map();
    if(Math.hypot(i.mx||0,i.my||0)>.01)desired.set(1,{id:1,x:move.x+(i.mx||0)*28,y:move.y+(i.my||0)*28});
    // Keep the native mirror finger down only while guarding; its last aim remains stored on release.
    if(i.reflect)desired.set(2,{id:2,x:mirror.x+i.ax*28,y:mirror.y+i.ay*28});
    const ending=touchContacts.filter(t=>!desired.has(t.id));
    if(ending.length){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:ending});touchContacts=touchContacts.filter(t=>desired.has(t.id));}
    const activeIds=new Set(touchContacts.map(t=>t.id));
    const starting=[];
    if(desired.has(1)&&!activeIds.has(1))starting.push({id:1,x:move.x,y:move.y});
    if(desired.has(2)&&!activeIds.has(2))starting.push({id:2,x:mirror.x,y:mirror.y});
    if(starting.length){touchContacts.push(...starting);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchContacts});}
    touchContacts=touchContacts.map(t=>desired.get(t.id)||t);
    if(touchContacts.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchContacts});
    for(const [id]of actions){const b=snapshot.boxes[id]||boxes[id];if(b&&b.w){const point={id:3,x:b.x,y:b.y};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...touchContacts,point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[point]});}}
    activeTouch=touchContacts.length>0;
   }else{
    const want=new Set(),ax=Math.abs(i.mx||0),ay=Math.abs(i.my||0);
    // Keyboard has eight directions. Preserve small steering components with
    // timed diagonal pulses instead of dropping them and sticking on corners.
    if(Math.max(ax,ay)>.01){const horizontal=ax>=ay,major=horizontal?ax:ay,minor=horizontal?ay:ax,r=minor/major;
     minorDuty+=Math.SQRT2*r/(1+(Math.SQRT2-1)*r);const diagonal=minorDuty>=1;if(diagonal)minorDuty-=1;
     if(horizontal||diagonal)want.add(i.mx<0?'a':'d');if(!horizontal||diagonal)want.add(i.my<0?'w':'s');}
    if(i.reflect)want.add('Shift');
    for(const k of keys)if(!want.has(k))await page.keyboard.up(k);for(const k of want)if(!keys.has(k))await page.keyboard.down(k);keys=want;
    const v=snapshot.view,px=(p.x-v.x)*v.scale,py=(p.y-v.y)*v.scale;let len=90;
    if(i.ax>0)len=Math.min(len,(v.width-px-2)/i.ax);if(i.ax<0)len=Math.min(len,(2-px)/i.ax);if(i.ay>0)len=Math.min(len,(v.height-py-2)/i.ay);if(i.ay<0)len=Math.min(len,(2-py)/i.ay);
    await page.mouse.move(v.left+px+i.ax*len,v.top+py+i.ay*len);for(const [,key]of actions)await page.keyboard.press(key);
   }
   await page.waitForTimeout(12);
  }
  await release();await page.waitForTimeout(300);await page.screenshot({path:path.join(out,mode+'-final.png')});
  if(!report.outcome)report.outcome=await page.evaluate(()=>({status:PW.game.status,room:PW.game.roomId,time:PW.game.time,hp:PW.game.player.hp,player:PW.game.player,mirrors:PW.game.mirrors,receivers:PW.game.receivers,cleared:PW.game.cleared}));
  if(report.outcome.status!=='won'||report.errors.length)process.exitCode=1;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,mode+'-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(browser)await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
