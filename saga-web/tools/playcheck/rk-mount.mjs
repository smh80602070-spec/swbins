// 사가국지 탈것(mount.js): 장수 카드에 명마 단추가 서나·얹으면 부대 힘이 오르나 · 학을 타면 3D 지도 카메라가 낮게 기울고 이동이 빨라지나 · 예외 없나
// 사진은 `shot` 을 줄 때만(shots/rk_mount_*). PC_PROF=tmp/… 새 프로필로 돌릴 것
import { launch, sleep } from './cdp.mjs';
const shot = process.argv.includes('shot');
const B = 'http://127.0.0.1:8871/saga-realm/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
const fake = (o) => `({ getAttribute: function (k) { return ${JSON.stringify(o)}[k] || null; } })`;
try {
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('탈것'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  console.log('판', await c.ev(`(function(){
    DG.ui._act('pick-scen', ${fake({ 'data-id': '194' })});
    DG.ui._act('pick-force', document.querySelector('[data-act="pick-force"]'));
    var R = DG.rtk, me = R.me();
    DG.core.save.dex.pets.pt_horse = { count: 1, firstAt: 0 }; DG.core.save.dex.pets.pt_crane = { count: 1, firstAt: 0 };   // 성 수 대신 도감으로 연다
    return JSON.stringify({ me: me, cities: R.citiesOf(me).length, un: DG.mount.unlocked().map(function (m) { return m.id; }), r3: !!(DG.realm3d && DG.realm3d.active()) });
  })()`));
  await sleep(2500);
  console.log('장수 카드', await c.ev(`(function(){
    DG.ui.openSheet('officers');
    var btn = document.querySelector('[data-act="mount-eq"]');
    if (!btn) { return 'no button'; }
    var id = btn.getAttribute('data-id'), R = DG.rtk, W = DG.war;
    var army = function () { return { troops: 10000, train: 60, tech: 300, morale: 1, officers: [id], water: false }; };
    var p0 = W.armyPower(army());
    DG.ui._act('mount-eq', btn);
    var p1 = W.armyPower(army());
    return JSON.stringify({ id: id, row: /명마/.test(document.getElementById('sheet-body') ? document.getElementById('sheet-body').innerHTML : document.body.innerHTML), mount: (DG.mount.mountOf(id) || {}).id, ratio: +(p1 / p0).toFixed(3) });
  })()`));
  await c.ev(`DG.ui.closeSheet()`);
  await sleep(1000);
  if (shot) { await c.shot('rk_mount_0_map'); }
  console.log('날기', await c.ev(`(function(){
    var R3 = DG.realm3d, x0 = R3.focusMap ? R3.focusMap() : null;
    var r = DG.mount.ride('mt_crane');
    return JSON.stringify({ ok: r.ok, why: r.why, flying: DG.mount.flying(), r3: R3.flying(), pan: DG.mount.panMul() });
  })()`));
  await sleep(2500);
  console.log('날며 이동', await c.ev(`(function(){
    var R3 = DG.realm3d, f0 = R3.focusMap(); for (var i = 0; i < 20; i++) { R3.panBy(1, 0); } window.__f0 = f0; return 'panned';
  })()`));
  await sleep(2500);
  if (shot) { await c.shot('rk_mount_1_fly'); }
  console.log('이동량', await c.ev(`(function(){ var f1 = DG.realm3d.focusMap(), f0 = window.__f0; return JSON.stringify({ dx: +(f1.x - f0.x).toFixed(2), dy: +(f1.y - f0.y).toFixed(2) }); })()`));
  console.log('내림', await c.ev(`(function(){ DG.mount.toggle(); return JSON.stringify({ mounted: DG.mount.active(), r3: DG.realm3d.flying() }); })()`));
  await sleep(1500);
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info/i.test(l));
  console.log(ex.length ? ex.slice(0, 5).join('\n') : '예외 없음');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
