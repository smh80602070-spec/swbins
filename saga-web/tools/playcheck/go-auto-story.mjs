// 사가만리 Q5 — 🤖 자동 순행(📖 이야기)을 켜 두고 이야기가 저절로 몇 단계 나가는지 · 어디서 멎는지
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
  /* W-0337 aq = ▶ 자동 퀘스트(DG.autoQuestGo)로 켠다 · 없으면 예전처럼 🤖 순행 */
  const AQ = process.argv.includes('aq');
  await c.ev(`DG.perf.pin('LOW'); DG.core.save.settings.autoBattle = true; ` + (AQ ? `DG.autoQuestGo.start();` : `DG.auto.setOn(true);`));
  const t0 = Date.now(); let last = '', lastT = 0;
  /* 요약 — 이야기 단계 진척 · 막힘(대화·전투·창 아닌데 1m 안에 30초+ 머문 구간) · 사명 진척 */
  const sum = { step0: null, step1: null, stuck: 0, stuckAt: [], still: 0, lp: null, q0: null, q1: null, aqStop: '' };
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(4000);
    const m = await c.ev(`(function(){ var S = DG.story, sv = S.state(), p = DG.core.save.player.pos, G = DG.autoQuestGo, Q = DG.quest;
      return JSON.stringify({ k: sv.ch * 100 + sv.step, x: p.x, y: p.y, busy: G ? G._busy() : false, q: Q ? Q.list().reduce(function (a, q) { return a + q.got; }, 0) + Q.state().done * 1000 : 0,
        aq: G ? G.status() : null }); })()`);
    const o = JSON.parse(m);
    if (sum.step0 === null) { sum.step0 = o.k; sum.q0 = o.q; }
    sum.step1 = o.k; sum.q1 = o.q;
    if (AQ && o.aq && !o.aq.on && !sum.aqStop) { sum.aqStop = Math.round((Date.now() - t0) / 1000) + 's ' + o.aq.why; console.log('▶ 멈춤', sum.aqStop); }
    if (!o.busy && sum.lp && Math.hypot(o.x - sum.lp.x, o.y - sum.lp.y) < 1) { sum.still += 4; if (sum.still === 32) { sum.stuck++; sum.stuckAt.push('(' + Math.round(o.x) + ',' + Math.round(o.y) + ')@' + Math.round((Date.now() - t0) / 1000) + 's'); } }
    else { sum.still = 0; }
    sum.lp = { x: o.x, y: o.y };
    const r = await c.ev(`(function(){
      var S = DG.story, sv = S.state(), st = S.step(), p = DG.core.save.player.pos;
      return (sv.ch + 1) + '장 ' + (sv.step + 1) + '단계 ' + (st ? st.type : '-') + (st && st.type === 'gather' ? ' ' + S.gathered() + '/' + st.count : '') + ' · ' + DG.auto.status().doing + ' · (' + Math.round(p.x) + ',' + Math.round(p.y) + ')' +
        (document.body.classList.contains('sheet-open') ? ' · [창 열림]' : '') + (DG.encounter.active ? ' · [조우]' : '') + (function(){ var FS = DG.fieldCombat.state(); if (!FS) return ''; var me = FS.party.map(function(m){ return Math.round(m.hp) + (m.down ? '↓' : ''); }).join('/'), g = ''; for (var u in FS.foes) { var f = FS.foes[u]; if (!f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 40) g += ' ' + f.name + ' ' + Math.round(f.hp) + '/' + f.hpMax + (f.shield > 0 ? '+방패' + Math.round(f.shield) : '') + ' ' + f.st; } return ' · 나 ' + me + g; })();
    })()`);
    const key = r.replace(/\d+m|\(-?\d+,-?\d+\)/g, '');
    if (key !== last || Date.now() - lastT > 30000) { console.log(Math.round((Date.now() - t0) / 1000) + 's', r); last = key; lastT = Date.now(); }
  }
  const st = (k) => (Math.floor(k / 100) + 1) + '장 ' + (k % 100 + 1) + '단계';
  console.log('SUMMARY ' + (AQ ? 'aq' : 'auto') + ' ' + SECS + 's · 이야기 ' + st(sum.step0) + ' → ' + st(sum.step1) + ' (+' + (sum.step1 - sum.step0) + ' 단계, 장 넘김은 100) · 막힘 ' + sum.stuck + (sum.stuckAt.length ? ' ' + sum.stuckAt.join(' ') : '') + ' · 사명 진척 +' + (sum.q1 - sum.q0) + (sum.aqStop ? ' · ▶ 멈춤 ' + sum.aqStop : ''));
  if (AQ) { console.log('AQLOG ' + await c.ev(`JSON.stringify(DG.autoQuestGo.q.log())`)); }
  await c.shot('go_auto_story_end');
  await c.ev(`DG.auto.setOn(false); DG.core.save.settings.autoBattle = false; DG.perf.unpin(); DG.core.setTune('perf.auto', null);`);
  if (c.logs.length) { console.log(c.logs.slice(0, 6).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
