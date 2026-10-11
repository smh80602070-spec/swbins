// node saga-web/tools/playcheck/go-r2-shot.mjs → shots/go_r2_{1_duel,2_region,3_map,4_auto}.png (R-2 확인 시트 10-11, Claude 판정 근거)
// 1만리 시트 넷 — ① 실시간 전투(🤖 자동이 입력을 대신·스태거) ② 지역 발견 카드·이름 띠 ③ 전체 지도(M)·발견 지점 순간이동 ④ 자동 순행이 들판 무리를 처치
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8920, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-go')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 280000);
const J = async (code) => { const r = await c.ev(code); try { return JSON.parse(r); } catch (e) { return r; } };
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('시트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(4000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); window.__fx = {}; DG.core.on('duel:fx', function (e) { window.__fx[e.kind] = (window.__fx[e.kind] || 0) + 1; });`);

  /* ① 실시간 전투 — 토벌 판정(raid)으로 열고 🤖 자동을 켠 채 10초 */
  await c.ev(`(function(){ var p0 = DG.core.save.player.pos; p0.x += 320; p0.y += 40; })()`);   // 마을 집 사이가 아니라 들판에서(집 벽에 막히지 않게)
  await sleep(2500);
  await c.ev(`(function(){ DG.core.save.settings.autoBattle = true; DG.rogueAction.open({ title: '토벌', foeName: '시험 적장', foeHp: 2400, myAtk: 60, myDef: 40, raid: true, timeSec: 60, onDone: function (p) { window.__duel = p; } }); })()`);
  await sleep(6000);
  await c.shot('go_r2_1_duel');
  await sleep(4000);
  console.log('① 전투', JSON.stringify(await J(`JSON.stringify({ fx: window.__fx, active: DG.rogueAction.active, done: window.__duel || null })`)));
  await c.ev(`(function(){ if (DG.rogueAction.active) { DG.rogueAction.keyAct('escape'); } DG.core.save.settings.autoBattle = false; })()`);
  await sleep(1500);

  /* ② 지역 발견 — 가장 가까운 아직 못 찾은 랜드마크 20m 앞으로 */
  const lm = await J(`(function(){ var B = DG.biome, L = B.landmarks(0, 0, 4000).filter(function (l) { return !B.found(l.key); }), p = DG.core.save.player.pos;
    L.sort(function (a, b) { return Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y); }); var l = L[0];
    if (!l) { return 'null'; } p.x = l.x - 20; p.y = l.y + 6; return JSON.stringify({ key: l.key, name: l.name || '', x: l.x, y: l.y }); })()`);
  await sleep(3500);
  await c.shot('go_r2_2_region');
  console.log('② 지역', JSON.stringify(lm), JSON.stringify(await J(`JSON.stringify({ found: ${lm && lm.key ? `DG.biome.found('${lm.key}')` : 'false'}, ways: DG.biome.waypoints().length, card: !!document.querySelector('.region-card.show, .bm-card.show, .discover.show, [class*=discover].show') })`)));

  /* ③ 전체 지도 — M 키로 열고, 고향으로 순간이동 */
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 });
  await sleep(1500);
  await c.shot('go_r2_3_map');
  const before = await J(`JSON.stringify(DG.core.save.player.pos)`);
  const jumped = await J(`JSON.stringify({ opened: DG.overworld.opened, jump: DG.overworld.jump('0_0') })`);
  await sleep(800);
  const after = await J(`JSON.stringify(DG.core.save.player.pos)`);
  console.log('③ 지도', JSON.stringify(jumped), '이동', Math.round(Math.hypot(after.x - before.x, after.y - before.y)) + 'm', '→', Math.round(after.x), Math.round(after.y));
  await c.ev(`(function(){ if (DG.overworld.opened) { DG.overworld.close(); } })()`);
  await sleep(1000);

  /* ④ 자동 순행 — 가장 가까운 들판 무리 곁에서 켜고 12초 */
  let camp = null;
  for (let k = 0; k < 8 && !camp; k++) {
    camp = await J(`(function(){ var S = DG.fieldCombat.state(), p = DG.core.save.player.pos, best = null, bd = 1e9; if (!S) return 'null';
      for (var key in S.camps) { var cp = S.camps[key]; if (cp.kind === 'guard' || cp.sky) continue; var d = Math.hypot(cp.x - p.x, cp.y - p.y); if (d < bd) { bd = d; best = cp; } }
      return JSON.stringify(best && { x: best.x, y: best.y, n: best.uids.length }); })()`);
    if (!camp || camp === 'null') { camp = null; await c.ev(`DG.core.save.player.pos.x += 300`); await sleep(1500); }
  }
  if (camp) {
    await c.ev(`(function(){ var p = DG.core.save.player.pos; p.x = ${camp.x} - 16; p.y = ${camp.y}; })()`);
    await sleep(1500);
    const k0 = await J(`JSON.stringify(DG.core.save.player.kills || 0)`);
    await c.ev(`(function(){ DG.core.save.settings.autoBattle = true; ['story', 'meet', 'stop', 'fort'].forEach(function (k) { if (DG.auto.on(k)) { DG.auto.toggleFlag(k); } }); DG.auto.setOn(true); })()`);   // 이야기 따라가기를 끄고 들판 무리만(싸움은 🤖 자동 전투가 맡는다)
    await sleep(12000);
    await c.shot('go_r2_4_auto');
    console.log('④ 순행', JSON.stringify(await J(`JSON.stringify({ on: DG.auto.active(), doing: DG.auto.status().doing, kills: (DG.core.save.player.kills || 0) - ${k0 || 0}, camp: ${camp.n}, live: (DG.fieldCombat.live ? DG.fieldCombat.live() : []).length })`)));
    await c.ev(`DG.auto.setOn(false)`);
  } else { console.log('④ 순행 무리 못 찾음'); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
