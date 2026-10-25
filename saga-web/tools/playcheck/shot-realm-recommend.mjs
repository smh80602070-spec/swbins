// W-0424 5천하 인재 천거 — 새 계정으로 들어가 천거가 서는 달로 monthly 를 한 번 부르고(충성·숨은 재야를 맞춰 둠) 「이번 달」 창을 PC·폰으로 찍는다.
//   node shot-realm-recommend.mjs   → shots/w0424/<pc|phone>-goals.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0424');
fs.mkdirSync(OUT, { recursive: true });

async function shot(kind) {
  const phone = kind === 'phone';
  const r = await open('saga-realm', { w: phone ? 390 : 1280, h: phone ? 844 : 720, mobile: phone });
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  try {
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html'), { timeout: 90000 }); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    await ev(() => { document.querySelectorAll('#help-ok').forEach((b) => b.offsetParent && b.click()); });
    await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);
    await page.locator('[data-act="pick-force"]').first().click(); await sleep(2500);
    for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    const info = await ev(() => {
      const RC = DG.recommend, R = DG.rtk, O = DG.off, st = R.state(), mine = O.ofForce(R.me()), cities = R.citiesOf(R.me());
      let m = 0; while (!RC.rolls(m)) { m++; }
      mine.forEach((h) => { O.rec(h.id).loyal = Math.max(O.rec(h.id).loyal || 0, 70); });
      const free = Object.keys(st.officers).filter((id) => { const r = st.officers[id]; return !r.force && !r.dead; })[0]; const fr = O.rec(free); fr.city = cities[0]; fr.found = false;
      const got = RC.monthly(m); DG.goalsPanel.open();
      return { m, got: got && got.text };
    });
    await sleep(600);
    const f1 = path.join(OUT, kind + '-goals.png'); await page.screenshot({ path: f1 });
    console.log(kind, JSON.stringify(info), 'errors', r.errors.length, f1);
    if (r.errors.length) { console.log(r.errors.slice(0, 3).join('\n')); }
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
