// 사가고 실제 화면 확인 1 — 새 계정으로 들어가 3D 화면·밝기·키보드 이동(시점 돌린 뒤)·클릭 이동을 잰다
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  console.log('acc', await c.ev(`(function(){ try { if (DG.account && DG.account.create) { DG.account.create('테스트'); return 'created'; } return 'noacc'; } catch(e){ return 'E '+e.message; } })()`));
  await c.go(B + 'index.html', 8000);
  console.log('title', await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); return 'clicked'; } return 'nobtn'; })()`));
  await sleep(6000);
  console.log('state', await c.ev(`JSON.stringify({w3: !!(DG.world3d && DG.world3d.active && DG.world3d.active()), mode: DG.world.mode, tilt: DG.world.tiltMode, pos: DG.core.save.player.pos, yaw: DG.world3d && DG.world3d.yaw()})`));
  await c.shot('go_01_start');
  // 키보드 W 1.2초 — yaw 0
  let p0 = await c.ev(`JSON.stringify(DG.core.save.player.pos)`);
  await c.key('w', 1200); await sleep(300);
  let p1 = await c.ev(`JSON.stringify(DG.core.save.player.pos)`);
  console.log('W yaw0', p0, '->', p1);
  // 시점을 90도 돌리고 W
  await c.ev(`DG.world3d.yaw(Math.PI/2)`); await sleep(500);
  p0 = await c.ev(`JSON.stringify(DG.core.save.player.pos)`);
  await c.key('w', 1200); await sleep(300);
  p1 = await c.ev(`JSON.stringify(DG.core.save.player.pos)`);
  console.log('W yaw90', p0, '->', p1);
  await c.shot('go_02_yaw90');
  await c.ev(`DG.world3d.yaw(0)`); await sleep(500);
  // 클릭 이동 — 화면 가운데 위쪽(앞 땅)
  p0 = await c.ev(`JSON.stringify(DG.core.save.player.pos)`);
  const pk = await c.ev(`JSON.stringify(DG.world3d.pickGround ? DG.world3d.pickGround(640, 300) : null)`);
  await c.click(640, 300); await sleep(200);
  const tgt = await c.ev(`JSON.stringify(DG.world.walkingTo())`);
  await sleep(3000);
  p1 = await c.ev(`JSON.stringify(DG.core.save.player.pos)`);
  console.log('click pick', pk, 'target', tgt, p0, '->', p1);
  await c.shot('go_03_click');
  console.log('light', await c.ev(`JSON.stringify((function(){ var L = DG.world3d.lightingAt ? DG.world3d.lightingAt() : null; return L; })())`));
  console.log('logs', c.logs.slice(0, 15).join('\n'));
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
await c.close();
process.exit(0);
