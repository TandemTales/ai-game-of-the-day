(function (global) {
  'use strict';
  var SB = global.SB = global.SB || {};
  function projection(w, h, s, view) {
    var a = Math.min(w / (s.width + s.height + 2), h / ((s.width + s.height) * 0.5 + 5)) * (view.zoom || 1), b = a * 0.5;
    var ox = w / 2 - (s.width - s.height) * a / 2, oy = (h - (s.width + s.height) * b) / 2 + b;
    var focus = SB.Logic.unit(s, view.selected);
    if (view.zoom > 1.2 && focus) { ox = w / 2 - (focus.x - focus.y) * a; oy = h * 0.52 - (focus.x + focus.y) * b; }
    ox += view.panX || 0; oy += view.panY || 0;
    return { a:a, b:b, ox:ox, oy:oy, point:function(x,y,z) { return { x:ox+(x-y)*a, y:oy+(x+y)*b-(z||0)*a*0.55 }; },
      inverse:function(x,y) {
        var px=(x-ox)/a,py=(y-oy)/b,best={x:Math.round((px+py)/2),y:Math.round((py-px)/2)},nearest=Infinity;
        // Raised floor diamonds are shifted upwards; invert their displayed
        // centers as well as the ground plane used by the projection formula.
        for(var ty=0;ty<s.height;ty++)for(var tx=0;tx<s.width;tx++){
          var z=SB.Logic.height(s,tx,ty),cx=ox+(tx-ty)*a,cy=oy+(tx+ty)*b-z*a*.55;
          var distance=Math.abs(x-cx)/a+Math.abs(y-cy)/b;
          if(distance<=1&&distance<nearest){nearest=distance;best={x:tx,y:ty};}
        }
        return best;
      } };
  }
  function draw(canvas, s, view, time) {
    var c=canvas.getContext('2d'), d=global.devicePixelRatio||1, w=canvas.width,h=canvas.height;
    var P=projection(w,h,s,{zoom:view.zoom,selected:view.selected,panX:(view.panX||0)*Math.min(d,2),panY:(view.panY||0)*Math.min(d,2)}),a=P.a,b=P.b,L=SB.Logic;
    c.clearRect(0,0,w,h);var bg=c.createRadialGradient(w*.5,h*.4,0,w*.5,h*.5,w*.7);bg.addColorStop(0,'#15333d');bg.addColorStop(1,'#07131d');c.fillStyle=bg;c.fillRect(0,0,w,h);
    function diamond(x,y,z,fill,stroke) {var p=P.point(x,y,z);c.beginPath();c.moveTo(p.x,p.y-b);c.lineTo(p.x+a,p.y);c.lineTo(p.x,p.y+b);c.lineTo(p.x-a,p.y);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=Math.max(0.5,a*.025);c.stroke();}return p;}
    function block(x,y,z,top,left,right,base) {
      base=base===undefined?L.height(s,x,y):base;
      var p=P.point(x,y,base),q=P.point(x,y,base+z);
      c.fillStyle=left;c.beginPath();c.moveTo(p.x-a,p.y);c.lineTo(p.x,p.y+b);c.lineTo(q.x,q.y+b);c.lineTo(q.x-a,q.y);c.closePath();c.fill();
      c.fillStyle=right;c.beginPath();c.moveTo(p.x,p.y+b);c.lineTo(p.x+a,p.y);c.lineTo(q.x+a,q.y);c.lineTo(q.x,q.y+b);c.closePath();c.fill();
      diamond(x,y,base+z,top,'#51616a');return q;
    }
    var reachable=view.reachable||{}, boarding=s.freight&&L.extractionStatus(s);
    var lift=s.lift, liftStop=lift&&lift.stops[lift.position], liftPower=lift&&(s.circuits||[]).some(function(n){return n.id===lift.poweredBy&&n.controlled;});
    function shaftHere(x,y){return lift&&x>=8&&x<=14&&y>0&&y<s.height-1;}
    function platformHere(x,y){return liftStop&&x>=liftStop.x&&x<liftStop.x+lift.size&&y>=liftStop.y&&y<liftStop.y+lift.size;}
    function boardingHere(x,y){return boarding&&boarding.open&&boarding.tiles.some(function(t){return t.x===x&&t.y===y;});}
    // Authored yard materials and rail markings, with reachable cells kept legible.
    for(var y=0;y<s.height;y++)for(var x=0;x<s.width;x++) {
      var t=L.tile(s,x,y),z=L.height(s,x,y),p;
      var floor=x<8?((x*7+y*3)%4?'#30414a':'#374b53'):((x+y)%3?'#263e49':'#2d4650');
      if(t==='#')floor=shaftHere(x,y)?'#07151e':'#1b2c36';
      if(platformHere(x,y))floor=liftPower?'#786c44':'#514b3d';
      if(t==='e')floor=boarding?(boardingHere(x,y)?'#797044':'#293c49'):'#255c5b';
      p=z?block(x,y,z,floor,'#172c36','#203640',0):diamond(x,y,0,floor,'#162c37');
      if(platformHere(x,y)){
        diamond(x,y,z,floor,liftPower?'#ffe1a1':'#a3977e');
        c.strokeStyle='#e5bf76';c.lineWidth=Math.max(1,a*.06);c.beginPath();c.moveTo(p.x-a*.6,p.y);c.lineTo(p.x,p.y+b*.6);c.lineTo(p.x+a*.6,p.y);c.stroke();
      }
      if(reachable[x+','+y])diamond(x,y,z,reachable[x+','+y]===1?'#397b8550':'#bda26030','#4a96994a');
      if(t==='e'){c.strokeStyle=boarding?(boardingHere(x,y)?'#ffe09b':'#72828b'):'#80d2bb';c.lineWidth=a*.07;c.beginPath();c.moveTo(p.x-a*.4,p.y);c.lineTo(p.x,p.y+b*.45);c.lineTo(p.x+a*.4,p.y-b*.1);c.stroke();}
      if(t!== '#' && y===6){c.strokeStyle=x<8?'#c2975655':'#6caab955';c.lineWidth=a*.04;c.beginPath();c.moveTo(p.x-a*.7,p.y+b*.3);c.lineTo(p.x+a*.7,p.y-b*.3);c.stroke();}
      if(t!== '#' && (x*17+y*9)%7===0){c.strokeStyle='#7b969b30';c.lineWidth=a*.025;c.beginPath();c.moveTo(p.x-a*.6,p.y);c.lineTo(p.x-a*.1,p.y+b*.3);c.lineTo(p.x+a*.1,p.y+b*.17);c.stroke();}
    }
    if(lift){
      // Empty dock outlines and cable guides identify both destinations without
      // turning the shaft into apparently traversable floor or opaque walls.
      lift.stops.forEach(function(stop,index){
        if(index===lift.position)return;
        c.setLineDash([a*.22,a*.15]);
        for(var ly=0;ly<lift.size;ly++)for(var lx=0;lx<lift.size;lx++){
          var q=P.point(stop.x+lx,stop.y+ly,stop.z);c.strokeStyle='#85939788';c.lineWidth=Math.max(1,a*.04);c.beginPath();c.moveTo(q.x,q.y-b);c.lineTo(q.x+a,q.y);c.lineTo(q.x,q.y+b);c.lineTo(q.x-a,q.y);c.closePath();c.stroke();
        }
        c.setLineDash([]);
      });
      [[0,0],[lift.size-1,lift.size-1]].forEach(function(offset){
        var q=P.point(liftStop.x+offset[0],liftStop.y+offset[1],liftStop.z);
        c.strokeStyle='#a3b1aa88';c.lineWidth=Math.max(1,a*.05);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-a*2.8);c.stroke();
        c.fillStyle='#f0ce86';c.fillRect(q.x-a*.08,q.y-a*.3,a*.16,a*.3);
      });
      c.fillStyle=liftPower?'#ffe1a1':'#bcc7c6';c.font=Math.max(11*Math.min(d,2),w/100)+'px system-ui';
      c.fillText((liftPower?'POWER ON / ':'POWER OFF / ')+liftStop.label,16*Math.min(d,2),h-62*Math.min(d,2));
      c.fillText('HACK, then deck/console / 1 AP',16*Math.min(d,2),h-42*Math.min(d,2));
    }
    if(boarding){
      // Timetable stays at a fixed readable size, outside the tactical diamonds.
      c.fillStyle=boarding.open?'#ffe09b':'#b5c8d0';c.font=Math.max(11*Math.min(d,2),w/100)+'px system-ui';c.textAlign='right';
      c.fillText(boarding.open?boarding.label+' / BOARD / '+boarding.turnsUntilChange+' TURNS':'TRANSIT / '+boarding.nextLabel+' / '+boarding.turnsUntilChange+' TURN',w-16*Math.min(d,2),h-42*Math.min(d,2));c.textAlign='start';
    }
    // Stair edges are the only legal roof-level transitions; draw their exact
    // endpoints above the floor so the route matches the movement preview.
    (s.climbLinks||[]).forEach(function(link){
      var p=P.point(link.from.x,link.from.y,L.height(s,link.from.x,link.from.y));
      var q=P.point(link.to.x,link.to.y,L.height(s,link.to.x,link.to.y));
      c.strokeStyle='#ffe1a1';c.lineWidth=Math.max(2,a*.13);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      [p,q].forEach(function(r){c.beginPath();c.arc(r.x,r.y,a*.17,0,Math.PI*2);c.fillStyle='#ffe1a1';c.fill();});
    });
    if(s.climbLinks&&s.climbLinks.length){c.fillStyle='#ffe1a1';c.font=Math.max(11*Math.min(d,2),w/100)+'px system-ui';c.textAlign='right';c.fillText('GOLD LINKS / STAIRS ONLY',w-16*Math.min(d,2),h-42*Math.min(d,2));c.textAlign='start';}
    if(s.ambush)s.ambush.enemies.forEach(function(e){
      if(s.ambush.deployed&&s.ambush.deployed[e.id])return;
      var p=P.point(e.x,e.y);diamond(e.x,e.y,0,'#743f3c','#ef9c7c');c.fillStyle='#ffd0a0';c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText('! '+s.ambush.turn,p.x,p.y-a*.25);c.textAlign='start';
    });
    // Visible shared circuit routes show the coupled door/turret system.
    var circuits=s.circuits||[{x:s.node.x,y:s.node.y,controlled:s.network,doors:[{x:8,y:6}],turret:true}];
    circuits.forEach(function(n){var node=P.point(n.x,n.y,L.height(s,n.x,n.y));c.strokeStyle=n.controlled?'#6ee5ca':'#e4b778';c.lineWidth=a*.085;c.setLineDash([a*.25,a*.15]);
      (n.doors||[]).concat(n.turret?[s.turret]:[]).forEach(function(d){var p=P.point(d.x,d.y,L.height(s,d.x,d.y));c.beginPath();c.moveTo(node.x,node.y);c.lineTo(p.x,p.y);c.stroke();});c.setLineDash([]);});
    if(view.preview&&view.preview.legal&&view.preview.path){c.strokeStyle='#b7edf0';c.lineWidth=a*.11;c.beginPath();view.preview.path.forEach(function(p,i){var q=P.point(p.x,p.y,L.height(s,p.x,p.y));if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();}
    for(var depth=0;depth<s.width+s.height;depth++)for(var y=0;y<s.height;y++) {
      var x=depth-y;if(x<0||x>=s.width)continue;
      var t=L.tile(s,x,y),z=L.height(s,x,y),p=P.point(x,y,z);
      if(t==='#'&&!shaftHere(x,y)) {
        // Front perimeter stays low so it cannot obscure engineers.
        var height=(y===s.height-1||x===s.width-1)?0.35:x===8?1.25:0.7;
        var q=block(x,y,height,'#566770','#243640','#33464f');
        c.strokeStyle='#90a2a944';c.lineWidth=a*.04;c.beginPath();c.moveTo(q.x-a*.7,q.y);c.lineTo(q.x+a*.5,q.y-b*.45);c.stroke();
      }
      if(t==='c') {block(x,y,.55,'#61787b','#30464c','#3d565c');c.fillStyle='#c7b27e';c.fillRect(p.x-a*.4,p.y-a*.3,a*.3,a*.05);}
      if(t==='d') {
        if(!L.doorOpen(s,x,y)){block(x,y,1.3,'#ba9a66','#63553f','#847047');c.strokeStyle='#ffe0a0';c.lineWidth=a*.07;c.beginPath();c.moveTo(p.x-a*.45,p.y-a*.25);c.lineTo(p.x+a*.25,p.y-a*.65);c.stroke();}
        else {diamond(x,y,z,'#3e766d','#80d9bd');}
      }
      if(t==='n') {
        var circuit=L.circuitAt(s,x,y),consoleHere=lift&&lift.stops.some(function(stop){return stop.console.x===x&&stop.console.y===y;}),on=consoleHere?liftPower:circuit?circuit.controlled:s.network;
        var q=block(x,y,.5,on?'#8bdfc4':'#e9c485','#4c5a59','#647775');
        c.fillStyle=on?'#91ffe2':'#ffe1a1';c.beginPath();c.arc(q.x,q.y-a*.2,a*.17,0,Math.PI*2);c.fill();
        if(consoleHere){c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText('L',q.x,q.y-a*.65);c.textAlign='start';}
        if(s.circuits&&circuit){c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText(String(s.circuits.indexOf(circuit)+1),q.x,q.y-a*.65);c.textAlign='start';}
      }
      if(x===s.turret.x&&y===s.turret.y){
        block(x,y,.5,'#8c9c9b','#3c535c','#4d6d71');c.strokeStyle=L.turretAllied(s)?'#84f4ce':'#ef8c78';c.lineWidth=a*.18;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y-a*.6);c.lineTo(p.x+a*.55,p.y-a*.85);c.stroke();
        c.fillStyle=L.turretAllied(s)?'#72e1c2':'#e88b73';c.beginPath();c.arc(p.x,p.y-a*.55,a*.25,0,Math.PI*2);c.fill();
      }
      if(t==='r'&&!s.rescued){c.strokeStyle='#f8cf86';c.lineWidth=a*.06;c.beginPath();c.arc(p.x,p.y-a*.35,a*.3,0,Math.PI*2);c.stroke();c.fillStyle='#f8cf86';c.fillRect(p.x-a*.13,p.y-a*.4,a*.26,a*.6);}
      // A compact medical crate rides until delivered, then remains beside
      // the upper landing while the empty platform can return for stragglers.
      if(lift&&s.rescued&&(lift.delivered?x===15&&y===8:x===liftStop.x&&y===liftStop.y)){
        var q=P.point(x-.3,y-.3,z);c.fillStyle='#698d87';c.fillRect(q.x-a*.18,q.y-a*.47,a*.36,a*.32);c.fillStyle='#d9f3df';c.fillRect(q.x-a*.04,q.y-a*.44,a*.08,a*.24);c.fillRect(q.x-a*.13,q.y-a*.36,a*.26,a*.08);
      }
      var actor=L.occupant(s,x,y);
      if(actor){
        var friendly=s.squad.indexOf(actor)!==-1,selected=view.selected===actor.id;
        if(selected){c.strokeStyle='#c1fff0';c.lineWidth=a*.07;c.beginPath();c.ellipse(p.x,p.y,a*.72,b*.72,0,0,Math.PI*2);c.stroke();}
        c.fillStyle='#0007';c.beginPath();c.ellipse(p.x+a*.06,p.y+a*.06,a*.36,b*.3,0,0,Math.PI*2);c.fill();
        c.strokeStyle='#0b1c25';c.lineWidth=a*.09;c.fillStyle=friendly?actor.color:'#d27f70';
        c.beginPath();c.moveTo(p.x-a*.22,p.y-a*.25);c.lineTo(p.x-a*.18,p.y-a*.75);c.lineTo(p.x+a*.16,p.y-a*.8);c.lineTo(p.x+a*.28,p.y-a*.28);c.closePath();c.fill();c.stroke();
        c.fillStyle=friendly?'#d9d8ba':'#7b4b43';c.beginPath();c.arc(p.x,p.y-a*.97,a*.2,0,Math.PI*2);c.fill();
        c.strokeStyle=friendly?'#9fbdba':'#fa9d8b';c.lineWidth=a*.09;c.beginPath();c.moveTo(p.x+a*.17,p.y-a*.56);c.lineTo(p.x+a*.52,p.y-a*.78);c.stroke();
        var barW=a*.85;c.fillStyle='#071823';c.fillRect(p.x-barW/2,p.y-a*1.35,barW,a*.12);c.fillStyle=friendly?'#a6dfc7':'#f29e86';c.fillRect(p.x-barW/2,p.y-a*1.35,barW*actor.hp/actor.maxHp,a*.12);
        if(friendly){c.fillStyle=actor.watch?'#f2d99a':'#b5e6df';for(var i=0;i<actor.ap;i++){c.beginPath();c.arc(p.x-a*.13+i*a*.26,p.y-a*1.6,a*.07,0,Math.PI*2);c.fill();}}
      }
    }
    if(view.preview){var p=P.point(view.preview.x,view.preview.y,L.height(s,view.preview.x,view.preview.y));c.strokeStyle=view.preview.legal?'#fce0a4':'#e7988b';c.lineWidth=a*.08;c.beginPath();c.ellipse(p.x,p.y,a*.82,b*.82,0,0,Math.PI*2);c.stroke();}
    // HUD belongs to DOM. This map legend remains readable independently of zoom.
    c.fillStyle='#93b3bf';c.font=Math.max(10,w/100)+'px system-ui';c.fillText(s.district.toUpperCase()+' / '+String(s.sequence||1).padStart(2,'0'),16*Math.min(d,2),h-18*Math.min(d,2));
    return P;
  }
  SB.Render={draw:draw,projection:projection};
})(window);
