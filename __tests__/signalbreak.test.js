const fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const window = {};
  const context = vm.createContext({ window, Math, JSON, Number, Array, Object });
  for (const file of ['missions', 'logic', 'campaign', 'render']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../signalbreak/assets/js/' + file + '.js'), 'utf8'), context);
  return window.SB;
}
function order(L, s, id, kind, x, y) { const p = L.preview(s,id,kind,x,y); if (!p.legal) throw Error(p.reason); expect(L.commit(s,p)).toBe(true); return p; }
function pilot(SB, s, report = []) {
  const L = SB.Logic;
  for (let turn=0;turn<35 && s.phase==='player';turn++) {
    for (const u of s.squad) for (let n=0;n<2 && L.living(u) && u.ap && s.phase==='player';n++) {
      const immediate = [L.preview(s,u.id,'hack',s.node.x,s.node.y),L.preview(s,u.id,'rescue',s.rescue.x,s.rescue.y),L.preview(s,u.id,'extract',u.x,u.y)];
      let p=immediate.find(p=>p.legal);
      if (!p) p=s.enemies.filter(L.living).map(e=>L.preview(s,u.id,'attack',e.x,e.y)).filter(p=>p.legal).sort((a,b)=>b.damage-a.damage)[0];
      if (!p) {
        const hostiles=s.enemies.filter(L.living);
        const goal=!s.network?s.node:hostiles.length?hostiles.sort((a,b)=>Math.abs(u.x-a.x)+Math.abs(u.y-a.y)-Math.abs(u.x-b.x)-Math.abs(u.y-b.y))[0]:!s.rescued?s.rescue:{x:15,y:10};
        let best=null;
        for(let y=1;y<s.height-1;y++)for(let x=1;x<s.width-1;x++) {
          const candidate=L.preview(s,u.id,'move',x,y); if(!candidate.legal)continue;
          const dist=Math.abs(x-goal.x)+Math.abs(y-goal.y);
          const value=dist*10+candidate.cost-L.cover(s,{x,y},goal)*0.5;
          if(!best||value<best.value)best={value,p:candidate};
        }
        if(best)p=best.p;
      }
      if(p){report.push({actorId:u.id,kind:p.kind,x:p.x,y:p.y,turn:s.turn});L.commit(s,p);}
    }
    if(s.phase==='player') { report.push({kind:'end',turn:s.turn});L.endTurn(s); }
  }
  return report;
}
test('full manifest promises twenty operations; thirteen distinct authored maps are playable', () => {
  const SB=load();expect(SB.Missions.manifest).toHaveLength(5);
  const names=SB.Missions.manifest.flatMap(d=>Array.from(d).slice(1));expect(new Set(names).size).toBe(20);
  expect(SB.Missions.opening.title).toBe('Live Wire');
  expect(SB.Missions.operations.map(m=>m.id)).toEqual(['live-wire','locked-manifest','cut-the-feed','night-freight','rooftop-crossfire','cargo-lift','open-clinic','antenna-rain','sluice-logic','span-control','blackout','pump-siege','paper-trail']);
  expect(new Set(SB.Missions.operations.map(m=>m.rows.join(''))).size).toBe(13);
  for(const m of SB.Missions.operations){expect(m.rows.every(r=>r.length===m.rows[0].length)).toBe(true);for(const n of m.circuits||[])expect(m.rows[n.y][n.x]).toBe('n');}
  expect(()=>SB.Logic.newGame('two-keys')).toThrow('Unknown operation');
});
test('fresh states are isolated and previews never mutate the tactical state', () => {
  const {Logic:L}=load(),a=L.newGame(),b=L.newGame(),before=JSON.stringify(a);
  const p=L.preview(a,'nia','move',4,4);expect(p.legal).toBe(true);expect(JSON.stringify(a)).toBe(before);
  L.commit(a,p);expect(b.squad[0].x).toBe(2);expect(b.squad[0].ap).toBe(2);
});
test('movement enforces walls, occupied tiles, costs and current-state revalidation', () => {
  const {Logic:L}=load(),s=L.newGame();
  expect(L.preview(s,'nia','move',8,5).legal).toBe(false);expect(L.preview(s,'nia','move',2,5).legal).toBe(false);
  const p=L.preview(s,'nia','move',6,4);expect(p.cost).toBe(1);L.commit(s,p);expect(s.squad[0].ap).toBe(1);
  expect(L.commit(s,p)).toBe(false);expect(s.squad[0].ap).toBe(1);
  expect(L.preview(s,'nia','move',100,5).legal).toBe(false);
});
test('taking the shared circuit opens the security door and changes turret allegiance', () => {
  const {Logic:L}=load(),s=L.newGame();order(L,s,'nia','move',5,5);
  expect(L.blocked(s,8,6)).toBe(true);expect(L.preview(s,'nia','hack',6,6).legal).toBe(true);
  order(L,s,'nia','hack',6,6);expect(L.blocked(s,8,6)).toBe(false);expect(s.score).toBe(500);
  const hp=s.enemies[0].hp;L.endTurn(s);expect(s.enemies[0].hp).toBeLessThan(hp);
});
test('LOS blocks wall/closed door fire and opens with the circuit; low cover and height affect damage', () => {
  const {Logic:L}=load(),s=L.newGame();
  expect(L.visible(s,{x:6,y:5},{x:10,y:5})).toBe(false);
  expect(L.visible(s,{x:6,y:6},{x:10,y:6})).toBe(false);s.network=true;
  expect(L.visible(s,{x:6,y:6},{x:10,y:6})).toBe(true);
  const a={x:2,y:4,damage:3},target={x:3,y:4};expect(L.damage(s,a,target)).toBe(2);
  expect(L.damage(s,{x:11,y:2,damage:3},{x:12,y:3})).toBe(4);
});
test('shots use the previewed damage, spend one AP and award a kill once', () => {
  const {Logic:L}=load(),s=L.newGame();s.network=true;s.squad[3].x=10;s.squad[3].y=4;
  const p=L.preview(s,'ivo','attack',11,4);expect(p.legal).toBe(true);
  const hp=s.enemies[0].hp;L.commit(s,p);expect(s.enemies[0].hp).toBe(hp-p.damage);
  order(L,s,'ivo','attack',11,4);expect(s.enemies[0].hp).toBe(0);expect(s.kills).toBe(1);expect(s.score).toBe(150);
  expect(L.commit(s,p)).toBe(false);expect(s.score).toBe(150);
});
test('overwatch reacts to movement once and AP refreshes after deterministic AI turn', () => {
  const {Logic:L}=load(),s=L.newGame();s.network=true;
  s.enemies=s.enemies.slice(0,1);Object.assign(s.enemies[0],{x:14,y:10,range:1,hp:20});
  Object.assign(s.squad[0],{x:10,y:10,range:8});order(L,s,'nia','watch',10,10);
  L.endTurn(s);expect(s.enemies[0].hp).toBeLessThan(20);expect(s.squad[0].watch).toBe(false);expect(s.squad[0].ap).toBe(2);
});
test('field aid requires Sol, an injured adjacent target and a finite kit', () => {
  const {Logic:L}=load(),s=L.newGame();s.squad[0].hp=3;
  expect(L.preview(s,'nia','heal',2,4).legal).toBe(false);order(L,s,'sol','heal',2,4);expect(s.squad[0].hp).toBe(7);
  expect(s.squad[1].kits).toBe(1);order(L,s,'sol','heal',2,4);expect(s.squad[0].hp).toBe(10);
  s.squad[1].ap=2;s.squad[0].hp=2;expect(L.preview(s,'sol','heal',2,4).legal).toBe(false);
});
test('objectives gate extraction and all living engineers must extract before victory', () => {
  const {Logic:L}=load(),s=L.newGame();Object.assign(s.squad[0],{x:14,y:10});
  expect(L.preview(s,'nia','extract',14,10).legal).toBe(false);s.network=true;s.rescued=true;
  order(L,s,'nia','extract',14,10);expect(s.phase).toBe('player');expect(s.squad[0].extracted).toBe(true);
  for(let i=1;i<4;i++){Object.assign(s.squad[i],{x:15,y:10});order(L,s,s.squad[i].id,'extract',15,10);}
  expect(s.phase).toBe('won');const frozen=JSON.stringify(s);L.endTurn(s);expect(JSON.stringify(s)).toBe(frozen);
});
test('worker rescue is adjacent, awards points once, and total squad loss ends orders', () => {
  const {Logic:L}=load(),s=L.newGame();Object.assign(s.squad[0],{x:12,y:8});
  order(L,s,'nia','rescue',12,9);expect(s.rescued).toBe(true);expect(s.score).toBe(400);
  expect(L.preview(s,'nia','rescue',12,9).legal).toBe(false);
  s.squad.forEach(u=>u.hp=0);L.endTurn(s);expect(s.phase).toBe('lost');expect(L.preview(s,'nia','move',4,4).legal).toBe(false);
});
test('opening operation is winnable with legal actions, live AI, and no injected state', () => {
  const SB=load(),s=SB.Logic.newGame();const report=pilot(SB,s);
  expect(s.phase).toBe('won');expect(s.network).toBe(true);expect(s.rescued).toBe(true);
  expect(report.some(a=>a.kind==='hack')).toBe(true);expect(report.some(a=>a.kind==='attack')).toBe(true);
  expect(s.score).toBeGreaterThan(1000);expect(s.squad.some(u=>u.extracted)).toBe(true);
});
test('complete legal pilot is deterministic across fresh runs', () => {
  const SB=load(),a=SB.Logic.newGame(),b=SB.Logic.newGame();pilot(SB,a);pilot(SB,b);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

const {run:campaignRoute}=require('../tools/signalbreak-route.cjs');
test.each(['live-wire','locked-manifest','cut-the-feed','night-freight','rooftop-crossfire','cargo-lift','open-clinic','antenna-rain','sluice-logic','span-control','blackout','pump-siege','paper-trail'])('%s can be won by legal orders against live AI with four survivors', id => {
  const SB=load(),s=SB.Logic.newGame(id),report=campaignRoute(SB,s);
  expect(s.phase).toBe('won');expect(s.squad.filter(u=>u.extracted)).toHaveLength(4);
  expect(report.some(p=>p.kind==='hack')).toBe(true);expect(report.some(p=>p.kind==='rescue')).toBe(true);
  const replay=SB.Logic.newGame(id);expect(campaignRoute(SB,replay)).toEqual(report);expect(JSON.stringify(replay)).toBe(JSON.stringify(s));
});
test('exclusive relay reroutes actual doors, LOS and turret without repeat scoring', () => {
  const SB=load(),L=SB.Logic,s=L.newGame('locked-manifest'),u=s.squad[0];
  Object.assign(u,{x:7,y:5});order(L,s,'nia','hack',7,4);
  expect(L.doorOpen(s,10,4)).toBe(true);expect(L.doorOpen(s,15,10)).toBe(false);expect(L.turretAllied(s)).toBe(true);
  expect(L.visible(s,{x:9,y:4},{x:11,y:4})).toBe(true);
  Object.assign(u,{x:7,y:9,ap:2});order(L,s,'nia','hack',7,10);
  expect(L.doorOpen(s,10,4)).toBe(false);expect(L.visible(s,{x:9,y:4},{x:11,y:4})).toBe(false);
  expect(L.doorOpen(s,15,10)).toBe(true);expect(L.turretAllied(s)).toBe(false);expect(s.score).toBe(1000);
  Object.assign(u,{x:7,y:5,ap:2});order(L,s,'nia','hack',7,4);expect(s.score).toBe(1000);
  expect(L.objectiveStatus(s).find(o=>o.id==='evac').done).toBe(false);
});
test('clinic interlock refuses the second isolation without mutation, then permits it after bypass', () => {
  const SB=load(),L=SB.Logic,s=L.newGame('cut-the-feed'),u=s.squad[0];Object.assign(u,{x:13,y:9});
  const before=JSON.stringify(s),p=L.preview(s,'nia','hack',13,10);expect(p.legal).toBe(false);expect(p.reason).toMatch(/clinic.*interlock/i);expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(before);
  Object.assign(u,{x:12,y:3});order(L,s,'nia','hack',12,2);
  Object.assign(u,{x:13,y:9,ap:2});order(L,s,'nia','hack',13,10);expect(L.doorOpen(s,16,11)).toBe(true);expect(L.turretAllied(s)).toBe(true);
  expect(s.network).toBe(false);expect(L.objectiveStatus(s).filter(o=>o.done).map(o=>o.id)).toEqual(['clinic','east']);
});
test('a circuit node cannot be hacked through a wall even inside engineer range', () => {
  const SB=load(),s=SB.Logic.newGame('locked-manifest');Object.assign(s.squad[0],{x:9,y:4});
  // A fixture places the node beyond a solid interior wall; this tests LOS only.
  s.circuits[0].x=11;s.circuits[0].y=4;s.rows[4]=s.rows[4].slice(0,10)+'#'+s.rows[4].slice(11);
  expect(SB.Logic.preview(s,'nia','hack',11,4).legal).toBe(false);
});
test('reroute cannot strand an engineer; an engineer on the closing threshold can retreat', () => {
  const SB=load(),L=SB.Logic,s=L.newGame('locked-manifest');Object.assign(s.squad[0],{x:7,y:5});order(L,s,'nia','hack',7,4);
  Object.assign(s.squad[0],{x:7,y:9,ap:2});Object.assign(s.squad[2],{x:12,y:4});
  const p=L.preview(s,'nia','hack',7,10);expect(p.legal).toBe(false);expect(p.reason).toMatch(/every active engineer/i);
  Object.assign(s.squad[2],{x:10,y:4});order(L,s,'nia','hack',7,10);
  expect(L.preview(s,'rook','move',9,4).legal).toBe(true);
});
function memoryStorage(){const values={};return{getItem:key=>values[key]||null,setItem:(key,value)=>{values[key]=value;}};}
test('render picking maps displayed raised tile centers back to their actual authored coordinates', () => {
  const SB=load();for(const m of SB.Missions.operations)for(const zoom of [.75,1,2.2]){
    const s=SB.Logic.newGame(m.id),p=SB.Render.projection(1200,750,s,{zoom,selected:'nia',panX:31,panY:-24});
    for(const h of s.heights){const q=p.point(h.x,h.y,h.z);expect(p.inverse(q.x,q.y)).toEqual({x:h.x,y:h.y});}
    const u=s.squad[0],q=p.point(u.x,u.y,0);expect(p.inverse(q.x,q.y)).toEqual({x:u.x,y:u.y});
  }
});
test('mission-boundary saves unlock only earned operations and resume the next briefing', () => {
  const SB=load(),C=SB.Campaign,c=C.fresh(),store=memoryStorage();
  expect(C.unlocked(c,'locked-manifest')).toBe(false);expect(C.unlocked(c,'night-freight')).toBe(false);
  const s=SB.Logic.newGame();expect(C.complete(c,s)).toBe(false);s.phase='lost';expect(C.complete(c,s)).toBe(false);
  const won=SB.Logic.newGame();campaignRoute(SB,won);expect(C.complete(c,won)).toBe(true);expect(c.selected).toBe('locked-manifest');
  expect(C.unlocked(c,'locked-manifest')).toBe(true);expect(C.unlocked(c,'cut-the-feed')).toBe(false);
  expect(C.save(store,c)).toBe(true);const restored=C.load(store);expect(restored.available).toBe(true);expect(restored.campaign).toEqual(c);
  const best=c.results['live-wire'].score;won.score=1;C.complete(c,won);expect(c.results['live-wire'].score).toBe(best);
});
test('corrupt, gapped and future save data cannot unlock unavailable missions; denied storage is handled', () => {
  const C=load().Campaign,store=memoryStorage();store.setItem(C.key,'{broken');expect(C.load(store).campaign).toEqual(C.fresh());
  const c=C.normalize({version:1,selected:'cut-the-feed',results:{'locked-manifest':{score:5,turns:2,survivors:4}}});expect(c.results).toEqual({});expect(c.selected).toBe('live-wire');
  expect(C.normalize({version:2,results:{}})).toEqual(C.fresh());
  expect(C.normalize({version:1,results:{'live-wire':{score:Infinity,turns:1,survivors:4}}})).toEqual(C.fresh());
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};expect(C.load(denied).available).toBe(false);expect(C.save(denied,C.fresh())).toBe(false);
});

test('freight windows repeat, previews stay readonly, and stale boarding orders are rejected', () => {
  const L=load().Logic,s=L.newGame('night-freight'),u=s.squad[0];
  s.circuits[0].controlled=true;s.rescued=true;Object.assign(u,{x:13,y:8});
  const before=JSON.stringify(s);expect(L.extractionStatus(s).label).toBe('West platform');
  const p=L.preview(s,'nia','extract',13,8);expect(p.legal).toBe(true);expect(JSON.stringify(s)).toBe(before);
  const copy=L.extractionStatus(s);copy.tiles[0].x=99;expect(L.extractionStatus(s).tiles[0].x).toBe(13);
  s.turn=3;const transit=JSON.stringify(s);expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(transit);
  expect(L.extractionStatus(s).open).toBe(false);expect(L.preview(s,'nia','extract',13,8).reason).toMatch(/repeat/);
  s.turn=4;expect(L.extractionStatus(s).label).toBe('East platform');expect(L.preview(s,'nia','extract',13,8).legal).toBe(false);
  s.turn=7;order(L,s,'nia','extract',13,8);expect(u.extracted).toBe(true);
});
test('rail ambush defers occupied entries, deploys once, and gives a player response before firing', () => {
  const L=load().Logic,s=L.newGame('night-freight'),entry=s.ambush.enemies[0];
  s.enemies=[];s.turret=null;Object.assign(s.squad[0],{x:entry.x,y:entry.y});s.turn=3;
  const hp=s.squad[0].hp;L.endTurn(s);
  expect(s.turn).toBe(4);expect(s.squad[0].hp).toBe(hp);
  expect(s.enemies.map(e=>e.id)).toEqual(['freight-rear-b']);
  Object.assign(s.squad[0],{x:2,y:4});s.enemies[0].hp=0;L.endTurn(s);
  expect(s.enemies.filter(e=>e.id===entry.id)).toHaveLength(1);
  s.enemies.forEach(e=>e.hp=0);L.endTurn(s);expect(s.enemies).toHaveLength(2);
});
test('old three-operation campaign saves retain records and unlock Night Freight', () => {
  const SB=load(),results={};for(const id of ['live-wire','locked-manifest','cut-the-feed'])results[id]={score:2000,turns:10,survivors:4};
  const c=SB.Campaign.normalize({version:1,selected:'cut-the-feed',results});
  expect(c.results).toEqual(results);expect(SB.Campaign.unlocked(c,'night-freight')).toBe(true);
});


test('rooftop heights require authored stairs in both directions and power gates the south approach', () => {
  const L=load().Logic,s=L.newGame('rooftop-crossfire');
  for(const row of s.rows)expect(row.length).toBe(s.width);
  expect(L.canStep(s,{x:7,y:5},{x:8,y:5})).toBe(false);
  expect(L.canStep(s,{x:8,y:5},{x:7,y:5})).toBe(false);
  expect(L.canStep(s,{x:7,y:4},{x:8,y:4})).toBe(true);
  expect(L.canStep(s,{x:8,y:4},{x:7,y:4})).toBe(true);
  expect(L.canStep(s,{x:7,y:11},{x:8,y:11})).toBe(false);
  Object.assign(s.squad[0],{x:5,y:9});order(L,s,'nia','hack',5,10);
  expect(L.canStep(s,{x:7,y:11},{x:8,y:11})).toBe(true);
  expect(L.canStep(s,{x:8,y:11},{x:7,y:11})).toBe(true);
});

test('rooftop movement detours to stairs; cross-cliff rescue and field aid are rejected without mutation', () => {
  const L=load().Logic,s=L.newGame('rooftop-crossfire'),u=s.squad[0];
  Object.assign(u,{x:7,y:5});const route=L.path(s,u,8,5);
  expect(route.some(p=>p.x===7&&p.y===4)).toBe(true);
  expect(route.some(p=>p.x===8&&p.y===4)).toBe(true);
  s.rescue={x:8,y:5};const before=JSON.stringify(s);
  expect(L.preview(s,'nia','rescue',8,5).legal).toBe(false);expect(JSON.stringify(s)).toBe(before);
  Object.assign(s.squad[1],{x:7,y:5});Object.assign(s.squad[2],{x:8,y:5,hp:2});
  expect(L.preview(s,'sol','heal',8,5).legal).toBe(false);
});

test('old four-operation saves preserve records and unlock the first Market operation', () => {
 const SB=load(),results={};for(const m of SB.Missions.operations.slice(0,4))results[m.id]={score:2000,turns:10,survivors:4};
 const c=SB.Campaign.normalize({version:1,selected:'night-freight',results});
 expect(c.results).toEqual(results);expect(SB.Campaign.unlocked(c,'rooftop-crossfire')).toBe(true);
});


test('lift dispatch needs power and rescued cargo, previews readonly and carries all rider offsets',()=>{
 const L=load().Logic,s=L.newGame('cargo-lift');
 Object.assign(s.squad[0],{x:8,y:6});const before=JSON.stringify(s);
 expect(L.preview(s,'nia','hack',8,6).legal).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s.circuits[0].controlled=true;expect(L.preview(s,'nia','hack',8,6).legal).toBe(false);
 s.rescued=true;s.squad.forEach((u,i)=>Object.assign(u,{x:8+i%2,y:6+Math.floor(i/2)}));
 const snapshot=JSON.stringify(s),p=L.preview(s,'nia','hack',8,6);expect(p.legal).toBe(true);expect(p.lift).toBe(true);expect(JSON.stringify(s)).toBe(snapshot);
 expect(L.commit(s,p)).toBe(true);expect(s.lift.position).toBe(1);expect(s.lift.delivered).toBe(true);
 s.squad.forEach((u,i)=>{expect([u.x,u.y]).toEqual([13+i%2,6+Math.floor(i/2)]);expect(L.height(s,u.x,u.y)).toBe(2);});
 expect(L.blocked(s,8,6)).toBe(true);expect(L.blocked(s,13,6)).toBe(false);expect(s.squad[0].ap).toBe(1);
 expect(L.canStep(s,{x:14,y:6},{x:15,y:6})).toBe(true);
 expect(L.canStep(s,{x:9,y:6},{x:10,y:6})).toBe(false);
});

test('lift rejects stale dispatch direction, hostile riders and blocked destinations without spending AP',()=>{
 const L=load().Logic,s=L.newGame('cargo-lift');s.circuits[0].controlled=true;s.rescued=true;Object.assign(s.squad[0],{x:7,y:5});
 const old=L.preview(s,'nia','hack',7,5);expect(old.legal).toBe(true);expect(L.commit(s,old)).toBe(true);
 const after=JSON.stringify(s);expect(L.commit(s,old)).toBe(false);expect(JSON.stringify(s)).toBe(after);
 // Empty platform can be recalled from the dock without stranding the operator.
 order(L,s,'nia','hack',7,5);expect(s.lift.position).toBe(0);expect(s.lift.delivered).toBe(true);
 s.squad[0].ap=2;Object.assign(s.enemies[0],{x:8,y:6});let snap=JSON.stringify(s);expect(L.preview(s,'nia','hack',7,5).legal).toBe(false);expect(JSON.stringify(s)).toBe(snap);
 s.enemies[0].hp=0;Object.assign(s.enemies[1],{x:13,y:6});snap=JSON.stringify(s);expect(L.preview(s,'nia','hack',7,5).legal).toBe(false);expect(JSON.stringify(s)).toBe(snap);
});

test('lift cargo delivery is an independent extraction prerequisite and all active deck tiles pick correctly',()=>{
 const SB=load(),L=SB.Logic,s=L.newGame('cargo-lift');s.rescued=true;s.circuits.forEach(c=>c.controlled=true);Object.assign(s.squad[0],{x:21,y:3});
 expect(L.preview(s,'nia','extract',21,3).legal).toBe(false);s.lift.delivered=true;expect(L.preview(s,'nia','extract',21,3).legal).toBe(true);
 for(const pos of [0,1]){s.lift.position=pos;const d=s.lift.stops[pos];const P=SB.Render.projection(1200,750,s,{zoom:1,selected:'nia'});
 for(let y=d.y;y<d.y+2;y++)for(let x=d.x;x<d.x+2;x++){const p=P.point(x,y,L.height(s,x,y));expect(P.inverse(p.x,p.y)).toEqual({x,y});}}
});

test('old five-operation saves preserve records and unlock Cargo Lift',()=>{
 const SB=load(),results={};for(const m of SB.Missions.operations.slice(0,5))results[m.id]={score:2000,turns:10,survivors:4};
 const c=SB.Campaign.normalize({version:1,selected:'rooftop-crossfire',results});expect(c.results).toEqual(results);expect(SB.Campaign.unlocked(c,'cargo-lift')).toBe(true);
});


test('open cargo shaft blocks walking but permits cross-shaft fire; dock walls still block sight',()=>{
 const L=load().Logic,s=L.newGame('cargo-lift');
 expect(L.visible(s,{x:7,y:7},{x:15,y:7})).toBe(true);
 expect(L.blocked(s,11,7)).toBe(true);
 expect(L.cover(s,{x:15,y:7},{x:7,y:7})).toBe(0);
 expect(L.cover(s,{x:15,y:7},{x:15,y:0})).toBe(0);
 expect(L.canStep(s,{x:9,y:7},{x:10,y:7})).toBe(false);
 expect(L.visible(s,{x:4,y:3},{x:4,y:5})).toBe(false);
});


function fixtureWin(SB,id){const s=SB.Logic.newGame(id);s.phase='won';s.rescued=true;s.score=2000;s.turn=8;s.squad.forEach(u=>u.extracted=true);return s;}
test('first clears train survivors and award supplies once; replays cannot farm recovery or XP',()=>{
 const SB=load(),C=SB.Campaign,c=C.fresh(),s=fixtureWin(SB,'live-wire');s.squad[0].hp=2;s.squad[1].hp=0;s.squad[1].extracted=false;
 expect(C.complete(c,s)).toBe(true);expect(c.supplies).toBe(4);expect(c.roster.nia).toMatchObject({xp:1,injury:1});expect(c.roster.sol).toMatchObject({xp:0,injury:2});
 const roster=JSON.stringify(c.roster);s.squad.forEach(u=>{u.hp=u.maxHp;u.extracted=true;});s.score=3000;
 expect(C.complete(c,s)).toBe(true);expect(c.results['live-wire'].score).toBe(3000);expect(JSON.stringify(c.roster)).toBe(roster);expect(c.supplies).toBe(4);
});
test('equipment and treatment reject unavailable choices without mutation and persist earned changes',()=>{
 const SB=load(),C=SB.Campaign,c=C.fresh(),before=JSON.stringify(c);expect(C.equip(c,'nia','optics')).toBe(false);expect(C.treat(c,'nia')).toBe(false);expect(JSON.stringify(c)).toBe(before);
 const s=fixtureWin(SB,'live-wire');s.squad[0].hp=2;C.complete(c,s);expect(C.equip(c,'nia','armor')).toBe(true);expect(C.treat(c,'nia')).toBe(true);expect(c.supplies).toBe(3);expect(c.roster.nia.injury).toBe(0);
 const store=memoryStorage();C.save(store,c);expect(C.load(store).campaign).toEqual(c);expect(C.equip(c,'__proto__','armor')).toBe(false);
});
test('legacy campaign migration grants bounded growth and role perks without changing mission bases',()=>{
 const SB=load(),C=SB.Campaign,results={};for(const m of SB.Missions.operations.slice(0,4))results[m.id]={score:2000,turns:10,survivors:4};
 const c=C.normalize({version:1,selected:'cargo-lift',results});expect(c.roster.nia.xp).toBe(4);expect(c.supplies).toBe(10);expect(C.normalize(c)).toEqual(c);
 C.equip(c,'nia','optics');C.equip(c,'rook','boots');const base=SB.Logic.newGame(),s=C.prepare(c,SB.Logic.newGame());
 expect(s.squad[0].hackRange).toBe(3);expect(s.squad[0].range).toBe(base.squad[0].range+1);expect(s.squad[1].kits).toBe(3);expect(s.squad[2].stride).toBe(base.squad[2].stride+2);expect(s.squad[3].damage).toBe(base.squad[3].damage+1);
 const same=JSON.stringify(s);C.prepare(c,s);expect(JSON.stringify(s)).toBe(same);expect(SB.Logic.newGame()).toEqual(base);
});
test('malformed roster cannot exceed earned XP or supply bounds or equip locked gear',()=>{
 const C=load().Campaign,c=C.fresh();c.roster.nia={xp:999,injury:99,gear:'optics'};c.supplies=Infinity;
 const clean=C.normalize(c);expect(clean.roster.nia).toEqual({xp:0,injury:2,gear:'standard'});expect(clean.supplies).toBe(0);
 c.roster=null;expect(()=>C.normalize(c)).not.toThrow();
});
test('healthy first clear recovers one injury; low-stat equipment still deploys a viable squad',()=>{
 const SB=load(),C=SB.Campaign,c=C.fresh();c.roster.nia.injury=2;C.complete(c,fixtureWin(SB,'live-wire'));expect(c.roster.nia.injury).toBe(1);
 const s=C.prepare(c,SB.Logic.newGame('locked-manifest'));expect(s.squad[0].maxHp).toBe(SB.Logic.newGame('locked-manifest').squad[0].maxHp-2);
 c.roster.nia.injury=2;C.complete(c,fixtureWin(SB,'locked-manifest'));C.equip(c,'nia','optics');const next=C.prepare(c,SB.Logic.newGame('cut-the-feed'));expect(next.squad[0].hp).toBeGreaterThanOrEqual(4);
});


test('clinic protects the announced wing, ends after six assaults, and never resolves a lost mission twice',()=>{
 const L=load().Logic,s=L.newGame('open-clinic');s.enemies=[];s.turret=null;delete s.ambush;
 const before=JSON.stringify(s),d=L.defenseStatus(s);expect(d.lane).toBe('north');expect(JSON.stringify(s)).toBe(before);
 for(let i=0;i<6;i++){const d=L.defenseStatus(s);s.circuits.forEach(c=>c.controlled=c.id===d.circuitId);L.endTurn(s);}
 expect(s.defense.hp).toBe(8);expect(L.defenseStatus(s).done).toBe(true);L.endTurn(s);expect(s.defense.elapsed).toBe(6);
 const bad=L.newGame('open-clinic');bad.enemies=[];bad.turret=null;delete bad.ambush;for(let i=0;i<4;i++)L.endTurn(bad);expect(bad.phase).toBe('lost');const frozen=JSON.stringify(bad);L.endTurn(bad);expect(JSON.stringify(bad)).toBe(frozen);
});
test('clinic extraction is refused until staff survive every assault',()=>{
 const L=load().Logic,s=L.newGame('open-clinic');s.rescued=true;const t=L.extractionStatus(s).tiles[0];Object.assign(s.squad[0],t);
 const before=JSON.stringify(s);expect(L.preview(s,'nia','extract',t.x,t.y).legal).toBe(false);expect(JSON.stringify(s)).toBe(before);s.defense.elapsed=6;expect(L.preview(s,'nia','extract',t.x,t.y).legal).toBe(true);
});
test('antenna lanes alternate, warn before movement, damage only exposed living units and stop after tower capture',()=>{
 const L=load().Logic,s=L.newGame('antenna-rain');s.enemies=[];s.turret=null;
 const first=L.activeLane(s),t=first.tiles[1];first.tiles[1].x=99;expect(L.activeLane(s).tiles[1].x).not.toBe(99);
 const target=L.activeLane(s).tiles[1];Object.assign(s.squad[0],{x:target.x,y:target.y+1});const p=L.preview(s,'nia','move',target.x,target.y);expect(p.legal).toBe(true);expect(p.hazardDamage).toBe(2);order(L,s,'nia','move',target.x,target.y);
 const hp=s.squad[0].hp;L.endTurn(s);expect(s.squad[0].hp).toBe(hp-2);expect(L.activeLane(s).label).not.toBe(first.label);
 s.circuits.find(c=>c.id==='tower').controlled=true;expect(L.activeLane(s)).toBe(null);L.endTurn(s);expect(s.squad[0].hp).toBe(hp-2);
});
test('all thirteen operations support consecutive persisted squad progression with legal orders',()=>{
 const SB=load(),C=SB.Campaign,c=C.fresh(),store=memoryStorage();
 for(const m of SB.Missions.operations){for(const id of ['nia','sol','rook','ivo'])C.treat(c,id);const s=C.prepare(c,SB.Logic.newGame(m.id));campaignRoute(SB,s);expect(s.phase).toBe('won');expect(s.squad.filter(u=>u.extracted)).toHaveLength(4);expect(C.complete(c,s)).toBe(true);C.save(store,c);expect(C.load(store).campaign).toEqual(c);}
 expect(Object.keys(c.results)).toHaveLength(13);expect(c.roster.nia.xp).toBe(13);
});


test('sluice water changes paths while remaining transparent to fire and safe to preview',()=>{
 const L=load().Logic,s=L.newGame('sluice-logic'),u=s.squad[0];
 expect(L.tile(s,11,4)).toBe('w');expect(L.blocked(s,11,4)).toBe(true);
 expect(L.visible(s,{x:9,y:4},{x:13,y:4})).toBe(true);
 Object.assign(u,{x:7,y:5});const before=JSON.stringify(s),p=L.preview(s,'nia','hack',7,4);
 expect(p.legal).toBe(true);expect(JSON.stringify(s)).toBe(before);expect(L.commit(s,p)).toBe(true);
 expect(L.tile(s,11,4)).toBe('.');expect(L.blocked(s,11,11)).toBe(true);
 expect(L.path(s,u,14,4)).not.toBe(null);
});
test('sluice interlocks preserve state and reject flooding allies, hostiles and stale confirmations',()=>{
 const L=load().Logic,s=L.newGame('sluice-logic'),u=s.squad[0];
 Object.assign(u,{x:7,y:10});let before=JSON.stringify(s);
 expect(L.preview(s,'nia','hack',7,11).legal).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s.circuits.find(c=>c.id==='north-drain').controlled=true;s.rescued=true;
 Object.assign(s.squad[1],{x:11,y:4});before=JSON.stringify(s);
 expect(L.preview(s,'nia','hack',7,11).legal).toBe(false);expect(JSON.stringify(s)).toBe(before);
 Object.assign(s.squad[1],{x:6,y:10});const p=L.preview(s,'nia','hack',7,11);expect(p.legal).toBe(true);
 Object.assign(s.enemies[0],{x:11,y:4});before=JSON.stringify(s);
 expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(before);
 Object.assign(s.enemies[0],{x:15,y:5});expect(L.commit(s,p)).toBe(true);
 expect(L.tile(s,11,4)).toBe('w');expect(L.tile(s,11,11)).toBe('.');
});
test('sluice reroute rejects a disconnected engineer and extraction waits for outlet and rescue',()=>{
 const L=load().Logic,s=L.newGame('sluice-logic'),u=s.squad[0];s.rescued=true;
 s.circuits.find(c=>c.id==='north-drain').controlled=true;Object.assign(u,{x:7,y:10});
 Object.assign(s.squad[1],{x:18,y:3});
 // Close the only east-bank joining strip in this explicit disconnected fixture.
 s.rows=s.rows.map((r,y)=>y===8?r.slice(0,13)+'##########'+r.slice(23):r);
 expect(L.preview(s,'nia','hack',7,11).legal).toBe(false);
 const t=L.extractionStatus(s).tiles[0];Object.assign(u,t);expect(L.preview(s,'nia','extract',t.x,t.y).legal).toBe(false);
 s.circuits.find(c=>c.id==='outlet').controlled=true;expect(L.preview(s,'nia','extract',t.x,t.y).legal).toBe(true);
});
test('eight-operation v1 saves retain squad loadouts and unlock Floodworks without fabricated rewards',()=>{
 const SB=load(),C=SB.Campaign,results={};for(const m of SB.Missions.operations.slice(0,8))results[m.id]={score:2000,turns:10,survivors:4};
 const c=C.normalize({version:1,results,selected:'sluice-logic'});expect(C.unlocked(c,'sluice-logic')).toBe(true);expect(c.roster.nia.xp).toBe(8);
 C.equip(c,'nia','armor');c.roster.sol.injury=1;const store=memoryStorage();C.save(store,c);expect(C.load(store).campaign).toEqual(c);expect(c.supplies).toBe(18);
});

test('sluice permits connected east-bank rerouting and route status cannot mutate terrain',()=>{
 const L=load().Logic,s=L.newGame('sluice-logic');s.rescued=true;
 s.circuits.find(c=>c.id==='north-drain').controlled=true;
 Object.assign(s.squad[0],{x:7,y:10});Object.assign(s.squad[1],{x:13,y:5});
 Object.assign(s.squad[2],{x:13,y:10});Object.assign(s.squad[3],{x:15,y:11});
 const status=L.waterStatus(s);status[0].tiles[0].x=99;
 expect(L.waterStatus(s)[0].tiles[0].x).toBe(10);
 const p=L.preview(s,'nia','hack',7,11);expect(p.legal).toBe(true);expect(p.reason).toContain('HOSTILE');expect(L.commit(s,p)).toBe(true);
 for(const u of s.squad)expect(L.path(s,u,7,11)).not.toBe(null);
});


test('moving bridge crosses before rescue, carries offsets and leaves transparent impassable water behind',()=>{
 const L=load().Logic,s=L.newGame('span-control');s.circuits[0].controlled=true;
 for(const [i,u] of s.squad.entries())Object.assign(u,{x:8+i%2,y:6+Math.floor(i/2)});
 const before=JSON.stringify(s),p=L.preview(s,'nia','hack',8,6);expect(p.legal).toBe(true);expect(JSON.stringify(s)).toBe(before);expect(p.reason).not.toMatch(/medical/);
 expect(L.commit(s,p)).toBe(true);expect(s.rescued).toBe(false);expect(s.lift.delivered).toBe(true);
 expect(s.squad.map(u=>[u.x,u.y])).toEqual([[14,6],[15,6],[14,7],[15,7]]);
 expect(L.tile(s,8,6)).toBe('w');expect(L.blocked(s,8,6)).toBe(true);expect(L.visible(s,{x:7,y:8},{x:16,y:8})).toBe(true);
 const frozen=JSON.stringify(s);expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(frozen);
 expect(L.objectiveStatus(s).map(o=>o.label).join(' ')).not.toMatch(/medical|clinic/);
});

test('bridge empty recall never earns delivery, and occupied or hostile decks reject without AP loss',()=>{
 const L=load().Logic,s=L.newGame('span-control');s.circuits[0].controlled=true;Object.assign(s.squad[0],{x:7,y:4});
 order(L,s,'nia','hack',7,5);expect(s.lift.position).toBe(1);expect(s.lift.delivered).toBe(false);
 const recall=L.preview(s,'nia','hack',7,5);expect(recall.legal).toBe(true);Object.assign(s.enemies[0],{x:8,y:6});
 let before=JSON.stringify(s);expect(L.commit(s,recall)).toBe(false);expect(JSON.stringify(s)).toBe(before);
 Object.assign(s.enemies[0],{x:14,y:6});before=JSON.stringify(s);expect(L.preview(s,'nia','hack',7,5).legal).toBe(false);expect(JSON.stringify(s)).toBe(before);
});

test('bridge capture enforces rescue and correct dock; stale circuit confirmation is immutable',()=>{
 const L=load().Logic,s=L.newGame('span-control'),u=s.squad[0],head=s.circuits[1],release=s.circuits[2];
 Object.assign(u,{x:20,y:9});expect(L.preview(s,'nia','hack',head.x,head.y).legal).toBe(false);
 s.rescued=true;expect(L.preview(s,'nia','hack',head.x,head.y).legal).toBe(false);s.lift.position=1;
 const p=L.preview(s,'nia','hack',head.x,head.y);expect(p.legal).toBe(true);s.lift.position=0;let before=JSON.stringify(s);expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(before);
 s.lift.position=1;order(L,s,'nia','hack',head.x,head.y);Object.assign(u,{x:5,y:4,ap:2});expect(L.preview(s,'nia','hack',release.x,release.y).legal).toBe(false);
 s.lift.position=0;expect(L.preview(s,'nia','hack',release.x,release.y).legal).toBe(false);s.lift.delivered=true;
 order(L,s,'nia','hack',release.x,release.y);expect(L.doorOpen(s,20,12)).toBe(true);
});

test('nine-operation saves retain progress and unlock Span Control without unlocking planned Blackout',()=>{
 const SB=load(),C=SB.Campaign,results={};for(const m of SB.Missions.operations.slice(0,9))results[m.id]={score:2000,turns:10,survivors:4};
 const c=C.normalize({version:1,results,selected:'span-control'});expect(C.unlocked(c,'span-control')).toBe(true);expect(C.unlocked(c,'blackout')).toBe(false);expect(c.roster.nia.xp).toBe(9);
 const store=memoryStorage();C.save(store,c);expect(C.load(store).campaign).toEqual(c);
});


test('blackout lamps couple target detection, service access and turret allegiance without mutating previews',()=>{
 const L=load().Logic,s=L.newGame('blackout'),u=s.squad[0];
 expect(L.lit(s,13,9)).toBe(true);expect(L.lit(s,2,12)).toBe(false);
 expect(L.doorOpen(s,9,13)).toBe(false);expect(L.turretAllied(s)).toBe(false);
 Object.assign(u,{x:5,y:13});const before=JSON.stringify(s),p=L.preview(s,'nia','hack',6,12);
 expect(p.legal).toBe(true);expect(p.reason).toMatch(/lamps OFF/);expect(JSON.stringify(s)).toBe(before);expect(L.commit(s,p)).toBe(true);
 expect(L.lit(s,13,9)).toBe(false);expect(L.doorOpen(s,9,13)).toBe(true);expect(L.turretAllied(s)).toBe(true);
 expect(L.detected(s,{x:10,y:9},{x:12,y:9})).toBe(true);expect(L.detected(s,{x:10,y:9},{x:13,y:9})).toBe(false);
 const move=L.preview(s,'nia','move',6,13);expect(move.illuminated).toBe(false);expect(move.reason).toMatch(/DARK/);
});
test('blackout dark patrols idle without omniscient pursuit; lamps permit acquisition through clear sight',()=>{
 const L=load().Logic,s=L.newGame('blackout');s.turret=null;s.circuits[0].controlled=false;
 s.enemies=[{id:'watcher',name:'Watcher',x:13,y:9,hp:6,maxHp:6,damage:2,range:5,stride:1}];
 s.squad.forEach((u,i)=>Object.assign(u,{x:8,y:8+i}));
 const e=s.enemies[0],hp=s.squad.map(u=>u.hp);L.endTurn(s);expect([e.x,e.y]).toEqual([13,9]);expect(s.squad.map(u=>u.hp)).toEqual(hp);
 s.circuits[0].controlled=true;Object.assign(s.squad[0],{x:10,y:9});expect(L.visible(s,e,s.squad[0])).toBe(true);L.endTurn(s);expect(s.squad[0].hp).toBeLessThan(hp[0]);
});
test('blackout queued shots revalidate darkness and preserve state on rejection; geometric signals keep engineer range',()=>{
 const L=load().Logic,s=L.newGame('blackout'),u=s.squad[0],e=s.enemies[0];Object.assign(u,{x:10,y:9});Object.assign(e,{x:13,y:9});
 const shot=L.preview(s,'nia','attack',13,9);expect(shot.legal).toBe(true);s.circuits[0].controlled=false;
 const before=JSON.stringify(s);expect(L.commit(s,shot)).toBe(false);expect(JSON.stringify(s)).toBe(before);expect(L.preview(s,'nia','attack',13,9).reason).toMatch(/darkness/);
 Object.assign(u,{x:3,y:12,hackRange:3});expect(L.preview(s,'nia','hack',6,12).legal).toBe(true);
});
test('blackout archive capture requires rescue and darkness; relighting invalidates queued capture',()=>{
 const L=load().Logic,s=L.newGame('blackout'),u=s.squad[0];Object.assign(u,{x:19,y:4});s.circuits[0].controlled=false;s.circuits[1].controlled=true;
 expect(L.preview(s,'nia','hack',20,4).legal).toBe(false);s.rescued=true;const p=L.preview(s,'nia','hack',20,4);expect(p.legal).toBe(true);
 s.circuits[0].controlled=true;const before=JSON.stringify(s);expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(before);
 expect(L.preview(s,'nia','hack',20,4).reason).toMatch(/Blackout interlock/);
 s.circuits[0].controlled=false;expect(L.commit(s,p)).toBe(true);
});
test('ten-clear v1 saves retain roster and unlock Blackout without inventing a clear',()=>{
 const SB=load(),C=SB.Campaign,results={};for(const m of SB.Missions.operations.slice(0,10))results[m.id]={score:2000,turns:10,survivors:4};
 const c=C.normalize({version:1,results,selected:'blackout'});expect(C.unlocked(c,'blackout')).toBe(true);expect(c.roster.nia.xp).toBe(10);expect(c.results.blackout).toBeUndefined();expect(C.normalize(c)).toEqual(c);
});

function pumpFixture() {
 const SB=load(),L=SB.Logic,s=L.newGame('pump-siege');
 s.enemies=[];s.ambush=null;s.turret=null;
 s.circuits.forEach(c=>c.controlled=true);
 Object.assign(s.squad[0],{x:6,y:6});Object.assign(s.squad[2],{x:17,y:6});
 return {SB,L,s};
}
test('pump staffing is cardinal, powered and living; previews and status are readonly',()=>{
 const {L,s}=pumpFixture(),before=JSON.stringify(s);
 expect(L.pumpStatus(s).ready).toBe(true);L.objectiveStatus(s);L.preview(s,'nia','watch',6,6);
 expect(JSON.stringify(s)).toBe(before);
 s.squad[2].x=18;s.squad[2].y=7;expect(L.pumpStatus(s).ready).toBe(false);
 s.squad[2].y=6;expect(L.pumpStatus(s).ready).toBe(true);
 s.squad[2].hp=0;expect(L.pumpStatus(s).ready).toBe(false);
 s.squad[2].hp=6;s.squad[2].extracted=true;expect(L.pumpStatus(s).ready).toBe(false);
 s.squad[2].extracted=false;s.circuits[1].controlled=false;expect(L.pumpStatus(s).ready).toBe(false);
});
test('pump pressure requires consecutive end turns, resets and permanently scores once',()=>{
 const {L,s}=pumpFixture();L.endTurn(s);expect(s.pumps.elapsed).toBe(1);
 s.squad[2].y=8;L.endTurn(s);expect(s.pumps.elapsed).toBe(0);
 s.squad[2].y=6;for(let i=0;i<3;i++)L.endTurn(s);
 expect(L.pumpStatus(s).done).toBe(true);expect(s.score).toBe(500);
 s.squad[2].y=8;L.endTurn(s);expect(s.pumps.elapsed).toBe(3);expect(s.score).toBe(500);
});
test('enemy fire downs a pump operator before the pressure check',()=>{
 const {L,s}=pumpFixture();s.pumps.elapsed=2;s.squad[2].hp=1;
 s.enemies=[{id:'pressure-raider',name:'Raider',x:18,y:6,hp:6,maxHp:6,damage:3,range:4,stride:2}];
 L.endTurn(s);expect(s.squad[2].hp).toBe(0);expect(s.pumps.elapsed).toBe(0);
});
test('pump extraction revalidates pressure and frozen states cannot advance cycles',()=>{
 const {L,s}=pumpFixture(),u=s.squad[1];s.rescued=true;Object.assign(u,{x:20,y:14});
 expect(L.preview(s,u.id,'extract',u.x,u.y).legal).toBe(false);
 s.pumps.elapsed=3;const p=L.preview(s,u.id,'extract',u.x,u.y);expect(p.legal).toBe(true);
 s.pumps.elapsed=2;const before=JSON.stringify(s);expect(L.commit(s,p)).toBe(false);expect(JSON.stringify(s)).toBe(before);
 for(const phase of ['won','lost']){s.phase=phase;const frozen=JSON.stringify(s);L.endTurn(s);expect(JSON.stringify(s)).toBe(frozen);}
});
test('eleven-clear v1 saves unlock Pump Siege while retaining earned roster and records',()=>{
 const SB=load(),C=SB.Campaign,results={};for(const m of SB.Missions.operations.slice(0,11))results[m.id]={score:2000,turns:10,survivors:4};
 const c=C.normalize({version:1,results,selected:'pump-siege'});
 expect(C.unlocked(c,'pump-siege')).toBe(true);expect(c.roster.nia.xp).toBe(11);
 expect(c.results['pump-siege']).toBeUndefined();expect(C.normalize(c)).toEqual(c);
});

function archiveFixture() {
 const SB=load(),L=SB.Logic,s=L.newGame('paper-trail');s.enemies=[];
 return {SB,L,s,breaker:s.circuits.find(c=>c.id===s.archive.delayCircuit),evidence:s.circuits.find(c=>c.id===s.archive.evidenceCircuit)};
}
test('the optional Archive breaker opens only its route, allies the turret and buys three end turns once',()=>{
 const {L,s,breaker}=archiveFixture(),u=s.squad[0];Object.assign(u,{x:breaker.x-1,y:breaker.y});
 expect(L.archiveStatus(s)).toMatchObject({deadline:9,remaining:9,delayed:false,secured:false,purged:false});
 expect(L.doorOpen(s,11,5)).toBe(false);expect(L.turretAllied(s)).toBe(false);
 const snapshot=JSON.stringify(s);L.archiveStatus(s).breaker.x=99;L.objectiveStatus(s);
 expect(L.preview(s,u.id,'hack',breaker.x,breaker.y).legal).toBe(true);expect(JSON.stringify(s)).toBe(snapshot);
 order(L,s,u.id,'hack',breaker.x,breaker.y);
 expect(L.archiveStatus(s)).toMatchObject({deadline:12,remaining:12,delayed:true});
 expect(L.doorOpen(s,11,5)).toBe(true);expect(L.doorOpen(s,11,10)).toBe(false);expect(L.turretAllied(s)).toBe(true);
 expect(L.preview(s,u.id,'hack',breaker.x,breaker.y).legal).toBe(false);expect(s.score).toBe(500);
});
test.each([false,true])('Archive deadline is inclusive, then irreversible if the evidence was not copied (breaker=%s)', delayed=>{
 const {L,s,breaker,evidence}=archiveFixture(),u=s.squad[0];s.turret=null;
 if(delayed){Object.assign(u,{x:breaker.x-1,y:breaker.y});order(L,s,u.id,'hack',breaker.x,breaker.y);}
 const deadline=delayed?12:9;
 while(s.turn<deadline&&s.phase==='player')L.endTurn(s);
 expect(s.phase).toBe('player');expect(L.archiveStatus(s).remaining).toBe(1);
 Object.assign(u,{x:evidence.x,y:evidence.y});const pending=L.preview(s,u.id,'hack',evidence.x,evidence.y);expect(pending.legal).toBe(true);
 const saved=JSON.parse(JSON.stringify(s));expect(L.commit(saved,pending)).toBe(true);L.endTurn(saved);
 expect(L.archiveStatus(saved)).toMatchObject({secured:true,purged:false,remaining:0});expect(saved.phase).toBe('player');expect(saved.turn).toBe(deadline+1);
 expect(L.preview(saved,u.id,'hack',evidence.x,evidence.y).legal).toBe(false);
 L.endTurn(s);expect(s.phase).toBe('lost');expect(s.turn).toBe(deadline);expect(L.archiveStatus(s)).toMatchObject({purged:true,remaining:0});
 const frozen=JSON.stringify(s);expect(L.commit(s,pending)).toBe(false);expect(L.endTurn(s)).toBe(false);expect(JSON.stringify(s)).toBe(frozen);
});
test('Paper Trail short route can win against live AI without delaying the purge or taking the turret',()=>{
 const {SB}=archiveFixture(),L=SB.Logic,s=L.newGame('paper-trail');
 const actions=require('../tools/signalbreak-route.cjs').run(SB,s,350,{directArchive:true});
 expect(s.phase).toBe('won');expect(s.squad.filter(u=>u.extracted)).toHaveLength(4);
 expect(L.archiveStatus(s)).toMatchObject({secured:true,delayed:false});expect(L.turretAllied(s)).toBe(false);
 const {x,y}=L.archiveStatus(s).evidence;expect(actions.find(p=>p.kind==='hack'&&p.x===x&&p.y===y).turn).toBeLessThanOrEqual(9);
});
test('twelve-clear v1 saves unlock Paper Trail without inventing Archive evidence or a clear',()=>{
 const SB=load(),C=SB.Campaign,results={};for(const m of SB.Missions.operations.slice(0,12))results[m.id]={score:3000,turns:10,survivors:4};
 const c=C.normalize({version:1,results,selected:'paper-trail'});
 expect(C.unlocked(c,'paper-trail')).toBe(true);expect(c.roster.nia.xp).toBe(12);expect(c.results['paper-trail']).toBeUndefined();
});
test('extending the Archive deadline invalidates a queued evidence order without spending AP',()=>{
 const {L,s,breaker,evidence}=archiveFixture(),[nia,sol]=s.squad;
 Object.assign(nia,{x:evidence.x,y:evidence.y});Object.assign(sol,{x:breaker.x-1,y:breaker.y});
 const old=L.preview(s,nia.id,'hack',evidence.x,evidence.y);expect(old.legal).toBe(true);
 order(L,s,sol.id,'hack',breaker.x,breaker.y);
 const snapshot=JSON.stringify(s);expect(L.commit(s,old)).toBe(false);expect(JSON.stringify(s)).toBe(snapshot);
 order(L,s,nia.id,'hack',evidence.x,evidence.y);expect(L.archiveStatus(s).secured).toBe(true);
});
