const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../ironwake/assets/js/logic.js'),'utf8'),ctx);const IW=ctx.IW;
function game(){const s=IW.createState(7);IW.start(s);return s;}
function run(s,input,seconds){for(let n=0;n<seconds*60;n++)IW.step(s,input,1/60);}
describe('Ironwake combat demolition',()=>{
 test('start and retry preserve seed and reset all mission state',()=>{const s=game();s.score=44;s.status='lost';IW.start(s);expect(s.score).toBe(0);expect(s.seed).toBe(7);expect(s.player.weapon).toBe('cannon');expect(s.convoyDestroyed).toBe(0);expect(IW.start(s)).toBe(false);});
 test('same inputs produce deterministic combat and effects',()=>{const a=game(),b=game();for(let n=0;n<300;n++){const input={moveX:n<100?1:0,aimX:4,aimZ:2,fire:true,vent:n>220};IW.step(a,input,1/60);IW.step(b,input,1/60);}expect(a).toEqual(b);});
 test('aimed opening punch creates a timed collapse and crushes the first tank',()=>{const s=game();IW.step(s,{punch:true,aimX:-10,aimZ:-8},1/60);expect(s.buildings[0].status).toBe('falling');expect(s.collapseKills).toBe(0);run(s,{},2);expect(s.buildings[0].status).toBe('rubble');expect(s.collapseKills).toBeGreaterThanOrEqual(1);expect(s.convoyDestroyed).toBe(1);expect(s.player.hp).toBe(160);});
 test('fall geometry cannot kill actors at the distant tip before impact',()=>{const s=game(),b=s.buildings[0];b.status='falling';b.fallProgress=.1;b.fallZ=-1;b.fallX=0;expect(IW.inFootprint({x:-10,z:-10},b,.5,2)).toBe(false);b.fallProgress=1;expect(IW.inFootprint({x:-10,z:-10},b,.5,2)).toBe(true);});
 test('shooting and sustained fire generate heat and block fire at overheat',()=>{const s=game();s.enemies=[];s.convoyTotal=3;run(s,{fire:true,aimX:-30,aimZ:20},5);expect(s.player.overheated).toBe(true);const score=s.nextId;run(s,{fire:true,aimX:-30,aimZ:20},.2);expect(s.nextId).toBe(score);});
 test('venting cools reactor and prevents movement and attacks',()=>{const s=game();s.player.heat=98;s.player.overheated=true;const x=s.player.x,z=s.player.z;run(s,{vent:true,moveX:1,fire:true,punch:true},2);expect(s.player.heat).toBeLessThan(25);expect(s.player.overheated).toBe(false);expect(s.player.x).toBe(x);expect(s.player.z).toBe(z);expect(s.projectiles.filter(p=>p.owner==='player')).toHaveLength(0);});
 test('incoming enemy fire causes damage during stationary exposed play',()=>{const s=game();run(s,{},10);expect(s.player.hp).toBeLessThan(160);});
 test('escort screens cannon fire until the player earns a flank',()=>{const screened=game(),open=game();
  [screened,open].forEach(s=>{s.buildings=[];s.enemies=s.enemies.filter(e=>e.id==='tank-a'||(s===screened&&e.id==='escort-a'));s.player.x=0;s.player.z=12;s.enemies.find(e=>e.id==='tank-a').x=0;s.enemies.find(e=>e.id==='tank-a').z=0;});
  IW.step(screened,{fire:true,aimX:0,aimZ:0},1/60);IW.step(open,{fire:true,aimX:0,aimZ:0},1/60);run(screened,{},.5);run(open,{},.5);
  expect(screened.enemies.find(e=>e.id==='tank-a').hp).toBeGreaterThan(open.enemies.find(e=>e.id==='tank-a').hp);expect(screened.message).toContain('ESCORT SCREEN');
 });
 test('flanking rubble awards a one-time angle bonus and kill bonus',()=>{const s=game();s.buildings=s.buildings.slice(0,1);const b=s.buildings[0];b.status='rubble';b.fallProgress=1;b.fallX=0;b.fallZ=-1;s.player.x=-4;s.player.z=-4;IW.step(s,{},1/60);expect(s.flankCount).toBe(1);expect(s.score).toBe(250);
  const tank=s.enemies.find(e=>e.id==='tank-a');tank.hp=10;tank.x=-4;tank.z=-8;IW.step(s,{fire:true,aimX:-4,aimZ:-8},1/60);run(s,{},.5);expect(tank.alive).toBe(false);expect(s.score).toBe(1575);
 });
 test('venting behind a tower rewards a complete safe reactor cycle',()=>{const s=game();s.enemies=s.enemies.filter(e=>e.id==='tank-a');s.enemies[0].x=-10;s.enemies[0].z=-6;s.player.heat=80;IW.step(s,{vent:true},1/60);expect(s.player.ventingInCover).toBe(true);run(s,{vent:true},2);expect(s.coverVents).toBe(1);expect(s.score).toBe(150);expect(s.message).toContain('COVER VENT');
 });
 test('disabled escort yields a heavy weapon only nearby and only once',()=>{const s=game();IW.step(s,{punch:true,aimX:-5,aimZ:8},1/60);const e=s.enemies.find(e=>e.id==='escort-a');expect(e.disabled).toBe(true);IW.step(s,{rip:true},1/60);expect(s.player.weapon).toBe('cannon');s.player.x=e.x-1;s.player.z=e.z;IW.step(s,{rip:true},1/60);expect(s.player.weapon).toBe('heavy');expect(e.weaponTaken).toBe(true);const score=s.score;run(s,{rip:true},.5);expect(s.score).toBe(score);});
 test('solid tower and rubble block walking through their visible footprint',()=>{const s=game();s.enemies=[];run(s,{moveZ:-1},2);expect(s.player.z).toBeGreaterThanOrEqual(5);s.buildings[0].status='rubble';s.buildings[0].fallProgress=1;run(s,{moveZ:-1},2);expect(s.player.z).toBeGreaterThanOrEqual(3);});
 test('elapsed time is capped and mission expires cleanly',()=>{const s=game();IW.step(s,{},9);expect(s.time).toBe(.05);s.timeLeft=.001;IW.step(s,{},1/60);expect(s.status).toBe('lost');const score=s.score;run(s,{fire:true},1);expect(s.score).toBe(score);});
 test('escape loses and victory reward only occurs once',()=>{const loss=game();loss.enemies[0].x=34.1;IW.step(loss,{},1/60);expect(loss.status).toBe('lost');const s=game();s.convoyDestroyed=3;IW.step(s,{},1/60);expect(s.status).toBe('won');const score=s.score;run(s,{},2);expect(s.score).toBe(score);});
});
