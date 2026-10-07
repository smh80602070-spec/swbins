// 사가마을 Q12 — 3D 에서 키보드(시점 돌린 뒤 W)·마우스 왼쪽 클릭 이동·목표 고리를 잰다 + shots/fs_*
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-forest/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 200000);
const pos = () => c.ev(`JSON.stringify((function(){ var p = DG.village.raw().player; return { x: Math.round(p.x), y: Math.round(p.y) }; })())`);
try {
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('확인'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  /* 도움말·첫 안내 카드가 떠 있으면 닫는다 */
  await c.ev(`(function(){ var h = document.getElementById('help-ok'); if (h && h.offsetParent) { h.click(); } })()`);
  const V3 = await c.ev(`(function(){ var VV3 = DG.villageView3d; if (!VV3.active()) { VV3.toggle(); } return JSON.stringify({ on: VV3.active(), tilt: VV3.camTiltMix(), az: VV3.camAz && VV3.camAz() }); })()`);
  console.log('3D', V3);
  await sleep(5000);
  await c.shot('fs_01_start');
  let p0 = await pos(); await c.key('w', 1500); await sleep(300); let p1 = await pos();
  console.log('W 시점 0°', p0, '->', p1);
  await c.ev(`DG.villageView3d.setMouseYaw(Math.PI / 2)`); await sleep(1500);
  p0 = await pos(); await c.key('w', 1500); await sleep(300); p1 = await pos();
  console.log('W 시점 90° (x 가 줄어야)', p0, '->', p1);
  await c.shot('fs_02_yaw90');
  await c.ev(`DG.villageView3d.setMouseYaw(0)`); await sleep(1500);
  p0 = await pos();
  const g = await c.ev(`JSON.stringify(DG.villageView3d.groundAt(640, 250))`);
  await c.click(640, 250); await sleep(400);
  const tg = await c.ev(`JSON.stringify(DG.village.moveTarget())`);
  await sleep(1200);
  await c.shot('fs_03_click');
  await sleep(4000);
  p1 = await pos();
  console.log('클릭 (640,250) 땅', g, '목표', tg, p0, '->', p1);
  /* 먼 곳(화면 위쪽) — 걸어가는 동안 고리가 보이나 */
  await c.click(900, 130); await sleep(300);
  const tg2 = await c.ev(`JSON.stringify(DG.village.moveTarget())`);
  await sleep(1500); await c.shot('fs_04_far');
  console.log('먼 클릭 목표', tg2, '지금', await pos());
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 4).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
