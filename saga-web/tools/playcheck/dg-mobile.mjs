// node saga-web/tools/playcheck/dg-mobile.mjs [--slow] → shots/dg_mobile_*.png (W-0186)
// 2나락 폰 세로(390×844 터치) — ① 마을에 들어가 내 몸·건물이 다 설 때까지 · 던전 첫 방이 설 때까지 시간
// ② 마을에서 아래·오른쪽·왼쪽·위로 8초씩 걸으며 내 머리께의 화면 자리(dungeon3d._meScreen, 0~1) — 세로 0.25~0.68(조이스틱·하단 위) 밖이면 FAIL
// --slow 는 Fast 4G·CPU ×4(로딩 시간용). 기본은 로컬 serve-game(이 저장소 그대로).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SLOW = process.argv.includes('--slow');
const PORT = 8937, srv = spawn(process.execPath, [path.join(HERE, '..', 'serve-game.mjs'), String(PORT), path.join(HERE, '..', '..', 'saga-dungeon')], { stdio: 'ignore' });
await sleep(800);
const c = await launch(390, 844);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); srv.kill(); process.exit(1); }, 480000);
const Y_MIN = 0.25, Y_MAX = 0.68;
let fails = 0;
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  if (SLOW) {
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 1125000, uploadThroughput: 93750 });
    await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const B = `http://127.0.0.1:${PORT}/`;
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} return 1; })()`);
  await c.go(B + 'index.html', 7000);
  await c.ev(`DG.account && DG.account.create && DG.account.create('세로')`);
  await c.go(B + 'index.html', 7000);
  /* ① 마을 — 이어하기 → 출사표 셋 → 마을. 내 몸(meBody ok)·그린 메시 수가 1초 그대로일 때까지 */
  await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) b.click(); })()`);
  await sleep(2500);
  for (let i = 0; i < 6; i++) { await c.key('Escape', 60); await sleep(150); }
  await c.ev(`(function(){ var cs = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cs.length; i++) cs[i].click(); var b = document.querySelector('.stc-btn'); if (b) b.click(); })()`);
  async function settle(label, t0) {
    let last = -1, same = 0, body = '-';
    for (let i = 0; i < 120; i++) {
      const s = JSON.parse(await c.ev(`JSON.stringify({ d: (DG.dungeon3d && DG.dungeon3d.stats && DG.dungeon3d.stats().drawn) || 0, b: (DG.dungeon3d && DG.dungeon3d.meBody && DG.dungeon3d.meBody() || {}).state || '-' })`));
      body = s.b;
      if (s.d > 0 && s.d === last && s.b !== '-' && !/load|pend|wait/.test(s.b)) { same++; if (same >= 4) { return { label, ms: Date.now() - t0 - 1000, drawn: s.d, body }; } } else { same = 0; }
      last = s.d; await sleep(250);
    }
    return { label, ms: -1, drawn: last, body };
  }
  const tT = Date.now();
  const town = await settle('마을', tT);
  for (let i = 0; i < 6; i++) { await c.key('Escape', 60); await sleep(150); }
  const glbList = JSON.parse(await c.ev(`JSON.stringify(performance.getEntriesByType('resource').filter(function (r) { return /\.glb/.test(r.name); }).map(function (r) { return [r.name.split('/').slice(-2).join('/'), Math.round((r.transferSize || r.encodedBodySize || 0) / 1024)]; }).sort(function (a, b) { return b[1] - a[1]; }))`));
  console.log('  큰 GLB', glbList.slice(0, 8).map(function (r) { return r[0] + ' ' + r[1] + 'KB'; }).join(' | '));
  const glbT = JSON.parse(await c.ev(`JSON.stringify(performance.getEntriesByType('resource').filter(function (r) { return /\\.glb/.test(r.name); }).map(function (r) { return r.transferSize || r.encodedBodySize || 0; }))`));
  console.log('마을 섬', town.ms + 'ms', '메시', town.drawn, '몸', town.body, '· GLB', glbT.length + '개', Math.round(glbT.reduce((a, b) => a + b, 0) / 1024) + 'KB');
  /* ② 세로 걷기 — 키를 눌러 둔다 */
  const KEYS = { ArrowDown: 40, ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38 };
  async function hold(code, ms) {
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: code, code, windowsVirtualKeyCode: KEYS[code] });
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { await sleep(500); seen.push(JSON.parse(await c.ev(`JSON.stringify(DG.dungeon3d._meScreen())`))); }
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: code, code, windowsVirtualKeyCode: KEYS[code] });
    return seen.filter(Boolean);
  }
  const out = [];
  for (const [k, ms] of [['ArrowDown', 8000], ['ArrowRight', 8000], ['ArrowLeft', 16000], ['ArrowUp', 16000]]) {
    const s = await hold(k, ms);
    const ys = s.map((p) => p.y), xs = s.map((p) => p.x);
    const yMax = Math.max(...ys), yMin = Math.min(...ys), xMin = Math.min(...xs), xMax = Math.max(...xs);
    const bad = yMax > Y_MAX || yMin < Y_MIN || xMin < 0.05 || xMax > 0.95;
    if (bad) { fails++; }
    out.push(`${k} ${bad ? 'FAIL' : 'ok'} y ${yMin.toFixed(2)}~${yMax.toFixed(2)} x ${xMin.toFixed(2)}~${xMax.toFixed(2)}`);
    if (k === 'ArrowRight') { await c.ev(`(function(){ [].forEach.call(document.querySelectorAll('button'), function (b) { if (b.offsetParent && /물러난다|닫기|닫는다/.test(b.textContent)) { b.click(); } }); return 1; })()`); for (let i = 0; i < 3; i++) { await c.key('Escape', 60); await sleep(150); } await sleep(600); console.log('  →', await c.shot('dg_mobile_town_front')); }   // 앞 끝까지 내려와 오른쪽으로 간 뒤(창은 닫고)
  }
  out.forEach((l) => console.log('세로 걷기', l));
  /* ③ 던전 첫 방 */
  const pD = await c.ev(`performance.now()`);
  const tD = Date.now();
  await c.ev(`DG.dungeon.enter({ floor: 1 })`);
  const dun = await settle('던전', tD);
  console.log('던전 첫 방 섬', dun.ms + 'ms', '메시', dun.drawn);
  const glbD = JSON.parse(await c.ev(`JSON.stringify(performance.getEntriesByType('resource').filter(function (r) { return r.startTime >= ${pD} && /[.]glb/.test(r.name); }).map(function (r) { return [r.name.split('/').slice(-2).join('/'), Math.round((r.transferSize || r.encodedBodySize || 0) / 1024), Math.round(r.startTime - ${pD}), Math.round(r.responseEnd - ${pD})]; }).sort(function (a, b) { return b[1] - a[1]; }))`));
  console.log('  던전 GLB', glbD.length + '개', glbD.reduce((a, r) => a + r[1], 0) + 'KB · 마지막 도착 ' + Math.max(0, ...glbD.map((r) => r[3])) + 'ms · 큰 것 ' + glbD.slice(0, 6).map((r) => r[0] + ' ' + r[1] + 'KB@' + r[3]).join(' | '));
  console.log('  →', await c.shot('dg_mobile_dungeon'));
  const ex = c.logs.filter((l) => /^EXC|error/i.test(l) && !/WebGLProgram|Shader|ERROR: 0:|Program Info|favicon/i.test(l));
  console.log('예외', ex.length ? ex.slice(0, 3).join(' || ').slice(0, 300) : '없음');
} catch (e) { console.log('ERR', e.message); fails++; }
clearTimeout(hard); await c.close(); srv.kill();
console.log(fails ? `DG-MOBILE FAIL ${fails}` : 'DG-MOBILE OK');
process.exit(fails ? 1 : 0);
