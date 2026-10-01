// 사가국지 확인 시트(tasks/sheets/saga-realm-*.md) 다섯 기능을 Playwright 로 직접 해 본다.
//   node pw-rk-sheet.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 시나리오·세력은 실제 단추(pick-scen·pick-force)로 고르고, ▶ 다음 달도 실제 단추를 누른다.
// 명령·외교·출진·개입형 전투·승진은 화면이 부르는 같은 함수(rtk.order·diplo.envoy·war.march/marchInteractive·off.promote)로 한다.
// **기계가 한 확인**(D2 기록)이다 — 지도·전투 그림은 사람 눈(D3)이 본다. 결과는 콘솔 + results/pw-rk-sheet.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(ok); rows.push({ name, ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const r = await open('saga-realm');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);

/** 떠 있는 카드(이정표·사건)를 닫는다 — 화면이 그러듯 closeEnc 로 */
async function clearCards() { for (let i = 0; i < 8 && await ev(() => { var e = document.getElementById('encounter'); return !!(e && e.classList.contains('show')); }); i++) { await ev(() => { DG.ui.closeEnc(); }); await sleep(250); } }
async function nextMonth() { await clearCards(); await page.locator('[data-act="next-month"]').click(); await sleep(1500); await clearCards(); }
try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);          // 194년 군웅할거
  await page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);       // 첫 세력
  const base = await ev(() => { var R = DG.rtk, me = R.me(), f = R.myForce(); return { me: me, turn: R.state().turn, gold: f.gold, cities: R.citiesOf(me).map((c) => c.id || c) }; });
  check('준비 — 시나리오·세력을 실제 단추로 골라 판이 선다', !!base.me && base.cities.length >= 1 && base.turn === 0, JSON.stringify(base));

  /* 1) 달 루프 — 명령 하나 + ▶ 다음 달 */
  const ord = await ev(() => {
    var R = DG.rtk, me = R.me(), cid = R.citiesOf(me)[0].id || R.citiesOf(me)[0];
    var offs = DG.off.atCity(cid).filter((o) => { var id = o.id || o; var rec = DG.off.rec(id); return rec.force === me && !rec.done; });
    if (!offs.length) { return { none: true, cid: cid }; }
    var oid = offs[0].id || offs[0], key = R.ORDERS[0].key;
    var a = R.order(cid, oid, key), b = R.order(cid, oid, key);
    return { cid: cid, oid: oid, key: key, a: a, b: b };
  });
  check('달 루프 — 무장 한 사람에게 명령을 내리면 되고, 같은 달 두 번째는 막힌다(1인 1명령)', !ord.none && ord.a && ord.a.ok && ord.b && !ord.b.ok, JSON.stringify({ a: ord.a && (ord.a.ok || ord.a.why), b: ord.b && ord.b.why, key: ord.key }));
  const m0 = await ev((oid) => ({ turn: DG.rtk.state().turn, gold: DG.rtk.myForce().gold, done: oid ? DG.off.rec(oid).done : null }), ord.oid);
  await nextMonth();
  const m1 = await ev((oid) => ({ turn: DG.rtk.state().turn, gold: DG.rtk.myForce().gold, done: oid ? DG.off.rec(oid).done : null }), ord.oid);
  check('달 루프 — ▶ 다음 달을 누르면 달이 넘어가고 금이 바뀌고 무장 명령이 다시 열린다', m1.turn === m0.turn + 1 && m1.gold !== m0.gold && m1.done === false, '달 ' + m0.turn + '→' + m1.turn + ' · 금 ' + m0.gold + '→' + m1.gold + ' · 명령 사용 ' + m1.done);

  /* 2) 외교 — 이웃 세력에 사절 */
  const dp = await ev(() => {
    var R = DG.rtk, me = R.me(), nb = DG.diplo.neighbours(me), to = nb && nb.length ? (nb[0].force || nb[0].id || nb[0]) : null;
    if (!to) { return { none: true, nb: JSON.stringify(nb).slice(0, 80) }; }
    var cid = R.citiesOf(me)[0].id || R.citiesOf(me)[0];
    var o = DG.off.atCity(cid).find((o) => { var rec = DG.off.rec(o.id || o); return rec.force === me && !rec.done && !rec.hurt; });
    if (!o) { return { none: true, why: '쓸 무장 없음' }; }
    var g0 = R.myForce().gold, rel0 = DG.diplo.relation(me, to);
    var res = DG.diplo.envoy('tribute', to, o.id || o, 600, 1);
    return { to: to, res: res, g0: g0, g1: R.myForce().gold, rel0: rel0, rel1: DG.diplo.relation(me, to) };
  });
  check('외교 — 이웃 세력에 조공 사절을 보내면 금이 나가고 우호가 오른다', !dp.none && dp.res && dp.res.ok && dp.g1 < dp.g0 && dp.rel1 > dp.rel0, JSON.stringify(dp).slice(0, 200));

  /* 3) 출진 — 인접한 적 성을 친다 */
  await nextMonth();   // 사절 무장 명령을 다시 연다
  const mk = await ev(() => {
    var R = DG.rtk, me = R.me(), CD = DG.cityData || DG.data;
    var mine = R.citiesOf(me).map((c) => c.id || c), pair = null;
    mine.forEach((from) => {
      if (pair) { return; }
      var fc = R.city(from); if (fc.troops < 700) { return; }
      if (!DG.off.atCity(from).some((o) => { var rec = DG.off.rec(o.id || o); return rec.force === me && !rec.done && !rec.hurt; })) { return; }   // 쓸 무장이 있는 성만
      var adj = (DG.cityData && DG.cityData.find ? DG.cityData.find(from).adj : []) || [];
      adj.forEach((to) => { var tc = R.city(to); if (!pair && tc && tc.force !== me && !DG.diplo.blocked(me, tc.force) && DG.war.canMarch(from, to, Math.min(fc.troops, 1000)).ok) { pair = { from: from, to: to, troops: Math.min(fc.troops, 1000) }; } });
    });
    if (!pair) { return { none: true, mine: mine }; }
    var o = DG.off.atCity(pair.from).find((o) => { var rec = DG.off.rec(o.id || o); return rec.force === me && !rec.done && !rec.hurt; });
    pair.oid = o ? (o.id || o) : null;
    pair.can = DG.war.canMarch(pair.from, pair.to, pair.troops);
    return pair;
  });
  if (mk.none || !mk.oid) { check('출진 — 맞닿은 적 성과 출진할 무장이 있다', false, JSON.stringify(mk)); }
  else {
    const dr = await ev((m) => {
      var from = DG.rtk.city(m.from).troops, res = DG.war.march(m.from, m.to, [m.oid], m.troops);
      return { ok: res.ok, why: res.why, won: res.won, lossA: res.lossA, lossD: res.lossD, troopsFrom: [from, DG.rtk.city(m.from).troops] };
    }, mk);
    check('출진 — 맞닿은 적 성으로 출진하면 전투가 치러져 승패·손실이 나오고 출진한 성의 병력이 줄어든다', dr.ok && dr.troopsFrom[1] < dr.troopsFrom[0] && typeof dr.won === 'boolean' && dr.lossA >= 0, JSON.stringify(dr).slice(0, 220));
  }

  /* 4) 개입형 전투 — 합마다 명령(돌격·수비·퇴각)을 받는다 */
  await nextMonth();
  const live = await ev(() => new Promise((res) => {
    var R = DG.rtk, me = R.me(), pair = null;
    /* 병력이 가장 많은 적 성을 고른다 — 싸움이 한 합에 안 끝나게 */
    R.citiesOf(me).map((c) => c.id || c).forEach((from) => {
      var fc = R.city(from); if (fc.troops < 700) { return; }
      var adj = DG.cityData.find(from).adj || [];
      adj.forEach((to) => { var tc = R.city(to); if (tc && tc.force !== me && !DG.diplo.blocked(me, tc.force) && DG.war.canMarch(from, to, Math.min(fc.troops, 1000)).ok && (!pair || tc.troops > pair.def)) { pair = { from: from, to: to, troops: Math.min(fc.troops, 900), def: tc.troops }; } });
    });
    if (!pair) { res({ none: true }); return; }
    var o = DG.off.atCity(pair.from).find((o) => { var rec = DG.off.rec(o.id || o); return rec.force === me && !rec.done && !rec.hurt; });
    if (!o) { res({ none: true, why: '무장 없음' }); return; }
    var prompts = 0, cmds = [], rounds = 0, intro = false, t0 = Date.now();
    var out = DG.war.marchInteractive(pair.from, pair.to, [o.id || o], pair.troops, {
      onIntro: function () { intro = true; },
      onRound: function () { rounds++; },
      onPrompt: function (state, step) { prompts++; var c = prompts === 1 ? 'press' : (prompts === 2 ? 'hold' : null); cmds.push(c); step(c); },
      onDone: function (report) { res({ ok: true, intro: intro, prompts: prompts, rounds: rounds, cmds: cmds, hasReport: !!report, winner: report && report.winner, ms: Date.now() - t0 }); }
    });
    if (!out || !out.ok) { res({ ok: false, why: out && out.why }); }
    setTimeout(() => res({ timeout: true, prompts: prompts, rounds: rounds, intro: intro }), 20000);
  }));
  check('개입형 전투 — 출진하면 합마다 명령을 물어 오고(돌격·수비) 끝에 보고가 나온다', !!live.ok && live.prompts >= 1 && live.prompts === live.rounds && live.cmds[0] === 'press' && live.hasReport, JSON.stringify(live).slice(0, 220));

  /* 5) 무장 — 승진(공 20+20n·금 300+300n, 충성 +12) */
  const pm = await ev(() => {
    var R = DG.rtk, me = R.me(), f = R.myForce(), o = DG.off.ofForce(me)[0];
    if (!o) { return { none: true }; }
    var id = o.id || o, rec = DG.off.rec(id), rk0 = DG.off.grow(id).rank;
    var cost = DG.off.promoteCost(rk0), early = DG.off.promoteCheck(id);
    rec.feats = cost.feats + 5; if (f.gold < cost.gold + 100) { f.gold = cost.gold + 100; }
    var g0 = f.gold, l0 = DG.off.loyalOf(id), res = DG.off.promote(id);
    return { id: id, rank: [rk0, DG.off.grow(id).rank], cost: cost, g: [g0, f.gold], loyal: [l0, DG.off.loyalOf(id)], name: DG.off.rankName(id), res: res && res.ok, earlyWhy: early.ok ? '' : early.why };
  });
  check('무장 — 공과 금을 갖추면 승진해 관직이 한 단 오르고 금이 들고 충성이 오른다', !pm.none && pm.res === true && pm.rank[1] === pm.rank[0] + 1 && pm.g[1] === pm.g[0] - pm.cost.gold && pm.loyal[1] >= pm.loyal[0], JSON.stringify(pm).slice(0, 260));
} catch (e) { console.log('ERR', e.message); results.push(false); }

const ext = r.errors.filter((e) => /ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e)).length;
const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
if (ext) { console.log('밖으로 나가는 요청 실패(지도 타일 등, 페이지 오류 아님):', ext + '건'); }
console.log('페이지 예외·console.error:', real.length ? real.slice(0, 5).join(' | ') : '없음');
console.log('404 주소:', r.notFound.length ? r.notFound.join(', ') : '없음');
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rk-sheet.json', JSON.stringify({ script: 'pw-rk-sheet.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, notFound: r.notFound, checks: rows }, null, 1) + '\n');
await r.close();
process.exit(0);
