// 사가블로 건물 실내 창 기계 확인(W-0045) — 2D 모드에서 건물 셋(여관·마방·방앗간)의 실내 창이 열리고 그림 둘(방·앞가림)이 실제로 받아지며,
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다)
// **기계가 한 확인**(D2 기록) — 결과는 콘솔 + results/pw-dg-interior.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const rows = [];
const check = (name, ok, detail) => { rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const r = await open('saga-dungeon', { w: 1280, h: 720 });
const { page } = r, ev = (fn, arg) => page.evaluate(fn, arg);
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(2500);
  for (let i = 0; i < 14; i++) { const o = await ev(() => !!((DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) || (DG.story && DG.story.isOpen && DG.story.isOpen()))); if (!o) { break; } await page.keyboard.press('Escape'); await sleep(400); }
  await ev(() => { const h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } });
  await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } });
  await sleep(3000);
  if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2000); }
  const on = await ev(() => !!(DG.mode2d && DG.mode2d.isOn && DG.mode2d.isOn()));
  check('2D 모드로 들어간다', on);
  for (const key of ['inn', 'stable', 'mill']) {
    const res = await ev(async (k) => {
      const el = document.getElementById('encounter'); el.innerHTML = ''; el.classList.remove('show');
      DG.building.open({ building: k });
      await new Promise((ok) => setTimeout(ok, 600));
      const imgs = [...el.querySelectorAll('.interior img')].map((i) => i.getAttribute('src'));
      const st = await Promise.all(imgs.map((u) => fetch(u).then((x) => x.status).catch(() => 0)));
      const out = { name: DG.building.ROOMS[k].name, shown: el.classList.contains('show') || el.innerHTML.length > 50, imgs: imgs.length, st };
      el.innerHTML = ''; el.classList.remove('show');
      return out;
    }, key);
    check(`실내 창 — ${res.name}: 열리고 그림 ${res.imgs}장이 받아진다`, res.shown && res.imgs >= 1 && res.st.every((s) => s === 200), JSON.stringify(res));
  }
  /* 마을 문간 표식(🚪)이 자리 잡는지는 진단(_test.html "건물 입구" — 마을마다 표식 개수·건물 종류)이 이미 잰다 */
} catch (e) { check('예외 — ' + e.message.slice(0, 80), false); }
const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION|ERR_NAME|ERR_INTERNET/.test(e));
check('페이지 예외 없음', real.length === 0, real.slice(0, 2).join(' | '));
const pass = rows.filter((x) => x.ok).length;
console.log('요약', pass + '/' + rows.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-interior.json', JSON.stringify({ script: 'pw-dg-interior.mjs', game: 'saga-dungeon', pass, total: rows.length, checks: rows }, null, 1) + '\n');
await r.close(); process.exit(pass === rows.length ? 0 : 1);
