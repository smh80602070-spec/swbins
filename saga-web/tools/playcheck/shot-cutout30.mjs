// W-0402 ⑥ 확인 — K-0188 ② 손그림 컷아웃 주역 30명이 실제 서버(shared 그림)에서 cutout2d 로 서는지 한 장에(게임 풀 꼴 'vroid:<id>~0' 그대로).
//   node saga-web/tools/playcheck/shot-cutout30.mjs [판=saga-go]   → shots/cutout30/<판>.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'cutout30'); fs.mkdirSync(OUT, { recursive: true });
const game = process.argv[2] || 'saga-go';
const r = await open(game, { w: 1280, h: 720 });
const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
try {
  await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
  const ids = await ev(() => new Promise((res) => { const x = new XMLHttpRequest(); x.open('GET', DG.cutout2d.base() + 'index.json'); x.onload = () => res(Object.keys(JSON.parse(x.responseText).pools)); x.onerror = () => res([]); x.send(); }));
  const draw = () => ev((L) => {
    let c = document.getElementById('cut30'); if (!c) { c = document.createElement('canvas'); c.id = 'cut30'; c.width = 1280; c.height = 720; c.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#2a3a2a'; document.body.appendChild(c); }
    const g = c.getContext('2d'); g.clearRect(0, 0, 1280, 720); g.font = '11px sans-serif'; g.textAlign = 'center';
    let ok = 0; L.forEach((id, i) => { const x = 64 + (i % 10) * 120, y = 220 + Math.floor(i / 10) * 230; g.fillStyle = '#556'; g.fillRect(x - 50, y, 100, 2);
      if (DG.cutout2d.drawFor(g, { pool: 'vroid:' + id + '~0', clip: 'idle', t: 0, x, y, facing: 1 }, 180)) { ok++; } g.fillStyle = '#eee'; g.fillText(id, x, y + 16); });
    return ok;
  }, ids);
  let ok = 0; for (let k = 0; k < 8 && ok < ids.length; k++) { ok = await draw(); await sleep(1000); } ok = await draw(); await sleep(300);   // 첫 그리기는 index·rig·그림을 받으러 감
  const f = path.join(OUT, game + '.png'); await page.screenshot({ path: f });
  console.log(game, 'pools', ids.length, 'drawn', ok, 'errors', r.errors.length, f, r.errors.slice(0, 3).join(' | ').slice(0, 300));
} finally { await r.close(); }
