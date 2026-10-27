// W-0476 3마을 낚시 대회 — 새 계정으로 들어가 대회 날(fo.derby 2)로 두 마리 낚은 셈을 넣고 「오늘」 창을 PC·폰으로 찍는다.
//   node shot-fo-miles.mjs   → shots/w0476/<pc|phone>.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0476');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-forest', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r; page.on('console', (m) => { if (/MILESSEC/.test(m.text())) console.log(m.text()); }); const ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    const info = await ev(() => { DG.core.setTune('fo.derby', 2); DG.fishDerby.onCatch(0, 1000); DG.fishDerby.onCatch(0, 1000); DG.fishDerby.onCatch(0, 1000); DG.goalsPanel.open(); return { claim: DG.goalsAdapter.model().claim && DG.goalsAdapter.model().claim.hint }; });
    await sleep(800);
    const f = path.join(OUT, kind + '.png'); await page.screenshot({ path: f }); await ev(() => { DG.miles.earn(DG.goalsAdapter.model().today); DG.goalsPanel.close(); DG.ui.openSheet('bag'); const sc = document.querySelector('.sheet-body,.sheet'); if (sc) { const h = [...document.querySelectorAll('h4')].find((x) => /마일 교환/.test(x.textContent)); console.log('MILESSEC', !!h, document.querySelectorAll('[data-act=v-mbuy]').length); if (h) { h.scrollIntoView(); } } }); await sleep(800); console.log('MILESSEC', JSON.stringify(await ev(() => ({ sec: [...document.querySelectorAll('h4')].some((x) => /마일 교환/.test(x.textContent)), btn: document.querySelectorAll('[data-act=v-mbuy]').length })))); await page.screenshot({ path: path.join(OUT, kind + '-sheet.png') });
    console.log(kind, JSON.stringify(info), 'errors', r.errors.length, f);
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
