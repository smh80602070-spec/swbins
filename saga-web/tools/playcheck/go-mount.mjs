// 사가고 ⑲-61 — 탈것(mount.js): 말을 타면 같은 시간에 더 멀리 가고(걷는 속도 배율) 3D 에서 예외가 없나 · 사진은 `shot` 을 줄 때만(shots/go_mount_*)
// PC_PROF=tmp/… 새 프로필로 돌릴 것(저장된 자동·이야기 자리가 남으면 헛결과)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const shot = process.argv.includes('shot');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('말'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('field.on', 0); DG.core.save.player.level = 30;
    var p = DG.core.save.player.pos, o = { x: p.x, y: p.y };
    window.__mt0 = o;
    DG.world.walkTo(o.x + 400, o.y);
    return JSON.stringify({ w3: !!(DG.world3d && DG.world3d.active()), mode: DG.world.mode, unlocked: DG.mount.unlocked().map(function (m) { return m.id; }), spd: DG.world.moveSpeed(false) });
  })()`));
  await sleep(3000);
  const foot = JSON.parse(await c.ev(`(function(){ var p = DG.core.save.player.pos, o = window.__mt0; return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)) }); })()`));
  console.log('걸어서 3초', foot.d + 'm');
  console.log(await c.ev(`(function(){
    var p = DG.core.save.player.pos; window.__mt1 = { x: p.x, y: p.y };
    var r = DG.mount.ride(); DG.world.walkTo(p.x + 400, p.y);
    return JSON.stringify({ ok: r.ok, mounted: DG.mount.active(), spd: DG.world.moveSpeed(false), ref: DG.mount.petRef() });
  })()`));
  await sleep(3000);
  if (shot) { await c.shot('go_mount_1_riding'); }
  const ride = JSON.parse(await c.ev(`(function(){ var p = DG.core.save.player.pos, o = window.__mt1; return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)), mounted: DG.mount.active() }); })()`));
  console.log('말 타고 3초', ride.d + 'm', ride.mounted ? '(탄 채)' : '(내림)');
  console.log('배율', (ride.d / Math.max(1, foot.d)).toFixed(2), '(기대 ≈ 2.1)');
  console.log('내림', await c.ev(`(function(){ DG.mount.toggle(); return DG.mount.active() ? '아직 탐' : '내렸다'; })()`));
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
