// 사가고 ⑲-48 — 구름 위 항로 섬 셋을 찍는다: 등대 동쪽 땅에서 서쪽 하늘 · 사당 섬 위에서 서쪽(잔해·정거장) + shots/go_sky_*
// PC_PROF=tmp/… 새 프로필로 돌릴 것(저장된 자동·이야기 자리가 남으면 헛결과)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('항로'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  console.log(await c.ev(`(function(){
    DG.perf.pin('LOW'); DG.core.setTune('field.on', 0); DG.core.setTune('skyroute.drafts', 1);
    DG.core.save.story = { ch: 23, step: 0 };
    var L = DG.sunken.siteById('lighthouse'), p = DG.core.save.player.pos; p.x = L.x + 45; p.y = L.y + 10; DG.world.walkTo(p.x, p.y);
    DG.world3d.yaw(-Math.PI / 2);
    return JSON.stringify({ on: DG.skyRoute.on(), isles: DG.skyRoute.isles().map(function (q) { return q.id + ' ' + Math.round(q.x) + ',' + Math.round(q.y) + ' 윗면 ' + Math.round(q.top); }), drafts: DG.skyRoute.drafts().length });
  })()`));
  await sleep(6000);
  await c.shot('go_sky_1_from_ground');
  await c.ev(`(function(){ var I = DG.skyRoute.isles(), p = DG.core.save.player.pos; p.x = I[0].x + 6; p.y = I[0].y + 4; DG.world.walkTo(p.x, p.y); DG.landform.setSky(true); DG.world3d.yaw(-Math.PI / 2); })()`);
  await sleep(6000);
  await c.shot('go_sky_2_on_shrine');
  console.log('섬 위', await c.ev(`JSON.stringify({ sky: DG.landform.onSky(), pad: (DG.skyIsle.padAt(DG.core.save.player.pos.x, DG.core.save.player.pos.y) || {}).id, found: DG.skyRoute.found('shrine') })`));
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 4).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
