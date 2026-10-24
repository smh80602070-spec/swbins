// W-0414 ② 1만리 3D 구역 세우기 탐침 — 3D 로 들어가 구역(go.zoneM) 안에서 걷는 동안 장면 물체 수가 그대로인지, 경계를 넘으면 한 번 바뀌고 막이 덮였다 걷히는지.
//   node go-zone3d.mjs [저장 폴더]   (서버 :8871) → 콘솔 줄 + 사진 셋(구역 안·넘은 직후·걷힌 뒤)
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const out = process.argv[2] || '.';
const r = await open('saga-go', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
const ev = (fn, a) => r.page.evaluate(fn, a);
try {
  await r.page.addInitScript(() => { document.hasFocus = () => true; });
  await r.page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('구역'); });
  await r.page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
  await clearOverlays(r.page, 'saga-go', { keep: [] });
  if (process.env.ZB0) { await ev(() => { DG.core.setTune('go.zoneBuild', 0); }); }
  const d3 = await ev(() => !!(DG.world3d && DG.world3d.active && DG.world3d.active()));
  const count = () => ev(() => { const n = DG.world3d.actorNode('me'); let s = n; while (s && s.parent) { s = s.parent; } let c = 0; if (s) { const g = s.getObjectByName('props'); c = g ? g.children.length : -1; } return c; });
  const zone = () => ev(() => { const p = DG.core.save.player.pos, z = +DG.core.tuned('go.zoneM', 576); return Math.floor(p.x / z) + ',' + Math.floor(p.y / z) + ' @' + Math.round(p.x % z) + ',' + Math.round(p.y % z); });
  /* 구역 가운데로 옮겨 놓고 자리 잡기 */
  await ev(() => { const p = DG.core.save.player.pos, z = +DG.core.tuned('go.zoneM', 576); p.x = (Math.floor(p.x / z) + 0.5) * z; p.y = (Math.floor(p.y / z) + 0.5) * z; DG.core.emit('region:teleport', { key: 'probe' }); });
  await sleep(4000);
  const z0 = await zone(), c0 = await count();
  let sawCut = false; const walk = async (dx, n) => { for (let i = 0; i < n; i++) { await ev((d) => { DG.core.save.player.pos.x += d; }, dx); await sleep(60); if (await ev(() => DG.zoneCut && DG.zoneCut.shown())) { sawCut = true; } } };
  await walk(8, 20);   // 구역 안 160m
  const z1 = await zone(), c1 = await count(), cutIn = sawCut; sawCut = false;
  await r.page.screenshot({ path: out + '/go_zone_in.png' });
  await walk(8, 20);   // 경계 넘기(가운데에서 288m 면 넘음)
  const z2 = await zone(), cut = sawCut;
  await r.page.screenshot({ path: out + '/go_zone_cross.png' });
  await sleep(2500);
  const c2 = await count(), cut2 = await ev(() => DG.zoneCut && DG.zoneCut.shown());
  await r.page.screenshot({ path: out + '/go_zone_after' + (process.env.ZB0 ? '0' : '') + '.png' });
  console.log(JSON.stringify({ d3, z0, props0: c0, z1, propsIn: c1, cutWhileInside: cutIn, z2, cutAtCross: cut, propsAfter: c2, cutAfter: cut2, errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
} finally { await r.close(); }
