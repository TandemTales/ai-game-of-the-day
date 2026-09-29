'use strict';
// Declared fixtures isolate browser control, save and rendering integration.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.PW_SHOTS||path.join(root,'node_modules/.cache/prism-warden/sep27-discoveries'));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'text/html');res.end(data);});});
async function main(){
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const report=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
  for(const size of ['320x568','390x844','844x390','768x1024','1440x900','3840x2160']){
   const [width,height]=size.split('x').map(Number),page=await browser.newPage({viewport:{width,height},hasTouch:width<1000}),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
   await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);await page.locator('#begin').click();
   // Fresh optional entries are explicit layout fixtures, not acquisitions.
   const optionalObjectives=[];
   for(const [room,expected] of [['obs-chart',/sky chart/i],['archive',/record/i],['quench',/quench valve/i],['shade-vault',/branch mirrors/i]]){
    await page.evaluate(room=>PW.enterRoom(PW.game,room),room);
    await page.waitForFunction(room=>PW.game.roomId===room&&document.getElementById('objective').textContent===PW.game.objective,room);
    const objective=await page.locator('#objective').innerText();assert.match(objective,expected);
    const bounds=await page.locator('#objective').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height);
    optionalObjectives.push({room,objective,bounds});
    await page.waitForTimeout(150);await page.screenshot({path:path.join(out,size+'-optional-'+room+'.png')});
   }

   await page.evaluate(()=>{const s=PW.game;PW.enterRoom(s,'foundry');s.player.invulnerable=99;s.flags['stored-light']=true;s.player.prism='carried';s.mirrors.forEach(m=>m.index=0);});
   await page.waitForFunction(()=>!document.getElementById('polarity').hidden);await page.keyboard.press('f');
   await page.waitForFunction(()=>PW.game.flags.polarity==='cold');const button=page.locator('#polarity'),box=await button.boundingBox();
   assert(box.width>=44&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);
   const hud=await page.locator('#hud').boundingBox();assert(box.y>=hud.y+hud.height,'polarity must clear HUD');assert.equal(await button.evaluate(e=>document.elementFromPoint(e.getBoundingClientRect().x+e.clientWidth/2,e.getBoundingClientRect().y+e.clientHeight/2)===e),true);
   if(width<1000)await button.tap();else await button.click();await page.waitForFunction(()=>PW.game.flags.polarity==='hot');
   for(const id of ['slash','dash','prism','burst'])if(width<1000){const b=await page.locator('#'+id).boundingBox();assert(b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,id);}
   await page.waitForTimeout(250);await page.screenshot({path:path.join(out,size+'-polarity.png')});
   // Pause after declaring a lens-progress state so the photograph is repeatable.
   await page.evaluate(()=>{PW.enterRoom(PW.game,'reservoir');PW.game.flags.lens=true;const e=PW.game.enemies.find(e=>e.type==='hart');e.lensCharge=.64;e.x=520;e.y=384;PW.game.player.x=350;PW.game.player.y=384;});
   await page.locator('#pause').click();await page.evaluate(()=>{document.getElementById('overlay').hidden=true;PW.game.transition=0;PW.game.roomTime=5;PW.game.enemies.find(e=>e.type==='hart').lensCharge=.64;});await page.waitForTimeout(80);await page.screenshot({path:path.join(out,size+'-lens.png')});await page.locator('#pause').click();
   await page.evaluate(()=>{const s=PW.game;s.next={room:'stars'};PW.continueRegion(s);PW.enterRoom(s,'twins');s.player.invulnerable=99;s.enemies.forEach(e=>{e.hp=0;e.phase='defeated';});s.player.x=s.beacon.x;s.player.y=s.beacon.y;});
   await page.waitForFunction(()=>PW.game.status==='cleared');await page.waitForTimeout(100);
   assert(await page.locator('#begin').isDisabled());assert.equal(await page.locator('#restorationOptions button').count(),2);
   await page.locator('[data-equipment="lasting-bridge"]').click();assert(await page.locator('#begin').isDisabled(),'story choice required after equipment');
   await page.locator('#restorationChoices').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,size+'-choice.png')});
   await page.locator('[data-restoration="channels"]').click();assert(await page.locator('#begin').isEnabled());
   await page.reload();await page.locator('#begin').click();assert.equal(await page.evaluate(()=>PW.game.flags['restoration-choice']),'channels');
   assert(await page.locator('[data-restoration="beacons"]').isDisabled());await page.locator('#begin').click();await page.waitForFunction(()=>PW.game.regionId==='drowned-crown');
   assert(await page.evaluate(()=>PW.game.starPaths.filter(p=>!p.alignTo).every(p=>p.active)));
   await page.screenshot({path:path.join(out,size+'-channels.png')});
   // Final rescue flags are declared: this verifies the result flow, not boss victory.
   await page.evaluate(()=>{const s=PW.game;PW.enterRoom(s,'crown');s.player.invulnerable=99;s.enemies.forEach(e=>{e.hp=0;e.phase='defeated';});s.flags['defeated:eclipse-keeper']=true;s.flags['nacre-freed']=true;s.rescue.freed=true;s.flags['ilex-evacuated']=true;s.escort.arrived=true;s.player.x=s.beacon.x;s.player.y=s.beacon.y;});
   await page.waitForFunction(()=>PW.game.status==='won');await page.waitForTimeout(200);assert.match(await page.locator('#panelText').innerText(),/crossings.*Ferries/);assert.match(await page.locator('#panelText').innerText(),/0 of 1 Drowned Crown discoveries/);
   await page.screenshot({path:path.join(out,size+'-ending.png')});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   report.push({size,pass:true,errors,external,polarity:box,optionalObjectives});await page.close();console.log(size+' PASS');
  }
 }finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));if(browser)await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
