// 사가만리 Q3 — 성능 등급이 내려가도(밀도↓) 이미 그린 집의 벽이 그대로인가, 멀리 갔다 오면 새 밀도로 같이 바뀌나
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 120000);
const snap = () => c.ev(`(function(){
  var p = DG.core.save.player.pos, gx0 = Math.floor(p.x / 48), gy0 = Math.floor(p.y / 48), out = [];
  for (var gy = gy0 - 1; gy <= gy0 + 1; gy++) for (var gx = gx0 - 1; gx <= gx0 + 1; gx++)
    DG.world3d.houseRects(gx, gy).forEach(function(r){ if (r.h) out.push(r.x.toFixed(1) + ',' + r.z.toFixed(1)); });
  return out.sort().join(' ');
})()`);
try {
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);   // 프로필이 비었으면 새 계정
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.perf.pin('HIGH'); DG.world3d.refreshProps && DG.world3d.refreshProps();`);
  // 모델이 다 와서 refreshProps 가 멎을 때까지(그 뒤 칸은 다시 안 지어진다)
  let last = -1; for (let i = 0; i < 20; i++) { await sleep(1500); const n = await c.ev('DG.prop3d.arrivedCount()'); if (n === last) break; last = n; }
  const hi = await snap();
  const arr0 = await c.ev('DG.prop3d.arrivedCount()');
  await c.ev(`DG.perf.pin('LOW')`); console.log('prop mul', await c.ev(`JSON.stringify(DG.perf.stats().mul)`));
  await sleep(2500);
  const lowHere = await snap();
  console.log('모델 도착', arr0, '→', await c.ev('DG.prop3d.arrivedCount()'));
  console.log('HIGH 집', hi.split(' ').length, '| LOW 로 내린 뒤(같은 자리)', lowHere.split(' ').length, hi === lowHere ? '같음 OK' : '달라짐 FAIL');
  const home = JSON.parse(await c.ev(`JSON.stringify(DG.core.save.player.pos)`));
  await c.ev(`(function(){ var p = DG.core.save.player.pos; p.x += 3000; })()`); await sleep(2500); console.log('far pos', await c.ev(`JSON.stringify(DG.core.save.player.pos)`), 'home', JSON.stringify(home));
  await c.ev(`(function(){ var p = DG.core.save.player.pos; p.x = ${home.x}; p.y = ${home.y}; })()`); await sleep(3000);
  const lowBack = await snap();
  console.log('멀리 갔다 온 뒤', lowBack.split(' ').length, lowBack === hi ? '(HIGH 와 같음 — 다시 안 지었나?)' : '(새 밀도로 다시 지음)');
  await c.ev(`DG.perf.unpin()`);
  if (c.logs.length) { console.log(c.logs.slice(0, 5).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
