'use strict';
// State-informed legal inputs. These routes prove reachability, never human fun.
const aq = require('./aqueduct-pilot.cjs');
function createPilot(options = {}) {
  let room = '', stage = 0, frame = 0, cached = null, cachedGoal = '';
  return s => {
    if (room !== s.roomId) { room = s.roomId; stage = 0; cached = null; }
    frame++;
    const p = s.player, i = { mx: 0, my: 0, ax: p.aimX, ay: p.aimY, reflect: false };
    const aim = (x, y) => { const d = Math.hypot(x - p.x, y - p.y) || 1; i.ax = (x - p.x) / d; i.ay = (y - p.y) / d; };
    const go = (x, y, path = false) => {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < 10) return true;
      if (path) {
        const key = x.toFixed(0) + ',' + y.toFixed(0);
        if (!cached || frame % 6 === 0 || key !== cachedGoal) { cached = aq.steer(s, x, y, { avoid: [] }); cachedGoal = key; }
        i.mx = cached.mx; i.my = cached.my;
      } else { i.mx = (x - p.x) / d; i.my = (y - p.y) / d; }
      return false;
    };
    const slash = (x, y) => { aim(x, y); i.slash = frame % 2 === 0; };
    const route = points => { if (stage < points.length && go(...points[stage])) stage++; };
    if (room === 'stars') {
      const pts = [[230,384],[284,384],[396,384],[396,252],[512,252],[548,252],[656,252],[656,516],[840,516],[900,516],[920,384],[988,384]];
      if ([1,5].includes(stage) && s.burstTime < .1) {
        if (p.lightCharge < 1) go(stage === 1 ? 230 : 512, stage === 1 ? 384 : 252);
        else i.burst = true;
      } else if (stage === 9 && !s.flags['stars-crossed']) slash(874,516);
      else route(pts);
    } else if (room === 'obs-shutters') {
      const m = s.mirrors;
      if (stage === 0) { if (go(230,220,true)) { if (m[0].index !== 0) slash(m[0].x,m[0].y); else stage++; } }
      else if (stage === 1) { if (go(460,220,true) && s.shutters[0].open && s.shutters[0].closesIn > .9) stage++; }
      else if (stage === 2) { if (go(564,220)) stage++; }
      else if (stage === 3) { if (go(734,220)) stage++; }
      else if (stage === 4) { if (go(734,510)) { if (m[1].index !== 0) slash(m[1].x,m[1].y); else stage++; } }
      else if (s.gates.find(g=>g.id==='obs-lock').open) go(988,384,true);
      else { aim(184,632); i.reflect = true; }
      if (!i.slash && ![1,2].includes(stage)) aq.guard(s,i);
    } else if (room === 'shade') {
      const e = s.enemies.find(e=>e.type==='shade'&&e.hp>0);
      if (!e) go(988,384,true);
      else {
        const d = Math.hypot(e.x-p.x,e.y-p.y); aim(e.x,e.y);
        if (e.exposed > 0) { if (d > 65) go(e.x,e.y,true); else slash(e.x,e.y); }
        else if (p.lightCharge >= 1 && d < 140) i.burst = true;
        else if (e.phase === 'dash' || e.phase === 'windup') {
          i.mx=-e.aimY;i.my=e.aimX;
          if(e.phase==='dash'&&p.dashCooldown<=0)i.dash=true;
        } else go(e.x>512?466:570,300,true);
      }
    } else if (room === 'telescope') {
      const esc=s.escort,m=s.mirrors[0];
      if (esc.arrived) go(988,384,true);
      else if (esc.x < 445) go(Math.min(500,esc.x+85),384);
      else if(m.index===0){if(go(512,390))slash(m.x,m.y);}
      else go(Math.min(910,esc.x+55),384);
      // Intercept escort-targeted shots near its current crossing line.
      const shot=s.shots.filter(sh=>!sh.friendly).sort((a,b)=>Math.hypot(a.x-esc.x,a.y-esc.y)-Math.hypot(b.x-esc.x,b.y-esc.y))[0];
      if(shot&&!i.slash&&Math.hypot(shot.x-esc.x,shot.y-esc.y)<190){
        const dx=shot.x-esc.x,dy=shot.y-esc.y,d=Math.hypot(dx,dy)||1;
        const tx=esc.x+dx/d*28,ty=esc.y+dy/d*28;
        if(!s.voids.some(v=>tx>=v.x&&tx<=v.x+v.w&&ty>=v.y&&ty<=v.y+v.h)||Math.abs(ty-384)<27)go(tx,ty);
        aim(shot.x,shot.y);i.reflect=true;
      }
    } else if(room==='twins'){
      const enemies=s.enemies.filter(e=>e.type==='twin'&&e.hp>0);
      if(!enemies.length)go(s.beacon.x,s.beacon.y,true);
      else{
        const e=enemies.sort((a,b)=>a.hp-b.hp||Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
        const d=Math.hypot(e.x-p.x,e.y-p.y);aim(e.x,e.y);
        if(e.exposed>0){if(d>68)go(e.x,e.y,true);else slash(e.x,e.y);}
        else if(p.lightCharge>=1){if(d<142)i.burst=true;else go(e.x,e.y,true);}
        else {go(880,228,true);aq.guard(s,i);}
      }
    }
    return i;
  };
}
function play(PW, options={}){
  let s;
  if(options.whole){s=require('./kiln-pilot.cjs').play(PW);if(s.status!=='cleared')return s;PW.continueRegion(s);}
  else{s=PW.create({room:options.room||'stars'});s.status='playing';}
  const pilot=createPilot(options),log=[];let previous='',frames=0;
  for(;frames<60*240&&s.status==='playing';frames++){
    if(s.roomId!==previous){previous=s.roomId;log.push('enter '+previous+' t='+s.time.toFixed(2)+' hp='+s.player.hp);}
    PW.step(s,pilot(s),1/60);
    if(options.trace&&frames%600===0)log.push('trace '+s.roomId+' '+s.player.x.toFixed(0)+','+s.player.y.toFixed(0)+' hp='+s.player.hp+' esc='+JSON.stringify(s.escort&&[s.escort.x,s.escort.hp,s.escort.waiting])+' enemies='+s.enemies.map(e=>e.id+':'+e.hp+':'+e.phase).join(',')+' objective='+s.objective);
  }
  log.push('END '+s.status+' t='+s.time.toFixed(2)+' hp='+s.player.hp+' score='+s.score+' cleared='+JSON.stringify(s.cleared));s.observatoryLog=log;
  return s;
}
module.exports={createPilot,play};
if(require.main===module){const room=process.argv.find(x=>x.startsWith('--room='));const s=play(aq.loadPW(),{whole:process.argv.includes('--whole'),room:room&&room.slice(7),trace:process.argv.includes('--trace')});console.log((s.observatoryLog||s.kilnLog||[]).join('\n'));if(s.status!=='won')process.exitCode=1;}
