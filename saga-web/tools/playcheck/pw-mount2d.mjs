// W-0497 2D 탈것 확인 그림 — 2나락 마을에서 탈것(말·학·용)을 타고 한 장씩 찍는다.  node pw-mount2d.mjs <저장 폴더>
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const dest = process.argv[2] || 'shots/mount2d';
const r = await open('saga-dungeon', { w: 1280, h: 720 });
const { page } = r; const ev = (fn, a) => page.evaluate(fn, a);
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
  await clearOverlays(page, 'saga-dungeon', { keep: [] });
  await ev(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(3000);
  if (await ev(() => DG.dungeon3d && DG.dungeon3d.wanted())) { await ev(() => document.getElementById('btn-3d').click()); await sleep(2500); }
  for (let i = 0; i < 4; i++) { await ev(() => { document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent)) { b.click(); } }); }); await sleep(400); }
  await ev(() => { DG.core.save.player.level = 40; DG.core.setTune('mount2d.on', 1); });
  await ev(() => { const a = DG.actor2d.draw; window.__ad = []; DG.actor2d.draw = function (c, role) { window.__ad.push(role + ':' + (DG.mount.current() && DG.mount.current().id) + ':' + DG.core.tuned('mount2d.on', 0)); return a.apply(this, arguments); }; });
  const fs = await import('node:fs'); fs.mkdirSync(dest, { recursive: true });
  for (const id of ['mt_white', 'mt_crane', 'mt_dragon']) {
    const res = await ev((i) => { DG.mount.dismount(); const x = DG.mount.ride(i); return JSON.stringify([x, DG.mount.current() && DG.mount.current().id]); }, id);
    console.log(id, res); await sleep(1800);
    await page.screenshot({ path: `${dest}/${id}.png` }); console.log(await ev(() => JSON.stringify([...new Set(window.__ad)].slice(0, 6) + ' | ' + DG.mode2d.draw(document.createElement('canvas').getContext('2d'), { pool: DG.mount.current().id, clip: 'idle', facing: 1, ms: 0, x: 50, y: 50, scale: 1 }))));
  }
} finally { await r.close(); }
