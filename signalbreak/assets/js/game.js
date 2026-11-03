(function(global){
  'use strict';
  var SB=global.SB,L=SB.Logic,A=SB.Audio,canvas=document.getElementById('map'),panel=document.getElementById('panel');
  var state=L.newGame(),mode='title',action='move',preview=null,submitted=false,serial=state.serial;
  var view={selected:'nia',zoom:1,panX:0,panY:0,reachable:{},preview:null},projection=null,cursor={x:2,y:4};
  function el(id){return document.getElementById(id);}
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
    [['network',state.network,'Take the circuit'],['rescue',state.rescued,'Rescue signal worker'],['extract',state.phase==='won','Extract surviving engineers']].forEach(function(o){var e=el('obj-'+o[0]);e.textContent=(o[1]?'✓ ':'○ ')+o[2];e.classList.toggle('done',o[1]);});
    el('network-status').textContent=state.network?'ALLIED / DOOR OPEN':'HOSTILE / DOOR LOCKED';el('network-status').style.color=state.network?'#9be1d3':'';
    el('radio').textContent=state.log.slice(-2).join(' / ');
    el('preview').textContent=preview?preview.reason:mode==='playing'?selected().name+' / '+selected().ap+' AP · select a tile, then confirm.':mode==='end'?'Operation ended. Replay to improve your score.':mode==='paused'?'Operation paused. Resume when ready.':'Deploy to begin the opening operation.';
    el('confirm').disabled=mode!=='playing'||!preview||!preview.legal;el('cancel').disabled=mode!=='playing'||!preview;
    el('end-turn').disabled=mode!=='playing';el('pause').disabled=mode==='title'||mode==='end';
    document.querySelectorAll('[data-action]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.action===action));b.disabled=mode!=='playing'||!L.living(selected())||selected().ap<1;});
    view.preview=preview;
  }
  function select(id){if(mode!=='playing')return;var u=L.unit(state,id);if(!u||!L.living(u))return;view.selected=id;cursor={x:u.x,y:u.y};view.panX=0;view.panY=0;preview=null;action='move';reachable();hud();}
  function setPreview(kind,x,y){if(mode!=='playing')return;preview=L.preview(state,view.selected,kind,x,y);cursor={x:x,y:y};hud();}
  function chooseAction(kind){
    if(mode!=='playing')return;action=kind;preview=null;var u=selected();
    if(kind==='watch'||kind==='extract')setPreview(kind,u.x,u.y);
    else if(kind==='hack')setPreview(kind,state.node.x,state.node.y);
    else if(kind==='rescue')setPreview(kind,state.rescue.x,state.rescue.y);
    else if(kind==='attack'){var enemy=state.enemies.filter(L.living).sort(function(a,b){return Math.abs(a.x-u.x)+Math.abs(a.y-u.y)-Math.abs(b.x-u.x)-Math.abs(b.y-u.y);})[0];if(enemy)setPreview(kind,enemy.x,enemy.y);}
    hud();
  }
  function clickTile(x,y){
    if(mode!=='playing')return;
    var u=state.squad.find(function(u){return L.living(u)&&u.x===x&&u.y===y;});
    if(u&&action!=='heal'){select(u.id);return;}
    var kind=action;
    if(action==='move'){
      if(state.enemies.some(function(e){return L.living(e)&&e.x===x&&e.y===y;}))kind='attack';
      else if(x===state.node.x&&y===state.node.y&&!state.network&&L.preview(state,view.selected,'hack',x,y).legal)kind='hack';
      else if(x===state.rescue.x&&y===state.rescue.y&&!state.rescued&&L.preview(state,view.selected,'rescue',x,y).legal)kind='rescue';
    }
    setPreview(kind,x,y);
  }
  async function submit(){
    if(submitted||!state.score||global.location.protocol==='file:')return;submitted=true;
    try{var response=await fetch('/api/leaderboard/rank?gameId=signalbreak&score='+state.score);if(!response.ok)return;
      var rank=Number((await response.json()).rank);if(!Number.isFinite(rank)||rank<1||rank>20)return;
      var name=global.prompt('Opening operation score: rank #'+rank+'. Name for the leaderboard?');if(name===null)return;
      name=String(name).trim().replace(/[^\w \-'.!]/g,'').slice(0,20);if(!name)return;
      await fetch('/api/leaderboard/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:'signalbreak',name:name,score:state.score})});
    }catch(e){el('radio').textContent='Operation score: '+state.score+'. Leaderboard offline.';}
  }
  function after(){
    if(state.serial!==serial){A.play(state.event);serial=state.serial;}
    preview=null;
    if(!L.living(selected())){var first=state.squad.find(L.living);if(first)view.selected=first.id;}
    if(state.phase==='won'||state.phase==='lost'){
      mode='end';panel.hidden=false;el('kicker').textContent='OPERATION LOG / FIRST PLAYABLE';
      el('title').textContent=state.phase==='won'?'Signal restored.':'Signal lost.';
      el('copy').textContent=state.score.toLocaleString()+' operation points · turn '+state.turn+' · '+state.squad.filter(function(u){return u.extracted;}).length+'/4 engineers extracted.';
      el('tip').textContent=state.phase==='won'?'Live Wire complete. The remaining 19 operations, campaign progression and finale are in development. Replay this operation to improve your score.':'Retry the operation. Take cover, focus fire and use the shared circuit to bring the turret onto your side.';
      el('start').textContent='REPLAY OPERATION ↗';submit();
    }
    reachable();hud();
  }
  function confirm(){if(mode!=='playing'||!preview||!preview.legal)return;A.unlock();if(L.commit(state,preview))after();else{preview=null;hud();}}
  function endTurn(){if(mode!=='playing')return;A.unlock();L.endTurn(state);after();}
  function start(){A.unlock();if(mode!=='paused'){state=L.newGame();submitted=false;serial=state.serial;view.selected='nia';view.zoom=1;view.panX=0;view.panY=0;action='move';}
    mode='playing';preview=null;cursor={x:selected().x,y:selected().y};panel.hidden=true;el('pause').textContent='Briefing / pause';reachable();hud();el('start').blur();}
  function pause(){if(mode==='paused'){start();return;}if(mode!=='playing')return;mode='paused';preview=null;panel.hidden=false;el('kicker').textContent='FIELD BRIEFING / PAUSED';el('title').textContent='Read the circuit.';el('copy').textContent='Take the amber substation, rescue the worker, then extract every surviving engineer at the eastern green tiles. Orders require confirmation.';el('tip').textContent='Nia hacks from two tiles. Sol heals adjacent engineers. Rook moves farther per AP. Ivo deals heavier damage. Use cover and overwatch.';el('start').textContent='RESUME OPERATION ↗';el('pause').textContent='Resume';hud();}
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
    if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA/.test(e.target.tagName))return;
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
  reachable();hud();global.requestAnimationFrame(frame);
})(window);
