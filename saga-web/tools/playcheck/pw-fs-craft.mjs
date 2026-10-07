// 사가마을 제작대(W-0103) — 실제 판에서 제작대 곁에 서서 ␣ 로 창을 열고, 「짓기」 로 잠자리채를 승급해 3택을 실제로 고른다.
//   node pw-fs-craft.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 준비는 pw-fs-close1 과 같다(새 계정 → title-continue → 마을). 재료·잠자리채는 세이브에 넣고, 몸은 제작대 곁으로 옮긴다(pw-fs-sheet 꼴).
// 사진 셋은 shots/qc/ 에(세션이 Read 로 본다). Math.random 은 진단과 같은 씨앗 mulberry32(20260824).
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-fs-craft.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-forest');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
fs.mkdirSync('shots/qc', { recursive: true });

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3500);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }
  await ev(() => { var h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });

  /* 잠자리채(옛 세이브 모양 true)·재료를 넣고 제작대 곁에 선다 */
  const at = await ev(() => {
    var s = DG.village.state(), R = DG.village.raw(), b = R.props.filter((p) => p.kind === 'bench')[0];
    s.tools.net = true;
    Object.assign(s.bag, { iron: 5, pine: 10, copper: 3, orchid: 2, apple: 6, shard: 3, godung: 2 });
    if (b) { R.player.x = b.x; R.player.y = b.y + 12; }
    return { bench: !!b, x: b && b.x, y: b && b.y };
  });
  await sleep(1200);
  await page.screenshot({ path: 'shots/qc/saga-forest-craft-bench.png' });
  await page.keyboard.press('Space'); await sleep(700);
  const op = await ev(() => { var o = document.getElementById('craft-ov'); return { open: !!(DG.craft && DG.craft.isOpen()), rows: o ? o.querySelectorAll('[data-craft-make]').length : 0, ready: o ? o.querySelectorAll('[data-craft-make]:not([disabled])').length : 0 }; });
  await page.screenshot({ path: 'shots/qc/saga-forest-craft-open.png' });
  check('제작대 — 집 앞 제작대 곁에서 실제 ␣ 로 창이 열리고 레시피 12 줄, 재료가 있는 것만 「짓기」 가 켜진다',
    at.bench && op.open && op.rows === 12 && op.ready >= 2, JSON.stringify({ at, op }));

  /* 잠자리채 Lv2 짓기 → 3택 → 첫 길 고르기 */
  await page.locator('[data-craft-make="net2"]').click(); await sleep(600);
  const p3 = await ev(() => ({ pend: !!DG.craft.pending(), opts: document.querySelectorAll('[data-craft-pick]').length, decline: !!document.querySelector('[data-craft-decline]') }));
  await page.screenshot({ path: 'shots/qc/saga-forest-craft-pick.png' });
  await page.locator('[data-craft-pick="0"]').click(); await sleep(500);
  const done = await ev(() => { var t = DG.craft.rec('net'); return { lv: t.lv, perks: t.perks.slice(), pend: !!DG.craft.pending(), iron: DG.village.state().bag.iron, has: DG.village.hasTool('net') }; });
  check('「짓기」 잠자리채 Lv2 → 3택(길 셋 + 고르지 않기)이 서고, 하나를 실제로 누르면 그 축이 남고 재료가 빠진다',
    p3.pend && p3.opts === 3 && p3.decline && done.lv === 2 && done.perks.length === 1 && !done.pend && done.iron === 2 && done.has, JSON.stringify({ p3, done }));
  await page.locator('[data-craft-close]').click(); await sleep(300);
  check('닫기 — 창이 닫힌다', await ev(() => !DG.craft.isOpen()));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-fs-craft.json', JSON.stringify({ script: 'pw-fs-craft.mjs', game: 'saga-forest', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
