/* Normal-clock, real-input reachability baseline. This does not establish fun. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.OO_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.env.OO_SHOTS || path.join(root, 'node_modules/.cache/orbit-orchard/contracts-playtest'));
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(data);
  });
});
async function attempt(browser, seed, choice, input) {
  const page = await browser.newPage({ viewport: input === 'touch' ? {width:390,height:844} : {width:1440,height:900}, hasTouch:input === 'touch' });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (['warning','error'].includes(message.type())) errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/orbit-orchard/index.html`);
  // Seed is assigned BEFORE play. No timers, cargo, positions or simulation steps are injected.
  await page.evaluate(seed => { OO.runtime.state.seed = seed; }, seed);
  await page.locator('#startButton').click();
  if (input === 'touch') await page.locator(choice === 'safe' ? '#safeContractButton' : '#riskyContractButton').tap();
  else await page.keyboard.press(choice === 'safe' ? '1' : '2');
  const cdp = input === 'touch' ? await page.context().newCDPSession(page) : null;
  let touching = false;
  let held = new Set();
  let capturedCargo = false;
  const began = Date.now();
  while (Date.now() - began < 90000) {
    const frame = await page.evaluate(() => {
      const {state:s,view} = OO.runtime;
      let target = OO.NURSERY;
      if (s.contract.cargo < s.contract.capacity) {
        target = s.relics.filter(r => r.active && OO.matchesContract(s,r)).sort((a,b) => Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];
      }
      return {status:s.status,cargo:s.contract.cargo,player:OO.worldToView(s.player,view),target:target && OO.worldToView(target,view),view:{width:view.width,height:view.height}};
    });
    if (frame.status !== 'playing') break;
    assert(frame.target, 'reachable target supply remains');
    if (frame.cargo === 3 && !capturedCargo) {
      await page.screenshot({path:path.join(output,`${seed}-${choice}-${input}-cargo.png`)});
      capturedCargo = true;
    }
    if (input === 'keyboard') {
      const dx = frame.target.x-frame.player.x, dy = frame.target.y-frame.player.y;
      const wanted = new Set();
      if (Math.abs(dx)>8) wanted.add(dx>0?'d':'a');
      if (Math.abs(dy)>8) wanted.add(dy>0?'s':'w');
      for (const key of held) if (!wanted.has(key)) await page.keyboard.up(key);
      for (const key of wanted) if (!held.has(key)) await page.keyboard.down(key);
      held = wanted;
    } else {
      const box = await page.locator('canvas').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', {type:touching?'touchMove':'touchStart',touchPoints:[{id:0,x:box.x+frame.target.x/frame.view.width*box.width,y:box.y+frame.target.y/frame.view.height*box.height}]});
      touching = true;
    }
    await page.waitForTimeout(120);
  }
  for (const key of held) await page.keyboard.up(key);
  if (touching) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(80);
  const result = await page.evaluate(() => {
    const s=OO.runtime.state;
    return {seed:s.seed,choice:s.contract.choice,outcome:s.outcome,deliveries:s.contractsCompleted,hits:s.hits,score:s.score,harvestScore:s.harvestScore,deliveryScore:s.deliveryScore,radius:s.player.radius,absorbed:s.absorbed,time:s.time,timeLeft:s.timeLeft,bestChain:s.bestChain,status:s.status};
  });
  await page.screenshot({path:path.join(output,`${seed}-${choice}-${input}-result.png`)});
  assert.deepEqual(errors, [], 'clean browser console');
  assert.equal(result.status, 'over', 'normal timer reaches an outcome');
  await page.close();
  return {...result,input,strategy:'nearest eligible target then nursery',wallSeconds:(Date.now()-began)/1000};
}
async function main() {
  fs.mkdirSync(output,{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.OO_CHROME?{executablePath:process.env.OO_CHROME}:{})});
  const results=[];
  try {
    for (const seed of [7,42,2026]) for (const choice of ['safe','risky']) {
      // Run one page at a time so simultaneous rendering does not skew the clock.
      const pair=[];
      for (const input of ['keyboard','touch']) pair.push(await attempt(browser,seed,choice,input));
      results.push(...pair);
      fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));
      console.log(JSON.stringify(pair));
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
