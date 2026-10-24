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
  if (process.env.ZB0) { await ev(() => { DG.core.setTune('go.zoneBuild', 0); DG.core.setTune('go.zoneGround', 0); DG.core.setTune('zoneCut.wall', 0); }); }
  if (process.env.DAYMS) { await ev((ms) => { DG.world3d.forceTime(ms); }, +process.env.DAYMS); }
  const d3 = await ev(() => !!(DG.world3d && DG.world3d.active && DG.world3d.active()));
  const count = () => ev(() => { const n = DG.world3d.actorNode('me'); let s = n; while (s && s.parent) { s = s.parent; } let c = 0; if (s) { const g = s.getObjectByName('props'); c = g ? g.children.length : -1; } return c; });
  const zone = () => ev(() => { const p = DG.core.save.player.pos, z = +DG.core.tuned('go.zoneM', 576); return Math.floor(p.x / z) + ',' + Math.floor(p.y / z) + ' @' + Math.round(p.x % z) + ',' + Math.round(p.y % z); });
  /* 구역 가운데로 옮겨 놓고 자리 잡기 */
  await ev(() => { const p = DG.core.save.player.pos, z = +DG.core.tuned('go.zoneM', 576); p.x = (Math.floor(p.x / z) + 0.5) * z; p.y = (Math.floor(p.y / z) + 0.5) * z; DG.core.emit('region:teleport', { key: 'probe' }); });
  await sleep(4000);
  const gl = async () => ev(() => { const I = DG.world3d.glInfo(); return I ? I.calls + 'c/' + Math.round(I.tris / 1000) + 'kt/' + I.geos + 'g/' + I.texs + 't' : null; }); const GL0 = await gl();
  const z0 = await zone(), c0 = await count();
  let sawCut = false; const walk = async (dx, n) => { for (let i = 0; i < n; i++) { await ev((d) => { DG.core.save.player.pos.x += d; }, dx); await sleep(60); if (await ev(() => DG.zoneCut && DG.zoneCut.shown())) { sawCut = true; } } };
  await walk(8, 20);   // 구역 안 160m
  await sleep(1500); const GL1 = await gl(); const z1 = await zone(), c1 = await count(), cutIn = sawCut; sawCut = false;
  await r.page.screenshot({ path: out + '/go_zone_in.png' });
  await walk(8, 20);   // 경계 넘기(가운데에서 288m 면 넘음)
  const z2 = await zone(), cut = sawCut;
  await r.page.screenshot({ path: out + '/go_zone_cross.png' });
  await sleep(+(process.env.WAIT || 2500));
  const c2 = await count(), cut2 = await ev(() => DG.zoneCut && DG.zoneCut.shown());
  if (process.env.EDGE) { await ev((g) => { if (g === 'go') { const p = DG.core.save.player.pos, z = 576; p.y = Math.floor(p.y / z) * z + 90; } else { const p = DG.village.raw().player, u = 800; p.x = (Math.floor(p.x / u) + 1) * u - 120; } }, 'go'); await sleep(3000); await r.page.screenshot({ path: out + '/go_zone_edge.png' }); }
  await r.page.screenshot({ path: out + '/go_zone_after' + (process.env.ZB0 ? '0' : '') + '.png' });
  console.log(JSON.stringify({ d3, gl: GL0, glIn: GL1, z0, props0: c0, z1, propsIn: c1, cutWhileInside: cutIn, z2, cutAtCross: cut, propsAfter: c2, cutAfter: cut2, ground: await ev(() => { const n = DG.world3d.actorNode('me'); let s = n; while (s && s.parent) { s = s.parent; } const P = DG.core.save.player.pos; let info = null; s.traverse((o) => { if (info || !o.isMesh || !o.geometry || !o.geometry.parameters || !(o.geometry.parameters.width > 100)) { return; } const w = o.geometry.parameters.width; if (Math.abs(o.position.x - P.x) < w / 2 && Math.abs(o.position.z - P.y) < w / 2) { const m = o.material, img = m.map && m.map.image; let avg = null; if (img && img.getContext) { const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; let r = 0, g = 0, b = 0, c = 0; for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; b += d[i + 2]; c++; } avg = [r / c | 0, g / c | 0, b / c | 0]; } info = { color: m.color.getHexString(), map: !!m.map, img: img ? (img.width + 'x' + img.height + (img.getContext ? ' canvas' : ' img')) : null, avg, type: m.type, terr: DG.world.terrainAt ? DG.world.terrainAt(Math.floor(P.x / 48), Math.floor(P.y / 48)) : null }; } }); return info; }), errors: r.errors.filter((e) => !/404/.test(e)).slice(0, 3) }));
} finally { await r.close(); }
