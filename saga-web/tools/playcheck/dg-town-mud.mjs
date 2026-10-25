// W-0415 2나락 3D 마을 바닥 진흙 자갈 섞음 결(mud_gravel, K-0193) 전후 사진 — 손잡이 dungeon3d.townMud 0(옛 dg_town_dirt)·1 두 장.
//   node dg-town-mud.mjs [저장 폴더]   (서버 :8871 — PW_BASE 로 바꿀 수 있다)
import { open, sleep } from './pw.mjs';
const out = process.argv[2] || '.';
for (const mud of [0, 1]) {
  const r = await open('saga-dungeon', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
  const ev = (fn, a) => r.page.evaluate(fn, a);
  try {
    await r.page.addInitScript(() => { document.hasFocus = () => true; });
    await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
    await ev((k) => { try { localStorage.clear(); } catch (e) { /* */ } DG.account.create('마을'); DG.core.setTune('dungeon3d.townMud', k); }, mud);
    await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(3500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
    await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(4000);
    for (let i = 0; i < 10; i++) { await ev(() => { if (DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) { DG.scenario.skip(); } document.querySelectorAll('button').forEach((b) => { if (/건너뛰기|닫기|확인/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
    await sleep(4000);
    await r.page.screenshot({ path: out + '/dg_town_mud_' + mud + '.png' });
    const st = await ev(() => ({ pg: DG.pbrground3d.stats(), mud: DG.core.tuned('dungeon3d.townMud', 1) }));
    console.log(JSON.stringify({ mud, st, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
  } finally { await r.close(); }
}
