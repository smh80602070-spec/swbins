// W-0434 탄 모습 촬영 — 1만리 3D 에서 탈것(말·학)에 올라 Pose_ride·안장 높이를 옆에서 한 장씩. 기수 엉덩이–등 간격도 잰다.
//   node shot-ride.mjs [접두어=ride] [탈것 id,…=mt_brown,mt_crane]   → shots/<접두어>_<id>.jpg · 콘솔 JSON
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 새 프로필, 끝나면 닫는다.
import { open, sleep } from './pw.mjs';
import { wantGpu } from './cdp.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tag = process.argv[2] || 'ride', list = (process.argv[3] || 'mt_brown,mt_crane').split(',');
const r = await open('saga-go', { w: 1280, h: 720, gpu: wantGpu() });
const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('탈것'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(6000);
  for (let i = 0; i < 12; i++) { const k = await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); if (!k) { break; } await page.keyboard.press('Escape'); await sleep(250); }
  for (let i = 0; i < 30 && !(await ev(() => !!(DG.world3d && DG.world3d.actorNode && DG.world3d.actorNode('me')))); i++) { await sleep(1000); }
  await ev(() => { DG.core.setTune('world3d.camDist', 9); DG.core.save.player.level = 60; });
  for (const id of list) {
    const got = await ev((i) => { if (DG.mount.active()) { DG.mount.dismount(''); } const r = DG.mount.ride(i); const p = DG.core.save.player.pos; if (DG.world3d.faceTo) { DG.world3d.faceTo(p.x + 30, p.y + 4, 20000); } return r && r.ok; }, id);
    await sleep(4000);   // 탈것 GLB 받기·블렌드
    const m = await ev(() => { const T = THREE, me = DG.world3d.actorNode('me'); let mt = null; DG.world3d.actorNode && (mt = DG.world3d.actorNode('mount:' + (DG.mount.petRef() || {}).id)); const P3 = DG.pose3d, s = mt && P3.seatOf ? P3.seatOf(mt) : null; const hips = me && me.getObjectByName('J_Bip_C_Hips'); const back = s && mt ? mt.localToWorld(new T.Vector3(s.x, s.y, s.z)).y : null; return { clip: me && me.userData.curAct ? me.userData.curAct.getClip().name : null, hipsY: hips ? +hips.getWorldPosition(new T.Vector3()).y.toFixed(3) : null, back: back === null ? null : +back.toFixed(3), mountNode: !!mt }; });
    const f = path.join(HERE, 'shots', tag + '_' + id + '.jpg'); await page.screenshot({ path: f, type: 'jpeg', quality: 82 });
    console.log(id, 'ride', got, JSON.stringify(m), f);
  }
  console.log('errors', r.errors.length, r.errors.slice(0, 2).join(' | ').slice(0, 200));
} finally { await r.close(); }
