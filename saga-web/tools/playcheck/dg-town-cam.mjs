// 2나락 마을 첫 화면 카메라·시작 자리 탐침 — 사용자 1911×917 화면 재현(사용자 10-17 "카메라 앵글·시작 자리")
//   node dg-town-cam.mjs [w h]   → shots/dg_town_cam_<w>.png + 카메라 값
import { open, sleep } from './pw.mjs';
const W = +(process.argv[2] || 1911), H = +(process.argv[3] || 917), ZM = process.argv[4] ? +process.argv[4] : null;
const r = await open('saga-dungeon', { w: W, h: H });
try {
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(1500);
  await r.page.evaluate(() => { try { localStorage.clear(); } catch (e) {} DG.account.create('카메라'); });
  await r.page.goto(r.url('index.html'), { waitUntil: 'domcontentloaded' }); await sleep(3500);
  await r.page.evaluate(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(2500);
  await r.page.evaluate(() => { [...document.querySelectorAll('.stc-cell')].slice(0, 3).forEach((c) => c.click()); const b = document.querySelector('.stc-btn'); if (b) { b.click(); } }); await sleep(4000);
  for (let i = 0; i < 10; i++) { await r.page.evaluate(() => { if (DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen()) { DG.scenario.skip(); } document.querySelectorAll('button').forEach((b) => { if (/건너뛰기/.test(b.textContent) && b.offsetParent) { b.click(); } }); }); await sleep(300); }
  if (ZM) { await r.page.evaluate((z) => { DG.core.save.settings.camZoom = z; }, ZM); }
  await sleep(3000);
  const info = await r.page.evaluate(() => {
    const T = DG.town, run = T.overworld ? null : null, me = T.me && T.me();
    const C = DG.core, n = DG.dungeon3d.camNode();
    return {
      me, anchor: T.anchorOf ? T.anchorOf('moru') : null, roomW: T.ROOM_W, roomH: T.ROOM_H,
      belt: C.tuned('dungeon3d.belt', 1), beltTown: C.tuned('dungeon3d.beltTown', 1), beltTownPitch: C.tuned('dungeon3d.beltTownPitch', 40), beltDist: C.tuned('dungeon3d.beltDist', 340),
      cam: n ? { x: Math.round(n.position.x), y: Math.round(n.position.y), z: Math.round(n.position.z), fov: n.fov, aspect: +n.aspect.toFixed(2) } : null,
      meScreen: DG.dungeon3d._meScreen ? DG.dungeon3d._meScreen() : null,
      marks: T.MARKS ? Object.keys(T.MARKS).slice(0, 12) : null
    };
  });
  console.log(JSON.stringify(info));
  await r.page.screenshot({ path: `shots/dg_town_cam_${W}${ZM ? "_z" + ZM : ""}.png` });
  console.log('shot', `shots/dg_town_cam_${W}${ZM ? "_z" + ZM : ""}.png`);
} catch (e) { console.log('ERR', e.message); }
await r.close();
