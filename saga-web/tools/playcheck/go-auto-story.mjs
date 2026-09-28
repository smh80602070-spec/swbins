// 사가고 Q5 — 🤖 자동 순행(📖 이야기)을 켜 두고 이야기가 저절로 몇 단계 나가는지 · 어디서 멎는지
// 인자: 초(기본 240) · fresh(새 계정으로 1장부터)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-go/';
const SECS = +(process.argv.find((a) => /^\d+$/.test(a)) || 240);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 90) * 1000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  if (process.argv.includes('fresh')) { await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} })()`); await c.go(B + 'index.html', 5000); }
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('자동'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(5000);
  await c.ev(`DG.perf.pin('LOW'); DG.core.save.settings.autoBattle = true; DG.auto.setOn(true);`);
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(4000);
    const r = await c.ev(`(function(){
      var S = DG.story, sv = S.state(), st = S.step(), p = DG.core.save.player.pos;
      return (sv.ch + 1) + '장 ' + (sv.step + 1) + '단계 ' + (st ? st.type : '-') + ' · ' + DG.auto.status().doing + ' · (' + Math.round(p.x) + ',' + Math.round(p.y) + ')' +
        (document.body.classList.contains('sheet-open') ? ' · [창 열림]' : '') + (DG.encounter.active ? ' · [조우]' : '');
    })()`);
    const key = r.replace(/\d+m|\(-?\d+,-?\d+\)/g, '');
    if (key !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', r); last = key; }
  }
  await c.shot('go_auto_story_end');
  await c.ev(`DG.auto.setOn(false); DG.core.save.settings.autoBattle = false; DG.perf.unpin(); DG.core.setTune('perf.auto', null);`);
  if (c.logs.length) { console.log(c.logs.slice(0, 6).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
