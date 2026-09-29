// 사가고 ⑲-57 — 굳은 거리(amber.js)가 3D 로 예외 없이 서나 · 명소 자리(억지 여부)·기둥 · 사진은 `shot` 을 줄 때만(shots/go_amber_*)
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
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('호박'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('field.on', 0);
    DG.core.save.story = { ch: 29, step: 0 };
    var A = DG.amber, ctr = A.center(), p = DG.core.save.player.pos; p.x = ctr.x + 40; p.y = ctr.y + 40; DG.world.walkTo(p.x, p.y);
    var terr = function (s) { return DG.world.terrainAt(Math.floor(s.x / 48), Math.floor(s.y / 48)); };
    return JSON.stringify({ w3: !!(DG.world3d && DG.world3d.active()), center: [Math.round(ctr.x), Math.round(ctr.y)], sky: DG.skyport.center() && [Math.round(DG.skyport.center().x), Math.round(DG.skyport.center().y)],
      sites: A.sites().map(function (s) { return s.id + ':' + terr(s); }).join(' '), pole: A.poles().map(function (q) { return q.id; }) });
  })()`));
  await sleep(5000);
  if (shot) { await c.shot('go_amber_1_cross'); }
  console.log('탑 곁', await c.ev(`(function(){ var t = DG.amber.siteById('tower'), p = DG.core.save.player.pos; p.x = t.x + 12; p.y = t.y + 12; DG.world.walkTo(p.x, p.y); return 'ok'; })()`));
  await sleep(4000);
  if (shot) { await c.shot('go_amber_2_tower'); }
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
