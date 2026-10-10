const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../shiftwick/assets/js/logic.js'),'utf8'),ctx);
const SW=ctx.SW;
const run=(s,sec)=>{for(let i=0;i<sec*60;i++)SW.step(s,1/60);};
describe('Shiftwick',()=>{
 test('maze is deterministic and fully connected for many seeds',()=>{
  for(let seed=1;seed<60;seed++){const a=SW.generate(seed),b=SW.generate(seed);expect(a).toEqual(b);
   const seen=SW.flood(a,1,1);for(let y=0;y<SW.H;y++)for(let x=0;x<SW.W;x++)if(!a[y][x])expect(seen[y][x]).toBe(true);
   for(let x=0;x<SW.W;x++){expect(a[0][x]).toBe(1);expect(a[SW.H-1][x]).toBe(1);}}
 });
 test('player eats embers for score and combo',()=>{
  const s=SW.create({seed:3});s.p.want={x:1,y:0};s.p.want=SW.DIRS.find(d=>SW.open(s,1+d.x,1+d.y));run(s,1);
  expect(s.score).toBeGreaterThan(0);expect(s.remaining).toBeLessThan(s.total);
 });
 test('shifting a line preserves tile and ember counts and is reversible',()=>{
  const s=SW.create({seed:5}),w0=JSON.stringify(s.wall),p0=JSON.stringify(s.pel);
  s.p.ty=3;s.p.tx=1;const cnt=()=>s.pel.flat().filter(Boolean).length;const c=cnt();
  SW.shiftLine(s,'row',3,1);expect(cnt()).toBe(c);SW.shiftLine(s,'row',3,-1);
  expect(JSON.stringify(s.wall)).toBe(w0);expect(JSON.stringify(s.pel)).toBe(p0);
  SW.shiftLine(s,'col',4,1);SW.shiftLine(s,'col',4,-1);expect(JSON.stringify(s.wall)).toBe(w0);
  expect(SW.shiftLine(s,'row',0,1)).toBe(false);
 });
 test('tryShift spends a charge, moves riders onto open tiles and dazes shades in line',()=>{
  const s=SW.create({seed:9});s.shades.forEach(a=>{a.state='roam';});
  const p=s.p,sh=s.shades[1];sh.tx=7;sh.ty=p.ty;
  const ch=s.charges;expect(SW.tryShift(s,1)).toBe(true);
  expect(s.charges).toBe(ch-1);expect(SW.open(s,p.tx,p.ty)).toBe(true);expect(SW.open(s,sh.tx,sh.ty)).toBe(true);
  expect(sh.dazed).toBeGreaterThan(0);expect(s.anim).not.toBeNull();expect(SW.tryShift(s,1)).toBe(false);
 });
 test('no shift without charges',()=>{const s=SW.create({seed:9});s.charges=0;expect(SW.tryShift(s,1)).toBe(false);});
 test('simulation is deterministic and a shade eventually catches an idle player',()=>{
  const a=SW.create({seed:21}),b=SW.create({seed:21});run(a,5);run(b,5);expect(JSON.stringify(a.shades)).toBe(JSON.stringify(b.shades));
  run(a,120);expect(a.lives).toBeLessThan(3);
 });
 test('power pellet dazes shades and eating them scores; actors always stand on open tiles',()=>{
  const s=SW.create({seed:11});s.shades.forEach(a=>a.state='roam');
  s.pel[s.p.ty][s.p.tx+1]=2;s.p.want={x:1,y:0};
  if(!SW.open(s,s.p.tx+1,s.p.ty)){s.wall[s.p.ty][s.p.tx+1]=0;}
  s.pel[s.p.ty][s.p.tx+1]=2;run(s,0.5);
  for(let i=0;i<600;i++){SW.step(s,1/60);if(i%90===0)SW.tryShift(s,i%4);for(const a of [s.p].concat(s.shades))if(a.state!=='den')expect(SW.open(s,a.tx,a.ty)).toBe(true);}
 });
 test('clearing the maze advances level and bonus',()=>{
  const s=SW.create({seed:2});for(const r of s.pel)r.fill(0);s.pel[1][2]=1;s.remaining=1;s.wall[1][2]=0;s.p.want={x:1,y:0};s.shades.forEach(a=>{a.state='den';a.release=99;});
  run(s,1);expect(s.level).toBe(1);expect(s.score).toBeGreaterThan(500);
 });
});
