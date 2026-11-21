(function (global) {
  'use strict';
  var SB = global.SB = global.SB || {};
  // Feet are at (0,0) in each engraving. The outside contour carries the
  // equipment shape even when the whole figure is only a dozen pixels tall.
  var uniforms = {
    nia: [
      ['#273d46','M-5 -5 L-6 -12 L-4 -13 L-4 -17 L-3 -17 L-3 -12 L-1 -12 L1 -14 L4 -13 L5 -9 L4 -6 L1 -4 Z'],
      ['coat','M-3 -11 L1 -12 L4 -10 L3 -5 L-4 -4 Z'],
      ['#ffe2a9','M-3 -13 Q-3 -18 1 -18 Q4 -18 4 -14 L6 -13 L6 -12 L-4 -12 Z'],
      ['#b77f52','M0 -12 L4 -12 L3 -10 L1 -10 Z'],
      ['#45545b','M-4 -11 L-2 -11 L-1 -5 L-3 -5 Z'],
      ['#eff0d0','M2 -7 L6 -11 L6 -13 L8 -14 L7 -12 L9 -12 L8 -10 L6 -10 L3 -6 Z']
    ],
    sol: [
      ['#234c4a','M-5 -4 L-5 -12 L-3 -14 L-3 -18 L1 -19 L4 -17 L4 -13 L6 -11 L6 -4 Z'],
      ['coat','M-4 -16 Q-4 -20 0 -20 Q4 -20 4 -17 L4 -15 L1 -16 L-3 -15 Z'],
      ['#c8956c','M-1 -16 L4 -16 L3 -13 L0 -13 Z'],
      ['#f3f0d7','M-4 -13 L3 -14 L5 -11 L5 -4 L-4 -4 Z'],
      ['#16776a','M-1 -12 L2 -12 L2 -10 L4 -10 L4 -7.5 L2 -7.5 L2 -5 L-1 -5 L-1 -7.5 L-3 -7.5 L-3 -10 L-1 -10 Z']
    ],
    rook: [
      ['#253548','M-7 -3 L-5 -8 L2 -14 L5 -9 L3 -7 L7 -7 L7 -5 L2 -4 L-4 -2 Z'],
      ['coat','M-7 -3 L-5 -8 L2 -14 L4 -10 L0 -9 L-3 -5 Z'],
      ['#557aa1','M-7 -3 L-2 -6 L2 -8 L2 -5 L-1 -3 Z'],
      ['#d6f4ff','M0 -10 L2 -14 L5 -9 L3 -8 Z'],
      ['#293d52','M1 -9 L5 -10 L4 -8 L2 -8 Z'],
      ['#cccaa7','M0 -6 L3 -7 L7 -8 L7 -6.5 L2 -5 Z']
    ],
    ivo: [
      ['#413c3b','M-7 -5 L-7 -11 L-4 -13 L-3 -16 L2 -16 L4 -13 L6 -12 L7 -6 L4 -4 L-2 -3 Z'],
      ['coat','M-7 -12 L-4 -13 L0 -12 L4 -13 L6 -10 L4 -6 L-6 -5 Z'],
      ['#c8b19e','M-3 -16 L-2 -18 L2 -18 L4 -15 L3 -13 L-3 -13 Z'],
      ['#3c3b39','M-2 -15 L4 -16 L4 -14 L-1 -13 Z'],
      ['#ffc89e','M-8 -12 L-5 -14 L-1 -13 L0 -10 L-6 -9 L-8 -10 Z'],
      ['#635453','M-4 -8 L2 -10 L8 -10 L8 -7 L3 -6 L-4 -5 Z'],
      ['#d6cdb7','M2 -10 L8 -10 L8 -9 L2 -8 Z']
    ],
    patrol: [
      ['#5a393d','M-5 -5 L-5 -10 L-2 -12 L-3 -15 L0 -17 L4 -16 L5 -12 L3 -11 L5 -9 L6 -6 L1 -4 Z'],
      ['#ce7968','M-5 -10 L-2 -12 L1 -11 L4 -12 L5 -9 L2 -6 L-4 -5 Z'],
      ['#854e4d','M-4 -14 L-2 -17 L3 -17 L5 -14 L4 -12 L-3 -12 Z'],
      ['#ffb29a','M0 -14 L5 -15 L5 -13 L1 -12 Z'],
      ['#313d48','M-3 -7 L3 -10 L9 -10 L9 -8 L4 -8 L2 -6 L-2 -5 Z']
    ]
  };
  var uniformPaths;
  function drawOperator(c, actor, friendly, p, a, inCover, dark) {
    if (!uniformPaths) {
      uniformPaths = {};
      Object.keys(uniforms).forEach(function (id) {
        uniformPaths[id] = uniforms[id].map(function (layer) { return [layer[0], new Path2D(layer[1])]; });
      });
    }
    var layers=uniformPaths[friendly?actor.id:'patrol'];
    var stride=actor.id==='ivo'?1.1:1, size=a*.077;
    c.save();
    c.translate(p.x,p.y);
    c.scale(friendly?size:-size,size);
    c.lineJoin='round';
    c.strokeStyle='#0b1c27';c.lineWidth=1.7;
    // Kneeling changes the legs and lowers the shoulders on a traversable cover tile.
    c.fillStyle='#809191';c.beginPath();
    if(inCover){c.moveTo(-4,-5);c.lineTo(3,-5);c.lineTo(5,-2);c.lineTo(4,0);c.lineTo(1,0);c.lineTo(0,-2);c.lineTo(-2,0);c.lineTo(-7,0);c.lineTo(-7,-2);}
    else{c.moveTo(-4,-6);c.lineTo(3,-6);c.lineTo(4*stride,-1);c.lineTo(5*stride,0);c.lineTo(1,0);c.lineTo(-.5,-3);c.lineTo(-2,0);c.lineTo(-6*stride,0);c.lineTo(-5*stride,-2);}
    c.closePath();c.stroke();c.fill();
    if(inCover)c.translate(0,2);
    c.lineWidth=1.9;c.strokeStyle=dark?'#a9c2cf':'#0b1c27';c.stroke(layers[0][1]);
    layers.forEach(function(layer){c.fillStyle=layer[0]==='coat'?actor.color:layer[0];c.fill(layer[1]);});
    c.restore();
  }
  function switchyardCover(c,p,a) {
    // The front lip comes up to a crouching operator's knees.
    c.save();c.translate(p.x,p.y-a*.13);c.scale(a,a);
    c.beginPath();c.ellipse(0,.12,.81,.28,0,0,Math.PI*2);c.fillStyle='#13232c';c.fill();
    c.fillStyle='#53676a';c.beginPath();c.moveTo(-.79,-.16);c.lineTo(-.02,.18);c.lineTo(-.02,.43);c.lineTo(-.79,.07);c.closePath();c.fill();
    c.fillStyle='#21383f';c.beginPath();c.moveTo(-.02,.18);c.lineTo(.76,-.21);c.lineTo(.76,.05);c.lineTo(-.02,.43);c.closePath();c.fill();
    c.fillStyle='#91a6a1';c.beginPath();c.moveTo(-.79,-.16);c.lineTo(-.03,-.53);c.lineTo(.76,-.21);c.lineTo(-.02,.18);c.closePath();c.fill();
    c.lineWidth=.12;c.strokeStyle='#52686a';c.beginPath();
    c.moveTo(-.51,-.26);c.lineTo(.25,.06);c.moveTo(-.24,-.39);c.lineTo(.51,-.07);c.stroke();
    c.lineWidth=.1;c.strokeStyle='#e4ddba';c.beginPath();
    c.moveTo(-.75,-.15);c.lineTo(-.05,.15);c.lineTo(.71,-.19);c.stroke();
    c.restore();
  }
  function evacuationBand(w) {
    var scale = Math.min(global.devicePixelRatio || 1, 2);
    return (w < 640 * scale ? 52 : 32) * scale;
  }
  function projection(w, h, s, view) {
    if (s.evacuation) h -= evacuationBand(w) + 24 * Math.min(global.devicePixelRatio || 1, 2);
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
    var finale=s.id==='signalbreak',broadcast=s.broadcast&&L.broadcastStatus(s);
    var convoy=s.convoy&&L.convoyStatus(s);
    var evacuation=s.evacuation&&L.evacuationStatus(s);
    var civilianInks={chapel:'#9de8fc',kiln:'#ffc58c'};
    var relay=s.relaySiege&&L.relaySiegeStatus(s);
    var stairsHintOnTop=relay&&w<420*Math.min(d,2);
    var railCells=convoy?new Set(s.convoy.route.map(function(cell){return cell.x+','+cell.y;})):null;
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
    var lift=s.lift, bridge=lift&&lift.kind==='bridge', breach=lift&&lift.kind==='breach';
    var marketRoof=s.id==='rooftop-crossfire', cargoLift=s.id==='cargo-lift';
    var liftInfo=lift&&L.liftStatus(s),liftStop=lift&&lift.stops[liftInfo.position],liftPower=liftInfo&&liftInfo.powered;
    var breachFloors=breach&&[
      {floor:'#494740',panel:'#555149',side:'#2a2b2a',face:'#3a3934',wall:'#756f60',cover:'#917f62',detail:'#c3a681'},
      {floor:'#344e51',panel:'#3d5959',side:'#233a3e',face:'#30464a',wall:'#627d7b',cover:'#799992',detail:'#9edbd0'},
      {floor:'#3d4155',panel:'#484c64',side:'#282d3e',face:'#34394e',wall:'#767e9d',cover:'#949bb5',detail:'#c9cfff'}
    ];
    var breachNodes={'breach-hoist':'P','breach-interlock':'I','breach-command':'C'};
    function shaftHere(x,y){return lift&&!bridge&&!breach&&x>=8&&x<=14&&y>0&&y<s.height-1;}
    function platformHere(x,y){return liftStop&&x>=liftStop.x&&x<liftStop.x+lift.size&&y>=liftStop.y&&y<liftStop.y+lift.size;}
    function chartLine(p,q,ink,weight){
      c.strokeStyle=ink;c.lineWidth=weight;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
    }
    function chartFace(points,ink){
      c.fillStyle=ink;c.beginPath();c.moveTo(points[0].x,points[0].y);
      for(var i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);
      c.closePath();c.fill();
    }
    function stallAwning(x,y){
      // The canvas roofing sits on the solid kiosk walls.
      var z=L.height(s,x,y),warm= y<6;
      function roof(dx,dy,rise){return P.point(x+dx,y+dy,z+rise);}
      for(var stripe=0;stripe<2;stripe++){
        var left=-.5+stripe*.5,right=left+.5;
        chartFace([roof(left,-.48,1.18),roof(right,-.48,1.18),roof(right,.47,.71),roof(left,.47,.71)],
          stripe?(warm?'#dfb992':'#a6c7bb'):(warm?'#b86b53':'#477b78'));
        chartFace([roof(left,.47,.71),roof(right,.47,.71),roof(right-.05,.47,.42),
          roof(left+.12,.47,.38),roof(left,.47,.48)],stripe?'#a7a68b':warm?'#824c46':'#345e61');
      }
    }
    function marketStair(stair){
      var low=L.height(s,stair.x,stair.y),high=L.height(s,stair.toX,stair.toY);
      var open=!L.blocked(s,stair.toX,stair.toY);
      var ink=stair.used?'#96e1cb':open?'#ffda95':'#d29d90';
      function edge(step,side){return P.point(stair.x+(stair.toX-stair.x)*step,stair.y+side,low+(high-low)*step);}
      chartFace([edge(0,-.41),edge(1,-.41),edge(1,.41),edge(0,.41)],'#273738');
      for(var tread=0;tread<=4;tread++)chartLine(edge(tread/4,-.39),edge(tread/4,.39),ink,Math.max(.8,a*.083));
      chartLine(edge(0,-.42),edge(1,-.42),ink,Math.max(1,a*.10));
    }
    function marketSign(foot,anchor,label,ink,below){
      var scale=Math.min(d,2);
      var size=Math.max(10*scale,Math.min(15*scale,a*.72)),padding=4*scale;
      c.font='700 '+size+'px system-ui';
      var wide=c.measureText(label).width+2*padding,high=size+6*scale;
      if(foot.x<0||foot.x>w||foot.y<0||foot.y>h)return;
      var left=Math.max(2*scale,Math.min(w-wide-2*scale,anchor.x-wide/2));
      var top=Math.max(2*scale,Math.min(h-high-2*scale,below?anchor.y:anchor.y-high));
      var end={x:left+wide/2,y:below?top:top+high};
      chartLine(foot,end,'#10242c',Math.max(2*scale,a*.15));
      chartLine(foot,end,ink,Math.max(.85*scale,a*.058));
      c.beginPath();c.ellipse(foot.x,foot.y,Math.max(2.4*scale,a*.34),Math.max(1.65*scale,b*.41),0,0,2*Math.PI);
      c.strokeStyle='#14222b';c.lineWidth=Math.max(2.5*scale,a*.17);c.stroke();
      c.strokeStyle=ink;c.lineWidth=Math.max(scale,a*.075);c.stroke();
      c.fillStyle='#13242d';c.fillRect(left,top,wide,high);
      c.fillStyle=ink;c.fillRect(left,top,2*scale,high);c.fillText(label,left+padding,top+size+2*scale);
    }
    function stairSign(stair,index){
      var north=index===0,open=!L.blocked(s,stair.toX,stair.toY);
      var ink=stair.used?'#9fe6ce':open?'#ffe1a5':'#ffc4aa';
      var label=(north?'N ':'S ')+(stair.used?'✓':open?'OPEN':'LOCKED');
      var foot=P.point(stair.x,stair.y,L.height(s,stair.x,stair.y));
      var anchor=north?P.point(stair.x,-1,2.9):P.point(stair.x,s.height+1,0);
      marketSign(foot,anchor,label,ink,!north);
    }
    function drawMarketSigns(){
      // Screen-space leaders cross raised parapets. Mask the figures and their
      // vitals so the route annotations always pass behind squad and patrol.
      c.save();
      s.squad.concat(s.enemies).filter(L.living).forEach(function(actor){
        var pos=P.point(actor.x,actor.y,L.height(s,actor.x,actor.y));
        c.beginPath();c.rect(0,0,w,h);c.rect(pos.x-a*.71,pos.y-a*2.2,a*1.42,a*2.34);
        c.clip('evenodd');
      });
      if(marketRoof)s.stairs.forEach(stairSign);
      else{
        var trolleyPin=P.point(liftStop.x+.52,liftStop.y-.52,liftStop.z+2.4);
        var count=liftInfo.passengers;
        marketSign(trolleyPin,P.point(liftStop.x+.5,-.8,liftStop.z+3.4),'LIFT '+count+'/4',
          count===4?'#a6f0d3':liftPower?'#ffe1a5':'#d3c2a9');
      }
      c.restore();
    }
    function cargoHoist(){
      var lower=lift.stops[0],upper=lift.stops[1],side=-.52;
      // A fixed inclined truss carries a trolley directly over the current deck.
      function rail(stop,extra){return P.point(stop.x+.52,stop.y+side,stop.z+extra);}
      function spanPoint(t,extra){return P.point(lower.x+.52+(upper.x-lower.x)*t,
        lower.y+side+(upper.y-lower.y)*t,lower.z+(upper.z-lower.z)*t+extra);}
      var lo=rail(lower,3.5),hi=rail(upper,3.5),baseLo=rail(lower,2.4),baseHi=rail(upper,2.4);
      chartLine(rail(lower,0),lo,'#af9171',Math.max(1.2,a*.15));
      chartLine(rail(upper,0),hi,'#af9171',Math.max(1.2,a*.15));
      chartFace([lo,hi,baseHi,baseLo],'#333733');
      for(var span=0;span<5;span++){
        chartLine(spanPoint(span/5,span%2?3.5:2.4),spanPoint((span+1)/5,span%2?2.4:3.5),
          '#c39558',Math.max(1,a*.11));
      }
      chartLine(lo,hi,'#c5a373',Math.max(1.5,a*.14));
      chartLine(baseLo,baseHi,'#927c61',Math.max(1,a*.10));
      var trolley=rail(liftStop,2.4),hub=rail(liftStop,.23);
      chartLine(trolley,hub,'#e3cba0',Math.max(.8,a*.075));
      c.fillStyle='#413e3a';c.strokeStyle='#d2b483';c.lineWidth=Math.max(1,a*.09);
      c.beginPath();c.arc(trolley.x,trolley.y,Math.max(2,a*.24),0,Math.PI*2);c.fill();c.stroke();
      // A continuous rim joins the four load cells. The apron remains visible
      // when four engineers are standing over their painted boarding marks.
      var far=lift.size-.5;
      function rim(x,y,drop){return P.point(liftStop.x+x,liftStop.y+y,liftStop.z+drop);}
      var front=rim(far,far,0),left=rim(-.5,far,0),right=rim(far,-.5,0);
      chartFace([left,front,rim(far,far,-.56),rim(-.5,far,-.56)],'#66533f');
      chartFace([front,right,rim(far,-.5,-.56),rim(far,far,-.56)],'#82684a');
      chartLine(left,front,'#ffdda3',Math.max(1,a*.12));chartLine(front,right,'#efd39c',Math.max(1,a*.12));
    }
    function breachDockInk(index){
      if(index===2&&!liftInfo.topUnlocked)return '#f6a28e';
      if(liftInfo.position===index&&liftPower)return '#ffe1a1';
      return breachFloors[index].detail;
    }
    function boardingHere(x,y){return boarding&&boarding.open&&boarding.tiles.some(function(t){return t.x===x&&t.y===y;});}
    function drawFreightLine(){
      var first=s.freight.stops[0].tiles[0],lastStop=s.freight.stops[s.freight.stops.length-1];
      var end=lastStop.tiles[lastStop.tiles.length-1].x+.46,y=first.y;
      function line(x1,y1,x2,y2,ink,weight){
        var u=P.point(x1,y1,0),v=P.point(x2,y2,0);
        c.strokeStyle=ink;c.lineWidth=a*weight;c.beginPath();c.moveTo(u.x,u.y);c.lineTo(v.x,v.y);c.stroke();
      }
      for(var x=first.x-.26;x<end;x+=.5)line(x,y-.5,x,y+.08,'#26343a',.14);
      [-.4,-.05].forEach(function(offset){line(first.x-.46,y+offset,end,y+offset,'#b5beb5',.068);});
      if(!boarding.open)return;
      // The carriage occupies the rear edge of both open boarding cells.
      // Its lit doorway and the foreground platform arrows share a stop.
      var start=boarding.tiles[0].x-.41,finish=boarding.tiles[boarding.tiles.length-1].x+.39;
      function panel(points,ink){
        c.fillStyle=ink;c.beginPath();
        points.forEach(function(pos,i){var q=P.point(pos[0],y+pos[1],pos[2]);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});
        c.closePath();c.fill();
      }
      panel([[start,-.5,1],[finish-.12,-.5,1],[finish,-.39,.86],[finish,-.03,.86],[start,-.03,1]],'#c0c8b6');
      panel([[start,-.03,1],[finish,-.03,.86],[finish,-.03,.17],[start,-.03,.17]],'#a86e49');
      panel([[finish,-.03,.86],[finish,-.39,.86],[finish,-.39,.17],[finish,-.03,.17]],'#455a5b');
      panel([[start+.18,-.02,.82],[start+.65,-.02,.82],[start+.65,-.02,.48],[start+.18,-.02,.48]],'#253f4c');
      panel([[finish-.71,-.02,.75],[finish-.34,-.02,.75],[finish-.34,-.02,.16],[finish-.71,-.02,.16]],'#172d38');
      panel([[finish-.71,-.02,.17],[finish-.34,-.02,.17],[finish-.34,.17,.03],[finish-.71,.17,.03]],'#ffe29a');
      [start+.22,finish-.23].forEach(function(x){
        var q=P.point(x,y-.02,.13);c.fillStyle='#202d35';c.beginPath();c.ellipse(q.x,q.y,a*.105,a*.14,0,0,2*Math.PI);c.fill();
      });
    }
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
    function breachDockSurface(x,y,z,active){
      var index=lift.stops.findIndex(function(stop){
        return x>=stop.x&&x<stop.x+lift.size&&y>=stop.y&&y<stop.y+lift.size;
      });
      if(index<0)return;
      var stop=lift.stops[index],ink=breachDockInk(index);
      var locked=index===2&&!liftInfo.topUnlocked;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dir){
        var nx=x+dir[0],ny=y+dir[1];
        if(nx>=stop.x&&nx<stop.x+lift.size&&ny>=stop.y&&ny<stop.y+lift.size)return;
        c.strokeStyle=ink;
        c.lineWidth=Math.max(.9,a*.085);
        if(!active)c.setLineDash([a*.21,a*.14]);
        waterEdge(x,y,z,dir[0],dir[1]);
        c.setLineDash([]);
      });
      c.strokeStyle=active?ink+'c0':ink+'77';
      c.lineWidth=Math.max(.65,a*.053);
      c.beginPath();
      if(active){
        [-.26,0,.26].forEach(function(rib){
          var near=P.point(x+rib,y-.34,z),far=P.point(x+rib,y+.34,z);
          c.moveTo(near.x,near.y);c.lineTo(far.x,far.y);
        });
      }else{
        var near=P.point(x-.23,y-.23,z),far=P.point(x+.23,y+.23,z);
        c.moveTo(near.x,near.y);c.lineTo(far.x,far.y);
        if(locked){
          near=P.point(x+.23,y-.23,z);far=P.point(x-.23,y+.23,z);
          c.moveTo(near.x,near.y);c.lineTo(far.x,far.y);
        }
      }
      c.stroke();
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
    function mapBadge(point,letter,ink,clearance,tether){
      var scale=Math.min(d,2),size=Math.max(15*scale,Math.min(24*scale,a*1.02));
      var top=point.y-a*clearance-size;
      c.strokeStyle=ink;c.lineWidth=scale;
      if(tether){c.beginPath();c.moveTo(point.x,top+size);c.lineTo(point.x,point.y-a*.44);c.stroke();}
      c.fillStyle='#121c2d';
      c.fillRect(point.x-size/2,top,size,size);c.strokeRect(point.x-size/2,top,size,size);
      c.fillStyle=ink;c.font='700 '+Math.round(size*.69)+'px system-ui';c.textAlign='center';
      c.fillText(letter,point.x,top+size*.75);c.textAlign='start';
    }
    function anchorInk(anchor){
      if(relay.secured)return '#a6bcbf';
      if(!anchor.controlled)return '#a6b6c2';
      return anchor.operatorId?'#91f8cd':'#ffd998';
    }
    function drawCivilianRoutes(){
      evacuation.groups.forEach(function(group,index){
        var route=s.evacuation.groups[index].path,ink=civilianInks[group.id];
        c.save();
        c.lineCap='round';c.lineJoin='round';
        for(var leg=1;leg<route.length;leg++){
          var from=route[leg-1],to=route[leg];
          var start=P.point(from.x,from.y),end=P.point(to.x,to.y);
          var upcoming=leg===group.step+1;
          c.beginPath();c.moveTo(start.x,start.y);c.lineTo(end.x,end.y);
          c.strokeStyle='#14202a';c.lineWidth=Math.max(1.8,a*(upcoming ? .25 : .15));c.stroke();
          c.strokeStyle=leg<=group.step?ink+'58':upcoming?ink:ink+'a0';
          c.lineWidth=Math.max(1,a*(upcoming ? .14 : .08));
          if(group.id==='kiln')c.setLineDash([a*.33,a*.18]);
          c.stroke();c.setLineDash([]);
          c.beginPath();
          if(group.id==='chapel')c.arc(end.x,end.y,a*.14,0,Math.PI*2);
          else c.rect(end.x-a*.12,end.y-a*.12,a*.24,a*.24);
          c.fillStyle=c.strokeStyle;c.fill();
        }
        if(group.next){
          var next=group.next,center=P.point(next.x,next.y);
          var statusInk=!evacuation.released?ink:group.pinned?'#ff9b90':group.guarded?'#9fffc6':ink;
          diamond(next.x,next.y,0,statusInk+'40',null);
          c.strokeStyle=statusInk;c.lineWidth=Math.max(1.2,a*.105);
          if(!group.guarded||!evacuation.released)c.setLineDash([a*.3,a*.14]);
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(dir){waterEdge(next.x,next.y,0,dir[0],dir[1]);});
          c.setLineDash([]);c.beginPath();
          var radius=a*.33;
          if(evacuation.released&&group.pinned){
            c.moveTo(center.x-radius,center.y-radius*.65);c.lineTo(center.x+radius,center.y+radius*.65);
            c.moveTo(center.x-radius,center.y+radius*.65);c.lineTo(center.x+radius,center.y-radius*.65);
          }else if(evacuation.released&&group.guarded){
            c.moveTo(center.x-radius,center.y);c.lineTo(center.x-radius*.2,center.y+radius*.55);c.lineTo(center.x+radius,center.y-radius*.65);
          }else{
            c.arc(center.x,center.y,radius*.63,0,Math.PI*2);
          }
          c.stroke();
        }
        c.restore();
      });
    }
    function civilianGroup(group,p){
      var ink=civilianInks[group.id],chapel=group.id==='chapel';
      // Compact paired figures and a wayfinding pennant stay behind units at this depth.
      c.save();
      c.fillStyle='#18252c';c.beginPath();c.ellipse(p.x,p.y,a*.65,b*.52,0,0,Math.PI*2);c.fill();
      [-.24,.19].forEach(function(offset,index){
        var px=p.x+offset*a,py=p.y+(index ? .14 : -.12)*b;
        var size=index&&chapel?a*.74:a;
        c.fillStyle=index?(chapel?'#e2d1aa':'#bea180'):ink;
        c.beginPath();c.moveTo(px-size*.18,py);c.lineTo(px-size*.12,py-size*.51);
        c.lineTo(px+size*.11,py-size*.51);c.lineTo(px+size*.18,py);c.closePath();c.fill();
        c.fillStyle='#f1d2b1';c.beginPath();c.arc(px,py-size*.65,size*.16,0,Math.PI*2);c.fill();
        if(!chapel){c.fillStyle='#d78e59';c.fillRect(px-size*.18,py-size*.79,size*.36,size*.13);}
      });
      var mastX=p.x-a*.53,mastY=p.y-a*1.22;
      c.strokeStyle='#e8e4d6';c.lineWidth=Math.max(.7,a*.06);
      c.beginPath();c.moveTo(mastX,p.y);c.lineTo(mastX,mastY);c.stroke();
      c.fillStyle=ink;c.beginPath();c.moveTo(mastX,mastY);
      c.lineTo(mastX+a*.65,mastY+(chapel?a*.19:0));
      if(!chapel)c.lineTo(mastX+a*.65,mastY+a*.37);
      c.lineTo(mastX,mastY+a*.37);c.closePath();c.fill();
      c.restore();
    }
    function handoffMarkers(){
      if(!evacuation.released||evacuation.done)return;
      var scale=Math.min(d,2),height=16*scale;
      var boardBottom=h-24*scale-evacuationBand(w);
      var obstacles=[{left:0,top:0,right:180*scale,bottom:56*scale}];
      var people=s.squad.concat(s.enemies).filter(L.living);
      people.concat(evacuation.groups.map(function(group){return group.current;}),[s.turret]).forEach(function(person){
        var foot=P.point(person.x,person.y,L.height(s,person.x,person.y));
        obstacles.push({left:foot.x-a*.64,right:foot.x+a*.64,
          top:foot.y-a*1.75,bottom:foot.y+b*.36});
      });
      function callout(cell,text,ink,side){
        var foot=P.point(cell.x,cell.y,L.height(s,cell.x,cell.y));
        if(foot.x<0||foot.x>w||foot.y<0||foot.y>boardBottom)return;
        var width=(text==='!'?14:28)*scale;
        var reach=Math.max(13*scale,a*.95);
        // Prefer the open street beside the tile; try a longer leader in a crowd.
        var offsets=[[side,0],[side,-.85],[side,.85],[-side,0],[-side,.85],[-side,-.85]];
        for(var distance=1;distance<=3;distance++){
          for(var i=0;i<offsets.length;i++){
            var dx=offsets[i][0],dy=offsets[i][1];
            var anchorX=foot.x+dx*a*.73,anchorY=foot.y+b*.22;
            var near=anchorX+dx*reach*distance,cy=anchorY+dy*reach*distance;
            var left=dx>0?near:near-width,right=left+width,top=cy-height/2,bottom=top+height;
            if(left<1||top<1||right>=w||bottom>=boardBottom)continue;
            if(obstacles.some(function(box){
              return left<box.right&&right>box.left&&top<box.bottom&&bottom>box.top;
            }))continue;
            c.strokeStyle='#101d29';c.lineWidth=3*scale;c.beginPath();
            c.moveTo(anchorX,anchorY);c.lineTo(near,cy);c.stroke();
            c.strokeStyle=ink;c.lineWidth=scale;c.stroke();
            c.fillStyle=ink;c.beginPath();c.arc(anchorX,anchorY,1.45*scale,0,Math.PI*2);c.fill();
            c.fillStyle='#101d29';c.fillRect(left,top,width,height);c.strokeRect(left,top,width,height);
            c.fillStyle=ink;c.fillText(text,left+width/2,cy);
            obstacles.push({left:left-scale,top:top-scale,right:right+scale,bottom:bottom+scale});
            return;
          }
        }
      }
      c.save();c.textAlign='center';c.textBaseline='middle';c.font='bold '+11*scale+'px system-ui';
      var markedPatrols=new Set();
      evacuation.groups.forEach(function(group){
        if(!group.next)return;
        var chapel=group.id==='chapel';
        var glyph=group.pinned?'×':group.guarded?'✓':'○';
        var ink=group.pinned?'#ffb1a5':group.guarded?'#a4f8c6':civilianInks[group.id];
        callout(group.next,(chapel?'C ':'K ')+glyph,ink,chapel?1:-1);
      });
      evacuation.groups.forEach(function(group){
        var patrol=group.pinningPatrols&&group.pinningPatrols[0];
        if(!patrol||markedPatrols.has(patrol.id))return;
        markedPatrols.add(patrol.id);callout(patrol,'!','#ffb1a5',1);
      });
      c.restore();
    }
    function evacuationLedger(){
      var scale=Math.min(d,2),stack=w<640*scale;
      var top=h-24*scale-evacuationBand(w),rowWidth=stack?w:w/2;
      c.save();c.fillStyle='#102331';c.fillRect(0,top,w,evacuationBand(w));
      c.fillStyle='#52656d';c.fillRect(0,top,w,scale);
      evacuation.groups.forEach(function(group,index){
        var left=(stack?0:index*rowWidth)+12*scale;
        var cy=top+(stack?14+index*24:16)*scale;
        var ink=civilianInks[group.id],isChapel=group.id==='chapel';
        c.fillStyle=ink;c.beginPath();
        if(isChapel)c.arc(left+6*scale,cy,6*scale,0,Math.PI*2);
        else c.rect(left,cy-6*scale,12*scale,12*scale);
        c.fill();c.textAlign='center';c.textBaseline='middle';c.font='bold '+9*scale+'px system-ui';
        c.fillStyle='#142733';c.fillText(isChapel?'C':'K',left+6*scale,cy);
        c.textAlign='left';c.font='600 '+11*scale+'px system-ui';c.fillStyle=ink;
        c.fillText(group.label+'  '+group.step+'/'+group.total,left+18*scale,cy);
        var status=group.arrived?'Aboard ferry':!evacuation.released?'In shelter':
          (group.pinned?'Pinned':group.guarded?'Guarded':'Needs guard')+'  ('+group.next.x+','+group.next.y+')';
        c.textAlign='right';c.fillStyle=group.arrived||evacuation.released&&group.guarded&&!group.pinned?'#a8e8bf':
          evacuation.released&&group.pinned?'#ffb3a0':'#dbdee0';
        c.fillText(status,left+rowWidth-24*scale,cy);
      });
      c.restore();
    }
    function corridorWall(x,y){
      var edge=x===0||y===0||x===s.width-1||y===s.height-1;
      var chapel=y<=5,kiln=y>=9;
      var top=chapel?'#7e8582':kiln?'#9f7663':'#687d83';
      var left=chapel?'#364955':kiln?'#594440':'#314851';
      var right=chapel?'#506068':kiln?'#785346':'#425b64';
      var roof=block(x,y,edge ? .24 : chapel ? .86 : kiln ? .76 : .61,top,left,right);
      if(edge)return;
      c.save();
      if(chapel){
        // Stone cornice and recessed lancet on the chapel-facing block.
        c.strokeStyle='#b6b7a3';c.lineWidth=Math.max(.65,a*.05);
        c.beginPath();c.moveTo(roof.x-a*.84,roof.y+b*.23);c.lineTo(roof.x,roof.y+b*1.04);
        c.lineTo(roof.x+a*.84,roof.y+b*.23);c.stroke();
        c.fillStyle='#30434c';c.beginPath();
        c.moveTo(roof.x+a*.32,roof.y+b*1.3);c.lineTo(roof.x+a*.32,roof.y+b*.94);
        c.lineTo(roof.x+a*.49,roof.y+b*.61);c.lineTo(roof.x+a*.64,roof.y+b*.64);
        c.lineTo(roof.x+a*.64,roof.y+b*.95);c.closePath();c.fill();
      }else if(kiln){
        c.strokeStyle='#cea38a';c.lineWidth=Math.max(.55,a*.04);c.beginPath();
        c.moveTo(roof.x-a*.91,roof.y+b*.53);c.lineTo(roof.x,roof.y+b*1.43);
        c.moveTo(roof.x-a*.5,roof.y+b*.5);c.lineTo(roof.x-a*.5,roof.y+b*.92);c.stroke();
        if((x+2*y)%4===0){
          c.fillStyle='#774e40';c.fillRect(roof.x-a*.15,roof.y-a*.39,a*.3,a*.4);
          c.fillStyle='#c79779';c.fillRect(roof.x-a*.19,roof.y-a*.44,a*.38,a*.12);
        }
      }else{
        c.strokeStyle='#a3b6b3';c.lineWidth=Math.max(.65,a*.065);
        c.beginPath();c.moveTo(roof.x-a*.63,roof.y+b*.17);c.lineTo(roof.x+a*.28,roof.y-b*.72);
        c.moveTo(roof.x-a*.28,roof.y+b*.51);c.lineTo(roof.x+a*.62,roof.y-b*.38);c.stroke();
      }
      c.restore();
    }
    function stairHint(onTop){
      var scale=Math.min(d,2),right=w-16*scale,baseline=onTop?73*scale:h-42*scale;
      var label='GOLD LINKS / STAIRS ONLY';
      c.font=Math.max(11*scale,w/100)+'px system-ui';
      if(onTop){
        // Below the zoom buttons and clear of the relay panel at the bottom.
        var textWidth=c.measureText(label).width;
        c.fillStyle='#101628f2';c.fillRect(right-textWidth-5*scale,baseline-14*scale,textWidth+10*scale,20*scale);
      }
      c.fillStyle='#ffe1a1';c.textAlign='right';c.fillText(label,right,baseline);c.textAlign='start';
    }
    function railTile(x,y,z){
      // The painted bed and sleepers stay flush with the navigable floor.
      c.lineCap='butt';
      c.strokeStyle='#756c64';c.lineWidth=Math.max(.65,a*.09);c.beginPath();
      [-.3,0,.3].forEach(function(sleeper){
        var near=P.point(x+sleeper,y-.39,z),far=P.point(x+sleeper,y+.39,z);
        c.moveTo(near.x,near.y);c.lineTo(far.x,far.y);
      });
      c.stroke();
      c.strokeStyle='#adb3b3';c.lineWidth=Math.max(.7,a*.065);c.beginPath();
      [-.23,.23].forEach(function(rail){
        var from=P.point(x-.5,y+rail,z),to=P.point(x+.5,y+rail,z);
        c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);
      });
      c.stroke();
    }
    function transport(x,y,z){
      var ink=convoy.secured?'#a1e9d7':convoy.stoppedBy?'#ffd998':'#f4aa69';
      diamond(x,y,z,ink+'2e',ink);
      // Keep the car on its own tile and beneath the squad silhouettes.
      var rear=P.point(x-.47,y-.28,z+.82),hood=P.point(x+.46,y-.28,z+.82);
      var nose=P.point(x+.46,y+.28,z+.82),tail=P.point(x-.47,y+.28,z+.82);
      var wheel=P.point(x+.46,y+.28,z+.12),axle=P.point(x-.47,y+.28,z+.12);
      var bumper=P.point(x+.46,y-.28,z+.12);
      function face(points,paint){
        c.beginPath();c.moveTo(points[0].x,points[0].y);
        points.slice(1).forEach(function(point){c.lineTo(point.x,point.y);});
        c.closePath();c.fillStyle=paint;c.fill();
      }
      face([tail,nose,wheel,axle],'#574336');
      face([nose,hood,bumper,wheel],'#755545');
      face([rear,hood,nose,tail],ink);
      var cabA=P.point(x+.22,y-.2,z+.82),cabB=P.point(x+.4,y-.2,z+.82);
      var cabC=P.point(x+.4,y+.2,z+.82),cabD=P.point(x+.22,y+.2,z+.82);
      face([cabA,cabB,cabC,cabD],'#243041');
      c.strokeStyle='#574336';c.lineWidth=Math.max(.7,a*.07);c.beginPath();
      var seamA=P.point(x+.14,y-.28,z+.82),seamB=P.point(x+.14,y+.28,z+.82);
      c.moveTo(seamA.x,seamA.y);c.lineTo(seamB.x,seamB.y);c.stroke();
      c.fillStyle='#242732';
      [-.27,.28].forEach(function(offset){
        var hub=P.point(x+offset,y+.3,z+.12);
        c.beginPath();c.arc(hub.x,hub.y,Math.max(.7,a*.1),0,Math.PI*2);c.fill();
      });
      c.fillStyle='#fff1ce';c.beginPath();c.arc(wheel.x,wheel.y-a*.18,Math.max(.85,a*.08),0,Math.PI*2);c.fill();
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
      var t=L.tile(s,x,y),z=L.height(s,x,y),p,palette=breachFloors&&breachFloors[z];
      var floor=x<8?((x*7+y*3)%4?'#30414a':'#374b53'):((x+y)%3?'#263e49':'#2d4650');
      if(marketRoof)floor=z?((y%3)?'#5b6866':'#64706a'):((x+y)%3?'#504b47':'#605751');
      if(cargoLift)floor=z?((x+y)%3?'#4c6868':'#587571'):((x+y)%3?'#554e45':'#635b4b');
      if(s.defense&&x>=8&&x<=15&&y>=2&&y<=6&&t!=='#')floor=(x+y)%2?'#576965':'#4b605f';
      if(!finale&&s.lanes&&x>=10&&x<=15&&y>=3&&y<=10&&t!=='#')floor=(x+y)%2?'#43525b':'#354953';
      if(finale&&t!=='#'){
        var insideBooth=Math.abs(x-s.rescue.x)<2&&Math.abs(y-s.rescue.y)<2;
        floor=insideBooth?'#705444':y<6?'#45545f':y>=11?'#51434a':'#324449';
      }
      if(s.water&&t!=='#')floor=(x+y)%3?'#344b49':'#405550';
      if(bridge&&t!== '#'&&t!=='w')floor=x<8?((x+y)%3?'#4b5148':'#585d50'):((x+y)%3?'#354f54':'#405b60');
      if(s.lighting&&t!=='#'&&t!=='w')floor=L.lit(s,x,y)?((x+y)%3?'#75603d':'#806b46'):((x+y)%3?'#1c3247':'#233c51');
      if(channelHere(x,y))floor=t==='w'?'#104b5e':'#606c59';
      if(t==='w')floor=(x+y)%2?'#104b5e':'#124255';
      if(t==='#')floor=shaftHere(x,y)?'#07151e':'#1b2c36';
      if(platformHere(x,y))floor=liftPower?'#786c44':'#514b3d';
      if(archiveDistrict&&t!=='#'&&t!=='w')floor=x<archivePartition?
        ((x+y)%2?'#535468':'#4b4e62'):((x+y)%2?'#303e59':'#34445f');
      var rail=railCells&&railCells.has(x+','+y);
      if(rail)floor=(x+y)%2?'#282c39':'#2e3039';
      var studio=broadcast&&t!=='#'&&Math.abs(x-transmitter.x)<=2&&Math.abs(y-transmitter.y)<=1;
      if(studio)floor=(x+y)%2?'#574d69':'#49445f';
      if(palette&&t!=='#')floor=(x+y)%3?palette.floor:palette.panel;
      if(evacuation&&t!=='#'){
        if(x>=18)floor=(x+y)%2?'#53635e':'#5e6b63';
        else if(y<=5)floor=(x+2*y)%3?'#4e5e66':'#596970';
        else if(y>=9)floor=(2*x+y)%3?'#594e4d':'#645753';
        else floor=(x+y)%2?'#364a53':'#41525a';
      }
      if(breach&&t==='s')floor='#0b1420';
      if(breach&&platformHere(x,y))floor=liftPower?'#6f613e':'#484438';
      if(t==='e')floor=boarding?(boardingHere(x,y)?'#797044':'#293c49'):'#255c5b';
      p=z?block(x,y,z,floor,palette?palette.side:'#172c36',palette?palette.face:'#203640',0):diamond(x,y,0,floor,'#162c37');
      if(marketRoof&&z&&t==='.'&&y%3===0){
        chartLine(P.point(x-.5,y-.42,z),P.point(x+.5,y-.42,z),'#a8b6a64f',Math.max(.65,a*.058));
      }
      if(evacuation&&x>=18&&t!=='#'){
        c.strokeStyle='#b6b79c88';c.lineWidth=Math.max(.55,a*.045);c.beginPath();
        var plankA=P.point(x-.32,y-.5),plankB=P.point(x-.32,y+.5);
        c.moveTo(plankA.x,plankA.y);c.lineTo(plankB.x,plankB.y);c.stroke();
      }
      if(breach&&(t==='s'||platformHere(x,y)))breachDockSurface(x,y,z,t!=='s');
      if(palette&&t==='.'&&!platformHere(x,y)&&(z===1?(x+y)%3===0:z===2?(x+2*y)%4===0:(x*7+y)%7===0)){
        // Flush maintenance grating and command cable pins do not imply cover.
        c.strokeStyle=palette.detail+'68';c.lineWidth=Math.max(.65,a*.043);c.beginPath();
        var seams=z===1?[-.22,0,.22]:[0];
        seams.forEach(function(seam){
          var start=P.point(x+seam,y-.23,z),end=P.point(x+seam,y+.23,z);
          c.moveTo(start.x,start.y);c.lineTo(end.x,end.y);
        });
        c.stroke();
      }
      if(rail)railTile(x,y,z);
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
      if(!breach&&platformHere(x,y)){
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
      if(!finale&&s.lanes&&x>=10&&x<=15&&y>=3&&y<=10&&t!== '#'){
        // Rooftop conduit follows actual floor surfaces; never a route obstacle.
        c.strokeStyle=x%2?'#a9a07b66':'#79a6af55';c.lineWidth=Math.max(.8,a*.045);c.beginPath();c.moveTo(p.x-a*.8,p.y);c.lineTo(p.x+a*.8,p.y);c.stroke();
      }
      if(reachable[x+','+y])diamond(x,y,z,reachable[x+','+y]===1?'#397b8550':'#bda26030','#4a96994a');
      if(t==='e'){c.strokeStyle=boarding?(boardingHere(x,y)?'#ffe09b':'#72828b'):'#80d2bb';c.lineWidth=a*.07;c.beginPath();c.moveTo(p.x-a*.4,p.y);c.lineTo(p.x,p.y+b*.45);c.lineTo(p.x+a*.4,p.y-b*.1);c.stroke();}
      if(!archiveDistrict&&!breach&&t!== '#' && t!=='w' && y===6){c.strokeStyle=x<8?'#c2975655':'#6caab955';c.lineWidth=a*.04;c.beginPath();c.moveTo(p.x-a*.7,p.y+b*.3);c.lineTo(p.x+a*.7,p.y-b*.3);c.stroke();}
      if(!archiveDistrict&&!breach&&t!== '#' && t!=='w' && (x*17+y*9)%7===0){c.strokeStyle='#7b969b30';c.lineWidth=a*.025;c.beginPath();c.moveTo(p.x-a*.6,p.y);c.lineTo(p.x-a*.1,p.y+b*.3);c.lineTo(p.x+a*.1,p.y+b*.17);c.stroke();}
    }
    if(relay)relay.approaches.forEach(function(anchor){
      // Trace the exact walkable tile. The pad has no height or cover of its own.
      var p=P.point(anchor.x,anchor.y,L.height(s,anchor.x,anchor.y)),ink=anchorInk(anchor);
      c.beginPath();c.moveTo(p.x,p.y-b*.8);c.lineTo(p.x+a*.8,p.y);
      c.lineTo(p.x,p.y+b*.8);c.lineTo(p.x-a*.8,p.y);c.closePath();
      c.fillStyle=ink+(anchor.controlled&&anchor.operatorId&&!relay.secured?'55':'24');c.fill();
      c.strokeStyle=ink;c.lineWidth=Math.max(1,a*.09);
      if(!anchor.controlled&&!relay.secured)c.setLineDash([a*.18,a*.12]);
      c.stroke();c.setLineDash([]);
    });
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
    if(boarding)drawFreightLine();
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
    if(lane&&!finale||defense){
      c.fillStyle='#ffe0ab';c.font=Math.max(11*Math.min(d,2),w/110)+'px system-ui';
      var text=lane?'FIRING / '+lane.label+' / '+lane.damage+' HP':defense.done?'CLINIC SECURED / '+defense.hp+' HP':'CLINIC / '+defense.hp+' HP / '+defense.lane.toUpperCase()+' '+(defense.protected?'COVERED':'EXPOSED');
      c.fillText(text,16*Math.min(d,2),h-62*Math.min(d,2));
    }
    if(lift&&!breach){
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
      }else cargoHoist();
      c.fillStyle=liftPower?'#ffe1a1':'#bcc7c6';c.font=Math.max(11*Math.min(d,2),w/100)+'px system-ui';
      c.fillText((bridge?'BRIDGE ':'POWER ')+(liftPower?'ON / ':'OFF / ')+liftStop.label,16*Math.min(d,2),h-62*Math.min(d,2));
      var dispatch=bridge?'HACK deck/console / 1 AP / return trips':!liftPower?'HACK the hoist relay':!s.rescued?'Rescue the operator to load the medicine':'HACK deck or console / 1 AP';
      c.fillText(dispatch,16*Math.min(d,2),h-42*Math.min(d,2));
    }
    if(s.water){
      c.fillStyle='#aedbe0';c.font=Math.max(11*Math.min(d,2),w/110)+'px system-ui';
      c.fillText('BLUE / FLOODED - HACK DRAIN RELAY',16*Math.min(d,2),h-62*Math.min(d,2));
      c.fillStyle='#e2c795';
      c.fillText('GOLD DASHES / DRY CROSSING',16*Math.min(d,2),h-42*Math.min(d,2));
    }
    // Stair edges are the only legal roof-level transitions; draw their exact
    // endpoints above the floor so the route matches the movement preview.
    if(marketRoof)s.stairs.forEach(marketStair);
    else (s.climbLinks||[]).forEach(function(link){
      var p=P.point(link.from.x,link.from.y,L.height(s,link.from.x,link.from.y));
      var q=P.point(link.to.x,link.to.y,L.height(s,link.to.x,link.to.y));
      c.strokeStyle='#ffe1a1';c.lineWidth=Math.max(2,a*.13);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
      [p,q].forEach(function(r){c.beginPath();c.arc(r.x,r.y,a*.17,0,Math.PI*2);c.fillStyle='#ffe1a1';c.fill();});
    });
    if(!marketRoof&&s.climbLinks&&s.climbLinks.length&&!stairsHintOnTop)stairHint(false);
    if(s.ambush)s.ambush.enemies.forEach(function(e){
      if(s.ambush.deployed&&s.ambush.deployed[e.id])return;
      var p=P.point(e.x,e.y);diamond(e.x,e.y,0,'#743f3c','#ef9c7c');c.fillStyle='#ffd0a0';c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText('! '+s.ambush.turn,p.x,p.y-a*.25);c.textAlign='start';
    });
    if(evacuation)drawCivilianRoutes();
    // Visible shared circuit routes show the coupled door/turret system.
    var circuits=s.circuits||[{x:s.node.x,y:s.node.y,controlled:s.network,doors:[{x:8,y:6}],turret:true}];
    circuits.forEach(function(n){var node=P.point(n.x,n.y,L.height(s,n.x,n.y));c.strokeStyle=n.controlled?'#6ee5ca':keyPair&&keyPair.armedId===n.id?'#d4c7ff':'#e4b778';c.lineWidth=a*.085;c.setLineDash([a*.25,a*.15]);
      (n.doors||[]).concat(n.turret?[s.turret]:[]).forEach(function(d){var p=P.point(d.x,d.y,L.height(s,d.x,d.y));c.beginPath();c.moveTo(node.x,node.y);c.lineTo(p.x,p.y);c.stroke();});c.setLineDash([]);});
    if(view.preview&&view.preview.legal&&view.preview.path){c.strokeStyle='#b7edf0';c.lineWidth=a*.11;c.beginPath();view.preview.path.forEach(function(p,i){var q=P.point(p.x,p.y,L.height(s,p.x,p.y));if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();}
    for(var depth=0;depth<s.width+s.height;depth++)for(var y=0;y<s.height;y++) {
      var x=depth-y;if(x<0||x>=s.width)continue;
      var t=L.tile(s,x,y),z=L.height(s,x,y),p=P.point(x,y,z),palette=breachFloors&&breachFloors[z];
      if(t==='#'&&evacuation)corridorWall(x,y);
      else if(t==='#'&&finale&&Math.abs(x-s.rescue.x)<=2&&Math.abs(y-s.rescue.y)<=2){
        // Copper shielding and ceramic insulators identify the switchkeeper's booth.
        var cap=block(x,y,.78,'#9c7960','#5e453b','#795949');
        c.strokeStyle='#e4b48c';c.lineWidth=Math.max(1,a*.08);
        c.beginPath();c.moveTo(cap.x-a*.8,cap.y);c.lineTo(cap.x,cap.y+b*.8);c.lineTo(cap.x+a*.8,cap.y);c.stroke();
        c.fillStyle='#e0d2b0';c.beginPath();c.ellipse(cap.x,cap.y,a*.15,b*.15,0,0,Math.PI*2);c.fill();
      }
      else if(t==='#'&&archiveDistrict)archiveWall(x,y);
      else if(t==='#'&&!shaftHere(x,y)) {
        // Front perimeter stays low so it cannot obscure engineers.
        var height=(y===s.height-1||x===s.width-1)?0.35:x===8?1.25:0.7;
        var q=block(x,y,height,palette?palette.wall:'#566770',palette?palette.side:'#243640',palette?palette.face:'#33464f');
        c.strokeStyle='#90a2a944';c.lineWidth=a*.04;c.beginPath();c.moveTo(q.x-a*.7,q.y);c.lineTo(q.x+a*.5,q.y-b*.45);c.stroke();
        if(marketRoof&&x>=4&&x<=6&&(y===3||y===6))stallAwning(x,y);
      }
      if(t==='c'&&archiveDistrict)archiveShelf(x,y,p);
      else if(t==='c'&&s.district==='Switchyard'){
        if(!L.occupant(s,x,y))switchyardCover(c,p,a);
      }
      else if(t==='c') {
        var medical=s.defense&&y===5&&(x===8||x===12);
        var top=block(x,y,.55,palette?palette.cover:medical?'#b5c9ba':'#61787b',palette?palette.side:medical?'#45625e':'#30464c',palette?palette.face:medical?'#698a7d':'#3d565c');
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
        var circuit=L.circuitAt(s,x,y),consoleIndex=lift?lift.stops.findIndex(function(stop){return stop.console.x===x&&stop.console.y===y;}):-1;
        var consoleHere=consoleIndex!==-1,consoleLocked=breach&&consoleIndex===2&&!liftInfo.topUnlocked;
        var on=consoleHere?liftPower&&!consoleLocked:circuit?circuit.controlled:s.network;
        var q=block(x,y,.5,consoleLocked?'#a65e59':on?'#8bdfc4':'#e9c485','#4c5a59','#647775');
        c.fillStyle=consoleLocked?'#ffb09d':on?'#91ffe2':'#ffe1a1';c.beginPath();c.arc(q.x,q.y-a*.2,a*.17,0,Math.PI*2);c.fill();
        if(consoleHere&&!breach){
          if(bridge){
            // Winch drum belongs to the actual fixed console. A low silhouette
            // avoids hiding its target tile or neighboring squad members.
            c.strokeStyle=on?'#c4e9d4':'#dfbf87';c.lineWidth=Math.max(1,a*.07);
            c.beginPath();c.ellipse(q.x,q.y-a*.25,a*.33,a*.16,-.45,0,Math.PI*2);c.stroke();
          }
          c.font=Math.max(9,a*.5)+'px system-ui';c.textAlign='center';c.fillText(bridge?'B':'L',q.x,q.y-a*.65);c.textAlign='start';
        }
        var marker=archiveMarker(x,y);
        var signal=convoy&&convoy.signals.find(function(entry){return circuit&&entry.id===circuit.id;});
        if(signal){
          var signalIndex=convoy.signals.indexOf(signal);
          mapBadge(q,signalIndex===0?'B':'S',on?'#a1e9d7':signal.available?'#ffd998':'#a1acbd',.58);
        }else if(broadcast&&circuit===transmitter){
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
        }else if(relay&&circuit&&circuit.id===s.relaySiege.core){
          mapBadge(q,'R',on?'#a1e9d7':'#ffd998',.62);
        }else if(breach&&circuit){
          c.font='700 '+Math.max(9*Math.min(d,2),a*.5)+'px system-ui';c.textAlign='center';
          c.fillText(breachNodes[circuit.id]||'S',q.x,q.y-a*.65);c.textAlign='start';
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
      if(lift&&!bridge&&!breach&&s.rescued&&(lift.delivered?x===15&&y===8:x===liftStop.x&&y===liftStop.y)){
        var q=P.point(x-.3,y-.3,z);c.fillStyle='#698d87';c.fillRect(q.x-a*.18,q.y-a*.47,a*.36,a*.32);c.fillStyle='#d9f3df';c.fillRect(q.x-a*.04,q.y-a*.44,a*.08,a*.24);c.fillRect(q.x-a*.13,q.y-a*.36,a*.26,a*.08);
      }
      if(convoy&&!convoy.escaped&&x===convoy.x&&y===convoy.y)transport(x,y,z);
      if(evacuation)evacuation.groups.forEach(function(group){
        if(group.current.x===x&&group.current.y===y)civilianGroup(group,p);
      });
      var actor=L.occupant(s,x,y);
      if(actor){
        var friendly=s.squad.indexOf(actor)!==-1,selected=view.selected===actor.id;
        if(selected){var ring=t==='c'?1:.72;c.strokeStyle='#c1fff0';c.lineWidth=a*.09;c.beginPath();c.ellipse(p.x,p.y,a*ring,b*ring,0,0,Math.PI*2);c.stroke();}
        if(broadcast&&!friendly&&broadcast.patrols.some(function(patrol){return patrol.id===actor.id;})){
          c.strokeStyle=signalInk;c.lineWidth=Math.max(1,a*.08);
          c.beginPath();c.ellipse(p.x,p.y,a*.7,b*.68,0,0,Math.PI*2);c.stroke();
        }
        c.fillStyle='#06111ac4';c.beginPath();c.ellipse(p.x+a*.05,p.y+a*.05,a*.51,b*.4,0,0,Math.PI*2);c.fill();
        drawOperator(c,actor,friendly,p,a,t==='c',s.lighting&&!L.lit(s,x,y));
        if(t==='c'&&s.district==='Switchyard')switchyardCover(c,p,a);
        var headroom=actor.id==='sol'?1.86:actor.id==='rook'?1.38:1.66;
        var barW=a*.85,barY=p.y-a*(headroom-(t==='c' ? .16 : 0));
        c.fillStyle='#071823';c.fillRect(p.x-barW/2,barY,barW,a*.12);c.fillStyle=friendly?'#a6dfc7':'#f29e86';c.fillRect(p.x-barW/2,barY,barW*actor.hp/actor.maxHp,a*.12);
        if(friendly){c.fillStyle=actor.watch?'#f2d99a':'#b5e6df';for(var i=0;i<actor.ap;i++){c.beginPath();c.arc(p.x-a*.13+i*a*.26,barY-a*.19,a*.07,0,Math.PI*2);c.fill();}}
      }
    }
    if(marketRoof||cargoLift)drawMarketSigns();
    // Keep each mastery target's chevrons visible above its current tile,
    // including when one rear patrol moves behind ordinary yard personnel.
    if(boarding)s.ambush.enemies.forEach(function(entry){
      var patrol=s.enemies.find(function(enemy){return enemy.id===entry.id;});
      if(!patrol||!L.living(patrol))return;
      var q=P.point(patrol.x,patrol.y,L.height(s,patrol.x,patrol.y));
      var top=q.y-a*(L.tile(s,patrol.x,patrol.y)==='c'?1.74:1.9);
      var radius=Math.max(3*Math.min(d,2),a*.38);
      c.save();c.translate(q.x,top);c.strokeStyle='#17222e';c.lineWidth=Math.max(2*Math.min(d,2),a*.21);
      c.lineJoin='miter';c.lineCap='square';c.beginPath();
      for(var j=0;j<2;j++){var offset=-j*radius*.66;c.moveTo(-radius,offset);c.lineTo(0,offset-radius*.52);c.lineTo(radius,offset);}
      c.stroke();c.strokeStyle='#ffd887';c.lineWidth=Math.max(1*Math.min(d,2),a*.1);c.stroke();c.restore();
    });
    if(evacuation){handoffMarkers();evacuationLedger();}
    if(breach){
      var scale=Math.min(d,2);
      lift.stops.forEach(function(stop,index){
        var point=P.point(stop.console.x,stop.console.y,stop.z+.5);
        var occupied=L.occupant(s,stop.console.x,stop.console.y);
        mapBadge(point,'0'+(index+1),breachDockInk(index),occupied?1.25:.7,true);
      });
      var heading=liftPower?'LIFT AT '+liftInfo.label.toUpperCase()+'  /  '+liftInfo.passengers+' ABOARD':'LIFT UNPOWERED  /  HACK P';
      var key='01 Ground  /  02 Maintenance  /  '+(liftInfo.topUnlocked?'03 Command':'03 Locked');
      c.font='700 '+12*scale+'px system-ui';
      var panel=Math.ceil(c.measureText(heading).width);
      c.font=11*scale+'px system-ui';
      panel=Math.max(panel,c.measureText(key).width)+20*scale;
      var wide=w>=520*scale,left=wide?w-panel-12*scale:16*scale,top=wide?12*scale:h-79*scale;
      c.fillStyle='#101628f2';c.fillRect(left,top,panel,43*scale);
      c.fillStyle=breachDockInk(liftInfo.position);c.fillRect(left,top,2*scale,43*scale);
      c.font='700 '+12*scale+'px system-ui';c.fillText(heading,left+10*scale,top+17*scale);
      c.font=11*scale+'px system-ui';c.fillStyle='#d4dfdf';c.fillText(key,left+10*scale,top+33*scale);
    }
    if(convoy){
      var carInk=convoy.escaped?'#ffad98':convoy.secured?'#a1e9d7':'#ffd998';
      if(!convoy.escaped){
        var carTile=P.point(convoy.x,convoy.y,L.height(s,convoy.x,convoy.y));
        var occupied=L.occupant(s,convoy.x,convoy.y);
        mapBadge(carTile,convoy.stoppedBy?'E':'›',carInk,occupied?1.82:1.2,true);
      }
      var carScale=Math.min(d,2),carLeft=16*carScale,carTop=h-84*carScale;
      var carStatus=convoy.escaped?'CONVOY ESCAPED':convoy.secured?'EVIDENCE SECURED':
        convoy.stoppedBy?'CONVOY STOPPED':'DEPARTS AT END OF TURN '+convoy.departureTurn;
      var carKey=convoy.escaped?'Retry to intercept the evidence':convoy.secured?'Rescue the dispatcher and extract':
        convoy.stoppedBy?'E Evidence / HACK the stopped car':
        'HACK B Brake (T'+convoy.signals[0].lastTurn+')  /  S Siding (T'+convoy.signals[1].lastTurn+')';
      c.font='700 '+12*carScale+'px system-ui';
      var carPanel=c.measureText(carStatus).width;
      c.font=11*carScale+'px system-ui';
      carPanel=Math.max(carPanel,c.measureText(carKey).width)+20*carScale;
      c.fillStyle='#101628f2';c.fillRect(carLeft,carTop,carPanel,47*carScale);
      c.fillStyle=carInk;c.fillRect(carLeft,carTop,2*carScale,47*carScale);
      c.font='700 '+12*carScale+'px system-ui';c.fillText(carStatus,carLeft+10*carScale,carTop+18*carScale);
      c.font=11*carScale+'px system-ui';c.fillStyle='#d5cde7';c.fillText(carKey,carLeft+10*carScale,carTop+36*carScale);
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
    if(relay){
      var liveAnchor=relay.approaches.some(function(anchor){return anchor.controlled&&anchor.operatorId;});
      var poweredAnchor=relay.approaches.some(function(anchor){return anchor.controlled;});
      var relayScale=Math.min(d,2),relayLeft=16*relayScale,relayTop=h-84*relayScale;
      var relayTitle=relay.secured?'RELAY SECURED':liveAnchor?'RELAY READY / HACK R':
        poweredAnchor?'MOVE TO A POWERED ANCHOR':'HACK AN APPROACH CONSOLE';
      var padStatus=relay.approaches.map(function(anchor){
        var letter=anchor.circuitId==='north-approach'?'N':'S';
        var point=P.point(anchor.x,anchor.y,L.height(s,anchor.x,anchor.y));
        mapBadge(point,letter,anchorInk(anchor),L.occupant(s,anchor.x,anchor.y)?1.82:1.14,true);
        return letter+' ANCHOR '+(!anchor.controlled?'OFF':anchor.operatorId?'HELD':'EMPTY');
      }).join('  /  ');
      if(relay.secured)padStatus=s.rescued?'Extract the squad':'Rescue the keeper and extract';
      c.font='700 '+12*relayScale+'px system-ui';
      var relayPanel=c.measureText(relayTitle).width;
      c.font=11*relayScale+'px system-ui';
      relayPanel=Math.max(relayPanel,c.measureText(padStatus).width)+20*relayScale;
      var relayTint=relay.secured||liveAnchor?'#a1e9d7':'#ffd998';
      c.fillStyle='#101628f2';c.fillRect(relayLeft,relayTop,relayPanel,47*relayScale);
      c.fillStyle=relayTint;c.fillRect(relayLeft,relayTop,2*relayScale,47*relayScale);
      c.font='700 '+12*relayScale+'px system-ui';c.fillText(relayTitle,relayLeft+10*relayScale,relayTop+18*relayScale);
      c.font=11*relayScale+'px system-ui';c.fillStyle='#c7d6df';c.fillText(padStatus,relayLeft+10*relayScale,relayTop+36*relayScale);
      if(stairsHintOnTop&&s.climbLinks&&s.climbLinks.length)stairHint(true);
    }
    if(keyPair){
      var keyScale=Math.min(d,2),keySize=Math.max(17*keyScale,Math.min(25*keyScale,a)),keyLeft=16*keyScale,keyTop=h-84*keyScale;
      var armed=keyPair.keys.find(function(key){return key.id===keyPair.armedId;});
      var keyTint=keyPair.opened?'#a1e9d7':armed?'#d4c7ff':'#ffd998';
      keyPair.keys.forEach(function(key,index){
        var q=P.point(key.x,key.y,L.height(s,key.x,key.y)),top=q.y-a*1.15-keySize;
        if(finale&&L.occupant(s,key.x,key.y)){
          var originalX=q.x;
          q.x+=keySize;top-=keySize*.5;
          c.strokeStyle=keyTint;c.lineWidth=keyScale;c.beginPath();c.moveTo(originalX,q.y-a*.45);c.lineTo(q.x,top+keySize);c.stroke();
        }
        c.fillStyle='#14192b';c.fillRect(q.x-keySize/2,top,keySize,keySize);
        c.strokeStyle=keyPair.opened||key===armed?keyTint:'#ffd998';c.lineWidth=keyScale;
        c.strokeRect(q.x-keySize/2,top,keySize,keySize);
        c.fillStyle=c.strokeStyle;c.font='700 '+Math.round(keySize*.65)+'px system-ui';c.textAlign='center';
        c.fillText(index===0?'N':'S',q.x,top+keySize*.74);c.textAlign='start';
      });
      var keyStatus=keyPair.opened?'VAULT OPEN':armed?(armed===keyPair.keys[0]?'N':'S')+' ARMED / HACK '+(armed===keyPair.keys[0]?'S':'N')+' THIS TURN':'HACK BOTH KEYS IN ONE TURN';
      var keyLegend='N North key  /  S South key';
      if(finale){
        keyStatus=!keyPair.opened?(armed?'ARMED / HACK '+(armed===keyPair.keys[0]?'S':'N')+' THIS TURN':'SYNC N + S / TWO ENGINEERS'):
          !s.rescued?'VAULT OPEN / RESCUE SWITCHKEEPER':lane?'HACK THE BROADCAST MAST':'CORE OFFLINE / EXTRACT EAST';
        keyLegend=lane?lane.label+' / −'+lane.damage+' HP at End Turn':'Both coils are safe.';
      }
      var exposure='';
      if(finale&&lane){
        var names=s.squad.filter(function(u){return L.living(u)&&lane.tiles.some(function(t){return u.x===t.x&&u.y===t.y;});}).map(function(u){return u.name;});
        if(names.length)exposure='Exposed: '+names.join(', ');
      }
      c.font='700 '+12*keyScale+'px system-ui';
      var keyPanel=c.measureText(keyStatus).width;
      c.font=11*keyScale+'px system-ui';
      keyPanel=Math.max(keyPanel,c.measureText(keyLegend).width,c.measureText(exposure).width)+20*keyScale;
      var panelHeight=(exposure?63:47)*keyScale;
      if(exposure)keyTop-=16*keyScale;
      c.fillStyle='#101628f2';c.fillRect(keyLeft,keyTop,keyPanel,panelHeight);
      c.fillStyle=keyTint;c.fillRect(keyLeft,keyTop,2*keyScale,panelHeight);
      c.font='700 '+12*keyScale+'px system-ui';c.fillText(keyStatus,keyLeft+10*keyScale,keyTop+18*keyScale);
      c.font=11*keyScale+'px system-ui';c.fillStyle=finale&&lane?'#ffd0ad':'#c7c5df';c.fillText(keyLegend,keyLeft+10*keyScale,keyTop+36*keyScale);
      if(exposure)c.fillText(exposure,keyLeft+10*keyScale,keyTop+52*keyScale);
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
    if(boarding){
      // Keep the current train stop legible even when the camera centers on a unit.
      var scale=Math.min(d,2),right=w-12*scale,base=h-42*scale;
      var timing=boarding.open?boarding.label+' / BOARD / '+boarding.turnsUntilChange+' TURNS':'TRANSIT / '+boarding.nextLabel+' / '+boarding.turnsUntilChange+' TURN';
      c.font=Math.max(11*scale,w/100)+'px system-ui';var timingWidth=c.measureText(timing).width;
      c.fillStyle='#10212bf5';c.fillRect(right-timingWidth-12*scale,base-14*scale,timingWidth+16*scale,20*scale);
      c.fillStyle=boarding.open?'#ffe09b':'#b5c8d0';c.textAlign='right';c.fillText(timing,right,base);c.textAlign='start';
    }
    var inspected=L.unit(s,view.selected);
    if(s.district==='Switchyard'&&inspected&&L.living(inspected)&&L.tile(s,inspected.x,inspected.y)==='c'){
      var scale=Math.min(d,2),label=inspected.name.toUpperCase()+' / LOW COVER';
      c.font='600 '+11*scale+'px system-ui';var labelWidth=c.measureText(label).width;
      c.fillStyle='#10232ef5';c.fillRect(w-labelWidth-20*scale,11*scale,labelWidth+12*scale,22*scale);
      c.fillStyle='#dce9d9';c.fillText(label,w-labelWidth-14*scale,26*scale);
    }
    // HUD belongs to DOM. This map legend remains readable independently of zoom.
    c.fillStyle='#93b3bf';c.font=Math.max(10,w/100)+'px system-ui';c.fillText(s.district.toUpperCase()+' / '+String(s.sequence||1).padStart(2,'0'),16*Math.min(d,2),h-18*Math.min(d,2));
    return P;
  }
  SB.Render={draw:draw,projection:projection};
})(window);
