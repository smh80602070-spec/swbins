// 사가고 Q3 뒤 — 집 벽이 모델 크기로 커진 뒤 이야기 인물이 벽 안에 들어 말을 못 거는 자리가 없나(말 거는 거리 안에 벽 밖 땅이 있나)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, 150000);
try {
  await c.send('Network.enable');
  await c.send('Network.setBypassServiceWorker', { bypass: true });
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('테스트'); } })()`);   // 프로필이 비었으면 새 계정
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await c.ev(`DG.perf.pin('HIGH')`);
  let last = -1; for (let i = 0; i < 20; i++) { await sleep(1500); const n = await c.ev('DG.prop3d.arrivedCount()'); if (n === last) break; last = n; }
  const out = await c.ev(`(function(){
    var S = DG.story, W = DG.world, R = 6, n = 0, inside = [], stuck = [];
    for (var ch = 0; ch < S.CHAPTERS.length; ch++) {
      var steps = S.CHAPTERS[ch].steps;
      for (var si = 0; si < steps.length; si++) {
        var st = steps[si]; if (!st.npc) { continue; }
        var p = S.npcPos(st.npc, ch, si); if (!p) { continue; }
        n++;
        if (!W.wallAt(p.x, p.y)) { continue; }
        inside.push((ch + 1) + '장' + (si + 1) + ':' + st.npc);
        var ok = false;                                         // 말 거는 거리(6m) 안에 벽 밖 자리가 있나
        for (var a = 0; a < 32 && !ok; a++) for (var d = 0.5; d <= R; d += 0.5) {
          if (!W.wallAt(p.x + Math.cos(a / 32 * Math.PI * 2) * d, p.y + Math.sin(a / 32 * Math.PI * 2) * d)) { ok = true; break; }
        }
        if (!ok) { stuck.push((ch + 1) + '장' + (si + 1) + ':' + st.npc + '@' + p.x.toFixed(0) + ',' + p.y.toFixed(0)); }
      }
    }
    return '인물 자리 ' + n + ' · 벽 안 ' + inside.length + (inside.length ? ' [' + inside.slice(0, 12).join(' ') + ']' : '') + ' · 못 닿음 ' + stuck.length + (stuck.length ? ' [' + stuck.join(' ') + ']' : '');
  })()`);
  console.log(out);
  await c.ev(`DG.perf.unpin()`);
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
