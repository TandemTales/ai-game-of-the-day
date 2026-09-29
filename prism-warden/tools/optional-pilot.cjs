'use strict';
// Hidden-state, legal-input discovery route. This proves acquisition/reachability,
// never human discovery, normal-clock usability, enjoyment, or shipping quality.
const aq = require('./aqueduct-pilot.cjs');
const EQUIPMENT = Object.freeze({'tidal-abbey':'mobile-reflection','verdant-aqueduct':'returning-blade','glass-kiln':'second-prism','night-observatory':'lasting-bridge'});
function discoveryChecklist(PW, s) {
  return (PW.DISCOVERY_CONTRACT || []).map(d => ({...d, acquired:!!s.flags[d.flag]}));
}
function createPilot(PW, options = {}) {
  const factories = {
    'tidal-abbey': () => require('./abbey-pilot.cjs').createPilot(PW, {sanctuary:true}),
    'verdant-aqueduct': () => aq.createPilot(PW, {ferry:true,seal:true}),
    'glass-kiln': () => require('./kiln-pilot.cjs').createPilot(PW),
    'night-observatory': () => require('./observatory-pilot.cjs').createPilot(),
    'drowned-crown': () => require('./crown-pilot.cjs').createPilot({archive:true})
  };
  const pilots = Object.fromEntries(Object.entries(factories).map(([k,f]) => [k,f()]));
  let room='', stage=0, lastTime=-1, tick=0;
  return s => {
    if(room!==s.roomId || s.roomTime < lastTime){
      if(room===s.roomId && s.roomTime<lastTime)pilots[s.regionId]=factories[s.regionId]();
      room=s.roomId;stage=0;
    }
    lastTime=s.roomTime;tick++;
    const p=s.player, i={mx:0,my:0,ax:p.aimX,ay:p.aimY,reflect:false};
    const go=(x,y,direct=false)=>{
      const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);
      if(d<5)return true;
      if(direct){i.mx=dx/d;i.my=dy/d;}else Object.assign(i,aq.steer(s,x,y,{avoid:[],water:'ok'}));
      return false;
    };
    const aim=(x,y)=>{const d=Math.hypot(x-p.x,y-p.y)||1;i.ax=(x-p.x)/d;i.ay=(y-p.y)/d;};
    const slash=(x,y)=>{aim(x,y);i.slash=tick%2===0;};
    const exit=to=>{const e=s.exits.find(e=>e.to===to);if(!e)throw new Error('Missing connected exit '+room+' -> '+to);go(e.x+e.w/2,e.y+e.h/2);};
    const turn=(m,index)=>{if(m.index===index)return true;if(go(m.x-34,m.y+24))slash(m.x,m.y);return false;};
    let handled=true;
    if(room==='sanctuary'){
      const m=s.mirrors[0],chart=s.pickups.find(k=>k.kind==='chart'),heart=s.pickups.find(k=>k.id==='abbey-heart');
      if(!turn(m,1)){}
      else if(!s.flags['lit:chapel'])go(512,600);
      else if(!chart.taken)go(chart.x,chart.y);
      else if(!heart.taken)go(heart.x,heart.y);
      else if(p.hp<p.maxHp)go(512,600);
      else exit('sluice');
    }else if(room==='sluice' && s.receivers[0].active && s.flags['pickup:abbey-heart'] && s.flags.chart)exit('shutters');
    else if(room==='bridge' && (!s.flags['quench-valve'] || !s.flags['kiln-edge']))exit('quench');
    else if(room==='obs-shutters' && s.gates.find(g=>g.id==='obs-lock').open)exit(s.flags['sky-chart']?'shade':'obs-chart');
    else if(room==='shade' && !s.enemies.some(e=>e.type==='shade'&&e.hp>0))exit(s.flags['shade-freed']?'telescope':'shade-vault');
    else if(room==='shade-vault'){
      const m=s.mirrors.find(m=>m.id!=='vault-splitter'&&m.index!==0);
      if(m)turn(m,0);
      else if(!s.rescue.freed)go(s.rescue.x,s.rescue.y);
      else exit('shade');
    }else if(room==='obs-chart'){
      // Authored hooked crossings, in both directions. Every recharge and burst
      // is earned by walking to the real wells; never set charge or discovery flags.
      const route=[
        [512,208,'charge'],[512,248,'burst'],[512,328],[368,328],[368,420],
        [720,434,'charge'],[720,460,'burst'],[720,548],[832,548],[832,632,'charge'],
        [832,588,'burst'],[832,548],[720,548],[720,434,'charge'],
        [368,418],[368,400,'burst'],[368,328],[512,328],[512,240],[512,64]
      ];
      const point=route[Math.min(stage,route.length-1)];
      if(go(point[0],point[1],true)){
        if(point[2]==='charge'){if(p.lightCharge>=1)stage++;}
        else if(point[2]==='burst'){i.burst=true;stage++;}
        else stage++;
      }
    }else handled=false;
    const input=handled?i:pilots[s.regionId](s);
    // MIRROR+SLASH is a throw with Returning Blade; these ordinary sword
    // actions must explicitly release MIRROR, matching the visible controls.
    if(input.slash)input.reflect=false;
    return input;
  };
}
function simulate(PW, options={}){
  const s=PW.create(options.room?{room:options.room}:undefined);
  PW.retryRoom(s); // Public room checkpoint start; no injected health/progression.
  let pilot=createPilot(PW,options), frames=0, roomFrames=0, lastRoom='', slashHeld=false;
  const report={evidence:options.room?'Declared fresh room-entry fixture; connected exits thereafter.':'New campaign via public inputs, choices, Continue and Retry.',startRoom:s.roomId,rooms:[],failures:[],choices:[],acquisitions:[]};
  const seen=new Set();
  const emit=event=>{if(options.onEvent)options.onEvent(event);};
  while(frames < 60*(options.seconds||1800)){
    if(s.roomId!==lastRoom){lastRoom=s.roomId;roomFrames=0;const entry={room:lastRoom,time:s.time,hp:s.player.hp};report.rooms.push(entry);emit({enter:entry});}
    for(const d of discoveryChecklist(PW,s))if(d.acquired&&!seen.has(d.flag)){seen.add(d.flag);const event={flag:d.flag,room:s.roomId,time:s.time};report.acquisitions.push(event);emit({acquired:event});}
    if(options.stopAfterRoom && s.roomId===options.stopAfterRoom){report.stopReason='requested-room';break;}
    if(s.status==='cleared'){
      if(options.room && !options.continueFixture)break;
      const pick=EQUIPMENT[s.regionId];
      if(pick&&!PW.chooseEquipment(s,pick))throw new Error('Rejected equipment '+pick);
      if(s.regionId==='night-observatory'&&!PW.chooseRestoration(s,options.restoration||'channels'))throw new Error('Rejected restoration');
      report.choices.push({region:s.regionId,equipment:pick,restoration:s.regionId==='night-observatory'?(options.restoration||'channels'):null});
      PW.continueRegion(s);slashHeld=false;continue;
    }
    if(s.status==='lost'){
      const failure={room:s.roomId,time:s.time,hp:s.player.hp,message:s.message,flags:{...s.flags}};report.failures.push(failure);emit({failure});
      if(report.failures.length>(options.retries===undefined?12:options.retries))break;
      PW.retryRoom(s);pilot=createPilot(PW,options);slashHeld=false;roomFrames=0;continue;
    }
    if(s.status!=='playing')break;
    if(roomFrames>60*(options.roomSeconds||240)){report.failures.push({room:s.roomId,time:s.time,type:'room-timeout',x:s.player.x,y:s.player.y,objective:s.objective});break;}
    const input=pilot(s);input.slash=!!input.slash&&!slashHeld;slashHeld=input.slash;
    PW.step(s,input,1/60);frames++;roomFrames++;
    if(options.trace && frames%600===0)emit({trace:{room:s.roomId,time:s.time,x:s.player.x,y:s.player.y,hp:s.player.hp,charge:s.player.lightCharge,objective:s.objective}});
  }
  report.stopReason=report.stopReason||(frames>=60*(options.seconds||1800)?'simulation-budget':s.status==='playing'?'room-timeout':s.status);
  report.elapsedSimulationSeconds=frames/60;
  report.outcome={status:s.status,room:s.roomId,hp:s.player.hp,time:s.time,score:s.score,cleared:{...s.cleared},flags:{...s.flags},equipment:{...s.equipment}};
  report.discoveries=discoveryChecklist(PW,s);report.acquired=report.discoveries.filter(d=>d.acquired).length;
  report.complete=s.status==='won'&&report.acquired===report.discoveries.length;
  return {state:s,report};
}
module.exports={createPilot,discoveryChecklist,simulate,EQUIPMENT};
if(require.main===module){
  const args=process.argv.slice(2),value=name=>args.find(a=>a.startsWith('--'+name+'='))?.split('=').slice(1).join('=');
  const {report}=simulate(aq.loadPW(),{room:value('room'),seconds:Number(value('seconds')||1800),roomSeconds:Number(value('room-seconds')||240),retries:Number(value('retries')??12),stopAfterRoom:value('stop-after-room'),continueFixture:args.includes('--continue-fixture'),trace:args.includes('--trace'),onEvent:e=>console.log(JSON.stringify(e))});
  console.log(JSON.stringify(report,null,2));
  if(value('room') ? !['cleared','won','requested-room'].includes(report.stopReason) : !report.complete)process.exitCode=1;
}

