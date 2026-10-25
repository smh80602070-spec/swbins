// W-0431 3마을 밭 — 새 계정으로 들어가 밭을 일구고 네 칸을 새싹·자람·익음·물 준 빈 두둑으로 두고 그 곁에 서서 PC·폰으로 찍는다.
//   node shot-fo-crops.mjs   → shots/w0431/<pc|phone>.png
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots', 'w0431');
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
    const info = await ev(() => { const V = DG.village, s = V.state(), c = DG.crops.state(); c.tilled = true; c.cells[0] = { from: 'apple', stage: 1, water: s.day }; c.cells[1] = { from: 'apple', stage: 2, water: -1 }; c.cells[2] = { from: 'peach', stage: 3, water: -1 }; c.cells[3] = { from: null, stage: 0, water: s.day }; const R = V.raw(), pl = R.props.filter((q) => q.kind === 'plot'), P = R.player; if (pl[0] && P) { P.x = (pl[0].x + pl[1].x) / 2; P.y = pl[3].y + 45; } return { plots: pl.length, at: pl[0] && [Math.round(pl[0].x), Math.round(pl[0].y)], row: DG.crops.row() }; });
    await sleep(600); await ev(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '-' && x.offsetParent); if (b) { b.click(); } }); await sleep(900);
    const f = path.join(OUT, kind + '.png'); await page.screenshot({ path: f });
    console.log(kind, JSON.stringify(info), 'errors', r.errors.length, f);
  } finally { await r.close(); }
}
await shot('pc'); await shot('phone');
