// 사가고 ⑲-52 — 8부 무대: 여섯 매듭(27장~)·먹구름 눈(28장 9단계~)이 3D 로 예외 없이 그려지나 + 기둥으로 눈에 내려서나. 사진은 `shot` 인자를 줄 때만(shots/go_eye_*)
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
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('눈'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('field.on', 0);
    DG.core.save.story = { ch: 28, step: 0 };
    var K = DG.stormEye.knots(), p = DG.core.save.player.pos; p.x = K[1].x + 6; p.y = K[1].y + 6; DG.world.walkTo(p.x, p.y);
    return JSON.stringify({ w3: !!(DG.world3d && DG.world3d.active()), knots: K.map(function (q) { return q.name + ' ' + Math.round(q.x) + ',' + Math.round(q.y) + (q.sky ? ' ☁' : '') + (q.tied ? ' 묶임' : ''); }), eye: DG.stormEye.eyeSpot() });
  })()`));
  await sleep(4000);
  if (shot) { await c.shot('go_eye_1_knot'); }
  console.log('눈 곁', await c.ev(`(function(){
    var E = DG.stormEye.eyeSpot(), C = DG.skyIsle.spot(), p = DG.core.save.player.pos;
    p.x = C.x - 8; p.y = C.y; DG.world.walkTo(p.x, p.y); DG.landform.setSky(true); DG.world3d.yaw(-Math.PI / 2);
    return JSON.stringify({ pads: DG.skyIsle.pads().map(function (q) { return q.id; }), drafts: DG.skyIsle.drafts().map(function (q) { return q.id; }), sky: DG.landform.onSky() });
  })()`));
  await sleep(4000);
  if (shot) { await c.shot('go_eye_2_from_isle'); }
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
