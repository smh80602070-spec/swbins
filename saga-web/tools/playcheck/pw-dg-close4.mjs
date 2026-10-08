// 사가나락 확인 닫기 ④(2026-10-08, D1 → D2) — 들판 이벤트(정예가 지키는 보물·방랑 상인) · 프레임 예외 캐치 · 부팅 예외 배너를 실제 판에서 한 번씩.
//   node pw-dg-close4.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 들판 이벤트는 마을 틱이 90초·60초마다 부르는 같은 함수(dungeon.spawnFieldTreasure/Merchant)를 마을 ctx 로 바로 부른다(확률 굴림만 0 으로).
// 부팅 배너는 core.load 를 한 번 던지게 갈아 끼운 새 판에서 본다. **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-dg-close4.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r = await open('saga-dungeon');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(SEED);
let expected = [];

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
  await sleep(1500);

  /* dg.dungeon-8 — 들판 이벤트: 정예가 지키는 보물 · 방랑 상인. 마을 틱이 부르는 함수 그대로(굴림만 통과) */
  const fe = await ev(() => {
    var D = DG.dungeon, T = DG.town, ctx = T.raw(), keep = Math.random, out = {};
    var foes0 = (ctx.room.enemies || []).length, npc0 = (ctx.room.npcs || []).filter((n) => n.fieldMerchant).length;
    /* 확률 굴림(각 함수의 첫 굴림)만 통과시키고 자리 고르기는 원래 씨앗 그대로 */
    /* 마을 한가운데(안전 반경 1300 안)에서는 안 서는 게 맞다 — 들판으로 나가서 부른다 */
    var cx0 = ctx.anchor.x + ctx.roomW * 0.5, cy0 = ctx.anchor.y + ctx.roomH * 0.5; ctx.player.x = cx0 + 1700; ctx.player.y = cy0;
    var pass1 = function (fn) { var first = true; Math.random = function () { if (first) { first = false; return 0.01; } return keep(); }; try { fn(ctx); } finally { Math.random = keep; } };
    pass1(D.spawnFieldTreasure); pass1(D.spawnFieldMerchant);
    var foes = ctx.room.enemies || [], guards = foes.filter((e) => e.treasureGuard);
    var merch = (ctx.room.npcs || []).filter((n) => n.fieldMerchant);
    out = { townActive: T.active(), foes0: foes0, foes1: foes.length, guard: guards[0] ? { elite: !!guards[0].elite, field: !!guards[0].field, name: guards[0].name } : null,
      npc0: npc0, merch: merch.length, mname: merch[0] && merch[0].name, mx: merch[0] ? Math.round(Math.hypot(merch[0].x - ctx.player.x, merch[0].y - ctx.player.y)) : -1 };
    /* 같은 것이 이미 서 있으면 또 안 선다(한 번에 하나) */
    pass1(D.spawnFieldTreasure); pass1(D.spawnFieldMerchant);
    out.guards2 = (ctx.room.enemies || []).filter((e) => e.treasureGuard).length;
    out.merch2 = (ctx.room.npcs || []).filter((n) => n.fieldMerchant).length;
    return out;
  });
  check('dg.dungeon-8 들판 이벤트 — 보물 지킴이(정예) 하나와 방랑 상인 하나가 들판에 서고, 이미 서 있으면 또 안 선다',
    fe.townActive && fe.guard && fe.guard.elite && fe.guard.field && fe.merch === 1 && fe.mx > 0 && fe.guards2 === 1 && fe.merch2 === 1, JSON.stringify(fe));

  /* dg.game-2 ① 프레임 예외 캐치 — 루프 안(미니맵 틱)이 한 번 던져도 토스트로 한 번 알리고 다음 프레임이 계속 돈다 */
  const fr = await ev(async () => {
    var MM = DG.minimap, orig = MM.tick, calls = 0, thrown = false;
    MM.tick = function (dt) { calls++; if (!thrown) { thrown = true; throw new Error('확인용 프레임 예외'); } return orig.call(MM, dt); };
    await new Promise((res) => setTimeout(res, 1500));
    MM.tick = orig;
    var t = document.getElementById('toast');
    return { thrown: thrown, calls: calls, toast: t ? t.textContent : '' };
  });
  expected.push('확인용 프레임 예외');
  check('dg.game-2 프레임 예외 — 루프가 한 번 던져도 ⚠️ 토스트로 알리고 다음 프레임이 계속 돈다', fr.thrown && fr.calls > 3 && /확인용 프레임 예외/.test(fr.toast), JSON.stringify(fr));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !expected.some((x) => e.indexOf(x) >= 0));
check('페이지 예외·console.error 없음(일부러 던진 것 빼고)', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();

/* dg.game-2 ② 부팅 예외 배너 — core.load 가 한 번 던지는 판: 갈색 빈 화면 대신 "시작 실패" 상자가 뜬다 */
const b = await open('saga-dungeon');
try {
  await b.page.addInitScript(SEED);
  await b.page.goto(b.url('index.html')); await sleep(1500);
  await b.page.evaluate(() => { DG.account.create('확인'); });
  await b.page.addInitScript(() => {
    var D = window.DG = window.DG || {}, cv;
    Object.defineProperty(D, 'core', { configurable: true, get: function () { return cv; }, set: function (v) { cv = v; var ld = v && v.load; if (ld) { var once = false; v.load = function () { if (!once) { once = true; throw new Error('확인용 부팅 예외'); } return ld.apply(v, arguments); }; } } });
  });
  await b.page.goto(b.url('index.html')); await sleep(3500);
  await b.page.evaluate(() => { var t = document.getElementById('title-continue'); if (t) { t.click(); } }); await sleep(2000);
  const bb = await b.page.evaluate(() => { var hit = [].slice.call(document.querySelectorAll('body > div')).find((d) => /시작 실패/.test(d.textContent || '')); return { banner: !!hit, text: hit ? hit.textContent.slice(0, 60) : '' }; });
  check('dg.game-2 부팅 예외 — 시작이 던지면 "⚠️ 시작 실패" 상자가 오류문과 함께 뜬다(빈 화면으로 안 멈춘다)', bb.banner && /확인용 부팅 예외|시작 실패/.test(bb.text), JSON.stringify(bb));
} catch (e) { check('부팅 배너 예외 — ' + e.message.slice(0, 200), false); }
await b.close();

console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-dg-close4.json', JSON.stringify({ script: 'pw-dg-close4.mjs', game: 'saga-dungeon', pass: results.filter(Boolean).length, total: results.length, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
