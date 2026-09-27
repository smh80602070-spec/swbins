// 사가고 Q6 — 들판 무리 하나와 싸워 잰다: 다 잡는 데 걸린 시간 · 프레임(평균·99분위·긴 프레임) · 나와 적 거리 · 카메라 거리 · 사진
// 인자: auto(기본 — 🤖 자동 전투가 누른다) | keys(J 연타·E 쿨마다)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const MODE = process.argv[2] || 'auto';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 200000);
try {
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.core.setTune('world3d.dayNight', 0); DG.perf.pin('HIGH');`);
  // 가장 가까운 무리(보통 꼴) — 없으면 걸어 찾는다
  let camp = null;
  for (let k = 0; k < 8 && !camp; k++) {
    camp = JSON.parse(await c.ev(`(function(){
      var S = DG.fieldCombat.state(), p = DG.core.save.player.pos, best = null, bd = 1e9;
      if (!S) return 'null';
      for (var key in S.camps) { var cp = S.camps[key]; if (cp.kind === 'guard' || cp.sky) continue; var d = Math.hypot(cp.x - p.x, cp.y - p.y); if (d < bd) { bd = d; best = cp; } }
      return JSON.stringify(best && { key: best.key, x: best.x, y: best.y, tier: best.tier, kind: best.kind, n: best.uids.length });
    })()`));
    if (!camp) { await c.ev(`DG.core.save.player.pos.x += 300`); await sleep(1500); }
  }
  if (!camp) { throw new Error('무리 없음'); }
  console.log('무리', JSON.stringify(camp));
  await c.ev(`(function(){ var p = DG.core.save.player.pos; p.x = ${camp.x} - 16; p.y = ${camp.y}; })()`);
  await sleep(2500);                              // 모델이 오게
  // 프레임 계측
  await c.ev(`(function(){ window.__ft = []; var last = performance.now(); (function f(t){ window.__ft.push(t - last); last = t; requestAnimationFrame(f); })(performance.now()); })()`);
  if (MODE === 'auto') { await c.ev(`DG.core.save.settings.autoBattle = true`); }
  const t0 = Date.now(); const rows = [];
  const PROF = process.argv.includes('prof'); if (PROF) { await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 1000 }); }
  // 무리 쪽으로 걸어 들어간다(D 키 = 동쪽, yaw 0)
  for (let s = 0; s < (process.argv.includes('short') ? 14 : 90); s++) {
    if (s < 3) { await c.key('d', 700); } else if (MODE === 'keys') { await c.key('j', 60); await sleep(150); await c.key('e', 40); await c.key('j', 60); await sleep(150); } else { await sleep(500); }
    const r = JSON.parse(await c.ev(`(function(){
      var S = DG.fieldCombat.state(), p = DG.core.save.player.pos, cp = S.camps['${camp.key}'], alive = 0, hp = 0, nd = 1e9;
      if (cp) cp.uids.forEach(function(u){ var f = S.foes[u]; if (f && f.hp > 0) { alive++; hp += f.hp; nd = Math.min(nd, Math.hypot(f.x - p.x, f.y - p.y)); window.__bd = DG.fieldCombat.BODY ? DG.fieldCombat.BODY(f) : 0; } });
      var m = S.party[S.active], cam = DG.world3d.camera ? DG.world3d.camera() : null;
      var cd = cam ? Math.hypot(cam.position.x - p.x, cam.position.z - p.y) : -1;
      return JSON.stringify({ body: +(window.__bd || 0).toFixed(1), alive: alive, hp: Math.round(hp), nd: nd < 1e9 ? +nd.toFixed(1) : null, me: m ? Math.round(m.hp) + '/' + Math.round(m.hpMax) : '-', eng: DG.fieldCombat.engaged(S), cam: +cd.toFixed(1), kills: S.kills, gl: DG.world3d.stats().gl, ft: (function(){ var a = window.__ft || [], n = a.length, r = a.slice(Math.max(0, n - (window.__ftN || 0) > 0 ? (window.__ftN || 0) : 0)); window.__ftN = n; return r.length ? Math.round(r.reduce(function(x,y){return x+y;},0) / r.length) : null; })() });
    })()`));
    rows.push(r);
    if (s === 4 || s === 10 || s === 20) { await c.shot('go_combat_' + MODE + '_' + s); }
    if (PROF && s === 5) { await c.send('Profiler.start'); }
    if (PROF && s === 25) { const pr = await c.send('Profiler.stop'); const P = pr.result.profile, self = {}, byId = {}; P.nodes.forEach((n) => { byId[n.id] = n; }); const dt = {}; for (let i = 0; i < P.samples.length; i++) { dt[P.samples[i]] = (dt[P.samples[i]] || 0) + (P.timeDeltas[i] || 0); } P.nodes.forEach((n) => { const k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (dt[n.id] || 0); }); const tot = Object.values(self).reduce((a, b) => a + b, 0); console.log('PROFILE 자기 시간 상위(전체 ' + (tot / 1e6).toFixed(1) + 's)'); Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log('  ' + (v / tot * 100).toFixed(1) + '%', k)); break; }
    if (s > 3 && r.alive === 0) { break; }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const ft = JSON.parse(await c.ev(`(function(){ var a = window.__ft.slice(5).sort(function(x,y){return x-y;}); var sum = 0; a.forEach(function(v){ sum += v; }); return JSON.stringify({ n: a.length, avg: +(sum / a.length).toFixed(1), p99: +a[Math.floor(a.length * 0.99)].toFixed(1), long: a.filter(function(v){ return v > 100; }).length, max: +a[a.length-1].toFixed(0) }); })()`));
  rows.forEach((r, i) => { if (i % 3 === 0 || i < 8 || r.alive === 0) console.log(i, JSON.stringify(r)); });
  console.log('걸린 시간(실시간)', secs, 's · 프레임', JSON.stringify(ft), '· fps', (1000 / ft.avg).toFixed(0));
  await c.shot('go_combat_' + MODE + '_end');
  await c.ev(`DG.perf.unpin(); DG.core.setTune('perf.auto', null); DG.core.save.settings.autoBattle = false;`);
  if (c.logs.length) { console.log(c.logs.slice(0, 6).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
