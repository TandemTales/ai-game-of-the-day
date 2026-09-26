'use strict';
// State-informed legal-input reachability check, not normal-clock or human-fun evidence.
// The only gameplay mutations are PW.step and the public continue/start/retry actions.
const aq = require('./aqueduct-pilot.cjs');
function createPilot(options={}) {
  let room = '', stage = 0, frame = 0, cached = null, cachedGoal = '';
  return s => {
    if (room !== s.roomId) { room = s.roomId; stage = 0; cached = null; }
    frame++;
    const p = s.player, i = { mx: 0, my: 0, ax: p.aimX, ay: p.aimY, reflect: false };
    const aim = (x,y) => { const d=Math.hypot(x-p.x,y-p.y)||1; i.ax=(x-p.x)/d;i.ay=(y-p.y)/d; };
    const go = (x,y,path=false) => {
      const d=Math.hypot(x-p.x,y-p.y); if(d<7)return true;
      if(path){const key=x.toFixed(0)+','+y.toFixed(0);if(!cached||key!==cachedGoal||frame%6===0){cached=aq.steer(s,x,y,{avoid:[]});cachedGoal=key;}i.mx=cached.mx;i.my=cached.my;}
      else{i.mx=(x-p.x)/d;i.my=(y-p.y)/d;}return false;
    };
    const slash=(x,y)=>{aim(x,y);i.slash=frame%2===0;};
    const turn=(m,index,x,y)=>{if(m.index===index)return true;if(go(x,y,true))slash(m.x,m.y);return false;};
    const route=pts=>{if(stage<pts.length&&go(...pts[stage]))stage++;};
    const duel=e=>{
      const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy)||1;aim(e.x,e.y);
      if(e.exposed>0){if(d>65)go(e.x,e.y,true);else slash(e.x,e.y);return;}
      if(e.phase==='lunge-windup'||e.phase==='lunge'){
        let sx=-e.aimY,sy=e.aimX;if(p.y+sy*90>665||p.y+sy*90<105){sx=-sx;sy=-sy;}
        i.mx=sx;i.my=sy;if(e.phase==='lunge'&&d<160&&p.dashCooldown<=0)i.dash=true;return;
      }
      if(d>220)go(e.x,e.y,true);else if(d<125){i.mx=-dx/d;i.my=-dy/d;}
      aq.guard(s,i);
    };
    if(room==='descent'){
      const m=s.mirrors[0];
      if(stage===0){if(turn(m,1,214,384))stage++;}
      else if(stage===1){if(p.lightCharge<1)go(188,384);else if(go(304,384,true)){i.burst=true;stage++;}}
      else if(stage===2){if(go(720,384))stage++;}
      else go(988,384,true);
      if(stage!==2&&!i.slash)aq.guard(s,i);
    }else if(room==='galleries'){
      if(stage===0){if(turn(s.mirrors[0],1,304,274))stage++;}
      else if(stage===1){if(turn(s.mirrors[1],1,720,490))stage++;}
      else if(options.archive&&!s.flags['pickup:keeper-archive'])go(512,708,true);
      else go(988,384,true);
      if(!i.slash)aq.guard(s,i);
    }else if(room==='archive'){
      if(stage===0){if(go(512,192)&&p.lightCharge>=1)stage++;}
      else if(stage===1){if(go(512,280)){i.burst=true;stage++;}}
      else if(stage===2){if(go(512,528))stage++;}
      else if(stage===3){if(go(512,600))stage++;}
      else if(stage===4){if(go(512,528)&&p.lightCharge>=1)stage++;}
      else if(stage===5){if(go(512,480)){i.burst=true;stage++;}}
      else go(512,64);
    }else if(room==='circuit'){
      const pts=[[184,400],[332,400],[332,314],[528,314],[528,496],[716,496],[716,384],[855,384]];
      const e=s.enemies.find(e=>e.type==='sentinel');
      if(stage<pts.length){route(pts);if(p.wading&&p.dashCooldown<=0)i.dash=true;}
      else if(e.hp>0)duel(e);else go(988,384,true);
    }else if(room==='lighthouse'){
      if(stage===0){if(go(468,384))stage++;}
      else if(stage===1){if(turn(s.mirrors[0],1,468,384))stage++;}
      else if(stage===2){if(go(468,438))stage++;}
      else if(stage===3){if(go(554,438))stage++;}
      else if(stage===4){if(go(554,384))stage++;}
      else go(988,384);
      if(stage>4)aq.guard(s,i);
    }else if(room==='crown'){
      const e=s.enemies.find(e=>e.type==='crown');
      if(stage===0){if(turn(s.mirrors[0],1,280,160))stage++;}
      else if(stage===1){if(turn(s.mirrors[1],1,704,656))stage++;}
      else if(stage===2){if(!s.flags['pickup:keeper-heart'])go(176,560,true);else stage++;}
      else if(e.hp>0){
        if(e.exposed>0){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d>67)go(e.x,e.y,true);else slash(e.x,e.y);}
        else if(e.stage===1){go(650,384,true);aim(e.x,e.y);i.reflect=true;}
        else if(e.stage===2){go(640,384,true);aq.guard(s,i);}
        else if(p.lightCharge<1){go(792,504,true);aq.guard(s,i);}
        else{if(go(700,384,true)&&e.phase==='eclipse-windup')i.burst=true;aq.guard(s,i);}
      }else if(!s.rescue.freed)go(s.rescue.x,s.rescue.y,true);
      else if(!s.escort.arrived)go(Math.min(800,s.escort.x+65),s.escort.y,true);
      else go(s.beacon.x,s.beacon.y,true);
      if(stage<3&&!i.slash)aq.guard(s,i);
    }
    return i;
  };
}
function play(PW,options={}){
  let s,upstreamRetries=0;
  const retryEngine=PW;
  PW=Object.assign({},PW,{retryRoom(state){upstreamRetries++;return retryEngine.retryRoom(state);}});
  // Exercise real between-region choices through their public API. The facade
  // lets existing upstream pilots select at their normal Continue checkpoints.
  if(options.loadout){
    const engine=PW,heavy=options.loadout==='anchor';
    const alternate=options.loadout==='alternate';
    const picks={'tidal-abbey':alternate?'mobile-reflection':'wide-guard','verdant-aqueduct':heavy?'heavy-strike':'returning-blade','glass-kiln':alternate?'second-prism':'prism-recall','night-observatory':heavy?'lasting-bridge':'burst-stun'};
    PW=Object.assign({},engine,{
      continueRegion(state){const pick=picks[state.regionId];if(pick&&!engine.chooseEquipment(state,pick))throw new Error('Equipment choice rejected: '+pick);return engine.continueRegion(state);},
      // Older pilots use slash to rotate mirrors and make close melee strikes.
      // Explicitly release MIRROR on those frames, as the real controls require.
      // This route proves the selected loadout is completable, not thrown-blade mastery.
      step(state,input,dt){return engine.step(state,input.slash?Object.assign({},input,{reflect:false}):input,dt);}
    });
  }
  if(options.whole){s=require('./observatory-pilot.cjs').play(PW,{whole:true});if(s.status!=='cleared')return s;PW.continueRegion(s);}
  else{s=PW.create({room:options.room||'descent'});s.status='playing';}
  const pilot=createPilot(options),log=[];let previous='',frames=0;
  if(options.whole)log.push('upstream public room retries='+upstreamRetries);
  for(;frames<60*(options.seconds||240)&&s.status==='playing';frames++){
    if(s.roomId!==previous){previous=s.roomId;log.push('enter '+previous+' t='+s.time.toFixed(2)+' hp='+s.player.hp);}
    PW.step(s,options.naive?{mx:1,my:0,ax:1,ay:0,slash:frames%2===0}:pilot(s),1/60);
    if(options.trace&&frames%600===0)log.push('trace '+s.roomId+' '+s.player.x.toFixed(0)+','+s.player.y.toFixed(0)+' hp='+s.player.hp+' charge='+s.player.lightCharge.toFixed(2)+' esc='+JSON.stringify(s.escort&&[s.escort.x,s.escort.hp,s.escort.waiting])+' enemies='+s.enemies.map(e=>e.id+':'+e.hp+':'+e.phase+':'+e.stage).join(',')+' receivers='+s.receivers.map(r=>r.id+':'+r.active).join(','));
  }
  log.push('END '+s.status+' t='+s.time.toFixed(2)+' hp='+s.player.hp+' score='+s.score+' hits='+s.hits+' equipment='+JSON.stringify(s.equipment)+' flags='+JSON.stringify(s.flags)+' cleared='+JSON.stringify(s.cleared));s.crownLog=log;return s;
}
module.exports={createPilot,play};
if(require.main===module){const room=process.argv.find(x=>x.startsWith('--room=')),loadout=process.argv.find(x=>x.startsWith('--loadout='));const s=play(aq.loadPW(),{whole:process.argv.includes('--whole'),room:room&&room.slice(7),loadout:loadout&&loadout.slice(10),archive:process.argv.includes('--archive'),trace:process.argv.includes('--trace'),naive:process.argv.includes('--naive')});console.log((s.crownLog||s.observatoryLog||s.kilnLog||[]).join('\n'));if(s.status!=='won')process.exitCode=1;}

