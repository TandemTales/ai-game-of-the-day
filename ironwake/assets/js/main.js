import { createRenderer } from './render.js';
const $ = id => document.getElementById(id);
let saved;try{saved=JSON.parse(localStorage.getItem('ironwake-campaign-v1'));}catch{}
const state = IW.restoreCampaign(saved);
let paused=false,lastBrief=-1,saveAvailable=true;
function save(){try{localStorage.setItem('ironwake-campaign-v1',JSON.stringify(IW.campaignSave(state)));}catch{saveAvailable=false;}}
const input = {moveX:0,moveZ:0,aimX:-10,aimZ:-8,fire:false,punch:false,vent:false,rip:false};
const keys = new Set(), pointers = new Map(), queued = new Set();
let renderer, previous=0, running=true, lastStatus='', stickPointer=null, stickX=0,stickZ=0;
let touchFirePointer=null, fieldAimPointer=null, fireOriginX=0,fireOriginY=0,touchAimDirection=null;
let audioContext, muted=false, lastEffect=0;
function audio(freq,duration,volume,type='square') {
  if(muted || !audioContext) return;
  const osc=audioContext.createOscillator(), gain=audioContext.createGain(), now=audioContext.currentTime;
  osc.type=type;osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.4),now+duration);
  gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
  osc.connect(gain);gain.connect(audioContext.destination);osc.start();osc.stop(now+duration);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
function enableAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch{}}
const actions=['fire','punch','vent','rip','dash','interact'];
function clearInput(){keys.clear();pointers.clear();queued.clear();touchFirePointer=fieldAimPointer=null;touchAimDirection=null;$('crosshair').style.display='none';stickPointer=null;stickX=stickZ=0;for(const k of actions) input[k]=false;input.moveX=input.moveZ=0;$('stickKnob').style.transform='';document.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));}
function start(){clearInput();paused=false;$('mapPanel').hidden=true;IW.start(state);save();input.aimX=state.player.x;input.aimZ=state.player.z-20;$('scoreStatus').textContent='';lastEffect=0;enableAudio();audio(110,.3,.07,'sawtooth');sync();$('scene').focus({preventScroll:true});}
$('start').onclick=start;$('retry').onclick=start;
$('mute').onclick=()=>{muted=!muted;$('mute').textContent=muted?'SOUND OFF':'SOUND ON';$('mute').setAttribute('aria-pressed',String(muted));};
function drawJournal(listId){
 const entries=IW.archiveEntries(state),list=$(listId);
 list.replaceChildren(...entries.map(entry=>{
  const li=document.createElement('li'),title=document.createElement('h3'),text=document.createElement('p'),status=document.createElement('small');
  li.dataset.archiveId=entry.id;title.textContent=String(entry.chapter+1).padStart(2,'0')+' / '+entry.title;text.textContent=entry.text;
  status.textContent=entry.secured?'SAVED AT CHAPTER CHECKPOINT':state.status==='lost'?'LOST WITH MECH • RECOVER AGAIN ON RETRY':'RECOVERED THIS ATTEMPT • COMPLETE CHAPTER TO SAVE';
  li.append(title,text,status);
  if(entry.id==='cache-0-0'&&state.chapter===0){const outcome=document.createElement('p'),relay=state.pickups.find(c=>c.type==='relay');outcome.textContent=state.status==='lost'?'Battery codes and sabotage reset on retry.':relay?.taken?'BATTERY SABOTAGED • Coastal artillery disabled.':state.status==='won'?'Chapter completed without using the optional battery relay.':'OPTIONAL ROUTE UNLOCKED • Find Battery relay in Supplies & Archives. Hold INTERACT for 5 uninterrupted seconds; stay alert for shells.';li.append(outcome);}
  return li;
 }));
 if(!entries.length){const li=document.createElement('li');li.textContent='No archives recovered. White signals on the mission map mark optional stories from the coast.';list.append(li);}
 return entries.length;
}
function drawCacheList(){
 const p=state.player,labels={intel:'Archive',repair:'Repair',core:'Capacitor',relay:'Battery relay'},directions=['N','NE','E','SE','S','SW','W','NW'];
 const caches=state.pickups.filter(c=>!c.taken&&!c.locked).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
 $('cacheList').replaceChildren(...caches.map(c=>{
  const li=document.createElement('li'),name=document.createElement('strong'),distance=document.createElement('span');
  li.dataset.cacheId=c.id;li.dataset.kind=c.type;name.textContent=labels[c.type];
  const bearing=(Math.round(Math.atan2(c.x-p.x,p.z-c.z)/(Math.PI/4))+8)%8;
  distance.textContent=Math.ceil(Math.hypot(c.x-p.x,c.z-p.z))+' m '+directions[bearing];li.append(name,distance);
  if(c.type==='relay'){const hint=document.createElement('small');hint.textContent='OPTIONAL • Hold INTERACT nearby for 5 uninterrupted seconds to disable coastal artillery. Leaving or releasing resets the hack; incoming shells remain dangerous.';li.append(hint);}
  if(c.id==='cache-0-0'){const hint=document.createElement('small');hint.textContent='OPTIONAL • Ferry command codes reveal a route to disable the coastal artillery.';li.append(hint);}
  return li;
 }));
 $('cacheEmpty').hidden=!!caches.length;
}
function toggleMap(force){if(state.status!=='playing')return;paused=typeof force==='boolean'?force:!paused;clearInput();$('mapPanel').hidden=!paused;if(paused){drawMap($('fullMap'));drawCacheList();$('archiveCount').textContent=drawJournal('archiveEntries')+' / 5';const c=IW.CAMPAIGN[state.chapter];$('mapTitle').textContent=c.title;$('mapObjectives').replaceChildren(...state.objectives.map((o,i)=>{const li=document.createElement('li');li.textContent=(o.done?'✓ ':i===state.stage?'→ ':'')+o.title;li.className=i===state.stage?'current':'';return li;}));$('mapRadio').textContent=state.radio;$('upgradeSummary').textContent=`Hull ${state.upgrades.armor} · Cooling ${state.upgrades.reactor} · Damage ${state.upgrades.damage}`;$('mapPanel').scrollTop=0;$('resume').focus({preventScroll:true});}else $('scene').focus();}
$('mapButton').onclick=()=>toggleMap();$('radar').onclick=()=>toggleMap();$('resume').onclick=()=>toggleMap(false);
$('signalsButton').onclick=()=>{$('archiveJournal').open=true;$('cachePanel').scrollIntoView({block:'start'});$('archiveJournal').querySelector('summary').focus({preventScroll:true});};
$('newCampaign').onclick=()=>{Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,IW.createCampaignState(0));lastBrief=-1;lastStatus='';save();sync();};
$('restartCampaign').onclick=$('newCampaign').onclick;
document.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>{if(IW.advance(state,b.dataset.upgrade)){save();lastBrief=-1;lastStatus='';sync();$('overlay').scrollTop=0;$('start').focus();}});
window.addEventListener('keydown',e=>{if(e.target.closest('input'))return;if((e.key==='Tab'&&!e.shiftKey&&e.target===canvas)||e.key==='Escape'){e.preventDefault();if(!e.repeat)toggleMap();return;}if(e.target.closest('button')||paused)return;const k=e.key.toLowerCase();if([' ','w','a','s','d','e','q','f','shift'].includes(k)||e.key.startsWith('Arrow'))e.preventDefault();if(e.key==='Enter'&&state.status==='ready'){start();return;}keys.add(k);const action={e:'punch',q:'rip',f:'interact',shift:'dash'}[k];if(action)queued.add(action);});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{clearInput();if(state.status==='playing')toggleMap(true);});document.addEventListener('visibilitychange',()=>{clearInput();previous=0;if(document.hidden&&state.status==='playing')toggleMap(true);});
const canvas=$('scene');canvas.addEventListener('contextmenu',e=>e.preventDefault());
function aim(e){
 if(!renderer||state.status!=='playing'||paused||touchFirePointer!==null)return;
 if(e.pointerType!=='mouse'&&e.pointerId!==fieldAimPointer)return;
 const point=renderer.pick(e.clientX,e.clientY);if(point){touchAimDirection=null;input.aimX=point.x;input.aimZ=point.z;$('crosshair').style.left=e.clientX+'px';$('crosshair').style.top=e.clientY+'px';$('crosshair').style.display='block';}
}
function dragFireAim(e){
 if(e.pointerId!==touchFirePointer||!renderer||state.status!=='playing'||paused)return;
 const dx=e.clientX-fireOriginX,dy=e.clientY-fireOriginY,length=Math.hypot(dx,dy);if(length<=12)return;
 // Sample around the mech, avoiding perspective distortion at the FIRE button.
 const origin=renderer.project(state.player.x,state.player.z),from=renderer.pick(origin.x,origin.y),to=renderer.pick(origin.x+dx/length*80,origin.y+dy/length*80);
 if(!from||!to)return;const x=to.x-from.x,z=to.z-from.z,worldLength=Math.hypot(x,z);if(worldLength<.001)return;
 touchAimDirection={x:x/worldLength,z:z/worldLength};updateTouchAim();
}
function updateTouchAim(){
 if(!touchAimDirection||state.status!=='playing'||paused)return;
 input.aimX=state.player.x+touchAimDirection.x*30;input.aimZ=state.player.z+touchAimDirection.z*30;
 const point=renderer.project(input.aimX,input.aimZ);$('crosshair').style.left=point.x+'px';$('crosshair').style.top=point.y+'px';$('crosshair').style.display='block';
}
canvas.addEventListener('pointerdown',e=>{if(state.status!=='playing'||paused||touchFirePointer!==null)return;if(e.pointerType!=='mouse'){if(fieldAimPointer!==null)return;fieldAimPointer=e.pointerId;}canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);aim(e);if(e.pointerType==='mouse'){const action=e.button===2?'punch':'fire';pointers.set(e.pointerId,action);queued.add(action);}});
canvas.addEventListener('pointermove',aim);
function release(e){
 const action=pointers.get(e.pointerId);pointers.delete(e.pointerId);
 const cancelled=e.type==='pointercancel'||e.type==='lostpointercapture';
 if(e.pointerId===touchFirePointer){touchFirePointer=null;if(cancelled){touchAimDirection=null;$('crosshair').style.display='none';}}
 if(e.pointerId===fieldAimPointer){fieldAimPointer=null;if(cancelled){touchAimDirection=null;$('crosshair').style.display='none';}}
 if(cancelled&&action&&!Array.from(pointers.values()).includes(action))queued.delete(action);
}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release);
document.querySelectorAll('[data-action]').forEach(button=>{
 button.addEventListener('contextmenu',e=>e.preventDefault());
 button.addEventListener('pointerdown',e=>{e.preventDefault();if(state.status!=='playing'||paused)return;const action=button.dataset.action;
  if(action==='fire'&&(e.pointerType==='touch'||e.pointerType==='pen')){if(touchFirePointer!==null)return;touchFirePointer=e.pointerId;fieldAimPointer=null;fireOriginX=e.clientX;fireOriginY=e.clientY;}
  button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,action);queued.add(action);button.classList.add('active');
 });
 button.addEventListener('pointermove',dragFireAim);
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{release(e);button.classList.toggle('active',Array.from(pointers.values()).includes(button.dataset.action));});
});
function moveStick(e){const r=$('stick').getBoundingClientRect(),dx=e.clientX-r.x-r.width/2,dz=e.clientY-r.y-r.height/2,length=Math.hypot(dx,dz),scale=Math.min(1,34/Math.max(1,length));stickX=dx*scale/34;stickZ=dz*scale/34;$('stickKnob').style.transform=`translate(${dx*scale}px,${dz*scale}px)`;}
$('stick').addEventListener('pointerdown',e=>{e.preventDefault();if(state.status!=='playing'||paused||stickPointer!==null)return;stickPointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);moveStick(e);});
$('stick').addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(event,e=>{if(e.pointerId===stickPointer){stickPointer=null;stickX=stickZ=0;$('stickKnob').style.transform='';}});
function drawMap(canvas){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,b=state.bounds,scale=(w-24)/(b.maxX-b.minX);const xy=p=>[12+(p.x-b.minX)*scale,12+(p.z-b.minZ)*scale];ctx.fillStyle='#09151f';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#26404a';ctx.lineWidth=1;for(let n=12;n<w;n+=32*scale){ctx.beginPath();ctx.moveTo(n,12);ctx.lineTo(n,h-12);ctx.moveTo(12,n);ctx.lineTo(w-12,n);ctx.stroke();}
 for(const z of state.hazards){ctx.fillStyle=z.type==='water'?'#154954':'#6a351f';ctx.beginPath();ctx.arc(...xy(z),z.radius*scale,0,Math.PI*2);ctx.fill();}
 for(const z of state.buildings){const [x,y]=xy(z);ctx.fillStyle=z.status==='standing'?'#688082':'#45494a';ctx.fillRect(x-z.w*scale/2,y-z.d*scale/2,z.w*scale,z.d*scale);}
 for(const z of state.pickups){if(z.taken||z.locked)continue;const [x,y]=xy(z);ctx.fillStyle=z.type==='repair'?'#65e3d9':z.type==='intel'?'#fff':'#e5cf76';ctx.fillRect(x-3,y-3,6,6);if(z.type==='relay'&&w>300){ctx.font='bold 12px Arial';ctx.fillText('RELAY',x+7,y+4);}}
 for(const e of state.enemies){if(!e.alive||Math.hypot(e.x-state.player.x,e.z-state.player.z)>48)continue;ctx.fillStyle='#ff6a52';ctx.beginPath();ctx.arc(...xy(e),e.type==='boss'?7:3,0,Math.PI*2);ctx.fill();}
 state.objectives.forEach((o,i)=>{const [x,y]=xy(o);ctx.strokeStyle=o.done?'#6c9284':i===state.stage?'#ffcb77':'#627080';ctx.lineWidth=i===state.stage?3:1;ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();ctx.font=`bold ${w>300?16:10}px Arial`;ctx.fillStyle=ctx.strokeStyle;ctx.fillText(o.done?'✓':String(i+1),x+9,y+4);});
 const [x,y]=xy(state.player);ctx.save();ctx.translate(x,y);ctx.rotate(-state.player.angle);ctx.fillStyle='#66fff0';ctx.beginPath();ctx.moveTo(0,6);ctx.lineTo(-5,-5);ctx.lineTo(5,-5);ctx.closePath();ctx.fill();ctx.restore();
}
function sync(){
 const c=IW.CAMPAIGN[state.chapter],o=state.objectives[state.stage];
 $('armor').textContent=Math.ceil(state.player.hp);$('armorMeter').max=state.player.maxHp;$('armorMeter').value=state.player.hp;$('heat').textContent=state.player.overheated?'HOT':Math.ceil(state.player.heat)+'%';$('heatMeter').value=state.player.heat;
 $('objective').textContent=state.stage+' / '+state.objectives.length;
 $('timer').textContent=String(Math.floor(state.time/60)).padStart(2,'0')+':'+String(Math.floor(state.time%60)).padStart(2,'0');$('score').textContent=String(state.score).padStart(6,'0');$('weapon').textContent={heavy:'STOLEN HEAVY GUN',rail:'STOLEN RAILGUN',cannon:'STANDARD CANNON'}[state.player.weapon];$('message').textContent=state.message;
 $('chapterName').textContent=c.place+' / '+c.title;$('objectiveTitle').textContent=o?.title||'Chapter complete';$('objectiveDetail').textContent=state.objectiveDetail||'Follow the gold beacon';$('context').textContent=state.context||'';$('dashLabel').textContent=state.player.dashCooldown>0?'BOOST '+Math.ceil(state.player.dashCooldown):'BOOST';
 $('radio').textContent=state.radioTime>0&&state.status==='playing'?state.radio:'';$('radio').hidden=!$('radio').textContent||paused;
 drawMap($('minimap'));
 if(state.status==='ready'&&lastBrief!==state.chapter){lastBrief=state.chapter;$('briefPlace').textContent=c.place;$('briefTitle').textContent=c.title;$('briefStory').textContent=c.briefing;$('chapterTrack').replaceChildren(...IW.CAMPAIGN.map((ch,i)=>{const el=document.createElement('span');el.textContent=String(i+1).padStart(2,'0')+' '+ch.title;el.className=i===state.chapter?'current':i<state.chapter?'complete':'';return el;}));$('newCampaign').hidden=state.chapter===0;$('saveNote').textContent=saveAvailable?'Progress saves between chapters. Explore at your own pace; there is no mission timer.':'Browser storage unavailable. Keep this tab open to preserve campaign progress.';}
 if(lastStatus===state.status)return;if(state.status==='won')save();lastStatus=state.status;
 if(['won','lost'].includes(state.status)){$('debriefArchiveCount').textContent=drawJournal('debriefArchiveEntries')+' / 5';$('debriefJournal').open=false;}
 $('overlay').hidden=state.status==='playing';$('briefing').hidden=state.status!=='ready';$('results').hidden=!['won','lost'].includes(state.status);$('crosshair').style.display='none';$('restartCampaign').hidden=!(state.status==='won'&&state.chapter===4);
  if(['won','lost'].includes(state.status)){const finale=state.status==='won'&&state.chapter===4,totalTime=state.time+(finale?(state.totals.time||0):0),totalKills=state.kills+(finale?state.totals.kills:0),totalCrushed=state.collapseKills+(finale?(state.totals.collapseKills||0):0),archives=state.totals.intel?.length||0;clearInput();$('resultTitle').textContent=state.status==='won'?(state.chapter===4?'THE TIDE IS OURS.':'CHAPTER SECURED.'):'MECH DOWN.';$('finalScore').textContent=String(state.score).padStart(6,'0');$('resultStats').textContent=`${totalKills} kills · ${totalCrushed} crushed · ${Math.ceil(state.player.hp)} armor · ${archives}/5 archives · ${Math.floor(totalTime/60)}m ${Math.floor(totalTime%60)}s`;$('debriefStory').textContent=state.status==='won'?c.outro+' '+(archives===5?'All five archives are in Orla’s hands.':'The side channels still hold '+(5-archives)+' archive signal'+(5-archives===1?'':'s')+'.'):'Your chapter checkpoint is safe. Try a different approach, look for repair caches, and boost out of marked artillery strikes.';$('upgradePanel').hidden=state.status!=='won'||state.chapter===4;$('scoreForm').hidden=state.status==='won'&&state.chapter<4;audio(state.status==='won'?260:65,.5,.08,'sawtooth');$('overlay').scrollTop=0;}
}
$('scoreForm').addEventListener('submit',async e=>{e.preventDefault();if(!['won','lost'].includes(state.status))return;const button=e.target.querySelector('button');button.disabled=true;const score=Math.max(0,Math.floor(state.score));try{const rank=await fetch('/api/leaderboard/rank?gameId=ironwake&score='+score);if(!rank.ok)throw Error('rank');await rank.json();const posted=await fetch('/api/leaderboard/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:'ironwake',score,name:$('callsign').value.trim().slice(0,20)||'IRONHAND'})});if(!posted.ok)throw Error('submit');const data=await posted.json();$('scoreStatus').textContent=data.rank?'POSTED · RANK #'+data.rank:'SCORE POSTED';}catch{$('scoreStatus').textContent='Leaderboard unavailable. Your score is still here.';}finally{button.disabled=false;}});
try{
 renderer=createRenderer(canvas);
 window.addEventListener('resize',()=>{clearInput();renderer.resize();});
 IW.runtime={state,input,renderer,start,get paused(){return paused;},stop(){running=false;},resume(){if(!running){running=true;previous=0;requestAnimationFrame(frame);}}};
 function frame(now){if(!running)return;const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;
  input.moveX=stickX+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);input.moveZ=stickZ+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  for(const action of actions)input[action]=[...pointers.values()].includes(action)||queued.has(action);input.punch ||=keys.has('e');input.rip ||=keys.has('q');input.vent ||=keys.has(' ');input.dash ||=keys.has('shift');input.interact ||=keys.has('f');
  updateTouchAim();if(!document.hidden&&!paused){IW.step(state,input,dt);if(dt>0)queued.clear();}renderer.render(state,paused?0:dt);updateTouchAim();sync();
  const effects=state.effects||[];for(const effect of effects){if(effect.id>lastEffect){if(/collapse|crush|explos|kill/.test(effect.type))audio(60,.3,.06,'sawtooth');else if(/punch|shot|muzzle/.test(effect.type))audio(120,.08,.025);lastEffect=Math.max(lastEffect,effect.id);}}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(error){$('error').hidden=false;$('error').textContent='The 3D renderer could not start. Enable WebGL or try another browser. '+error.message;console.error(error);}
