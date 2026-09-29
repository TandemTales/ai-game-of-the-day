'use strict';
// Real clock and native browser controls. State informs planning, never game mutation.
// Failed attempts are retained. This is not human discovery or enjoyment evidence.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require(process.env.PW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),mode=process.argv[2]||'keyboard',touch=mode==='touch';
const optionalMode=process.argv.includes('--optional');
const regionalMode=process.argv.includes('--regional');
const optional=require('./optional-pilot.cjs');
const diagnosticRoom=process.argv.find(a=>a.startsWith('--room='))?.slice(7);
if(diagnosticRoom&&!['channels','cloister','furnace','stars','descent'].includes(diagnosticRoom))throw new Error('Unsupported declared regional-entry fixture.');
if(regionalMode&&!diagnosticRoom)throw new Error('--regional requires a declared --room entry.');
const out=path.resolve(process.env.PW_SHOTS||'node_modules/.cache/prism-warden/sep27-native');fs.mkdirSync(out,{recursive:true});
const aq=require('./aqueduct-pilot.cjs'),engine=aq.loadPW();
let optionalPilot;
const pilots={
 'tidal-abbey':require('./abbey-pilot.cjs').createPilot(engine),
 'verdant-aqueduct':aq.createPilot(engine),
 'glass-kiln':require('./kiln-pilot.cjs').createPilot(engine),
 'night-observatory':require('./observatory-pilot.cjs').createPilot(),
 'drowned-crown':require('./crown-pilot.cjs').createPilot()
};
if(optionalMode)optionalPilot=optional.createPilot(engine);
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'text/html');res.end(data);});});
async function main(){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page;
 const report={mode,optionalMode,regionalMode,diagnosticRoom:diagnosticRoom||null,discoveries:[],equipmentUses:[],evidence:(diagnosticRoom?'Declared fresh '+diagnosticRoom+' entry fixture; NOT a whole-campaign route. ':'')+'Native inputs, persistent touch contacts and brief aim-only touch, ordinary game clock, read-only hidden-state planning; no human play claim',rooms:[],retries:[],a1Trace:[],a2Trace:[],b1Trace:[],b3Trace:[],errors:[],started:new Date().toISOString()};
 let lastB3Trace=-1,lastB3State='',lastDiscovery='',lastBlade=false,previousEnemies=[],lastPolarity='',maxPrisms=0;
 function traceChannels(s,input,actions,contacts){
  if(s.roomId!=='channels')return;
  const p=s.player,attempt=report.retries.filter(r=>r.room==='channels').length+1;
  const mortars=s.enemies.filter(e=>e.type==='mortar');
  const target=['mortar-north','mortar-mid','mortar-south'].map(id=>mortars.find(e=>e.id===id)).find(e=>e&&e.hp>0);
  const state=JSON.stringify([attempt,s.status,p.hp,s.hits,mortars.map(e=>[e.id,e.hp,e.phase,e.clang>0]),s.lobs.map(l=>l.id)]);
  if(s.roomTime-lastB3Trace<.1&&state===lastB3State)return;
  report.b3Trace.push({attempt,status:s.status,roomTime:s.roomTime,time:s.time,player:{x:p.x,y:p.y,hp:p.hp,aimX:p.aimX,aimY:p.aimY,reflecting:p.reflecting,slashTime:p.slashTime,slashCooldown:p.slashCooldown,dashTime:p.dashTime,dashCooldown:p.dashCooldown,invulnerable:p.invulnerable,wading:p.wading},hits:s.hits,returns:s.returns,tide:s.tide,water:s.water.filter(w=>w.active),wade:s._wade,mortars:mortars.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,phase:e.phase,timer:e.timer,aimX:e.aimX,aimY:e.aimY,facingX:e.facingX,facingY:e.facingY,clang:e.clang})),lobs:s.lobs.map(l=>({id:l.id,owner:l.owner,tx:l.tx,ty:l.ty,r:l.r,impactIn:l.flight-l.t})),waypoint:target&&{x:target.x+56,y:target.y,distance:Math.hypot(target.x+56-p.x,target.y-p.y)},input,actions:actions.map(a=>a[0]),contacts:contacts.map(t=>({...t})),message:s.message});
  lastB3Trace=s.roomTime;lastB3State=state;
 }
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
  page=await browser.newPage({viewport:touch?{width:390,height:844}:{width:1440,height:900},hasTouch:touch});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);await page.locator('#begin').click();
  if(diagnosticRoom)await page.evaluate(room=>PW.enterRoom(PW.game,room),diagnosticRoom);
  const cdp=await page.context().newCDPSession(page);let minorDuty=.5;let keys=new Set(),activeTouch=false,touchContacts=[],lastRoom='',roomStart=0,lastSlash=-1,lastPlace=-1,lastBurst=-1,lastDash=-1,lastA1Trace=-1,lastA1State='',lastA1GateAt=-1,lastA2Trace=-1,lastA2Hp=-1,lastB1Trace=-1,lastB1Hp=-1,lastB1Charge=-1;
  const begin=Date.now(),limit=Number(process.env.PW_MAX_SECONDS||900)*1000;
  const boxes=await page.evaluate(()=>Object.fromEntries(['movePad','mirrorPad','slash','dash','prism','burst','polarity'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}];})));
  async function release(){for(const key of keys)await page.keyboard.up(key);keys.clear();if(activeTouch){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:touchContacts});touchContacts=[];activeTouch=false;}}
  while(Date.now()-begin<limit){
   const snapshot=await page.evaluate(()=>{const s=PW.game,r=document.getElementById('scene').getBoundingClientRect(),v=PW.view(s,r.width,r.height);return{s:JSON.parse(JSON.stringify({...s,_entry:null,_regionEntry:null,roomStates:{},particles:[]})),view:{...v,left:r.left,top:r.top,width:r.width,height:r.height},boxes:Object.fromEntries(['movePad','mirrorPad','slash','dash','prism','burst','polarity'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return[id,{x:b.x+b.width/2,y:b.y+b.height/2,w:b.width,h:b.height}];}))};});
   const s=snapshot.s,p=s.player;
   const checklist=optional.discoveryChecklist(engine,s),discoveryKey=JSON.stringify(checklist);
   if(discoveryKey!==lastDiscovery){report.discoveries.push({room:s.roomId,time:s.time,checklist});lastDiscovery=discoveryKey;}
   if(s.blade&&!lastBlade)report.equipmentUses.push({kind:'blade-launched',room:s.roomId,time:s.time,x:p.x,y:p.y,targets:s.enemies.filter(e=>e.hp>0).map(e=>({id:e.id,hp:e.hp,exposed:e.exposed,distance:Math.hypot(e.x-p.x,e.y-p.y)}))});
   if(lastBlade&&s.blade&&s.blade.phase==='returning')for(const e of s.enemies){const old=previousEnemies.find(v=>v.id===e.id);if(old&&old.hp>e.hp)report.equipmentUses.push({kind:'damage-during-blade-flight',room:s.roomId,time:s.time,enemy:e.id,before:old.hp,after:e.hp});}
   lastBlade=!!s.blade;previousEnemies=s.enemies.map(e=>({id:e.id,hp:e.hp}));
   const prisms=s.mirrors.filter(m=>m.portable).length;if(prisms>maxPrisms){maxPrisms=prisms;report.equipmentUses.push({kind:'simultaneous-prisms',count:prisms,room:s.roomId,time:s.time});}
   if(s.flags.polarity&&s.flags.polarity!==lastPolarity){report.equipmentUses.push({kind:'polarity-state',value:s.flags.polarity,room:s.roomId,time:s.time});lastPolarity=s.flags.polarity;}

   if(s.regionId==='tidal-abbey'&&s.roomId==='sluice'&&s.status==='playing'&&(s.roomTime-lastA2Trace>=1||p.hp!==lastA2Hp)){
    report.a2Trace.push({attempt:report.retries.filter(r=>r.room==='sluice').length+1,roomTime:+s.roomTime.toFixed(2),time:+s.time.toFixed(2),x:+p.x.toFixed(1),y:+p.y.toFixed(1),hp:p.hp,hits:s.hits,wading:p.wading,wade:+s._wade.toFixed(2),water:s.water.filter(w=>w.active&&p.x>=w.x&&p.x<=w.x+w.w&&p.y>=w.y&&p.y<=w.y+w.h).map(w=>w.id),tideHigh:s.tide.high,tideNext:+s.tide.next.toFixed(2),seal:{active:s.receivers[0].active,charge:+s.receivers[0].charge.toFixed(2)},breakwaters:s.breakwaters.map(b=>({id:b.id,risen:b.risen})),message:s.message});
    lastA2Trace=s.roomTime;lastA2Hp=p.hp;
   }
   if(s.regionId==='verdant-aqueduct'&&s.roomId==='spillway'&&s.status==='playing'&&(s.roomTime-lastB1Trace>=1||p.hp!==lastB1Hp||s.receivers[0].charge!==lastB1Charge)){
    const placed=s.mirrors.find(m=>m.portable);
    report.b1Trace.push({attempt:report.retries.filter(r=>r.room==='spillway').length+1,roomTime:+s.roomTime.toFixed(2),time:+s.time.toFixed(2),x:+p.x.toFixed(1),y:+p.y.toFixed(1),hp:p.hp,hits:s.hits,aimX:+p.aimX.toFixed(3),aimY:+p.aimY.toFixed(3),reflecting:p.reflecting,prism:p.prism,mirror:placed&&{x:+placed.x.toFixed(1),y:+placed.y.toFixed(1),index:placed.index,lit:placed.lit},seal:{active:s.receivers[0].active,charge:+s.receivers[0].charge.toFixed(2),lit:s.receivers[0].lit},gate:s.gates[0].open,turret:s.enemies[0]&&{phase:s.enemies[0].phase,timer:+s.enemies[0].timer.toFixed(2),shotsLeft:s.enemies[0].shotsLeft},message:s.message});
    lastB1Trace=s.roomTime;lastB1Hp=p.hp;lastB1Charge=s.receivers[0].charge;
   }
   if(s.roomId!==lastRoom){lastRoom=s.roomId;roomStart=Date.now();const entry={room:s.roomId,time:s.time,hp:p.hp,wallSeconds:(Date.now()-begin)/1000};report.rooms.push(entry);console.log(mode+' '+JSON.stringify(entry));await page.screenshot({path:path.join(out,`${mode}-${String(report.rooms.length).padStart(2,'0')}-${s.roomId}.png`)});}
   if(diagnosticRoom&&!regionalMode&&s.roomId!==diagnosticRoom){report.outcome={status:s.status,diagnosticCleared:!!s.cleared.B3,room:s.roomId,time:s.time,hp:p.hp,hits:s.hits,cleared:s.cleared,wallSeconds:(Date.now()-begin)/1000};break;}
   if(s.status==='cleared'){
    if(regionalMode){report.outcome={status:s.status,regionalCleared:true,room:s.roomId,time:s.time,hp:p.hp,score:s.score,cleared:s.cleared,flags:s.flags,checklist:optional.discoveryChecklist(engine,s),wallSeconds:(Date.now()-begin)/1000};break;}
    await release();const pick=optionalMode?{'tidal-abbey':'mobile-reflection','verdant-aqueduct':'returning-blade','glass-kiln':'second-prism','night-observatory':'lasting-bridge'}[s.regionId]:{'tidal-abbey':'mobile-reflection','verdant-aqueduct':'heavy-strike','glass-kiln':'prism-recall','night-observatory':'lasting-bridge'}[s.regionId];
    await page.locator(`[data-equipment="${pick}"]`).click();
    if(s.regionId==='night-observatory')await page.locator('[data-restoration="channels"]').click();
    await page.locator('#begin').click();continue;
   }
   if(s.status!=='playing')traceChannels(s,null,[],touchContacts);
   if(s.status==='lost'&&report.retries.filter(r=>r.room===s.roomId).length<2&&report.retries.length<6){
    await page.screenshot({path:path.join(out,`${mode}-${s.roomId}-loss-${report.retries.filter(r=>r.room===s.roomId).length+1}.png`)});
    if(s.roomId==='sluice')await page.screenshot({path:path.join(out,`${mode}-a2-loss-${report.retries.filter(r=>r.room==='sluice').length+1}.png`)});
    if(s.roomId==='spillway')await page.screenshot({path:path.join(out,`${mode}-b1-loss-${report.retries.filter(r=>r.room==='spillway').length+1}.png`)});
    await release();report.retries.push({room:s.roomId,time:s.time,hp:p.hp,wallSeconds:(Date.now()-begin)/1000});
    const moduleName={'tidal-abbey':'abbey','verdant-aqueduct':'aqueduct','glass-kiln':'kiln','night-observatory':'observatory','drowned-crown':'crown'}[s.regionId];
    pilots[s.regionId]=require('./'+moduleName+'-pilot.cjs').createPilot(...(['observatory','crown'].includes(moduleName)?[]:[engine]));
    await page.locator('#begin').click();await page.waitForFunction(()=>PW.game.status==='playing');roomStart=Date.now();lastSlash=lastPlace=lastBurst=lastDash=-1;minorDuty=.5;lastA1Trace=-1;lastA1State='';lastA1GateAt=-1;lastA2Trace=-1;lastA2Hp=-1;lastB1Trace=-1;lastB1Hp=-1;lastB1Charge=-1;console.log(mode+' retry '+s.roomId);continue;
   }
   if(s.status!=='playing'){report.outcome={status:s.status,time:s.time,hp:p.hp,hits:s.hits,score:s.score,cleared:s.cleared,flags:s.flags,wallSeconds:(Date.now()-begin)/1000};break;}
   if(Date.now()-roomStart>180000){report.failure='Three-minute room timeout at '+s.roomId;break;}
   const i=optionalMode?optionalPilot(s):pilots[s.regionId](s);
   // Use the selected ranged weapon in a real exposure window. The ordinary
   // planner still releases Mirror for turning optics and close melee.
   if(optionalMode&&s.equipment['verdant-aqueduct']==='returning-blade'&&!s.blade&&p.slashCooldown<=0){
    const target=s.enemies.find(e=>{const d=Math.hypot(e.x-p.x,e.y-p.y);return e.hp>0&&e.exposed>d/430+.15&&d>90&&d<290&&!engine.raySegment(p.x,p.y,e.x-p.x,e.y-p.y,aq.solids(s),d).rect;});
    if(target){const d=Math.hypot(target.x-p.x,target.y-p.y);Object.assign(i,{mx:0,my:0,ax:(target.x-p.x)/d,ay:(target.y-p.y)/d,slash:true,reflect:true,throwBlade:true});}
   }
   if(i.slash&&!i.throwBlade)i.reflect=false;
   // One actual key/pointer press per action; held-input edge state is not injected.
   const actions=[];
   if(i.slash&&s.time-lastSlash>.1){actions.push(['slash','j']);lastSlash=s.time;}
   if(i.place&&s.time-lastPlace>.22){actions.push(['prism','q']);lastPlace=s.time;}
   if(i.burst&&s.time-lastBurst>.22){actions.push(['burst','r']);lastBurst=s.time;}
   if(i.dash&&s.time-lastDash>.22){actions.push(['dash','Space']);lastDash=s.time;}
   if(i.polarity)actions.push(['polarity','f']);
   traceChannels(s,i,actions,touchContacts);
   if(s.regionId==='tidal-abbey'&&s.roomId==='cloister'&&s.status==='playing'){
    const sent=s.enemies.find(e=>e.type==='sentinel'),turret=s.enemies.find(e=>e.type==='turret');
    const state=[p.hp,s.gates[0]&&s.gates[0].open,sent&&sent.hp,sent&&sent.phase,sent&&sent.exposed>0].join('|');
    if(s.gates[0]&&s.gates[0].open&&lastA1GateAt<0)lastA1GateAt=s.roomTime;
    const fastA1=lastA1GateAt>=0&&s.roomTime-lastA1GateAt<=20;
    if(s.roomTime-lastA1Trace>=(fastA1?0.25:1)||state!==lastA1State){
     const compactShot=sh=>({owner:sh.owner,friendly:!!sh.friendly,x:+sh.x.toFixed(1),y:+sh.y.toFixed(1),vx:+sh.vx.toFixed(2),vy:+sh.vy.toFixed(2),r:sh.r});
     const aimChange=Math.hypot(i.ax-p.aimX,i.ay-p.aimY)>.025;
     report.a1Trace.push({roomTime:+s.roomTime.toFixed(2),time:+s.time.toFixed(2),x:+p.x.toFixed(1),y:+p.y.toFixed(1),hp:p.hp,hits:s.hits,returns:s.returns,aimX:+p.aimX.toFixed(3),aimY:+p.aimY.toFixed(3),reflecting:p.reflecting,slashTime:+p.slashTime.toFixed(2),slashCooldown:+p.slashCooldown.toFixed(2),receiver:s.receivers[0]&&{active:s.receivers[0].active,charge:+s.receivers[0].charge.toFixed(2)},gate:s.gates[0]&&s.gates[0].open,sentinel:sent&&{x:+sent.x.toFixed(1),y:+sent.y.toFixed(1),hp:sent.hp,phase:sent.phase,timer:+sent.timer.toFixed(2),shotsLeft:sent.shotsLeft,exposed:+sent.exposed.toFixed(2),aimX:+sent.aimX.toFixed(3),aimY:+sent.aimY.toFixed(3)},turret:turret&&{phase:turret.phase,timer:+turret.timer.toFixed(2),shotsLeft:turret.shotsLeft},shots:s.shots.map(compactShot),input:{mx:+(i.mx||0).toFixed(3),my:+(i.my||0).toFixed(3),ax:+i.ax.toFixed(3),ay:+i.ay.toFixed(3),reflect:!!i.reflect,slash:!!i.slash,dash:!!i.dash,aimChange,mirrorContactDown:touchContacts.some(t=>t.id===2),actions:actions.map(a=>a[0])}});
     lastA1Trace=s.roomTime;lastA1State=state;
    }
   }
   if(touch){
    const move=snapshot.boxes.movePad,mirror=snapshot.boxes.mirrorPad,desired=new Map();
    if(Math.hypot(i.mx||0,i.my||0)>.01)desired.set(1,{id:1,x:move.x+(i.mx||0)*28,y:move.y+(i.my||0)*28});
    // The aim persists after release, so tap the mirror pad briefly when aim changes without guarding.
    const aimChanged=Math.hypot(i.ax-p.aimX,i.ay-p.aimY)>.025;
    const aimTouch=!!i.reflect||aimChanged;
    if(aimTouch)desired.set(2,{id:2,x:mirror.x+i.ax*28,y:mirror.y+i.ay*28});
    const ending=touchContacts.filter(t=>!desired.has(t.id));
    if(ending.length){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:ending});touchContacts=touchContacts.filter(t=>desired.has(t.id));}
    const activeIds=new Set(touchContacts.map(t=>t.id));
    const starting=[];
    if(desired.has(1)&&!activeIds.has(1))starting.push({id:1,x:move.x,y:move.y});
    if(desired.has(2)&&!activeIds.has(2))starting.push({id:2,x:mirror.x,y:mirror.y});
    if(starting.length){touchContacts.push(...starting);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchContacts});}
    touchContacts=touchContacts.map(t=>desired.get(t.id)||t);
    if(touchContacts.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchContacts});
    if(aimChanged&&!i.reflect){const aimPoint=touchContacts.find(t=>t.id===2);if(aimPoint){await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[aimPoint]});touchContacts=touchContacts.filter(t=>t.id!==2);}}
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
  if((regionalMode?!report.outcome.regionalCleared:diagnosticRoom?!report.outcome.diagnosticCleared:report.outcome.status!=='won')||report.errors.length)process.exitCode=1;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,mode+'-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({mode,optionalMode,regionalMode,outcome:report.outcome,failure:report.failure,retries:report.retries,errors:report.errors,equipmentUses:report.equipmentUses,reportFile:path.join(out,mode+'-report.json')}));if(browser)await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
