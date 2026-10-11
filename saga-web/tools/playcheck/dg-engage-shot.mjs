// node saga-web/tools/playcheck/dg-engage-shot.mjs → shots/dg_engage_{1_mark,2_hit}.png (W-0175)
// 2나락 적 찍기 — 1층 방에서 먼 적을 화면 좌표로 실제 클릭(짧은 누름) → 찍힘·발밑 고리·쫓아가 그 적만 치나 · 오른쪽 단추 넷 키 글자
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8916, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-dungeon')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(1000, 700);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 200000);
try {
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 5000);
  await c.ev(`DG.account && DG.account.create && DG.account.create('찍기')`);
  await c.go(B + 'index.html', 7000);
  await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
  await sleep(4000);
  for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
  await c.ev(`(function(){ var cs = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cs.length; i++) cs[i].click(); var b = document.querySelector('.stc-btn'); if (b) b.click(); })()`);
  await sleep(2500);
  for (let i = 0; i < 10; i++) { await c.key('Escape', 60); await sleep(200); }
  await c.ev(`DG.dungeon.enter({ floor: 1 })`);
  await sleep(5000);
  /* 적 둘을 세운다 — 가까운 것(오른쪽 20)과 찍을 것(왼쪽 70). 찍을 적의 화면 좌표는 투영(dungeonView 의 역변환)으로 찾는다 */
  const at = JSON.parse(await c.ev(`(function(){
    var D = DG.dungeon, r = D.raw(), p = r.player; r.room.enemies.length = 0; p.invuln = 999;
    var a = D._spawnEnemy(1, false, { spawned: true, x: p.x + 20, y: p.y }), b = D._spawnEnemy(1, false, { spawned: true, x: p.x - 70, y: p.y + 10 });
    a.hp = a.hpMax = 99999; b.hp = b.hpMax = 99999; a.cd = b.cd = 99; a.spd = b.spd = 0; r.room.enemies.push(a, b); window.__ab = [a, b];
    window.__eg = []; var E0 = DG.engage.engage, D0 = DG.engage.drop; DG.engage.engage = function (e) { window.__eg.push('engage'); return E0(e); }; DG.engage.drop = function (p) { if (DG.engage.targetOf(p)) { window.__eg.push('drop ' + String(new Error().stack).split(String.fromCharCode(10))[2].trim().slice(0, 90)); } return D0(p); };
    var cv = document.getElementById('dg-canvas'), rc = cv.getBoundingClientRect(), best = null, bd = 1e9;
    for (var y = 0; y < rc.height; y += 6) { for (var x = 0; x < rc.width; x += 6) {
      var q = DG.engage && DG.dungeonView && DG.dungeonView._unproj ? DG.dungeonView._unproj(x, y) : null; if (!q) continue;
      var d = Math.hypot(q.x - b.x, q.y - b.y); if (d < bd) { bd = d; best = { x: rc.left + x, y: rc.top + y }; } } }
    return JSON.stringify({ pt: best, bd: Math.round(bd), keys: [].map.call(document.querySelectorAll('#dg-actions .dg-act-key'), function (e) { return e.textContent; }) });
  })()`));
  console.log('세움', JSON.stringify(at));
  /* 헤드리스 CDP 는 누름·뗌 사이가 200ms(짧은 누름 문턱)를 넘을 때가 있어 — 안 찍혔으면 두 번까지 다시 누른다(기능이 아니라 점검의 박자) */
  for (let k = 0; k < 3 && at.pt; k++) {
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.pt.x, y: at.pt.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.pt.x, y: at.pt.y, button: 'left', clickCount: 1, pointerType: 'mouse' });
    await sleep(150);
    if (await c.ev('!!DG.engage.targetOf(DG.dungeon.raw().player)')) { console.log('누름', k + 1, '번'); break; }
  }
  await sleep(400);
  console.log('찍음', await c.ev(`JSON.stringify({ target: DG.engage.targetOf(DG.dungeon.raw().player) === window.__ab[1], mark: DG.engage.mark(), log: window.__eg })`));
  await c.shot('dg_engage_1_mark');
  await sleep(3000);
  console.log('3초 뒤', await c.ev(`JSON.stringify({ near: window.__ab[0].hpMax - window.__ab[0].hp, picked: window.__ab[1].hpMax - window.__ab[1].hp })`));
  await c.shot('dg_engage_2_hit');
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard); await c.close(); srv.kill();
