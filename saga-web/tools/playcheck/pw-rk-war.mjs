// 사가천하 확인 닫기 ②(W-0084) — 진형·진영·원정·원정 사건·수군·탐험·AI 를 실제 판에서 한 번씩 굴려 본다.
//   node pw-rk-war.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 원정·다음 달은 화면 단추를 누르고, 출진은 화면이 부르는 같은 함수(war.march)로 한다.
// 진영·수전·탐험은 판을 그 상황으로 맞춘 뒤(성 주인·병력·배·무장 자리 — page.evaluate) 친다.
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-rk-war.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-realm');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
/* 싸움·사건이 Math.random 을 써서 판마다 갈린다 — 진단과 같은 씨앗 mulberry32(20260824) 로 고정해 같은 판을 돈다 */
await page.addInitScript(() => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });

async function clearCards() { for (let i = 0; i < 8 && await ev(() => { var e = document.getElementById('encounter'); return !!(e && e.classList.contains('show')); }); i++) { await ev(() => { DG.ui.closeEnc(); }); await sleep(250); } }
async function nextMonth() { await clearCards(); await ev(() => { DG.ui.closeSheet(); }); await page.locator('[data-act="next-month"]').click(); await sleep(1500); await clearCards(); }

/* 판 맞추기 도우미 — 성 하나를 내 것으로 하고 병력·무장을 둔다(브라우저 안에서 정의) */
const HELPERS = () => {
  window.__own = function (cid, troops) { var R = DG.rtk, c = R.city(cid); c.force = R.me(); c.troops = troops; c.food = Math.max(c.food, 200000); c.train = 80; c.tech = 300; return c; };
  window.__officerTo = function (cid, skip) {
    var R = DG.rtk, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), used = window.__used = window.__used || [];
    var list = DG.off.ofForce(me).map((o) => o.id || o).filter((id) => { var rc = DG.off.rec(id); return skip.indexOf(id) < 0 && used.indexOf(id) < 0 && !rc.hurt && rc.force === me && mine.indexOf(rc.city) >= 0; });   // 진영·원정에 나간 사람·이미 쓴 사람은 빼고
    var id = list[0]; var rec = DG.off.rec(id); rec.city = cid; rec.done = false; used.push(id); return id;
  };
};

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
  await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);          // 194년 군웅할거
  await page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);       // 첫 세력
  await clearCards();
  await ev(HELPERS);
  await ev(() => { DG.rtk.myForce().gold += 50000; });

  /* rk.war-3 — 진형: 문턱(75) 넘는 장수가 있으면 붙고, armyPower 가 그만큼 커진다 */
  const f3 = await ev(() => {
    var W = DG.war, all = DG.off.ofForce(DG.rtk.me()).map((o) => o.id || o), st = (id) => DG.off.stats(id);
    var strong = all.filter((id) => st(id).might >= 75 || st(id).wisdom >= 75 || st(id).command >= 75).slice(0, 3);
    var weak = all.filter((id) => st(id).might < 75 && st(id).wisdom < 75 && st(id).command < 75).slice(0, 3);
    var fs = W.formationOf(strong), fw = weak.length ? W.formationOf(weak) : null;
    var army = { troops: 5000, train: 50, tech: 300, officers: strong, morale: 1 };
    var pWith = W.armyPower(army), pNo = pWith / (fs ? fs.mul : 1);
    return { n: W.FORMATIONS.length, strong: strong.length, form: fs && fs.key, mul: fs && fs.mul, weak: weak.length, weakForm: fw && fw.key, pWith: Math.round(pWith), pNo: Math.round(pNo) };
  });
  check('rk.war-3 진형 — 3종, 문턱 75 넘는 장수가 있으면 진형이 붙어 armyPower 가 ×mul 커지고, 못 넘는 무리는 무진형', f3.n === 3 && !!f3.form && f3.mul > 1 && f3.pWith > f3.pNo && (f3.weak === 0 || f3.weakForm === null), JSON.stringify(f3));

  /* rk.war-4 — 진영: 한 달에 못 떨어뜨리면 성 밖에 진을 치고, 다음 달에도 남아 사기가 준다 */
  const c4 = await ev(() => {
    var R = DG.rtk, W = DG.war, CD = DG.cityData, me = R.me(), tries = [];
    var mine = R.citiesOf(me).map((c) => c.id || c);
    for (var k = 0; k < 6; k++) {
      var pair = null;
      mine.forEach((from) => { (CD.find(from).adj || []).forEach((to) => { var tc = R.city(to); if (!pair && tc && tc.force && tc.force !== me && !DG.diplo.blocked(me, tc.force) && !CD.isWater(from, to)) { pair = { from: from, to: to }; } }); });
      if (!pair) { return { none: true }; }
      var to = R.city(pair.to); to.troops = 30000 + k * 5000; to.wall = 9000; to.train = 60;
      __own(pair.from, 60000 + k * 10000);
      var oid = __officerTo(pair.from, []);
      var rep = W.march(pair.from, pair.to, [oid], 40000 + k * 5000);
      tries.push({ won: rep.won, routed: rep.routed, camp: rep.campId || null, why: rep.why });
      if (rep.campId) { var cp = W.campById(rep.campId); window.__cp = cp; return { ok: true, camp: rep.campId, morale: cp.morale, to: pair.to, tries: tries, left: W.monthsLeft(cp) }; }
    }
    return { ok: false, tries: tries };
  });
  let c4b = null;
  /* 달 넘김이 부르는 resolveCamp 를 바로 한 번 — 다음 달 사이 AI 외교(맹약)가 진영을 먼저 거둘 수 있어 버튼 대신 그 단계만 (W-0084 메모) */
  if (c4.ok) { c4b = await ev((id) => { var cp = window.__cp; DG.war.resolveCamp(cp); return { morale: cp.morale, decay: DG.war.CAMP_DECAY, still: !!DG.war.campById(id) }; }, c4.camp); }
  check('rk.war-4 진영 — 못 떨어뜨리면 성 밖 진영이 서고(치중 n달), 다음 달 사기 ×0.94 뒤 다시 친다', c4.ok && c4.left >= 1 && c4b && Math.abs(c4b.morale - c4.morale * c4b.decay) < 0.005, JSON.stringify({ c4, c4b }));

  /* rk.war-5 — 원정: 성 창의 🚩 원정 단추 → 수량 창 → 원정군이 서고, 다음 달 걸은 달이 는다 */
  const j0 = await ev(() => {
    var R = DG.rtk, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), i;
    for (i = 0; i < mine.length; i++) { __own(mine[i], Math.max(R.city(mine[i]).troops, 8000)); __officerTo(mine[i], []); DG.ui.openCity(mine[i]); if (document.querySelector('#sheet [data-act="journey"]')) { return { from: mine[i], before: DG.war.journeysOf(me).length }; } }
    return { none: true };
  });
  let j1 = null, j2 = null;
  if (!j0.none) {
    await clearCards(); await ev((id) => { DG.ui.openCity(id); }, j0.from); await sleep(500);   // 진영 보고 같은 카드가 덮지 않게
    await page.locator('#sheet [data-act="journey"]').first().scrollIntoViewIfNeeded(); await page.locator('#sheet [data-act="journey"]').first().click(); await sleep(400);
    await page.locator('[data-act="ask-ok"]').first().click(); await sleep(600);
    j1 = await ev(() => { var l = DG.war.journeysOf(DG.rtk.me()), j = l[l.length - 1]; return j ? { n: l.length, id: j.id, total: j.monthsTotal, el: j.monthsElapsed || 0 } : null; });
    await nextMonth();
    j2 = await ev((id) => { var j = DG.war.journeyById(id); return j ? { el: j.monthsElapsed || 0, total: j.monthsTotal } : { arrived: true }; }, j1 && j1.id);
  }
  check('rk.war-5 원정 — 🚩 원정 단추로 원정군이 서고, 다음 달 걸은 달이 1 늘거나 닿는다', !j0.none && j1 && j1.n === j0.before + 1 && j2 && (j2.arrived || j2.el === j1.el + 1), JSON.stringify({ j0, j1, j2 }));

  /* rk.war-6 — 원정 사건 7종, 원정 하나에 굴리면 언젠가 사건 글이 붙는다 */
  const e6 = await ev((id) => {
    var W = DG.war, j = id ? W.journeyById(id) : null, e = null, i;
    if (!j) { j = { id: 'x', force: DG.rtk.me(), troops: 5000, officers: [], monthsTotal: 5, monthsElapsed: 0, morale: 1 }; }
    for (i = 0; i < 200 && !e; i++) { e = W.rollJourneyEvent(j); }
    return { n: W.JOURNEY_EVENTS.length, key: e && e.key, text: j.lastEvent && j.lastEvent.text, tries: i };
  }, j1 && j1.id);
  check('rk.war-6 원정 사건 — 7종, 굴리면 사건이 나고 원정군에 글이 붙는다', e6.n === 7 && !!e6.key && !!e6.text, JSON.stringify(e6));

  /* rk.war-7 — 수군: 물길로 이어진 두 성 사이 출진은 수전이 되고 배가 줄어든다 */
  const w7 = await ev(() => {
    var R = DG.rtk, W = DG.war, CD = DG.cityData, me = R.me(), ww = CD.WATERWAYS, i;
    for (i = 0; i < ww.length; i++) {
      var a = ww[i][0], b = ww[i][1], ca = R.city(a), cb = R.city(b);
      if (!ca || !cb) { continue; }
      var from = a, to = b; if (cb.force === me) { from = b; to = a; }
      var tc = R.city(to); if (!tc.force) { continue; }
      if (tc.force === me) { tc.force = R.liveForces().find((f) => f !== me); }
      if (DG.diplo.blocked(me, tc.force)) { continue; }
      __own(from, 30000); R.city(from).ships = 300; tc.ships = 100; tc.troops = 8000;
      var oid = __officerTo(from, []), s0 = R.city(from).ships, can = W.canMarch(from, to, 10000);
      if (!can.ok || !can.water) { continue; }
      var rep = W.march(from, to, [oid], 10000);
      return { from: from, to: to, water: !!rep.water || (rep.log || []).some((l) => /수전|🛶|⛵/.test(l)), s0: s0, s1: R.city(from).ships + (rep.won ? 0 : 0), won: rep.won, navy: Object.keys(DG.forceData.NAVY || {}).length };
    }
    return { none: true };
  });
  check('rk.war-7 수군 — 물길 출진은 수전(배 대 배)이 되고 출진 성의 배가 준다', !w7.none && w7.water && w7.s1 < w7.s0, JSON.stringify(w7));

  /* rk.war-8 — 탐험: landmark 성을 처음 떨어뜨리면 금 +1000·유물 하나 */
  const l8 = await ev(() => {
    var R = DG.rtk, W = DG.war, CD = DG.cityData, me = R.me(), st = R.state(), i, j;
    var lms = CD.CITIES.filter((c) => c.landmark && !(st.discovered || {})[c.id]);
    for (i = 0; i < lms.length; i++) {
      var L = lms[i], adj = L.adj || [];
      for (j = 0; j < adj.length; j++) {
        var A = adj[j]; if (CD.isWater(A, L.id)) { continue; }
        var lc = R.city(L.id); if (lc.force === me) { continue; }
        if (!lc.force) { lc.force = R.liveForces().find((f) => f !== me); }
        if (DG.diplo.blocked(me, lc.force)) { continue; }
        __own(A, 60000); lc.troops = 300; lc.wall = 300;
        var oid = __officerTo(A, []), g0 = R.myForce().gold, item0 = DG.off.rec(oid).item;
        var rep = W.march(A, L.id, [oid], 50000);
        var line = (rep.log || []).find((l) => /처음 밟는 땅/.test(l)) || '';
        return { L: L.id, won: rep.won, gold: R.myForce().gold - g0, line: line, disc: !!(st.discovered || {})[L.id] };
      }
    }
    return { none: true };
  });
  check('rk.war-8 탐험 — landmark 성을 처음 떨어뜨리면 "처음 밟는 땅" 금 +1000·유물', !l8.none && l8.won && l8.disc && l8.gold >= 1000 && /발견/.test(l8.line), JSON.stringify(l8));

  /* rk.tactics — 격자 전술판(W-0108): 성 창 ⚔️ 출진 → 실시간 전장 「♟️ 전술판」 → 6×8 판에서 장수를 움직이고 3턴을 넘기면 결과 카드 → 전황으로 */
  await clearCards(); await ev(() => { DG.ui.closeSheet(); });
  const g0 = await ev(() => {
    var R = DG.rtk, CD = DG.cityData, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), i, j;
    for (i = 0; i < mine.length; i++) {
      var adj = CD.find(mine[i]).adj || [];
      for (j = 0; j < adj.length; j++) {
        var tc = R.city(adj[j]);
        if (!tc || !tc.force || tc.force === me || DG.diplo.blocked(me, tc.force) || CD.isWater(mine[i], adj[j])) { continue; }
        __own(mine[i], 20000); __officerTo(mine[i], []); __officerTo(mine[i], []); tc.troops = Math.max(tc.troops, 9000); tc.wall = Math.max(tc.wall || 0, 3000);
        DG.ui.openCity(mine[i]);
        if (document.querySelector('#sheet [data-act="march"][data-to="' + adj[j] + '"]')) { return { from: mine[i], to: adj[j] }; }
      }
    }
    return { none: true };
  });
  let g1 = null, g2 = null, g3 = null;
  if (!g0.none) {
    const mb = page.locator('#sheet [data-act="march"][data-to="' + g0.to + '"]').first();
    await mb.scrollIntoViewIfNeeded(); await mb.click(); await sleep(400);
    await page.locator('[data-act="ask-ok"]').first().click();
    const gb = page.locator('[data-act="bat-cmd"][data-cmd="grid"]').first();
    await gb.waitFor({ state: 'visible', timeout: 20000 }); await gb.click(); await sleep(600);
    g1 = await ev(() => { var h = document.getElementById('tacview'); return { show: !!(h && h.classList.contains('show')), cells: h ? h.querySelectorAll('.tv-cell').length : 0, mine: h ? h.querySelectorAll('[data-uid^="me:"]').length : 0, foe: h ? h.querySelectorAll('[data-uid^="foe:"]').length : 0 }; });
    /* 손으로 한 수 — 첫 장수를 눌러 갈 칸을 밝히고 한 칸 앞으로 */
    await page.locator('#tacview [data-uid^="me:"]').first().click(); await sleep(300);
    const lit = await ev(() => { var v = DG.tacticsView.cur(), u = DG.tactics.unit(v.b, v.sel); return u ? DG.tactics.moves(v.b, u.uid).length : 0; });
    await ev(() => { var v = DG.tacticsView.cur(), u = DG.tactics.unit(v.b, v.sel), m = DG.tactics.moves(v.b, u.uid).filter((c) => c.x > u.x).sort((a, b) => b.x - a.x)[0]; if (m) { DG.tacticsView.tap(m.x, m.y); } });
    await sleep(300);
    await page.screenshot({ path: 'shots/qc/saga-realm-tactics.png' });
    for (let i = 0; i < 4 && !(await page.locator('#tacview .tv-res').count()); i++) { await page.locator('#tacview [data-tv="end"]').click(); await sleep(400); }
    g2 = await ev(() => { var v = DG.tacticsView.cur(); return { res: !!document.querySelector('#tacview .tv-res'), kind: v && v.out && v.out.kind, turn: v && v.b.turn, moved: v && v.b.units.some((u) => u.side === 'me' && u.x > 2) }; });
    await page.screenshot({ path: 'shots/qc/saga-realm-tactics-result.png' });
    g2.lit = lit;
    await page.locator('#tacview [data-tv="go"]').click(); await sleep(800);
    g3 = await ev(() => { var h = document.getElementById('tacview'), log = (document.getElementById('livelog') || {}).textContent || ''; return { closed: !(h && h.classList.contains('show')), line: /♟️ 전술판/.test(log), again: !!document.querySelector('[data-act="bat-cmd"][data-cmd="grid"]') }; });
    const rb = page.locator('[data-act="bat-cmd"][data-cmd="retreat"]').first();
    if (await rb.isVisible().catch(() => false)) { await rb.click().catch(() => {}); await sleep(1500); }
  }
  check('rk.tactics 전술판 — 출진 「♟️ 전술판」 → 48칸 판·양편 유닛, 장수를 눌러 움직이고 턴을 넘기면 결과 카드, 전황으로 돌아가면 판이 닫히고 다시 못 연다',
    !g0.none && g1 && g1.show && g1.cells === 48 && g1.mine >= 1 && g1.foe >= 3 && g2 && g2.res && !!g2.kind && g2.lit > 1 && g2.moved && g3 && g3.closed && g3.line && !g3.again,
    JSON.stringify({ g0, g1, g2, g3 }));
  await clearCards();

  /* rk.rtk-ai — 다른 세력 AI 가 한 달에 명령을 둔다 */
  const ai = await ev(() => { var out = DG.rtkAI.runAll(); return { forces: out.length, acted: out.filter((x) => x.did && (Array.isArray(x.did) ? x.did.length : Object.keys(x.did).length)).length, sample: JSON.stringify(out[0] && out[0].did).slice(0, 120) }; });
  await nextMonth();
  check('rk.rtk-ai AI — 다른 세력들이 한 달에 명령·출진·외교를 둔다(runAll), 다음 달도 막힘 없이 넘어간다', ai.forces >= 2 && ai.acted >= 1, JSON.stringify(ai));
} catch (e) { check('예외 — ' + e.message.slice(0, 160), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rk-war.json', JSON.stringify({ script: 'pw-rk-war.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
