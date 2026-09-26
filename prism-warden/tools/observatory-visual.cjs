'use strict';
// Declared room fixtures for fresh Region4 rendering QA, never play evidence.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.PW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.PW_SHOTS||'node_modules/.cache/prism-warden/observatory-final');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':p.endsWith('.webp')?'image/webp':'text/html');res.end(d);});});
async function main(){fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});const report=[];
try{for(const size of ['320x568','390x844','844x390','768x1024','1440x900','3840x2160']){
  const [width,height]=size.split('x').map(Number),touch=width<1000,page=await browser.newPage({viewport:{width,height},hasTouch:touch}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);await page.locator('#begin').click();
  for(const room of ['stars','twins']){
    await page.evaluate(r=>{const s=PW.game;PW.enterRoom(s,r);s.status='playing';s.flags['stored-light']=true;s.player.lightCharge=1;s.player.prism='carried';s.player.invulnerable=99;if(r==='twins'){s.player.x=700;s.player.y=360;}},room);await page.waitForTimeout(800);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'no overflow');
    if(touch)for(const id of ['slash','dash','prism','burst']){const b=await page.locator('#'+id).boundingBox();assert(b&&b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,'visible44px '+id);}
    await page.screenshot({path:path.join(out,`${size}-${room}-unlit.png`)});
    if(touch)await page.locator('#burst').tap();else await page.keyboard.press('r');
    await page.waitForFunction(()=>PW.game.burstTime>0);await page.screenshot({path:path.join(out,`${size}-${room}-burst.png`)});
  }
  assert.deepEqual(errors,[]);report.push({size,errors,status:'PASS'});await page.close();
}
// Missing Image fallback must still render the new chapter without crashing.
const p=await browser.newPage();await p.addInitScript(()=>{window.Image=undefined;});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/prism-warden/index.html`);await p.locator('#begin').click();await p.evaluate(()=>PW.enterRoom(PW.game,'twins'));await p.waitForTimeout(400);assert.deepEqual(errors,[]);await p.close();
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({viewports:report,noImage:'PASS'},null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
