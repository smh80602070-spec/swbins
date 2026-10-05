// 사가고 3D 렌더 예산 측정(W-0067) — 품질 등급(LOW·MEDIUM·HIGH)마다 draw calls·삼각형·프레임 ms·그림자 여부를 잰다.
//   node pw-go-render-budget.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 헤드리스 소프트웨어 렌더(SwiftShader)라 ms 절대값은 높다 — 등급 사이 비교용. 결과 results/pw-go-render-budget.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const r = await open('saga-go', { w: 844, h: 390, mobile: true });   // 폰 가로(dpr 2)
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const rows = [];
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(5000);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(400); }
  await ev(() => { DG.core.setTune('perf.auto', 0); });
  for (const tier of ['LOW', 'MEDIUM', 'HIGH']) {
    await ev((t) => { DG.core.setTune('perf.startTier', t); if (DG.perf && DG.perf.force) { DG.perf.force(t); } }, tier);
    await sleep(3500);
    const m = await ev(() => new Promise((ok) => {
      const gaps = []; let last = 0, n = 0;
      function f(t) { if (last) { gaps.push(t - last); } last = t; if (++n < 12) { requestAnimationFrame(f); } else { const S = DG.world3d.stats(), P = DG.perf.stats(); gaps.sort((a, b) => a - b); ok({ calls: S.gl && S.gl.calls, tris: S.gl && S.gl.tris, size: S.size, ms: Math.round(gaps[Math.floor(gaps.length / 2)]), tier: P.tier, shadow: P.shadow, post: P.post, dpr: window.devicePixelRatio }); } }
      requestAnimationFrame(f);
    }));
    rows.push({ want: tier, ...m }); console.log(JSON.stringify({ want: tier, ...m }));
  }
} catch (e) { console.log('ERR', e.message); }
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-go-render-budget.json', JSON.stringify({ script: 'pw-go-render-budget.mjs', game: 'saga-go', rows }, null, 1) + '\n');
await r.close(); process.exit(0);
