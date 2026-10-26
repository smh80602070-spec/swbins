// node saga-web/tools/playcheck/skin-shot.mjs [판…] [--w=1280 --h=720] → shots/skin-<판>-{off,on}-<창>.png + 창 안 이모지 수
// W-0470 네 판 UI 겉옷 전후 — 손잡이 ui.skin 0(전)·1(후)로 같은 창을 찍는다(2나락은 dg-stone-shot)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const GAMES = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : ['saga-go', 'saga-forest', 'saga-story', 'saga-realm'];
const W = +(opt.w || 1280), H = +(opt.h || 720);
const SHEETS = { 'saga-go': ['me', 'party', 'bag'], 'saga-forest': ['bag', 'folks', 'town'], 'saga-story': ['bag', 'job', 'shop'], 'saga-realm': ['cp:route', 'cp:story', 'cp:camp'] };
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
let port = 8940;
for (const g of GAMES) {
  const PORT = port++, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', g)], { stdio: 'ignore' });
  await sleep(800);
  const c = await launch(W, H);
  try {
    await c.send('Network.setBypassServiceWorker', { bypass: true });
    const B = `http://127.0.0.1:${PORT}/index.html?mode=2d`;
    await c.go(B, 6000);
    await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} if (DG.account && DG.account.create) { DG.account.create('겉옷'); } })()`);
    for (const tag of ['off', 'on']) {
      await c.go(B, 8000);
      await c.ev(`DG.core.setTune('ui.skin', ${tag === 'on' ? 1 : 0}); DG.core.persist && DG.core.persist();`);
      await c.go(B, 8000);
      await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
      await sleep(4000);
      await c.ev(`(function(){ var s = document.querySelector('[data-act="pick-scen"]'); if (s) { s.click(); } })()`); await sleep(600);
      await c.ev(`(function(){ var s = document.querySelector('[data-act="pick-force"]'); if (s) { s.click(); } })()`); await sleep(2500);
      for (let k = 0; k < 6; k++) { await c.ev(`[].slice.call(document.querySelectorAll('button')).forEach(function (b) { if (b.textContent.trim() === '건너뛰기' && b.offsetParent) { b.click(); } })`); await sleep(1000); }
      for (const sh of SHEETS[g]) {
        if (sh.startsWith('cp:')) {
          const st = sh.slice(3);
          await c.ev(`(function(){ var cp = DG.campaign.state(); if ('${st}' === 'story') { cp.viewCh = cp.ch; } DG.campaignView.show('${st}'); })()`);
        } else { await c.ev(`(DG.ui && DG.ui.openSheet ? DG.ui : DG.uiRtk).openSheet('${sh}')`); }
        await sleep(1500);
        const n = await c.ev(`(function(){ var r = /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u, n = 0; ['sheet', 'encounter', 'campaign'].forEach(function (id) { var e = document.getElementById(id); if (e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0) { Array.from(e.innerText || '').forEach(function (ch) { if (r.test(ch)) { n++; } }); } }); return n; })()`);
        const s = await c.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(OUT, `skin-${g}-${tag}-${sh.replace(':', '-')}.png`), Buffer.from(s.result.data, 'base64'));
        console.log(g, tag, sh, '이모지', n);
      }
    }
    await c.ev(`DG.core.setTune('ui.skin', 1);`);
  } catch (e) { console.log(g, 'ERR', e.message.slice(0, 200)); }
  c.close(); srv.kill();
}
