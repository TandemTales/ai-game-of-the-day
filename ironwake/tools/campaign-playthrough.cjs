// Deterministic simulation playthrough: legal inputs only, no health/position cheats.
// This is route/mechanics evidence, not a substitute for human playtesting.
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console};vm.createContext(ctx);for(const f of ['logic','campaign'])vm.runInContext(fs.readFileSync(path.join(__dirname,`../assets/js/${f}.js`),'utf8'),ctx);const IW=ctx.IW;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function blocked(s,p){return s.buildings.some(b=>IW.inFootprint(p,b,1.4,0));}
function clear(s,a,b){const d=distance(a,b);for(let n=1;n<d;n+=1.2)if(blocked(s,{x:a.x+(b.x-a.x)*n/d,z:a.z+(b.z-a.z)*n/d}))return false;return true;}
function pathTo(s,goal){
 if(blocked(s,goal)){
  const choices=[];for(let r=2;r<=8;r+=2)for(let i=0;i<16;i++){const p={x:goal.x+Math.cos(i*Math.PI/8)*r,z:goal.z+Math.sin(i*Math.PI/8)*r};if(!blocked(s,p))choices.push(p);}
  choices.sort((a,b)=>distance(a,s.player)+distance(a,goal)*2-distance(b,s.player)-distance(b,goal)*2);if(choices.length)goal=choices[0];
 }
 const step=3,b=s.bounds,n=Math.floor((b.maxX-b.minX)/step)+1,cell=p=>[Math.round((p.x-b.minX)/step),Math.round((p.z-b.minZ)/step)],pos=(x,z)=>({x:b.minX+x*step,z:b.minZ+z*step}),key=(x,z)=>x+z*n;
 const [sx,sz]=cell(s.player),[gx,gz]=cell(goal),open=[{x:sx,z:sz,g:0,f:0}],seen=new Map(),parents=new Map(),closed=new Set();let found;
 for(let iter=0;open.length&&iter<10000;iter++){open.sort((a,b)=>b.f-a.f);const a=open.pop(),ak=key(a.x,a.z);if(closed.has(ak))continue;closed.add(ak);if(Math.hypot(a.x-gx,a.z-gz)<1.5){found=a;break;}
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=a.x+dx,z=a.z+dz,k=key(x,z);if(x<1||z<1||x>=n-1||z>=n-1||closed.has(k))continue;const p=pos(x,z);if(blocked(s,p)||(!(a.x===sx&&a.z===sz)&&!clear(s,pos(a.x,a.z),p)))continue;const cost=a.g+Math.hypot(dx,dz)+(s.hazards.some(h=>h.type==='fire'&&distance(h,p)<h.radius)?5:0);if(seen.has(k)&&seen.get(k)<=cost)continue;seen.set(k,cost);parents.set(k,a);open.push({x,z,g:cost,f:cost+Math.hypot(gx-x,gz-z)});}
 }
 if(!found)return [];const result=[];for(let a=found;a&&!(a.x===sx&&a.z===sz);a=parents.get(key(a.x,a.z)))result.unshift(pos(a.x,a.z));return result;
}
function createPilot(){let route=[],lastGoal='',vent=false,stage=-1,records=[],lastPath=0;
 const next=s=>{
  const p=s.player,o=s.objectives[s.stage];if(stage!==s.stage){stage=s.stage;records.push({stage,time:+s.time.toFixed(1),hp:Math.round(p.hp)});route=[];}
  const active=s.enemies.filter(e=>e.alive&&(e.type!=='boss'||s.stage>=2)).sort((a,b)=>distance(a,p)-distance(b,p));
  let target=active.find(e=>distance(e,p)<38);if(!target&&o.type==='eliminate')target=active.find(e=>o.targets.includes(e.id));if(!target&&o.type==='boss')target=active.find(e=>e.type==='boss');
  const repair=s.pickups.filter(c=>!c.taken&&c.type==='repair').sort((a,b)=>distance(a,p)-distance(b,p))[0];
  const gun=s.enemies.filter(e=>e.disabled&&!e.weaponTaken&&distance(e,p)<30).sort((a,b)=>distance(a,p)-distance(b,p))[0];
  let goal=o,goalId=o.id;if(p.hp<p.maxHp*.5&&repair){goal=repair;goalId=repair.id;}else if(p.weapon==='cannon'&&gun){goal=gun;goalId=gun.id;}else if(target){goal=target;goalId=target.id;}
  const d=target?distance(target,p):999,los=target?clear(s,p,target):false;
  const danger=s.strikes.find(b=>distance(b,p)<b.radius+2);
  if(p.heat>75)vent=true;if(p.heat<20)vent=false;
  const input={aimX:target?.x??o.x,aimZ:target?.z??o.z,fire:!!target&&d<40,punch:!!target&&d<8,vent:vent&&!danger,interact:true,rip:true,moveX:0,moveZ:0,dash:false};
  const nearEnough=goal===target&&d<(target.type==='boss'?25:15)&&los;
  if(goalId!==lastGoal||s.time-lastPath>1.5){route=pathTo(s,goal);lastGoal=goalId;lastPath=s.time;}
  while(route.length&&distance(route[0],p)<2)route.shift();
  if(!nearEnough&&distance(goal,p)>3&&route.length){const next=route[0],len=distance(p,next);input.moveX=(next.x-p.x)/len;input.moveZ=(next.z-p.z)/len;}
  if(danger){const choices=[];for(let i=0;i<16;i++){const dx=Math.cos(i*Math.PI/8),dz=Math.sin(i*Math.PI/8),q={x:p.x+dx*10,z:p.z+dz*10};if(blocked(s,q)||q.x<s.bounds.minX+2||q.x>s.bounds.maxX-2||q.z<s.bounds.minZ+2||q.z>s.bounds.maxZ-2)continue;const margin=Math.min(...s.strikes.map(b=>distance(q,b)-b.radius));choices.push({dx,dz,score:Math.min(5,margin)-distance(q,goal)*.15});}choices.sort((a,b)=>b.score-a.score);if(choices.length){input.moveX=choices[0].dx;input.moveZ=choices[0].dz;}input.dash=true;}
  else if(nearEnough&&!vent){const a=target.angle+Math.PI/2,dx=Math.sin(a),dz=Math.cos(a);if(!blocked(s,{x:p.x+dx*3,z:p.z+dz*3})){input.moveX=dx*.6;input.moveZ=dz*.6;}}
  if(o.type==='defend'&&distance(p,o)>14&&!danger&&p.hp>100){const len=distance(p,o);input.moveX=(o.x-p.x)/len;input.moveZ=(o.z-p.z)/len;}
  return input;
 };next.records=records;return next;
}
function play(s){IW.start(s);const pilot=createPilot();for(let frame=0;frame<60*600&&s.status==='playing';frame++)IW.step(s,pilot(s),1/60);const records=pilot.records;
 return {chapter:s.chapter+1,status:s.status,time:+s.time.toFixed(1),hp:Math.round(s.player.hp),kills:s.kills,stage:s.stage,weapon:s.player.weapon,records,position:{x:s.player.x,z:s.player.z},caches:s.pickups.filter(c=>!c.taken).map(c=>({type:c.type,x:c.x,z:c.z,blocked:blocked(s,c)})),remaining:s.enemies.filter(e=>e.alive).map(e=>({id:e.id,hp:Math.round(e.hp)}))};
}
if(require.main===module){const reports=[];let s=IW.createCampaignState(Number(process.env.IW_CHAPTER)||0);for(let i=s.chapter;i<5;i++){const r=play(s);reports.push(r);console.log(JSON.stringify(r));if(s.status!=='won')break;if(i<4)IW.advance(s,i%2?'damage':'armor');}if(reports.some(r=>r.status!=='won'))process.exitCode=1;}
module.exports={play,pathTo,createPilot};
