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
    var archive=L.archiveStatus(s),keyPair=L.keyPairStatus(s),archiveDistrict=s.district==='Glass Archive';
    var broadcast=s.broadcast&&L.broadcastStatus(s);
    var transmitter=broadcast&&s.circuits.find(function(n){return n.id===s.broadcast.circuitId;});
    var signalInk=broadcast&&broadcast.active?'#e0ceff':'#b1a4ce';
    c.clearRect(0,0,w,h);var bg=c.createRadialGradient(w*.5,h*.4,0,w*.5,h*.5,w*.7);bg.addColorStop(0,archiveDistrict?'#29273e':'#15333d');bg.addColorStop(1,archiveDistrict?'#0b101e':'#07131d');c.fillStyle=bg;c.fillRect(0,0,w,h);
    function diamond(x,y,z,fill,stroke) {var p=P.point(x,y,z);c.beginPath();c.moveTo(p.x,p.y-b);c.lineTo(p.x+a,p.y);c.lineTo(p.x,p.y+b);c.lineTo(p.x-a,p.y);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=Math.max(0.5,a*.025);c.stroke();}return p;}
    function block(x,y,z,top,left,right,base) {
      base=base===undefined?L.height(s,x,y):base;
      var p=P.point(x,y,base),q=P.point(x,y,base+z);
      c.fillStyle=left;c.beginPath();c.moveTo(p.x-a,p.y);c.lineTo(p.x,p.y+b);c.lineTo(q.x,q.y+b);c.lineTo(q.x-a,q.y);c.closePath();c.fill();
      c.fillStyle=right;c.beginPath();c.moveTo(p.x,p.y+b);c.lineTo(p.x+a,p.y);c.lineTo(q.x+a,q.y);c.lineTo(q.x,q.y+b);c.closePath();c.fill();
      diamond(x,y,base+z,top,'#51616a');return q;
    }
    var reachable=view.reachable||{}, boarding=s.freight&&L.extractionStatus(s);
    var lift=s.lift, bridge=lift&&lift.kind==='bridge', liftStop=lift&&lift.stops[lift.position], liftPower=lift&&(s.circuits||[]).some(function(n){return n.id===lift.poweredBy&&n.controlled;});
    function shaftHere(x,y){return lift&&!bridge&&x>=8&&x<=14&&y>0&&y<s.height-1;}
    function platformHere(x,y){return liftStop&&x>=liftStop.x&&x<liftStop.x+lift.size&&y>=liftStop.y&&y<liftStop.y+lift.size;}
    function boardingHere(x,y){return boarding&&boarding.open&&boarding.tiles.some(function(t){return t.x===x&&t.y===y;});}
    var waterCells={};
    if(s.water)(s.water.routes||[]).forEach(function(route,index){route.tiles.forEach(function(t){waterCells[t.x+','+t.y]={route:route,index:index};});});
    function channelHere(x,y){return waterCells[x+','+y];}
    function waterEdge(x,y,z,dx,dy){
      var p=P.point(x,y,z),left,right;
      if(dx===1){left={x:p.x+a,y:p.y};right={x:p.x,y:p.y+b};}
      else if(dx===-1){left={x:p.x-a,y:p.y};right={x:p.x,y:p.y-b};}
      else if(dy===1){left={x:p.x-a,y:p.y};right={x:p.x,y:p.y+b};}
      else{left={x:p.x+a,y:p.y};right={x:p.x,y:p.y-b};}
      c.beginPath();c.moveTo(left.x,left.y);c.lineTo(right.x,right.y);c.stroke();
    }
    // Archive textures follow the actual partition and low cover tiles.
    var breaker=archive&&s.circuits.find(function(n){return n.id===s.archive.delayCircuit;});
    var shutter=archive&&s.circuits.find(function(n){return n.id==='archive-shutter';});
    var pairedDoor=keyPair&&L.circuitAt(s,keyPair.keys[0].x,keyPair.keys[0].y).doors[0];
    var archivePartition=breaker&&breaker.doors[0]?breaker.doors[0].x:pairedDoor?pairedDoor.x:s.width/2;
    function archiveMarker(x,y){
      if(!archive)return null;
      if(x===archive.evidence.x&&y===archive.evidence.y)return 'E';
      if(x===archive.breaker.x&&y===archive.breaker.y)return 'B';
      if(shutter&&x===shutter.x&&y===shutter.y)return 'S';
      return null;
    }
    function mapBadge(point,letter,ink,clearance){
      var scale=Math.min(d,2),size=Math.max(15*scale,Math.min(24*scale,a*1.02));
      var top=point.y-a*clearance-size;
      c.strokeStyle=ink;c.lineWidth=scale;c.fillStyle='#121c2d';
      c.fillRect(point.x-size/2,top,size,size);c.strokeRect(point.x-size/2,top,size,size);
      c.fillStyle=ink;c.font='700 '+Math.round(size*.69)+'px system-ui';c.textAlign='center';
      c.fillText(letter,point.x,top+size*.75);c.textAlign='start';
    }
    function archiveWall(x,y){
      var edge=x===0||x===s.width-1||y===0||y===s.height-1;
      var partition=x===archivePartition&&!edge;
      var p=P.point(x,y),q=block(x,y,edge ? .28 : partition ? .87 : .67,
        edge?'#535468':partition?'#8a91a7':'#69677e','#232a41',partition?'#49546d':'#42425a');
      if(edge)return;
      c.strokeStyle=partition?'#aebbd0':'#9290aa';c.lineWidth=Math.max(.65,a*.038);
      c.beginPath();
      c.moveTo(q.x-a*.84,q.y+b*.08);c.lineTo(q.x,q.y+b*.92);c.lineTo(q.x+a*.84,q.y+b*.08);
      c.moveTo(q.x,q.y+b*.92);c.lineTo(p.x,p.y+b*.85);
      c.stroke();
    }
    function archiveShelf(x,y,p){
      var q=block(x,y,.52,'#918999','#424052','#6d687d');
      c.strokeStyle='#28283b';c.lineWidth=Math.max(.8,a*.065);
      c.beginPath();c.moveTo(q.x+a*.13,q.y+b*.82);c.lineTo(q.x+a*.84,q.y+b*.13);c.stroke();
      // File spines fit on the cabinet face so they never indicate extra cover.
      ['#d4b696','#a3bdc6','#cb9c89'].forEach(function(ink,i){
        var px=a*(.28+i*.19),py=b*(.73-i*.19);
        c.strokeStyle=ink;c.lineWidth=Math.max(.7,a*.06);
        c.beginPath();c.moveTo(q.x+px,q.y+py);c.lineTo(p.x+px,p.y+py);c.stroke();
      });
    }
    // Authored surfaces, with reachable cells kept legible.
    for(var y=0;y<s.height;y++)for(var x=0;x<s.width;x++) {
      var t=L.tile(s,x,y),z=L.height(s,x,y),p;
      var floor=x<8?((x*7+y*3)%4?'#30414a':'#374b53'):((x+y)%3?'#263e49':'#2d4650');
      if(s.defense&&x>=8&&x<=15&&y>=2&&y<=6&&t!=='#')floor=(x+y)%2?'#576965':'#4b605f';
      if(s.lanes&&x>=10&&x<=15&&y>=3&&y<=10&&t!=='#')floor=(x+y)%2?'#43525b':'#354953';
      if(s.water&&t!=='#')floor=(x+y)%3?'#344b49':'#405550';
      if(bridge&&t!== '#'&&t!=='w')floor=x<8?((x+y)%3?'#4b5148':'#585d50'):((x+y)%3?'#354f54':'#405b60');
      if(s.lighting&&t!=='#'&&t!=='w')floor=L.lit(s,x,y)?((x+y)%3?'#75603d':'#806b46'):((x+y)%3?'#1c3247':'#233c51');
      if(channelHere(x,y))floor=t==='w'?'#104b5e':'#606c59';
      if(t==='w')floor=(x+y)%2?'#104b5e':'#124255';
      if(t==='#')floor=shaftHere(x,y)?'#07151e':'#1b2c36';
      if(platformHere(x,y))floor=liftPower?'#786c44':'#514b3d';
      if(archiveDistrict&&t!=='#'&&t!=='w')floor=x<archivePartition?
        ((x+y)%2?'#535468':'#4b4e62'):((x+y)%2?'#303e59':'#34445f');
      var studio=broadcast&&t!=='#'&&Math.abs(x-transmitter.x)<=2&&Math.abs(y-transmitter.y)<=1;
      if(studio)floor=(x+y)%2?'#574d69':'#49445f';
      if(t==='e')floor=boarding?(boardingHere(x,y)?'#797044':'#293c49'):'#255c5b';
      p=z?block(x,y,z,floor,'#172c36','#203640',0):diamond(x,y,0,floor,'#162c37');
      if(studio){
        c.strokeStyle='#baafd955';c.lineWidth=Math.max(.6,a*.04);
        c.beginPath();c.moveTo(p.x-a*.7,p.y-b*.18);c.lineTo(p.x,p.y-b*.65);c.lineTo(p.x+a*.7,p.y-b*.18);c.stroke();
      }
      if(broadcast&&x===broadcast.destination.x&&y===broadcast.destination.y){
        c.setLineDash([a*.23,a*.14]);
        diamond(x,y,z,broadcast.active?'#ba8ee875':'#a594c447',signalInk);
        c.setLineDash([]);
      }
      if(s.lighting&&t!=='#'&&t!=='w'&&L.lit(s,x,y)){
        // The amber perimeter follows the exact Manhattan acquisition zone.
        // It is a targeting cue, never an obstacle or extra cover.
        c.strokeStyle='#e8bf7777';c.lineWidth=Math.max(.8,a*.04);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dir){if(!L.lit(s,x+dir[0],y+dir[1]))waterEdge(x,y,z,dir[0],dir[1]);});
      }
      if(t==='w'){
        // Water stays flat and transparent to sight. Rims mark movement bounds,
        // while two small travelling glints distinguish it from solid cover.
        c.strokeStyle='#79c7d180';c.lineWidth=Math.max(.7,a*.035);
        var drift=Math.sin((time||0)*.0016+x*.8+y*.6)*a*.12;
        for(var ripple=0;ripple<2;ripple++){
          var ry=p.y+(ripple?b*.35:-b*.25),rx=p.x+drift+(ripple?a*.18:-a*.15);
          c.beginPath();c.moveTo(rx-a*.3,ry);c.quadraticCurveTo(rx,ry-b*.1,rx+a*.3,ry);c.stroke();
        }
      }
      if(channelHere(x,y)){
        var channel=channelHere(x,y),wet=t==='w';
        // Painted guide rails sit flush with the actual route. They never
        // suggest extra walls, cover or traversable water beyond these cells.
        c.strokeStyle=wet?'#90ced3':'#e2c795';c.lineWidth=Math.max(1,a*.055);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dir){
          var next=channelHere(x+dir[0],y+dir[1]);
          if(!next||next.index!==channel.index)waterEdge(x,y,z,dir[0],dir[1]);
        });
        if(!wet){
          c.strokeStyle='#d8c28c';c.lineWidth=Math.max(.8,a*.045);c.setLineDash([a*.12,a*.12]);
          c.beginPath();c.moveTo(p.x-a*.58,p.y);c.lineTo(p.x+a*.58,p.y);c.stroke();c.setLineDash([]);
          c.strokeStyle='#263d3d88';c.lineWidth=Math.max(.6,a*.03);
          c.beginPath();c.moveTo(p.x-a*.2,p.y-b*.45);c.lineTo(p.x+a*.2,p.y+b*.45);c.stroke();
        }
      }
      if(platformHere(x,y)){
        diamond(x,y,z,floor,liftPower?'#ffe1a1':'#a3977e');
        c.strokeStyle='#e5bf76';c.lineWidth=Math.max(1,a*.06);c.beginPath();c.moveTo(p.x-a*.6,p.y);c.lineTo(p.x,p.y+b*.6);c.lineTo(p.x+a*.6,p.y);c.stroke();
        if(bridge){
          // Flush transverse slats distinguish the moving span from water and
          // from Cargo Lift; they add neither opaque railing nor extra cover.
          c.strokeStyle='#f3d093';c.lineWidth=Math.max(.8,a*.045);
          for(var slat=0;slat<3;slat++){
            var s1=P.point(x-.3+slat*.25,y-.38,z),s2=P.point(x-.3+slat*.25,y+.38,z);
            c.beginPath();c.moveTo(s1.x,s1.y);c.lineTo(s2.x,s2.y);c.stroke();
          }
        }
      }
      if(s.defense&&x>=8&&x<=15&&y>=2&&y<=6&&t!== '#'){
        // Flush ward tiles identify the treatment floor without inventing cover.
        c.strokeStyle='#b6d1c226';c.lineWidth=Math.max(.5,a*.025);c.beginPath();c.moveTo(p.x-a*.82,p.y);c.lineTo(p.x,p.y+b*.82);c.lineTo(p.x+a*.82,p.y);c.stroke();
      }
      if(s.lanes&&x>=10&&x<=15&&y>=3&&y<=10&&t!== '#'){
        // Rooftop conduit follows actual floor surfaces; never a route obstacle.
        c.strokeStyle=x%2?'#a9a07b66':'#79a6af55';c.lineWidth=Math.max(.8,a*.045);c.beginPath();c.moveTo(p.x-a*.8,p.y);c.lineTo(p.x+a*.8,p.y);c.stroke();
      }
      if(reachable[x+','+y])diamond(x,y,z,reachable[x+','+y]===1?'#397b8550':'#bda26030','#4a96994a');
      if(t==='e'){c.strokeStyle=boarding?(boardingHere(x,y)?'#ffe09b':'#72828b'):'#80d2bb';c.lineWidth=a*.07;c.beginPath();c.moveTo(p.x-a*.4,p.y);c.lineTo(p.x,p.y+b*.45);c.lineTo(p.x+a*.4,p.y-b*.1);c.stroke();}
      if(!archiveDistrict&&t!== '#' && t!=='w' && y===6){c.strokeStyle=x<8?'#c2975655':'#6caab955';c.lineWidth=a*.04;c.beginPath();c.moveTo(p.x-a*.7,p.y+b*.3);c.lineTo(p.x+a*.7,p.y-b*.3);c.stroke();}
      if(!archiveDistrict&&t!== '#' && t!=='w' && (x*17+y*9)%7===0){c.strokeStyle='#7b969b30';c.lineWidth=a*.025;c.beginPath();c.moveTo(p.x-a*.6,p.y);c.lineTo(p.x-a*.1,p.y+b*.3);c.lineTo(p.x+a*.1,p.y+b*.17);c.stroke();}
    }
    if(s.pumps){
      var pumps=L.pumpStatus(s);
      pumps.pumps.forEach(function(pump){
        var q=P.point(pump.x,pump.y,L.height(s,pump.x,pump.y));
        c.strokeStyle=pumps.done?'#9be1d3':pump.controlled&&pump.staffed?'#ffe1a1':'#ed9d78';
        c.lineWidth=Math.max(1,a*.07);
        // The cross marks the exact cardinal staffing footprint, not cover.
        [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(offset){
          diamond(pump.x+offset[0],pump.y+offset[1],0,'#b9a87915',c.strokeStyle);
        });
        c.beginPath();c.ellipse(q.x,q.y-a*.45,a*.45,b*.65,0,0,Math.PI*2);c.stroke();
        c.beginPath();c.moveTo(q.x-a*.45,q.y-a*.45);c.lineTo(q.x-a*.45,q.y);c.moveTo(q.x+a*.45,q.y-a*.45);c.lineTo(q.x+a*.45,q.y);c.stroke();
      });
      c.fillStyle='#ffe0ab';c.font=Math.max(11*Math.min(d,2),w/110)+'px system-ui';
      c.fillText('TWIN PUMPS / '+pumps.elapsed+'/'+pumps.rounds+' / '+(pumps.done?'PRESSURE LOCKED':pumps.ready?'BOTH STAFFED':'STAFF BOTH PUMPS'),16*Math.min(d,2),h-62*Math.min(d,2));
    }
    var lane=L.activeLane(s), defense=L.defenseStatus(s);
    if(lane)lane.tiles.forEach(function(t){var q=diamond(t.x,t.y,L.height(s,t.x,t.y),'#b34a3455','#ffab83');c.strokeStyle='#ffbe91';c.lineWidth=Math.max(1,a*.05);c.beginPath();c.moveTo(q.x-a*.3,q.y-b*.3);c.lineTo(q.x+a*.3,q.y+b*.3);c.moveTo(q.x-a*.3,q.y+b*.3);c.lineTo(q.x+a*.3,q.y-b*.3);c.stroke();});
    if(defense){
      var q=P.point(s.defense.x,s.defense.y,L.height(s,s.defense.x,s.defense.y));
      // Shield feeds are literal visual connections to the staff ward. Their
      // color follows the selected circuit, with the announced assault in HUD.
      (s.circuits||[]).forEach(function(feed,index){
        var start=P.point(feed.x,feed.y,L.height(s,feed.x,feed.y)),end=P.point(s.defense.x+(index?1:-1),s.defense.y,L.height(s,s.defense.x,s.defense.y));
        c.strokeStyle=feed.controlled?'#9be1d3':'#718c8b66';c.lineWidth=Math.max(1,a*.075);c.setLineDash(feed.controlled?[]:[a*.2,a*.15]);c.beginPath();c.moveTo(start.x,start.y);c.lineTo(end.x,end.y+b*.35);c.lineTo(q.x,q.y);c.stroke();c.setLineDash([]);
      });
      c.strokeStyle=defense.protected?'#9be1d3':'#ffad88';c.lineWidth=Math.max(2,a*.12);c.beginPath();c.ellipse(q.x,q.y,a*.8,b*.8,0,0,Math.PI*2);c.stroke();
    }
    if(lane||defense){
      c.fillStyle='#ffe0ab';c.font=Math.max(11*Math.min(d,2),w/110)+'px system-ui';
      var text=lane?'FIRING / '+lane.label+' / '+lane.damage+' HP':defense.done?'CLINIC SECURED / '+defense.hp+' HP':'CLINIC / '+defense.hp+' HP / '+defense.lane.toUpperCase()+' '+(defense.protected?'COVERED':'EXPOSED');
      c.fillText(text,16*Math.min(d,2),h-62*Math.min(d,2));
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
      if(bridge){
        // Thin dashed travel guides cross only the water. They never resemble
        // floor tiles; the gold occupied deck is the sole traversable span.
        var first=lift.stops[0],last=lift.stops[lift.stops.length-1];
        [-.48,lift.size-.52].forEach(function(edge){
          var start=P.point(first.x-.45,first.y+edge,first.z),end=P.point(last.x+lift.size-.55,last.y+edge,last.z);
          c.strokeStyle='#c3ae7955';c.lineWidth=Math.max(.7,a*.035);c.setLineDash([a*.12,a*.28]);
          c.beginPath();c.moveTo(start.x,start.y);c.lineTo(end.x,end.y);c.stroke();c.setLineDash([]);
        });
      }else [[0,0],[lift.size-1,lift.size-1]].forEach(function(offset){
        var q=P.point(liftStop.x+offset[0],liftStop.y+offset[1],liftStop.z);
        c.strokeStyle='#a3b1aa88';c.lineWidth=Math.max(1,a*.05);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-a*2.8);c.stroke();
        c.fillStyle='#f0ce86';c.fillRect(q.x-a*.08,q.y-a*.3,a*.16,a*.3);
      });
      c.fillStyle=liftPower?'#ffe1a1':'#bcc7c6';c.font=Math.max(11*Math.min(d,2),w/100)+'px system-ui';
      c.fillText((bridge?'BRIDGE ':'POWER ')+(liftPower?'ON / ':'OFF / ')+liftStop.label,16*Math.min(d,2),h-62*Math.min(d,2));
      c.fillText(bridge?'HACK deck/console / 1 AP / return trips':'HACK, then deck/console / 1 AP',16*Math.min(d,2),h-42*Math.min(d,2));
    }
    if(s.water){
      c.fillStyle='#aedbe0';c.font=Math.max(11*Math.min(d,2),w/110)+'px system-ui';
      c.fillText('BLUE / FLOODED - HACK DRAIN RELAY',16*Math.min(d,2),h-62*Math.min(d,2));
      c.fillStyle='#e2c795';
      c.fillText('GOLD DASHES / DRY CROSSING',16*Math.min(d,2),h-42*Math.min(d,2));
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
    circuits.forEach(function(n){var node=P.point(n.x,n.y,L.height(s,n.x,n.y));c.strokeStyle=n.controlled?'#6ee5ca':keyPair&&keyPair.armedId===n.id?'#d4c7ff':'#e4b778';c.lineWidth=a*.085;c.setLineDash([a*.25,a*.15]);
      (n.doors||[]).concat(n.turret?[s.turret]:[]).forEach(function(d){var p=P.point(d.x,d.y,L.height(s,d.x,d.y));c.beginPath();c.moveTo(node.x,node.y);c.lineTo(p.x,p.y);c.stroke();});c.setLineDash([]);});
    if(view.preview&&view.preview.legal&&view.preview.path){c.strokeStyle='#b7edf0';c.lineWidth=a*.11;c.beginPath();view.preview.path.forEach(function(p,i){var q=P.point(p.x,p.y,L.height(s,p.x,p.y));if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();}
    for(var depth=0;depth<s.width+s.height;depth++)for(var y=0;y<s.height;y++) {
      var x=depth-y;if(x<0||x>=s.width)continue;
      var t=L.tile(s,x,y),z=L.height(s,x,y),p=P.point(x,y,z);
      if(t==='#'&&archiveDistrict)archiveWall(x,y);
      else if(t==='#'&&!shaftHere(x,y)) {
        // Front perimeter stays low so it cannot obscure engineers.
        var height=(y===s.height-1||x===s.width-1)?0.35:x===8?1.25:0.7;
        var q=block(x,y,height,'#566770','#243640','#33464f');
        c.strokeStyle='#90a2a944';c.lineWidth=a*.04;c.beginPath();c.moveTo(q.x-a*.7,q.y);c.lineTo(q.x+a*.5,q.y-b*.45);c.stroke();
      }
      if(t==='c'&&archiveDistrict)archiveShelf(x,y,p);
      else if(t==='c') {
        var medical=s.defense&&y===5&&(x===8||x===12);
        var top=block(x,y,.55,medical?'#b5c9ba':'#61787b',medical?'#45625e':'#30464c',medical?'#698a7d':'#3d565c');
        if(medical){c.strokeStyle='#e2efe4';c.lineWidth=Math.max(1,a*.08);c.beginPath();c.moveTo(top.x-a*.42,top.y);c.lineTo(top.x+a*.42,top.y);c.moveTo(top.x,top.y-b*.45);c.lineTo(top.x,top.y+b*.45);c.stroke();}
        else{c.fillStyle='#c7b27e';c.fillRect(p.x-a*.4,p.y-a*.3,a*.3,a*.05);}
      }
      if(s.defense&&t==='#'&&(x===7||x===16)&&y===4){
        var sign=P.point(x,y,z+.75);c.fillStyle='#b9dacc';c.fillRect(sign.x-a*.28,sign.y-a*.55,a*.56,a*.62);c.fillStyle='#2d6c61';c.fillRect(sign.x-a*.07,sign.y-a*.48,a*.14,a*.46);c.fillRect(sign.x-a*.22,sign.y-a*.33,a*.44,a*.14);
      }
      if(t==='d') {
        if(!L.doorOpen(s,x,y)){block(x,y,1.3,'#ba9a66','#63553f','#847047');c.strokeStyle='#ffe0a0';c.lineWidth=a*.07;c.beginPath();c.moveTo(p.x-a*.45,p.y-a*.25);c.lineTo(p.x+a*.25,p.y-a*.65);c.stroke();}
        else {diamond(x,y,z,'#3e766d','#80d9bd');}
      }
      if(t==='n') {
        var circuit=L.circuitAt(s,x,y),consoleHere=lift&&lift.stops.some(function(stop){return stop.console.x===x&&stop.console.y===y;}),on=consoleHere?liftPower:circuit?circuit.controlled:s.network;
        var q=block(x,y,.5,on?'#8bdfc4':'#e9c485','#4c5a59','#647775');
        c.fillStyle=on?'#91ffe2':'#ffe1a1';c.beginPath();c.arc(q.x,q.y-a*.2,a*.17,0,Math.PI*2);c.fill();
        if(consoleHere){
          if(bridge){
            // Winch drum belongs to the actual fixed console. A low silhouette
            // avoids hiding its target tile or neighboring squad members.
            c.strokeStyle=on?'#c4e9d4':'#dfbf87';c.lineWidth=Math.max(1,a*.07);
            c.beginPath();c.ellipse(q.x,q.y-a*.25,a*.33,a*.16,-.45,0,Math.PI*2);c.stroke();
          }
          c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText(bridge?'B':'L',q.x,q.y-a*.65);c.textAlign='start';
        }
        var marker=archiveMarker(x,y);
        if(broadcast&&circuit===transmitter){
          // The aerial marks the actual transmitter tile.
          c.strokeStyle=signalInk;c.lineWidth=Math.max(1,a*.07);
          c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x,q.y-a*.94);
          c.moveTo(q.x-a*.3,q.y-a*.73);c.lineTo(q.x+a*.3,q.y-a*.73);c.stroke();
          if(broadcast.active){
            c.beginPath();c.arc(q.x,q.y-a*.94,a*.47,Math.PI*1.15,Math.PI*1.85);c.stroke();
          }
          mapBadge(q,'D',signalInk,1.48);
        }else if(broadcast&&circuit&&circuit.id==='ghost-evidence'){
          mapBadge(q,'E',on?'#a1e9d7':'#ffd998',.62);
        }else if(marker){
          mapBadge(q,marker,on?'#a1e9d7':marker==='E'?'#ffd998':marker==='B'?'#c2bdff':'#bbcbd9',.62);
        }else if(s.circuits&&circuit&&!keyPair){c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText(String(s.circuits.indexOf(circuit)+1),q.x,q.y-a*.65);c.textAlign='start';}
      }
      if(s.lanes&&t==='n'&&L.circuitAt(s,x,y)&&L.circuitAt(s,x,y).id===s.lanes.disabledBy){
        // The command mast is attached to its real interactable tile. A narrow
        // wireframe silhouette leaves neighboring floor and actors legible.
        var on=L.circuitAt(s,x,y).controlled,tipY=p.y-a*2.8;
        c.strokeStyle=on?'#80d5c0':'#d9b87b';c.lineWidth=Math.max(1,a*.065);c.beginPath();c.moveTo(p.x-a*.3,p.y-a*.18);c.lineTo(p.x,tipY);c.lineTo(p.x+a*.3,p.y-a*.18);c.moveTo(p.x-a*.2,p.y-a*.9);c.lineTo(p.x+a*.2,p.y-a*.9);c.moveTo(p.x-a*.13,p.y-a*1.6);c.lineTo(p.x+a*.13,p.y-a*1.6);c.stroke();
        c.strokeStyle=on?'#b3eee1':'#f4d49b';c.lineWidth=Math.max(1,a*.1);c.beginPath();c.ellipse(p.x+a*.22,tipY+a*.6,a*.45,a*.23,-.55,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(p.x+a*.22,tipY+a*.6);c.lineTo(p.x+a*.6,tipY+a*.23);c.stroke();
        c.fillStyle=on?'#8fe6ca':'#ffbf84';c.beginPath();c.arc(p.x,tipY,a*.085,0,Math.PI*2);c.fill();
      }
      if(x===s.turret.x&&y===s.turret.y){
        block(x,y,.5,'#8c9c9b','#3c535c','#4d6d71');c.strokeStyle=L.turretAllied(s)?'#84f4ce':'#ef8c78';c.lineWidth=a*.18;c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y-a*.6);c.lineTo(p.x+a*.55,p.y-a*.85);c.stroke();
        c.fillStyle=L.turretAllied(s)?'#72e1c2':'#e88b73';c.beginPath();c.arc(p.x,p.y-a*.55,a*.25,0,Math.PI*2);c.fill();
      }
      if(t==='r'&&!s.rescued){c.strokeStyle='#f8cf86';c.lineWidth=a*.06;c.beginPath();c.arc(p.x,p.y-a*.35,a*.3,0,Math.PI*2);c.stroke();c.fillStyle='#f8cf86';c.fillRect(p.x-a*.13,p.y-a*.4,a*.26,a*.6);}
      if(s.lighting)(s.lighting.zones||[]).forEach(function(zone){
        if(zone.x!==x||zone.y!==y)return;
        var on=(s.circuits||[]).some(function(feed){return feed.id===zone.circuitId&&feed.controlled;});
        // Short work-lamp fixtures sit on their authored source tile and leave
        // adjacent tactical targets visible, even at the default phone zoom.
        c.strokeStyle=on?'#d7bd87':'#7c8e9a';c.lineWidth=Math.max(1,a*.07);
        c.beginPath();c.moveTo(p.x-a*.3,p.y);c.lineTo(p.x-a*.3,p.y-a*.8);c.lineTo(p.x+a*.12,p.y-a*.8);c.stroke();
        if(on){var glow=c.createRadialGradient(p.x,p.y-a*.75,0,p.x,p.y-a*.75,a*.6);glow.addColorStop(0,'#ffe7ad66');glow.addColorStop(1,'#ffe7ad00');c.fillStyle=glow;c.fillRect(p.x-a*.6,p.y-a*1.35,a*1.2,a*1.2);}
        c.fillStyle=on?'#ffe5a6':'#718895';c.fillRect(p.x-a*.03,p.y-a*.86,a*.34,a*.12);
      });
      // A compact medical crate rides until delivered, then remains beside
      // the upper landing while the empty platform can return for stragglers.
      if(lift&&!bridge&&s.rescued&&(lift.delivered?x===15&&y===8:x===liftStop.x&&y===liftStop.y)){
        var q=P.point(x-.3,y-.3,z);c.fillStyle='#698d87';c.fillRect(q.x-a*.18,q.y-a*.47,a*.36,a*.32);c.fillStyle='#d9f3df';c.fillRect(q.x-a*.04,q.y-a*.44,a*.08,a*.24);c.fillRect(q.x-a*.13,q.y-a*.36,a*.26,a*.08);
      }
      var actor=L.occupant(s,x,y);
      if(actor){
        var friendly=s.squad.indexOf(actor)!==-1,selected=view.selected===actor.id;
        if(selected){c.strokeStyle='#c1fff0';c.lineWidth=a*.07;c.beginPath();c.ellipse(p.x,p.y,a*.72,b*.72,0,0,Math.PI*2);c.stroke();}
        if(broadcast&&!friendly&&broadcast.patrols.some(function(patrol){return patrol.id===actor.id;})){
          c.strokeStyle=signalInk;c.lineWidth=Math.max(1,a*.08);
          c.beginPath();c.ellipse(p.x,p.y,a*.7,b*.68,0,0,Math.PI*2);c.stroke();
        }
        c.fillStyle='#0007';c.beginPath();c.ellipse(p.x+a*.06,p.y+a*.06,a*.36,b*.3,0,0,Math.PI*2);c.fill();
        c.strokeStyle=s.lighting&&!L.lit(s,x,y)?'#a9c2cf':'#0b1c25';c.lineWidth=a*.09;c.fillStyle=friendly?actor.color:'#d27f70';
        c.beginPath();c.moveTo(p.x-a*.22,p.y-a*.25);c.lineTo(p.x-a*.18,p.y-a*.75);c.lineTo(p.x+a*.16,p.y-a*.8);c.lineTo(p.x+a*.28,p.y-a*.28);c.closePath();c.fill();c.stroke();
        c.fillStyle=friendly?'#d9d8ba':'#7b4b43';c.beginPath();c.arc(p.x,p.y-a*.97,a*.2,0,Math.PI*2);c.fill();
        c.strokeStyle=friendly?'#9fbdba':'#fa9d8b';c.lineWidth=a*.09;c.beginPath();c.moveTo(p.x+a*.17,p.y-a*.56);c.lineTo(p.x+a*.52,p.y-a*.78);c.stroke();
        var barW=a*.85;c.fillStyle='#071823';c.fillRect(p.x-barW/2,p.y-a*1.35,barW,a*.12);c.fillStyle=friendly?'#a6dfc7':'#f29e86';c.fillRect(p.x-barW/2,p.y-a*1.35,barW*actor.hp/actor.maxHp,a*.12);
        if(friendly){c.fillStyle=actor.watch?'#f2d99a':'#b5e6df';for(var i=0;i<actor.ap;i++){c.beginPath();c.arc(p.x-a*.13+i*a*.26,p.y-a*1.6,a*.07,0,Math.PI*2);c.fill();}}
      }
    }
    if(broadcast){
      var court=broadcast.destination;
      mapBadge(P.point(court.x,court.y,L.height(s,court.x,court.y)),'C',signalInk,1.46);
      var signalScale=Math.min(d,2);
      var signalTitle=broadcast.active?'DECOY ACTIVE':'DECOY AVAILABLE';
      var signalKey='D Decoy  /  E Evidence  /  C South court';
      var patrolKey=broadcast.patrols.length===0?'No relay patrols remain':
        broadcast.active?'Ringed patrols divert at End Turn':'HACK D to divert ringed patrols';
      c.font=11*signalScale+'px system-ui';
      var signalPanel=Math.max(c.measureText(signalKey).width,c.measureText(patrolKey).width)+20*signalScale;
      var signalLeft=w>h*1.8?w-16*signalScale-signalPanel:16*signalScale;
      var signalTop=w>h*1.8?12*signalScale:h-99*signalScale;
      c.fillStyle='#101628f2';c.fillRect(signalLeft,signalTop,signalPanel,62*signalScale);
      c.fillStyle=signalInk;c.fillRect(signalLeft,signalTop,2*signalScale,62*signalScale);
      c.font='700 '+12*signalScale+'px system-ui';c.fillText(signalTitle,signalLeft+10*signalScale,signalTop+18*signalScale);
      c.font=11*signalScale+'px system-ui';c.fillStyle='#d5cde7';
      c.fillText(signalKey,signalLeft+10*signalScale,signalTop+36*signalScale);
      c.fillText(patrolKey,signalLeft+10*signalScale,signalTop+52*signalScale);
    }
    if(view.preview){var p=P.point(view.preview.x,view.preview.y,L.height(s,view.preview.x,view.preview.y));c.strokeStyle=view.preview.legal?'#fce0a4':'#e7988b';c.lineWidth=a*.08;c.beginPath();c.ellipse(p.x,p.y,a*.82,b*.82,0,0,Math.PI*2);c.stroke();}
    if(keyPair){
      var keyScale=Math.min(d,2),keySize=Math.max(17*keyScale,Math.min(25*keyScale,a)),keyLeft=16*keyScale,keyTop=h-84*keyScale;
      var armed=keyPair.keys.find(function(key){return key.id===keyPair.armedId;});
      var keyTint=keyPair.opened?'#a1e9d7':armed?'#d4c7ff':'#ffd998';
      keyPair.keys.forEach(function(key,index){
        var q=P.point(key.x,key.y,L.height(s,key.x,key.y)),top=q.y-a*1.15-keySize;
        c.fillStyle='#14192b';c.fillRect(q.x-keySize/2,top,keySize,keySize);
        c.strokeStyle=keyPair.opened||key===armed?keyTint:'#ffd998';c.lineWidth=keyScale;
        c.strokeRect(q.x-keySize/2,top,keySize,keySize);
        c.fillStyle=c.strokeStyle;c.font='700 '+Math.round(keySize*.65)+'px system-ui';c.textAlign='center';
        c.fillText(index===0?'N':'S',q.x,top+keySize*.74);c.textAlign='start';
      });
      var keyStatus=keyPair.opened?'VAULT OPEN':armed?(armed===keyPair.keys[0]?'N':'S')+' ARMED / HACK '+(armed===keyPair.keys[0]?'S':'N')+' THIS TURN':'HACK BOTH KEYS IN ONE TURN';
      var keyLegend='N North key  /  S South key';
      c.font='700 '+12*keyScale+'px system-ui';
      var keyPanel=c.measureText(keyStatus).width;
      c.font=11*keyScale+'px system-ui';
      keyPanel=Math.max(keyPanel,c.measureText(keyLegend).width)+20*keyScale;
      c.fillStyle='#101628f2';c.fillRect(keyLeft,keyTop,keyPanel,47*keyScale);
      c.fillStyle=keyTint;c.fillRect(keyLeft,keyTop,2*keyScale,47*keyScale);
      c.font='700 '+12*keyScale+'px system-ui';c.fillText(keyStatus,keyLeft+10*keyScale,keyTop+18*keyScale);
      c.font=11*keyScale+'px system-ui';c.fillStyle='#c7c5df';c.fillText(keyLegend,keyLeft+10*keyScale,keyTop+36*keyScale);
    }
    if(archive){
      var archiveScale=Math.min(d,2),left=16*archiveScale,top=h-84*archiveScale;
      var status=archive.purged?'EVIDENCE PURGED':archive.secured?'EVIDENCE SECURED':'PURGE AT END OF TURN '+archive.deadline;
      var key='E Evidence  /  B Breaker  /  S Shutter';
      c.font='700 '+12*archiveScale+'px system-ui';
      var statusWidth=c.measureText(status).width;
      c.font=11*archiveScale+'px system-ui';
      var panel=Math.max(statusWidth,c.measureText(key).width)+20*archiveScale;
      c.fillStyle='#101628f2';c.fillRect(left,top,panel,47*archiveScale);
      c.fillStyle=archive.purged||!archive.secured&&archive.remaining<=2?'#ffad98':archive.secured?'#a1e9d7':'#ffd998';
      c.fillRect(left,top,2*archiveScale,47*archiveScale);
      c.font='700 '+12*archiveScale+'px system-ui';c.fillText(status,left+10*archiveScale,top+18*archiveScale);
      c.font=11*archiveScale+'px system-ui';c.fillStyle='#c7c5df';c.fillText(key,left+10*archiveScale,top+36*archiveScale);
    }
    if(s.lighting){
      // Fixed-size chart key stays separate from world labels and actor depth.
      // All patrols remain visible: darkness changes acquisition, not knowledge.
      var scale=Math.min(d,2),pad=16*scale;
      c.font=11*scale+'px system-ui';c.fillStyle='#07131ee8';
      c.fillRect(pad-6*scale,h-96*scale,Math.min(w-pad*2+12*scale,268*scale),80*scale);
      c.fillStyle='#b9d5e5';c.fillText('DARK / DETECT WITHIN '+s.lighting.darkRange+' TILES',pad,h-78*scale);
      c.fillStyle='#ffe0a5';c.fillText('LIT / NORMAL FIRING RANGE',pad,h-59*scale);
      c.fillStyle='#b9cbd3';c.fillText('PATROLS SHOWN ON TACTICAL CHART',pad,h-40*scale);
    }
    // HUD belongs to DOM. This map legend remains readable independently of zoom.
    c.fillStyle='#93b3bf';c.font=Math.max(10,w/100)+'px system-ui';c.fillText(s.district.toUpperCase()+' / '+String(s.sequence||1).padStart(2,'0'),16*Math.min(d,2),h-18*Math.min(d,2));
    return P;
  }
  SB.Render={draw:draw,projection:projection};
})(window);
