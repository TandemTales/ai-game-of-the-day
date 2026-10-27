const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { chromium } = require('playwright');
// Optional browser dependency; see gearwell/TESTING.md. No production API calls.
const root = path.resolve(__dirname, '..'), out = path.join(root, 'node_modules/.cache/gearwell', process.argv[2] || 'browser-smoke');
fs.mkdirSync(out, { recursive: true });
const api = [];
const server = http.createServer((req,res) => {
  const url = new URL(req.url,'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    api.push({ method:req.method, url:url.pathname + url.search });
    let body = ''; req.on('data',d => body += d); req.on('end',() => {
      if (body) api[api.length-1].body = JSON.parse(body);
      res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({ rank:1, success:true }));
    }); return;
  }
  const file = path.resolve(root,'.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file,(err,data) => {
    if(err) { res.writeHead(404); return res.end(); }
    res.writeHead(200,{'content-type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream'}); res.end(data);
  });
});
async function metrics(page) {
  return page.evaluate(() => ({ viewport:[innerWidth,innerHeight], scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight], canvas:[document.querySelector('canvas').getBoundingClientRect().width,document.querySelector('canvas').getBoundingClientRect().height], backing:[document.querySelector('canvas').width,document.querySelector('canvas').height], mode:GW.Game.getMode(), buttons:[...document.querySelectorAll('[data-action]')].map(b => { const r=b.getBoundingClientRect(); return { action:b.dataset.action, x:r.x,y:r.y,w:r.width,h:r.height,enabled:!b.disabled }; }) }));
}
async function plan(page) {
  return page.evaluate(() => {
    const L=GW.Logic, s=GW.Game.getState(); let best=null;
    for(let rot=0;rot<4;rot++) for(let dx=-5;dx<=5;dx++) {
      const c=JSON.parse(JSON.stringify(s)); c.history=null;
      let legal=true;
      for(let i=0;i<rot;i++) if(!L.rotate(c)) { legal=false; break; }
      for(let i=0;i<Math.abs(dx);i++) if(!L.move(c,Math.sign(dx),0)) { legal=false; break; }
      if(!legal) continue;
      L.hardDrop(c); if(c.over) continue;
      const heights=Array(10).fill(0); let holes=0;
      for(let x=0;x<10;x++) { let seen=false; for(let y=0;y<20;y++) { if(c.board[y][x]) { if(!seen) heights[x]=20-y; seen=true; } else if(seen) holes++; } }
      const bump=heights.slice(1).reduce((sum,h,i)=>sum+Math.abs(h-heights[i]),0);
      const value=(c.lines-s.lines)*6+(c.cogs-s.cogs)*2-heights.reduce((a,b)=>a+b,0)*.51-holes*9-bump*.3-Math.max(...heights)*.2;
      if(!best || value>best.value) best={rot,dx,value};
    }
    return best;
  });
}
async function execute(page,p) {
  for(let i=0;i<p.rot;i++) await page.keyboard.press('ArrowUp');
  for(let i=0;i<Math.abs(p.dx);i++) await page.keyboard.press(p.dx<0?'ArrowLeft':'ArrowRight');
  await page.keyboard.press('Space');
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const executablePath = process.env.GEARWELL_BROWSER_EXECUTABLE || (fs.existsSync(edge) ? edge : undefined);
  const browser=await chromium.launch({headless:true,executablePath});
  try {
    for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1440,900],[3840,2160]]) {
      const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true});
      const errors=[],external=[];
      page.on('pageerror',e=>errors.push(String(e))); page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())});
      page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:'))external.push(r.url())});
      page.on('dialog',d=>d.accept('Browser QA'));
      await page.goto('http://127.0.0.1:'+server.address().port+'/gearwell/index.html');
      await page.screenshot({path:path.join(out,`${width}x${height}-title.png`)});
      await page.locator('#start').click();
      if(width===390) {
        const before=await page.evaluate(()=>({...GW.Game.getState().piece}));
        await page.locator('[data-action="left"]').tap();
        assert.equal(await page.evaluate(()=>GW.Game.getState().piece.x),before.x-1);
        await page.locator('[data-action="right"]').tap();
        assert.equal(await page.evaluate(()=>GW.Game.getState().piece.x),before.x);
        await page.locator('[data-action="rotate"]').tap();
        assert.equal(await page.evaluate(()=>GW.Game.getState().piece.rot),(before.rot+1)%4);
        await page.locator('[data-action="down"]').tap();
        assert((await page.evaluate(()=>GW.Game.getState().piece.y))>before.y);
        await page.keyboard.press('Enter');
        assert((await page.evaluate(()=>GW.Game.getState().serial))>1);
        await page.evaluate(()=>GW.Game.start());
      }
      // Input-driven placements: no injected board or rules changes.
      for(let i=0;i<12;i++) { const p=await plan(page); assert(p); await execute(page,p); }
      await page.waitForTimeout(150);
      const reserve = await page.locator('.reserve-strip').evaluate(el => {
        const stage = el.closest('.stage').getBoundingClientRect();
        return [...el.querySelectorAll('span,strong')].map(label => {
          const r = label.getBoundingClientRect();
          return { text:label.textContent, font:parseFloat(getComputedStyle(label).fontSize), minimum:label.tagName==='STRONG'?12:11,
            fits:r.left>=stage.left && r.right<=stage.right && r.top>=stage.top && r.bottom<=stage.bottom };
        });
      });
      assert(reserve.every(label=>label.font>=label.minimum && label.fits), 'Reserve labels/counts must remain readable and inside the stage');
      await page.screenshot({path:path.join(out,`${width}x${height}.png`)});
      const layout=await metrics(page);
      const pass=!errors.length&&!external.length&&layout.scroll[0]<=width&&layout.scroll[1]<=height&&layout.buttons.every(b=>b.w>=44&&b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=width+.1&&b.y+b.h<=height+.1);
      console.log(JSON.stringify({size:`${width}x${height}`,pass,layout,errors,external}));
      if(!pass) process.exitCode=1;
      if(width===390) {
        let earned=null, clearCaptured=false;
        for(let i=0;i<160;i++) {
          const state=await page.evaluate(()=>{const s=GW.Game.getState();return {cogs:s.cogs,score:s.score,lines:s.lines,serial:s.serial,history:s.history,board:JSON.stringify(s.board)};});
          if(state.cogs>=3&&state.history) { earned=state; break; }
          const p=await plan(page); assert(p,'Planner must find placement'); await execute(page,p);
          if(!clearCaptured && await page.evaluate(n=>GW.Game.getState().cogs>n,state.cogs)) {
            await page.waitForTimeout(120); await page.screenshot({path:path.join(out,'earned-clear.png')});
            // Observe the actual earned event across its transport/receipt stages.
            // These are elapsed-time stills of normal play, not injected state.
            await page.waitForTimeout(330); await page.screenshot({path:path.join(out,'earned-clear-transport.png')});
            await page.waitForTimeout(400); await page.screenshot({path:path.join(out,'earned-clear-receipt.png')});
            clearCaptured=true;
          }
        }
        assert(earned,'Actual input must reach three earned cogs');
        assert.equal(await page.locator('#bank-status').textContent(), earned.cogs + ' COGS');
        assert.equal(await page.locator('#rewind').getAttribute('aria-label'), 'Rewind last lock, spend three cogs');
        await page.waitForTimeout(50); await page.screenshot({path:path.join(out,'earned-bank.png')});
        await page.setViewportSize({width:320,height:568});
        await page.waitForTimeout(60);
        await page.screenshot({path:path.join(out,'320x568-earned-bank.png')});
        assert(await page.locator('#bank-status').evaluate(el => {
          const r=el.getBoundingClientRect(), stage=el.closest('.stage').getBoundingClientRect();
          return r.left>=stage.left && r.right<=stage.right;
        }), 'Earned bank count and readiness must fit the smallest phone');
        await page.setViewportSize({width:390,height:844});
        await page.waitForTimeout(60);
        await page.locator('#rewind').tap();
        const rewound=await page.evaluate(keys=>{const s=GW.Game.getState(); return {cogs:s.cogs,history:s.history,last:s.last,board:JSON.stringify(s.board),restored:Object.fromEntries(keys.map(key=>[key,s[key]]))};},Object.keys(earned.history));
        assert.equal(rewound.cogs,earned.cogs-3); assert.equal(rewound.history,null); assert.equal(rewound.last,'LAST LOCK REWOUND'); assert.notEqual(rewound.board,earned.board);
        const retry = {...earned.history, score:earned.history.turnScore,
          piece:{...earned.history.piece,x:3,y:-1,rot:0}};
        assert.deepEqual(rewound.restored,retry,'Paid rewind must restore the board and sequence with the piece at spawn and its drop points removed');
        assert.equal(await page.locator('#notice').textContent(), 'REWOUND · PLACE IT AGAIN');
        assert.equal(await page.locator('#bank-status').textContent(), rewound.cogs + ' / 3 COGS');
        assert.equal(await page.locator('#rewind').isDisabled(), true);
        await page.waitForTimeout(100); await page.screenshot({path:path.join(out,'paid-rewind.png')});
        await page.waitForTimeout(350); await page.screenshot({path:path.join(out,'paid-rewind-transport.png')});
        // Let gravity run beyond the old automatic relock window, then prove
        // the returned piece is still available for a different placement.
        await page.waitForTimeout(1550); await page.screenshot({path:path.join(out,'paid-rewind-followup.png')});
        const followup = await page.evaluate(()=>{
          const s=GW.Game.getState(); return {board:s.board,serial:s.serial,piece:s.piece,history:s.history};
        });
        assert.deepEqual(followup.board,retry.board);
        assert.equal(followup.serial,retry.serial);
        assert.equal(followup.history,null);
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(()=>GW.Game.getState().piece.x),followup.piece.x+1);
        console.log(JSON.stringify({rewindFollowup:await page.evaluate(()=>{
          const s=GW.Game.getState();return {last:s.last,score:s.score,lines:s.lines,cogs:s.cogs};
        }),liveGravityContinues:true}));
        console.log(JSON.stringify({inputEarnedRewind:{before:{cogs:earned.cogs,score:earned.score,lines:earned.lines,serial:earned.serial},after:{cogs:rewound.cogs,score:rewound.restored.score,serial:rewound.restored.serial,last:rewound.last,history:rewound.history},completeSnapshotRestored:true,boardChanged:earned.board!==rewound.board}}));
        // Touch control smoke, state remains a normal input-produced run.
        for(const action of ['left','rotate','down','right','drop']) await page.locator(`[data-action="${action}"]`).tap();
        for(let i=0;i<30;i++) await page.keyboard.press('Space');
        await page.waitForTimeout(200); assert.equal(await page.evaluate(()=>GW.Game.getMode()),'end');
        await page.screenshot({path:path.join(out,'game-over.png')});
        await page.locator('#start').click(); assert.equal(await page.evaluate(()=>GW.Game.getState().score),0);
        assert.equal(api.length,2); assert.equal(api[0].method,'GET'); assert.equal(api[1].method,'POST'); assert.equal(api[1].body.gameId,'gearwell');
        console.log(JSON.stringify({touchControls:true,topOut:true,restart:true,api}));
      }
      assert.deepEqual(errors, [], 'No app errors or warnings through the complete interaction flow');
      assert.deepEqual(external, [], 'No external requests through the complete interaction flow');
      await page.close();
    }
    // Exercise the changed backing-store path at DPR 2 and preserve a live run
    // through portrait/landscape resizing without relying on physical hardware.
    const highDpiPage = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
    const resizeErrors=[];
    highDpiPage.on('pageerror',e=>resizeErrors.push(String(e)));
    await highDpiPage.goto('http://127.0.0.1:'+server.address().port+'/gearwell/index.html');
    await highDpiPage.locator('#start').click(); await highDpiPage.keyboard.press('Space');
    const runBeforeResize=await highDpiPage.evaluate(()=>({serial:GW.Game.getState().serial,score:GW.Game.getState().score}));
    for(const [width,height] of [[390,844],[844,390],[390,844]]) {
      await highDpiPage.setViewportSize({width,height});
      await highDpiPage.waitForFunction(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return Math.abs(c.width-r.width*2)<=1&&Math.abs(c.height-r.height*2)<=1;});
      const layout=await metrics(highDpiPage);
      assert(layout.scroll[0]<=width&&layout.scroll[1]<=height);
      assert(Math.abs(layout.canvas[0]/layout.canvas[1]-320/670)<.001);
      assert.deepEqual(await highDpiPage.evaluate(()=>({serial:GW.Game.getState().serial,score:GW.Game.getState().score})),runBeforeResize);
      await highDpiPage.screenshot({path:path.join(out,`${width}x${height}-dpr2.png`)});
      console.log(JSON.stringify({dpr2Resize:true,layout}));
    }
    assert.deepEqual(resizeErrors,[]); await highDpiPage.close();
  } finally { await browser.close(); server.close(); }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
