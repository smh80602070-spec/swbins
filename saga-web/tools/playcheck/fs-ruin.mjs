// 사가마을 탑성 조각 번들(PLAN §5.3 다섯째 갈래): 폐허 곁 돌무더기 여섯이 걸을 수 있는 자리에 서나 · 뒤지면 조각이 나오나 · 다 들이면 정자가 서나 · 3D 예외 없나
// 사진은 `shot` 을 줄 때만(shots/fs_ruin_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.go('http://127.0.0.1:8871/saga-forest/index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('탑성조각'); } })()`);
  await c.go('http://127.0.0.1:8871/saga-forest/index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  console.log('돌무더기', await c.ev(`(function(){
    var V = DG.village, s = V.state(); s.donated = {}; s.used = {}; V.buildProps();
    var props = V.raw().props, rub = props.filter(function (p) { return p.kind === 'rubble'; }), rs = V.ruinSpot();
    var out = rub.map(function (p) {
      var near = props.filter(function (q) { return q !== p && Math.hypot(q.x - p.x, q.y - p.y) < V.TILE * 0.8; }).map(function (q) { return q.kind; });
      return { id: p.id, walk: V.walkable(p.x, p.y), near: near.join('/') };
    });
    var pl = V.raw().player; if (rub[0]) { pl.x = rub[0].x - 50; pl.y = rub[0].y + 40; }
    return JSON.stringify({ n: rub.length, ruin: rs, out: out, d3: !!(DG.villageView3d && DG.villageView3d.active && DG.villageView3d.active()) });
  })()`));
  await sleep(2500);
  if (shot) { await c.shot('fs_ruin_0_rubble'); }
  console.log('뒤지기', await c.ev(`(function(){
    var V = DG.village, VD = DG.villageData, rub = V.raw().props.filter(function (p) { return p.kind === 'rubble'; })[0], pl = V.raw().player;
    pl.x = rub.x; pl.y = rub.y + 6;
    function n() { var k = 0; VD.ITEMS.ruin.forEach(function (it) { k += V.bagCount(it.key); }); return k; }
    var b0 = n(), r1 = V.interact(), b1 = n(), r2 = V.interact(), b2 = n();
    return JSON.stringify({ kind: r1 && r1.kind, text: r1 && r1.text, got: b1 - b0, again: b2 - b1, second: r2 && r2.text });
  })()`));
  console.log('완성', await c.ev(`(function(){
    var V = DG.village, VD = DG.villageData, MU = DG.museum, s = V.state();
    VD.ITEMS.ruin.slice(0, 5).forEach(function (it) { s.donated[it.key] = true; });
    var last = VD.ITEMS.ruin[5]; s.bag = s.bag || {}; s.bag[last.key] = 1;
    var mu = V.raw().props.filter(function (p) { return p.id === 'museum'; })[0], pl = V.raw().player; pl.x = mu.x; pl.y = mu.y + 6;
    var d = MU.donate(last.key);
    var rb = V.raw().props.filter(function (p) { return p.id === 'bundle_ruin'; })[0];
    var near = rb ? V.raw().props.filter(function (q) { return q !== rb && Math.hypot(q.x - rb.x, q.y - rb.y) < V.TILE * 1.0; }).map(function (q) { return q.kind; }) : [];
    if (rb) { pl.x = rb.x - 70; pl.y = rb.y + 50; }
    return JSON.stringify({ kind: d.kind, bundle: d.bundleCompleted, text: d.text, rebuilt: !!rb, walk: rb && V.walkable(rb.x, rb.y), near: near });
  })()`));
  await sleep(2500);
  if (shot) { await c.shot('fs_ruin_1_rebuilt'); }
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info/i.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
