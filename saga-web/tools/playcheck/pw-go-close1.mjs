// 사가고 확인 닫기 ①(W-0087) — 사명·연성/승화·천후/계절·사건·토벌/성채/역참·적도·첫 10분을 실제 판에서 한 번씩 해 본다.
//   node pw-go-close1.mjs        (서버: node serve.mjs C:/swbins/saga-web 8871 — 돌리는 쪽이 띄우고 끈다)
// 화면 단추(data-act — saga-go/js/ui.js·rogue.js·event.js 에서 찾음):
//   독 `data-sheet="quest"`(사명 창) · 사명 `quest-claim` · 카드 상세(#detail) `refine`·`ascend` · 사건 카드 `data-pick`
//   · 도감 암영 칸 `purify` · 걷기는 실제 ↑ 키. 그 밖(사명 받기·토벌·적도 싸움)은 화면이 부르는 같은 함수로 친다.
// 토벌(정시부터 45분)·적도(30분 칸의 앞 20분)는 시각에 매여 있어, 페이지의 Date.now 만 "이 시간 정시 + 2분" 부터 흐르게 붙든다
// (new Date() 는 그대로). Math.random 은 진단과 같은 씨앗 mulberry32(20260824).
// **기계가 한 확인**(D2 기록)이다 — 결과는 콘솔 + results/pw-go-close1.json
import fs from 'node:fs';
import { open, sleep } from './pw.mjs';

const results = [], rows = [];
const check = (name, ok, detail) => { results.push(!!ok); rows.push({ name, ok: !!ok, detail: detail || '' }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + String(detail).slice(0, 400) : '')); };
const r = await open('saga-go');
const { page } = r;
const ev = (fn, arg) => page.evaluate(fn, arg);
const HOUR = 3600000, SHIFT = Math.floor(Date.now() / HOUR) * HOUR + 2 * 60000 - Date.now();
await page.addInitScript((shift) => {
  let a = 20260824 >>> 0; Math.random = function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const now0 = Date.now.bind(Date); Date.now = () => now0() + shift;
}, SHIFT);

async function skipScenes() { for (let i = 0; i < 12 && await ev(() => !!(DG.scenario && DG.scenario.isOpen && DG.scenario.isOpen())); i++) { await page.keyboard.press('Escape'); await sleep(250); } }
const encOn = () => ev(() => document.getElementById('encounter').classList.contains('show'));
async function closeSheet() { await ev(() => { if (DG.ui.closeSheet) { DG.ui.closeSheet(); } }); await sleep(250); }

try {
  await page.goto(r.url('index.html')); await sleep(1500);
  await ev(() => { DG.account.create('확인'); });
  await page.goto(r.url('index.html')); await sleep(3000);
  await ev(() => { var b = document.getElementById('title-continue'); if (b) { b.click(); } });
  await sleep(5000);
  await skipScenes();
  await ev(() => { DG.core.setTune('world3d.dayNight', 0); });

  /* go.tutorial ① — 새 세이브는 1단계, 목표판(.p-goal.now) 첫 줄이 그 문구. 실제 ↑ 키로 50m 걸으면 2단계로 */
  const t0 = await ev(() => ({ step: DG.tut.step(), done: DG.tut.done(), line: DG.tut.line(), goal: (document.querySelector('.p-goal.now') || {}).textContent || '' }));
  await page.keyboard.down('ArrowUp');
  for (let i = 0; i < 60 && await ev(() => DG.core.save.player.distance < 52); i++) { await sleep(1000); }
  await page.keyboard.up('ArrowUp'); await sleep(800);
  const t1 = await ev(() => { DG.tut.line(); return { step: DG.tut.step(), dist: Math.round(DG.core.save.player.distance) }; });

  /* 판 맞추기 — 동행 다섯(가장 센 인물)을 세운다. 등용·포획·상자는 그 화면이 쏘는 같은 사건(dex:new·treasure:open)으로 */
  const party = await ev(() => {
    var D = DG.data, s = DG.core.save, hs = D.heroes.slice().sort((a, b) => (b.stats.might + b.stats.command) - (a.stats.might + a.stats.command)).slice(0, 5);
    hs.forEach((h) => { s.dex.heroes[h.id] = { count: 1, firstAt: Date.now() }; if (s.party.indexOf(h.id) < 0 && s.party.length < 5) { s.party.push(h.id); } });
    DG.core.emit('dex:new', { cat: 'heroes', id: hs[0].id });
    s.dex.pets.pt_bear = { count: 1, firstAt: Date.now() };
    DG.core.emit('dex:new', { cat: 'pets', id: 'pt_bear' });
    DG.core.emit('treasure:open', {});
    DG.core.persist();
    return { n: s.party.length, pw: DG.hero.partyPower(), step: DG.tut.step() };
  });

  /* go.quest — 사명 셋까지·같은 사명 두 번은 거부, 채우고 사명 창 「거둔다」 → 금. 주간 사다리 5단 */
  const q0 = await ev(() => {
    var Q = DG.quest, a = Q.take('walk'), b = Q.take('walk'), n1 = Q.list().length;
    Q.take(); Q.take(); Q.take(); Q.take();
    return { max: Q.MAX, a: !!a, b: b, n1: n1, n: Q.list().length, rungs: DG.milestone.rungs().length };
  });
  const qi = await ev(() => { var Q = DG.quest, l = Q.list(), it = l.find((x) => x.key === 'walk'); Q.progress('walk', it.need); return { i: it.i, done: Q.list()[it.i].done, gold: DG.core.save.player.gold }; });
  await page.locator('#dock [data-sheet="quest"], [data-sheet="quest"]').first().click(); await sleep(700);
  const claimBtn = page.locator('#sheet-body [data-act="quest-claim"][data-i="' + qi.i + '"]').first();
  const hasClaim = await claimBtn.count();
  if (hasClaim) { await claimBtn.click(); await sleep(600); }
  const q1 = await ev(() => ({ gold: DG.core.save.player.gold, n: DG.quest.list().length, step: DG.tut.step() }));
  check('go.quest 사명 — 셋까지만 들고 같은 사명 두 번은 거부, 채운 뒤 사명 창 「거둔다」 단추로 금이 들어온다 · 주간 사다리 5단',
    q0.max === 3 && q0.a && q0.b === null && q0.n1 === 1 && q0.n === 3 && qi.done && hasClaim && q1.gold > qi.gold && q1.n === 2 && q0.rungs === 5, JSON.stringify({ q0, qi, hasClaim, q1 }));
  await closeSheet();

  /* go.tutorial ② — 걷기 → (등용·포획·상자) → 사명 창까지 다섯 단, 끝나면 목표판 첫 줄에서 빠진다 */
  const t2 = await ev(() => ({ step: DG.tut.step(), done: DG.tut.done(), line: DG.tut.line(), total: DG.tut.STEPS.length }));
  check('go.tutorial 첫 10분 — 새 세이브는 1/5(목표판 첫 줄), 실제 ↑ 키로 50m 걸으면 2단계, 사명 창까지 열면 5/5 끝·줄이 빠진다',
    t0.step === 0 && !t0.done && /걸어 보세요/.test(t0.line) && /걸어 보세요/.test(t0.goal) && t1.step === 1 && t1.dist >= 50 && party.step === 4 && t2.step === 5 && t2.done && t2.line === '' && t2.step <= t2.total,
    JSON.stringify({ t0: { step: t0.step, goal: t0.goal.slice(0, 30) }, t1, partyStep: party.step, t2 }));

  /* go.letter — 연성(카드 상세 🌿 단추) → bonusOf 오름, 끝까지 올리면 거부, 승화(✨ 단추) → 상위 종 도감·연성 승계 */
  const g0 = await ev(() => {
    var G = DG.growth, c = G.refineCost(G.lvOf('pt_bear')); G.addHerb('pt_bear', c.herb); G.addDust(c.dust);
    DG.ui.openDetail('pet', 'pt_bear');
    return { lv: G.lvOf('pt_bear'), bonus: G.bonusOf(DG.data.find('pt_bear')) };
  });
  await sleep(500);
  const rb = page.locator('#detail [data-act="refine"]').first();
  const rbOk = await rb.count() && await rb.isEnabled();
  if (rbOk) { await rb.click(); await sleep(500); }
  const g1 = await ev(() => {
    var G = DG.growth, p = DG.data.find('pt_bear'), lv1 = G.lvOf('pt_bear'), b1 = G.bonusOf(p), k = 0;
    while (G.lvOf('pt_bear') < G.MAX_LV && k++ < 40) { var c = G.refineCost(G.lvOf('pt_bear')); G.addHerb('pt_bear', c.herb); G.addDust(c.dust); G.refine('pt_bear'); }
    G.addHerb('pt_bear', 5); G.addDust(99999);
    var chk = G.refineCheck('pt_bear'), ch = G.chainOf('pt_bear');
    G.addHerb('pt_bear', ch.herb);
    DG.ui.closeDetail(); DG.ui.openDetail('pet', 'pt_bear');
    return { lv1: lv1, b1: b1, bMax: G.bonusOf(p), max: G.MAX_LV, lvMax: G.lvOf('pt_bear'), chk: chk, to: ch.to, asc: G.ascendCheck('pt_bear').ok };
  });
  await sleep(500);
  const ab = page.locator('#detail [data-act="ascend"]').first();
  const abOk = await ab.count() && await ab.isEnabled();
  if (abOk) { await ab.click(); await sleep(600); }
  const g2 = await ev((to) => ({ has: !!DG.core.save.dex.pets[to], lv: DG.growth.lvOf(to) }), g1.to);
  check('go.letter 연성·승화 — 카드 🌿 연성 단추로 한 단 오르고(한 단은 반올림에 묻힐 만큼 작다) 끝까지 올리면 보너스가 커지며, 끝까지 오르면 거부 · ✨ 승화 단추로 상위 종이 도감에 들고 연성 단이 이어진다',
    rbOk && g1.lv1 === g0.lv + 1 && g1.b1 >= g0.bonus && g1.bMax > g0.bonus && g1.lvMax === g1.max && !g1.chk.ok && g1.asc && abOk && g2.has && g2.lv === g1.max, JSON.stringify({ g0, g1, rbOk, abOk, g2 }));
  await ev(() => { DG.ui.closeDetail(); }); await sleep(200);

  /* go.weather — 같은 시각 = 같은 천후(3시간 결정론), 비를 붙들면 효과가 맑음과 다르고 상단 천후가 바뀐다 · 계절은 1·4·7·10월이 넷 */
  const w0 = await ev(() => {
    var W = DG.weather, S = DG.season, t = Date.UTC(2026, 5, 1, 3), y = 2026;
    var same = W.at(t).key === W.at(t).key && W.at(t).key === W.at(t + 60000).key;
    var clear = JSON.stringify(W.force('clear') && W.bonus()), rain = JSON.stringify(W.force('rain') && W.bonus());
    DG.core.emit('changed');
    var seasons = [1, 4, 7, 10].map((m) => S.at(new Date(y, m - 1, 15).getTime()));
    return { kinds: W.KINDS.length, same: same, clear: clear, rain: rain, cur: W.current().key, seasons: seasons.map((s) => s.name || s.key), distinct: new Set(seasons).size };
  });
  await sleep(600);
  const wTop = await ev(() => (document.getElementById('profile') || {}).textContent || '');
  await ev(() => { DG.weather.force(null); DG.core.emit('changed'); });
  check('go.weather 천후·계절 — 같은 시각은 같은 천후(6종), 비를 붙들면 효과가 맑음과 다르고 상단에 🌧️, 1·4·7·10월이 계절 넷을 가른다',
    w0.kinds === 6 && w0.same && w0.clear !== w0.rain && w0.cur === 'rain' && /🌧/.test(wTop) && w0.distinct === 4, JSON.stringify(Object.assign({}, w0, { top: wTop.slice(0, 60) })));

  /* go.event — 같은 자리·시각이면 같은 후보, 사건 카드를 띄워 첫 선택지를 화면 단추로 → 결과 → 닫힌다 · 밤엔 도적 몫이 는다 */
  const e0 = await ev(() => {
    var E = DG.event, pos = DG.core.save.player.pos, dayT = new Date(2026, 5, 1, 12).getTime(), nightT = new Date(2026, 5, 1, 23).getTime();
    var cd = E.contextAt(pos, dayT, 'clear'), cn = E.contextAt(pos, nightT, 'clear');
    var a = E.candidates(cd).map((c) => c.ev.id + ':' + c.w).join(','), b = E.candidates(E.contextAt(pos, dayT, 'clear')).map((c) => c.ev.id + ':' + c.w).join(',');
    var share = (list) => { var s = 0, n = 0; list.forEach((c) => { s += c.w; if (c.ev.nightW) { n += c.w; } }); return s ? n / s : 0; };
    var calm = E.EVENTS.find((x) => !x.foe && (!x.marks || !x.marks.length)) || E.EVENTS.find((x) => !x.foe);
    return { n: E.EVENTS.length, same: a === b && a.length > 0, day: share(E.candidates(cd)), night: share(E.candidates(cn)), nightKinds: E.EVENTS.filter((x) => x.nightW).map((x) => x.id), calm: calm && calm.id };
  });
  const opened = await ev((id) => DG.event.open(id), e0.calm);
  await sleep(500);
  const card = await ev(() => ({ show: document.getElementById('encounter').classList.contains('show'), picks: document.querySelectorAll('#encounter [data-pick]').length }));
  if (card.picks) { await page.locator('#encounter [data-pick]').first().click(); await sleep(800); }
  const resTxt = await ev(() => document.getElementById('encounter').innerText.replace(/\s+/g, ' ').slice(0, 120));
  for (let i = 0; i < 4 && await encOn(); i++) { const b = page.locator('#encounter button').first(); if (await b.count()) { await b.click().catch(() => {}); } await sleep(500); }
  const closed = !(await encOn());
  check('go.event 사건 — 같은 자리·시각은 같은 후보, 사건 카드 첫 선택지를 단추로 누르면 결과가 뜨고 닫힌다 · 밤엔 도적 몫이 낮보다 크다',
    e0.n >= 11 && e0.same && opened && card.show && card.picks >= 1 && resTxt.length > 0 && closed && e0.night > e0.day, JSON.stringify({ e0, opened, card, resTxt, closed }));

  /* go.raid — 역참: 같은 역참은 같은 자리·첫 방문 보급 → 바로 다시는 쉼(5분) · 토벌: 정시부터 45분, 격문 한 장으로 한 판 한 번 */
  const rd = await ev(() => {
    var W = DG.world, ST = DG.station, RA = DG.raid, RG = DG.rogue, s = DG.core.save.player;
    var sts = W.stationsNear(), st = sts.find((x) => !RG.occupied(x)), again = W.stationsNear().find((x) => x.key === st.key);
    var g0 = s.gold, e0 = s.exp + s.level * 1e6, v1 = ST.visit(st), v2 = ST.visit(st);
    var fort = null, raid = null, rx, ry;
    for (rx = -12; rx <= 12 && !raid; rx++) { for (ry = -12; ry <= 12 && !raid; ry++) { var f = W.fortAt(rx, ry); if (f && RA.at(f)) { fort = f; raid = RA.at(f); } } }
    var slot0 = Math.floor(Date.now() / 3600000) * 3600000;
    var in10 = raid ? !!RA.at(fort, slot0 + 10 * 60000) : null, in46 = raid ? !!RA.at(fort, slot0 + 46 * 60000) : null;
    RA.givePass(1);
    var f1 = raid ? RA.fight(raid) : null, f2 = raid ? RA.fight(raid) : null;
    return { st: st && st.key, samePos: !!again && again.x === st.x && again.y === st.y, v1: v1.ok, gotGold: s.gold > g0, gotExp: s.exp + s.level * 1e6 > e0, v2: v2.reason, fort: fort && fort.key, in10: in10, in46: in46, f1: f1 && f1.ok, f2: f2 && f2.reason };
  });
  check('go.raid 역참·토벌 — 같은 역참은 같은 자리, 첫 방문은 보급·바로 다시는 쉼(5분) · 토벌은 정시 10분엔 있고 46분엔 없으며 격문 한 장으로 한 판 한 번만',
    !!rd.st && rd.samePos && rd.v1 && (rd.gotGold || rd.gotExp) && rd.v2 === 'cooldown' && !!rd.fort && rd.in10 === true && rd.in46 === false && rd.f1 === true && rd.f2 === 'tried', JSON.stringify(rd));

  /* go.rogue — 점거된 역참은 보급 거부, 적도를 물리치면 암영 +1, 도감 암영 칸 🌕 정화 단추로 −1·도감에 든다 */
  const rg = await ev(() => {
    var W = DG.world, ST = DG.station, RG = DG.rogue, pw = DG.hero.partyPower(), hit = null, rx, ry;
    for (rx = -12; rx <= 12 && !hit; rx++) { for (ry = -12; ry <= 12 && !hit; ry++) { W.stationsIn(rx, ry).forEach((s) => { var g = !hit && RG.at(s); if (g && g.hp < pw.atk * 7) { hit = g; } }); } }
    if (!hit) { return { none: true, atk: pw.atk }; }
    var again = RG.at(hit.station), v = ST.visit(hit.station), d0 = RG.darkCount(), res = RG.fight(hit);
    var pet = res.dark, cost = pet ? RG.purifyCost(pet) : null;
    if (cost) { DG.growth.addDust(cost.dust); }
    return { key: hit.key, rank: hit.rank.name, same: again && again.key === hit.key && again.boss.id === hit.boss.id, visit: v.reason, d0: d0, win: res.win, d1: RG.darkCount(), pet: pet && pet.id, hadPet: pet ? !!DG.core.save.dex.pets[pet.id] : null };
  });
  let rg2 = null;
  if (!rg.none && rg.pet) {
    await page.locator('[data-sheet="dex"]').first().click(); await sleep(800);
    const pb = page.locator('#sheet-body [data-act="purify"][data-id="' + rg.pet + '"]').first();
    const has = await pb.count();
    if (has) { await pb.scrollIntoViewIfNeeded(); await pb.click(); await sleep(600); }
    rg2 = await ev((id) => ({ d: DG.rogue.darkCount(), inDex: !!DG.core.save.dex.pets[id] }), rg.pet);
    rg2.button = has;
    await closeSheet();
  }
  check('go.rogue 적도 — 같은 역참·같은 칸은 같은 판, 점거된 역참은 보급 거부, 물리치면 암영 +1, 도감 🌕 정화 단추로 −1 되고 도감에 든다',
    !rg.none && rg.same && rg.visit === 'rogue' && rg.win && rg.d1 === rg.d0 + 1 && rg2 && rg2.button && rg2.d === rg.d1 - 1 && rg2.inDex, JSON.stringify({ rg, rg2 }));
} catch (e) { check('예외 — ' + e.message.slice(0, 200), false); }

const real = r.errors.filter((e) => !/status of 404/.test(e) && !/WebGL|Shader|GL_/i.test(e) && !/ERR_CONNECTION_TIMED_OUT|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(e));
check('페이지 예외·console.error 없음', real.length === 0, real.slice(0, 2).join(' | '));
await r.close();
console.log('요약', results.filter(Boolean).length + '/' + results.length);
fs.mkdirSync('results', { recursive: true });
fs.writeFileSync('results/pw-go-close1.json', JSON.stringify({ script: 'pw-go-close1.mjs', game: 'saga-go', pass: results.filter(Boolean).length, total: results.length, pageErrors: real, checks: rows }, null, 1) + '\n');
process.exit(results.every(Boolean) ? 0 : 1);
