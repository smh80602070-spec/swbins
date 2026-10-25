// W-0415 4종횡 3D 발판 키트·사다리(K-0193) 전후 사진 — 사냥터로 넘어가 사다리 곁에 서서 찍는다. 손잡이 story3d.platKit 0(도형)·1(키트) 두 장.
//   [ST_STAGE=cave] node st-platkit.mjs [저장 폴더]   (서버 :8871 — PW_BASE 로 바꿀 수 있다 · ST_STAGE 는 그 무대로 바로, 레벨 99)
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const out = process.argv[2] || '.';
for (const kit of [0, 1]) {
  const r = await open('saga-story', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
  const ev = (fn, a) => r.page.evaluate(fn, a);
  try {
    await r.page.addInitScript(() => { document.hasFocus = () => true; });
    await r.page.goto(r.url('index.html')); await sleep(1500);
    await ev((k) => { DG.account.create('발판'); DG.core.setTune('story3d.platKit', k); DG.core.setTune('sideView3d.on', 1); if (DG.deviceMode && DG.deviceMode.mark) { DG.deviceMode.mark('sv', true); } }, kit);
    await r.page.goto(r.url('index.html')); await sleep(2500);
    await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
    await clearOverlays(r.page, 'saga-story', {});
    const info = await ev((tk) => { const R = DG.side._run(), p = (R.stage.portals || [])[0]; if (tk) { DG.core.save.player.level = 99; DG.side.travel(tk); } else if (p) { DG.side.travel(p[1]); } const S = DG.side._run().stage, L = (S.ropes || []).find((q) => q[3] === 'ladder'); if (L) { DG.side._run().player.x = L[0] - 60; } return { key: S.key, mood: S.mood, ladder: L || null, plats: (S.plats || []).length }; }, process.env.ST_STAGE || '');
    await sleep(6000); info.after = await ev(() => DG.side._run().stage.key);
    await clearOverlays(r.page, 'saga-story', {});
    await r.page.screenshot({ path: out + '/st_platkit_' + (process.env.ST_STAGE || 'first') + '_' + kit + '.png' });
    const st = await ev(() => ({ s: DG.asset3d.stats(), a3: !!(DG.sideView3d && DG.sideView3d.active && DG.sideView3d.active()), on: DG.core.tuned('sideView3d.on', 1), dm: DG.deviceMode && DG.deviceMode.want3d ? DG.deviceMode.want3d('sv', true) : null, kit: DG.core.tuned('story3d.platKit', 1) }));
    console.log(JSON.stringify({ kit, info, st, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
  } finally { await r.close(); }
}
