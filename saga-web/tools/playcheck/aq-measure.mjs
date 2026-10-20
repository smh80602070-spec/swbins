// W-0338 자동 퀘스트 10분 측정 — 4종횡(saga-story)·3마을(saga-forest). 1만리·2나락은 go-auto-story.mjs·dg-auto-quest.mjs(aq 인자)
// 인자: <판> [초=600] [aq] — aq 면 ▶ 자동 퀘스트(DG.autoQuestSt/Fs.start), 아니면 예전 🤖 자동(DG.auto.setOn)
// 서버 :8871 먼저(node serve.mjs <saga-web> 8871). 새 계정으로 시작한다. 끝에 SUMMARY 한 줄
import { launch, sleep } from './cdp.mjs';
const GAME = process.argv[2];
const AQK = { 'saga-story': 'autoQuestSt', 'saga-forest': 'autoQuestFs' }[GAME];
if (!AQK) { console.log('판은 saga-story · saga-forest'); process.exit(1); }
const B = 'http://127.0.0.1:8871/' + GAME + '/';
const SECS = +(process.argv.slice(3).find((a) => /^\d+$/.test(a)) || 600);
const AQ = process.argv.includes('aq');
const c = await launch(1280, 720);
const hard = setTimeout(() => { console.log('TIMEOUT'); c.close(); process.exit(1); }, (SECS + 150) * 1000);
/* 판별 점수 — 4종횡 바친 사명 수 · 3마을 건넨 부탁 수 + 끝낸 마을 일 */
const SCORE = GAME === 'saga-story'
  ? `(function(){ var q = DG.core.save.quests || {}, n = 0, k; for (k in q) { n += q[k].done || 0; } return n; })()`
  : `(function(){ var v = DG.core.save.village || {}; return (v.helped || 0) + Object.keys(v.quests || {}).length; })()`;
const POS = GAME === 'saga-story'
  ? `(function(){ var r = DG.side.raw(); return r && r.player ? [r.player.x, r.player.y, r.stage.key] : [0, 0, '-']; })()`
  : `(function(){ var r = DG.village.raw(); return r && r.player ? [r.player.x, r.player.y, ''] : [0, 0, '-']; })()`;
try {
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled', { cacheDisabled: true });
  await c.go(B + 'index.html', 6000);
  await c.ev(`(function(){ try { localStorage.clear(); } catch (e) {} })()`);
  await c.go(B + 'index.html', 5000);
  await c.ev(`(function(){ if (!document.getElementById('title-continue') && DG.account && DG.account.create) { DG.account.create('자동'); } })()`);
  await c.go(B + 'index.html', 8000);
  await c.ev(`(function(){ var b = document.getElementById('title-continue'); if (b) { b.click(); } })()`);
  await sleep(4000);
  /* 첫 장면·고르기 창 — 출사표 첫 셋·건너뛰기·닫기 */
  for (let k = 0; k < 8; k++) {
    await c.ev(`(function(){ var cells = document.querySelectorAll('.stc-cell'); for (var i = 0; i < 3 && i < cells.length; i++) { cells[i].click(); } var s = document.querySelector('.stc-btn'); if (s) { s.click(); } if (DG.story && DG.story.isOpen && DG.story.isOpen() && DG.story.close) { DG.story.close(); } var b = Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (x) { return /건너뛰기|닫기|확인|시작/.test(x.innerText) && x.offsetParent; })[0]; if (b) { b.click(); } })()`).catch(() => {});
    await sleep(700);
  }
  const s0 = await c.ev(SCORE);
  await c.ev(AQ ? `DG.${AQK}.start()` : `DG.auto.setOn(true)`);
  const t0 = Date.now(); let lp = null, still = 0, stuck = 0, stop = '', last = '';
  while (Date.now() - t0 < SECS * 1000) {
    await sleep(4000);
    const o = JSON.parse(await c.ev(`JSON.stringify({ s: ${SCORE}, p: ${POS}, st: DG.${AQK}.status(), busy: DG.${AQK}._busy(), doing: DG.auto.status().doing, g: (DG.${AQK}.goals()[0] || {}).label || '-' })`));
    const sec = Math.round((Date.now() - t0) / 1000);
    if (AQ && !o.st.on && !stop) { stop = sec + 's ' + o.st.why; console.log('▶ 멈춤', stop); }
    if (!o.busy && lp && Math.hypot(o.p[0] - lp[0], o.p[1] - lp[1]) < (GAME === 'saga-story' ? 20 : 40)) { still += 4; if (still === 32) { stuck++; console.log('막힘', Math.round(o.p[0]), Math.round(o.p[1]), o.p[2]); } } else { still = 0; }
    lp = o.p;
    const line = '점수 ' + o.s + ' · ' + o.g + ' · ' + o.doing + (o.p[2] ? ' · ' + o.p[2] : '');
    if (line.replace(/\d+/g, '') !== last) { console.log(sec + 's', line.slice(0, 180)); last = line.replace(/\d+/g, ''); }
  }
  const s1 = await c.ev(SCORE);
  console.log('SUMMARY ' + GAME + ' ' + (AQ ? 'aq' : 'auto') + ' ' + SECS + 's · ' + (GAME === 'saga-story' ? '바친 사명' : '건넨 부탁+마을 일') + ' ' + s0 + ' → ' + s1 + ' (+' + (s1 - s0) + ') · 막힘 ' + stuck + (stop ? ' · ▶ 멈춤 ' + stop : ''));
  await c.ev(AQ ? `DG.${AQK}.stop('측정 끝')` : `DG.auto.setOn(false)`);
  const ex = c.logs.filter((l) => /^EXC/.test(l));
  if (ex.length) { console.log(ex.slice(0, 5).join('\n')); }
} catch (e) { console.log('ERR', e.message); }
clearTimeout(hard);
setTimeout(() => process.exit(0), 1500);
await c.close();
process.exit(0);
