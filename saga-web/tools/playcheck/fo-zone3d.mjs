// W-0414 ② 3마을 3D 구역째 세우기 탐침 — 3D 마을에서 구역(village3d.zoneM) 안을 걸을 때 새로 세우는 것이 없고(pend 0·장면 물체 수 그대로),
// 경계를 넘으면 막이 덮였다 걷히는지. node fo-zone3d.mjs [저장 폴더]   (서버 :8871)
import { open, sleep } from './pw.mjs';
import { clearOverlays } from './overlay.mjs';
const out = process.argv[2] || '.';
const r = await open('saga-forest', { w: 1280, h: 720, gpu: !process.env.PW_SWIFT });
const ev = (fn, a) => r.page.evaluate(fn, a);
try {
  await r.page.addInitScript(() => { document.hasFocus = () => true; });
  await r.page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('구역'); });
  await r.page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { const b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
  await clearOverlays(r.page, 'saga-forest', { keep: [] });
  if (process.env.ZB0) { await ev(() => { DG.core.setTune('village3d.zoneM', 0); }); }
  const d3 = await ev(() => !!(DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active()));
  const st = () => ev(() => { const V3 = DG.villageView3d, p = DG.village.raw().player, u = 64 / 0.08; let n = 0; const sc = document.querySelector('canvas'); return { pend: V3._scatterPend ? V3._scatterPend() : -1, zone: Math.floor(p.x / u) + ',' + Math.floor(p.y / u), x: Math.round(p.x) }; });
  /* 구역 가운데로 */
  await ev(() => { const p = DG.village.raw().player, u = 64 / 0.08; p.x = (Math.floor(p.x / u) + 0.5) * u; p.y = (Math.floor(p.y / u) + 0.5) * u; });
  await sleep(4000);
  const s0 = await st();
  let pendMax = 0, sawCut = false;
  const walk = async (dx, n) => { for (let i = 0; i < n; i++) { await ev((d) => { DG.village.raw().player.x += d; }, dx); await sleep(60); const s = await st(); pendMax = Math.max(pendMax, s.pend); if (await ev(() => DG.zoneCut.shown())) { sawCut = true; } } };
  await walk(15, 20);   // 구역 안 300 단위(24m)
  const s1 = await st(), inPend = pendMax, inCut = sawCut; pendMax = 0; sawCut = false;
  await r.page.screenshot({ path: out + '/fo_zone_in.png' });
  await walk(15, 20);   // 경계 넘기
  const s2 = await st(), crossCut = sawCut;
  await sleep(2500);
  const s3 = await st();
  const near = await ev(() => { const r = DG.village.raw(), pl = r.player, u = 64 / 0.08, zx = Math.floor(pl.x / u), zy = Math.floor(pl.y / u), zp = 16 / 0.08; return r.props.concat(r.animals || []).filter((q) => Math.hypot(q.x - pl.x, q.y - pl.y) < 400).map((q) => q.kind + ' ' + Math.round(q.x - pl.x) + ',' + Math.round(q.y - pl.y) + (q.x >= zx * u - zp && q.x <= (zx + 1) * u + zp && q.y >= zy * u - zp && q.y <= (zy + 1) * u + zp ? ' in' : ' OUT')).slice(0, 30); });
  await r.page.screenshot({ path: out + '/fo_zone_after' + (process.env.ZB0 ? '0' : '') + '.png' });
  console.log(JSON.stringify({ d3, s0, s1, pendWhileInside: inPend, cutWhileInside: inCut, s2, cutAtCross: crossCut, pendCross: pendMax, s3, near, chk: await ev(() => { const r = DG.village.raw(), pl = r.player, S = DG.villageView3d._scatter(); let want = 0, have = 0; const miss = []; for (const q of r.props.concat(r.animals || [])) { if (Math.hypot(q.x - pl.x, q.y - pl.y) > 250) { continue; } const e = S[q.id]; if (!e && !q.kind) { continue; } want++; if (e && e.group && e.group.visible && e.group.parent && Math.abs(e.group.position.x - (q.x - pl.x) * 0.08) < 0.5 && Math.abs(e.group.position.z - (q.y - pl.y) * 0.08) < 0.5) { have++; } else if (miss.length < 8 && e) { miss.push(q.kind + (e ? (e.group ? ' pos ' + e.group.position.x.toFixed(1) + ',' + e.group.position.z.toFixed(1) + ' want ' + ((q.x - pl.x) * 0.08).toFixed(1) : ' nogrp') : ' none')); } } return { want, have, miss }; }), sc: await ev(() => { const S = DG.villageView3d._scatter(), o = { n: 0, grp: 0, vis: 0, inScene: 0, building: 0 }; for (const k in S) { const e = S[k]; o.n++; if (e.building) { o.building++; } if (e.group) { o.grp++; if (e.group.visible) { o.vis++; } if (e.group.parent) { o.inScene++; } } } return o; }), cutAfter: await ev(() => DG.zoneCut.shown()), errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
} finally { await r.close(); }
