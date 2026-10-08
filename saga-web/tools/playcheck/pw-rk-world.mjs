// 사가천하 확인 닫기 ③(W-0085) — 시나리오·지도·관계·문답·3D·소리·계정을 실제 판에서 한 번씩 해 본다.
//   node pw-rk-world.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 시나리오·세력·다음 달·학당·설정·3D 단추·원정·출진은 화면 단추를 누르고, 지도는 마우스로 끈다.
// 이정표 조건·사연 짝은 판을 그 상황으로 맞춘 뒤(성 주인·무장 자리 — page.evaluate) 화면이 하는 대로 본다.
// 폰(390×844)은 지도 ➕ 단추 하나만 한 번 더 연다. **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-rk-world.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const SEED = () => { let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const r = await open('saga-realm');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.addInitScript(SEED);   // 진단과 같은 씨앗 — 같은 판을 돈다

const encOn = () => ev(() => { var e = document.getElementById('encounter'); return !!(e && e.classList.contains('show')); });
/** 떠 있는 카드를 차례로 닫으며 글을 모은다(이정표·달 카드·사연) */
async function clearCards() { const seen = []; for (let i = 0; i < 8 && await encOn(); i++) { seen.push(await ev(() => document.getElementById('encounter').innerText)); await ev(() => { DG.ui.closeEnc(); }); await sleep(250); } return seen; }
async function nextMonth() { await clearCards(); await ev(() => { DG.ui.closeSheet(); }); await page.locator('[data-act="next-month"]').click(); await sleep(1500); return clearCards(); }
async function enter(pg, { create }) {
  await pg.goto(r.url('index.html')); await sleep(1500);
  if (create) { await pg.evaluate(() => { DG.account.create('확인'); }); await pg.goto(r.url('index.html')); }
  await sleep(3000);
  await pg.evaluate(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(3000);
}
const vb = () => ev(() => { var s = document.querySelector('svg.rmap'); return s ? s.getAttribute('viewBox') : null; });
const HELPERS = () => {
  window.__own = function (cid, troops) { var R = DG.rtk, c = R.city(cid); c.force = R.me(); c.troops = troops; c.food = Math.max(c.food, 200000); c.train = 80; c.tech = 300; return c; };
  window.__officerTo = function (cid) {
    var R = DG.rtk, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), used = window.__used = window.__used || [];
    var id = DG.off.ofForce(me).map((o) => o.id || o).filter((x) => { var rc = DG.off.rec(x); return used.indexOf(x) < 0 && !rc.hurt && rc.force === me && mine.indexOf(rc.city) >= 0; })[0];
    var rec = DG.off.rec(id); rec.city = cid; rec.done = false; used.push(id); return id;
  };
};

try {
  await enter(page, { create: true });

  /* rk.data-force — 시나리오 고르기 카드 수 = SCENARIOS, 적벽(208)을 고르면 세력 6 */
  const s0 = await ev(() => ({ cards: document.querySelectorAll('[data-act="pick-scen"]').length, n: DG.forceData.SCENARIOS.length }));
  await page.locator('[data-act="pick-scen"][data-id="208"]').click(); await sleep(800);
  const s1 = await ev(() => ({ forces: document.querySelectorAll('[data-act="pick-force"]').length, want: DG.forceData.SCENARIOS.find((s) => s.id === '208').forces.length }));
  check('rk.data-force 시나리오 — 고르기 카드가 SCENARIOS 수만큼, 적벽(208)을 고르면 세력 카드 6', s0.cards === s0.n && s0.n >= 6 && s1.forces === 6 && s1.want === 6, JSON.stringify({ s0, s1 }));
  await page.locator('[data-act="back-scen"]').first().click(); await sleep(800);
  await page.locator('[data-act="pick-scen"]').first().click(); await sleep(800);          // 194년 군웅할거
  await page.locator('[data-act="pick-force"]').first().click(); await sleep(2000);       // 첫 세력
  await clearCards();
  await ev(HELPERS);

  /* rk.data-force-2 — 이정표 5단, 첫 단 조건을 맞춰 ▶ 다음 달 → 이정표 카드·보상 */
  const m0 = await ev(() => {
    var R = DG.rtk, CD = DG.cityData, st = R.state(), mv = R.milestoneView(), cond = mv.cur.cond, k = 0;
    var spare = CD.CITIES.filter((c) => !c.garrison && R.city(c.id).force !== st.me).sort((a, b) => (R.city(a.id).force ? 1 : 0) - (R.city(b.id).force ? 1 : 0));
    if (cond.c === 'city') { __own(cond.id, 5000); }
    if (cond.c === 'prov') { CD.CITIES.filter((c) => c.prov === cond.prov).forEach((c) => __own(c.id, 5000)); }
    while (!R.condProgress(cond).ok && k < spare.length) { __own(spare[k++].id, 5000); }
    return { total: mv.total, idx: mv.idx, name: mv.cur.name, cond: cond, gold: mv.cur.gold, ok: R.condProgress(cond).ok, given: k, g0: R.myForce().gold, logs0: DG.core.save.log ? DG.core.save.log.length : null };
  });
  await clearCards(); await ev(() => { DG.ui.closeSheet(); });
  await page.locator('[data-act="next-month"]').click(); await sleep(1500);
  const cards = await clearCards();
  const m1 = await ev(() => ({ idx: DG.rtk.state().milestone.idx, at: DG.rtk.state().milestone.at, turn: DG.rtk.state().turn }));
  const mCard = cards.find((t) => t.indexOf('이정표 1/5') >= 0) || '';
  check('rk.data-force-2 이정표 — 5단, 첫 단 조건을 맞추고 ▶ 다음 달이면 이정표 카드(이름·금 +)가 뜨고 다음 단으로', m0.total === 5 && m0.idx === 0 && m0.ok && m1.idx >= 1 && mCard.indexOf(m0.name) >= 0 && /금 \+/.test(mCard), JSON.stringify({ m0, m1, card: mCard.replace(/\s+/g, ' ').slice(0, 120) }));

  /* rk.data-city — 성 135+, 지도 SVG 성 점 수가 같다 */
  const c0 = await ev(() => ({ n: DG.cityData.CITIES.length, dots: document.querySelectorAll('svg.rmap g.rcity').length }));
  check('rk.data-city 지도 — 성 135 이상, 2D 지도의 성 점(g.rcity) 수가 CITIES 와 같다', c0.n >= 135 && c0.dots === c0.n, JSON.stringify(c0));

  /* rk.ui-rtk — 마우스로 끌면 viewBox 가 옮겨 가고, ➕ 단추로 확대(2D 지도엔 휠 확대가 없다 — 3D 캔버스만 휠) */
  const v0 = await vb();
  const box = await page.locator('#realm').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 80, cy - 40, { steps: 6 }); await page.mouse.move(cx - 160, cy - 80, { steps: 6 }); await page.mouse.up(); await sleep(900);
  const v1 = await vb();
  await page.locator('#btn-map-zoomin').click(); await sleep(600);
  const v2 = await vb();
  const w = (s) => s ? parseFloat(s.split(/\s+/)[2]) : NaN;
  check('rk.ui-rtk 지도 — 마우스로 끌면 viewBox 가 옮겨 가고, ➕ 를 누르면 창이 좁아진다(확대)', v0 && v1 !== v0 && w(v2) < w(v1), JSON.stringify({ v0, v1, v2 }));

  /* rk.quiz — 학당: 정답이면 progress 가 오르고, 오답은 wrongList 에 든다 */
  await page.locator('#dock [data-sheet="school"]').click(); await sleep(600);
  await page.locator('[data-act="q-start"]').first().click(); await sleep(500);
  const pickChoice = (want) => ev((good) => {
    var q = document.querySelector('.qq').textContent, ref = DG.quizData.BANK.find((b) => b.q === q);
    if (!ref) { return { none: true, q: q }; }
    var right = ref.c[ref.a], btns = Array.from(document.querySelectorAll('.qchoice'));
    var i = btns.findIndex((b) => (b.textContent.replace(/^\s*\d+\s*/, '').trim() === right) === good);
    return { i: i, q: q.slice(0, 30) };
  }, want);
  const q0 = await ev(() => ({ p: DG.quiz.progress(), w: DG.quiz.wrongList().length }));
  const ca = await pickChoice(true);
  if (ca.i >= 0) { await page.locator('.qchoice').nth(ca.i).click(); await sleep(500); }
  const q1 = await ev(() => ({ p: DG.quiz.progress(), w: DG.quiz.wrongList().length, res: (document.querySelector('.qresult') || {}).textContent || '' }));
  await page.locator('[data-act="q-next"]').first().click(); await sleep(500);
  const wa = await pickChoice(false);
  if (wa.i >= 0) { await page.locator('.qchoice').nth(wa.i).click(); await sleep(500); }
  const q2 = await ev(() => ({ w: DG.quiz.wrongList().length, res: (document.querySelector('.qresult') || {}).textContent || '' }));
  check('rk.quiz 학당 — 정답 단추를 누르면 익힌 수·맞힌 수가 오르고, 오답을 누르면 오답노트에 든다', ca.i >= 0 && q1.p.learned === q0.p.learned + 1 && q1.p.correct === q0.p.correct + 1 && /정답/.test(q1.res) && wa.i >= 0 && q2.w === q1.w + 1 && /오답/.test(q2.res),
    JSON.stringify({ learned: [q0.p.learned, q1.p.learned], correct: [q0.p.correct, q1.p.correct], wrong: [q1.w, q2.w], ca, wa }));
  await ev(() => { DG.ui.closeSheet(); }); await sleep(300);

  /* rk.sfx ① — 소리 단서 24+, ⚙️ 설정의 음량 막대를 0 으로 */
  await page.locator('#btn-more').click(); await sleep(200);
  await page.locator('#btn-settings').click(); await sleep(600);
  await page.locator('[data-act="snd-vol"]').fill('0'); await sleep(300);
  const f0 = await ev(() => ({ cues: Object.keys(DG.sfx.CUES).length, vol: DG.sfx.volume(), label: (document.querySelector('[data-act="snd-vol"]').nextElementSibling || {}).textContent }));
  await ev(() => { DG.ui.closeSheet(); }); await sleep(300);

  /* rk.data-relation ① — 관계 표 45, 관계 있는 두 무장이 내 세력에 있으면 사연에 그 짝이 걸린다 */
  const rl = await ev(() => {
    var R = DG.rtk, E = DG.event, me = R.me(), cap = (R.citiesOf(me)[0].id || R.citiesOf(me)[0]), all = DG.relData.all();
    var pick = function () { for (var i = 0; i < E.ORDER.length; i++) { var id = E.ORDER[i], d = E.DEFS[id], ctx = d.find && d.find(me); if (ctx && ctx.b && E.kindOf(ctx.a, ctx.b)) { return { id: id, ctx: ctx }; } } return null; };
    var hit = pick(), moved = null;
    if (!hit) {
      var p = all.find((x) => DG.off.rec(x.a) && DG.off.rec(x.b));
      [p.a, p.b].forEach((o) => { var rc = DG.off.rec(o); rc.force = me; rc.city = cap; rc.hurt = 0; rc.done = false; });
      moved = [p.a, p.b]; hit = pick();
    }
    if (!hit) { return { n: all.length, none: true }; }
    R.state().events.pending = { id: hit.id, step: 1, ctx: { a: hit.ctx.a, b: hit.ctx.b || '', city: hit.ctx.city || '', force: me } };
    var kd = DG.relData.KINDS[E.kindOf(hit.ctx.a, hit.ctx.b)];
    return { n: all.length, pairs: DG.relData.PAIRS.length, ev: hit.id, kind: kd.name, emoji: kd.emoji, moved: moved };
  });

  /* rk.core ① — 지금 달·금을 적고 세이브한 뒤 새로고침 */
  const k0 = await ev(() => { DG.core.persist(); var key = Object.keys(localStorage).find((k) => { if (!/^saga-realm\/save\//.test(k)) { return false; } try { return !!JSON.parse(localStorage.getItem(k)).rtk; } catch (e) { return false; } }), raw = key && JSON.parse(localStorage.getItem(key)); return { key: key, turn: DG.rtk.state().turn, gold: DG.rtk.myForce().gold, me: DG.rtk.me(), savedTurn: raw && raw.rtk && raw.rtk.turn }; });
  await enter(page, { create: false });
  const k1 = await ev(() => ({ turn: DG.rtk.state().turn, gold: DG.rtk.myForce().gold, me: DG.rtk.me(), vol: DG.sfx.volume() }));
  const evCard = await ev(() => { var e = document.getElementById('encounter'); return e && e.classList.contains('show') ? e.innerText : ''; });
  check('rk.core 계정·세이브 — saga-realm/save/<프로필> 의 rtk 칸에 들고, 새로고침 뒤 이어하기면 세력·달·금이 같다', !!k0.key && k0.savedTurn === k0.turn && k1.me === k0.me && k1.turn === k0.turn && k1.gold === k0.gold, JSON.stringify({ k0, k1 }));
  check('rk.sfx 소리 — 단서 24종 이상, ⚙️ 음량을 0 으로 끌면 volume 0 이고 새로고침 뒤에도 0', f0.cues >= 24 && f0.vol === 0 && /^0%/.test(f0.label || '') && k1.vol === 0, JSON.stringify({ f0, after: k1.vol }));
  check('rk.data-relation 관계 — 관계 표 45쌍, 짝이 걸린 사연은 이어하기 화면에 관계(' + (rl.emoji || '') + (rl.kind || '') + ')를 달고 뜬다', rl.n === 45 && !rl.none && evCard.indexOf(rl.kind) >= 0, JSON.stringify({ rl, card: evCard.replace(/\s+/g, ' ').slice(0, 140) }));
  if (await encOn()) { await page.locator('#encounter [data-act="ev-pick"]:not([disabled])').first().click(); await sleep(600); }
  await clearCards();
  await ev(HELPERS);

  /* rk.city3d — 내 성 창(🏯)을 열면 성 안 3D 캔버스가 그려지고 콘솔 오류가 늘지 않는다 */
  const e0 = r.errors.length;
  await page.locator('#dock [data-sheet="city"]').click(); await sleep(2500);
  const ct = await ev(() => { var c = document.getElementById('city3d'), b = c && c.getBoundingClientRect(); return { avail: DG.city3d.available(), w: b ? Math.round(b.width) : 0, h: b ? Math.round(b.height) : 0, inSheet: !!(c && c.closest('#sheet')), tab: document.getElementById('sheet').getAttribute('data-tab') }; });
  check('rk.city3d 성 안 3D — 성 창을 열면 성 안 캔버스가 그려지고(크기>0) 콘솔 오류가 늘지 않는다', ct.avail && ct.w > 0 && ct.h > 0 && ct.tab === 'city' && r.errors.length === e0, JSON.stringify({ ct, newErr: r.errors.slice(e0, e0 + 2) }));
  await ev(() => { DG.ui.closeSheet(); }); await sleep(300);

  /* rk.realm3d-2 — 🧊 단추로 3D 국토 지도를 켜면 캔버스가 서고 소품이 그려진다(drawn>0) */
  await page.locator('#btn-3d').click();
  let d3 = null;
  for (let i = 0; i < 30; i++) { await sleep(1000); d3 = await ev(() => { var c = document.getElementById('realm3d'), b = c && c.getBoundingClientRect(), s = DG.realm3d.staticCullStats(); return { avail: DG.realm3d.available(), active: DG.realm3d.active(), w: b ? Math.round(b.width) : 0, drawn: s.drawn, all: s.all, runs: s.runs }; }); if (d3.drawn > 0) { break; } }
  await page.screenshot({ path: 'shots/qc/saga-realm-3dmap.png' }).catch(() => {});   // Claude 눈 판정(qc+claude)
  check('rk.realm3d-2 3D 국토 — 🧊 를 누르면 3D 지도가 켜져 캔버스가 서고 소품이 그려진다(drawn>0)', d3.avail && d3.active && d3.w > 0 && d3.drawn > 0, d3.avail ? JSON.stringify(d3) : 'realm3d.available() 거짓 — three 를 못 띄운 기기 ' + JSON.stringify(d3));

  /* rk.realm3d — 🚩 원정을 띄우면 지도 위 배우 목록에 원정군이 하나 는다 */
  const plan = () => ev(() => DG.realm3d.actorPlan(DG.rtk.state(), { focus: { x: 50, y: 50 } }).filter((a) => a.kind === 'journey').length);
  const a0 = await plan();
  const j0 = await ev(() => {
    var R = DG.rtk, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), i;
    for (i = 0; i < mine.length; i++) { __own(mine[i], Math.max(R.city(mine[i]).troops, 8000)); __officerTo(mine[i]); DG.ui.openCity(mine[i]); if (document.querySelector('#sheet [data-act="journey"]')) { return { from: mine[i], before: DG.war.journeysOf(me).length }; } }
    return { none: true };
  });
  if (!j0.none) {
    await clearCards(); await ev((id) => { DG.ui.openCity(id); }, j0.from); await sleep(500);
    await page.locator('#sheet [data-act="journey"]').first().scrollIntoViewIfNeeded(); await page.locator('#sheet [data-act="journey"]').first().click(); await sleep(400);
    await page.locator('[data-act="ask-ok"]').first().click(); await sleep(800);
  }
  const a1 = await plan();
  const jn = await ev(() => DG.war.journeysOf(DG.rtk.me()).length);
  check('rk.realm3d 지도 위 배우 — 🚩 원정을 띄우면 actorPlan 의 원정군 배우가 하나 는다', !j0.none && jn === j0.before + 1 && a1 === a0 + 1, JSON.stringify({ j0, journeys: jn, actors: [a0, a1] }));
  await clearCards(); await ev(() => { DG.ui.closeSheet(); });

  /* rk.battle3d — 성 창 ⚔️ 출진 → 수량 창 → 실시간 전장: battle3d 캔버스와 양쪽 병사 */
  const b0 = await ev(() => {
    var R = DG.rtk, CD = DG.cityData, me = R.me(), mine = R.citiesOf(me).map((c) => c.id || c), i, j;
    for (i = 0; i < mine.length; i++) {
      var adj = CD.find(mine[i]).adj || [];
      for (j = 0; j < adj.length; j++) {
        var tc = R.city(adj[j]);
        if (!tc || !tc.force || tc.force === me || DG.diplo.blocked(me, tc.force) || CD.isWater(mine[i], adj[j])) { continue; }
        __own(mine[i], 20000); __officerTo(mine[i]); tc.troops = Math.max(tc.troops, 6000);
        DG.ui.openCity(mine[i]);
        if (document.querySelector('#sheet [data-act="march"][data-to="' + adj[j] + '"]')) { return { from: mine[i], to: adj[j] }; }
      }
    }
    return { none: true };
  });
  let b1 = null;
  if (!b0.none) {
    const mb = page.locator('#sheet [data-act="march"][data-to="' + b0.to + '"]').first();
    await mb.scrollIntoViewIfNeeded(); await mb.click(); await sleep(400);
    await page.locator('[data-act="ask-ok"]').first().click();
    for (let i = 0; i < 20; i++) { await sleep(1000); b1 = await ev(() => { var c = document.getElementById('battle3d'), v = DG.battle3d.armyView(); return { canvas: !!c, w: c ? Math.round(c.getBoundingClientRect().width) : 0, view: v && { a: v.a.n, d: v.d.n } }; }); if (b1.view && b1.view.a > 0) { break; } }
    await page.screenshot({ path: 'shots/qc/saga-realm-battle3d.png' }).catch(() => {});   // Claude 눈 판정(qc+claude)
    const rb = page.locator('[data-act="bat-cmd"][data-cmd="retreat"]').first();   // 퇴각 단추는 명령 차례에만 보인다 — 없으면 그냥 둔다
    if (await rb.isVisible().catch(() => false)) { await rb.click().catch(() => {}); await sleep(1500); }
  }
  check('rk.battle3d 전투 3D — ⚔️ 출진하면 실시간 전장 캔버스가 서고 양쪽 병사(armyView)가 선다', !b0.none && b1 && b1.canvas && b1.w > 0 && b1.view && b1.view.a > 0 && b1.view.d > 0, JSON.stringify({ b0, b1 }));
  await clearCards();
} catch (e) { check('예외 — ' + e.message.slice(0, 160), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음(PC)', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();

/* 폰 390×844 — 두 손가락 대신 ➕ 단추 하나 */
const m = await open('saga-realm', { w: 390, h: 844, mobile: true });
try {
  await m.page.addInitScript(SEED);
  await m.page.goto(m.url('index.html')); await sleep(1500);
  await m.page.evaluate(() => { DG.account.create('확인'); }); await m.page.goto(m.url('index.html')); await sleep(3000);
  await m.page.evaluate(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } }); await sleep(3000);
  await m.page.locator('[data-act="pick-scen"]').first().tap(); await sleep(800);
  await m.page.locator('[data-act="pick-force"]').first().tap(); await sleep(2000);
  for (let i = 0; i < 8 && await m.page.evaluate(() => document.getElementById('encounter').classList.contains('show')); i++) { await m.page.evaluate(() => { DG.ui.closeEnc(); }); await sleep(250); }
  const pv = () => m.page.evaluate(() => document.querySelector('svg.rmap').getAttribute('viewBox'));
  const p0 = await pv();
  const shown = await m.page.evaluate(() => document.getElementById('rmapctl').classList.contains('show'));
  await m.page.locator('#btn-map-zoomin').tap(); await sleep(600);
  const p1 = await pv();
  const w = (s) => parseFloat(s.split(/\s+/)[2]);
  check('rk.ui-rtk 폰 390×844 — 지도 손잡이(🏠➕➖)가 보이고 ➕ 를 누르면 확대된다', shown && w(p1) < w(p0), JSON.stringify({ shown, p0, p1 }));
} catch (e) { check('폰 예외 — ' + e.message.slice(0, 160), false); }
const realM = m.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음(폰)', realM.length === 0, realM.slice(0, 2).join(' | '));
await m.close();

console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-rk-world.json', JSON.stringify({ script: 'pw-rk-world.mjs', game: 'saga-realm', pass: results.filter(Boolean).length, total: results.length, pageErrors: real.concat(realM), checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
