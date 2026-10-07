// 사가종횡 레벨업 3택·결과 등급(W-0104) — 실제 판에서 레벨을 올려 「📜 무예 3택」 단추를 누르고 하나를 고른 뒤,
// 사냥터에 들어갔다 나와 세션 카드의 등급 한 줄을 본다.
//   node pw-st-pick.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 준비는 pw-st-close1 과 같다(새 계정 → title-continue → 이야기 장면 Esc). 레벨·직업은 세이브 값을 바로 놓고, 경험치는 core.gainExp 로 준다.
// 사진 둘은 shots/qc/ 에(세션이 Read 로 본다). Math.random 은 진단과 같은 씨앗 mulberry32(20260824).
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-st-pick.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-story');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const skipScenes = async () => { for (let i = 0; i < 12 && await ev(() => !!(DG.story && DG.story.isOpen && DG.story.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); } };
fs.mkdirSync('shots/qc', { recursive: true });

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(4000);
  await skipScenes();

  /* 새 판은 spCutLv 1 — Lv.12 무사로 놓고 한 레벨 올린다 */
  const lv = await ev(() => {
    var s = DG.core.save, cut0 = s.spCutLv;
    s.player.level = 12; s.spCutLv = 12; DG.job.join('warrior');
    var l0 = s.player.level; DG.core.gainExp(DG.core.expNeed(s.player.level));
    return { cut0: cut0, l0: l0, l1: s.player.level, offers: (s.offers || []).length };
  });
  await sleep(600);
  const btnShown = await ev(() => { var b = document.getElementById('levelpick-btn'); return !!(b && b.style.display !== 'none'); });
  await page.locator('#levelpick-btn').click(); await sleep(500);
  const win = await ev(() => ({ open: DG.levelPick.isOpen(), opts: document.querySelectorAll('[data-lp-pick]').length, decline: !!document.querySelector('[data-lp-decline]') }));
  await page.screenshot({ path: 'shots/qc/saga-story-levelpick.png' });
  check('레벨업 3택 — 새 판은 cut 1, 레벨이 오르면 「📜 무예 3택」 단추가 서고 실제로 누르면 무예 셋 + 거절 창이 열린다',
    lv.cut0 === 1 && lv.l1 > lv.l0 && lv.offers >= 1 && btnShown && win.open && win.opts === 3 && win.decline, JSON.stringify({ lv, btnShown, win }));
  const before = await ev(() => { var o = DG.job.offer(); return { key: o.keys[0], lv: DG.job.levelOf(o.keys[0]), sp: DG.job.spLeft(), n: DG.core.save.offers.length }; });
  await page.locator('[data-lp-pick="0"]').click(); await sleep(500);
  const after = await ev((k) => ({ lv: DG.job.levelOf(k), sp: DG.job.spLeft(), n: DG.core.save.offers.length }), before.key);
  check('3택 하나를 실제로 누르면 그 무예 +1 · 강화 점수 그대로 · 장 하나가 줄어든다', after.lv === before.lv + 1 && after.sp === before.sp && after.n === before.n - 1, JSON.stringify({ before, after }));
  await ev(() => { if (DG.levelPick.isOpen()) { DG.levelPick.close(); } DG.core.save.offers = []; DG.levelPick.paint(); });

  /* 사냥터 한 판 → 세션 카드 등급 한 줄 */
  /* 세 마리 문턱(MIN_KILLS) — 잡기·타격은 side.js 가 쏘는 것과 같은 신호로 흉내(카드 한 줄 표시 확인이 목적) */
  await ev(() => { var st = DG.sideData.STAGES[0]; DG.side.enter(st.key); for (var i = 0; i < 90; i++) { DG.side.update(1 / 60); } for (var k = 0; k < 6; k++) { DG.runRank.onHit(); } for (k = 0; k < 3; k++) { DG.core.emit('side:kill', { ref: {}, boss: false, lv: 1, stage: st.key }); } });
  await sleep(300);
  await ev(() => { DG.side.leave(); });
  await sleep(800);
  const card = await ev(() => { var b = document.getElementById('sheet-body'); return b ? b.innerText : ''; });
  await page.screenshot({ path: 'shots/qc/saga-story-rankcard.png' });
  check('사냥터에서 나오면 세션 카드에 "⭐ 이번 판 등급" 한 줄이 선다', /⭐ 이번 판 등급 [SABC] — 피격 \d+ · 콤보 \d+ · \d+:\d\d/.test(card), card.slice(0, 300));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-st-pick.json', JSON.stringify({ script: 'pw-st-pick.mjs', game: 'saga-story', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
