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
  const AQ = process.argv.includes('aq');   // W-0338 ▶ 자동 퀘스트로 켠다
  await c.ev(`(function(){ ` + (AQ ? 'DG.autoQuestDg.start();' : 'DG.auto.setOn(true);') + ` var x = document.querySelector('.sheet-close, [data-act=close]'); if (x) { x.click(); } })()`);
  const t0 = Date.now(); let last = '', lastT = 0;
  const sum = { a: null, b: null, stuck: 0, still: 0, lp: null, stop: '' };   // 요약 — 끝낸 사연 걸음·메인 · 막힘(던전·창 밖에서 20보 안에 32초+)
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(4000);
    const r = await c.ev(`(function(){
      DG.core.persist();                               // 헤드리스는 창 닫기(beforeunload) 저장을 건너뛴다
      var q = DG.core.save.quest || {}, ch = q.chain || {}, cs = Object.keys(ch).map(function (k) { return k + ':' + (ch[k].done ? '끝' : ch[k].step + '/' + ch[k].have); }).join(' ');
      var st = DG.dungeon.status();
      return '메인 ' + (q.mainIdx || 0) + '(' + (q.mainHave || 0) + ') · 사연 ' + (cs || '-') + ' · 최고 ' + st.best + '층 · ' + (DG.dungeon.active() ? '던전 ' + st.floor + '층' : '들판') + ' · ' + DG.auto.status().doing;
    })()`);
    const m = JSON.parse(await c.ev(`(function(){ var q = DG.core.save.quest || {}, ch = q.chain || {}, n = 0, k; for (k in ch) { n += ch[k].done ? 4 : ch[k].step; } var T = DG.town.raw ? DG.town.raw() : null, p = T && T.player, G = DG.autoQuestDg; return JSON.stringify({ main: q.mainIdx || 0, ch: n, x: p ? p.x : 0, y: p ? p.y : 0, busy: G ? G._busy() : DG.dungeon.active(), aq: G ? G.status() : null }); })()`));
    if (!sum.a) { sum.a = m; } sum.b = m;
    if (AQ && m.aq && !m.aq.on && !sum.stop) { sum.stop = Math.round((Date.now() - t0) / 1000) + 's ' + m.aq.why; console.log('▶ 멈춤', sum.stop); }
    if (!m.busy && sum.lp && Math.hypot(m.x - sum.lp.x, m.y - sum.lp.y) < 20) { sum.still += 4; if (sum.still === 32) { sum.stuck++; console.log('막힘', Math.round(m.x), Math.round(m.y)); } } else { sum.still = 0; }
    sum.lp = { x: m.x, y: m.y };
    const key = r.replace(/\d+보|\d+마리/g, '');
    if (key !== last || Date.now() - lastT > 30000) { console.log(Math.round((Date.now() - t0) / 1000) + 's', r.slice(0, 200)); last = key; lastT = Date.now(); }
  }
  console.log('SUMMARY ' + (AQ ? 'aq' : 'auto') + ' ' + SECS + 's · 메인 ' + sum.a.main + ' → ' + sum.b.main + ' (+' + (sum.b.main - sum.a.main) + ') · 사연 걸음 +' + (sum.b.ch - sum.a.ch) + ' · 막힘 ' + sum.stuck + (sum.stop ? ' · ▶ 멈춤 ' + sum.stop : ''));
  await c.shot('dg_auto_quest_end');
  await c.ev(`DG.auto.setOn(false); DG.core.persist();`);
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 5).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
