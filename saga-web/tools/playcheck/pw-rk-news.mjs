// 사가천하 영내 소식(W-0105) — 실제 판에서 ▶ 다음 달을 눌러 소식 카드(태수 초상·한 줄·3택)를 띄우고 💡 금 갈래를 실제로 누른다.
//   node pw-rk-news.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 준비는 pw-rk-sheet 와 같다(시나리오·세력 실제 단추). 소식이 꼭 뜨게 손잡이 rtk.newsChance 1·rtk.eventChance 0 으로 붙든다.
// 시나리오 카드(사람 몫 원천이 앞)는 DG_NO_SCENARIO 로 끄고, 다른 카드는 닫는다. 사진은 shots/qc/ 에(세션이 Read 로 본다).
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-rk-news.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-realm');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
fs.mkdirSync('shots/qc', { recursive: true });
const cardOpen = () => ev(() => { var e = document.getElementById('encounter'); return !!(e && e.classList.contains('show')); });
const pendingId = () => ev(() => { var v = DG.event.view(); return v ? v.id : null; });

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);
  await page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);
  await ev(() => { window.DG_NO_SCENARIO = true; DG.core.setTune('rtk.newsChance', 1); DG.core.setTune('rtk.eventChance', 0); });   // 시나리오 카드(사람 몫 원천)는 끈다

  let news = null;
  /* ▶ 다음 달 → 이달 요약 카드가 앞에 서고 사연 카드는 그 뒤 줄에 선다(showEncQueued) — 앞 카드를 닫아 가며 소식 카드가 보일 때까지 */
  const visPick = () => ev(() => !!document.querySelector('#encounter.show [data-act="ev-pick"]'));
  for (let step = 0; step < 30 && !news; step++) {
    const id = await pendingId(), pick = await visPick();
    if (id && /^news_/.test(id) && pick) { news = id; break; }
    if (await cardOpen()) {
      if (id && pick) { await page.locator('#encounter [data-act="ev-pick"]:not([disabled])').first().click(); } else { await ev(() => { DG.ui.closeEnc(); }); }
      await sleep(500);
    } else {
      await page.locator('[data-act="next-month"]').click(); await sleep(1800);
    }
  }
  const card = await ev(() => { var e = document.getElementById('encounter'), v = DG.event.view(); return { text: e ? e.innerText : '', pt: !!(e && e.querySelector('img.pt')), btns: e ? e.querySelectorAll('[data-act="ev-pick"]').length : 0, speaker: v && v.speaker, line: v && v.line, gold: DG.rtk.myForce().gold }; });
  await page.screenshot({ path: 'shots/qc/saga-realm-news.png' });
  check('▶ 다음 달 → 영내 소식 카드 — 태수 초상·이름·한 줄·세 갈래(💡⚔️🛡️)',
    !!news && card.pt && card.btns === 3 && !!card.speaker && card.text.indexOf(card.line) >= 0 && /💡/.test(card.text) && /⚔️/.test(card.text) && /🛡️/.test(card.text), JSON.stringify({ news, card: Object.assign({}, card, { text: card.text.slice(0, 200) }) }));

  await page.locator('[data-act="ev-pick"][data-k="util"]').click(); await sleep(600);
  const after = await ev(() => ({ gold: DG.rtk.myForce().gold, pending: !!DG.event.view() }));
  check('💡 금 갈래를 실제로 누르면 세력 금이 오르고 카드가 닫힌다', after.gold > card.gold && !after.pending, JSON.stringify({ before: card.gold, after }));
  await ev(() => { DG.core.setTune('rtk.newsChance', null); DG.core.setTune('rtk.eventChance', null); });
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rk-news.json', JSON.stringify({ script: 'pw-rk-news.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
