'use strict';
const {loadPW}=require('../prism-warden/tools/aqueduct-pilot.cjs');
function tick(PW,s,i={},frames=1){for(let k=0;k<frames;k++)PW.step(s,i,1/60);}
function arena(PW){const s=PW.create({room:'furnace'});s.status='playing';for(const k of ['walls','gates','water','breakwaters','shutters','glass','growth','dams','mirrors','enemies','emitters','receivers','pickups','exits','starPaths','voids'])s[k]=[];s.room.challenge=null;s.escort=null;s.beacon=null;s.rescue=null;s.sanctuaryZone=null;s.player.x=300;s.player.y=384;return s;}
test('polarity unlocks at the Kiln, toggles only on press, and changes actual receiver matching',()=>{
 const PW=loadPW(),early=PW.create();early.status='playing';tick(PW,early,{polarity:true});expect(early.flags.polarity).toBeUndefined();
 const s=arena(PW);expect(s.flags.polarity).toBe('hot');s.emitters=[{x:80,y:384,dx:1,dy:0}];
 s.receivers=[{id:'test-cold',x:300,y:180,r:20,polarity:'cold',kind:'seal',charge:0,active:false,latch:true}];
 tick(PW,s,{reflect:true,ax:0,ay:-1},90);expect(s.receivers[0].active).toBe(false);
 tick(PW,s,{polarity:true,reflect:true,ax:0,ay:-1},90);expect(s.flags.polarity).toBe('cold');expect(s.receivers[0].active).toBe(true);
 tick(PW,s,{});tick(PW,s,{polarity:true});expect(s.flags.polarity).toBe('hot');
});
test('Glass Edge cuts only nearby hostile shots in the aimed unobstructed slash arc without farming score',()=>{
 const PW=loadPW();
 for(const [edge,aim,wall,friendly,cut]of [[true,1,false,false,true],[false,1,false,false,false],[true,-1,false,false,false],[true,1,true,false,false],[true,1,false,true,false]]){
  const s=arena(PW);s.flags['kiln-edge']=edge;s.shots=[{id:900,x:350,y:384,vx:-180,vy:0,r:5,life:3,friendly}];
  if(wall)s.walls=[{x:320,y:360,w:10,h:50}];const score=s.score;
  tick(PW,s,{slash:true,ax:aim,ay:0});expect(s.shots.length).toBe(cut?0:1);expect(s.score).toBe(score);
 }
});
test('quench removes the authored late flare through both phases; freed shade silences its Crown sentry',()=>{
 const PW=loadPW(),s=PW.create({room:'galleries'});s.status='playing';s.flags['quench-valve']=true;s.player.invulnerable=99;
 for(let k=0;k<900;k++){tick(PW,s);expect(s.glass.find(g=>g.id==='gallery-south-flare').active).toBe(false);}
 const d=PW.create({room:'descent'});d.status='playing';d.flags['shade-freed']=true;tick(PW,d);
 expect(d.enemies.find(e=>e.id==='crown-descent-turret').phase).toBe('silent');
});
test('restoration is an exclusive beacon decision with different late traversal behavior',()=>{
 const PW=loadPW(),s=PW.create({room:'twins'});s.status='playing';expect(PW.chooseRestoration(s,'channels')).toBe(false);
 s.status='cleared';s.flags['beacon:night-observatory']=true;
 expect(PW.chooseRestoration(s,'invalid')).toBe(false);expect(PW.chooseRestoration(s,'channels')).toBe(true);
 expect(PW.chooseRestoration(s,'channels')).toBe(true);expect(PW.chooseRestoration(s,'beacons')).toBe(false);
 for(const choice of ['channels','beacons']){
  const d=PW.create({room:'descent'});d.status='playing';d.flags['restoration-choice']=choice;d.burstTime=0;tick(PW,d);
  expect(d.starPaths.filter(p=>!p.alignTo).every(p=>p.active)).toBe(choice==='channels');
 }
 const lighthouse=PW.create({room:'lighthouse'});lighthouse.status='playing';lighthouse.flags['restoration-choice']='channels';tick(PW,lighthouse);
 expect(lighthouse.starPaths.some(p=>!p.active)).toBe(true);
});
test('ten core discoveries have distinct flags and authored locations, excluding mandatory rescues',()=>{
 const PW=loadPW();expect(PW.DISCOVERY_CONTRACT).toHaveLength(10);
 expect(new Set(PW.DISCOVERY_CONTRACT.map(x=>x.flag)).size).toBe(10);
 for(const d of PW.DISCOVERY_CONTRACT){expect(PW.ROOMS[d.room]).toBeTruthy();expect(d.effect.length).toBeGreaterThan(15);expect(['nacre-freed','ilex-evacuated']).not.toContain(d.flag);}
});
