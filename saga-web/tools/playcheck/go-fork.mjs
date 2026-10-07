// 사가만리 ⑲-65 — 세갈래 고을(fork.js)이 3D 로 예외 없이 서나 · 명소 자리(억지 여부)·종루 기둥 · 사진은 `shot` 을 줄 때만(shots/go_fork_*)
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
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('세갈래'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('field.on', 0);
    DG.core.save.story = { ch: 36, step: 0 };
    var F = DG.fork, ctr = F.center(), p = DG.core.save.player.pos; p.x = ctr.x + 40; p.y = ctr.y + 40; DG.world.walkTo(p.x, p.y);
    var terr = function (s) { return DG.world.terrainAt(Math.floor(s.x / 48), Math.floor(s.y / 48)); };
    var d = function (o) { return o ? Math.round(Math.hypot(o.x - ctr.x, o.y - ctr.y)) : null; };
    return JSON.stringify({ w3: !!(DG.world3d && DG.world3d.active()), center: [Math.round(ctr.x), Math.round(ctr.y)], frost: DG.frost.center() && [Math.round(DG.frost.center().x), Math.round(DG.frost.center().y)],
      amberD: d(DG.amber.center()), vaultD: d(DG.vault.center()),
      sites: F.allSites().map(function (s) { return s.id + ':' + terr(s) + (s.forced ? '!' : ''); }).join(' '), pole: F.poles().map(function (q) { return q.id; }) });
  })()`));
  await sleep(5000);
  if (shot) { await c.shot('go_fork_1_center'); }
  console.log('길목 곁', await c.ev(`(function(){ var t = DG.fork.siteById('junction'), p = DG.core.save.player.pos; p.x = t.x + 10; p.y = t.y + 25; DG.world.walkTo(p.x, p.y); return 'ok'; })()`));
  await sleep(5000);
  if (shot) { await c.shot('go_fork_2_junction'); }
  console.log('종루 곁', await c.ev(`(function(){ var t = DG.fork.siteById('tower'), p = DG.core.save.player.pos; p.x = t.x + 10; p.y = t.y + 25; DG.world.walkTo(p.x, p.y); return 'ok'; })()`));
  await sleep(4000);
  if (shot) { await c.shot('go_fork_3_tower'); }
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
