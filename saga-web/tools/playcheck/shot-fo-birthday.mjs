// W-0427 3마을 주민 생일 — 새 계정으로 들어가 첫 주민 생일 날로 붙들고 주민 창(🎂)·「오늘」 창을 PC·폰으로 찍는다.
//   node shot-fo-birthday.mjs   → shots/w0427/<pc|phone>.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0427');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-forest', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    for (let i = 0; i < 6; i++) { await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    const info = await ev(() => { const s = DG.village.state(), id = DG.village.raw().residents[0].id, b = DG.birthday.of(id); s.day = Date.UTC(2026, b.m - 1, b.d) / 86400000; DG.birthday.onDay(s.day); return { id, b, today: DG.birthday.todays(), row: DG.birthday.row() }; });
    for (const tab of ['folks', 'goals']) {
      await ev((t) => { if (t === 'goals') { DG.ui.closeSheet(); DG.goalsPanel.open(); } else { DG.ui.openSheet('folks'); } }, tab); await sleep(900);
      const f = path.join(OUT, kind + '-' + tab + '.png'); await page.screenshot({ path: f });
      console.log(kind, tab, JSON.stringify(info), 'errors', r.errors.length, f);
    }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
