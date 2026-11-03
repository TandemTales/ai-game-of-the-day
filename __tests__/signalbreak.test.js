const fs = require('fs'), path = require('path'), vm = require('vm');
function load() {
  const window = {};
  const context = vm.createContext({ window, Math, JSON, Number, Array, Object });
  for (const file of ['missions', 'logic']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../signalbreak/assets/js/' + file + '.js'), 'utf8'), context);
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
test('full manifest is five districts and twenty distinct promised operations, only opening is implemented', () => {
  const SB=load();expect(SB.Missions.manifest).toHaveLength(5);
  const names=SB.Missions.manifest.flatMap(d=>Array.from(d).slice(1));expect(new Set(names).size).toBe(20);
  expect(SB.Missions.opening.title).toBe('Live Wire');
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
