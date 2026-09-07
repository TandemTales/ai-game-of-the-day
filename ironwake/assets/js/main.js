import { createRenderer } from './render.js';
const $ = id => document.getElementById(id);
const state = IW.createState(7);
const input = {moveX:0,moveZ:0,aimX:-10,aimZ:-8,fire:false,punch:false,vent:false,rip:false};
const keys = new Set(), pointers = new Map(), queued = new Set();
let renderer, previous=0, running=true, lastStatus='', stickPointer=null, stickX=0,stickZ=0;
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
function clearInput(){keys.clear();pointers.clear();queued.clear();stickPointer=null;stickX=stickZ=0;for(const k of ['fire','punch','vent','rip']) input[k]=false;input.moveX=input.moveZ=0;$('stickKnob').style.transform='';document.querySelectorAll('.active').forEach(e=>e.classList.remove('active'));}
function start(){clearInput();IW.start(state);input.aimX=state.player.x;input.aimZ=state.player.z-20;$('scoreStatus').textContent='';lastEffect=0;enableAudio();audio(110,.3,.07,'sawtooth');sync();$('scene').focus({preventScroll:true});}
$('start').onclick=start;$('retry').onclick=start;
$('mute').onclick=()=>{muted=!muted;$('mute').textContent=muted?'SOUND OFF':'SOUND ON';$('mute').setAttribute('aria-pressed',String(muted));};
window.addEventListener('keydown',e=>{if(e.target.closest('input,button'))return;if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','e','q'].includes(e.key.toLowerCase())||e.key.startsWith('Arrow'))e.preventDefault();if((e.key==='Enter')&&state.status!=='playing'){start();return;}keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e')queued.add('punch');if(e.key.toLowerCase()==='q')queued.add('rip');});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{clearInput();previous=0;});
const canvas=$('scene');canvas.addEventListener('contextmenu',e=>e.preventDefault());
function aim(e){if(!renderer)return;const point=renderer.pick(e.clientX,e.clientY);if(point){input.aimX=point.x;input.aimZ=point.z;$('crosshair').style.left=e.clientX+'px';$('crosshair').style.top=e.clientY+'px';$('crosshair').style.display=state.status==='playing'?'block':'none';}}
canvas.addEventListener('pointerdown',e=>{if(state.status!=='playing')return;canvas.setPointerCapture(e.pointerId);aim(e);if(e.pointerType==='mouse'){const action=e.button===2?'punch':'fire';pointers.set(e.pointerId,action);queued.add(action);}});
canvas.addEventListener('pointermove',aim);
function release(e){pointers.delete(e.pointerId);}
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,release);
document.querySelectorAll('[data-action]').forEach(button=>{
 button.addEventListener('contextmenu',e=>e.preventDefault());
 button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,button.dataset.action);queued.add(button.dataset.action);button.classList.add('active');});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{release(e);button.classList.remove('active');});
});
function moveStick(e){const r=$('stick').getBoundingClientRect(),dx=e.clientX-r.x-r.width/2,dz=e.clientY-r.y-r.height/2,length=Math.hypot(dx,dz),scale=Math.min(1,34/Math.max(1,length));stickX=dx*scale/34;stickZ=dz*scale/34;$('stickKnob').style.transform=`translate(${dx*scale}px,${dz*scale}px)`;}
$('stick').addEventListener('pointerdown',e=>{e.preventDefault();if(stickPointer!==null)return;stickPointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);moveStick(e);});
$('stick').addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(event,e=>{if(e.pointerId===stickPointer){stickPointer=null;stickX=stickZ=0;$('stickKnob').style.transform='';}});
function sync(){
 $('armor').textContent=Math.ceil(state.player.hp);$('armorMeter').value=state.player.hp;$('heat').textContent=state.player.overheated?'HOT':Math.ceil(state.player.heat)+'%';$('heatMeter').value=state.player.heat;
 const tanks=state.enemies.filter(e=>e.type==='tank');$('objective').textContent=tanks.filter(e=>!e.alive&&!e.escaped).length+' / '+tanks.length;
 $('timer').textContent=Math.ceil(Math.max(0,state.timeLeft))+' SEC';$('score').textContent=String(state.score).padStart(6,'0');$('weapon').textContent=state.player.weapon==='heavy'?'STOLEN HEAVY GUN':'STANDARD CANNON';$('message').textContent=state.message||'Break the convoy. Use the towers.';
 if(lastStatus===state.status)return;lastStatus=state.status;
 $('overlay').hidden=state.status==='playing';$('briefing').hidden=state.status!=='ready';$('results').hidden=!['won','lost'].includes(state.status);$('crosshair').style.display='none';
 if(['won','lost'].includes(state.status)){clearInput();$('resultTitle').textContent=state.status==='won'?'CONVOY STOPPED.':state.player.hp<=0?'MECH DOWN.':state.escaped?'CONVOY ESCAPED.':'WINDOW CLOSED.';$('finalScore').textContent=String(state.score).padStart(6,'0');$('resultStats').textContent=`${state.kills} kills · ${state.collapseKills} crushed · ${Math.ceil(state.player.hp)} armor · ${Math.ceil(state.time)} seconds`;audio(state.status==='won'?260:65,.5,.08,'sawtooth');}
}
$('scoreForm').addEventListener('submit',async e=>{e.preventDefault();if(!['won','lost'].includes(state.status))return;const button=e.target.querySelector('button');button.disabled=true;const score=Math.max(0,Math.floor(state.score));try{const rank=await fetch('/api/leaderboard/rank?gameId=ironwake&score='+score);if(!rank.ok)throw Error('rank');await rank.json();const posted=await fetch('/api/leaderboard/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:'ironwake',score,name:$('callsign').value.trim().slice(0,20)||'IRONHAND'})});if(!posted.ok)throw Error('submit');const data=await posted.json();$('scoreStatus').textContent=data.rank?'POSTED · RANK #'+data.rank:'SCORE POSTED';}catch{$('scoreStatus').textContent='Leaderboard unavailable. Your score is still here.';}finally{button.disabled=false;}});
try{
 renderer=createRenderer(canvas);
 window.addEventListener('resize',()=>{clearInput();renderer.resize();});
 IW.runtime={state,input,renderer,start,stop(){running=false;},resume(){if(!running){running=true;previous=0;requestAnimationFrame(frame);}}};
 function frame(now){if(!running)return;const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;
  input.moveX=stickX+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);input.moveZ=stickZ+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
  for(const action of ['fire','punch','vent','rip'])input[action]=[...pointers.values()].includes(action)||queued.has(action);input.punch ||=keys.has('e');input.rip ||=keys.has('q');input.vent ||=keys.has(' ');
  if(!document.hidden){IW.step(state,input,dt);if(dt>0)queued.clear();}renderer.render(state,dt);sync();
  const effects=state.effects||[];for(const effect of effects){if(effect.id>lastEffect){if(/collapse|crush|explos|kill/.test(effect.type))audio(60,.3,.06,'sawtooth');else if(/punch|shot|muzzle/.test(effect.type))audio(120,.08,.025);lastEffect=Math.max(lastEffect,effect.id);}}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}catch(error){$('error').hidden=false;$('error').textContent='The 3D renderer could not start. Enable WebGL or try another browser. '+error.message;console.error(error);}
