// State-informed QA route planner. It issues only public legal orders; it never
// edits tactical state. These routes prove solvability, not human play or balance.
function nextOrder(SB, s) {
  const L = SB.Logic, live = s.squad.filter(L.living);
  const bridge=s.lift&&s.lift.kind==='bridge';
  let bridgeGoal;
  if(bridge){
    const drive=s.circuits.find(c=>c.id==='span-drive'),head=s.circuits.find(c=>c.id==='bridgehead'),release=s.circuits.find(c=>c.id==='west-release');
    bridgeGoal=!drive.controlled?drive:!s.rescued?s.rescue:!head.controlled?head:!release.controlled?release:null;
  }
  const bridgeDestination=bridge&&(bridgeGoal&&bridgeGoal.x<8?0:1);
  const boardingLift=s.lift && s.circuits.find(c=>c.id===s.lift.poweredBy).controlled && (bridge?s.lift.position!==bridgeDestination:s.rescued&&!s.lift.delivered);
  if(boardingLift){
    const dock=s.lift.stops[s.lift.position];
    const inward=bridge&&s.lift.position===1?-1:1;
    for(const u of live)if(L.liftAt(s,u.x,u.y)&&(inward===1?u.x<dock.x+s.lift.size-1:u.x>dock.x)){
      const p=L.preview(s,u.id,'move',u.x+inward,u.y);if(p.legal)return p;
    }
  }
  if(boardingLift && live.every(u=>L.liftAt(s,u.x,u.y))){
    const rider=live.find(u=>u.ap>0),dock=s.lift.stops[s.lift.position];
    if(rider){const p=L.preview(s,rider.id,'hack',dock.x,dock.y);if(p.legal)return p;}
    return {kind:'end'};
  }
  const defense=s.defense&&L.defenseStatus(s);
  if(defense&&!defense.done&&!defense.protected){
    const node=s.circuits.find(c=>c.id===defense.circuitId);
    for(const u of live){const p=L.preview(s,u.id,'hack',node.x,node.y);if(p.legal)return p;}
    const nia=live.find(u=>u.id==='nia');
    if(nia&&nia.ap){const p=L.preview(s,nia.id,'move',10,7);if(p.legal)return p;}
  }
  let goal;
  if (bridge) goal=bridgeGoal;
  else if(s.lighting){
    const dark=s.circuits.find(c=>c.id==='blackout'),link=s.circuits.find(c=>c.id==='archive-link');
    goal=!dark.controlled?dark:!s.rescued?s.rescue:!link.controlled?link:null;
  }
  else if (s.id === 'locked-manifest') {
    const [prison, evac] = s.circuits;
    if (!s.rescued) goal = prison.controlled ? s.rescue : prison;
    else if (live.some(u => u.x >= 10 && u.y <= 6)) goal = { x: 9, y: 4, regroup: true };
    else if (!evac.controlled) goal = evac;
  } else if (s.water) {
    const north=s.circuits.find(c=>c.id==='north-drain'),south=s.circuits.find(c=>c.id==='south-drain'),outlet=s.circuits.find(c=>c.id==='outlet');
    if(!s.rescued) goal=north.controlled?s.rescue:north;
    else if(!south.controlled) goal=south;
    else if(!outlet.controlled) goal=outlet;
  } else if (s.defense) goal=null;
  else if (s.lift && !s.lift.delivered) goal = !s.circuits[0].controlled?s.circuits[0]:!s.rescued?s.rescue:null;
  else if (s.circuits) goal = s.circuits.find(c => !c.controlled);
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
  const commonGoal=goal;
  // Pair the medic and heavy on the exposed east bank; Rook supports Nia west.
  const acting=s.pumps?live.slice().sort((a,b)=>['nia','sol','ivo','rook'].indexOf(a.id)-['nia','sol','ivo','rook'].indexOf(b.id)):live;
  for (const u of acting) {
    if (!u.ap) continue;
    const pumping=s.pumps&&s.pumps.elapsed<s.pumps.rounds;
    const pump=pumping?s.circuits.find(c=>c.id===s.pumps.circuitIds[['nia','rook'].includes(u.id)?0:1]):null;
    const goal=pump||commonGoal;
    const extract=L.preview(s,u.id,'extract',u.x,u.y);if(extract.legal)return extract;
    if (u.role==='MEDIC') for (const ally of live.filter(a=>a.hp<=a.maxHp-4)) {
      const heal=L.preview(s,u.id,'heal',ally.x,ally.y);if(heal.legal)return heal;
    }
    const attacks=s.enemies.filter(L.living).map(e=>L.preview(s,u.id,'attack',e.x,e.y)).filter(p=>p.legal).sort((a,b)=>b.damage-a.damage);
    if (attacks.length) return attacks[0];
    if(pump&&pump.controlled&&Math.abs(u.x-pump.x)+Math.abs(u.y-pump.y)<=1){
      const watch=L.preview(s,u.id,'watch',u.x,u.y);if(watch.legal)return watch;
      continue;
    }
    if(defense&&!defense.done&&u.id==='nia'){const watch=L.preview(s,u.id,'watch',u.x,u.y);if(watch.legal)return watch;continue;}
    if(goal) {
      const kind=goal===s.rescue?'rescue':goal.regroup?null:'hack';
      if(kind){const p=L.preview(s,u.id,kind,goal.x,goal.y);if(p.legal)return p;}
    }
    let target=goal;
    if(boardingLift){
      if(L.liftAt(s,u.x,u.y))continue;
      const dock=s.lift.stops[s.lift.position],free=[];
      const xs=bridge&&s.lift.position===1?[dock.x,dock.x+1]:[dock.x+1,dock.x];
      for(const x of xs)for(let y=dock.y;y<dock.y+s.lift.size;y++)
        if(!L.occupant(s,x,y)&&L.path(s,u,x,y))free.push({x,y});
      if(!free.length)continue;
      target=free[0];
    }
    if (goal && goal.regroup && !(u.x>=10&&u.y<=6)) target=s.circuits[1];
    if (!target) target=exits.slice().sort((a,b)=>Math.abs(u.x-a.x)+Math.abs(u.y-a.y)-Math.abs(u.x-b.x)-Math.abs(u.y-b.y))[0];
    const map=distances(target), current=map[u.x+','+u.y];let best=null;
    for(let y=1;y<s.height-1;y++) for(let x=1;x<s.width-1;x++) {
      const p=L.preview(s,u.id,'move',x,y);if(!p.legal)continue;
      const dist=map[x+','+y];if(dist===undefined||dist>=current)continue;
      const value=dist*10+p.cost-L.cover(s,{x,y},target)*.25+(p.hazardDamage?100:0);
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
