'use strict';
const {loadPW} = require('../prism-warden/tools/aqueduct-pilot.cjs');
function arena(PW, region, choice) {
  const s=PW.create(); s.status='cleared'; s.regionId=region; s.flags['beacon:'+region]=true;
  expect(PW.chooseEquipment(s,choice)).toBe(true); s.status='playing';
  for(const key of ['walls','gates','enemies','water','breakwaters','shutters','glass','growth','dams','mirrors','emitters','receivers','shots','pickups','exits','starPaths','voids'])s[key]=[];
  s.escort=null;s.rescue=null;s.beacon=null;s.sanctuaryZone=null;s.player.x=400;s.player.y=500;
  return s;
}
function ticks(PW,s,input,n=1){for(let j=0;j<n;j++)PW.step(s,input,1/60);}
test('four exclusive decisions unlock only at restored beacons and catalog cannot mutate rules',()=>{
  const PW=loadPW(),s=PW.create();expect(PW.chooseEquipment(s,'mobile-reflection')).toBe(false);
  const catalog=PW.equipmentCatalog();expect(Object.keys(catalog)).toHaveLength(4);
  for(const [region,choices]of Object.entries(catalog)){
    s.regionId=region;s.status='cleared';s.flags['beacon:'+region]=true;
    expect(PW.equipmentChoices(s)).toHaveLength(2);expect(PW.chooseEquipment(s,choices[0].id)).toBe(true);
    expect(PW.chooseEquipment(s,choices[1].id)).toBe(false);
  }
  catalog['tidal-abbey'][0].id='fake';expect(PW.equipmentCatalog()['tidal-abbey'][0].id).toBe('mobile-reflection');
});
test('Drift Mirror trades the Shell Guard side-shot coverage for mobile reflection',()=>{
  const PW=loadPW(),mobile=arena(PW,'tidal-abbey','mobile-reflection'),wide=arena(PW,'tidal-abbey','wide-guard');
  ticks(PW,mobile,{mx:1,reflect:true},10);ticks(PW,wide,{mx:1,reflect:true},10);
  expect(mobile.player.x-400).toBeCloseTo(190/6);expect(wide.player.x-400).toBeCloseTo(108/6);
  for(const s of [mobile,wide]){s.player.x=400;s.shots.push({id:99,x:400,y:480,vx:0,vy:180,r:7,life:3,friendly:false});ticks(PW,s,{ax:1,ay:0,reflect:true},3);}
  expect(mobile.hits).toBe(1);expect(wide.hits).toBe(0);expect(wide.shots.some(s=>s.friendly)).toBe(true);
});
function sentinel(PW,s,x){const e=PW.create().enemies.find(e=>e.type==='sentinel');Object.assign(e,{x,y:500,hp:6,maxHp:6,exposed:3,phase:'exposed',timer:3});s.enemies=[e];return e;}
test('Anchor Edge gains close damage but loses reach and recovers more slowly',()=>{
  const PW=loadPW(),heavy=arena(PW,'verdant-aqueduct','heavy-strike'),light=arena(PW,'verdant-aqueduct','returning-blade');
  const a=sentinel(PW,heavy,455),b=sentinel(PW,light,455);ticks(PW,heavy,{slash:true,ax:1});ticks(PW,light,{slash:true,ax:1});
  expect(a.hp).toBe(3);expect(b.hp).toBe(4);expect(heavy.player.slashCooldown).toBeGreaterThan(light.player.slashCooldown);
  for(const s of [heavy,light]){s.player.slashCooldown=0;s._slashHeld=false;sentinel(PW,s,475);ticks(PW,s,{slash:true,ax:1});}
  expect(heavy.enemies[0].hp).toBe(6);expect(light.enemies[0].hp).toBe(4);
});
test('Returning Blade hits exposed distant armor, returns, and cannot pass a solid wall',()=>{
  const PW=loadPW(),s=arena(PW,'verdant-aqueduct','returning-blade');const e=sentinel(PW,s,600);
  ticks(PW,s,{slash:true,reflect:true,ax:1});expect(s.blade).toBeTruthy();
  ticks(PW,s,{},50);expect(e.hp).toBe(4);expect(s.blade).toBeNull();
  e.hp=6;e.exposed=3;e.phase='exposed';s.walls=[{x:480,y:450,w:24,h:100}];
  ticks(PW,s,{slash:true,reflect:true,ax:1});ticks(PW,s,{},60);expect(e.hp).toBe(6);expect(s.blade).toBeNull();
});
test('heavy sword cannot skip any Eclipse Keeper phase',()=>{
  const PW=loadPW(),s=PW.create({room:'crown'});s.status='playing';s.equipment={'verdant-aqueduct':'heavy-strike'};
  const e=s.enemies.find(e=>e.type==='crown');s.player.x=e.x-45;s.player.y=e.y;s.player.invulnerable=9;
  for(const [hp,stage]of [[4,2],[2,3],[0,3]]){e.exposed=3;e.phase='exposed';s._slashHeld=false;s.player.slashCooldown=0;ticks(PW,s,{ax:1,slash:true});expect(e.hp).toBe(hp);expect(e.stage).toBe(stage);}
});
test('Recall Tether retrieves remotely; Twin Satchel requires retrieval but supports two optical objects',()=>{
  const PW=loadPW();
  for(const choice of ['prism-recall','second-prism']){
    const s=arena(PW,'glass-kiln',choice);s.player.prism='carried';ticks(PW,s,{ax:1,place:true});
    expect(s.mirrors.filter(m=>m.portable)).toHaveLength(1);ticks(PW,s,{mx:-1},60);ticks(PW,s,{ax:1,place:true});
    expect(s.mirrors.filter(m=>m.portable)).toHaveLength(choice==='prism-recall'?0:2);
    if(choice==='second-prism'){ticks(PW,s,{my:-1},60);ticks(PW,s,{ax:1,place:true});expect(s.mirrors).toHaveLength(2);}
    PW.enterRoom(s,'spillway');expect(s.mirrors.some(m=>m.portable)).toBe(false);expect(s.player.prism).toBe('carried');
  }
});
test('Thunder Lens pauses nearby enemies; Dawn Lens keeps traversal lit longer',()=>{
  const PW=loadPW(),stun=arena(PW,'night-observatory','burst-stun'),bridge=arena(PW,'night-observatory','lasting-bridge');
  for(const s of [stun,bridge]){s.flags['stored-light']=true;s.player.lightCharge=1;const e=sentinel(PW,s,500);e.exposed=0;e.phase='telegraph';e.timer=1;ticks(PW,s,{burst:true});}
  expect(stun.enemies[0].burstStun).toBeGreaterThan(1.9);expect(bridge.enemies[0].burstStun||0).toBe(0);
  expect(stun.burstTime).toBeCloseTo(6);expect(bridge.burstTime).toBeCloseTo(10);
  for(const s of [stun,bridge]){s.enemies=[];ticks(PW,s,{},420);}
  expect(stun.burstTime).toBe(0);expect(bridge.burstTime).toBeGreaterThan(2.9);
});
