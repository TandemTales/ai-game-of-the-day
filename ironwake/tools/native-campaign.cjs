// Real keyboard/mouse browser play. The pilot reads state to plan, but only
// uses native input to move, aim and fight. No simulation fast-forward or cheats.
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require(process.env.IW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createPilot}=require('./campaign-playthrough.cjs');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'node_modules/.cache/ironwake/native-campaign');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html');res.end(d);});});
async function main(){fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.IW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/ironwake/index.html`);await page.waitForFunction(()=>IW.runtime);
 const reports=[];const count=Number(process.env.IW_NATIVE_CHAPTERS)||1;
 for(let chapter=0;chapter<count;chapter++){
  await page.locator('#start').click();if(chapter===0){await page.keyboard.press('e');await page.waitForTimeout(2200);}const pilot=createPilot();let held=new Set(),mouse=false,lastStage=-1,lastShot=0;const began=Date.now();let s;
  while(Date.now()-began<300000){
   s=await page.evaluate(()=>IW.runtime.state);if(s.status!=='playing')break;
   if(s.stage!==lastStage){lastStage=s.stage;await page.screenshot({path:path.join(output,`chapter-${chapter+1}-stage-${s.stage+1}.png`)});console.log(JSON.stringify({chapter:chapter+1,stage:s.stage,time:s.time,hp:s.player.hp}));}
   const input=pilot(s),desired=new Set();if(input.moveX>.25)desired.add('d');if(input.moveX<-.25)desired.add('a');if(input.moveZ>.25)desired.add('s');if(input.moveZ<-.25)desired.add('w');for(const [k,a]of [['e','punch'],['q','rip'],[' ','vent'],['Shift','dash'],['f','interact']])if(input[a])desired.add(k);
   for(const k of held)if(!desired.has(k))await page.keyboard.up(k);for(const k of desired)if(!held.has(k))await page.keyboard.down(k);held=desired;
   const point=await page.evaluate(p=>IW.runtime.renderer.project(p.x,p.z),{x:input.aimX,z:input.aimZ});await page.mouse.move(Math.max(5,Math.min(1435,point.x)),Math.max(45,Math.min(805,point.y)));
   if(input.fire!==mouse){mouse=input.fire;if(mouse)await page.mouse.down();else await page.mouse.up();}
   if(s.chapter===4&&s.stage===2&&s.time-lastShot>15){lastShot=s.time;await page.screenshot({path:path.join(output,'fortress-fight.png')});}
   await page.waitForTimeout(80);
  }
  for(const k of held)await page.keyboard.up(k);if(mouse)await page.mouse.up();await page.screenshot({path:path.join(output,`chapter-${chapter+1}-result.png`)});
  reports.push({chapter:chapter+1,status:s.status,time:s.time,hp:s.player.hp,stage:s.stage,kills:s.kills,collapseKills:s.collapseKills,weapon:s.player.weapon,position:{x:s.player.x,z:s.player.z},wallSeconds:(Date.now()-began)/1000});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({reports,errors},null,2));fs.appendFileSync(path.join(output,'history.jsonl'),JSON.stringify({at:new Date().toISOString(),...reports.at(-1)})+'\n');console.log(JSON.stringify(reports.at(-1)));
  if(s.status!=='won'){process.exitCode=1;break;}if(chapter<count-1)await page.locator(`[data-upgrade=${chapter%2?'damage':'armor'}]`).click();
 }
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
