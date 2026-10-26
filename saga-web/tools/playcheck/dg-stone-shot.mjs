// node saga-web/tools/playcheck/dg-stone-shot.mjs [폭 높이] → shots/dg-stone-{off,on}-{gear,craft,vendor,dead}.png
// W-0469 2나락 UI 「乙 새긴 돌판」 전후 — 손잡이 ui.stone 0(전)·1(후)로 같은 창 넷을 찍는다 + 창 안 이모지 수
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 720);
const PORT = 8931, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-dungeon')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(W, H);
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const EMO = `/[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u`;
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/index.html?mode=2d`;
  await c.go(B, 6000);
  await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} if (DG.account && DG.account.create) { DG.account.create('돌판'); } })()`);
  for (const tag of ['off', 'on']) {
    await c.go(B, 8000);
    await c.ev(`DG.core.setTune('ui.stone', ${tag === 'on' ? 1 : 0}); DG.core.persist && DG.core.persist();`);
    await c.go(B, 8000);
    await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
    await sleep(4000);
    for (let k = 0; k < 6; k++) {
      await c.ev(`(function(){ var c = document.querySelectorAll('.stc-cell'); if (c.length) { for (var i = 0; i < 3 && i < c.length; i++) { c[i].click(); } var b = document.querySelector('.stc-btn'); if (b) { b.click(); } }
        [].slice.call(document.querySelectorAll('button')).forEach(function (b) { if (b.textContent.trim() === '건너뛰기' && b.offsetParent) { b.click(); } }); })()`);
      await sleep(1200);
    }
    for (const sh of ['gear', 'craft', 'vendor', 'dead']) {
      if (sh === 'dead') { await c.ev(`(function(){ DG.ui.closeSheet && DG.ui.closeSheet(); DG.core.emit('goals:card', { reason: 'dead', floor: 3, lostGold: 120, lostItems: 2 }); })()`); }
      else { await c.ev(`DG.ui.openSheet('${sh}')`); }
      await sleep(1200);
      const n = await c.ev(`(function(){ var r = ${EMO}, n = 0; ['sheet', 'encounter'].forEach(function (id) { var e = document.getElementById(id); if (e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0) { Array.from(e.innerText || '').forEach(function (ch) { if (r.test(ch)) { n++; } }); } }); return n; })()`);
      const s = await c.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `dg-stone-${tag}-${sh}.png`), Buffer.from(s.result.data, 'base64'));
      console.log(tag, sh, '이모지', n);
      if (sh === 'dead') { await c.ev(`(function(){ var b = document.querySelector('#encounter .btn'); if (b) { b.click(); } })()`); }
    }
  }
  await c.ev(`DG.core.setTune('ui.stone', 1);`);
} catch (e) { console.log('ERR', e.message); }
c.close(); srv.kill();
