import * as THREE from './vendor/three.module.min.js';

// Rendering is a projection of IW state. No collision or gameplay lives here.
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#16262e');
  scene.fog = new THREE.FogExp2('#26393e', 0.009);
  const camera = new THREE.PerspectiveCamera(43, 1, .2, 220);
  camera.position.set(0, 28, 35);
  const ambient = new THREE.HemisphereLight(0xb4e8ef, 0x3b2623, 2.5); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffd3a2, 4.1); sun.position.set(-28, 43, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536); Object.assign(sun.shadow.camera, { left:-52,right:52,top:43,bottom:-43,near:1,far:130 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .05; scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x66cbe9, 1.1); fill.position.set(18, 9, -23); scene.add(fill);
  const materials = [], geometries = [], textures = [];
  const mat = (color, roughness=.8, metalness=.25, emissive=0, extra={}) => {
    const m = new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,...extra}); materials.push(m); return m;
  };
  const M = {
    ground:mat('#202d30'),groundPanel:mat('#2c3b3c'),road:mat('#121c20'),roadEdge:mat('#9aa8a0'),curb:mat('#70817e'),concrete:mat('#647574'),concreteDark:mat('#435353'),dark:mat('#101b22'),
    steel:mat('#647477',.4,.75),steelLight:mat('#a5b3aa',.36,.7),black:mat('#18232a',.5,.7),orange:mat('#d2702b',.5,.65),orangeLight:mat('#ffc46d',.4,.5),rust:mat('#7a3e2c',.65,.45),
    cyan:mat('#5af5eb',.3,.4,'#20a9ac'),red:mat('#ff6550',.5,.3,'#e5260a'),yellow:mat('#f2c667'),roadMark:mat('#e7c566'),
    glass:mat('#163b49',.22,.78,'#08202b'),window:mat('#efca80',.4,.5,'#ba742a'),enemy:mat('#925447',.55,.6),
    white:mat('#d2dcd5'),rubble:mat('#46534f'),rubbleDark:mat('#303d3d'),smoke:mat('#465452',1,0,0,{transparent:true,opacity:.56,depthWrite:false}),
    flash:mat('#fff0b2',.3,.1,'#ffae20'),warning:mat('#ffbf52',.4,.1,'#d98015',{transparent:true,opacity:.65,depthWrite:false}),warningDark:mat('#553b2c',.7,.2,'#2d1810'),
  };
  const boxGeo = new THREE.BoxGeometry(1,1,1); geometries.push(boxGeo);
  const sphereGeo = new THREE.IcosahedronGeometry(1,0); geometries.push(sphereGeo);
  const cylGeo = new THREE.CylinderGeometry(1,1,1,8); geometries.push(cylGeo);
  const siloGeo = new THREE.CylinderGeometry(1,1,1,12); geometries.push(siloGeo);
  const capGeo = new THREE.CylinderGeometry(.15,.9,1,8); geometries.push(capGeo);
  const torusGeo = new THREE.TorusGeometry(1,.1,6,16); geometries.push(torusGeo);
  const mesh = (geo,m,x=0,y=0,z=0,sx=1,sy=1,sz=1,parent=scene) => {
    const q=new THREE.Mesh(geo,m); q.position.set(x,y,z); q.scale.set(sx,sy,sz); q.castShadow=true;q.receiveShadow=true;parent.add(q);return q;
  };
  const box=(m,x,y,z,sx,sy,sz,parent)=>mesh(boxGeo,m,x,y,z,sx,sy,sz,parent);
  const group=(parent=scene)=>{const g=new THREE.Group();parent.add(g);return g;};
  const pipe=(m,x,y,z,r,length,axis='y',parent=scene)=>{const q=mesh(cylGeo,m,x,y,z,r,length,r,parent);if(axis==='x')q.rotation.z=Math.PI/2;else if(axis==='z')q.rotation.x=Math.PI/2;return q;};
  const beam=(m,x,y,z,sx,sy,sz,rotation=0,parent=scene)=>{const q=box(m,x,y,z,sx,sy,sz,parent);q.rotation.y=rotation;return q;};
  function label(text,color='#e7d8b5',background=null) {
    const c=document.createElement('canvas'); c.width=512;c.height=128;const ctx=c.getContext('2d');
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,512,128);}ctx.fillStyle=color;ctx.font='bold 70px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;textures.push(tex);
    const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});materials.push(m);return m;
  }
  const planeGeo = new THREE.PlaneGeometry(1,1); geometries.push(planeGeo);
  function flatText(text,x,z,w=10){const q=mesh(planeGeo,label(text,'#88938b'),x,.025,z,w,w/4,1);q.rotation.x=-Math.PI/2;q.castShadow=false;return q;}
  const legacyStart=scene.children.length;
  box(M.ground,0,-.45,0,150,.8,130);
  for(const x of [-37.5,-22.5,-7.5,7.5,22.5,37.5])for(const z of [-20,0,20])box(M.groundPanel,x,-.025,z,13.5,.035,6.4);
  box(M.road,0,-.015,-6,110,.12,8.8);
  box(M.road,0,-.008,15,110,.1,7);
  for(const x of [-30,-15,0,15,30])box(M.road,x,-.01,1,6,.11,58);
  for(let x=-51;x<54;x+=5){box(M.roadMark,x,.055,-6,2.3,.035,.11);box(M.curb,x,.09,-10.7,4.8,.2,.18);box(M.curb,x,.09,-1.3,4.8,.2,.18);}
  for(const x of [-45,-30,-15,0,15,30,45]){beam(M.roadEdge,x,.065,-10.35,3.8,.045,.14);beam(M.roadEdge,x,.065,-1.65,3.8,.045,.14);}
  for(const x of [-22,-7,8,23])for(const z of [-19,-13,5,11])beam(M.roadMark,x,.045,z,.18,.025,2.4);
  for(const x of [-30,-15,0,15,30])for(let z=9;z<13;z+=.65)box(M.curb,x,.06,z,4,.03,.25);
  flatText('SECTOR 07',1,22,14);flatText('TRANSIT',-19,-6,8);flatText('KEEP CLEAR',19,15,11);flatText('CONVOY ROUTE',-33,-6,11);
  // Remote industrial scenery frames the arena without hiding combat lanes.
  for(let i=0;i<25;i++){
    const x=-63+i*5.2,h=7+((i*31)%17),z=-38-(i%3)*6,accent=i%3===0?M.orange:i%3===1?M.cyan:M.steel;
    box(i%2?M.dark:M.concreteDark,x,h/2,z,3.8,h,5.8);
    box(M.steel,x,h+.2,z,4.1,.3,6.1);
    box(M.black,x,h*.54,z-3.02,3.2,.18,.12);
    for(let j=2;j<h;j+=3){box(i%4===0?M.glass:M.dark,x,j,z+2.93,3,.45,.07);box(accent,x-1.4,j+.2,z-2.94,.18,.2,.08);}
    for(const side of [-1,1])box(M.steel,x+side*1.65,h*.52,z-2.98,.12,h*.9,.12);
    if(i%4===0){pipe(M.steel,x,h+2,z,.4,4);pipe(accent,x+.55,h+1.3,z,.11,3.4,'z');}
    if(i%5===2){box(M.orange,x,h*.72,z+3.05,1.7,.12,.09);box(M.yellow,x,h*.72+.18,z+3.05,.5,.05,.1);}
  }
  for(const x of [-44,44]){
    box(M.concrete,x,1.1,4,1.1,2.2,68);
    for(let z=-26;z<31;z+=5)box(M.yellow,x,2.28,z,1.2,.1,1.8);
    box(M.steel,x,10,-23,.6,20,.6);box(M.orange,x-5,19,-23,15,.6,.7);
    box(M.black,x-11,14,-23,.12,10,.12);box(M.orange,x-11,9,-23,1,.8,1);
  }
  // Low service crates and light masts placed beyond the useful play space.
  for(let i=0;i<12;i++){
    const x=-37+(i%6)*14,z=i<6?30:-28;
    box(i%2?M.orange:M.steel,x,.7,z,2.8,1.4,1.4);
    for(let j=0;j<4;j++)box(M.black,x-1+j*.65,.7,z+.73,.08,1.2,.03);
    box(M.black,x+3,3,z,.12,6,.12);box(M.window,x+3,6,z-.4,1,.16,.8);box(M.cyan,x+3,6.6,z-.4,.3,.08,.3);
  }
  function makeRefineryYard(x,z,scale=1){
    const g=group();g.position.set(x,0,z);
    box(M.concreteDark,0,.18,0,13*scale,.36,6.4*scale,g);
    box(M.steel,0,.4,-3.05*scale,13.3*scale,.1,.18,g);
    for(const [dx,h]of[[-4.5,4.6],[-1.5,6.2],[1.7,5.3],[4.4,3.8]]){
      mesh(siloGeo,dx%2?M.steelLight:M.concrete,dx*scale,h*scale*.5,0,.85*scale,h*scale,.85*scale,g);
      mesh(capGeo,M.dark,dx*scale,(h+.65)*scale,0,.9*scale,.75*scale,.9*scale,g);
      mesh(torusGeo,M.orange,dx*scale,h*scale*.55,0,.88*scale,.88*scale,.88*scale,g);
      pipe(M.cyan,dx*scale,.8*scale,0,.08*scale,(h-1)*scale,'y',g);
    }
    pipe(M.orange,0,2.2*scale,-1.1*scale,.13*scale,9*scale,'x',g);
    pipe(M.steel,0,3.35*scale,1.25*scale,.1*scale,9*scale,'x',g);
    for(const dx of [-5.5,5.5]){pipe(M.steel,dx*scale,2.3*scale,-1.1*scale,.08*scale,3*scale,'y',g);box(M.yellow,dx*scale,3.85*scale,-1.1*scale,.8*scale,.08,.18*scale,g);}
    for(const dx of [-5.6,5.6]){box(M.steel,dx*scale,3.1*scale,0, .18*scale,6.2*scale,.18*scale,g);beam(M.orange,0,5.9*scale,0,11.5*scale,.18*scale,.18*scale,0,g);}
    for(let dx=-4.8;dx<=4.8;dx+=1.6)box(M.black,dx*scale,5.7*scale,0,.07*scale,.8*scale,.07*scale,g);
    const sign=mesh(planeGeo,label('NORTH YARD','#ffe2a5','#26373a'),0,4.4*scale,-3.18*scale,7*scale,.72*scale,1,g);sign.castShadow=false;
    return g;
  }
  function makeTransitGantry(x,z,span=10){
    const g=group();g.position.set(x,0,z);
    for(const side of [-1,1]){box(M.steel,side*span*.5,3.2,0,.5,6.4,.5,g);box(M.orange,side*span*.5,6.25,0,.8,.18,1.1,g);}
    beam(M.steel,0,6.2,0,span,.45,.45,0,g);beam(M.orange,0,5.85,0,span*.82,.16,.18,0,g);
    for(let i=-4;i<=4;i+=2)box(i%4?M.black:M.yellow,i,5.98,0,.2,.28,.62,g);
    for(const side of [-1,1]){beam(M.steel,side*span*.25,4.5,0,span*.5,.16,.16,side<0?-.45:.45,g);}
    const sign=mesh(planeGeo,label('TRANSIT / 07','#ffe2a5','#24383b'),0,4.8,-.56,5.8,.6,1,g);sign.castShadow=false;
    return g;
  }
  makeRefineryYard(-27,23,.9);
  makeRefineryYard(29,25,.72);
  makeTransitGantry(-29,15,9);
  makeTransitGantry(28,15,9);
  const legacyWorld=new THREE.Group();
  for(const child of scene.children.slice(legacyStart))legacyWorld.add(child);
  scene.add(legacyWorld);
  const buildings=new Map(),enemies=new Map(),shots=new Map(),effects=new Map();
  const hostileLabel=label('CONVOY','#ffc195'),escortLabel=label('ESCORT','#ffa191'),ripLabel=label('RIP GUN','#ffe392');
  for(const m of [hostileLabel,escortLabel,ripLabel])m.depthTest=false;
  const towerGuideLabel=label('PUNCH TOWER','#fff0bd','#6b361e'),fallGuideLabel=label('FALL LINE','#fff0bd','#6b361e');
  for(const m of [towerGuideLabel,fallGuideLabel])m.depthTest=false;
  const markerRed=new THREE.MeshBasicMaterial({color:0xff795e,depthTest:false,depthWrite:false}),markerBg=new THREE.MeshBasicMaterial({color:0x18232a,depthTest:false,depthWrite:false});materials.push(markerRed,markerBg);
  function addMarker(v,e){v.marker=group();v.marker.renderOrder=10;v.markerLabel=mesh(planeGeo,e.type==='tank'?hostileLabel:escortLabel,0,0,0,2.7,.65,1,v.marker);v.markerLabel.renderOrder=11;v.markerLabel.castShadow=false;const bg=mesh(planeGeo,markerBg,0,-.4,0,1.9,.12,1,v.marker);bg.renderOrder=11;bg.castShadow=false;v.hpBar=mesh(planeGeo,markerRed,0,-.4,.01,1.9,.075,1,v.marker);v.hpBar.renderOrder=12;v.hpBar.castShadow=false;}
  function makeMech(enemy=false){
    const g=group(),paint=enemy?M.enemy:M.orange,legs=[];
    for(const side of [-1,1]){
      const leg=group(g);leg.position.set(side*.62,0,0);legs.push(leg);
      box(M.black,0,.31,.22,.77,.55,1.4,leg);box(paint,0,.64,.02,.64,.6,.87,leg);
      box(M.steel,0,1.11,-.04,.31,.65,.34,leg);box(paint,0,1.47,-.04,.67,.55,.7,leg);
      mesh(cylGeo,M.black,0,1.6,-.03,.26,.72,.26,leg).rotation.z=Math.PI/2;
      box(M.steel,side*.26,1.03,-.26,.09,.92,.09,leg);
    }
    box(M.black,0,1.83,0,1.32,.51,.84,g);
    const torso=group(g);torso.position.y=2.1;
    box(paint,0,.39,0,1.48,1.03,1.01,torso);box(M.black,0,.59,.52,1.03,.6,.13,torso);
    box(enemy?M.red:M.cyan,0,.65,.61,.87,.19,.06,torso);
    box(M.steel,0,.88,.11,.97,.15,1.05,torso);
    for(const side of [-1,1]){
      box(paint,side*1.02,.5,0,.65,.74,1.03,torso);box(M.black,side*1.03,-.1,.1,.32,.62,.42,torso);
      if(side>0)box(paint,side*1.05,-.35,.35,.58,.6,.67,torso);
      box(M.yellow,side*1.03,.84,.18,.43,.07,.37,torso);
      for(let i=0;i<3;i++)box(M.dark,side*.43,.24+i*.17,-.53,.45,.06,.06,torso);
      mesh(cylGeo,M.black,side*.51,.86,-.43,.15,.8,.15,torso);
    }
    const fist=group(torso);fist.position.set(-1.05,-.35,.35);box(M.steel,0,0,0,.68,.64,.83,fist);box(paint,0,0,-.38,.74,.68,.24,fist);for(let j=0;j<3;j++)box(M.orangeLight,-.22+j*.22,0,.44,.12,.36,.1,fist);
    const cannon=group(torso);cannon.position.set(1.06,-.21,.63);
    box(M.black,0,0,.48,.41,.39,1.36,cannon);box(M.steel,0,0,1.1,.54,.48,.42,cannon);
    box(M.dark,0,0,1.325,.32,.25,.04,cannon);
    const muzzle=mesh(sphereGeo,M.flash,0,0,1.7,.32,.32,.65,cannon);muzzle.visible=false;
    const core=box(enemy?M.red:M.cyan,0,.3,-.565,.45,.5,.05,torso);
    const ringGeo=new THREE.RingGeometry(1.15,1.27,40);geometries.push(ringGeo);
    const ring=mesh(ringGeo,enemy?M.red:M.cyan,0,.05,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
    return {g,torso,legs,cannon,muzzle,core,ring,fist};
  }
  const player=makeMech();
  const silhouetteMaterial=new THREE.MeshBasicMaterial({color:'#65ffe7',transparent:true,opacity:.38,depthTest:false,depthWrite:false});materials.push(silhouetteMaterial);
  const silhouette=player.g.clone(true),playerParts=[],ghostParts=[];player.g.traverse(v=>playerParts.push(v));silhouette.traverse(v=>{ghostParts.push(v);if(v.isMesh){v.material=silhouetteMaterial;v.renderOrder=25;v.castShadow=false;v.receiveShadow=false;}});scene.add(silhouette);
  const steam=group(player.g);
  for(let i=0;i<5;i++)mesh(sphereGeo,M.smoke,0,0,0,.4,.4,.4,steam);
  function makeTank(){
    const g=group();
    for(const side of [-1,1]){
      box(M.black,0,.44,side*.85,2.8,.7,.5,g);
      for(let j=-1;j<=1;j+=.4)box(M.steel,j,.48,side*1.11,.14,.47,.05,g);
      box(M.orangeLight,side*1.04,.78,0,.12,.12,.9,g);
    }
    box(M.enemy,0,.82,0,2.5,.65,1.72,g);box(M.steel,0,1.06,0,2.28,.13,1.51,g);box(M.rust,0,.72,-.9,1.15,.16,.08,g);
    const turret=group(g);box(M.enemy,0,1.37,0,1.2,.58,1.25,turret);
    box(M.black,0,1.43,1.2,.25,.24,1.8,turret);box(M.steel,0,1.43,2.05,.38,.32,.27,turret);
    box(M.red,0,1.27,.64,.55,.12,.05,turret);box(M.yellow,0,1.69,-.54,.7,.08,.08,turret);
    box(M.black,-.36,1.93,-.28,.035,1.1,.035,turret);
    return{g,turret};
  }
  function makeFortress(){
    const g=group(),turret=group(g),legs=[];
    for(const side of [-1,1])for(const z of [-5,5]){
      const leg=group(g);leg.position.set(side*7,0,z);legs.push(leg);
      box(M.black,0,.7,0,4,1.4,5,leg);box(M.steel,0,3,0,2,5,2,leg);
      box(M.enemy,side*-.5,5.5,0,3,3,3,leg);pipe(M.orange,0,3.5,1.2,.25,4,'y',leg);
    }
    box(M.dark,0,6,0,13,4,17,g);box(M.enemy,0,8,0,12,3,15,g);
    box(M.steel,0,10,0,8,2,11,g);box(M.dark,0,12,-2,6,4,6,g);
    box(M.red,0,13,1.1,5,.4,.1,g);pipe(M.black,0,15,-2,.15,6,'y',g);
    const core=mesh(sphereGeo,M.cyan,0,6,8.8,2.2,2.2,1,g);
    for(const side of [-1,1]){box(M.enemy,side*7,10,0,4,3,7,turret);for(const dx of [-.7,.7])pipe(M.black,side*7+dx,10,5,.45,9,'z',turret);}
    for(let i=-4;i<=4;i+=2){box(M.orange,i,8.7,7.8,.7,.2,.15,g);box(M.steel,i,4.8,8,.5,2,.4,g);}
    return {g,turret,legs,core};
  }
  function makeBuilding(b){
    const root=group(),pivot=group(root);root.position.set(b.x,0,b.z);
    const h=b.h,w=b.w,d=b.d;
    if(b.kind==='train'){
      box(M.black,0,.65,0,w,1.3,d,pivot);box(M.rust,0,2.5,0,w-1,3,d-.4,pivot);box(M.steel,0,4.1,0,w,.3,d+.2,pivot);
      for(const side of [-1,1])for(const x of [-4,-2,2,4]){const wheel=mesh(cylGeo,M.black,x,.8,side*2.5,.8,.3,.8,pivot);wheel.rotation.x=Math.PI/2;box(M.cyan,x,2.8,side*2.32,1.1,.6,.1,pivot);box(M.steel,x,2.8,side*2.4,.1,.8,.1,pivot);}
      box(M.yellow,0,1.3,2.4,w-1,.2,.15,pivot);box(M.steel,0,1,-2.8,w,1,.2,pivot);
      const beacon=mesh(sphereGeo,M.cyan,-4,4.5,0,.2,.2,.2,pivot),damage=group(pivot),rubble=group(root);damage.visible=false;rubble.visible=false;
      return{root,pivot,rubble,damage,beacon,w,d,h};
    }
    const isTower=String(b.id).startsWith('tower');
    const bodyMat=mat(b.color||(isTower?'#536b6b':'#697c7c'),.68,.42);
    box(bodyMat,0,h*.5,0,w,h,d,pivot);
    box(M.concreteDark,0,.44,0,w+.08,.88,d+.08,pivot);
    box(M.steelLight,0,.94,0,w+.16,.12,d+.16,pivot);
    box(M.steel,0,h+.12,0,w+.5,.26,d+.5,pivot);
    box(M.black,0,h+.65,0,w*.64,1.08,d*.64,pivot);
    box(isTower?M.orange:M.cyan,0,h*.37,d*.5+.035,w*.68,.1,.07,pivot);
    box(M.black,0,h*.39,d*.5+.045,w*.72,.035,.05,pivot);
    box(isTower?M.cyan:M.orange,0,h*.68,d*.5+.035,w*.42,.08,.07,pivot);
    box(M.steel,-w*.42,h*.5,-d*.5-.035,.16,h*.78,.08,pivot);
    for(let y=1.45;y<h-.5;y+=2.35)box(isTower?M.orange:M.steel,-w*.42,y,-d*.5-.055,.23,.11,.1,pivot);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      box(M.steel,sx*w*.46,h*.5,sz*d*.46,.3,h,.3,pivot);
      box(M.yellow,sx*w*.461,1.25,sz*d*.47,.4,1.6,.4,pivot);
      for(let k=0;k<4;k++)box(M.dark,sx*w*.462,.63+k*.4,sz*d*.475,.42,.13,.42,pivot);
    }
    const roofUnit=group(pivot);
    box(M.dark,-w*.2,h+1.18,-d*.08,.88,.55,.78,roofUnit);
    box(M.steelLight,-w*.2,h+1.48,-d*.08,1.05,.08,.94,roofUnit);
    for(const sx of [-1,1])box(M.orange,sx*w*.28,h+1.05,d*.08,.16,.75,.16,roofUnit);
    pipe(M.black,w*.27,h+1.25,-d*.12,.11,1.4,'y',roofUnit);
    pipe(M.cyan,w*.27,h+1.95,-d*.12,.17,.24,'y',roofUnit);
    if(isTower){
      beam(M.steel,-w*.25,h+1.78,0,1.8,.09,.09,0,roofUnit);
      beam(M.steel,w*.25,h+2.1,0,1.15,.08,.08,0,roofUnit);
      pipe(M.orange,0,h+2.1,0,.06,1.25,'y',roofUnit);
    }
    if(b.kind==='reactor'){
      for(const x of [-w*.25,w*.25]){pipe(M.steel,x,h+2,0,1.1,4,'y',roofUnit);mesh(torusGeo,M.orange,x,h+3,0,1.2,1.2,1.2,roofUnit).rotation.x=Math.PI/2;pipe(M.cyan,x,h+2.1,1.15,.09,3,'y',roofUnit);}
      for(const x of [-w*.42,w*.42])pipe(M.orange,x,h*.55,d*.5+.3,.25,h*.85,'y',pivot);
    }else if(b.kind==='desert'){
      const roof=box(M.rust,0,h+.7,0,w+1,.3,d+1,roofUnit);roof.rotation.z=.12;
      for(let x=-w/2+.5;x<w/2;x+=.8)box(M.steel,x,h*.5,d*.5+.1,.08,h*.85,.15,pivot);
      box(M.orange,0,1.5,d*.5+.2,w*.65,2.4,.3,pivot);
    }else if(b.kind==='flood'){
      for(const side of [-1,1]){box(M.steel,side*w*.55,h*.7,0,1.1,.2,d+1,pivot);box(M.cyan,side*w*.58,h*.7+.5,0,.1,1,d+1,pivot);}
      pipe(M.rust,-w*.4,h*.5,d*.55,.15,h,'y',pivot);
      box(M.cyan,0,.4,d*.52,w,.08,.06,pivot);
    }else if(b.kind==='fortress'){
      for(let z=-2;z<=2;z+=2)box(M.steel,0,h+.5,z,w+1,1,.6,pivot);
      for(const side of [-1,1]){const armor=box(M.enemy,side*w*.45,h*.5,0,1,h,d+1,pivot);armor.rotation.z=side*.12;}
    }
    const beaconPole=pipe(M.dark,0,h+1.63,d*.18,.055,.8,'y',pivot);
    const beacon=mesh(sphereGeo,isTower?M.orangeLight:M.yellow,0,h+2.08,d*.18,.18,.18,.18,pivot);beacon.castShadow=false;
    // Instanced windows: hundreds of facade panes without hundreds of draw calls.
    const panes=[];const lit=[];
    for(let y=2.2;y<h-.5;y+=1.6){
      for(let x=-w*.5+.7;x<w*.5-.3;x+=.9)for(const sign of [-1,1]){
        const a={x,y,z:sign*(d*.5+.025),sx:.56,sy:.83,sz:.04};(((Math.round(y*10+x*5)+sign)%5)===0?lit:panes).push(a);
      }
      for(let z=-d*.5+.7;z<d*.5-.3;z+=.9)for(const sign of [-1,1]){
        const a={x:sign*(w*.5+.025),y,z,sx:.04,sy:.83,sz:.56};(((Math.round(y*10+z*5)+sign)%5)===0?lit:panes).push(a);
      }
      box(M.black,0,y+.59,0,w+.09,.09,d+.09,pivot);
    }
    const dummy=new THREE.Object3D();
    for(const [arr,m]of [[panes,M.glass],[lit,M.window]])if(arr.length){
      const inst=new THREE.InstancedMesh(boxGeo,m,arr.length);
      arr.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.scale.set(v.sx,v.sy,v.sz);dummy.rotation.set(0,0,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});pivot.add(inst);
    }
    const sign=mesh(planeGeo,label((isTower?'T-':'D-')+String(b.id).slice(-1).toUpperCase(),'#f4dfae','#283a40'),0,h*.7,d*.5+.08,Math.min(w*.75,3.8),1,1,pivot);sign.castShadow=false;
    const damage=box(M.warning,0,.18,0,w+.35,.2,d+.35,pivot);damage.visible=false;
    const rubble=group(root);rubble.visible=false;
    box(M.rubbleDark,0,d*.23,h*.5,w,d*.46,h,rubble);
    for(let i=0;i<12;i++){
      const a=i*2.399,s=.72+(i%3)*.42,rx=((i%3)-1)*w*.3,rz=(Math.floor(i/3)+.5)*h/4;
      const q=mesh(boxGeo,i%3?M.rubble:(i%2?M.steel:M.rubbleDark),rx,d*.45+(i%4)*.22,rz,s,1+(i%3)*.26,h/5,rubble);q.rotation.set(i*.05,a*.04,i*.08);
    }
    return{root,pivot,rubble,damage,beacon,beaconPole,w,d,h};
  }
  const aimRingGeo=new THREE.RingGeometry(.68,.78,40);geometries.push(aimRingGeo);
  const aim=mesh(aimRingGeo,M.cyan,0,.06,0);aim.rotation.x=-Math.PI/2;aim.castShadow=false;
  const preview=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(),8,0xffc65c,1.8,.9);scene.add(preview);preview.visible=false;
  const fallFootprint=box(M.warning,0,.035,0,1,.035,1);fallFootprint.castShadow=false;fallFootprint.visible=false;
  const fallLane=group();fallLane.visible=false;
  for(let i=0;i<9;i++){
    const strip=box(i%2?M.warning:M.warningDark,0,.06,(i+.5)/9,1,.045,.085,fallLane);strip.castShadow=false;
  }
  const fallLaneEdgeA=box(M.warning, -.5,.055,.5,.035,.04,1,fallLane);fallLaneEdgeA.castShadow=false;
  const fallLaneEdgeB=box(M.warning, .5,.055,.5,.035,.04,1,fallLane);fallLaneEdgeB.castShadow=false;
  const towerGuide=group();
  const towerGuideRing=mesh(aimRingGeo,M.warning,0,.08,0,1.55,1.55,1,towerGuide);towerGuideRing.rotation.x=-Math.PI/2;towerGuideRing.castShadow=false;
  const towerGuideBeam=mesh(cylGeo,M.warning,0,1,0,.12,1,.12,towerGuide);towerGuideBeam.castShadow=false;
  const towerGuideText=group(towerGuide);
  const towerGuideBillboard=mesh(planeGeo,towerGuideLabel,0,1,0,3.7,.58,1,towerGuideText);towerGuideBillboard.renderOrder=14;towerGuideBillboard.castShadow=false;
  const fallGuideBillboard=mesh(planeGeo,fallGuideLabel,0,1,0,3.2,.58,1,towerGuideText);fallGuideBillboard.renderOrder=14;fallGuideBillboard.castShadow=false;fallGuideBillboard.visible=false;
  towerGuide.visible=false;
  function makeEffect(type){
    const kind=type||'impact',g=group();g.userData.effectType=kind;
    if(kind==='collapse'||kind==='dust'){
      for(let i=0;i<9;i++)mesh(sphereGeo,i%3===0?M.concreteDark:i%3===1?M.rubble:M.smoke,0,0,0,1,1,1,g);
      const ring=mesh(aimRingGeo,M.warning,0,.08,0,1,1,1,g);ring.rotation.x=-Math.PI/2;ring.userData.effectPart='ring';ring.castShadow=false;
    }else if(kind==='explosion'||kind==='impact'||kind==='punch'||kind==='hit'||kind==='rip'){
      for(let i=0;i<7;i++)mesh(sphereGeo,i<2?M.flash:i<4?M.orange:i===4?M.warning:M.smoke,0,0,0,1,1,1,g);
      const ring=mesh(aimRingGeo,kind==='punch'?M.cyan:M.warning,0,.08,0,1,1,1,g);ring.rotation.x=-Math.PI/2;ring.userData.effectPart='ring';ring.castShadow=false;
    }else{
      for(let i=0;i<4;i++)mesh(sphereGeo,i<2?M.flash:M.orange,0,0,0,1,1,1,g);
    }
    return g;
  }
  const world=group(),landmarks=new Map(),strikeMeshes=new Map();
  const objectiveMaterial=new THREE.MeshBasicMaterial({color:0xffcc70,transparent:true,opacity:.6,depthWrite:false});materials.push(objectiveMaterial);
  const dangerMaterial=new THREE.MeshBasicMaterial({color:0xff4232,transparent:true,opacity:.35,depthWrite:false});materials.push(dangerMaterial);
  const waterMaterial=mat('#18717d',.16,.65,0,{transparent:true,opacity:.75});
  const fireMaterial=mat('#e05b16',.8,.1,'#a52d05',{transparent:true,opacity:.8});
  const discGeo=new THREE.CircleGeometry(1,48);geometries.push(discGeo);
  const zoneRingGeo=new THREE.RingGeometry(.98,1,64);geometries.push(zoneRingGeo);
  const labels={boss:label('SOVEREIGN','#ffb598'),artillery:label('ARTILLERY','#ffae80'),hunter:label('HUNTER','#ff8271')};
  Object.values(labels).forEach(m=>m.depthTest=false);
  const assetBase={materials:materials.length,textures:textures.length,geometries:geometries.length};
  let worldState=null;
  function resetWorld(state){
    for(const map of [buildings,enemies,shots,effects,landmarks,strikeMeshes]){for(const v of map.values()){scene.remove(v.root||v.g||v);if(v.marker)scene.remove(v.marker);}map.clear();}
    world.clear();
    for(const m of materials.splice(assetBase.materials))m.dispose();for(const t of textures.splice(assetBase.textures))t.dispose();for(const g of geometries.splice(assetBase.geometries))g.dispose();
    legacyWorld.visible=!state.campaign;if(!state.campaign)return;
    const biome=state.biome,size=state.bounds.maxX;
    const palette={harbor:['#243d46','#24383e','#759dae'],flood:['#243d53','#263e48','#8dbae0'],desert:['#a67c60','#766250','#ffdc9d'],reactor:['#281c29','#39323b','#ffa366'],fortress:['#292739','#303441','#baa8df']}[biome];
    scene.background.set(palette[0]);scene.fog.color.set(palette[0]);scene.fog.density=.004;M.ground.color.set(palette[1]);sun.color.set(palette[2]);
    box(M.ground,0,-.45,0,size*2+70,.8,size*2+70,world);
    const roadSpacing=biome==='flood'?42:32;
    if(biome!=='desert'&&biome!=='fortress')for(let x=-size;x<=size;x+=roadSpacing){box(M.road,x,-.008,0,9,.1,size*2,world);box(M.road,0,-.012,x,size*2,.1,9,world);
      for(let z=-size;z<size;z+=12){box(M.roadMark,x,.052,z,.16,.03,3,world);box(M.roadMark,z,.054,x,3,.03,.16,world);}}
    else for(const x of [-64,64]){box(M.road,x,-.01,0,12,.1,size*2,world);for(let z=-size;z<size;z+=10)box(M.roadMark,x,.052,z,.15,.03,3,world);}
    for(const [i,o]of state.objectives.entries()){
      box(M.concreteDark,o.x,-.03,o.z,26,.1,24,world);
      for(let x=-12;x<=12;x+=3)box(M.yellow,o.x+x,.05,o.z+12,1.5,.04,.2,world);
      const q=mesh(planeGeo,label(['WEST APPROACH','CONTROL SECTOR','ENGINE BASIN','NORTH EXIT'][i],'#b8b9a2'),o.x,.07,o.z+10,17,4,1,world);q.rotation.x=-Math.PI/2;q.castShadow=false;
      if(biome==='reactor'){for(const side of [-1,1]){pipe(M.steel,o.x+side*14,6,o.z,.3,25,'z',world);pipe(M.orange,o.x+side*14,7,o.z,.2,25,'z',world);}}
    }
    if(biome==='desert')for(let i=0;i<55;i++){const x=-size+(i*41)%(size*2),z=-size+(i*59)%(size*2);const q=box(M.roadEdge,x,.04,z,4+(i%5),.03,.09,world);q.rotation.y=i*.7;}
    // Huge silhouettes live outside the traversable district, leaving fair collision lanes.
    for(let i=0;i<40;i++){
      const a=i/40*Math.PI*2,x=Math.cos(a)*(size+22),z=Math.sin(a)*(size+22),h=12+(i*17)%31;
      if(biome==='desert') {const q=mesh(sphereGeo,i%2?M.concreteDark:M.rust,x,h*.35,z,10,h,9,world);q.rotation.y=i;}
      else {box(i%3?M.dark:M.concreteDark,x,h/2,z,9,h,10,world);box(biome==='reactor'?M.orange:M.cyan,x,h*.7,z+5.1,7,.7,.15,world);
        if(i%3===0){pipe(M.steel,x,h+5,z,.65,10,'y',world);mesh(sphereGeo,M.smoke,x,h+14,z,4,6,4,world);}}
    }
    if(biome==='harbor'||biome==='flood'){
      box(waterMaterial,-size-18,-.1,0,24,.2,size*2+20,world);
      for(const z of [-70,0,70]){box(M.steel,-size-10,13,z,.8,26,.8,world);box(M.orange,-size-5,26,z,32,1,1,world);box(M.black,-size+8,20,z,.15,12,.15,world);}
    }
    if(biome==='desert')for(let x=-size;x<size;x+=6){box(M.black,x,.02,55,.8,.08,12,world);for(const z of [51,59])box(M.steel,x,.12,z,6,.16,.2,world);}
    if(biome==='reactor')for(const x of [-size-9,size+9]){pipe(M.steel,x,14,0,10,28,'y',world);pipe(M.orange,x,29,0,11,2,'y',world);mesh(sphereGeo,M.smoke,x,39,0,7,10,7,world);}
    for(const h of state.hazards){const q=mesh(discGeo,h.type==='water'?waterMaterial:fireMaterial,h.x,.07,h.z,h.radius,h.radius,1,world);q.rotation.x=-Math.PI/2;q.castShadow=false;
      const ring=mesh(zoneRingGeo,h.type==='water'?M.cyan:M.orange,h.x,.1,h.z,h.radius,h.radius,1,world);ring.rotation.x=-Math.PI/2;ring.castShadow=false;}
    for(const o of state.objectives){const g=group();g.position.set(o.x,0,o.z);const ring=mesh(zoneRingGeo,M.yellow,0,.15,0,6,6,1,g);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
      const beam=mesh(cylGeo,objectiveMaterial,0,9,0,.3,18,.3,g);beam.castShadow=false;landmarks.set(o.id,g);}
    for(const c of state.pickups){const g=group();g.position.set(c.x,0,c.z);box(M.dark,0,.75,0,2.6,1.5,2,g);box(c.type==='repair'?M.cyan:c.type==='intel'?M.white:M.yellow,0,1.6,0,2.1,.2,1.7,g);
      const symbol=mesh(planeGeo,label(c.type==='repair'?'+ REPAIR':c.type==='intel'?'ARCHIVE':'CAPACITOR'),0,3,0,5,1.25,1,g);symbol.castShadow=false;g.userData.symbol=symbol;landmarks.set(c.id,g);}
  }
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),pickPoint=new THREE.Vector3();
  let width=0,height=0,lastX=0,lastZ=0,initialized=false;
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  function pick(clientX,clientY){const r=canvas.getBoundingClientRect();pointer.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1);ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(ground,pickPoint)?{x:pickPoint.x,z:pickPoint.z}:null;}
  function project(x,z){if(typeof x==='object'){z=x.z;x=x.x;}const v=new THREE.Vector3(x,0,z).project(camera);const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function render(state,dt=.016){
    if(!width||canvas.clientWidth!==width||canvas.clientHeight!==height)resize();
    if(worldState!==state.buildings){worldState=state.buildings;resetWorld(state);initialized=false;}
    const p=state.player,t=state.time||0;
    player.g.position.set(p.x,0,p.z);player.torso.rotation.y=p.angle||0;
    const speed=initialized?Math.min(1,Math.hypot(p.x-lastX,p.z-lastZ)/Math.max(.001,dt)/4):0;
    player.g.rotation.y=0;
    player.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(t*10+i*Math.PI)*.32*speed;leg.position.y=Math.abs(Math.sin(t*10+i*Math.PI))*.14*speed;});
    player.torso.position.y=2.1+Math.sin(t*20)*.035*speed;
    const punch=(p.punchCooldown||0)>0?Math.max(0,Math.min(1,(1.05-p.punchCooldown)/.32)):0;player.fist.position.z=.35+Math.sin(punch*Math.PI)*1.8;player.fist.rotation.x=-Math.sin(punch*Math.PI)*.35;
    player.cannon.scale.set(p.weapon==='heavy'?1.3:1,p.weapon==='heavy'?1.3:1,p.weapon==='heavy'?1.22:1);
    player.muzzle.visible=(p.fireCooldown||0)>(p.weapon==='heavy'?.1:.22);player.muzzle.scale.setScalar(.2+((t*197)%1)*.3);
    player.core.material=p.overheated?M.red:M.cyan;
    player.ring.visible=state.status!=='ready';
    steam.visible=!!p.venting||p.overheated;steam.children.forEach((v,i)=>{const phase=(t*1.2+i*.2)%1;v.position.set(Math.sin(i*2.4)*phase*.7,2.5+phase*2,-.4);v.scale.setScalar(.12+phase*.65);});
    // Fixed world north makes WASD and the touch stick predictable.
    const camDistance=state.campaign?(camera.aspect<.75?54:44):(camera.aspect<.75?32:34);
    const cx=state.campaign?p.x+Math.sin(p.angle)*4:p.x*.78,cz=state.campaign?p.z+Math.cos(p.angle)*4:p.z*.68;
    const targetPos=new THREE.Vector3(cx,camDistance*.78,cz+camDistance*.87);
    if(!initialized)camera.position.copy(targetPos);else camera.position.lerp(targetPos,1-Math.exp(-dt*5));
    camera.lookAt(cx,0,cz-5.5);
    if(state.campaign){sun.position.set(cx-28,43,cz+18);sun.target.position.set(cx,0,cz);}
    const dx=p.x-camera.position.x,dz=p.z-camera.position.z,rayLength=dx*dx+dz*dz;
    silhouette.visible=state.buildings.some(b=>{const u=((b.x-camera.position.x)*dx+(b.z-camera.position.z)*dz)/rayLength;if(u<=0||u>=1)return false;return IW.inFootprint({x:camera.position.x+dx*u,z:camera.position.z+dz*u},b,.8,camera.position.y+(2-camera.position.y)*u);});
    for(let i=0;i<playerParts.length;i++){ghostParts[i].position.copy(playerParts[i].position);ghostParts[i].quaternion.copy(playerParts[i].quaternion);ghostParts[i].scale.copy(playerParts[i].scale);if(i)ghostParts[i].visible=playerParts[i].visible;}
    lastX=p.x;lastZ=p.z;initialized=true;
    let nearest=null,nearDist=Infinity,falling=null;
    for(const b of state.buildings){
      let v=buildings.get(b.id);if(!v){v=makeBuilding(b);buildings.set(b.id,v);}
      v.root.visible=Math.hypot(b.x-p.x,b.z-p.z)<90;
      v.pivot.visible=b.status!=='rubble';v.rubble.visible=b.status==='rubble';v.rubble.rotation.y=Math.atan2(b.fallX||0,b.fallZ||-1);
      v.damage.visible=b.hp<b.maxHp&&b.status==='standing';v.damage.scale.y=.2+(1-b.hp/b.maxHp)*.7;
      v.beacon.visible=b.status!=='rubble'&&(String(b.id).startsWith('tower')||b.hp<b.maxHp);v.beacon.scale.setScalar(.75+.25*(.5+.5*Math.sin(t*7)));
      if(b.status==='falling'){
        const dir=new THREE.Vector3(b.fallX||0,0,b.fallZ||-1).normalize();
        const a=new THREE.Vector3(dir.z,0,-dir.x);v.pivot.quaternion.setFromAxisAngle(a,Math.min(1,b.fallProgress||0)*Math.PI*.5);
        v.pivot.position.y=.08;
      }else v.pivot.quaternion.identity();
      if(b.status==='standing'&&!b.indestructible){
        const d=Math.hypot(b.x-p.x,b.z-p.z);const aimdx=Math.sin(p.angle||0),aimdz=Math.cos(p.angle||0);
        const alignment=((b.x-p.x)*aimdx+(b.z-p.z)*aimdz)/Math.max(.01,d);
        if(d<23&&alignment>.93&&d<nearDist){nearest=b;nearDist=d;}
      }else if(b.status==='falling'&&!falling) falling=b;
    }
    const guide=nearest||falling;
    preview.visible=!!nearest;fallFootprint.visible=!!guide;fallLane.visible=!!guide;towerGuide.visible=!!guide;
    if(guide){
      const dx=nearest?nearest.x-p.x:guide.fallX,dz=nearest?nearest.z-p.z:guide.fallZ,len=Math.hypot(dx,dz)||1;const dir=new THREE.Vector3(dx/len,0,dz/len);
      if(nearest){preview.position.set(nearest.x,.22,nearest.z);preview.setDirection(dir);preview.setLength(nearest.h,1.7,1);}
      fallFootprint.position.set(guide.x+dir.x*guide.h*.5,.045,guide.z+dir.z*guide.h*.5);
      fallFootprint.scale.set(Math.min(guide.w,guide.d)*.7,.035,guide.h);fallFootprint.rotation.y=Math.atan2(dir.x,dir.z);
      fallLane.position.set(guide.x,.02,guide.z);fallLane.rotation.y=Math.atan2(dir.x,dir.z);fallLane.scale.set(Math.min(guide.w,guide.d)*.78,1,guide.h);
      towerGuide.position.set(guide.x,0,guide.z);towerGuideRing.scale.setScalar(guide.status==='falling'?1.8:1.2);
      towerGuideBeam.position.y=Math.max(2.5,guide.h*.24);towerGuideBeam.scale.y=Math.max(5,guide.h*.48);
      towerGuideText.position.y=Math.min(Math.max(guide.h*.52,3.5),6.5);towerGuideText.quaternion.copy(camera.quaternion);
      towerGuideBillboard.visible=guide.status==='standing';fallGuideBillboard.visible=guide.status==='falling';
    }
    aim.position.set(p.x+Math.sin(p.angle||0)*8,.06,p.z+Math.cos(p.angle||0)*8);
    for(const e of state.enemies){
      const isMech=e.type==='escort'||e.type==='hunter';
      let v=enemies.get(e.id);if(!v){v=e.type==='boss'?makeFortress():isMech?makeMech(true):makeTank();if(e.type==='artillery')v.turret.scale.set(1.4,1.5,2);addMarker(v,e);enemies.set(e.id,v);}
      v.g.position.set(e.x,0,e.z);v.g.visible=!e.escaped&&Math.hypot(e.x-p.x,e.z-p.z)<95;
      v.marker.position.set(e.x,e.type==='boss'?17:e.type==='tank'?2.9:4.1,e.z);v.marker.quaternion.copy(camera.quaternion);v.marker.visible=v.g.visible&&(e.alive||(e.disabled&&!e.weaponTaken));v.markerLabel.material=e.disabled?ripLabel:labels[e.type]||(e.type==='tank'?hostileLabel:escortLabel);v.hpBar.scale.x=1.9*Math.max(0,e.hp/e.maxHp);v.hpBar.position.x=-(1-e.hp/e.maxHp)*.95;
      if(isMech){
        v.torso.rotation.y=e.angle||0;v.g.rotation.z=e.disabled?.25:0;
        v.torso.position.y=e.disabled?1.7:2.1;v.cannon.visible=!e.weaponTaken;
        v.ring.visible=e.disabled&&!e.weaponTaken;v.ring.material=M.yellow;
        if(e.type==='hunter'&&e.alive)v.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(t*10+i*Math.PI)*.4);
      }else if(e.type==='boss'){v.core.material=e.exposed?M.cyan:M.red;v.turret.rotation.y=Math.sin(t*.3)*.15;v.legs.forEach((leg,i)=>leg.position.y=e.alive?Math.max(0,Math.sin(t*1.5+i*Math.PI))*.6:0);}
      else{v.g.rotation.y=Math.PI*.5;v.turret.rotation.y=(e.angle||0)-Math.PI*.5;}
      if(!e.alive&&!e.disabled){v.g.scale.y=.3;v.g.rotation.z=.16;}
      else v.g.scale.y=1;
    }
    const currentShots=new Set();for(const s of state.projectiles){currentShots.add(s.id);let v=shots.get(s.id);if(!v){v=mesh(sphereGeo,s.owner==='player'?M.flash:M.red,0,0,0,.14,.14,.7);shots.set(s.id,v);}v.position.set(s.x,s.y||1.3,s.z);v.rotation.y=Math.atan2(s.vx||0,s.vz||1);}
    for(const[id,v]of shots)if(!currentShots.has(id)){scene.remove(v);shots.delete(id);}
    const currentEffects=new Set();for(const e of state.effects){
      currentEffects.add(e.id);let v=effects.get(e.id);if(!v){v=makeEffect(e.type);effects.set(e.id,v);}
      const a=1-e.life/(e.maxLife||1),pulse=Math.sin(Math.min(1,a)*Math.PI),kind=v.userData.effectType;
      v.position.set(e.x,0,e.z);v.rotation.y=e.angle||0;
      v.children.forEach((q,i)=>{
        if(q.userData.effectPart==='ring'){q.position.set(0,.08,0);q.scale.setScalar((kind==='collapse'||kind==='dust'?1.4:1.2)*(.35+a));q.rotation.z=a*2.5;return;}
        const angle=i*2.399+(kind==='collapse'?a*.8:0),spread=kind==='collapse'||kind==='dust'?a*(i%3+1)*.72:a*(i%3+1)*.5;
        q.position.set(Math.sin(angle)*spread,.32+a*(kind==='dust'||kind==='collapse'?2.6:2),Math.cos(angle)*spread);
        q.scale.setScalar(Math.max(.035,(i<2?1.5:1)*pulse*(kind==='collapse'||kind==='dust'?1.1:.9)));
        q.rotation.y=a*3+i*.4;
      });
    }
    for(const[id,v]of effects)if(!currentEffects.has(id)){scene.remove(v);effects.delete(id);}
    if(state.campaign){
      for(const o of state.objectives){const v=landmarks.get(o.id);v.visible=!o.done&&state.objectives[state.stage]===o;v.children[0].rotation.z=t*.2;}
      for(const c of state.pickups){const v=landmarks.get(c.id);v.visible=!c.taken&&Math.hypot(c.x-p.x,c.z-p.z)<65;v.userData.symbol.quaternion.copy(camera.quaternion);}
      const active=new Set();for(const strike of state.strikes){active.add(strike.id);let v=strikeMeshes.get(strike.id);if(!v){v=group();const d=mesh(discGeo,dangerMaterial,0,.12,0,1,1,1,v);d.rotation.x=-Math.PI/2;d.castShadow=false;const r=mesh(torusGeo,M.red,0,.15,0);r.rotation.x=-Math.PI/2;r.castShadow=false;v.add(r);strikeMeshes.set(strike.id,v);}v.position.set(strike.x,0,strike.z);v.scale.setScalar(strike.radius);v.children[1].scale.setScalar(.25+.75*(1-strike.life/strike.maxLife));}
      for(const[id,v]of strikeMeshes)if(!active.has(id)){scene.remove(v);strikeMeshes.delete(id);}
    }
    renderer.render(scene,camera);
  }
  function dispose(){renderer.dispose();for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures)x.dispose();buildings.clear();enemies.clear();shots.clear();effects.clear();}
  resize();
  return{render,resize,pick,project,dispose};
}

