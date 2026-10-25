// W-0415 3마을 3D 흙길(광장) 칸 path_grass(K-0193) 전후 사진 — 손잡이 village3d.pathGrass 0(옛 흙 사진)·1 두 장. 첫 흙길 칸 곁으로 옮겨 찍는다.
//   node fs-pathgrass.mjs [저장 폴더]   (서버 :8871 — PW_BASE 로 바꿀 수 있다)
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const out = process.argv[2] || '.';
for (const pg of [0, 1]) {
  const r = await open('saga-forest', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
  const ev = (fn, a) => r.page.evaluate(fn, a);
  try {
    await r.page.addInitScript(() => { document.hasFocus = () => true; });
    await r.page.goto(r.url('index.html')); await sleep(1500);
    await ev((k) => { DG.account.create('광장'); DG.core.setTune('village3d.pathGrass', k[0]); DG.core.setTune('village3d.on', 1); String(k[1] || '').split(',').filter(Boolean).forEach((kv) => { const p = kv.split(':'); DG.core.setTune(p[0], +p[1]); }); if (DG.deviceMode && DG.deviceMode.mark) { DG.deviceMode.mark('vv', true); } }, [pg, process.env.FS_TUNE || '']);
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await clearOverlays(r.page, 'saga-forest', { keep: [] });
    await sleep(5000);
    await r.page.screenshot({ path: out + '/fs_pathgrass_' + (process.env.FS_TUNE ? 'x_' : '') + pg + '.png' });
    const st = await ev(() => ({ d3: !!(DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active()), pg: DG.core.tuned('village3d.pathGrass', 1) }));
    console.log(JSON.stringify({ pg, st, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
  } finally { await r.close(); }
}
