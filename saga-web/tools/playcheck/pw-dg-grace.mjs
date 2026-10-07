// 사가나락 은총·사망 카드(W-0102) — 실제 판에서 쓰러져 카드 세 줄을 보고, 「🕯️ 은총에서 다시」 단추를 실제로 눌러 같은 층 들머리에 선다.
//   node pw-dg-grace.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 쓰러뜨리기는 진단과 같은 길(`DG.dungeon._hurt` 에 적 개체를 넘긴다 — 마지막 피해 기록). 사진 두 장은 shots/qc/ 에(세션이 Read 로 본다).
// Math.random 은 진단과 같은 씨앗 mulberry32(20260824). **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-dg-grace.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const mobile = process.argv.includes('--mobile');
const r = await open('saga-dungeon', mobile ? { w: 412, h: 915, mobile: true } : {});
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
const tag = mobile ? '-phone' : '';
fs.mkdirSync('shots/qc', { recursive: true });

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(2500);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  const cells = page.locator('#starter-host .stc-cell');
  for (let i = 0; i < 3; i++) { await cells.nth(i).click(); await sleep(150); }
  await page.locator('#starter-host .stc-btn').first().click(); await sleep(1500);
  for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }

  /* 제3층에 들어가 노획물을 들고 쓰러진다 */
  await ev(() => { DG.dungeon.enter({ floor: 3 }); });
  await sleep(2000);
  await ev(() => {
    var raw = DG.dungeon.raw(); raw.loot.gold = 120; raw.player.invuln = 0; raw.hp = 1;
    DG.dungeon._hurt(9999, 'fire', { ref: { name: '불꽃 도깨비' } });
  });
  await sleep(1500);
  const card = await ev(() => { var b = document.querySelector('[data-grace-restart]'), c = b && b.closest('.enc-card'); return { btn: !!b, text: c ? c.innerText : '', active: DG.dungeon.active() }; });
  await page.screenshot({ path: 'shots/qc/saga-dungeon-grace-card' + tag + '.png' });
  check('사망 카드 — 어디서(제3층)·누구(불꽃 도깨비)·무슨 피해(불)·남는 것 줄과 「은총에서 다시」 단추가 선다',
    card.btn && !card.active && /제3층/.test(card.text) && /불꽃 도깨비/.test(card.text) && /불 피해/.test(card.text) && /남는 것/.test(card.text), JSON.stringify(card).slice(0, 400));

  /* 단추를 실제로 누른다 — 카드가 닫히고 같은 층 들머리에 체력 가득으로 선다 */
  await page.locator('[data-grace-restart]').first().click();
  await sleep(2500);
  const back = await ev(() => { var raw = DG.dungeon.raw(); return { active: DG.dungeon.active(), floor: raw && raw.floor, room: raw && raw.roomIdx, hp: raw && raw.hp, max: raw && raw.hpMax, grave: !!(raw && raw.room && raw.room.grave), card: !!document.querySelector('[data-grace-restart]') }; });
  await page.screenshot({ path: 'shots/qc/saga-dungeon-grace-back' + tag + '.png' });
  check('「은총에서 다시」 한 번 — 카드가 닫히고 제3층 들머리(1번째 방)에 체력 가득으로 서며 유품 표식이 그 층에 있다',
    back.active && back.floor === 3 && back.room === 0 && back.hp === back.max && back.grave && !back.card, JSON.stringify(back));
  await ev(() => { DG.dungeon.leave(); });
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-grace' + tag + '.json', JSON.stringify({ script: 'pw-dg-grace.mjs', game: 'saga-dungeon', mobile, pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
