// 사가스토리 탈것(mount.js): 말을 타면 같은 시간에 더 멀리 가나 · 학을 타고 날갯짓으로 떠오르나 · 3D 예외 없나 · 무예를 쓰면 내리나
// 사진은 `shot` 을 줄 때만(shots/st_mount_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 120000);
try {
  await c.go('http://127.0.0.1:8871/saga-story/index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('탈것'); } })()`);
  await c.go('http://127.0.0.1:8871/saga-story/index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ if (DG.story.isOpen()) DG.story.skip(); if (!DG.side.active()) DG.side.enter('field'); })()`);
  await sleep(4000);
  console.log(await c.ev(`(function(){
    DG.core.save.player.level = 30; if (DG.auto.active()) { DG.auto.toggle(); }
    var r = DG.side.raw(); r.enemies = []; r.boss = null; r.dying = []; r.eshots = [];
    r.player.x = 300; window.__x0 = 300;
    DG.side.setInput('right', true);
    return JSON.stringify({ active: DG.side.active(), un: DG.mount.unlocked().map(function (m) { return m.id; }) });
  })()`));
  await sleep(1500);
  const foot = JSON.parse(await c.ev(`(function(){ DG.side.setInput('right', false); var r = DG.side.raw(); return JSON.stringify({ d: Math.round(r.player.x - window.__x0) }); })()`));
  console.log('걸어서 1.5초', foot.d + 'px');
  console.log(await c.ev(`(function(){ var r = DG.side.raw(); r.player.x = 300; window.__x1 = 300; var o = DG.mount.ride('mt_white'); DG.side.setInput('right', true); return JSON.stringify({ ok: o.ok, mounted: DG.mount.active(), spd: DG.mount.speedMul() }); })()`));
  await sleep(1500);
  if (shot) { await c.shot('st_mount_1_horse'); }
  const ride = JSON.parse(await c.ev(`(function(){ DG.side.setInput('right', false); var r = DG.side.raw(); return JSON.stringify({ d: Math.round(r.player.x - window.__x1), mounted: DG.mount.active() }); })()`));
  console.log('흰 말 1.5초', ride.d + 'px', ride.mounted ? '(탄 채)' : '(내림)', '배율', (ride.d / Math.max(1, foot.d)).toFixed(2), '(기대 ≈ 1.75)');
  console.log('학', await c.ev(`(function(){ DG.mount.dismount(null); var o = DG.mount.ride('mt_crane'); var r = DG.side.raw(), p = r.player; p.y = 200; p.vy = 0; p.onGround = false; return JSON.stringify({ ok: o.ok, fly: DG.mount.flying(), grav: DG.mount.gravMul() }); })()`));
  await sleep(200);
  console.log('날갯짓', await c.ev(`(function(){ var p = DG.side.raw().player; var y0 = p.y; DG.side.jump(); return JSON.stringify({ vy: Math.round(p.vy), y0: Math.round(y0) }); })()`));
  await sleep(600);
  console.log('솟은 뒤', await c.ev(`(function(){ var p = DG.side.raw().player; return JSON.stringify({ y: Math.round(p.y), vy: Math.round(p.vy), mounted: DG.mount.active() }); })()`));
  if (shot) { await c.shot('st_mount_2_crane'); }
  console.log('싸우면 내림', await c.ev(`(function(){ var r = DG.side.raw(); r.mp = 999; r.player.cds = [0,0,0,0,0,0,0,0]; DG.side.castSkill(0); return DG.mount.active() ? '아직 탐' : '내렸다'; })()`));
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
