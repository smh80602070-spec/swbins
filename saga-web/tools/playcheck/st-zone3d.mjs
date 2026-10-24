// W-0414 4종횡 3D 무대 넘김 탐침 — 3D 로 사냥터에 들어가 travel(다음 무대) → 0.05·0.4·1·2·4초에 막 불투명도·three 받는 중·3D 무대 키, 걷힌 뒤 사진.
//   node st-zone3d.mjs [저장 폴더]   (서버 :8871)
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const out = process.argv[2] || '.';
const r = await open('saga-story', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
const ev = (fn, a) => r.page.evaluate(fn, a);
try {
  await r.page.addInitScript(() => { document.hasFocus = () => true; });
  await r.page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('무대'); });
  await r.page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
  await clearOverlays(r.page, 'saga-story', {});
  const d3 = await ev(() => !!(DG.sideView3d && DG.sideView3d.ready && DG.sideView3d.ready()));
  const from = await ev(() => DG.side._run().stage.key);
  const to = await ev(() => { const R = DG.side._run(), p = (R.stage.portals || [])[0]; if (!p) { return null; } DG.side.travel(p[1]); return DG.side._run().stage.key; });
  const dbg = await ev(() => { const S3 = DG.sideView3d; return { ready: S3.ready(), tb: DG.zoneCut.threeBusy(), busy: DG.zoneCut._busy(), shown: DG.zoneCut.shown(), n: document.querySelectorAll('#zone-cut2').length }; });
  const t0 = Date.now(), seq = [dbg];
  for (const ms of [50, 400, 1000, 2000, 4000]) { await sleep(Math.max(0, ms - (Date.now() - t0))); seq.push(ms + 'ms 막 ' + await ev(() => { const e = document.getElementById('zone-cut2'); return e ? (+getComputedStyle(e).opacity).toFixed(2) : '없음'; }) + ' 받는중 ' + await ev(() => DG.zoneCut.threeBusy())); if (ms === 400) { await r.page.screenshot({ path: out + '/st_zone_mid.png' }); } }
  await r.page.screenshot({ path: out + '/st_zone_after.png' });
  console.log(JSON.stringify({ d3, from, to, seq, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
} finally { await r.close(); }
