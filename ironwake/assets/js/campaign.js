(function (IW) {
  'use strict';
  // Authored routes, encounters and radio scenes. Coordinates are world X/Z.
  const chapters = [
    { title:'BREAKWATER', place:'01 / Occupied docklands', biome:'harbor', size:100, start:[-65,65], pressure:{label:'BLOCKADE PRESSURE',hunterSpeed:4.8,artilleryRadius:6,artilleryFuse:1.6,artilleryDamage:24},
      briefing:'For twelve years, the Directorate has stripped our coast to feed a walking warship: the Sovereign. Tonight it wakes. You are Mara Venn, a dockworker in a stolen demolition mech. Your brother Ivo is still inside the machine. First, open a route for the evacuation ships.',
      outro:'The harbor guns fall silent. Hundreds escape aboard the night ferries. A transmission cuts through: Ivo is alive, and the Sovereign is moving inland. His signal leads through the drowned city.',
      stages:[
        ['eliminate','Break the harbor blockade',-60,40,'ORLA / Those towers are condemned. Punch one toward the armor. Clear the blockade, then we open the port.'],
        ['hold','Open the evacuation locks',5,5,'ORLA / The lock controls are east. Clear nearby defenders, then hold INTERACT at the beacon. The ferries need that channel.',7],
        ['eliminate','Silence the coastal battery',60,-40,'MARA / Those guns can still hit the ferries. I am going through the freight yard.'],
        ['reach','Rendezvous at the north causeway',55,-80,'IVO / Mara? I hid a route in the floodgate network. Find me before they bring the furnace online.']
      ],
      squads:[[-65,40,'tank',2],[-35,25,'escort',2],[5,5,'escort',3],[40,-25,'artillery',2],[60,-40,'tank',3]],
      towers:[[-65,57,20],[-51,52,16],[0,19,18],[55,-22,20],[70,-22,18]],
      caches:[[-85,5,'intel','A ferry manifest: 640 civilians. The Directorate marked every one as expendable. Battery command codes are attached. Optional: reach the ferry battery relay northwest of the guns and hold F / INTERACT for five uninterrupted seconds to shut them down.'],[-5,60,'repair'],[82,-5,'core'],[26,-70,'repair']],
      hazards:[] },
    { title:'THE DROWNED WARD',place:'02 / Flooded residential district',biome:'flood',size:115,start:[-85,80], pressure:{label:'HUNTER TIDE',hunterSpeed:6.1,artilleryRadius:5.6,artilleryFuse:1.45,artilleryDamage:22},
      briefing:'Flood sirens have been sounding for nine years. Below the broken towers, survivors still keep lights in their windows. Ivo has left a signal in three old pump stations. Restore the network and escort its data across the ward. Water cools your reactor, but slows the mech.',
      outro:'The pumps reveal a freight schedule: prisoners and reactor cores, bound for the Glassline. Ivo stayed aboard to sabotage the Sovereign. Orla finds a train crossing the salt desert before dawn.',
      stages:[['hold','Restore the western pump',-65,35,'ORLA / Stand inside the ring and hold INTERACT. The pumps cannot restart while hostiles are close.',8],['hold','Recover Ivo’s signal',30,10,'IVO / They are using the tide engines as weapons. Three power couplings feed the command deck. Break them, and the Sovereign can bleed.',9],['eliminate','Defeat the floodgate hunters',65,-55,'ORLA / Hunters incoming. They will rush you. BOOST out of their charge, then hit them while they recover.'],['reach','Reach the rail embankment',-25,-90,'MARA / We have his message. I am taking the high road out.']],
      squads:[[-65,35,'escort',3],[-15,30,'hunter',2],[30,10,'artillery',2],[65,-55,'hunter',4],[15,-65,'escort',2]],
      towers:[[-72,54,19],[-43,29,14],[23,28,20],[57,-35,20],[78,-42,14]],
      caches:[[-95,-20,'intel','School shelter log: the children named their rescue boat Ironwake. Orla kept the name.'],[5,72,'core'],[90,30,'repair'],[-60,-55,'repair']],
      hazards:[[-25,0,28,'water'],[50,50,30,'water'],[25,-70,24,'water']] },
    { title:'GLASSLINE',place:'03 / Salt desert rail works',biome:'desert',size:125,start:[-95,75], pressure:{label:'LONG-GUN PRESSURE',hunterSpeed:5,artilleryRadius:7,artilleryFuse:1.75,artilleryDamage:27},
      briefing:'The Glassline runs across a sea of fused sand. Directorate artillery guards the switches. Seize the rail yard, free the prisoners, and steal the capacitor train. Red targeting circles warn of incoming shells. Keep moving; a booster burst can get you out of a blast.',
      outro:'The train carries the Sovereign’s last capacitor. You turn it toward the occupied reactor city instead. The prisoners call it a rescue. The Directorate calls it an invasion. For the first time, the army retreats.',
      stages:[['eliminate','Take the artillery ridge',-65,30,'ORLA / Artillery paints the ground before firing. Get out of the red circles. Its disabled chassis carries a railgun.'],['hold','Release the prisoner train',5,55,'MARA / Nobody stays in those cages. I am overriding the lock.',10],['eliminate','Capture the capacitor engine',65,-10,'ORLA / Armored column at the eastern siding. Drop the gantries onto them.'],['hold','Reverse the rail junction',20,-80,'IVO / Bring the capacitor to Cinder Works. We can overload the command shields from there.',10]],
      squads:[[-65,30,'artillery',3],[-35,45,'hunter',2],[5,55,'escort',3],[65,-10,'tank',4],[20,-80,'artillery',2],[30,-60,'hunter',2]],
      towers:[[-72,49,19],[-51,46,22],[55,12,24],[75,9,22],[13,-59,24]],
      caches:[[-90,-50,'intel','A prisoner recognizes Mara: “Your brother kept the furnace cold for three days. He said you would come.”'],[-12,90,'repair'],[92,55,'core'],[85,-80,'repair']],
      hazards:[[-10,-15,18,'fire'],[85,-40,15,'fire']] },
    { title:'CINDER WORKS',place:'04 / Geothermal reactor city',biome:'reactor',size:125,start:[-90,85], pressure:{label:'REACTOR SURGE',hunterSpeed:5.5,artilleryRadius:6.5,artilleryFuse:1.45,artilleryDamage:26},
      briefing:'Three couplings tether the Sovereign’s shields to the city. Orla brings the stolen capacitor through the tunnels while you fight across the furnace district. Shut down the outer relays, survive the counterattack, and cut the final feed. Cooling pools offer relief from the heat; glowing vents will burn through armor.',
      outro:'The shield falls. The Sovereign tears its anchors from the city and begins walking toward the evacuation fleet. Ivo opens a maintenance channel directly to its engine. This is the last road.',
      stages:[['hold','Disconnect the west coupling',-65,30,'ORLA / Coolant pools help the reactor. Orange fissures do not. Watch your footing.',8],['hold','Disconnect the east coupling',65,20,'IVO / I can hear your guns. The command deck knows you are coming.',8],['defend','Hold the capacitor uplink',5,-25,'ORLA / The overload needs forty seconds. Stay within the uplink perimeter; I will call out the counterattacks.',40],['eliminate','Break the final power guard',55,-85,'MARA / No more shields. No more hiding.']],
      squads:[[-65,30,'tank',3],[-20,15,'artillery',2],[65,20,'hunter',3],[5,-25,'escort',2],[55,-85,'tank',3],[70,-70,'artillery',2]],
      towers:[[-71,49,21],[55,38,21],[-10,-5,24],[45,-65,24],[75,-67,22]],
      caches:[[-95,-20,'intel','Directorate orders: abandon the workforce, preserve the weapon. Ivo has copied the order onto every public channel.'],[-5,70,'repair'],[95,65,'core'],[-55,-70,'repair']],
      hazards:[[-30,50,13,'fire'],[30,35,12,'fire'],[-25,-60,14,'fire'],[80,-35,16,'water']] },
    { title:'SOVEREIGN',place:'05 / The walking fortress',biome:'fortress',size:135,start:[-90,90], pressure:{label:'FORTRESS SCREEN',hunterSpeed:5.7,artilleryRadius:7,artilleryFuse:1.5,artilleryDamage:28},
      briefing:'The Sovereign is a city built to kill cities. Its escort walkers guard two shield pylons. Break the pylons, reach the engine basin, and bring the fortress down. Ivo is opening the blast doors from inside. Orla is keeping the rescue channel clear. This time, the city fights back.',
      outro:'The Sovereign kneels. Its furnace goes dark above the water. Ivo steps from a maintenance hatch onto your mech’s hand, laughing through the static. At dawn, the harbor lights come back on. Not for the Directorate. For everyone who came home.',
      stages:[['eliminate','Destroy the western shield guard',-65,40,'ORLA / Two batteries guard the approach. Take them one at a time. There is a repair cache between the lines.'],['eliminate','Destroy the eastern shield guard',65,25,'IVO / Both pylons are down. I am opening the engine doors. Come get me.'],['boss','Bring down the Sovereign',0,-65,'ORLA / Siege shells, then a cooling window. When its armor glows cyan, put everything into the core.'],['reach','Recover Ivo at the escape hatch',0,-108,'IVO / I see you. Hold out your hand, Mara.']],
      squads:[[-65,40,'tank',3],[-40,55,'hunter',2],[65,25,'artillery',3],[45,45,'escort',2]],
      towers:[[-73,60,23],[-54,57,20],[55,45,24],[75,43,22],[-22,-43,26],[22,-43,26]],
      caches:[[-100,-35,'intel','The original harbor charter is sealed inside a ruined station. “The tide belongs to no one.”'],[0,55,'repair'],[100,-20,'core'],[-55,-75,'repair'],[55,-80,'repair']],
      hazards:[[-35,-10,12,'fire'],[35,-10,12,'fire']] }
  ];
  IW.CAMPAIGN = chapters;
  const baseCreate=IW.createState,baseStart=IW.start;
  const copy=x=>JSON.parse(JSON.stringify(x));
  const archives=chapters.flatMap((c,chapter)=>c.caches.flatMap((cache,i)=>cache[2]==='intel'?[{id:'cache-'+chapter+'-'+i,chapter,title:c.title,text:cache[3]}]:[]));
  function recoveredIntel(ids,maxChapter){const collected=new Set(Array.isArray(ids)?ids:[]);return archives.filter(a=>a.chapter<=maxChapter&&collected.has(a.id)).map(a=>a.id);}
  IW.archiveEntries=function(s){const recovered=new Set(recoveredIntel(s.totals?.intel,s.chapter));return archives.filter(a=>recovered.has(a.id)).map(a=>({...a,secured:a.chapter<s.chapter||s.status==='won'}));};
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const point=a=>({x:a[0],z:a[1]});
  function foe(id,type,x,z,pressure){const hp={tank:320,escort:125,hunter:180,artillery:150,boss:3000}[type],p=pressure||{};return{id,type,x,z,hp,maxHp:hp,alive:true,disabled:false,weaponTaken:false,escaped:false,cooldown:2.5,radius:type==='boss'?6:type==='tank'?1.8:1.3,angle:Math.PI,phase:0,hunterSpeed:p.hunterSpeed||4.8,artilleryRadius:p.artilleryRadius||6,artilleryFuse:p.artilleryFuse||1.6,artilleryDamage:p.artilleryDamage||24};}
  function stageFoes(s,stage){const o=s.objectives[stage];return s.enemies.filter(e=>e.alive&&o.targets.includes(e.id));}
  function makeChapter(index,upgrades,totals){
    index=Math.max(0,Math.min(chapters.length-1,index||0));const c=chapters[index],s=baseCreate(7);
    s.campaign=true;s.chapter=index;s.biome=c.biome;s.pressure=copy(c.pressure);s.bounds={minX:-c.size,maxX:c.size,minZ:-c.size,maxZ:c.size};
    s.upgrades=copy(upgrades||{armor:0,reactor:0,damage:0});s.totals=copy(totals||{score:0,kills:0,time:0,collapseKills:0,intel:[]});
    // Scores restart at the incoming chapter checkpoint; archives must do the same.
    // Authored chapter IDs also recover that checkpoint from legacy version-1 saves.
    s.totals.intel=recoveredIntel(s.totals.intel,index-1);
    s.score=s.totals.score;s.timeLeft=0;s.stage=0;s.wave=0;s.hazards=c.hazards.map(a=>({...point(a),radius:a[2],type:a[3]}));s.strikes=[];
    Object.assign(s.player,point(c.start),{maxHp:240+s.upgrades.armor*50,hp:240+s.upgrades.armor*50,dashCooldown:0,dashing:0,invulnerable:0});
    s.objectives=c.stages.map((a,i)=>({type:a[0],title:a[1],x:a[2],z:a[3],radio:a[4],duration:a[5]||0,progress:0,done:false,id:'objective-'+i}));
    s.radio=s.objectives[0].radio;s.radioTime=14;s.message='FOLLOW THE GOLD BEACON • TAB / MISSION MAP';
    s.enemies=[];c.squads.forEach((a,i)=>{for(let n=0;n<a[3];n++)s.enemies.push(foe('c'+index+'-s'+i+'-'+n,a[2],a[0]+(n%2)*7,a[1]-Math.floor(n/2)*7,c.pressure));});
    if(index===4)s.enemies.push(foe('sovereign','boss',0,-65,c.pressure));
    for(const o of s.objectives)o.targets=s.enemies.filter(e=>e.type!=='boss'&&dist(e,o)<29).map(e=>e.id);
    s.buildings=c.towers.map((a,i)=>({id:'tower-'+index+'-'+i,...point(a),w:4,d:4,h:a[2],hp:80,maxHp:80,status:'standing',fallX:0,fallZ:-1,fallProgress:0,hitIds:[]}));
    if(index===2)for(let i=0;i<3;i++)s.buildings.push({id:'railcar-'+i,x:26+i*15,z:55,w:12,d:5,h:4,hp:1,maxHp:1,indestructible:true,kind:'train',status:'standing',fallX:0,fallZ:-1,fallProgress:0,hitIds:[]});
    // Cover clusters sit off the authored route; all visible buildings share collision.
    for(let i=0;i<22;i++){const x=-c.size+15+((i*43)%(c.size*2-30)),z=-c.size+12+((i*67)%(c.size*2-24));const p={x,z};
      if(dist(p,s.player)<12||s.objectives.some(o=>dist(p,o)<17)||s.enemies.some(e=>dist(e,p)<8)||s.buildings.some(b=>dist(b,p)<9)||c.caches.some(a=>dist(p,point(a))<9)||(index===0&&dist(p,{x:12,z:-45})<12))continue;
      s.buildings.push({id:'block-'+index+'-'+i,x,z,w:6+(i%3)*2,d:6,h:5+i%5*2,hp:160,maxHp:160,status:'standing',fallX:0,fallZ:-1,fallProgress:0,hitIds:[],kind:c.biome,color:c.biome==='desert'?'#88705c':c.biome==='reactor'?'#574d5d':'#4a686e'});
    }
    s.pickups=c.caches.map((a,i)=>({id:'cache-'+index+'-'+i,...point(a),type:a[2],text:a[3]||'',taken:false}));
    if(index===0)s.pickups.push({id:'battery-relay-0',type:'relay',name:'Ferry battery relay',text:'Optional battery sabotage. Recover the ferry manifest command codes, then hold F / INTERACT here for five uninterrupted seconds.',x:12,z:-45,locked:true,taken:false,progress:0,duration:5});
    s.convoyTotal=s.enemies.filter(e=>e.type==='tank').length;s.convoyDestroyed=0;return s;
  }
  IW.createCampaignState=makeChapter;
  function replace(s,fresh){Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,fresh);}
  IW.start=function(s){if(!s.campaign)return baseStart(s);if(s.status==='playing')return false;replace(s,makeChapter(s.chapter,s.upgrades,s.totals));s.status='playing';return true;};
  IW.advance=function(s,upgrade){if(!s.campaign||s.status!=='won'||s.chapter>=4||!['armor','reactor','damage'].includes(upgrade))return false;
    const u=copy(s.upgrades);u[upgrade]++;replace(s,makeChapter(s.chapter+1,u,{score:s.score,kills:s.totals.kills+s.kills,time:(s.totals.time||0)+s.time,collapseKills:(s.totals.collapseKills||0)+s.collapseKills,intel:s.totals.intel}));return true;};
  IW.campaignSave=s=>copy({version:1,chapter:s.chapter,upgrades:s.upgrades,totals:s.totals,pending:s.status==='won'?{score:s.score,kills:s.kills,collapseKills:s.collapseKills,hp:s.player.hp,time:s.time,batteryRelayDisabled:s.chapter===0&&s.pickups.some(c=>c.id==='battery-relay-0'&&c.taken)}:null});
  IW.restoreCampaign=function(save){if(!save||save.version!==1||!Number.isInteger(save.chapter)||save.chapter<0||save.chapter>4)return makeChapter(0);
    const u={};for(const k of ['armor','reactor','damage'])u[k]=Math.min(4,Math.max(0,Math.floor(Number(save.upgrades?.[k])||0)));
    const t={score:Math.max(0,Math.min(1e8,Math.floor(Number(save.totals?.score)||0))),kills:Math.max(0,Number(save.totals?.kills)||0),time:Math.max(0,Number(save.totals?.time)||0),collapseKills:Math.max(0,Number(save.totals?.collapseKills)||0),intel:recoveredIntel(save.totals?.intel,save.chapter)};const s=makeChapter(save.chapter,u,t);
    if(save.pending&&['score','kills','collapseKills','hp','time'].every(k=>Number.isFinite(save.pending[k])&&save.pending[k]>=0)){Object.assign(s,{status:'won',stage:s.objectives.length,score:save.pending.score,kills:save.pending.kills,collapseKills:save.pending.collapseKills,time:save.pending.time});s.totals.intel=t.intel;s.pickups.forEach(c=>{if(c.type==='intel')c.taken=s.totals.intel.includes(c.id);if(s.chapter===0&&c.id==='battery-relay-0'){c.locked=!s.totals.intel.includes('cache-0-0');c.taken=!c.locked&&save.pending.batteryRelayDisabled===true;c.progress=c.taken?c.duration:0;}});s.player.hp=Math.min(s.player.maxHp,save.pending.hp);s.objectives.forEach(o=>o.done=true);}
    return s;};
  function blast(s,x,z,radius,delay,damage,sourceId){s.strikes.push({id:++s.nextId,x,z,radius,life:delay,maxLife:delay,damage,sourceId});}
  IW.updateCampaignEnemies=function(s,dt){
    const p=s.player;
    for(const e of s.enemies){if(!e.alive)continue;const d=dist(e,p);e.angle=Math.atan2(p.x-e.x,p.z-e.z);e.cooldown=Math.max(0,e.cooldown-dt);
      if(e.type==='boss'){
        if(s.stage<2)continue;e.phase=e.hp<e.maxHp*.33?2:e.hp<e.maxHp*.66?1:0;e.exposed=(s.time%12)>8;e.active=true;
        e.x=Math.sin(s.time*.06)*16;e.z=-65+Math.cos(s.time*.06)*8;
        if(!e.exposed&&d<80&&e.cooldown===0){for(let i=0;i<3+e.phase;i++)blast(s,p.x+(i-1)*7,p.z+(i%2)*6,5+e.phase,1.8,26,e.id);e.cooldown=3.6-e.phase*.35;}
        continue;
      }
      if(d>46)continue;
      if(e.type==='hunter'&&d>5){const speed=e.hunterSpeed||4.8,nx=e.x+Math.sin(e.angle)*dt*speed,nz=e.z+Math.cos(e.angle)*dt*speed;if(!s.buildings.some(b=>IW.inFootprint({x:nx,z:nz},b,e.radius,0))){e.x=nx;e.z=nz;}else{const side={x:e.x+Math.cos(e.angle)*dt*speed*1.04,z:e.z-Math.sin(e.angle)*dt*speed*1.04};if(!s.buildings.some(b=>IW.inFootprint(side,b,e.radius,0)))Object.assign(e,side);}}
      if(e.cooldown>0)continue;
      if(e.type==='artillery'){blast(s,p.x,p.z,e.artilleryRadius||6,e.artilleryFuse||1.6,e.artilleryDamage||24,e.id);e.cooldown=4;}
      else if(e.type==='hunter'&&d<7){blast(s,p.x,p.z,3.8,.8,18,e.id);e.cooldown=2.5;}
      else if(e.type!=='hunter'&&d<34){IW.shoot(s,e.id,e.x,e.z,p.x-e.x,p.z-e.z,e.type==='tank'?14:9,e.type==='tank'?24:29,false);e.cooldown=e.type==='tank'?2.7:1.9;}
    }
    for(const b of s.strikes){b.life-=dt;if(b.life<=0){if(dist(b,p)<b.radius&&p.invulnerable<=0)IW.damagePlayer(s,b.damage);s.effects.push({id:++s.nextId,type:'explosion',x:b.x,z:b.z,life:.6,maxLife:.6});}}
    s.strikes=s.strikes.filter(b=>b.life>0);
  };
  IW.updateCampaign=function(s,input,dt){
    const p=s.player,o=s.objectives[s.stage];s.radioTime=Math.max(0,s.radioTime-dt);s.context='';
    for(const h of s.hazards)if(dist(h,p)<h.radius){if(h.type==='water')p.heat=Math.max(0,p.heat-14*dt);else IW.damagePlayer(s,6*dt);}
    if(p.hp<=0){s.status='lost';s.message='MECH DISABLED';p.venting=false;return;}
    for(const c of s.pickups)if(c.type!=='relay'&&!c.taken&&dist(c,p)<4){c.taken=true;s.score+=c.type==='intel'?600:300;
      if(c.type==='repair'){p.hp=Math.min(p.maxHp,p.hp+100);s.message='FIELD REPAIR • +100 ARMOR';}
      if(c.type==='core'){p.heat=0;p.overheated=false;p.dashCooldown=0;p.hp=Math.min(p.maxHp,p.hp+40);s.message='CAPACITOR CACHE • ARMOR + COOLANT + BOOST';}
      if(c.type==='intel'){if(!s.totals.intel.includes(c.id))s.totals.intel.push(c.id);s.radio='ARCHIVE / '+c.text;s.radioTime=16;s.message='ARCHIVE RECOVERED • +600';}
    }
    const relay=s.chapter===0?s.pickups.find(c=>c.id==='battery-relay-0'&&c.type==='relay'):null;
    if(relay&&!relay.taken){
      relay.locked=!s.totals.intel.includes('cache-0-0');
      relay.progress=!relay.locked&&dist(relay,p)<=6&&input.interact?Math.min(relay.duration,relay.progress+dt):0;
      if(relay.progress>=relay.duration-1e-9){
        relay.progress=relay.duration;relay.taken=true;
        for(const e of s.enemies)if(e.alive&&e.type==='artillery'&&/^c0-s3-\d+$/.test(e.id)){
          e.alive=false;e.hp=0;e.disabled=true;s.kills++;s.score+=150;
          s.effects.push({id:++s.nextId,type:'explosion',x:e.x,z:e.z,life:.6,maxLife:.6});
        }
        s.message='BATTERY RELAY OVERRIDDEN • COASTAL GUNS DISABLED';
        s.radio='ORLA / Command codes accepted. The coastal artillery is offline. Any shells already in the air are still live. Finish the remaining objectives and get those ferries out.';s.radioTime=14;
      }
    }
    if(!o)return;
    const nearby=dist(o,p),threats=s.enemies.filter(e=>e.alive&&dist(e,o)<20);
    if(o.type==='eliminate'){const alive=stageFoes(s,s.stage);s.objectiveDetail=alive.length+' defenders remaining';if(!alive.length)o.done=true;}
    else if(o.type==='boss'){const boss=s.enemies.find(e=>e.type==='boss');s.objectiveDetail=boss.alive?(boss.exposed?'CORE EXPOSED — FIRE':'ARMORED — DODGE THE SIEGE SHELLS'):'';o.done=!boss.alive;}
    else if(o.type==='reach'){s.objectiveDetail=Math.ceil(nearby)+' m to rendezvous';o.done=nearby<7;}
    else if(o.type==='hold'){
      s.objectiveDetail=Math.floor(o.progress)+' / '+o.duration+' sec • '+(threats.length?'clear nearby hostiles':'hold F / INTERACT at beacon');
      if(nearby<8){s.context=threats.length?'CLEAR NEARBY HOSTILES':'HOLD F / INTERACT';if(input.interact&&!threats.length)o.progress=Math.min(o.duration,o.progress+dt);}
      o.done=o.progress>=o.duration;
    }else if(o.type==='defend'){
      s.objectiveDetail=Math.floor(o.progress)+' / '+o.duration+' sec • stay within 18 m';s.context=nearby<18?'UPLINK CONNECTED':'RETURN TO UPLINK';
      if(nearby<18)o.progress+=dt;
      const wave=Math.min(3,1+Math.floor(o.progress/12));if(wave>s.wave){s.wave=wave;for(let i=0;i<3;i++)s.enemies.push(foe('wave-'+wave+'-'+i,i===0?'artillery':'hunter',o.x+(wave%2?1:-1)*(24+i*3),o.z-20+i*12,s.pressure));s.radio='ORLA / Counterattack '+wave+'. Keep the uplink in range.';s.radioTime=6;}
      o.done=o.progress>=o.duration;
    }
    if(relay&&!relay.taken&&dist(relay,p)<16)s.context=relay.locked?'RELAY LOCKED • FIND FERRY ARCHIVE CODES':dist(relay,p)<=6?'HOLD F / INTERACT • BATTERY RELAY '+relay.progress.toFixed(1)+' / 5 SEC':'OPTIONAL BATTERY RELAY • '+Math.ceil(dist(relay,p))+' m';
    if(!s.context){const cache=s.pickups.filter(c=>!c.taken&&c.type!=='relay').sort((a,b)=>dist(a,p)-dist(b,p))[0];if(cache){const d=Math.hypot(cache.x-p.x,cache.z-p.z);if(d<16){const kind=cache.type==='intel'?'ARCHIVE SIGNAL':cache.type==='repair'?'REPAIR CACHE':'CAPACITOR CACHE';s.context=kind+' • '+Math.max(1,Math.ceil(d))+' m';}}}
    if(o.done){s.score+=1200;s.stage++;if(s.stage<s.objectives.length){s.radio=s.objectives[s.stage].radio;s.radioTime=14;s.message='OBJECTIVE COMPLETE • +1200';p.hp=Math.min(p.maxHp,p.hp+35);}
      else{s.status='won';s.score+=Math.round(p.hp*5)+1500;s.message='CHAPTER SECURED';p.venting=false;}}
  };
})(globalThis.IW);
