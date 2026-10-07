// 사가나락 Q7 — 🤖 자동(📜 퀘스트)을 켜 두고 지역 사연·메인 퀘스트가 저절로 나가는지
// 인자: 초(기본 240) · fresh(새 계정 — 출사표 첫 셋)
import { launch, sleep } from './cdp.mjs';
const B = 'http://127.0.0.1:8871/saga-dungeon/';
const SECS = +(process.argv.find((a) => /^\d+$/.test(a)) || 240);
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 120) * 1000);
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  if (process.argv.includes('fresh')) { await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} })()`); await c.go(B + 'index.html', 5000); }
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('자동'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b=document.getElementById('title-continue'); if(b){ b.click(); } })()`);
  await sleep(3000);
  await c.ev(`(function(){ var cells = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cells.length; i++) { cells[i].click(); } var b = document.querySelector('.stc-btn'); if (b) { b.click(); } })()`);   // 출사표 — 첫 셋
  await sleep(4000);
  await c.ev(`(function(){ DG.auto.setOn(true); var x = document.querySelector('.sheet-close, [data-act=close]'); if (x) { x.click(); } })()`);
  const t0 = Date.now(); let last = '', lastT = 0;
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(4000);
    const r = await c.ev(`(function(){
      DG.core.persist();                               // 헤드리스는 창 닫기(beforeunload) 저장을 건너뛴다
      var q = DG.core.save.quest || {}, ch = q.chain || {}, cs = Object.keys(ch).map(function (k) { return k + ':' + (ch[k].done ? '끝' : ch[k].step + '/' + ch[k].have); }).join(' ');
      var st = DG.dungeon.status();
      return '메인 ' + (q.mainIdx || 0) + '(' + (q.mainHave || 0) + ') · 사연 ' + (cs || '-') + ' · 최고 ' + st.best + '층 · ' + (DG.dungeon.active() ? '던전 ' + st.floor + '층' : '들판') + ' · ' + DG.auto.status().doing;
    })()`);
    const key = r.replace(/\d+보|\d+마리/g, '');
    if (key !== last || Date.now() - lastT > 30000) { console.log(Math.round((Date.now() - t0) / 1000) + 's', r.slice(0, 200)); last = key; lastT = Date.now(); }
  }
  await c.shot('dg_auto_quest_end');
  await c.ev(`DG.auto.setOn(false); DG.core.persist();`);
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 5).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
