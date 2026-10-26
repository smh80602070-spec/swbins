// node saga-web/tools/playcheck/dg-starter-img.mjs — 2나락 출사표(새 계정 첫 화면) 카드 초상이 실제로 뜨나(W-0464)
// 카드마다 img src · 받아졌나(naturalWidth) · 받기 상태(fetch) — 깨진 것만 줄로
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8930, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-dungeon')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/index.html?mode=2d`;
  await c.go(B, 6000);
  await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} if (DG.account && DG.account.create) { DG.account.create('출사표'); } })()`);
  await c.go(B, 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  const r = JSON.parse(await c.ev(`(async function(){ var out = [], cells = [].slice.call(document.querySelectorAll('.stc-cell'));
    for (var i = 0; i < cells.length; i++) { var im = cells[i].querySelector('img'), src = im ? im.getAttribute('src') : '', st = 0;
      if (src) { try { st = (await fetch(src, { method: 'GET' })).status; } catch (e) { st = -1; } }
      out.push({ id: cells[i].getAttribute('data-id'), name: (cells[i].querySelector('b') || cells[i]).textContent.trim().slice(0, 8), src: (src || '').slice(0, 90), w: im ? im.naturalWidth : 0, st: st }); }
    return JSON.stringify({ n: cells.length, bad: out.filter(function (o) { return !o.w || o.st !== 200; }), ok: out.filter(function (o) { return o.w && o.st === 200; }).slice(0, 2) }); })()`));
  console.log('cards', r.n, 'bad', r.bad.length);
  r.bad.forEach((o) => console.log('BAD', o.id, o.name, o.st, o.w, o.src));
  r.ok.forEach((o) => console.log('OK ', o.id, o.name, o.st, o.w, o.src));
} catch (e) { console.log('ERR', e.message); }
c.close(); srv.kill();
