(function(global){
  'use strict';
  var SB=global.SB,L=SB.Logic,A=SB.Audio,canvas=document.getElementById('map'),panel=document.getElementById('panel');
  var C=SB.Campaign,storage=null;try{storage=global.localStorage;}catch(e){}
  var saved=C.load(storage),campaign=saved.campaign,saveAvailable=saved.available;
  var state=C.prepare(campaign,L.newGame(campaign.selected)),mode='title',action='move',preview=null,submitted=false,serial=state.serial;
  var view={selected:'nia',zoom:1,panX:0,panY:0,reachable:{},preview:null},projection=null,cursor={x:2,y:4};
  function el(id){return document.getElementById(id);}
  function persist(){saveAvailable=C.save(storage,campaign);}
  function operationMenu(){
    el('operations').innerHTML='';SB.Missions.operations.forEach(function(m,i){
      var b=document.createElement('button'),r=campaign.results[m.id];b.type='button';b.dataset.mission=m.id;
      b.textContent=String(i+1).padStart(2,'0')+' / '+m.title+(r?' · BEST '+r.score:'');
      b.disabled=!C.unlocked(campaign,m.id)||mode==='playing'||mode==='paused';
      b.setAttribute('aria-pressed',String(state.id===m.id));
      if(!C.unlocked(campaign,m.id))b.textContent+=' · LOCKED';
      b.addEventListener('click',function(){briefing(m.id);});el('operations').appendChild(b);
    });
    el('save-status').textContent=saveAvailable?'Progress saved on this browser between operations. Mid-operation orders are not saved.':'Saving unavailable. Progress lasts only in this tab; mid-operation orders are not saved.';
  }
  function preparation(){
    var box=el('loadouts');box.innerHTML='';
    el('prep-summary').textContent='SQUAD PREPARATION / '+campaign.supplies+' medical supplies';
    el('scope-status').textContent='First playable: '+SB.Missions.operations.length+' of 20 authored operations. Further districts and finale in development.';
    state.squad.forEach(function(u){
      var row=document.createElement('div');row.className='loadout';
      var label=document.createElement('label');label.htmlFor='gear-'+u.id;label.textContent=u.name+' / '+C.describe(campaign,u.id);row.appendChild(label);
      var select=document.createElement('select');select.id='gear-'+u.id;select.dataset.gear=u.id;select.disabled=mode!=='title';
      C.equipment.forEach(function(g){var o=document.createElement('option');o.value=g.id;o.textContent=g.label+' / '+g.description+(campaign.roster[u.id].xp<g.minXp?' / requires '+g.minXp+' XP':'');o.disabled=campaign.roster[u.id].xp<g.minXp;select.appendChild(o);});
      select.value=campaign.roster[u.id].gear;
      select.addEventListener('change',function(){if(mode==='title'&&C.equip(campaign,u.id,select.value)){persist();state=C.prepare(campaign,L.newGame(state.id));reachable();hud();}});row.appendChild(select);
      var heal=document.createElement('button');heal.type='button';heal.dataset.treat=u.id;heal.textContent='Treat injury / 1 supply';heal.disabled=mode!=='title'||!campaign.roster[u.id].injury||campaign.supplies<1;
      heal.addEventListener('click',function(){if(mode==='title'&&C.treat(campaign,u.id)){persist();state=C.prepare(campaign,L.newGame(state.id));hud();}});row.appendChild(heal);
      var stats=document.createElement('small');stats.textContent='Deploy: '+u.maxHp+' HP / '+u.stride+' move / '+u.range+' range / '+u.damage+' damage';row.appendChild(stats);box.appendChild(row);
    });
  }
  function missionHeader(){
    el('mission-label').textContent=state.district.toUpperCase()+' / OPERATION '+String(state.sequence||1).padStart(2,'0');
    el('mission-title').textContent=state.title;
  }
  function briefing(id){
    if(!C.unlocked(campaign,id))return;
    campaign.selected=id;persist();state=C.prepare(campaign,L.newGame(id));serial=state.serial;mode='title';preview=null;view.selected='nia';view.zoom=1;view.panX=0;view.panY=0;
    panel.hidden=false;el('kicker').textContent='FIRST PLAYABLE / '+SB.Missions.operations.length+' OF 20 OPERATIONS';
    el('title').textContent=state.title;el('copy').textContent=state.briefing;el('tip').textContent=state.radio;
    el('start').textContent='DEPLOY SQUAD ↗';el('next-operation').hidden=true;missionHeader();reachable();hud();
  }
  function resize(){var r=canvas.getBoundingClientRect(),d=Math.min(global.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*d));canvas.height=Math.max(1,Math.round(r.height*d));}
  global.addEventListener('resize',resize);if(global.ResizeObserver)new global.ResizeObserver(resize).observe(canvas);resize();
  function selected(){return L.unit(state,view.selected);}
  function reachable(){
    view.reachable={};var u=selected();if(!u||!L.living(u)||mode!=='playing')return;
    for(var y=1;y<state.height-1;y++)for(var x=1;x<state.width-1;x++){
      if(Math.abs(x-u.x)+Math.abs(y-u.y)>u.stride*u.ap)continue;
      var p=L.preview(state,u.id,'move',x,y);if(p.legal)view.reachable[x+','+y]=p.cost;
    }
  }
  function hud(){
    el('turn').textContent=String(state.turn).padStart(2,'0');el('score').textContent=state.score.toLocaleString();
    el('phase').textContent=mode==='playing'?'YOUR TURN':mode==='paused'?'PAUSED':state.phase==='won'?'EXTRACTED':mode==='title'?'AWAITING DEPLOY':'SIGNAL LOST';
    el('squad').innerHTML='';state.squad.forEach(function(u,i){
      var b=document.createElement('button');b.type='button';b.className='unit'+(u.id===view.selected?' selected':'');b.dataset.unit=u.id;
      b.style.setProperty('--unit',u.color);b.disabled=!L.living(u)||mode!=='playing';b.setAttribute('aria-pressed',String(u.id===view.selected));
      b.innerHTML='<span><strong>'+(i+1)+' / '+u.name+'</strong><span class="role">'+u.role+'</span></span><span class="vitals">'+u.hp+'/'+u.maxHp+' HP<span>'+(u.extracted?'SAFE':u.hp<=0?'DOWN':u.watch?'WATCH':u.ap+' AP')+'</span></span>';
      b.addEventListener('click',function(){select(u.id);});el('squad').appendChild(b);
    });
    el('objective-list').innerHTML='';L.objectiveStatus(state).forEach(function(o){var p=document.createElement('p');p.textContent=(o.done?'✓ ':'○ ')+o.label;p.classList.toggle('done',o.done);el('objective-list').appendChild(p);});
    el('network-status').textContent=state.circuits?state.circuits.map(function(n,i){return (i+1)+' / '+n.label+': '+(n.controlled?'DONE':'PENDING');}).join(' · '):state.network?'ALLIED / DOOR OPEN':'HOSTILE / DOOR LOCKED';el('network-status').style.color=state.network?'#9be1d3':'';
    el('network-links').textContent=state.objectiveSummary||'Linked: security door · turret · lights';
    el('mastery-goal').textContent='MASTERY / '+(state.mastery||'Extract all four engineers in eight turns or fewer.');
    el('radio').textContent=state.log.slice(-2).join(' / ');
    el('preview').textContent=preview?preview.reason:mode==='playing'?selected().name+' / '+selected().ap+' AP · select a tile, then confirm.':mode==='end'?'Operation ended. Select an unlocked operation above or replay.':mode==='paused'?'Operation paused. Resume when ready.':'Choose an unlocked operation, then deploy.';
    el('confirm').disabled=mode!=='playing'||!preview||!preview.legal;el('cancel').disabled=mode!=='playing'||!preview;
    el('end-turn').disabled=mode!=='playing';el('pause').disabled=mode==='title'||mode==='end';
    document.querySelectorAll('[data-action]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.action===action));b.disabled=mode!=='playing'||!L.living(selected())||selected().ap<1;});
    view.preview=preview;operationMenu();preparation();
  }
  function select(id){if(mode!=='playing')return;var u=L.unit(state,id);if(!u||!L.living(u))return;view.selected=id;cursor={x:u.x,y:u.y};view.panX=0;view.panY=0;preview=null;action='move';reachable();hud();}
  function setPreview(kind,x,y){if(mode!=='playing')return;preview=L.preview(state,view.selected,kind,x,y);cursor={x:x,y:y};hud();}
  function chooseAction(kind){
    if(mode!=='playing')return;action=kind;preview=null;var u=selected();
    if(kind==='watch'||kind==='extract')setPreview(kind,u.x,u.y);
    else if(kind==='hack'){
      var nodes=(state.circuits||[state.node]).filter(function(n){return !n.controlled;});
      if(state.lift){
        var dock=state.lift.stops[state.lift.position];
        nodes=nodes.concat(state.lift.stops.map(function(stop){return stop.console;}),[{x:dock.x,y:dock.y}]);
      }
      nodes.sort(function(a,b){var pa=L.preview(state,u.id,'hack',a.x,a.y),pb=L.preview(state,u.id,'hack',b.x,b.y);return Number(pb.legal)-Number(pa.legal)+Math.sign(Math.abs(a.x-u.x)+Math.abs(a.y-u.y)-Math.abs(b.x-u.x)-Math.abs(b.y-u.y))*.1;});
      var node=nodes[0]||state.node;setPreview(kind,node.x,node.y);
    }
    else if(kind==='rescue')setPreview(kind,state.rescue.x,state.rescue.y);
    else if(kind==='attack'){var enemy=state.enemies.filter(L.living).sort(function(a,b){return Math.abs(a.x-u.x)+Math.abs(a.y-u.y)-Math.abs(b.x-u.x)-Math.abs(b.y-u.y);})[0];if(enemy)setPreview(kind,enemy.x,enemy.y);}
    hud();
  }
  function clickTile(x,y){
    if(mode!=='playing')return;
    var u=state.squad.find(function(u){return L.living(u)&&u.x===x&&u.y===y;});
    if(u&&action==='move'){select(u.id);return;}
    var kind=action;
    if(action==='move'){
      if(state.enemies.some(function(e){return L.living(e)&&e.x===x&&e.y===y;}))kind='attack';
      else if((L.circuitAt(state,x,y)||state.lift&&state.lift.stops.some(function(stop){return stop.console.x===x&&stop.console.y===y;})||x===state.node.x&&y===state.node.y)&&L.preview(state,view.selected,'hack',x,y).legal)kind='hack';
      else if(x===state.rescue.x&&y===state.rescue.y&&!state.rescued&&L.preview(state,view.selected,'rescue',x,y).legal)kind='rescue';
    }
    setPreview(kind,x,y);
  }
  async function submit(){
    if(submitted||!state.score||global.location.protocol==='file:')return;submitted=true;
    var result={title:state.title,score:state.score},submittedState=state;
    try{var response=await fetch('/api/leaderboard/rank?gameId=signalbreak&score='+result.score);if(!response.ok)return;
      var rank=Number((await response.json()).rank);if(!Number.isFinite(rank)||rank<1||rank>20)return;
      var name=global.prompt(result.title+' operation score: rank #'+rank+'. Name for the leaderboard?');if(name===null)return;
      name=String(name).trim().replace(/[^\w \-'.!]/g,'').slice(0,20);if(!name)return;
      await fetch('/api/leaderboard/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:'signalbreak',name:name,score:result.score})});
    }catch(e){if(state===submittedState)el('radio').textContent='Operation score: '+result.score+'. Leaderboard offline.';}
  }
  function after(){
    if(state.serial!==serial){A.play(state.event);serial=state.serial;}
    preview=null;
    if(!L.living(selected())){var first=state.squad.find(L.living);if(first)view.selected=first.id;}
    if(state.phase==='won'||state.phase==='lost'){
      if(state.phase==='won'&&C.complete(campaign,state))persist();
      mode='end';panel.hidden=false;el('kicker').textContent='OPERATION LOG / FIRST PLAYABLE';
      el('title').textContent=state.phase==='won'?'Signal restored.':'Signal lost.';
      el('copy').textContent=state.score.toLocaleString()+' operation points · turn '+state.turn+' · '+state.squad.filter(function(u){return u.extracted;}).length+'/4 engineers extracted.';
      var index=SB.Missions.operations.findIndex(function(m){return m.id===state.id;}),next=SB.Missions.operations[index+1];
      el('tip').textContent=state.phase==='won'?(state.debrief||state.title+' complete.')+' '+(next?'Next: '+next.title+'.':'You reached the current playable boundary. The remaining '+(20-SB.Missions.operations.length)+' operations and finale are in development.'):'Retry the operation. Take cover, focus fire and read each circuit before advancing.';
      el('next-operation').hidden=state.phase!=='won'||!next;el('next-operation').textContent=next?'NEXT / '+next.title:'NEXT OPERATION';
      el('start').textContent='REPLAY OPERATION ↗';submit();
    }
    reachable();hud();
  }
  function confirm(){if(mode!=='playing'||!preview||!preview.legal)return;A.unlock();if(L.commit(state,preview))after();else{preview=null;hud();}}
  function endTurn(){if(mode!=='playing')return;A.unlock();L.endTurn(state);after();}
  function start(){A.unlock();if(mode!=='paused'){state=C.prepare(campaign,L.newGame(state.id));submitted=false;serial=state.serial;view.selected='nia';view.zoom=1;view.panX=0;view.panY=0;action='move';}
    mode='playing';preview=null;cursor={x:selected().x,y:selected().y};panel.hidden=true;el('pause').textContent='Briefing / pause';reachable();hud();el('start').blur();}
  function pause(){if(mode==='paused'){start();return;}if(mode!=='playing')return;mode='paused';preview=null;panel.hidden=false;el('next-operation').hidden=true;el('kicker').textContent='FIELD BRIEFING / PAUSED';el('title').textContent=state.title;el('copy').textContent=state.briefing;el('tip').textContent=state.radio;el('start').textContent='RESUME OPERATION ↗';el('pause').textContent='Resume';hud();}
  el('next-operation').addEventListener('click',function(){var i=SB.Missions.operations.findIndex(function(m){return m.id===state.id;});if(SB.Missions.operations[i+1])briefing(SB.Missions.operations[i+1].id);});
  el('start').addEventListener('click',start);el('confirm').addEventListener('click',confirm);el('end-turn').addEventListener('click',endTurn);
  el('cancel').addEventListener('click',function(){preview=null;hud();});el('pause').addEventListener('click',pause);
  document.querySelectorAll('[data-action]').forEach(function(b){b.addEventListener('click',function(){A.unlock();chooseAction(b.dataset.action);});});
  el('sound').addEventListener('click',function(e){A.unlock();var off=A.toggle();e.currentTarget.textContent=off?'Sound off':'Sound on';e.currentTarget.setAttribute('aria-pressed',String(off));});
  function zoom(amount){view.zoom=Math.max(.75,Math.min(3,view.zoom+amount));view.panX=0;view.panY=0;}
  el('zoom-in').addEventListener('click',function(){zoom(.4);});el('zoom-out').addEventListener('click',function(){zoom(-.4);});el('center').addEventListener('click',function(){view.panX=0;view.panY=0;});
  var drag=null;
  canvas.addEventListener('pointerdown',function(e){if(mode!=='playing')return;canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,panX:view.panX,panY:view.panY,moved:false};});
  canvas.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>7)drag.moved=true;if(drag.moved){view.panX=drag.panX+dx;view.panY=drag.panY+dy;}});
  canvas.addEventListener('pointerup',function(e){if(!drag)return;var moved=drag.moved;drag=null;if(moved||!projection)return;var r=canvas.getBoundingClientRect(),p=projection.inverse((e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height);clickTile(p.x,p.y);});
  canvas.addEventListener('pointercancel',function(){drag=null;});canvas.addEventListener('lostpointercapture',function(){drag=null;});
  document.addEventListener('keydown',function(e){
    if(e.ctrlKey||e.metaKey||e.altKey||/^(INPUT|TEXTAREA|SELECT|SUMMARY|A)$/.test(e.target.tagName))return;
    var k=e.key.length===1?e.key.toLowerCase():e.key;
    if(mode!=='playing'){if(k==='Enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();start();}else if(k==='Escape'&&mode==='paused'){e.preventDefault();start();}return;}
    if(e.repeat)return;
    if(/^[1-4]$/.test(k)){e.preventDefault();select(state.squad[Number(k)-1].id);return;}
    var directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(directions[k]){e.preventDefault();action='move';var d=directions[k];setPreview('move',Math.max(0,Math.min(state.width-1,cursor.x+d[0])),Math.max(0,Math.min(state.height-1,cursor.y+d[1])));return;}
    if(k==='Enter'){e.preventDefault();confirm();}else if(k==='Escape'){e.preventDefault();preview=null;hud();}
    else if(k==='e'){e.preventDefault();endTurn();}else if(k==='p'){e.preventDefault();pause();}
    else if(k==='+'||k==='='){e.preventDefault();zoom(.4);}else if(k==='-'){e.preventDefault();zoom(-.4);}
    else {var actions={m:'move',f:'attack',h:'hack',r:'rescue',a:'heal',o:'watch',x:'extract'};if(actions[k]){e.preventDefault();chooseAction(actions[k]);}}
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden&&mode==='playing')pause();});
  SB.Game={start:start,getState:function(){return state;},getMode:function(){return mode;},getView:function(){return view;},getPreview:function(){return preview;}};
  function frame(now){projection=SB.Render.draw(canvas,state,view,now/1000);global.requestAnimationFrame(frame);}
  briefing(campaign.selected);global.requestAnimationFrame(frame);
})(window);
