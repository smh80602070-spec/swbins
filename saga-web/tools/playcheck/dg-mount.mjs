// 사가블로 탈것(mount.js): 마을·들판에서 말을 타면 같은 시간에 더 멀리 가나 · 학·용을 타면 소품을 떠서 넘나 · 던전에 들어가면 내리나 · 3D 예외 없나
// 사진은 `shot` 을 줄 때만(shots/dg_mount_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const B = 'http://127.0.0.1:8871/saga-dungeon/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('탈것'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ var cells = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cells.length; i++) { cells[i].click(); } var b = document.querySelector('.stc-btn'); if (b) { b.click(); } })()`);   // 출사표 — 첫 셋
  await sleep(9000);
  console.log('마을', await c.ev(`(function(){ DG.core.save.player.level = 40; return JSON.stringify({ town: DG.town.active(), open: DG.mount.inOpenWorld(), un: DG.mount.unlocked().map(function (m) { return m.id; }) }); })()`));
  /* 걸어서 / 흰 말로 1.5초 — 트인 방향 하나를 찾는다 */
  const run = (js) => c.ev(js);
  const foot = JSON.parse(await run(`(function(){
    var T = DG.town, p = T.raw().player, dirs = [[1,0],[-1,0],[0,1],[0,-1]], i, best = null;
    window.__p0 = { x: p.x, y: p.y };
    for (i = 0; i < 4 && !best; i++) { T._put(p.x, p.y); T.setInput(dirs[i][0], dirs[i][1]); for (var k = 0; k < 8; k++) { T.update(0.05); } T.setInput(0,0); if (Math.hypot(p.x - window.__p0.x, p.y - window.__p0.y) > 30) { best = dirs[i]; } T._put(window.__p0.x, window.__p0.y); }
    window.__dir = best; return JSON.stringify({ dir: best });
  })()`));
  console.log('트인 방향', JSON.stringify(foot));
  const mv = async (label, id) => {
    await run(`(function(){ var T = DG.town, o = window.__p0; T._put(o.x, o.y); DG.mount.dismount(null); ${id ? `DG.mount.ride('${id}');` : ''} window.__q = { x: o.x, y: o.y }; T.setInput(window.__dir[0], window.__dir[1]); })()`);
    await sleep(1500);
    if (shot && id) { await c.shot('dg_mount_' + id); }
    return JSON.parse(await run(`(function(){ var T = DG.town, p = T.raw().player, o = window.__q; T.setInput(0,0); return JSON.stringify({ d: Math.round(Math.hypot(p.x - o.x, p.y - o.y)), mounted: DG.mount.active(), spd: DG.mount.speedMul() }); })()`));
  };
  const w = await mv('걷기', null), h = await mv('흰 말', 'mt_white');
  console.log('걸어서', w.d, '흰 말', h.d, '배율', (h.d / Math.max(1, w.d)).toFixed(2), '(기대 ≈ 2.0 — 부딪히면 낮다)', h.mounted ? '탄 채' : '내림(적이 붙었나)');
  const cr = await mv('학', 'mt_crane');
  console.log('학', cr.d, cr.mounted ? '탄 채' : '내림');
  console.log('내림 판정', await run(`(function(){ DG.mount.ride('mt_brown'); var a = DG.mount.active(); DG.mount.toggle(); return JSON.stringify({ rode: a, after: DG.mount.active() }); })()`));
  console.log('던전', await run(`(function(){ DG.mount.ride('mt_brown'); var ok = DG.dungeon.enter({ floor: 1 }); DG.mount.step(); return JSON.stringify({ enter: ok, mounted: DG.mount.active() }); })()`));
  await sleep(4000);
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
