// 사가고 「동행」 시트(W-0092) — 독 👤 단추로 열고, 새 세이브(동행 없음)와 동행 다섯 세이브 둘 다 본다. PC 1280×720 + 폰 390×844.
//   node pw-go-party.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-go-party.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const errs = [];
const realErr = (list) => list.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));

async function run(label, opts) {
  const r = await open('saga-go', opts);
  const { page } = r, ev = (fn, a) => page.evaluate(fn, a);
  const tap = (loc) => (opts && opts.mobile ? loc.tap() : loc.click());
  try {
    await page.goto(r.url('index.html')); await sleep(1500);
    await ev(() => { DG.account.create('확인'); });
    await page.goto(r.url('index.html')); await sleep(3000);
    await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
    await sleep(5000);
    for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); }

    /* ① 새 세이브 — 독 👤 단추로 열면 나 한 장, 칸은 전부 (빈자리) */
    const btn = page.locator('#dock [data-sheet="party"]');
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await tap(btn); await sleep(700);
    const a = await ev(() => { var b = document.getElementById('sheet-body'); return { title: document.getElementById('sheet-title').textContent, me: !!b.querySelector('.pc-me'), cards: b.querySelectorAll('.pc-card').length, empty: b.querySelectorAll('.pc-card.empty').length, max: DG.formation ? DG.formation.MAX : 5 }; });
    check(label + ' 새 세이브 — 독 👤 단추로 「동행」 시트가 열리고 나 한 장·빈 칸 ' + a.max + '개', /동행/.test(a.title) && a.me && a.cards === a.max && a.empty === a.max, JSON.stringify(a));
    await ev(() => { DG.ui.closeSheet(); });

    /* ② 동행 다섯 — 가장 센 다섯을 명단에(등용과 같은 자리), 다시 열면 칸마다 무기·보패 줄, 카드를 누르면 인물 상세 */
    await ev(() => {
      var s = DG.core.save, hs = DG.data.heroes.slice().sort((x, y) => (y.stats.might + y.stats.command) - (x.stats.might + x.stats.command)).slice(0, 5);
      hs.forEach((h) => { s.dex.heroes[h.id] = { count: 1, firstAt: Date.now() }; if (s.party.indexOf(h.id) < 0) { s.party.push(h.id); } });
      DG.core.persist(); DG.core.emit('changed');
    });
    await tap(btn); await sleep(700);
    const b = await ev(() => {
      var body = document.getElementById('sheet-body'), cards = Array.from(body.querySelectorAll('.pc-card:not(.empty)'));
      var gearRows = cards.map((c) => c.querySelectorAll('.pc-gear').length), names = cards.map((c) => (c.querySelector('b') || {}).textContent || '');
      var over = body.scrollWidth > body.clientWidth + 1;
      return { n: cards.length, gearRows: gearRows, first: names[0], weapon: (cards[0] && cards[0].querySelector('.pc-gear') || {}).textContent || '', over: over, want: (DG.weapon ? 1 : 0) + (DG.artifact ? 1 : 0), party: DG.core.save.party.length };
    });
    const card0 = page.locator('#sheet-body .pc-card:not(.empty)').first();
    if (await card0.count()) { await tap(card0); await sleep(700); }
    const c = await ev(() => { var d = document.getElementById('detail'); return { open: !!(d && d.classList.contains('show')), text: d ? d.textContent.replace(/\s+/g, ' ').slice(0, 60) : '' }; });
    check(label + ' 동행 다섯 — 칸마다 이름·능력·무기·보패 줄, 시트가 가로로 넘치지 않고, 카드를 누르면 인물 상세가 열린다',
      b.n === Math.min(5, b.party) && b.gearRows.every((g) => g === b.want) && /공격|무기/.test(b.weapon) && !b.over && c.open, JSON.stringify({ b, c }));
  } catch (e) { check(label + ' 예외 — ' + e.message.slice(0, 160), false); }
  const real = realErr(r.errors);
  check(label + ' 페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
  errs.push(...real);
  await r.close();
}

await run('PC');
await run('폰', { w: 390, h: 844, mobile: true });
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-go-party.json', JSON.stringify({ script: 'pw-go-party.mjs', game: 'saga-go', pass: results.filter(Boolean).length, total: results.length, pageErrors: errs, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
