// 사가만리 렌더 루프 측정(W-0066) — 다섯 상태에서 1초당 rAF 콜백 수·이름과 렌더 패스 수(gl.clear)를 잰다.
//   node pw-go-loops.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
//   사가만리 전용(시트·결투·2D 끄기 훅이 사가만리 것). 번들 상태라 루프 이름이 줄어 보인다(예: p).
// **기계가 한 확인**(D2 기록) — 결과는 콘솔 + results/pw-<판>-loops.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const game = 'saga-go';
const r = await open(game);
const { page } = r;
await page.addInitScript(() => {
  window.__loops = { raf: {}, render: 0, patched: false };
  const orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => orig((t) => { const k = cb.name || 'anon'; window.__loops.raf[k] = (window.__loops.raf[k] || 0) + 1; return cb(t); });
  /* three 의 render 는 인스턴스 함수라 감싸기 어렵다 — 렌더 한 번마다 부르는 gl.clear 를 센다(렌더 패스 수의 대용) */
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) { continue; }
    const o = C.prototype.clear; C.prototype.clear = function () { window.__loops.render++; return o.apply(this, arguments); };
  }
  window.__loops.patched = true;
});
const ev = (fn, arg) => page.evaluate(fn, arg);
const rows = [];

async function boot() {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(5000);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(400); }
}
async function sample(name, ms = 3000) {
  await ev(() => { window.__loops.raf = {}; window.__loops.render = 0; });
  await sleep(ms);
  const s = await ev(() => ({ raf: window.__loops.raf, render: window.__loops.render, patched: window.__loops.patched, hidden: document.hidden }));
  const total = Object.values(s.raf).reduce((a, b) => a + b, 0), sec = ms / 1000;
  const row = { state: name, rafPerSec: Math.round(total / sec * 10) / 10, renderPerSec: Math.round(s.render / sec * 10) / 10, loops: Object.fromEntries(Object.entries(s.raf).map(([k, v]) => [k, Math.round(v / sec * 10) / 10])) };
  rows.push(row); console.log(JSON.stringify(row));
  return row;
}

try {
  await boot();
  const gl = await ev(() => !!(DG.world3d && DG.world3d.active && DG.world3d.active()));
  console.log('3D 켜짐', gl);
  await sample('① 마을 대기');
  await ev(() => { DG.ui.openSheet('quest'); }); await sleep(800);
  await sample('② 시트(메뉴) 열림');
  await ev(() => { DG.ui.closeSheet(); });
  await ev(() => { DG.core.setTune('world.render3d', 0); }); await sleep(2500);
  await sample('③ 2D 모드(3D 끔)');
  await ev(() => { DG.core.setTune('world.render3d', 1); }); await sleep(3000);
  await ev(() => { DG.duel.open({ foeHp: 3000, myAtk: 80, myDef: 500, foeName: '시험', onDone: function () {} }); }); await sleep(800);
  await sample('④-1 결투 중');
  await ev(() => { const b = document.querySelector('[data-d="flee"]'); if (b) { b.click(); } }); await sleep(1500);
  await ev(() => { const o = document.querySelector('.duel-ok, #duel-ok, [data-d="ok"]'); if (o) { o.click(); } });
  await sleep(1500);
  await sample('④ 결투 끝난 뒤');
  /* ⑤ 탭 숨김 — visibility 를 흉내 낸다(헤드리스 크롬은 진짜 숨김이 없다): document.hidden=true + 이벤트 */
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(1200);
  await sample('⑤ 탭 숨김');
} catch (e) { console.log('ERR', e.message); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET/.test(e));
console.log('페이지 예외·console.error:', real.length ? real.slice(0, 3).join(' | ') : '없음');
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync(`results/pw-${game}-loops.json`, JSON.stringify({ script: 'pw-go-loops.mjs', game, rows, pageErrors: real }, null, 1) + '\n');
await r.close();
process.exit(0);
