(function(){var BW=window.BW=window.BW||{},T=32;
var COL=['#ffc857','#4cc9f0','#ef476f','#80ed99'];
BW.render=function(cv,g,t){var c=cv.getContext('2d'),W=BW.W,H=BW.H;c.imageSmoothingEnabled=false;
 var sh=g.quake>0?(Math.random()-.5)*g.quake*8:0;c.save();c.translate(sh,sh);
 for(var y=0;y<H;y++)for(var x=0;x<W;x++){var v=g.tiles[y][x],px=x*T,py=y*T;
  c.fillStyle=(x+y)%2?'#3b2d4f':'#34274a';c.fillRect(px,py,T,T);
  if(v===1){c.fillStyle='#14101c';c.fillRect(px,py,T,T);c.fillStyle='#5a4a78';c.fillRect(px,py,T,4);c.fillStyle='#2b2140';c.fillRect(px+2,py+T-6,T-4,4);c.fillStyle='#4a3b66';c.fillRect(px+3,py+6,T-6,T-14);}
  else if(v===2){c.fillStyle='#8a5a2b';c.fillRect(px+2,py+2,T-4,T-4);c.fillStyle='#b9833f';c.fillRect(px+2,py+2,T-4,5);c.fillStyle='#5e3a18';c.fillRect(px+2,py+T-8,T-4,6);c.strokeStyle='#5e3a18';c.beginPath();c.moveTo(px+4,py+4);c.lineTo(px+T-4,py+T-4);c.moveTo(px+T-4,py+4);c.lineTo(px+4,py+T-4);c.stroke();}
 }
 for(var k in g.items){var p=k.split(','),it=g.items[k],ix=p[0]*T+T/2,iy=p[1]*T+T/2+Math.sin(t*4)*2;
  c.fillStyle=it==='bomb'?'#bbb':it==='fire'?'#ff7b00':'#4cc9f0';c.beginPath();c.arc(ix,iy,9,0,7);c.fill();c.fillStyle='#000';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText(it==='bomb'?'B':it==='fire'?'F':'S',ix,iy+4);}
 g.bombs.forEach(function(b){var s=1+Math.sin(t*(10+(2.4-b.t)*8))*.1,cx=b.x*T+T/2,cy=b.y*T+T/2+3;c.fillStyle='#111';c.beginPath();c.arc(cx,cy,11*s,0,7);c.fill();c.fillStyle='#555';c.beginPath();c.arc(cx-3,cy-4,3,0,7);c.fill();c.fillStyle=b.t<.8?'#fff':'#ff5a36';c.beginPath();c.arc(cx+7,cy-11,3+Math.random()*2,0,7);c.fill();});
 g.flames.forEach(function(f){var a=f.t/.45;c.fillStyle='rgba(255,'+Math.floor(120+100*a)+',40,'+(0.5+a*.5)+')';c.fillRect(f.x*T+2,f.y*T+2,T-4,T-4);c.fillStyle='rgba(255,240,180,'+a+')';c.fillRect(f.x*T+9,f.y*T+9,T-18,T-18);});
 g.actors.forEach(function(a){if(!a.alive)return;var cx=a.px*T+T/2,cy=a.py*T+T/2;
  c.fillStyle='rgba(0,0,0,.35)';c.beginPath();c.ellipse(cx,cy+11,10,4,0,0,7);c.fill();
  c.fillStyle=COL[a.id];c.fillRect(cx-9,cy-4,18,15);c.fillStyle='#f6d5b5';c.beginPath();c.arc(cx,cy-8,9,0,7);c.fill();c.fillStyle=COL[a.id];c.fillRect(cx-9,cy-17,18,6);
  c.fillStyle='#111';c.fillRect(cx-5,cy-9,3,4);c.fillRect(cx+2,cy-9,3,4);if(a.human){c.strokeStyle='#fff';c.strokeRect(cx-11,cy-19,22,31);}});
 c.restore();
 if(g.quake>0){c.fillStyle='rgba(255,90,54,'+g.quake*.35+')';c.fillRect(0,0,cv.width,cv.height);}
};})();
