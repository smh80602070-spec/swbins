// W-0420 ① 1만리 종 연구 — 새 계정으로 들어가 연구 몇 줄을 심고 도감(dex) 창을 PC·폰 두 장으로 찍는다.
//   node shot-go-study.mjs   → shots/w0420/study-pc.png · study-phone.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0420');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-go', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(r.url('index.html')); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); });
    await sleep(500);
    const info = await ev(() => {
      const R = DG.speciesStudy; R.record('boar', ['weak', 'react']); for (let i = 0; i < 3; i++) { R.record('imp', ['weak', 'react', 'parried', 'thrown']); } R.record('rex', ['parried']);
      const b = document.querySelector('#dock button[data-sheet="dex"]'); if (b) { b.click(); }
      return { ok: !!b };
    });
    await sleep(900);
    await ev(() => { const s = [...document.querySelectorAll('#sheet-body h4')].find((h) => /짐승 연구/.test(h.textContent)); if (s) { s.scrollIntoView({ block: 'start' }); } });
    await sleep(400);
    const f = path.join(OUT, 'study-' + kind + '.png');
    await page.screenshot({ path: f });
    console.log(kind, JSON.stringify(info), 'errors', r.errors.length, f);
    if (r.errors.length) { console.log(r.errors.slice(0, 3).join('\n')); }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
