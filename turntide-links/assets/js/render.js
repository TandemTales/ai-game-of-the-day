/* The chart uses the same 720 × 450 coordinates as the keeper's rules. */
(() => {
  'use strict';
  const TL = window.TL = window.TL || {};
  const W = 720, H = 450, TAU = Math.PI * 2;
  const ink = '#243f36', cream = '#ffedbc', brass = '#e9b957';
  const charts = new WeakMap();

  function polygon(ctx, color, points, edge, weight = 1) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) ctx.moveTo(points[i], points[i + 1]);
      else ctx.lineTo(points[i], points[i + 1]);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = weight; ctx.stroke(); }
  }
  function line(ctx, color, points, width = 1, dash = []) {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function oval(ctx, x, y, rx, ry, fill, edge, weight = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (edge) { ctx.lineWidth = weight; ctx.strokeStyle = edge; ctx.stroke(); }
  }
  function noise(seed) {
    let n = seed;
    return () => {
      n = (Math.imul(1664525, n) + 1013904223) >>> 0;
      return n / 4294967296;
    };
  }
  function rects(rectangles, grow = 0, yOffset = 0) {
    const path = new Path2D();
    for (const r of rectangles) {
      if (r.w + grow * 2 > 0 && r.h + grow * 2 > 0) {
        path.rect(r.x - grow, r.y - grow + yOffset, r.w + grow * 2, r.h + grow * 2);
      }
    }
    return path;
  }
  function wash(ctx, path, color) { ctx.fillStyle = color; ctx.fill(path); }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function water(ctx, seed) {
    const tint = ctx.createLinearGradient(0, 0, W * .72, H);
    tint.addColorStop(0, '#416c6d');
    tint.addColorStop(.54, '#367a78');
    tint.addColorStop(1, '#235751');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    // Thin soundings follow wave trains. Sparse flecks cross the engraved bands.
    for (let i = -5; i < 36; i++) {
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 5) {
        const y = i * 15 + 6 * Math.sin(x * .016 + i * .19 + seed) + 2 * Math.sin(x * .048 - i * .33);
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = i % 4 ? '#d4f4cd14' : '#d4f4cd28';
      ctx.lineWidth = .9; ctx.stroke();
    }
    const random = noise(seed * 17 + 501);
    for (let i = 0; i < 370; i++) {
      const x = random() * W, y = random() * H, len = 2 + random() * 12;
      line(ctx, i % 8 ? '#e4f8d02e' : '#dff4c976', [x, y + 1, x + len * .35, y, x + len, y + .6]);
    }
  }
  function lighthouse(ctx, x, y, variant) {
    ctx.save(); ctx.translate(x, y);
    const dark = '#334d46', brick = '#b95e43', sun = '#ecdca0';
    // A low hexagonal stone footing, with the west face in shadow.
    oval(ctx, 0, 2, 32, 9, '#153d3d65');
    polygon(ctx, '#708c7a', [-29,-1,-16,-9,15,-9,27,-2,18,5,-15,6], dark);
    polygon(ctx, '#475f53', [-29,-1,-15,4,18,3,27,-2,25,4,13,9,-12,10,-28,4]);
    if (variant === 0 || variant === 2) {
      polygon(ctx, '#a7a78a', [-12,-4,-7,-43,6,-46,13,-3,2,1], dark);
      polygon(ctx, sun, [-7,-43,5,-44,10,-4,-4,-2], dark, .8);
      polygon(ctx, brick, [-10,-26,8,-28,9,-20,-10,-18]);
      polygon(ctx, '#5c4840', [-12,-26,-7,-27,-7,-18,-10,-18]);
      polygon(ctx, dark, [-10,-45,0,-50,10,-46,10,-43,-9,-42]);
      ctx.fillStyle = '#f8d47b'; ctx.fillRect(-6,-55,12,10);
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.strokeRect(-6,-55,12,10);
      line(ctx, dark, [0,-54,0,-46], 1.5);
      polygon(ctx, brick, [-11,-55,0,-64,11,-55], dark, 1.5);
      line(ctx, dark, [0,-63,0,-67], 1.5);
      ctx.fillStyle = dark; ctx.fillRect(-1,-12,4,10);
    } else {
      polygon(ctx, '#d7c390', [-22,-20,7,-25,23,-15,22,-2,-6,2,-22,-7], dark, 1.3);
      polygon(ctx, '#a9996a', [7,-25,23,-15,22,-2,7,-10], dark);
      polygon(ctx, brick, [-25,-18,-14,-34,14,-38,8,-23], dark, 1.5);
      polygon(ctx, '#713f33', [14,-38,27,-17,8,-23], dark);
      for (const wx of [-15,-7,1]) {
        line(ctx, '#fbe1a2', [wx,-16,wx,-10], 4);
        line(ctx, dark, [wx,-16,wx,-11], 2);
      }
      ctx.fillStyle = dark; ctx.fillRect(14,-13,4,9);
      line(ctx, dark, [-16,-33,-16,-48], 1.5);
      polygon(ctx, brass, [-16,-47,-6,-45,-16,-42]);
    }
    ctx.restore();
  }
  function pine(ctx,x,y,size) {
    ctx.fillStyle='#574f3d';ctx.fillRect(x-size*.045,y-size*.4,size*.09,size*.4);
    for(let i=0;i<3;i++){
      const h=size*(.62-i*.09), bottom=y-size*(.12+i*.21),w=size*(.33-i*.055);
      polygon(ctx,'#36574c',[x,bottom-h,x+w,bottom-1,x+2,bottom-3,x-2,bottom,x-w,bottom-3]);
      polygon(ctx,'#66846a',[x,bottom-h,x-2,bottom-8,x-w,bottom-3]);
    }
  }
  function harborIsland(ctx,x,y,variant) {
    ctx.save();ctx.translate(x,y);
    // A small rocky village takes its silhouette from the local harbor, leaving
    // the charted fairway unobstructed.
    const coast=[-91,-18,-76,-26,-55,-25,-40,-31,-13,-24,8,-23,24,-14,48,-10,47,-2,34,6,12,7,-4,12,-20,9,-33,14,-63,11,-81,5,-92,5];
    ctx.save();ctx.translate(-1,6);polygon(ctx,'#c6d4b373',coast);ctx.restore();
    ctx.save();ctx.translate(0,4);polygon(ctx,'#354b41',coast,'#354b41',3);ctx.restore();
    polygon(ctx,'#879575',coast,'#495a49',1.6);
    polygon(ctx,'#a3ac7c',[-87,-18,-54,-22,-37,-28,-11,-22,8,-20,29,-10,13,-7,-24,-6,-51,1,-87,-2]);
    for(let i=0;i<22;i++){
      const xx=-85+i*5.8, yy=8+4*Math.sin(i*.61);
      line(ctx,'#c4c3a2',[xx,yy-3,xx-2,yy+1],1.2);
    }
    for(const [px,py,s] of [[-68,-12,26],[-58,-15,32],[-49,-14,36],[-39,-12,28],[-77,-8,18],[-31,-11,22]]) pine(ctx,px,py,s);
    const cottage = (xx,yy) => {
      ctx.save();ctx.translate(xx,yy);
      polygon(ctx,'#d9c79b',[-11,-8,4,-10,10,-5,10,2,-3,4,-11,0],'#54604c');
      polygon(ctx,'#b16e50',[-13,-8,-6,-16,7,-17,4,-9,-2,-6],ink);
      polygon(ctx,'#834e3d',[7,-17,13,-6,4,-8],ink);
      for (let wx=-7;wx<5;wx+=5) line(ctx,ink,[wx,-5,wx,-2],2);
      ctx.restore();
    };
    cottage(-31,-3);cottage(-54,3);
    // Timber pier, piles, handrails, and a pair of little tied fishing skiffs.
    polygon(ctx,'#c6a075',[17,3,49,-2,54,0,22,6],ink,1.2);
    for(const xx of [24,36,47]) line(ctx,'#4c5243',[xx,4-(xx-24)*.15,xx,10-(xx-24)*.15],2);
    for(const [xx,yy] of [[30,12],[44,10]]) {
      polygon(ctx,'#753e32',[xx-6,yy,xx+4,yy-2,xx+8,yy-1,xx+4,yy+2,xx-4,yy+3]);
      line(ctx,'#ecc995',[xx-4,yy,xx+4,yy-1]);
    }
    ctx.restore();lighthouse(ctx,x+3,y-3,variant);
  }
  function ferry(ctx, x, y, direction) {
    ctx.save(); ctx.translate(x, y); ctx.scale(direction, 1); ctx.rotate(-.09);
    line(ctx, '#e0e7bc86', [-71,4,-52,6,-37,5], 2);
    line(ctx, '#e0e7bc80', [-49,-1,-40,1,-30,0], 1.5);
    oval(ctx, 0, 4, 37, 9, '#204b47a6');
    polygon(ctx, '#233e3c', [-34,-2,-21,3,20,2,35,-3,28,5,16,8,-23,8,-33,4]);
    polygon(ctx, '#d9c486', [-34,-3,-20,-9,17,-10,36,-4,21,2,-20,3], '#233e3c', 1.2);
    polygon(ctx, '#ac503a', [-17,-10,-9,-15,15,-14,24,-8,20,-4,-16,-3], '#32483d');
    polygon(ctx, '#f0dfac', [-18,-9,8,-11,19,-7,17,-3,-16,-2], '#374942');
    for (let i = -13; i <= 11; i += 6) {
      ctx.fillStyle = '#4b7370'; ctx.fillRect(i,-8,3.6,3);
    }
    polygon(ctx, '#eee4ba', [-18,-10,-9,-16,14,-16,20,-11,10,-9]);
    polygon(ctx, '#ad523a', [-4,-16,-4,-23,1,-24,3,-16], '#34493d');
    line(ctx, '#293e35', [11,-15,11,-27], 1.2);
    polygon(ctx, '#e4b24e', [11,-26,20,-24,11,-22]);
    ctx.restore();
  }
  function harbor(ctx, hole) {
    const blocked = hole.land.concat(hole.deck || [], hole.sandbar || []);
    const safe = r => blocked.every(b => !overlap(r,b));
    const marks = [[86,76],[W-82,79],[72,H-25],[W-72,H-20]];
    const landmark = marks.find(([x,y]) => safe({x:x-34,y:y-68,w:68,h:80}));
    if (landmark) {
      const [x,y]=landmark;
      if(safe({x:x-93,y:y-70,w:152,h:90})) harborIsland(ctx,x,y,(hole.id-1)%4);
      else lighthouse(ctx,x,y,(hole.id-1)%4);
      blocked.push({x:landmark[0]-34,y:landmark[1]-68,w:68,h:80});
    }
    const berths = [[557,H-23],[135,H-26],[W-85,48],[110,45]];
    const berth = berths.find(([x,y]) => safe({x:x-70,y:y-27,w:140,h:40}));
    if (berth) ferry(ctx, ...berth, hole.id % 2 ? 1 : -1);
    for (let i = 0; i < 3; i++) {
      const x = 155 + i * 14, y = 36 + Math.sin(i * 1.7) * 8;
      if (safe({x:x-6,y:y-3,w:12,h:5})) line(ctx, '#ebead3bd', [x-5,y-2,x-2,y-2,x,y,x+2,y-2,x+5,y-3], 1.5);
    }
  }

  function appleTree(ctx, x, y, scale, seed) {
    const random = noise(seed);
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    oval(ctx, 4, 1, 14, 4, '#454b383e');
    polygon(ctx, '#674c36', [-3,0,-1,-11,-7,-16,-5,-18,1,-13,6,-20,8,-18,3,-10,3,0]);
    line(ctx, '#b18355', [-1,-1,0,-9,-4,-14], 1.3);
    // Pruned apple trees have a broad open crown and heavy, low fruiting limbs.
    for (const [cx,cy,r] of [[-7,-15,8],[8,-16,8],[1,-23,9],[-6,-21,5]]) {
      oval(ctx, cx,cy,r+1,r*.84, '#4a573a');
      oval(ctx, cx-1,cy-2,r,r*.74, '#829240');
      oval(ctx, cx-3,cy-3,r*.62,r*.48, '#a6a74a');
    }
    for (let i=0;i<12;i++) {
      const xx = -11+random()*22, yy = -24+random()*12;
      oval(ctx,xx,yy,1.7,2.1,'#8b4431');
      oval(ctx,xx-.4,yy-.7,1.3,1.3,i%3?'#d9703e':'#f5ad54');
    }
    ctx.restore();
  }

  function ciderHouse(ctx, x, y) {
    ctx.save(); ctx.translate(x,y);
    oval(ctx,4,1,46,9,'#45503b48');
    polygon(ctx,'#cfac77',[-34,-24,8,-31,34,-17,34,0,-6,7,-34,-4],ink,1.6);
    polygon(ctx,'#e8c58c',[-34,-24,-17,-42,9,-28,9,3,-6,7,-34,-4],ink,1.5);
    polygon(ctx,'#9b4934',[-38,-22,-17,-48,25,-51,41,-25,7,-19,-17,-42],ink,1.7);
    polygon(ctx,'#c66541',[-17,-48,24,-52,42,-27,8,-20],ink,1.5);
    for(let i=0;i<5;i++) line(ctx,'#dd8a58',[-12+i*7,-45-i,6+i*7,-24-i],1.1);
    polygon(ctx,'#51483b',[-24,-16,-12,-19,-12,3,-24,0]);
    for(const xx of [-5,2,16,25]) {
      const yy = xx<8 ? -15+(xx+5)*.3 : -16-(xx-16)*.15;
      line(ctx,'#f1daa0',[xx,yy,xx,yy+6],4);
      line(ctx,'#566759',[xx,yy,xx,yy+5],2.4);
    }
    line(ctx,'#604a39',[-29,-5,-29,-18,-19,-20],1.4);
    polygon(ctx,'#67503b',[16,-47,16,-62,21,-63,22,-48],ink);
    line(ctx,'#f2c88a',[15,-62,22,-64],2);
    ctx.restore();
  }

  function orchardLanding(ctx,hole) {
    // Near bank, seen from the ferry. The farther edge is the only playable shore.
    const east = hole.id%2===0;
    ctx.save(); ctx.translate(east ? W-225 : 0,H-71);
    const coastline = [-10,10,19,1,48,-2,73,3,96,-2,122,0,136,5,149,7,151,14,175,15,176,22,191,23,191,28,208,28,210,36,229,40,240,57,248,75,-10,75];
    if(east) { ctx.translate(225,0); ctx.scale(-1,1); }
    ctx.save(); ctx.translate(0,-4); polygon(ctx,'#ced7b875',coastline); ctx.restore();
    polygon(ctx,'#64755e',coastline, '#3e6157',2);
    ctx.save(); ctx.translate(0,5); polygon(ctx,'#bda46d',coastline,'#d5be87',2); ctx.restore();
    for(let row=0;row<3;row++) {
      const yy=19+row*16;
      const edge=[-6,yy+2,62,yy-6,103,yy-4,124,yy+3,142,yy+5,155,yy+12,228,yy+25];
      line(ctx,'#786d50',edge,5.5); line(ctx,'#d7bf87',edge,2.1);
      for(let i=0;i<8;i++) {
        const x=3+i*19+row*3;
        const y=yy + (x<97 ? -5+Math.abs(x-64)*.085 : (x-97)*.24-3);
        line(ctx,'#8a815f',[x,y,x-1,y+3],1.1);
      }
    }
    for(const [x,y,s] of [[-5,16,1.05],[28,18,.93],[68,14,.98],[106,17,.94],[142,24,.84],
                           [2,50,1.47],[45,46,1.32],[92,46,1.31],[132,56,1.22],[171,63,1.07],
                           [12,82,1.65],[72,80,1.5],[121,83,1.42]]) {
      if(hole.barge && x>104 && y<45) continue;
      appleTree(ctx,x,y,s,37*x+y+hole.id*91);
    }
    if(hole.barge) {
      // Dockside shear legs and sling alongside the lighter's fruit crates.
      const x=150,y=14;
      polygon(ctx,'#b99364',[x-30,y+3,x+6,y-4,x+21,y+4,x-18,y+12],ink,1.2);
      for(const dx of [-16,13]) line(ctx,'#5b5141',[x+dx,y+5,x-7,y-35],4.2);
      line(ctx,'#d4a96a',[x-15,y+4,x-7,y-33,x+21,y-26],2);
      line(ctx,'#545343',[x-7,y-35,x+23,y-27,x+23,y-9],1.7);
      polygon(ctx,'#ba8750',[x+16,y-8,x+30,y-9,x+28,y-1,x+18,y],ink,1.2);
      for(const dx of [-14,-1,10]) fruitCargo(ctx,x+dx,y+6-dx*.17);
    }
    ctx.restore();
  }

  function orchardBank(ctx, hole) {
    const phase = (hole.id-5)*.9;
    // Dry-stone banks and fruit rows beyond the canal frame the playable island.
    const edge = x => 37+14*Math.cos(x*.009+phase)+10*Math.sin(x*.021-phase);
    for(const [offset,color] of [[17,'#b5d4ba70'],[12,'#384f46'],[9,'#8d8f6c'],[3,'#e0c08a'],[0,'#a2a065']]) {
      const points = [-5,-2];
      for(let x=-5;x<=W+10;x+=9) points.push(x,edge(x)+offset);
      points.push(W+10,-2);
      polygon(ctx,color,points);
    }
    for(let x=0;x<W;x+=11) {
      const y=edge(x);
      line(ctx,'#566b586d',[x,y+5,x+2,y+10],1.2);
      if(x%3) line(ctx,'#edd5a0',[x+1,y+4,x+8,edge(x+8)+4],1.3);
    }
    const cottageX = [558,145,603,152][hole.id-5] || 150;
    for(let row=0;row<2;row++) for(let i=0;i<23;i++) {
      const x = -20+i*36+row*17;
      if(Math.abs(x-cottageX)<49) continue;
      const y=edge(x)-18+row*13;
      appleTree(ctx,x,y,row ? .74 : .55, 841+i*71+row*30+hole.id);
    }
    ctx.save(); ctx.translate(cottageX,edge(cottageX)+1); ctx.scale(.73,.73);
    ciderHouse(ctx,0,0); ctx.restore();
    const quayX = cottageX+11, quayY = edge(cottageX)+12;
    polygon(ctx,'#bc9660',[quayX,quayY-6,quayX+8,quayY-7,quayX+25,quayY+8,quayX+15,quayY+10],ink,1.4);
    for(let i=0;i<4;i++) line(ctx,'#735d46',[quayX+3+i*3,quayY-3+i*3,quayX+10+i*3,quayY-5+i*3],1);
    orchardLanding(ctx,hole);
    ferry(ctx, hole.id%2 ? 559 : 150, H-24, hole.id%2 ? 1 : -1);
  }
  function shoreEdges(land) {
    const xs=[...new Set(land.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
    const ys=[...new Set(land.flatMap(r=>[r.y,r.y+r.h]))].sort((a,b)=>a-b);
    const inside=(x,y)=>land.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);
    const edges=[];
    for(const y of ys) for(let i=1;i<xs.length;i++){
      const x=xs[i-1],w=xs[i]-x;
      const a=inside(x+w/2,y-1),b=inside(x+w/2,y+1);
      if(a!==b) edges.push({x,y,len:w,vx:1,vy:0,nx:0,ny:a?1:-1});
    }
    for(const x of xs) for(let i=1;i<ys.length;i++){
      const y=ys[i-1],h=ys[i]-y;
      const a=inside(x-1,y+h/2),b=inside(x+1,y+h/2);
      if(a!==b) edges.push({x,y,len:h,vx:0,vy:1,nx:a?1:-1,ny:0});
    }
    return edges;
  }
  function coastalShelf(ctx,edges,seed) {
    const random=noise(seed+427);
    for(const e of edges){
      const at=(d,n)=>[e.x+e.vx*d+e.nx*n,e.y+e.vy*d+e.ny*n];
      const facing=e.ny===1||e.nx===1;
      const len=e.len,pts=[],surf=[];
      for(let i=0;i<=len;i+=3){
        const face=at(i,7+(2+3*random())*Math.sin(i*.16)+random()*2);
        pts.push(...face);
        surf.push(...at(i,13+Math.sin(i*.15)*2+Math.sin(i*.47)*1.2));
      }
      if(pts.length>2) {
        polygon(ctx,facing?'#5c7261':'#9fa579',[...at(0,0),...pts,...at(len,0)]);
        line(ctx,'#d1d5a694',surf,.9);
      }
      for(let i=0;i<len;i+=7+random()*8){
        const n=2+random()*4;
        line(ctx,facing?'#bdba8a':'#c5c294',[...at(i,n),...at(i+3,n-2)],1.4);
        if(random()<.15){
          const [x,y]=at(i,13+random()*4);
          polygon(ctx,'#687e6f',[x-4,y,x-1,y-2,x+3,y-1,x+5,y+1,x+1,y+2],null);
          line(ctx,'#d5d4ab',[x-4,y,x-1,y-2,x+2,y-1],.8);
        }
      }
    }
  }
  function fairway(ctx, hole) {
    const land = hole.land, all = rects(land);
    const edges=shoreEdges(land);coastalShelf(ctx,edges,hole.id);
    if(hole.island==='Orchard Steps') terraceWalls(ctx,edges,hole);
    for (const [grow,offset,color] of [[2,4,'#405d4f'],[0,3,'#819172'],[0,1,'#c2b97d']]) {
      wash(ctx, rects(land,grow,offset), color);
    }
    const grass = ctx.createLinearGradient(0,50,0,H);
    if (hole.island === 'Orchard Steps') {
      grass.addColorStop(0,'#c3ae6f'); grass.addColorStop(.54,'#bec17c'); grass.addColorStop(1,'#aab36a');
    } else {
      grass.addColorStop(0,'#9da95d'); grass.addColorStop(.54,'#a9ba66'); grass.addColorStop(1,'#8fa359');
    }
    wash(ctx, all, grass);
    ctx.save(); ctx.clip(all);
    for (let x = -H; x < W+H; x += 33) {
      ctx.beginPath();ctx.moveTo(x,0);
      ctx.bezierCurveTo(x+48,135,x-151,271,x-132,H);
      ctx.lineTo(x-116,H);ctx.bezierCurveTo(x-133,271,x+66,135,x+16,0);
      ctx.closePath();ctx.fillStyle='#f5e69a26';ctx.fill();
    }
    const random = noise(hole.id * 724 + 13);
    for (let i = 0; i < 1600; i++) {
      const x = random()*W, y = random()*H, long = 1 + random()*2.6;
      line(ctx,i%4 ? '#63784436':'#eee7a445',[x,y,x+long,y-.7],.9);
    }
    const green = ctx.createRadialGradient(hole.cup.x,hole.cup.y,4,hole.cup.x,hole.cup.y,69);
    green.addColorStop(0,'#a4bf80'); green.addColorStop(.73,'#a1b976'); green.addColorStop(1,'#b6c57700');
    oval(ctx,hole.cup.x,hole.cup.y,73,59,green);
    ctx.save();ctx.translate(hole.cup.x,hole.cup.y);ctx.rotate(-.19);
    oval(ctx,0,0,51,29,null,'#71895585',.8);
    oval(ctx,0,0,47,26,null,'#d2d78c9c',.85);
    ctx.restore();
    for(const e of edges) {
      for(let d=2;d<e.len;d+=2+random()*4){
        const x=e.x+d*e.vx-e.nx*(1+random()*3),y=e.y+d*e.vy-e.ny*(1+random()*3);
        line(ctx,random()>.5?'#727f4f':'#d8c880',[x,y,x+1.1,y-1.8],1);
      }
    }
    for (let i=0;i<land.length;i++) {
      const r=land[i];
      if(r.kind==='turf')continue;
      ctx.save();
      // Later rectangles own an overlap, including turf that reclaims a dune.
      for(const cover of land.slice(i+1)) {
        if(!overlap(r,cover))continue;
        const exposed=new Path2D();
        exposed.rect(0,0,W,H);exposed.rect(cover.x,cover.y,cover.w,cover.h);
        ctx.clip(exposed,'evenodd');
      }
      if (r.kind === 'sand') sandy(ctx,r);
      if (r.kind === 'quay') stone(ctx,r);
      ctx.restore();
    }
    if (hole.slope) {
      const s = hole.slope, direction = Math.atan2(s.dy,s.dx);
      ctx.save(); ctx.clip(rects([s]));
      for (let y=s.y+12;y<s.y+s.h;y+=24) for (let x=s.x+12;x<s.x+s.w;x+=29) {
        ctx.save();ctx.translate(x,y);ctx.rotate(direction);
        line(ctx,'#405c4287',[-3,-3,1,0,-3,3],1.6);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function terraceWalls(ctx,edges,hole) {
    for(const e of edges) {
      if(e.ny!==1) continue;
      const {x,y,len}=e;
      // Steeper terraces cast deeper walls on Windfall Return's high green.
      const height=hole.ramp ? (x>350 ? 12 : 6) : 7;
      const masonry=ctx.createLinearGradient(x,y,x,y+height);
      masonry.addColorStop(0,'#c0a27a'); masonry.addColorStop(.67,'#94825f'); masonry.addColorStop(1,'#615f49');
      ctx.fillStyle=masonry;ctx.fillRect(x,y,len,height);
      for(let column=3;column<len;column+=13) {
        line(ctx,'#725f49',[x+column,y+3,x+column-2,y+height],1.1);
        line(ctx,'#b7a27b',[x+column+1,y+3,x+column-1,y+height],.8);
      }
      if(height>8) line(ctx,'#816f54',[x,y+7,x+len,y+7],1.2);
      line(ctx,'#d2bb8a',[x,y+1,x+len,y+1],1.4);
    }
  }
  function sandy(ctx,r) {
    ctx.save(); ctx.clip(rects([r]));
    ctx.fillStyle = '#d9c58c'; ctx.fillRect(r.x,r.y,r.w,r.h);
    const random = noise(Math.round(r.x+r.y)*8);
    for (let i=0;i<r.w*r.h/44;i++) {
      const x=r.x+random()*r.w, y=r.y+random()*r.h;
      line(ctx,i%3?'#a896654e':'#efe0ab',[x,y,x+1.8,y-.5]);
    }
    for (let i=0;i<4;i++) {
      line(ctx,'#ac986037',[r.x,r.y+r.h*.2+i*3,r.x+r.w*.35,r.y+r.h*.16+i*3,r.x+r.w,r.y+r.h*.24+i*3]);
    }
    ctx.restore();
  }
  function stone(ctx,r) {
    ctx.save(); ctx.clip(rects([r]));
    ctx.fillStyle = '#aca891'; ctx.fillRect(r.x,r.y,r.w,r.h);
    for (let y=r.y,i=0;y<r.y+r.h;y+=10,i++) {
      line(ctx,'#717b695e',[r.x,y,r.x+r.w,y],1);
      line(ctx,'#d9c79f',[r.x,y+1,r.x+r.w,y+1],.7);
      for (let x=r.x+(i%2)*12;x<r.x+r.w;x+=25) line(ctx,'#757e6a91',[x,y,x,y+10],1);
    }
    ctx.restore();
  }

  function orchardFeatures(ctx, hole) {
    if (hole.ramp) {
      const {x,y,w,h} = hole.ramp;
      stone(ctx,hole.ramp);
      const shadow = ctx.createLinearGradient(x,y,x+w,y);
      shadow.addColorStop(0,'#61523d6b'); shadow.addColorStop(1,'#ffdf9a92');
      wash(ctx,rects([hole.ramp]),shadow);
      for (const edge of [y+2,y+h-3]) {
        line(ctx,'#514f41',[x,edge,x+w,edge],4);
        line(ctx,'#e0bc82',[x,edge-1,x+w,edge-1],2);
      }
      // The engraved path follows the stone trough as it bends to the high lip.
      const cy = y+h*.56, ey = y+h*.25;
      ctx.beginPath(); ctx.moveTo(x+5,cy);
      ctx.bezierCurveTo(x+w*.55,cy,x+w*.7,cy,x+w-8,ey);
      ctx.strokeStyle='#665943'; ctx.lineWidth=4; ctx.stroke();
      ctx.strokeStyle='#f4d48e'; ctx.lineWidth=2; ctx.stroke();
      for (const t of [.23,.56,.87]) {
        const xx=x+w*t, yy=cy-(cy-ey)*Math.pow(t,3);
        line(ctx,ink,[xx-4,yy-4,xx+2,yy,xx-3,yy+4],4.5);
        line(ctx,cream,[xx-4,yy-4,xx+2,yy,xx-3,yy+4],2);
      }
    }
    if (hole.spinGreen) {
      const g=hole.spinGreen;
      wash(ctx,rects([g]),'#c5d287');
      ctx.save(); ctx.clip(rects([g]));
      for(let y=g.y;y<g.y+g.h;y+=14) {
        ctx.fillStyle='#acc079'; ctx.fillRect(g.x,y,g.w,6);
      }
      ctx.restore();
      for(const sx of [-1,1]) for(const sy of [-1,1]) {
        const x=sx===1 ? g.x+3 : g.x+g.w-3, y=sy===1 ? g.y+3 : g.y+g.h-3;
        line(ctx,'#50693f',[x+sx*8,y,x,y,x,y+sy*9],3.2);
        line(ctx,'#fff0b7',[x+sx*8,y,x,y,x,y+sy*9],1.4);
      }
      for (const c of hole.chutes) {
        const {x,y,w,h} = c;
        ctx.save(); ctx.clip(rects([c]));
        const current=ctx.createLinearGradient(x,y,x+w,y);
        current.addColorStop(0,'#365b5d'); current.addColorStop(.35,'#619b94');
        current.addColorStop(.75,'#447d7b'); current.addColorStop(1,'#305b5b');
        wash(ctx,rects([c]),current);
        for(let yy=y+2,i=0; yy<y+h; yy+=13,i++) {
          const xx=x+8+(i*11)%(w-17);
          line(ctx,'#c1ddd0ab',[xx,yy,xx-1,yy+5,xx,yy+10],1.5);
          if(i%3===1) line(ctx,'#d2e4c4',[xx-3,yy+6,xx,yy+10,xx+3,yy+6],1.6);
        }
        for(const xx of [x+1,x+w-2]) line(ctx,'#56513f',[xx,y,xx,y+h],4);
        for(const xx of [x+3,x+w-4]) line(ctx,'#d4ba89',[xx,y,xx,y+h],1.6);
        ctx.restore();
        for(let i=1;i<6;i++) oval(ctx,x+i*w/6,y+h+(i%2)*1.4,4,1.9,'#d5e3cbcb');
      }
    }
  }

  function fruitCargo(ctx,x,y) {
    ctx.save(); ctx.translate(x,y);
    polygon(ctx,'#91683e',[-9,-3,5,-5,10,-2,10,4,-4,6,-9,3],ink,1.1);
    polygon(ctx,'#664a35',[-9,-3,5,-5,10,-2,-4,1],ink,.8);
    for(const [xx,yy] of [[-4,-3],[1,-4],[5,-3],[-1,-1]]) {
      oval(ctx,xx,yy,2.6,2.5,'#a8422f');
      oval(ctx,xx-.7,yy-.6,1.5,1.4,'#e88243');
    }
    line(ctx,'#edc38a',[-8,-1,-4,1,9,-1],1.4);
    line(ctx,'#644c39',[-5,2,-5,5],1.3);
    ctx.restore();
  }

  function tidalIslet(ctx,r,level) {
    const {x,y,w,h} = r;
    // The opposite pool takes the water lost by the islet. Buoys delimit the
    // pool without depicting a solid crossing across this part of the canal.
    const poolX=x+11, poolY=y-122, poolW=w-20, poolH=63;
    ctx.save();
    const pool=ctx.createLinearGradient(poolX,poolY,poolX,poolY+poolH);
    pool.addColorStop(0,'#789a858f'); pool.addColorStop(1,'#a6b5986e');
    ctx.fillStyle=pool; ctx.fillRect(poolX,poolY,poolW,poolH);
    ctx.globalAlpha=level;
    ctx.fillStyle='#285c60be'; ctx.fillRect(poolX,poolY,poolW,poolH);
    ctx.globalAlpha=1;
    for(let i=0;i<6;i++) {
      const xx=poolX+8+i*22, yy=poolY+11+i*13%(poolH-18)-level*3;
      line(ctx,'#bed4bb9c',[xx,yy,xx+7,yy-1,xx+14,yy+1],1.4);
    }
    for(const edgeY of [poolY,poolY+poolH]) {
      line(ctx,'#364c468c',[poolX,edgeY,poolX+poolW*.5,edgeY+2,poolX+poolW,edgeY],1.5);
      for(const px of [poolX,poolX+poolW*.5,poolX+poolW]) {
        oval(ctx,px,edgeY,3.6,2.5,'#d2b584',ink,.9);
      }
    }
    // A banded gauge leaves only the upper marks showing at full tide.
    const gx=poolX+12, gy=poolY+poolH-12;
    const waterline=gy-level*10;
    line(ctx,'#464e40',[gx,waterline,gx,gy-22],5.5);
    line(ctx,'#e2ceb0',[gx,waterline,gx,gy-21],3.4);
    for(let yy=gy-19;yy<waterline;yy+=6) line(ctx,'#ad4e3b',[gx,yy,gx,Math.min(waterline,yy+2)],3.5);
    oval(ctx,gx,waterline+1,7,1.5,null,'#bed5c0bd',1);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=1-level;
    wash(ctx,rects([r]),'#8ca38145');
    ctx.strokeStyle='#d1d5a5a8'; ctx.lineWidth=1.6; ctx.setLineDash([4,6]);
    ctx.strokeRect(x+1,y+1,w-2,h-2);
    ctx.setLineDash([]);
    for(let i=0;i<8;i++) {
      const xx=x+9+i*(w-22)/8, yy=y+9+(i*13)%(h-17);
      line(ctx,'#d0dfbda6',[xx,yy,xx+5,yy-1,xx+9,yy],1.1);
    }
    ctx.globalAlpha=level;
    ctx.fillStyle='#645e4d'; ctx.fillRect(x,y+3,w,h);
    const silt=ctx.createLinearGradient(x,y,x,y+h);
    silt.addColorStop(0,'#e2cc91'); silt.addColorStop(.35,'#b7bd77'); silt.addColorStop(1,'#af9c68');
    wash(ctx,rects([r]),silt);
    ctx.strokeStyle='#bfaf79'; ctx.lineWidth=2; ctx.strokeRect(x+1,y+1,w-2,h-2);
    ctx.save(); ctx.clip(rects([r]));
    for(let i=0;i<11;i++) {
      const xx=x+i*w/9, yy=y+9+(i*17)%(h-13);
      line(ctx,'#827e584c',[xx-16,yy+2,xx,yy,xx+12,yy+1,xx+24,yy-1],1.3);
    }
    ctx.restore(); ctx.globalAlpha=1;
    for(const px of [x+3,x+w-4]) {
      const py=y+h-1;
      oval(ctx,px+1,py+1,6,2.4,'#234e4a5e');
      line(ctx,'#514c40',[px,py+1,px,py-11],3.6);
      line(ctx,'#eecc90',[px,py-7,px,py-11],2.7);
      line(ctx,'#bd583c',[px,py-4,px,py-6],2.7);
    }
    ctx.restore();
  }
  function barrier(ctx,r) {
    const {x,y,w,h} = r;
    const lip = r.kind === 'lip', bank = r.kind === 'bank';
    if(r.kind==='wall'&&w>30&&h>55){
      // The bellhouse occupies its actual collision footprint. A copper roof,
      // open belfry and pull-rope make the obstacle identifiable from above.
      ctx.save();ctx.translate(x,y);
      ctx.fillStyle='#384b3e67';ctx.fillRect(4,5,w,h);
      ctx.fillStyle='#e2ca8f';ctx.fillRect(0,0,w,h);
      ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(0,0,w,h);
      polygon(ctx,'#a5553f',[1,10,w*.45,1,w-1,10,w-1,h-14,w*.45,h-22,1,h-12],ink);
      polygon(ctx,'#ce7952',[1,10,w*.45,1,w*.45,h-22,1,h-12],ink);
      for(let yy=17;yy<h-22;yy+=6){
        line(ctx,'#edaa72',[2,yy,w*.44,yy-8],.8);
        line(ctx,'#7f4636',[w*.46,yy-7,w-2,yy+1],.9);
      }
      line(ctx,'#f0ba79',[w*.45,2,w*.45,h-23],1.7);
      for(let i=0;i<4;i++){
        const xx=4+i*(w-8)/4;
        line(ctx,ink,[xx,h-9,xx,h-3],3);
      }
      const xx=w*.46, yy=h*.48;
      polygon(ctx,'#ecce8e',[xx-9,yy-16,xx+2,yy-20,xx+12,yy-15,xx+12,yy+2,xx-1,yy+6,xx-9,yy+1],ink,1.8);
      polygon(ctx,'#354e43',[xx-6,yy-13,xx,yy-15,xx+1,yy+2,xx-6,yy]);
      polygon(ctx,'#3c5045',[xx+4,yy-16,xx+9,yy-14,xx+10,yy,xx+5,yy+1]);
      polygon(ctx,'#e3b35b',[xx-5,yy-2,xx-4,yy-7,xx-2,yy-9,xx,yy-3,xx+1,yy-1]);
      polygon(ctx,'#647a65',[xx-12,yy-16,xx-1,yy-31,xx+15,yy-16,xx+3,yy-12],ink,1.5);
      line(ctx,'#e6cc90',[xx-1,yy-30,xx+3,yy-13],1.2);
      line(ctx,ink,[xx-1,yy-31,xx-1,yy-36],1.4);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#394b3757'; ctx.fillRect(x+2,y+3,w+1,h+1);
    ctx.fillStyle = lip ? '#c69a5b' : bank ? '#a66f46' : '#637468';
    ctx.fillRect(x,y,w,h);
    ctx.lineWidth = 1.7; ctx.strokeStyle = '#394d3e'; ctx.strokeRect(x,y,w,h);
    ctx.save(); ctx.clip(rects([r]));
    const horizontal = w >= h, long = horizontal ? w : h;
    for (let d=4;d<long;d+=lip?8:13) {
      if (horizontal) line(ctx,lip?'#eee0a5':'#405c49',[x+d,y+1,x+d-2,y+h],lip?2:1);
      else line(ctx,lip?'#eee0a5':'#405c49',[x+1,y+d,x+w,y+d-2],lip?2:1);
    }
    if (bank) line(ctx,'#f3da87',horizontal?[x,y+h/2,x+w,y+h/2]:[x+w/2,y,x+w/2,y+h],2.1);
    ctx.restore();
    line(ctx,lip?'#eedfac':'#c9caab',[x,y+h,x,y,x+w,y],1.3);
  }
  function staticChart(hole,density) {
    const layer = document.createElement('canvas');
    layer.width = W*density; layer.height = H*density;
    const ctx = layer.getContext('2d');
    ctx.scale(density,density); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    water(ctx,hole.id);
    if (hole.island === 'Orchard Steps') orchardBank(ctx,hole);
    else harbor(ctx,hole);
    fairway(ctx,hole);
    if (hole.island === 'Orchard Steps') orchardFeatures(ctx,hole);
    for (const r of hole.rails) barrier(ctx,r);
    return layer;
  }

  function lockworks(ctx,hole,level) {
    if (hole.islet) tidalIslet(ctx,hole.islet,level);
    if (hole.sandbar) {
      const s = hole.sandbar;
      if (level < 1) {
        ctx.save(); ctx.globalAlpha = 1-level; sandy(ctx,s); ctx.restore();
      }
      if (level > 0) {
        ctx.save(); ctx.globalAlpha=level;
        wash(ctx,rects([s]),'#c4d7ad34');
        line(ctx,'#b3d4b093',[s.x,s.y+s.h,s.x+s.w,s.y+s.h],1,[5,5]);
        ctx.restore();
      }
    }
    if (hole.deck) {
      const d=hole.deck, x=d.x+d.dx*level,y=d.y+d.dy*level;
      const cx = d.x+d.w/2, cy = d.y+d.h/2;
      // Twin mooring lines make the travel direction visible before the paddle is struck.
      line(ctx,'#e5d6acaa',[cx,cy,cx+d.dx,cy+d.dy],1.4,[2,4]);
      const hull={x,y,w:d.w,h:d.h};
      if(hole.barge) {
        // Four fixed timber dolphins mark the berth the lighter will enter.
        const bx=d.x+d.dx, by=d.y+d.dy;
        for(const px of [bx-3,bx+d.w+3]) for(const py of [by-2,by+d.h+2]) {
          oval(ctx,px+2,py+2,5,2.2,'#223e3b74');
          line(ctx,'#524c3a',[px,py,px,py-5],4);
          oval(ctx,px,py-5,2.7,1.8,'#e7bf77',ink,.8);
        }
        polygon(ctx,'#734b36',[x-5,y+2,x+d.w-4,y-1,x+d.w+5,y+6,x+d.w+4,y+d.h-2,x+4,y+d.h+5,x-5,y+d.h-4],ink,1.5);
      }
      ctx.fillStyle='#25463e';ctx.fillRect(x,y+3,d.w,d.h);
      ctx.fillStyle='#b38b55';ctx.fillRect(x,y,d.w,d.h);
      ctx.strokeStyle='#493f31';ctx.lineWidth=2;ctx.strokeRect(x,y,d.w,d.h);
      ctx.save();ctx.clip(rects([hull]));
      for(let i=2;i<d.w;i+=7) {
        line(ctx,'#ead49a',[x+i,y+1,x+i,y+d.h-2],1);
        line(ctx,'#826744',[x+i+1.5,y+2,x+i+1.5,y+d.h-1],.9);
      }
      for(const yy of [y+3,y+d.h-3]) line(ctx,'#7b5e42',[x,yy,x+d.w,yy],2);
      ctx.restore();
      for(const xx of [x+3,x+d.w-3]) for(const yy of [y+3,y+d.h-3]) oval(ctx,xx,yy,2.5,2,cream,'#594a38');
      if(hole.barge) {
        for (const [cx,cy] of [[13,7],[33,7],[20,d.h-6],[d.w-16,d.h-6]]) fruitCargo(ctx,x+cx,y+cy);
        line(ctx,'#973e30',[x+4,y+d.h+2,x+d.w-4,y+d.h+2],3);
      }
    }
    if (hole.paddle) {
      const {x,y}=hole.paddle;
      oval(ctx,x,y+1,12,8,'#304e4299');
      oval(ctx,x,y,9.5,8,'#e5c46a',ink,2);
      ctx.save();ctx.translate(x,y);ctx.rotate(level ? .42 : -.42);
      const handle=ctx.createLinearGradient(-5,0,5,0);
      handle.addColorStop(0,'#8c4939');handle.addColorStop(.53,'#e0784c');handle.addColorStop(1,'#a34d38');
      ctx.fillStyle=handle;ctx.fillRect(-4,-15,8,17);
      ctx.strokeStyle=ink;ctx.lineWidth=1.8;ctx.strokeRect(-4,-15,8,17);
      ctx.fillStyle=cream;ctx.fillRect(-3,-12,6,4);ctx.fillRect(-3,-4,6,3);
      ctx.restore();
    }
    if (Number.isFinite(hole.passageX)) {
      const x=hole.passageX;
      const lanes=hole.land.filter(r=>r.kind==='quay' && r.x<x && r.x+r.w>x);
      if(hole.sandbar && level<.5) lanes.push(hole.sandbar);
      for(const lane of lanes){
        const top=lane.y+5,bottom=lane.y+lane.h-5,mid=(top+bottom)/2;
        line(ctx,'#304d42',[x,top,x,bottom],2,[3,4]);
        for(const y of [top,bottom]){
          oval(ctx,x,y,4,2.6,'#e8c676',ink,1.2);
          line(ctx,cream,[x-1.3,y-.5,x+1.3,y-.5],1);
        }
        // Inlaid arrows indicate the eastbound crossing without suggesting a rail.
        line(ctx,'#f3e5b6',[x+4,mid-3,x+8,mid,x+4,mid+3],3);
        line(ctx,ink,[x+4,mid-3,x+8,mid,x+4,mid+3],1.5);
      }
    }
  }
  function pin(ctx,cup,id,open) {
    const {x,y}=cup;
    oval(ctx,x,y,7,4.8,open?'#233932':'#cfa555',open?'#e7de9c':'#695630',1.7);
    if(!open)line(ctx,'#876e3d',[x-5,y+1,x+5,y-1],1.3);
    line(ctx,'#334b3c52',[x+1,y,x+13,y+4],2.4);
    line(ctx,'#3c4233',[x,y-1,x,y-30],3);
    line(ctx,cream,[x-.6,y-2,x-.6,y-29],1);
    polygon(ctx,'#ba583a',[x,y-30,x+10,y-31,x+18,y-28,x+15,y-18,x+7,y-21,x,y-19],ink,1.3);
    ctx.font = 'bold 8px Georgia, serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff3ca';ctx.fillText(String(id),x+8,y-25);
    oval(ctx,x,y-31,1.8,1.8,brass);
  }
  function stamp(ctx,p,earned) {
    const {x,y}=p;
    ctx.save();ctx.translate(x,y);ctx.rotate(-.13);
    oval(ctx,1,2,9,6,'#41563250');
    const edge = earned ? '#708150' : '#83582e';
    const points = [];
    for(let i=0;i<8;i++){
      const a=TAU*i/8+TAU/16;points.push(Math.cos(a)*8.8,Math.sin(a)*8.8);
    }
    polygon(ctx,earned?'#a5aa69':'#f2c76b',points,edge,1.6);
    if(earned)line(ctx,'#526a44',[-4,0,-1,3,4,-4],2);
    else {
      oval(ctx,0,0,5.8,5.8,null,'#a47940',.9);
      polygon(ctx,'#986b34',[0,-4,1.3,-1.2,4,0,1.2,1.1,0,4,-1.2,1.1,-4,0,-1.2,-1.2]);
    }
    ctx.restore();
  }
  function aim(ctx,state,view) {
    const a=view.angle*Math.PI/180;
    const guide = view.guide;
    let points;
    if(guide && guide.length>1) {
      points=[];
      for(const p of guide) points.push(p.x,p.y-(p.z||0));
    } else {
      const len = 25+(view.power||0)*.75;
      points=[state.x,state.y,state.x+Math.cos(a)*len,state.y+Math.sin(a)*len];
    }
    line(ctx,'#264c408a',points,3.4);
    line(ctx,'#ffefb3',points,2,[5,4]);
    const n=points.length, x=points[n-2],y=points[n-1];
    oval(ctx,x,y,3.4,3.4,'#f7e6a6',ink,1.3);
  }
  function golfBall(ctx,ball) {
    const z=ball.z||0;
    const ground = Math.max(.22,1-z*.009);
    ctx.save();ctx.globalAlpha=ground;
    oval(ctx,ball.x+1.3,ball.y+2,6.3,3.5,'#21392eb3');
    ctx.restore();
    const y=ball.y-z;
    const sphere=ctx.createRadialGradient(ball.x-1.7,y-2.2,.3,ball.x,y,5.4);
    sphere.addColorStop(0,'#fffff4');sphere.addColorStop(.6,'#fffadf');sphere.addColorStop(1,'#acc3a9');
    oval(ctx,ball.x,y,5.3,5.3,sphere,'#334d3c',1.3);
  }

  function touchdownMark(ctx,point,chartWidth) {
    // Keep a visible open centre for a stamp or cup at the landing coordinates.
    const radius=Math.max(13,7*W/chartWidth);
    const width=Math.max(2,1.2*W/chartWidth);
    ctx.save(); ctx.translate(point.x,point.y);
    oval(ctx,0,0,radius,radius*.78,null,'#273e42',width*2);
    ctx.setLineDash([radius*.46,radius*.34]);
    oval(ctx,0,0,radius,radius*.78,null,'#fff4ce',width);
    ctx.restore();
  }
  TL.draw = function draw(canvas,hole,state,view) {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio||1,2);
    const width = Math.max(1,Math.round(box.width*ratio));
    const height = Math.max(1,Math.round(box.height*ratio));
    if(canvas.width!==width || canvas.height!==height) {
      canvas.width=width;canvas.height=height;
    }
    const ctx=canvas.getContext('2d');
    const density=Math.min(3,Math.max(1,Math.ceil(width/W)));
    let cache=charts.get(canvas);
    if(!cache || cache.hole!==hole || cache.density!==density) {
      cache={hole,density,layer:staticChart(hole,density)};
      charts.set(canvas,cache);
    }
    ctx.setTransform(width/W,0,0,height/H,0,0);
    ctx.lineJoin='round';ctx.lineCap='round';
    ctx.drawImage(cache.layer,0,0,W,H);
    lockworks(ctx,hole,Number.isFinite(view.level)?view.level:state.level);
    if(view.touchdown && !view.moving && !state.holed) touchdownMark(ctx,view.touchdown,Math.max(1,box.width));
    if(hole.stamp)stamp(ctx,hole.stamp,state.marked);
    pin(ctx,hole.cup,hole.id,state.qualified||state.holed);
    if(!view.moving&&!state.holed)aim(ctx,state,view);
    if(!state.holed || view.moving)golfBall(ctx,view.ball||state);
  };
})();
