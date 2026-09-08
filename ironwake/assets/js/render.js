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
    ground:mat('#253437'),road:mat('#151f23'),curb:mat('#70817e'),concrete:mat('#647574'), dark:mat('#101b22'),
    steel:mat('#647477',.4,.75),black:mat('#18232a',.5,.7),orange:mat('#d2702b',.5,.65),orangeLight:mat('#ffc46d',.4,.5),
    cyan:mat('#5af5eb',.3,.4,'#20a9ac'),red:mat('#ff6550',.5,.3,'#e5260a'),yellow:mat('#f2c667'),
    glass:mat('#163b49',.22,.78,'#08202b'),window:mat('#efca80',.4,.5,'#ba742a'),enemy:mat('#925447',.55,.6),
    white:mat('#d2dcd5'),rubble:mat('#46534f'),smoke:mat('#465452',1,0,0,{transparent:true,opacity:.56,depthWrite:false}),
    flash:mat('#fff0b2',.3,.1,'#ffae20'),warning:mat('#ffbf52',.4,.1,'#d98015',{transparent:true,opacity:.65,depthWrite:false}),
  };
  const boxGeo = new THREE.BoxGeometry(1,1,1); geometries.push(boxGeo);
  const sphereGeo = new THREE.IcosahedronGeometry(1,0); geometries.push(sphereGeo);
  const cylGeo = new THREE.CylinderGeometry(1,1,1,8); geometries.push(cylGeo);
  const mesh = (geo,m,x=0,y=0,z=0,sx=1,sy=1,sz=1,parent=scene) => {
    const q=new THREE.Mesh(geo,m); q.position.set(x,y,z); q.scale.set(sx,sy,sz); q.castShadow=true;q.receiveShadow=true;parent.add(q);return q;
  };
  const box=(m,x,y,z,sx,sy,sz,parent)=>mesh(boxGeo,m,x,y,z,sx,sy,sz,parent);
  const group=(parent=scene)=>{const g=new THREE.Group();parent.add(g);return g;};
  function label(text,color='#e7d8b5',background=null) {
    const c=document.createElement('canvas'); c.width=512;c.height=128;const ctx=c.getContext('2d');
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,512,128);}ctx.fillStyle=color;ctx.font='bold 70px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,68);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;textures.push(tex);
    const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});materials.push(m);return m;
  }
  const planeGeo = new THREE.PlaneGeometry(1,1); geometries.push(planeGeo);
  function flatText(text,x,z,w=10){const q=mesh(planeGeo,label(text,'#88938b'),x,.025,z,w,w/4,1);q.rotation.x=-Math.PI/2;q.castShadow=false;return q;}
  box(M.ground,0,-.45,0,150,.8,130);
  box(M.road,0,-.015,-6,110,.12,8.8);
  box(M.road,0,-.008,15,110,.1,7);
  for(const x of [-30,-15,0,15,30])box(M.road,x,-.01,1,6,.11,58);
  for(let x=-51;x<54;x+=5){box(M.yellow,x,.055,-6,2.3,.035,.11);box(M.curb,x,.09,-10.7,4.8,.2,.18);box(M.curb,x,.09,-1.3,4.8,.2,.18);}
  for(const x of [-30,-15,0,15,30])for(let z=9;z<13;z+=.65)box(M.curb,x,.06,z,4,.03,.25);
  flatText('SECTOR 07',1,22,14);flatText('TRANSIT',-19,-6,8);flatText('KEEP CLEAR',19,15,11);
  // Remote industrial scenery frames the arena without hiding combat lanes.
  for(let i=0;i<25;i++){
    const x=-63+i*5.2,h=7+((i*31)%17),z=-38-(i%3)*6;
    box(i%2?M.dark:M.concrete,x,h/2,z,3.8,h,5.8);
    box(M.steel,x,h+.2,z,4.1,.3,6.1);
    for(let j=2;j<h;j+=3)box(M.glass,x,j,z+2.93,3,.45,.07);
    if(i%4===0)mesh(cylGeo,M.steel,x,h+2,z,.4,4,.4);
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
    box(M.black,x+3,3,z,.12,6,.12);box(M.window,x+3,6,z-.4,1,.16,.8);
  }
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
  const steam=group(player.g);
  for(let i=0;i<5;i++)mesh(sphereGeo,M.smoke,0,0,0,.4,.4,.4,steam);
  function makeTank(){
    const g=group();
    for(const side of [-1,1]){
      box(M.black,0,.44,side*.85,2.8,.7,.5,g);
      for(let j=-1;j<=1;j+=.4)box(M.steel,j,.48,side*1.11,.14,.47,.05,g);
    }
    box(M.enemy,0,.82,0,2.5,.65,1.72,g);box(M.steel,0,1.06,0,2.28,.13,1.51,g);
    const turret=group(g);box(M.enemy,0,1.37,0,1.2,.58,1.25,turret);
    box(M.black,0,1.43,1.2,.25,.24,1.8,turret);box(M.steel,0,1.43,2.05,.38,.32,.27,turret);
    box(M.red,0,1.27,.64,.55,.12,.05,turret);
    box(M.black,-.36,1.93,-.28,.035,1.1,.035,turret);
    return{g,turret};
  }
  function makeBuilding(b){
    const root=group(),pivot=group(root);root.position.set(b.x,0,b.z);
    const h=b.h,w=b.w,d=b.d;
    const bodyMat=mat(b.color||'#697c7c',.72,.37);
    box(bodyMat,0,h*.5,0,w,h,d,pivot);
    box(M.black,0,.44,0,w+.08,.88,d+.08,pivot);
    box(M.steel,0,h+.12,0,w+.5,.26,d+.5,pivot);
    box(M.black,0,h+.65,0,w*.64,1.08,d*.64,pivot);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      box(M.steel,sx*w*.46,h*.5,sz*d*.46,.3,h,.3,pivot);
      box(M.yellow,sx*w*.461,1.25,sz*d*.47,.4,1.6,.4,pivot);
      for(let k=0;k<4;k++)box(M.dark,sx*w*.462,.63+k*.4,sz*d*.475,.42,.13,.42,pivot);
    }
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
    const sign=mesh(planeGeo,label((String(b.id).startsWith('tower')?'T-':'D-')+String(b.id).slice(-1).toUpperCase(),'#f4dfae','#283a40'),0,h*.7,d*.5+.08,Math.min(w*.75,3.8),1,1,pivot);sign.castShadow=false;
    const damage=box(M.warning,0,.18,0,w+.35,.2,d+.35,pivot);damage.visible=false;
    const rubble=group(root);rubble.visible=false;
    for(let i=0;i<12;i++){
      const a=i*2.399,s=1+(i%3)*.55;const q=mesh(boxGeo,i%3?M.rubble:M.steel,Math.cos(a)*w*.3,.4+(i%3)*.2,(i/11)*h-1,s,.7+(i%4)*.4,s,rubble);q.rotation.set(i*.2,a,i*.11);
    }
    return{root,pivot,rubble,damage,w,d,h};
  }
  const aimRingGeo=new THREE.RingGeometry(.68,.78,40);geometries.push(aimRingGeo);
  const aim=mesh(aimRingGeo,M.cyan,0,.06,0);aim.rotation.x=-Math.PI/2;aim.castShadow=false;
  const preview=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(),8,0xffc65c,1.8,.9);scene.add(preview);preview.visible=false;
  const fallFootprint=box(M.warning,0,.035,0,1,.035,1);fallFootprint.castShadow=false;fallFootprint.visible=false;
  const towerGuide=group();
  const towerGuideRing=mesh(aimRingGeo,M.warning,0,.08,0,1.55,1.55,1,towerGuide);towerGuideRing.rotation.x=-Math.PI/2;towerGuideRing.castShadow=false;
  const towerGuideBeam=mesh(cylGeo,M.warning,0,1,0,.12,1,.12,towerGuide);towerGuideBeam.castShadow=false;
  const towerGuideText=group(towerGuide);
  const towerGuideBillboard=mesh(planeGeo,towerGuideLabel,0,1,0,3.7,.58,1,towerGuideText);towerGuideBillboard.renderOrder=14;towerGuideBillboard.castShadow=false;
  const fallGuideBillboard=mesh(planeGeo,fallGuideLabel,0,1,0,3.2,.58,1,towerGuideText);fallGuideBillboard.renderOrder=14;fallGuideBillboard.castShadow=false;fallGuideBillboard.visible=false;
  towerGuide.visible=false;
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0),pickPoint=new THREE.Vector3();
  let width=0,height=0,lastX=0,lastZ=0,initialized=false;
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
  function pick(clientX,clientY){const r=canvas.getBoundingClientRect();pointer.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1);ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(ground,pickPoint)?{x:pickPoint.x,z:pickPoint.z}:null;}
  function project(x,z){if(typeof x==='object'){z=x.z;x=x.x;}const v=new THREE.Vector3(x,0,z).project(camera);const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function render(state,dt=.016){
    if(!width||canvas.clientWidth!==width||canvas.clientHeight!==height)resize();
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
    const camDistance=camera.aspect<.75?32:34;
    const cx=p.x*.78,cz=p.z*.68;
    const targetPos=new THREE.Vector3(cx,camDistance*.78,cz+camDistance*.87);
    if(!initialized)camera.position.copy(targetPos);else camera.position.lerp(targetPos,1-Math.exp(-dt*5));
    camera.lookAt(cx,0,cz-5.5);
    lastX=p.x;lastZ=p.z;initialized=true;
    let nearest=null,nearDist=Infinity,falling=null;
    for(const b of state.buildings){
      let v=buildings.get(b.id);if(!v){v=makeBuilding(b);buildings.set(b.id,v);}
      v.pivot.visible=b.status!=='rubble';v.rubble.visible=b.status==='rubble';v.rubble.rotation.y=Math.atan2(b.fallX||0,b.fallZ||-1);
      v.damage.visible=b.hp<b.maxHp&&b.status==='standing';v.damage.scale.y=.2+(1-b.hp/b.maxHp)*.7;
      if(b.status==='falling'){
        const dir=new THREE.Vector3(b.fallX||0,0,b.fallZ||-1).normalize();
        const a=new THREE.Vector3(dir.z,0,-dir.x);v.pivot.quaternion.setFromAxisAngle(a,Math.min(1,b.fallProgress||0)*Math.PI*.5);
        v.pivot.position.y=.08;
      }else v.pivot.quaternion.identity();
      if(b.status==='standing'){
        const d=Math.hypot(b.x-p.x,b.z-p.z);const aimdx=Math.sin(p.angle||0),aimdz=Math.cos(p.angle||0);
        const alignment=((b.x-p.x)*aimdx+(b.z-p.z)*aimdz)/Math.max(.01,d);
        if(d<23&&alignment>.93&&d<nearDist){nearest=b;nearDist=d;}
      }else if(b.status==='falling'&&!falling) falling=b;
    }
    const guide=nearest||falling;
    preview.visible=!!nearest;fallFootprint.visible=!!guide;towerGuide.visible=!!guide;
    if(guide){
      const dx=nearest?nearest.x-p.x:guide.fallX,dz=nearest?nearest.z-p.z:guide.fallZ,len=Math.hypot(dx,dz)||1;const dir=new THREE.Vector3(dx/len,0,dz/len);
      if(nearest){preview.position.set(nearest.x,.22,nearest.z);preview.setDirection(dir);preview.setLength(nearest.h,1.7,1);}
      fallFootprint.position.set(guide.x+dir.x*guide.h*.5,.045,guide.z+dir.z*guide.h*.5);
      fallFootprint.scale.set(Math.min(guide.w,guide.d)*.7,.035,guide.h);fallFootprint.rotation.y=Math.atan2(dir.x,dir.z);
      towerGuide.position.set(guide.x,0,guide.z);towerGuideRing.scale.setScalar(guide.status==='falling'?1.8:1.2);
      towerGuideBeam.position.y=Math.max(2.5,guide.h*.24);towerGuideBeam.scale.y=Math.max(5,guide.h*.48);
      towerGuideText.position.y=Math.min(Math.max(guide.h*.52,3.5),6.5);towerGuideText.quaternion.copy(camera.quaternion);
      towerGuideBillboard.visible=guide.status==='standing';fallGuideBillboard.visible=guide.status==='falling';
    }
    aim.position.set(p.x+Math.sin(p.angle||0)*8,.06,p.z+Math.cos(p.angle||0)*8);
    for(const e of state.enemies){
      let v=enemies.get(e.id);if(!v){v=e.type==='escort'?makeMech(true):makeTank();addMarker(v,e);enemies.set(e.id,v);}
      v.g.position.set(e.x,0,e.z);v.g.visible=!e.escaped;
      v.marker.position.set(e.x,e.type==='tank'?2.9:4.1,e.z);v.marker.quaternion.copy(camera.quaternion);v.marker.visible=!e.escaped&&(e.alive||(e.disabled&&!e.weaponTaken));v.markerLabel.material=e.disabled?ripLabel:e.type==='tank'?hostileLabel:escortLabel;v.hpBar.scale.x=1.9*Math.max(0,e.hp/e.maxHp);v.hpBar.position.x=-(1-e.hp/e.maxHp)*.95;
      if(e.type==='escort'){
        v.torso.rotation.y=e.angle||0;v.g.rotation.z=e.disabled?.25:0;
        v.torso.position.y=e.disabled?1.7:2.1;v.cannon.visible=!e.weaponTaken;
        v.ring.visible=e.disabled&&!e.weaponTaken;v.ring.material=M.yellow;
      }else{v.g.rotation.y=Math.PI*.5;v.turret.rotation.y=(e.angle||0)-Math.PI*.5;}
      if(!e.alive&&!e.disabled){v.g.scale.y=.3;v.g.rotation.z=.16;}
      else v.g.scale.y=1;
    }
    const currentShots=new Set();for(const s of state.projectiles){currentShots.add(s.id);let v=shots.get(s.id);if(!v){v=mesh(sphereGeo,s.owner==='player'?M.flash:M.red,0,0,0,.14,.14,.7);shots.set(s.id,v);}v.position.set(s.x,s.y||1.3,s.z);v.rotation.y=Math.atan2(s.vx||0,s.vz||1);}
    for(const[id,v]of shots)if(!currentShots.has(id)){scene.remove(v);shots.delete(id);}
    const currentEffects=new Set();for(const e of state.effects){currentEffects.add(e.id);let v=effects.get(e.id);if(!v){const g=group();for(let i=0;i<7;i++)mesh(sphereGeo,i<2?M.flash:i<4?M.orange:M.smoke,0,0,0,1,1,1,g);v=g;effects.set(e.id,v);}const a=1-e.life/(e.maxLife||1);v.position.set(e.x,0,e.z);v.children.forEach((q,i)=>{const angle=i*2.4;q.position.set(Math.sin(angle)*a*(i+1)*.5,.4+a*(i<4?2:4),Math.cos(angle)*a*(i+1)*.5);q.scale.setScalar(Math.max(.03,(i<2?1.5:1)*Math.sin(Math.min(1,a)*Math.PI)));q.rotation.y=a*3;});}
    for(const[id,v]of effects)if(!currentEffects.has(id)){scene.remove(v);effects.delete(id);}
    renderer.render(scene,camera);
  }
  function dispose(){renderer.dispose();for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures)x.dispose();buildings.clear();enemies.clear();shots.clear();effects.clear();}
  resize();
  return{render,resize,pick,project,dispose};
}

