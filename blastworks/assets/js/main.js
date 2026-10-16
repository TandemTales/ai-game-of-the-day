(function(){var BW=window.BW,$=function(i){return document.getElementById(i);},cv=$('scene'),g=null,stage=1,carry=0,keys={},held=null,bombQ=false,last=0,running=false,t=0,acc=0,moveCd=0;
cv.width=BW.W*32;cv.height=BW.H*32;
function start(){g=BW.newGame((Date.now()&0xffff)+stage,stage);g.score=carry;$('overlay').hidden=true;running=true;$('form').hidden=true;cv.focus();}
function dirFromKeys(){if(held)return held;var dx=0,dy=0;if(keys.ArrowLeft||keys.a)dx=-1;else if(keys.ArrowRight||keys.d)dx=1;else if(keys.ArrowUp||keys.w)dy=-1;else if(keys.ArrowDown||keys.s)dy=1;return{dx:dx,dy:dy};}
addEventListener('keydown',function(e){var k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=1;if(k===' '||k==='x'){bombQ=true;e.preventDefault();}if(k.indexOf('Arrow')===0)e.preventDefault();});
addEventListener('keyup',function(e){delete keys[e.key.length===1?e.key.toLowerCase():e.key];});
[['u',0,-1],['d',0,1],['l',-1,0],['r',1,0]].forEach(function(d){var b=$('dp'+d[0]);function dn(e){e.preventDefault();held={dx:d[1],dy:d[2]};}function up(e){e.preventDefault();held=null;}b.addEventListener('pointerdown',dn);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up);});
$('bombBtn').addEventListener('pointerdown',function(e){e.preventDefault();bombQ=true;});
$('sound').onclick=function(){var on=this.getAttribute('aria-pressed')!=='true';this.setAttribute('aria-pressed',on);this.textContent=on?'Sound on':'Sound off';BW.audio.enable(on);};
$('begin').onclick=function(){stage=1;carry=0;start();};
function hud(){$('score').textContent=String(g.score).padStart(5,'0');$('timer').textContent=Math.max(0,Math.ceil(g.timeLimit-g.time))+'s';var p=Math.round(g.pressure);$('gaugeFill').style.width=p+'%';$('gauge').className=p>75?'hot':'';$('stage').textContent='STAGE '+stage;}
function finish(){running=false;var o=$('overlay');o.hidden=false;
 if(g.won){carry=g.score;$('title').textContent='Stage '+stage+' cleared!';$('text').textContent='Score '+g.score+'. Rivals get smarter next stage.';$('begin').textContent='Next stage →';$('begin').onclick=function(){stage++;start();};
  $('form').hidden=true;}
 else{$('title').textContent='Blown up!';$('text').textContent='Final score '+g.score+' on stage '+stage+'.';$('begin').textContent='Play again';$('begin').onclick=function(){stage=1;carry=0;start();};$('form').hidden=false;$('scoreStatus').textContent='';window.__final=g.score;
  fetch('/api/leaderboard/rank?gameId=blastworks&score='+g.score).then(function(r){return r.json();}).then(function(d){if(d&&d.rank)$('scoreStatus').textContent='You would rank #'+d.rank;}).catch(function(){});}}
$('form').addEventListener('submit',function(e){e.preventDefault();var n=$('callsign').value.trim()||'Anon';fetch('/api/leaderboard/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:'blastworks',name:n.slice(0,20),score:window.__final})}).then(function(r){$('scoreStatus').textContent=r.ok?'Score posted!':'Could not post score.';}).catch(function(){$('scoreStatus').textContent='Offline: score not posted.';});});
function frame(ts){var dt=Math.min(.05,(ts-last)/1000||0);last=ts;t+=dt;
 if(running&&g){acc+=dt;var d=dirFromKeys(),inp={dx:d.dx,dy:d.dy,bomb:bombQ};bombQ=false;BW.step(g,dt,inp);g.events.forEach(BW.audio.play);hud();if(g.over)finish();}
 if(g)BW.render(cv,g,t);requestAnimationFrame(frame);}
$('pause').onclick=function(){running=!running;};
requestAnimationFrame(frame);
window.BWdebug={start:start,get g(){return g;}};
})();
