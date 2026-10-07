// 사가만리 ⑲-56 — 결말 뒤: 밤의 잔불이 3D 로 예외 없이 서고(14m 안이면 잔당 셋) · 메아리 입구 넷이 보이나. 사진은 `shot` 을 줄 때만(shots/go_after_*)
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
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('잔불'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('nightecho.night', 1);
    DG.core.save.story = { ch: 29, step: 0 };
    var NE = DG.nightEcho, q = NE.spots()[0], p = DG.core.save.player.pos; p.x = q.x + 30; p.y = q.y; DG.world.walkTo(p.x, p.y);
    return JSON.stringify({ w3: !!(DG.world3d && DG.world3d.active()), lit: NE.lit(), spots: NE.spots().map(function (s) { return s.id + ' ' + Math.round(s.x) + ',' + Math.round(s.y); }),
      echoes: DG.domain.echoList().map(function (d) { return d.id + ' ' + Math.round(d.x) + ',' + Math.round(d.y); }) });
  })()`));
  await sleep(4000);
  if (shot) { await c.shot('go_after_1_ember'); }
  console.log('가까이', await c.ev(`(function(){
    var NE = DG.nightEcho, q = NE.spots()[0], p = DG.core.save.player.pos; p.x = q.x + 6; p.y = q.y; DG.world.walkTo(p.x, p.y);
    return 'ok';
  })()`));
  await sleep(4000);
  console.log('잔당', await c.ev(`(function(){ var S = DG.fieldCombat.state(), q = DG.nightEcho.spots()[0], cp = S && S.camps['dm:ne:' + q.id]; return JSON.stringify({ camp: !!cp, foes: cp ? cp.uids.length : 0, mine: DG.nightEcho.camp(q.id) }); })()`));
  if (shot) { await c.shot('go_after_2_foes'); }
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
