// W-0303 모션 묶음 1 촬영 — 1만리 3D 에서 내 몸에 Pose_ 자세를 차례로 걸고(world3d.playAnim) 한 장씩 찍는다.
//   node pose-shot.mjs [접두어] [자세,자세…]   → shots/<접두어>_<자세>.jpg · 콘솔 JSON(자세마다 실제 튼 클립 이름)
// 서버: node serve.mjs C:/swbins/saga-web 8871 (돌리는 쪽이 띄우고 끈다). 크롬은 pw.mjs 의 새 프로필, 끝나면 닫는다.
// 카메라는 가까이(world3d.camDist 손잡이 POSE_CAM, 기본 9m) — 몸짓이 보이게.
// W-0316 — 실제 GPU 로 열고(PW_GPU=0 이면 swiftshader), 모든 자세를 pose3d.EXPECT 시점에 멈춰 세운다(반복 클립도 — fps 와 무관하게 같은 자세).
//   멈춘 자세에서 실제 VRoid 몸 뼈를 재(pose3d.measure) 기대 범위와 견준다(pose3d.check) → results/pose-shot.json { at, gpu, rest, poses:[{pose, ok, bad, r}], fail }
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';
import { wantGpu, gpuInfo } from './cdp.mjs';

const tag = process.argv[2] || 'pose', FACE = +(process.env.POSE_FACE || 1);   // POSE_FACE=-1 이면 왼쪽을 본다(오른팔이 카메라 쪽)
const list = (process.argv[3] || 'Pose_sit,Pose_warm,Pose_pick,Pose_lean,Pose_heavy,Pose_cast,Pose_block,Pose_wave,Pose_fish,Pose_idle_scratch,walk,run').split(',');
const AT = { Pose_pick: 0.45, Pose_heavy: 0.5, Pose_cast: 0.62, Pose_wave: 0.4, Pose_idle_scratch: 0.45 };   // 한 번 도는 자세는 가장 잘 보이는 순간(클립 길이 비)
const r = await open('saga-go', { w: +(process.env.GW || 1280), h: +(process.env.GH || 720), gpu: wantGpu() });
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const out = { shots: [] };
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('몸짓'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(6000);
  for (let i = 0; i < 12; i++) { const k = await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); if (!k) { break; } await page.keyboard.press('Escape'); await sleep(250); }
  await ev((d) => { DG.core.setTune('world3d.camDist', d); DG.core.setTune('pose3d.sitAfter', 999); }, +(process.env.POSE_CAM || 9));
  await sleep(1500);
  out.gpu = await gpuInfo(page);
  /* 선 자세에서 머리 높이·앞 방향 부호 한 번 */
  await ev(() => { DG.world3d.playAnim('me', 'idle', 10); }); await sleep(900);
  out.rest = await ev(() => { const n = DG.world3d.actorNode('me'); return n && DG.pose3d.restOf ? DG.pose3d.restOf(n) : null; });
  for (const nm of list) {
    const dur = await ev((n) => (DG.pose3d && DG.pose3d.durOf(n)) || 1, nm);
    const ms = Math.round(dur * 1000) + 4000;
    await ev(([n, m, fc]) => { const p = DG.core.save.player.pos, W = DG.world3d; if (W.faceTo) { W.faceTo(p.x + 30 * fc, p.y + 4, m); } W.playAnim('me', n, m); }, [nm, ms, FACE]);
    await sleep(1600);   // 블렌드가 다 들어갈 때까지
    /* 헤드리스는 느려(5fps) 찍는 사이 한 번 도는 클립이 끝난다 — 가장 잘 보이는 순간에 액션을 멈춰 세운다 */
    const atK = await ev((n) => (DG.pose3d && DG.pose3d.EXPECT && DG.pose3d.EXPECT[n] ? DG.pose3d.EXPECT[n].at : null), nm) || AT[nm] || 0.5;   // 걷기·달리기도 반 바퀴에 멈춰 세운다(두 번 찍어도 같게)
    if (atK) { await ev(([k]) => { const d = DG.world3d.actorNode('me').userData, a = d.curAct; if (a) { a.time = a.getClip().duration * k; a.paused = true; if (d.mixer) { d.mixer.update(0); } } }, [atK]); await sleep(700); }
    const judged = await ev(([n, rest]) => { const P3 = DG.pose3d, node = DG.world3d.actorNode('me'); if (!P3 || !P3.check || !rest) { return null; } const rr = P3.measure(node, rest); const k = P3.check(n, rr); return k ? { ok: k.ok, bad: k.bad, r: rr } : null; }, [nm, out.rest]);
    const u = await ev(() => { const n = DG.world3d.actorNode('me'), d = n && n.userData; return d ? { anim: d.anim, clip: d.curAct && d.curAct.getClip ? d.curAct.getClip().name : null, own: !!d.ownBody } : null; });
    const path = `shots/${tag}_${nm}.jpg`;
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
    out.shots.push({ pose: nm, path, u, judged });
    await ev(() => { const d = DG.world3d.actorNode('me').userData; if (d.curAct) { d.curAct.paused = false; } DG.world3d.playAnim('me', 'idle', 10); });
    await sleep(500);
  }
  out.errors = r.errors.slice(0, 4);
  out.poses = out.shots.filter((x) => x.judged).map((x) => ({ pose: x.pose, ok: x.judged.ok, bad: x.judged.bad, r: x.judged.r, clip: x.u && x.u.clip }));
  out.fail = out.poses.filter((x) => !x.ok).length;
  fs.mkdirSync('results', { recursive: true }); fs.writeFileSync('results/pose-shot.json', JSON.stringify(Object.assign({ at: new Date().toISOString(), tag }, out), null, 1));
} catch (e) { out.err = e.message; }
console.log(JSON.stringify(out, null, 1));
await r.close();
process.exit(0);
