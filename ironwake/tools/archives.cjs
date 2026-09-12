'use strict';
// Archive/checkpoint UI regression fixtures. Positions, radio time and final
// objective state are injected below; these are not natural play or fun evidence.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require(process.env.IW_PLAYWRIGHT||'C:/Users/jshun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.env.IW_SHOTS||'node_modules/.cache/ironwake/archives');
const sizes=(process.env.IW_VIEWPORTS||'320x568,390x844,844x390,768x1024,1440x900,3840x2160').split(',').map(s=>s.split('x').map(Number));
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);});});

async function main(){
 fs.mkdirSync(output,{recursive:true});
 const report={status:'running',started:new Date().toISOString(),evidence:'Injected state fixtures with actual keyboard/mouse/native touch UI; not natural gameplay, physical-device or enjoyment evidence.',viewports:[]};
 const write=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));write();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.IW_CHROME||'C:/Users/jshun/AppData/Local/ms-playwright/chromium-1155/chrome-win/chrome.exe'});
  for(const [width,height]of sizes){
   const touch=width<1000,page=await browser.newPage({viewport:{width,height},hasTouch:touch}),errors=[],external=[],checks=[];
   const row={width,height,input:touch?'native touchscreen taps and keyboard':'mouse and keyboard',checks,errors,external};report.viewports.push(row);write();
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url());});
   const activate=async selector=>{const el=page.locator(selector);await el.scrollIntoViewIfNeeded();await (touch?el.tap():el.click());};
   const shot=async name=>{await page.screenshot({path:path.join(output,`${width}x${height}-${name}.png`)});};
   const fit=async selector=>{
    assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'document has no horizontal overflow');
    const bounds=await page.locator(selector).evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}));
    assert(bounds.scroll<=bounds.client+1,selector+' has no internal horizontal overflow');assert(bounds.left>=-1&&bounds.right<=width+1,selector+' fits viewport');
   };
   const openJournal=async selector=>{if(!await page.locator(selector).evaluate(el=>el.open))await activate(selector+' > summary');assert(await page.locator(selector).evaluate(el=>el.open),selector+' opens through real input');};
   const map=async()=>{await activate('#mapButton');await page.waitForFunction(()=>IW.runtime.paused);await fit('#mapPanel');};
   const resume=async()=>{await activate('#resume');await page.waitForFunction(()=>!IW.runtime.paused);};
   const cacheRows=async()=>{
    const expected=await page.evaluate(()=>IW.runtime.state.pickups.filter(c=>!c.taken).map(c=>({id:c.id,type:c.type,distance:Math.ceil(Math.hypot(c.x-IW.runtime.state.player.x,c.z-IW.runtime.state.player.z)),dx:c.x-IW.runtime.state.player.x,dz:c.z-IW.runtime.state.player.z})));
    assert.equal(await page.locator('#cacheList li').count(),expected.length,'only available caches listed');
    for(const c of expected){const el=page.locator(`[data-cache-id="${c.id}"]`),text=await el.textContent();assert.match(text,c.type==='intel'?/ARCHIVE/i:c.type==='repair'?/REPAIR/i:/CAPACITOR/i);assert.match(text,new RegExp('(?:^|\\D)'+c.distance+'\\s*m\\b','i'),'cache distance matches paused position');assert.match(text,/\b(?:N|NE|E|SE|S|SW|W|NW)\b/,'cache includes compass direction');await fit(`[data-cache-id="${c.id}"]`);}
    return expected;
   };
   const collect=async chapter=>{
    // Teleport fixture only; normal animation frame performs pickup collection.
    await page.evaluate(()=>{const s=IW.runtime.state,c=s.pickups.find(c=>c.type==='intel');s.player.x=c.x;s.player.z=c.z;});
    await page.waitForFunction(chapter=>IW.runtime.state.pickups.find(c=>c.id==='cache-'+chapter+'-0').taken,chapter);
    await page.evaluate(()=>IW.runtime.state.radioTime=0);
    await page.waitForFunction(()=>document.querySelector('#radio').hidden);
   };
   const win=async()=>{
    // Finish-objective fixture; uses the ordinary campaign update/debrief/save.
    await page.evaluate(()=>{const s=IW.runtime.state;s.stage=3;s.objectives.slice(0,3).forEach(o=>o.done=true);const o=s.objectives[3];s.player.x=o.x;s.player.z=o.z;});
    await page.waitForFunction(()=>IW.runtime.state.status==='won');await page.waitForFunction(()=>!document.querySelector('#results').hidden);
   };
   const lose=async()=>{
    await page.evaluate(()=>IW.runtime.state.player.hp=0);await page.waitForFunction(()=>IW.runtime.state.status==='lost');await openJournal('#debriefJournal');
    const entries=await page.evaluate(()=>IW.archiveEntries(IW.runtime.state));
    for(const entry of entries){const text=await page.locator(`#debriefArchiveEntries [data-archive-id="${entry.id}"] small`).textContent();assert.match(text,entry.secured?/SAVED AT CHAPTER CHECKPOINT/:/LOST WITH MECH.*RECOVER AGAIN ON RETRY/,'lost debrief distinguishes banked and unbanked stories');}
    await page.locator('#debriefArchiveEntries').scrollIntoViewIfNeeded();await shot('lost-chapter-'+await page.evaluate(()=>IW.runtime.state.chapter)+'-journal');
   };
   await page.goto(`http://127.0.0.1:${server.address().port}/ironwake/index.html`);
   await page.waitForFunction(()=>IW.runtime&&typeof IW.archiveEntries==='function');
   await page.locator('#archiveJournal').waitFor({state:'attached'});
   const stories=await page.evaluate(()=>IW.CAMPAIGN.map(c=>c.caches.find(a=>a[2]==='intel')[3]));
   await activate('#start');
   // Tab from the focused combat canvas must open the real pause map.
   await page.keyboard.press('Tab');await page.waitForFunction(()=>IW.runtime.paused);
   const pausedTime=await page.evaluate(()=>IW.runtime.state.time);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>IW.runtime.state.time),pausedTime,'map pauses clock');
   await activate('#signalsButton');assert(await page.locator('#archiveJournal').evaluate(el=>el.open),'signals shortcut opens journal');assert(await page.evaluate(()=>IW.runtime.paused),'signals shortcut retains pause');assert.equal(await page.evaluate(()=>IW.runtime.state.time),pausedTime,'signals navigation leaves simulation paused');
   const signalTop=await page.locator('#cachePanel').evaluate(el=>el.getBoundingClientRect().top);assert(signalTop>=-1&&signalTop<height-20,'signals shortcut reaches cache panel heading');await shot('signals-shortcut');
   await openJournal('#archiveJournal');
   const empty=await page.locator('#archiveEntries').textContent();for(const text of stories)assert(!empty.includes(text),'unrecovered authored story is not revealed');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),0);
   assert.match(await page.locator('#archiveCount').textContent(),/0\s*\/\s*5/);
   await cacheRows();await fit('#mapPanel');await fit('#archiveEntries');await shot('empty-journal');checks.push('keyboard map pauses; native signals shortcut reaches journal; empty stories hidden; cache types/distances/directions');
   // Keyboard operates the native disclosure without resuming combat.
   await page.locator('#archiveJournal > summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#archiveJournal').evaluate(el=>el.open),false);await page.keyboard.press('Enter');assert(await page.locator('#archiveJournal').evaluate(el=>el.open));assert(await page.evaluate(()=>IW.runtime.paused));
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!IW.runtime.paused);
   await collect(0);await map();await openJournal('#archiveJournal');
   assert((await page.locator('#archiveEntries').textContent()).includes(stories[0]),'recovered story survives radio expiry');for(const text of stories.slice(1))assert(!(await page.locator('#archiveEntries').textContent()).includes(text));
   assert.match(await page.locator('#archiveCount').textContent(),/1\s*\/\s*5/);await cacheRows();assert.equal(await page.locator('[data-cache-id="cache-0-0"]').count(),0);await fit('#archiveEntries');await page.locator('#archiveEntries').scrollIntoViewIfNeeded();await shot('recovered-journal');checks.push('recovered story persists after radio expiry; collected cache disappears');
   await resume();await lose();await activate('#retry');await map();await openJournal('#archiveJournal');assert(!(await page.locator('#archiveEntries').textContent()).includes(stories[0]),'retry rolls back failed-chapter archive');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),0);await cacheRows();checks.push('death and real retry roll back unbanked archive');
   await resume();await collect(0);await page.reload();await page.waitForFunction(()=>IW.runtime?.state.status==='ready');await activate('#start');await map();await openJournal('#archiveJournal');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),0,'midchapter reload restores checkpoint');assert(!(await page.locator('#archiveEntries').textContent()).includes(stories[0]));checks.push('midchapter reload rolls back unbanked archive');
   await resume();await collect(0);await win();await openJournal('#debriefJournal');assert((await page.locator('#debriefArchiveEntries').textContent()).includes(stories[0]));await fit('#results');await fit('#debriefArchiveEntries');await page.locator('#debriefArchiveEntries').scrollIntoViewIfNeeded();await shot('won-journal');
   await page.reload();await page.waitForFunction(()=>IW.runtime?.state.status==='won');await openJournal('#debriefJournal');assert((await page.locator('#debriefArchiveEntries').textContent()).includes(stories[0]),'won reload keeps recovered story');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),1);checks.push('won debrief and won reload preserve recovered archive');
   // Retrying a completed chapter replays its incoming checkpoint, not its ending.
   await activate('#retry');await map();await openJournal('#archiveJournal');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),0,'won retry rolls back current chapter archive');await resume();await collect(0);await win();await activate('[data-upgrade=armor]');await activate('#start');await map();await openJournal('#archiveJournal');assert((await page.locator('#archiveEntries').textContent()).includes(stories[0]),'chapter advance banks prior story');assert(!(await page.locator('#archiveEntries').textContent()).includes(stories[1]));await cacheRows();checks.push('completed-chapter retry resets; upgrade advance banks prior chapter archive');
   await resume();await collect(1);await map();await openJournal('#archiveJournal');let journal=await page.locator('#archiveEntries').textContent();assert(journal.includes(stories[0])&&journal.includes(stories[1]),'journal combines banked and current stories');for(const text of stories.slice(2))assert(!journal.includes(text));assert.match(await page.locator('#archiveCount').textContent(),/2\s*\/\s*5/);await fit('#archiveEntries');await page.locator('#archiveEntries').scrollIntoViewIfNeeded();await shot('two-chapter-journal');
   await resume();await lose();await activate('#retry');await map();await openJournal('#archiveJournal');journal=await page.locator('#archiveEntries').textContent();assert(journal.includes(stories[0])&&!journal.includes(stories[1]),'later retry retains only banked archives');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),1);await cacheRows();await resume();await page.reload();await page.waitForFunction(()=>IW.runtime?.state.chapter===1);await activate('#start');await map();await openJournal('#archiveJournal');journal=await page.locator('#archiveEntries').textContent();assert(journal.includes(stories[0])&&!journal.includes(stories[1]),'chapter checkpoint reload keeps only banked story');checks.push('later-chapter retry and reload retain banked stories, discard current attempt');
   // Maximum-content fixture: four banked archives plus this chapter's pickup.
   await resume();await page.evaluate(()=>{const s=IW.runtime.state,fresh=IW.createCampaignState(4,undefined,{score:0,kills:0,time:0,collapseKills:0,intel:['cache-0-0','cache-1-0','cache-2-0','cache-3-0']});Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,fresh);});
   await page.waitForFunction(()=>!document.querySelector('#briefing').hidden);await activate('#start');await collect(4);
   for(let index=1;index<5;index++){await page.evaluate(index=>{const s=IW.runtime.state,c=s.pickups[index];s.player.x=c.x;s.player.z=c.z;},index);await page.waitForFunction(index=>IW.runtime.state.pickups[index].taken,index);}
   await map();await openJournal('#archiveJournal');assert.equal(await page.locator('#cacheList li').count(),0);assert(await page.locator('#cacheEmpty').isVisible(),'empty cache list explains all recovered');journal=await page.locator('#archiveEntries').textContent();for(const text of stories)assert(journal.includes(text),'full journal includes all five authored stories');assert.equal(await page.locator('#archiveEntries [data-archive-id]').count(),5);await fit('#archiveEntries');await page.locator('#archiveEntries li').last().scrollIntoViewIfNeeded();await shot('full-journal');await resume();await win();await openJournal('#debriefJournal');assert.equal(await page.locator('#debriefArchiveEntries [data-archive-id]').count(),5);assert(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).every(e=>e.secured)));await fit('#debriefArchiveEntries');await page.locator('#debriefArchiveEntries li').last().scrollIntoViewIfNeeded();await shot('full-ending-journal');await page.reload();await page.waitForFunction(()=>IW.runtime?.state.status==='won');await openJournal('#debriefJournal');assert.equal(await page.locator('#debriefArchiveEntries [data-archive-id]').count(),5,'final won reload retains full archive');await activate('#restartCampaign');await activate('#start');await map();await openJournal('#archiveJournal');assert.equal(await page.evaluate(()=>IW.archiveEntries(IW.runtime.state).length),0,'new campaign clears all archives');checks.push('full five-entry map/ending fit; all caches collected; final reload and new campaign');
   assert.deepEqual(errors,[],'console/page errors');assert.deepEqual(external,[],'external runtime requests');row.status='passed';await page.close();write();console.log(`${width}x${height}: ${checks.length} archive/checkpoint fixture groups passed`);
  }
  report.status='passed';
 }catch(error){report.status='failed';report.failure=error.stack||String(error);throw error;}
 finally{report.completed=new Date().toISOString();write();if(browser)await browser.close();}
 console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
