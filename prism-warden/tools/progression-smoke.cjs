'use strict';
// Declared beacon/combat fixtures test integration, not legal campaign completion.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'node_modules/.cache/prism-warden/sep26-progression');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'text/html');res.end(data);});});
async function main(){
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const report=[];
 try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
 for(const size of ['320x568','390x844','844x390','768x1024','1440x900','3840x2160']){
  const [width,height]=size.split('x').map(Number),page=await browser.newPage({viewport:{width,height},hasTouch:width<1000});const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
  await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);await page.locator('#begin').click();
  const choices=['mobile-reflection','returning-blade','second-prism','burst-stun'];
  for(const [index,room]of ['beacon','reservoir','weaver','twins'].entries()){
   await page.evaluate(room=>{const s=PW.game;PW.enterRoom(s,room);s.status='playing';s.player.invulnerable=99;s.enemies.forEach(e=>{e.hp=0;e.phase='defeated';e.submerged=false;});s.player.x=s.beacon.x;s.player.y=s.beacon.y;},room);
   await page.waitForFunction(()=>PW.game.status==='cleared');await page.waitForTimeout(100);
   assert(await page.locator('#begin').isDisabled(),'selection required');assert.equal(await page.locator('#equipmentOptions button').count(),2);
   await page.screenshot({path:path.join(out,`${size}-choice-${index+1}.png`)});
   // Close/reopen the browser page before choosing: cleared state is secured.
   await page.reload();assert.match(await page.locator('#begin').innerText(),/Continue saved/);await page.locator('#begin').click();
   assert.equal(await page.evaluate(()=>PW.game.status),'cleared');
   const choice=page.locator(`[data-equipment="${choices[index]}"]`);await choice.scrollIntoViewIfNeeded();const box=await choice.boundingBox();assert(box.height>=44&&box.x>=0&&box.x+box.width<=width+1);
   if(width<1000)await choice.tap();else await choice.click();
   assert(await page.locator('#begin').isEnabled());assert.equal(await page.locator('[aria-pressed=true][data-equipment]').count(),1);
   await page.reload();await page.locator('#begin').click();assert(await page.locator('#begin').isEnabled(),'selected mod survives reload');
   await page.locator('#begin').click();await page.waitForFunction(()=>PW.game.status==='playing');
   assert.equal(await page.evaluate(()=>Object.keys(PW.game.equipment).length),index+1);
  }
  const secured=await page.evaluate(()=>({room:PW.game.roomId,score:PW.game.score,equipment:PW.game.equipment}));
  await page.evaluate(()=>{PW.game.score+=999;PW.game.flags.unsecured=true;});await page.reload();
  await page.screenshot({path:path.join(out,`${size}-resume.png`)});await page.locator('#begin').click();
  assert.deepEqual(await page.evaluate(()=>({room:PW.game.roomId,score:PW.game.score,equipment:PW.game.equipment})),secured);assert(await page.evaluate(()=>!PW.game.flags.unsecured));
  // Returning blade is driven by the actual keyboard chord from a declared safe room.
  await page.evaluate(()=>{const s=PW.game;PW.enterRoom(s,'crown');s.player.x=400;s.player.y=500;s.player.invulnerable=99;s.player.prism='carried';s.flags.prism=true;});
  await page.keyboard.down('Shift');await page.keyboard.press('j');await page.waitForFunction(()=>PW.game.blade);await page.screenshot({path:path.join(out,`${size}-blade.png`)});await page.keyboard.up('Shift');
  await page.waitForFunction(()=>!PW.game.blade);
  await page.keyboard.press('q');await page.waitForFunction(()=>PW.game.mirrors.filter(m=>m.portable).length===1);
  await page.keyboard.down('a');await page.waitForTimeout(700);await page.keyboard.up('a');await page.keyboard.press('q');await page.waitForFunction(()=>PW.game.mirrors.filter(m=>m.portable).length===2);
  await page.screenshot({path:path.join(out,`${size}-two-prisms.png`)});assert.match(await page.locator('#prism').innerText(),/2\/2/);
  await page.locator('#pause').click();assert.match(await page.locator('#panelText').innerText(),/Release Mirror/);await page.screenshot({path:path.join(out,`${size}-loadout-help.png`)});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  report.push({size,status:'PASS',errors,external,checks:'four choices, pending/selected reload, checkpoint rollback, actual blade/prism inputs, help'});await page.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser?.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
