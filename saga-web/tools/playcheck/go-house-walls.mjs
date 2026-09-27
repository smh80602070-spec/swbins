// 사가고 Q3 확인 — 집 셋에 네 방향으로 걸어 들어가 멈춘 자리 + 위에서 찍기
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 280000);
try {
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);   // 프로필이 비었으면 새 계정
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(6000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); DG.world3d.yaw(0);`);
  const houses = JSON.parse(await c.ev(`(function(){
    var out = []; for (var gy=-1; gy<=1; gy++) for (var gx=-1; gx<=1; gx++) DG.world3d.houseRects(gx, gy).forEach(function(r){ if (r.h) out.push(r); });
    out.sort(function(a,b){ return Math.hypot(a.x,a.z) - Math.hypot(b.x,b.z); });
    return JSON.stringify(out.slice(0, 4));
  })()`));
  const dirs = [['s', 0, -1], ['w', 0, 1], ['d', -1, 0], ['a', 1, 0]];   // 키, 출발 쪽(x,y 부호) — 집을 향해
  for (let hi = 0; hi < Math.min(4, houses.length); hi++) {
    const h = houses[hi];
    const res = [];
    for (const [k, sx, sy] of dirs) {
      const okStart = await c.ev(`(function(){ var p = DG.core.save.player.pos, d = 0; while (d < 30 && DG.world.wallAt(${h.x} + ${sx} * d, ${h.z} + ${sy} * d)) d += 0.5; if (d >= 30) return false; d += 3; if (DG.world.wallAt(${h.x} + ${sx} * d, ${h.z} + ${sy} * d)) return false; p.x = ${h.x} + ${sx} * d; p.y = ${h.z} + ${sy} * d; return d; })()`); if (!okStart) { res.push(k + ':skip'); continue; }
      await sleep(300);
      for (let n = 0; n < 3; n++) { await c.key(k, 2200); }
      const p = JSON.parse(await c.ev(`JSON.stringify(DG.core.save.player.pos)`));
      res.push(k + ':' + Math.hypot(p.x - h.x, p.y - h.z).toFixed(1) + '/' + (okStart - 3).toFixed(1) + (await c.ev(`DG.world.wallAt(${p.x}, ${p.y})`) ? '!in' : ''));
    }
    console.log('house', hi, 'w', h.w.toFixed(1), 'd', h.d.toFixed(1), 'h', h.h.toFixed(1), 'rot', h.rot.toFixed(2), 'stop dist', res.join(' '));
    if (hi === 0) {
      await c.ev(`(function(){ var S=DG.core.save.settings; S.tilt=1; S.zoom3d=1.6; })()`); await sleep(1500);
      await c.shot('go_70_house_top');
      await c.ev(`(function(){ var S=DG.core.save.settings; S.tilt=2; S.zoom3d=1.4; })()`); await sleep(800);
    }
  }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
