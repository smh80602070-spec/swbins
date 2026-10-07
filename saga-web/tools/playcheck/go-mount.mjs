// 사가만리 탈것(mount.js): T1 말을 타면 같은 시간에 더 멀리 가나(속도 배율) · T2 학을 타고 떠올라 빨리 나나(뜬 배율·높이·지붕 넘김)·3D 예외 없나
// 사진은 `shot` 을 줄 때만(shots/go_mount_*). PC_PROF=tmp/… 새 프로필로 돌릴 것(저장된 자동·이야기 자리가 남으면 헛결과)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const shot = process.argv.includes('shot');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 170000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('말'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('field.on', 0); DG.core.save.player.level = 40;
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
    var r = DG.mount.ride('mt_white'); DG.world.walkTo(p.x + 400, p.y);
    return JSON.stringify({ ok: r.ok, mounted: DG.mount.active(), spd: DG.world.moveSpeed(false), ref: DG.mount.petRef() });
  })()`));
  await sleep(3000);
  if (shot) { await c.shot('go_mount_1_riding'); }
  const ride = JSON.parse(await c.ev(`(function(){ var p = DG.core.save.player.pos, o = window.__mt1; return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)), mounted: DG.mount.active() }); })()`));
  console.log('말 타고 3초', ride.d + 'm', ride.mounted ? '(탄 채)' : '(내림)', '· 속도 배율은 moveSpeed 로 본다(프레임 편차가 커서 거리비는 참고만)');
  console.log('말에서 내림', await c.ev(`(function(){ DG.mount.toggle(); return DG.mount.active() ? '아직 탐' : '내렸다'; })()`));
  /* T2 — 학 */
  console.log('학 타기', await c.ev(`(function(){
    var p = DG.core.save.player.pos; window.__mt2 = { x: p.x, y: p.y };
    var r = DG.mount.ride('mt_crane'); DG.mount.setLift(1); DG.world.walkTo(p.x + 600, p.y);
    return JSON.stringify({ ok: r.ok, fly: DG.mount.isFly(DG.mount.current()), ref: DG.mount.petRef() });
  })()`));
  await sleep(3500);
  const air = JSON.parse(await c.ev(`(function(){
    DG.mount.setLift(0);
    var p = DG.core.save.player.pos, o = window.__mt2;
    return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)), alt: Math.round(DG.mount.altitude()), flying: DG.mount.flying(), roof: DG.mount.overRoofs(), spd: DG.world.moveSpeed(false) });
  })()`));
  if (shot) { await c.shot('go_mount_2_flying'); }
  console.log('날며 3.5초', air.d + 'm · 높이 ' + air.alt + 'm', air.flying ? '(뜸)' : '(땅)', air.roof ? '(지붕 넘음)' : '', '· 속도', air.spd);
  console.log('내려앉기', await c.ev(`(function(){ DG.mount.setLift(-1); return 'ok'; })()`));
  await sleep(4000);
  console.log('내린 뒤', await c.ev(`(function(){ DG.mount.setLift(0); return JSON.stringify({ alt: Math.round(DG.mount.altitude()), riding: DG.mount.active() }); })()`));
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
