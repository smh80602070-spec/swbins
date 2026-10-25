// W-0426 1만리 들판 수수께끼 — 새 계정으로 들어가 지금 구역의 꽃 고리·바람개비·돌 곁으로 옮겨 2D 그림을 PC·폰으로 찍는다.
//   node shot-go-riddle.mjs   → shots/w0426/<pc|phone>-<stone|ring|pin>.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0426');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-go', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  const snap = async (n) => { const f = path.join(OUT, kind + '-' + n + '.png'); await page.screenshot({ path: f }); return f; };
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    const out = [];
    for (const k of ['ring', 'pin', 'stone']) {
      const info = await ev((k) => { const sv = DG.core.save; sv.settings = sv.settings || {}; sv.settings.autoBattle = false; if (sv.auto) { sv.auto.on = false; } const p = sv.player.pos, FR = DG.fieldRiddle, r = FR.near(p.x, p.y).filter((q) => q.kind === k)[0]; if (!r) { return null; } const kd = DG.fieldCombat.KDVf() || 1; p.x = r.x + (k === 'ring' ? 0 : 3.5 * kd); p.y = r.y + (k === 'ring' ? 0.5 * kd : 0); return { id: r.id }; }, k);
      await sleep(1200); out.push(k + ':' + JSON.stringify(info) + ' ' + await snap(k));
    }
    const st = { seeds: await ev(() => DG.fieldRiddle.seeds()) };
    console.log(kind, JSON.stringify(st), 'errors', r.errors.length, out.join(' | '));
    if (r.errors.length) { console.log(r.errors.slice(0, 3).join('\n')); }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
