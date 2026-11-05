// State-informed QA route planner. It issues only public legal orders; it never
// edits tactical state. These routes prove solvability, not human play or balance.
function nextOrder(SB, s) {
  const L = SB.Logic, live = s.squad.filter(L.living);
  let goal;
  if (s.id === 'locked-manifest') {
    const [prison, evac] = s.circuits;
    if (!s.rescued) goal = prison.controlled ? s.rescue : prison;
    else if (live.some(u => u.x >= 10 && u.y <= 6)) goal = { x: 9, y: 4, regroup: true };
    else if (!evac.controlled) goal = evac;
  } else if (s.circuits) goal = s.circuits.find(c => !c.controlled);
  else if (!s.network) goal = s.node;
  if (!goal && !s.rescued) goal = s.rescue;
  const exits = [];
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (L.tile(s,x,y) === 'e') exits.push({x,y});
  function distances(target) {
    const q = [target], map = { [target.x+','+target.y]: 0 };
    for (let i=0;i<q.length;i++) for (const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const x=q[i].x+dx,y=q[i].y+dy,key=x+','+y;
      if (map[key] !== undefined || L.blocked(s,x,y) || (L.canStep && !L.canStep(s,{x,y},q[i]))) continue;
      map[key]=map[q[i].x+','+q[i].y]+1;q.push({x,y});
    }
    return map;
  }
  for (const u of live) {
    if (!u.ap) continue;
    const extract=L.preview(s,u.id,'extract',u.x,u.y);if(extract.legal)return extract;
    if (u.role==='MEDIC') for (const ally of live.filter(a=>a.hp<=a.maxHp-4)) {
      const heal=L.preview(s,u.id,'heal',ally.x,ally.y);if(heal.legal)return heal;
    }
    const attacks=s.enemies.filter(L.living).map(e=>L.preview(s,u.id,'attack',e.x,e.y)).filter(p=>p.legal).sort((a,b)=>b.damage-a.damage);
    if (attacks.length) return attacks[0];
    if(goal) {
      const kind=goal===s.rescue?'rescue':goal.regroup?null:'hack';
      if(kind){const p=L.preview(s,u.id,kind,goal.x,goal.y);if(p.legal)return p;}
    }
    let target=goal;
    if (goal && goal.regroup && !(u.x>=10&&u.y<=6)) target=s.circuits[1];
    if (!target) target=exits.slice().sort((a,b)=>Math.abs(u.x-a.x)+Math.abs(u.y-a.y)-Math.abs(u.x-b.x)-Math.abs(u.y-b.y))[0];
    const map=distances(target), current=map[u.x+','+u.y];let best=null;
    for(let y=1;y<s.height-1;y++) for(let x=1;x<s.width-1;x++) {
      const p=L.preview(s,u.id,'move',x,y);if(!p.legal)continue;
      const dist=map[x+','+y];if(dist===undefined||dist>=current)continue;
      const value=dist*10+p.cost-L.cover(s,{x,y},target)*.25;
      if(!best||value<best.value)best={value,p};
    }
    if(best)return best.p;
  }
  return {kind:'end'};
}
function run(SB, s, limit=350) {
  const actions=[];
  for(let i=0;i<limit&&s.phase==='player';i++) {
    const p=nextOrder(SB,s);actions.push({actorId:p.actorId,kind:p.kind,x:p.x,y:p.y,turn:s.turn});
    if(p.kind==='end')SB.Logic.endTurn(s);
    else if(!SB.Logic.commit(s,p))throw Error('Planner issued an invalid order');
  }
  return actions;
}
module.exports={nextOrder,run};
