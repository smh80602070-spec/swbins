// 5천하 턴제 전투 화면 촬영(사용자 10-26 「턴방식 화면 수정해줘 누가 이거 보고 하게?」) — 장 흐름 1장 → 출진 → 막 걷힘 → 처음 · 내 장수 고름 · 한 번 공격 뒤
//   node realm-battle-shot.mjs [저장 폴더] [2d|3d] [W=1280] [H=720]   (서버 :8871) → cpb_<모드>_<W>_{0,sel,hit}.png
import { open, sleep } from './pw.mjs';
const out = process.argv[2] || '.', mode = process.argv[3] || '2d', W = +(process.argv[4] || 1280), H = +(process.argv[5] || 720);
const r = await open('saga-realm', { w: W, h: H, mobile: W < 600, gpu: true });
const ev = (f, a) => r.page.evaluate(f, a);
const click = (s) => ev((x) => { const b = document.querySelector(x); if (b) { b.click(); return true; } return false; }, s);
const shot = (n) => r.page.screenshot({ path: `${out}/cpb_${mode}_${W}_${n}.png` });
try {
  await r.page.goto(r.url('index.html?mode=' + mode), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await ev(() => { localStorage.clear(); DG.account.create('전투화면'); });
  await r.page.goto(r.url('index.html?mode=' + mode), { waitUntil: 'domcontentloaded' }); await sleep(2500);
  await click('#title-continue'); await sleep(2000);
  await r.page.locator('[data-act="pick-scen"]').first().click(); await sleep(600);
  await r.page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);
  await click('.cpg-node.now'); await sleep(500); await click('[data-cp="choose"]'); await sleep(500); await click('[data-cp="go"]');
  for (let i = 0; i < 30 && await ev(() => !!(DG.zoneCut && DG.zoneCut.shown())); i++) { await sleep(500); }
  await sleep(1500); await shot('0');
  const sel = await ev(() => { const v = DG.tacticsView && DG.tacticsView._cur ? DG.tacticsView._cur() : null; const g = document.querySelector('#cpg-tac [data-uid]'); return g ? g.getAttribute('data-uid') : null; });
  await ev(() => { const me = [...document.querySelectorAll('#cpg-tac [data-uid]')]; const t = me.find((e) => /me|blue|#4/.test(e.outerHTML)) || me[me.length - 1]; if (t) { t.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  await sleep(600); await shot('sel');
  console.log('OK', sel);
} catch (e) { console.log('ERR', e.message.slice(0, 300)); }
console.log('errors', JSON.stringify(r.errors.filter((e) => !/404/.test(e)).slice(0, 3)));
await r.close();
