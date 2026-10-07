// 사가마을 별 우체통: 대보름 장을 마친 세이브에서 광장 곁에 서나 · 다른 소품과 겹치지 않나 · 걸을 수 있는 칸인가 · 3D 예외 없나
// 사진은 `shot` 을 줄 때만(shots/fs_starpost). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 120000);
try {
  await c.go('http://127.0.0.1:8871/saga-forest/index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('별우체통'); } })()`);
  await c.go('http://127.0.0.1:8871/saga-forest/index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  console.log(await c.ev(`(function(){
    var V = DG.village, s = V.state();
    s.scenario = s.scenario || { done: {} }; s.scenario.done = s.scenario.done || {}; s.scenario.done.wi_moon = 1;
    V.buildProps();
    var props = V.raw().props, sp = props.filter(function (p) { return p.kind === 'starpost'; })[0];
    if (!sp) { return 'NO STARPOST'; }
    var near = props.filter(function (p) { return p !== sp && Math.hypot(p.x - sp.x, p.y - sp.y) < V.TILE * 1.2; }).map(function (p) { return p.kind; });
    var pl = V.raw().player; pl.x = sp.x - 60; pl.y = sp.y + 40;
    return JSON.stringify({ at: [Math.round(sp.x), Math.round(sp.y)], walkable: V.walkable(sp.x, sp.y), near: near, d3: !!(DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active()) });
  })()`));
  await sleep(2500);
  if (shot) { await c.shot('fs_starpost'); }
  const ex = c.logs.filter((l) => /^EXC|error/.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
