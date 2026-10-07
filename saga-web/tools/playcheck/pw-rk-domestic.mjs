// 사가천하 확인 닫기 ①(W-0083) — 내정 명령·시장·재해·나이·보물·계략을 실제 판에서 한 번씩 해 본다.
//   node pw-rk-domestic.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 시장·계략·다음 달은 화면 단추를 누르고, 명령·보물은 화면이 부르는 같은 함수(rtk.order·off.equip)로 한다.
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-rk-domestic.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const r = await open('saga-realm');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);

/** 떠 있는 카드(이정표·사건)를 닫는다 — 화면이 그러듯 closeEnc 로 */
async function clearCards() { for (let i = 0; i < 8 && await ev(() => { var e = document.getElementById('encounter'); return !!(e && e.classList.contains('show')); }); i++) { await ev(() => { DG.ui.closeEnc(); }); await sleep(250); } }
async function nextMonth() { await clearCards(); await ev(() => { DG.ui.closeSheet(); }); await page.locator('[data-act="next-month"]').click(); await sleep(1500); await clearCards(); }
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);          // 194년 군웅할거
  await page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);       // 첫 세력
  await clearCards();
  const base = await ev(() => { var R = DG.rtk, me = R.me(); R.myForce().gold += 20000; return { me: me, cities: R.citiesOf(me).map((c) => c.id || c) }; });

  /* rk.rtk-2 — 개간(agri) 명령이 농업을 올리고, 지형 상한 capOf 를 넘지 않는다 */
  const o1 = await ev((cid) => {
    var R = DG.rtk, c = R.city(cid), ready = R.readyAt(cid);
    if (!ready.length) { return { none: true }; }
    var oid = ready[0].id, a0 = c.agri, cap = R.capOf(cid, 'agri'); if (a0 >= cap) { c.agri = a0 = cap - 50; }
    var r1 = R.order(cid, oid, 'agri'), a1 = c.agri;
    c.agri = cap; DG.off.rec(oid).done = false;
    var r2 = R.order(cid, oid, 'agri');
    return { ok1: r1.ok, a0: a0, a1: a1, cap: cap, ok2: r2.ok, a2: c.agri, orders: R.ORDERS.length };
  }, base.cities[0]);
  check('rk.rtk-2 내정 — 개간 명령으로 농업이 오르고, 상한(capOf)에 닿으면 더 안 오른다 · 명령 10종', !o1.none && o1.ok1 && o1.a1 > o1.a0 && o1.ok2 && o1.a2 === o1.cap && o1.orders === 10, JSON.stringify(o1));

  /* rk.rtk-3 — 성 창 시장 "군량을 산다" 단추 → 수량 창 확인 → 금이 줄고 군량이 는다 */
  const cid = base.cities[0];
  const m0 = await ev((id) => { DG.ui.openCity(id); var R = DG.rtk; return { gold: R.myForce().gold, food: R.city(id).food, rate: R.marketRate(id) }; }, cid);
  await sleep(500);
  await page.locator('#sheet [data-act="trade"][data-dir="buy"]').click(); await sleep(400);
  await page.locator('[data-act="ask-ok"]').click(); await sleep(500);
  const m1 = await ev((id) => { var R = DG.rtk; return { gold: R.myForce().gold, food: R.city(id).food }; }, cid);
  check('rk.rtk-3 시장 — 성 창에서 군량을 사면 금이 줄고 군량이 늘며, 환율은 0.35~0.7', m1.gold < m0.gold && m1.food > m0.food && m0.rate >= 0.35 && m0.rate <= 0.7, JSON.stringify({ m0, m1 }));

  /* rk.rtk-4 — 재해(수해)가 든 성은 지도·성 창에 보이고, 다음 달 성벽이 무너지며 남은 달이 준다 */
  const d0 = await ev((id) => {
    var R = DG.rtk, c = R.city(id); c.disaster = 'flood'; c.dLeft = 2; DG.ui.renderMap(); DG.ui.openCity(id);
    var sheet = document.getElementById('sheet').textContent;
    return { n: R.DISASTERS.length, wall: c.wall, harvest: R.harvestMul(id), map: document.querySelectorAll('.rdis').length, sheet: sheet.indexOf(R.disasterByKey('flood').text) >= 0 };
  }, cid);
  await nextMonth();
  const d1 = await ev((id) => { var c = DG.rtk.city(id); return { wall: c.wall, left: c.dLeft, dis: c.disaster }; }, cid);
  check('rk.rtk-4 재해 — 다섯 종, 수해가 지도(🌊)·성 창에 뜨고 수확 ×0.6, 다음 달 성벽 −400·남은 달 1', d0.n === 5 && d0.map >= 1 && d0.sheet && d0.harvest === 0.6 && d1.wall <= d0.wall - 300 && d1.left === 1 && d1.dis === 'flood', JSON.stringify({ d0, d1 }));

  /* rk.officer-2 — 생년 130~178, 해가 바뀌면 나이 +1 */
  const a0 = await ev(() => { var R = DG.rtk, l = DG.off.ofForce(R.me()), id = (l[0] && (l[0].id || l[0])); return { id: id, by: DG.off.birthYear(id), age: DG.off.age(id), year: R.state().year }; });
  let a1 = null;
  for (let i = 0; i < 13; i++) { await nextMonth(); a1 = await ev((id) => ({ age: DG.off.age(id), year: DG.rtk.state().year }), a0.id); if (a1.year > a0.year) { break; } }
  check('rk.officer-2 나이 — 생년 130~178 결정적, 해가 바뀌면 나이가 1 오른다', a0.by >= 130 && a0.by <= 178 && a0.age === a0.year - a0.by && a1 && a1.year === a0.year + 1 && a1.age === a0.age + 1, JSON.stringify({ a0, a1 }));

  /* rk.data-item — 보물 11종, 끼우면 그 능력이 bonus 만큼 오르고 벗기면 돌아온다 */
  const it = await ev((oid) => {
    var I = DG.item, it = I.ITEMS[0], s0 = DG.off.stats(oid)[it.stat];
    DG.off.equip(oid, it.id); var s1 = DG.off.stats(oid)[it.stat];
    DG.off.unequip(oid); var s2 = DG.off.stats(oid)[it.stat];
    return { n: I.ITEMS.length, stat: it.stat, bonus: it.bonus, s0: s0, s1: s1, s2: s2 };
  }, a0.id);
  check('rk.data-item 보물 — 11종, 끼우면 능력 +bonus, 벗기면 그대로', it.n === 11 && it.s1 - it.s0 === it.bonus && it.s2 === it.s0, JSON.stringify(it));

  /* rk.diplo-2 — 맞닿은 적 성 창의 계략 단추를 누르면 금이 들고 결과가 나온다 */
  const pt = await ev(() => {
    var R = DG.rtk, CD = DG.cityData, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), i, j, adj;
    for (i = 0; i < mine.length; i++) { adj = CD.find(mine[i]).adj || []; for (j = 0; j < adj.length; j++) { var c = R.city(adj[j]); if (c && c.force && c.force !== me) { R.myForce().gold += 5000; DG.ui.openCity(adj[j]); return { to: adj[j], gold: R.myForce().gold, plots: DG.diplo.PLOTS.length }; } } }
    return { none: true };
  });
  await sleep(500);
  const btn = page.locator('#sheet [data-act="plot"]:not([disabled])').first();
  const hasBtn = !pt.none && await btn.count() > 0;
  if (hasBtn) { await btn.click(); await sleep(600); }
  const p1 = await ev(() => ({ gold: DG.rtk.myForce().gold, toast: (document.querySelector('.toast, #toast') || {}).textContent || '' }));
  check('rk.diplo-2 계략 — 맞닿은 적 성 창에서 계략 단추를 누르면 금이 들고 결과 글이 뜬다 · 계략 4종', hasBtn && p1.gold < pt.gold && pt.plots >= 4 && p1.toast.length > 0, JSON.stringify({ pt, hasBtn, p1 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 120), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rk-domestic.json', JSON.stringify({ script: 'pw-rk-domestic.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
