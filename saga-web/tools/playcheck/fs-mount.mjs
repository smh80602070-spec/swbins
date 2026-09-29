// 사가의숲 탈것(mount.js): 말을 타면 더 멀리 가나 · 학을 타고 떠서 물 칸을 넘나 · 물 위에서 내리면 뭍으로 옮겨지나 · 3D 예외 없나
// 사진은 `shot` 을 줄 때만(shots/fs_mount_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const U = 'http://127.0.0.1:8871/saga-forest/index.html';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 120000);
try {
  await c.go(U, 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('탈것'); } })()`);
  await c.go(U, 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  console.log(await c.ev(`(function(){
    DG.core.save.player.level = 30;
    var V = DG.village, p = V.raw().player; window.__p0 = { x: p.x, y: p.y };
    V.setJoy(1, 0);
    return JSON.stringify({ w3: !!(DG.villageView3d && DG.villageView3d.active()), un: DG.mount.unlocked().map(function (m) { return m.id; }) });
  })()`));
  await sleep(1500);
  const foot = JSON.parse(await c.ev(`(function(){ DG.village.setJoy(0, 0); var p = DG.village.raw().player, o = window.__p0; return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)) }); })()`));
  console.log('걸어서 1.5초', foot.d);
  console.log(await c.ev(`(function(){ var V = DG.village, p = V.raw().player; p.x = window.__p0.x; p.y = window.__p0.y; window.__p1 = { x: p.x, y: p.y }; var r = DG.mount.ride('mt_white'); V.setJoy(1, 0); return JSON.stringify({ ok: r.ok, spd: DG.mount.speedMul() }); })()`));
  await sleep(1500);
  if (shot) { await c.shot('fs_mount_1_horse'); }
  const ride = JSON.parse(await c.ev(`(function(){ DG.village.setJoy(0, 0); var p = DG.village.raw().player, o = window.__p1; return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)), mounted: DG.mount.active() }); })()`));
  console.log('흰 말 1.5초', ride.d, '배율', (ride.d / Math.max(1, foot.d)).toFixed(2), '(기대 ≈ 1.95)');
  /* 학 — 못 걷는 칸을 찾아 넘는다 */
  console.log('학', await c.ev(`(function(){
    DG.mount.dismount(null);
    var V = DG.village, T = V.TILE, p = V.raw().player, edge = null, tx, ty;
    for (ty = 2; ty < V.H - 2 && !edge; ty++) { for (tx = 2; tx < V.W - 3 && !edge; tx++) { if (V.walkable((tx + 0.5) * T, (ty + 0.5) * T) && !V.walkable((tx + 1.5) * T, (ty + 0.5) * T) && !V.walkable((tx + 2.5) * T, (ty + 0.5) * T)) { edge = { tx: tx, ty: ty }; } } }
    if (!edge) { return 'no edge'; }
    p.x = (edge.tx + 1) * T - 1; p.y = (edge.ty + 0.5) * T; window.__edge = edge;
    var r = DG.mount.ride('mt_crane'); V.setJoy(1, 0);
    return JSON.stringify({ ok: r.ok, fly: DG.mount.flying(), edge: edge });
  })()`));
  await sleep(1500);
  if (shot) { await c.shot('fs_mount_2_crane'); }
  console.log('날아 건넘', await c.ev(`(function(){ var V = DG.village, p = V.raw().player, T = V.TILE, e = window.__edge; V.setJoy(0, 0); return JSON.stringify({ x: Math.round(p.x), over: Math.round(p.x - (e.tx + 1) * T), onWalk: V.walkable(p.x, p.y) }); })()`));
  console.log('내림', await c.ev(`(function(){ var V = DG.village, p = V.raw().player; DG.mount.toggle(); return JSON.stringify({ mounted: DG.mount.active(), onWalk: V.walkable(p.x, p.y) }); })()`));
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
