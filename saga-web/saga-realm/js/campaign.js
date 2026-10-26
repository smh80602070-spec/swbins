/**
 * 5천하 조조전식 장 흐름 — 장 표·상태·보상 (W-0450, 사용자 10-26 「지도 화면이 아니고 전략 시뮬 알피지처럼」)
 * ---------------------------------------------------------------
 * 노선도 → 이야기(시나리오 카드) → 진영(편성·장비·상점) → 격자 전투(tactics 한 벌) → 결과 → 다음 장.
 * 장 = data-scenario.js 본 사슬 카드 1~16(6막 「천하의 끝」까지). 화면은 campaign-view.js, 여기는 three·DOM 없이 돈다(진단이 본다).
 *
 *   DG.campaign.on()            손잡이 realm.campaign(1) — 0 이면 옛 지역 지도
 *   DG.campaign.state()         save.rtk.campaign = { ch, step, party[], gold, bag[], cleared{}, bonus }
 *   DG.campaign.chapters()      [{ no, id, act, title, emoji, text, choices, land, siege, goal, tier, foeN }]
 *   DG.campaign.battleOpts(ch)  tacticsView.open 의 opts(내 셋·적 장수·병력·씨앗)
 *   DG.campaign.reward(ch, out) 이긴 판 보상 적용 → { gold, exp, item, next }
 *   DG.campaign.price(item) / buy(itemId) / equip(offId, itemId) / unequip(offId)
 */
(function (global) {
  'use strict';
  function C() { return global.DG.core; }
  function R() { return global.DG.rtk; }
  function OFF() { return global.DG.off; }
  function SD() { return global.DG.scenarioData; }
  function IT() { return global.DG.item; }

  function on() { var c = C(); return !!(c && c.tuned ? +c.tuned('realm.campaign', 1) : 1); }

  /* 장마다 싸움 — [땅, 공성, 승리 조건, 적 세기 단계 0~1]. 카드 이야기에 맞춘 자리(관도 = 평야 결전 · 적벽 = 강 · 균열의 왕 = 공성 …) */
  var BATTLE = {
    r1_start: ['plain', false, 'rout', 0.00], r1_rift_sign: ['hill', false, 'leader', 0.06], r1_first_ally: ['plain', false, 'rout', 0.12],
    r2_fallen: ['hill', false, 'leader', 0.18], r2_plains: ['plain', false, 'rout', 0.26], r2_debate: ['plain', true, 'gate', 0.32],
    r3_navigator: ['river', false, 'leader', 0.38], r3_river: ['river', false, 'leader', 0.46], r3_duel: ['mount', false, 'leader', 0.52],
    r4_rift: ['mount', true, 'gate', 0.58], r4_plague: ['hill', true, 'hold', 0.64], r4_tomb: ['mount', false, 'leader', 0.70],
    r5_silk: ['plain', false, 'rout', 0.76], r5_west: ['plain', true, 'gate', 0.82], r5_south: ['river', false, 'leader', 0.88],
    r6_end: ['plain', true, 'rout', 1.00]
  };
  var MAIN = 16, ALL = 19, cache = null;   // ⑤ 17~19 = 7막 후일담(이야기만, 싸움 없음)
  function chapters() {
    if (cache) { return cache; }
    var S = SD(), out = [];
    if (!S || !S.CARDS) { return out; }
    for (var i = 0; i < S.CARDS.length && out.length < ALL; i++) {
      var c = S.CARDS[i], b = BATTLE[c.id] || ['plain', false, 'rout', out.length / MAIN];
      out.push({ no: out.length + 1, id: c.id, act: c.act, actName: (S.ACTS || {})[c.act] || '', title: c.title, emoji: c.emoji || '⚔️', text: c.text || '',
        choices: c.choices || [], land: b[0], siege: b[1], goal: b[2], tier: b[3], foeN: b[3] < 0.15 ? 2 : 3, epi: out.length >= MAIN });
    }
    cache = out;
    return out;
  }
  function chapter(no) { return chapters()[no - 1] || null; }

  function state() {
    var st = R() && R().state ? R().state() : null;
    if (!st) { return null; }
    var cp = st.campaign;
    if (!cp || typeof cp !== 'object') { cp = st.campaign = { ch: 1, step: 'route', party: [], gold: 300, bag: [], cleared: {}, bonus: null }; }
    if (!cp.cleared) { cp.cleared = {}; } if (!cp.bag) { cp.bag = []; } if (!cp.party) { cp.party = []; }
    if (!cp.talks) { cp.talks = {}; }   // W-0451 본 지원 대화 단계
    if (!cp.gear) { cp.gear = {}; } if (!cp.gbag) { cp.gbag = ['gr_sword_n', 'gr_hide_n']; }   // W-0453 장비 칸·가방(처음엔 낡은 검·가죽 갑옷)
    return cp;
  }
  function save() { var c = C(); if (c && c.persist) { c.persist(); } }

  /** 내 장수(살아 있고 중상 아님) — 세기 순 */
  function power(id) { var s = OFF().stats ? OFF().stats(id) : (global.DG.hero.stats(id) || {}); return (s.might || 0) + (s.command || 0) + (s.wisdom || 0) * 0.5; }
  function roster() {
    var F = R().me(), list = OFF().ofForce(F).filter(function (h) { var r = OFF().rec(h.id); return !r.hurt; });
    return list.sort(function (a, b) { return power(b.id) - power(a.id); });
  }
  /** 출진 셋 — 고른 것 중 살아 있는 것, 모자라면 세기 순으로 채움 */
  function party() {
    var cp = state(), ok = {}, r = roster(), out = [];
    r.forEach(function (h) { ok[h.id] = 1; });
    (cp.party || []).forEach(function (id) { if (ok[id] && out.length < 3 && out.indexOf(id) < 0) { out.push(id); } });
    var want = cp.partySet ? 1 : 3;   // 직접 고른 뒤엔 뺀 자리를 다시 안 채운다(하나도 없으면 하나)
    for (var i = 0; i < r.length && out.length < want; i++) { if (out.indexOf(r[i].id) < 0) { out.push(r[i].id); } }
    return out;
  }
  function setParty(ids) { var cp = state(); cp.party = ids.slice(0, 3); cp.partySet = true; save(); }

  /* 적 장수 — 내 세력 밖 살아 있는 장수를 세기 순으로 줄 세우고, 장 단계(tier)만큼 위쪽에서 고른다(앞 장은 약한 쪽) */
  function foesFor(ch) {
    var me = R().me(), st = R().state(), all = [], k;
    for (k in st.officers) { if (Object.prototype.hasOwnProperty.call(st.officers, k)) { var r = st.officers[k]; if (!r.dead && r.force && r.force !== me && OFF().find(k)) { all.push(k); } } }
    all.sort(function (a, b) { return power(a) - power(b); });
    if (!all.length) { return []; }
    var at = Math.min(all.length - ch.foeN, Math.floor(ch.tier * (all.length - ch.foeN)));
    return all.slice(Math.max(0, at), Math.max(0, at) + ch.foeN).reverse();   // 대장 = 가장 센 사람이 앞
  }
  function battleOpts(no) {
    var ch = chapter(no), cp = state(), b = cp.bonus || {};
    if (!ch) { return null; }
    var pre = cp.pre && cp.pre.ch === no && cp.pre.won ? (cp.pre.kind === 'duel' ? 0.8 : 0.85) : 1;   // ③ 전투 앞 설전·일기토를 이기면 적 병력 −15%/−20%
    var rd = 1 + 0.15 * (cp.round || 0);   // ⑤ 회차마다 적 +15%
    var pp = cp.prep && cp.prep.ch === no ? cp.prep : {};   // W-0451 준비물 — 군량 보급 내 병력 +10% · 척후 적 −5%
    var my = Math.round((2400 + 520 * no) * (b.k === 'atk' ? 1.15 : 1) * (pp.food ? 1.1 : 1)), foe = Math.round((2000 + 640 * no) * (b.k === 'def' ? 0.9 : 1) * pre * rd * (pp.scout ? 0.95 : 1) * (no === MAIN ? 1.2 : 1));   // W-0454 균형 — 마지막 장은 적 +20%(14·15장보다 쉬웠다)
    return { seed: 'cp|' + ch.id + '|' + (cp.tries || 0), land: ch.land, siege: ch.siege, srpg: true, goal: ch.goal,
      mine: party(), foes: foesFor(ch), foeTroops: [foe], myTroops: [my], where: ch.title, campaign: no, mercs: mercsAll(no), mercMul: 1.2, mercN: mercN(no), cls: clsMap(no, ch), events: eventsFor(no, ch, foe, my) };
  }
  /* W-0458 전투 중 이벤트 — 증원(4·7·10·13·16장 3턴, 적 줄에서 다음 장수) · 원군(출진 안 한 가장 센 장수, 질 때 한 번) */
  var REINF = { 4: 1, 7: 1, 10: 1, 13: 1, 16: 1 };
  function eventsFor(no, ch, foe, my) {
    var me = R().me(), st = R().state(), all = [], k, used = foesFor(ch), out = {};
    if (REINF[no]) {
      for (k in st.officers) { if (Object.prototype.hasOwnProperty.call(st.officers, k)) { var r = st.officers[k]; if (!r.dead && r.force && r.force !== me && OFF().find(k) && used.indexOf(k) < 0) { all.push(k); } } }
      all.sort(function (a, b) { return power(a) - power(b); });
      var at = Math.min(all.length - 1, Math.floor(ch.tier * (all.length - 1)));
      if (all.length) { var rid = all[Math.max(0, at)]; out.reinforce = { turn: 3, id: rid, arms: ['cav', 'spear'], hp: Math.max(20, Math.round(18 + foe * 0.15 / 50)), cls: foeCls(no, rid) }; }
    }
    var pt = party(), spare = roster().filter(function (h) { return pt.indexOf(h.id) < 0; })[0];
    if (spare) { out.ally = { id: spare.id, arms: ['spear', 'bow'], hp: Math.max(20, Math.round(18 + my * 0.15 / 50)), cls: clsOf(spare.id) }; }
    return out;
  }
  /* W-0457 전직 — cp.cls = {장수 id: 직업 키}. 적장 직업은 장 단계·장 id 씨앗(다시 도전해도 같다) */
  function RC() { return global.DG.realmClass; }
  function lvOf(id) { var g = OFF().grow ? OFF().grow(id) : null; return g ? g.lv : 1; }
  function clsOf(id) { var cp = state(); return (cp.cls = cp.cls || {})[id] || ''; }
  function classChoices(id) { return RC() ? RC().choices(lvOf(id), clsOf(id)) : []; }
  function promote(id, key) { var cp = state(); if (classChoices(id).indexOf(key) < 0) { return { ok: false, why: '아직 전직할 수 없습니다' }; } cp.cls[id] = key; save(); return { ok: true, cls: RC().CLS[key] }; }
  function foeCls(no, id) { var ch = chapter(no); return RC() && ch ? RC().foeClass('cp|' + ch.id, id, ch.tier) : ''; }
  function clsMap(no, ch) { var o = {}; party().forEach(function (id) { if (clsOf(id)) { o[id] = clsOf(id); } }); foesFor(ch).forEach(function (id) { var k = foeCls(no, id); if (k) { o[id] = k; } }); return o; }
  /* W-0455 용병 병종 — 장수마다 둘, 진영에서 눌러 창→기→궁. 고르지 않으면 출진 순서로 */
  var MA = ['spear', 'cav', 'bow'];
  function mercN(no) { return no >= 9 ? 3 : 2; }   // 9장부터 장수당 용병 셋(후반 적장이 세지는 만큼 내 군도 커진다 — realm-balance)
  function mercFull(id) { var cp = state(), i = Math.max(0, party().indexOf(id)), d = [MA[i % 3], MA[(i + 1) % 3], MA[(i + 2) % 3]], m = ((cp.mercs = cp.mercs || {})[id] || []).slice(0, 3); while (m.length < 3) { m.push(d[m.length]); } return m; }
  function mercsOf(id) { return mercFull(id).slice(0, mercN(state().ch)); }
  function mercsAll(no) { var o = {}; party().forEach(function (id) { o[id] = mercFull(id).slice(0, mercN(no)); }); return o; }
  function cycleMerc(id, k) { var cp = state(), m = mercFull(id); m[k] = MA[(MA.indexOf(m[k]) + 1) % 3]; cp.mercs[id] = m; save(); return m.slice(0, mercN(cp.ch)); }
  /** 적 편성 미리 보기 — [{id, arms:[a,a]}] (판의 command.setup 과 같은 씨앗·같은 셈) */
  function foeMercs(no) { var o = battleOpts(no), CM = global.DG.command; if (!o || !CM) { return []; } var fa = CM.foeArms(o.seed, o.foes); return o.foes.map(function (id, i) { return { id: id, arms: fa[i], cls: foeCls(no, id) }; }); }
  /** 이야기 고름 — 이번 장 한정 보너스(atk 내 병력 +15% · def 적 병력 −10% · util 금 +200) */
  function choose(no, k) {
    var cp = state(), ch = chapter(no);
    if (ch && ch.epi) { cp.gold += 300; cp.cleared[no] = (cp.cleared[no] || 0) + 1; if (cp.ch === no && no < ALL) { cp.ch = no + 1; } cp.step = 'route'; save(); return { epi: true, end: no >= ALL }; }   // 후일담 — 읽으면 다음
    cp.bonus = { ch: no, k: k };
    if (k === 'util') { cp.gold += 200; }
    cp.step = 'camp'; save();
    return cp.bonus;
  }
  var WIN = { win: 1, rout: 1, leader: 1, gate: 1, hold: 1 };
  function won(out) { return !!(out && (WIN[out.kind] || out.win === true)); }
  /** 결과 적용 — 이기면 금·경험·보물(확률)·다음 장. 지면 진영으로(다시 도전) */
  function reward(no, out) {
    var cp = state(), res = { win: won(out), gold: 0, exp: 0, item: null, next: no };
    cp.tries = (cp.tries || 0) + 1;
    (out && out.wounded || []).forEach(function (w) { var id = w.id || w; var r = OFF().rec(id); if (r) { r.hurt = Math.max(r.hurt || 0, 1); } });
    var lord = OFF().lordOf ? OFF().lordOf(R().me()) : null;   // 영구 전사(손잡이 rtk.permadeath) — 군주는 중상으로
    (out && out.fallen || []).forEach(function (id) { var r = OFF().rec(id); if (!r) { return; } if (id === lord) { r.hurt = 1; } else { r.dead = true; } });
    if (res.win) {
      res.gold = 150 + 40 * no; res.exp = 60 + 15 * no;
      cp.gold += res.gold;
      if (OFF().gainExpAll) { OFF().gainExpAll(party(), res.exp); }
      if (IT() && IT().randomItem && ((no * 7 + (cp.tries || 0)) % 3 === 0 || no === 1)) { var it = IT().randomItem(); if (it) { cp.bag.push(it.id); res.item = it; } }
      var GR = global.DG.realmGear, gd = GR ? GR.drop(no, (cp.round || 0) + ':' + (cp.tries || 0), cp.round) : null;   // W-0453 싸움마다 장비 하나
      if (gd) { cp.gbag.push(gd.id); res.gear = gd; }
      cp.cleared[no] = (cp.cleared[no] || 0) + 1;
      if (cp.ch === no && no < ALL) { cp.ch = no + 1; }
      var sg = stageOf(no);   // ③ 일기토로 꺾은 이름 있는 장수는 장을 깨면 합류
      if (sg && sg.kind === 'duel' && sg.foe && cp.pre && cp.pre.ch === no && cp.pre.won && OFF().find(sg.foe)) { var rr = OFF().rec(sg.foe), cs = R().citiesOf(R().me()); if (rr && rr.force !== R().me() && cs.length && OFF().placeAt) { OFF().placeAt(sg.foe, cs[0], R().me()); rr = OFF().rec(sg.foe); rr.dead = false; rr.loyal = 70; res.recruit = OFF().find(sg.foe).name; } }
      res.next = cp.ch; cp.bonus = null; cp.tries = 0; cp.pre = null; cp.step = 'route';
      healAll();
    } else { cp.step = 'camp'; }
    save();
    return res;
  }
  /** 장 사이 — 중상은 한 장 쉬면 낫는다(달이 안 흐르는 흐름이라) */
  function healAll() { roster(); var st = R().state(), k; for (k in st.officers) { if (Object.prototype.hasOwnProperty.call(st.officers, k) && st.officers[k].hurt && st.officers[k].force === R().me()) { st.officers[k].hurt = 0; } } }

  /* ── 장비·상점 ───────────────────────────── */
  function price(it) { return it ? 120 + (it.bonus || 1) * 45 : 0; }
  function shop() { return (IT() && IT().ITEMS || []).slice(); }
  function buy(itemId) {
    var cp = state(), it = IT().itemById(itemId), p = price(it);
    if (!it) { return { ok: false, why: '없는 물건' }; }
    if (cp.gold < p) { return { ok: false, why: '금이 모자랍니다' }; }
    cp.gold -= p; cp.bag.push(itemId); save();
    return { ok: true, item: it, gold: cp.gold };
  }
  function equip(offId, itemId) {
    var cp = state(), i = cp.bag.indexOf(itemId);
    if (i < 0) { return { ok: false, why: '가방에 없음' }; }
    var r = OFF().rec(offId), old = r && r.item;
    cp.bag.splice(i, 1); if (old) { cp.bag.push(old); }
    OFF().equip(offId, itemId); save();
    return { ok: true };
  }
  function unequip(offId) { var r = OFF().rec(offId); if (r && r.item) { state().bag.push(r.item); OFF().unequip(offId); save(); } }
  function setStep(s) { state().step = s; save(); }
  /* ── W-0451 준비물(이번 장 한정) · 지원 대화 ── */
  var PREP = [
    { id: 'food', name: '군량 보급', emoji: '🌾', price: 160, desc: '이번 장 내 병력 +10%' },
    { id: 'scout', name: '척후', emoji: '🔭', price: 140, desc: '이번 장 적 병력 −5%' },
    { id: 'med', name: '의원', emoji: '⚕️', price: 120, desc: '다친 장수 모두 치료' }
  ];
  function prepHave(id) { var cp = state(); return id !== 'med' && !!(cp.prep && cp.prep.ch === cp.ch && cp.prep[id]); }
  function buyPrep(id) {
    var cp = state(), p = PREP.filter(function (x) { return x.id === id; })[0];
    if (!p) { return { ok: false, why: '없는 물건' }; }
    if (prepHave(id)) { return { ok: false, why: '이번 장엔 이미 갖췄습니다' }; }
    if (cp.gold < p.price) { return { ok: false, why: '금이 모자랍니다' }; }
    cp.gold -= p.price;
    if (id === 'med') { healAll(); } else { if (!cp.prep || cp.prep.ch !== cp.ch) { cp.prep = { ch: cp.ch }; } cp.prep[id] = 1; }
    save();
    return { ok: true, item: p };
  }
  function relOf(a, b) { var RD = global.DG.relData, L = RD && RD.all ? RD.all() : [], i; for (i = 0; i < L.length; i++) { var p = L[i]; if ((p.a === a && p.b === b) || (p.a === b && p.b === a)) { return p.kind; } } return ''; }
  /** 출진 셋의 짝 — 지원 단계·점수·다음 문턱·관계·볼 대화가 있나 */
  function pairs() {
    var S = global.DG.support, p = party(), out = [], i, j, cp = state();
    for (i = 0; i < p.length; i++) { for (j = i + 1; j < p.length; j++) {
      var a = p[i], b = p[j], k = S ? S.key(a, b) : a + '|' + b, lv = S ? S.level(a, b) : 0, pt = S ? S.points(a, b) : 0, nx = S && S.STEPS ? S.STEPS.filter(function (x) { return x > pt; })[0] : null;
      out.push({ a: a, b: b, key: k, lv: lv, name: S ? S.nameOf(lv) : '', pts: pt, next: nx || null, rel: relOf(a, b), fresh: lv > (cp.talks[k] || 0) });
    } }
    return out;
  }
  var TALK = [
    ['{a}: 지난 싸움, 등을 맡겨 줘서 고맙소.', '{b}: 서로 살아남았으니 그걸로 되었소. 다음에도 곁에 서겠소.'],
    ['{b}: 이제 그대 발소리만 들어도 어디 서 있는지 알겠소.', '{a}: 하하, 그대 창끝이 보이면 나도 마음이 놓이오.', '{b}: 이 판이 끝나면 술 한 잔 합시다.'],
    ['{a}: 이 난세가 끝나는 날까지 함께 갑시다.', '{b}: 맹세하오 — 그대 곁이 내 자리요.', '{a}: 그 맹세, 목숨으로 지키겠소.']
  ];
  /** 지원 대화 — 새로 닿은 단계를 처음 보면 금 60×단계 */
  function talk(a, b) {
    var S = global.DG.support, cp = state(), lv = S ? S.level(a, b) : 0, k = S ? S.key(a, b) : a + '|' + b, nmOf = function (id) { var h = OFF().find(id); return h ? h.name : id; };
    if (!lv) { return { ok: false, why: '아직 지원 단계가 없습니다 — 판에서 나란히 싸우면 오른다' }; }
    var first = lv > (cp.talks[k] || 0), gold = first ? 60 * lv : 0;
    if (first) { cp.talks[k] = lv; cp.gold += gold; save(); }
    return { ok: true, lv: lv, name: S.nameOf(lv), gold: gold, a: a, b: b, lines: TALK[lv - 1].map(function (l) { return l.replace('{a}', nmOf(a)).replace('{b}', nmOf(b)); }) };
  }
  /* ── W-0453 장비(무기·방어구·장신구) — 표는 realm-gear.js ── */
  function GR() { return global.DG.realmGear; }
  function gearShop() { var cp = state(); return GR() ? GR().stock(cp.ch, cp.round) : []; }
  function buyGear(id) {
    var cp = state(), it = GR() && GR().byId(id), p = it ? GR().price(it) : 0;
    if (!it) { return { ok: false, why: '없는 물건' }; }
    if (cp.gold < p) { return { ok: false, why: '금이 모자랍니다' }; }
    cp.gold -= p; cp.gbag.push(id); save();
    return { ok: true, item: it };
  }
  function gearOf(offId) { var g = state().gear[offId] || {}; return { w: g.w || null, a: g.a || null, c: g.c || null }; }
  function equipGear(offId, id) {
    var cp = state(), i = cp.gbag.indexOf(id), it = GR() && GR().byId(id);
    if (i < 0 || !it) { return { ok: false, why: '가방에 없음' }; }
    var g = cp.gear[offId] = cp.gear[offId] || {}, old = g[it.slot];
    cp.gbag.splice(i, 1); if (old) { cp.gbag.push(old); }
    g[it.slot] = id; save();
    return { ok: true };
  }
  function unequipGear(offId, slot) { var cp = state(), g = cp.gear[offId]; if (g && g[slot]) { cp.gbag.push(g[slot]); g[slot] = null; save(); } }
  /** ⑤ 다 끝났나(19장 후일담까지) · 회차 — 1장부터, 장수·금·가방·경험은 그대로, 적은 회차마다 +15% */
  function ended() { var cp = state(); return !!cp.cleared[ALL]; }
  function newRound() { var cp = state(); cp.round = (cp.round || 0) + 1; cp.ch = 1; cp.cleared = {}; cp.bonus = null; cp.pre = null; cp.tries = 0; cp.step = 'route'; save(); return cp.round; }
  /** ③ 장의 전투 앞 단계(시나리오 STAGES 의 debate·duel) — 없으면 null */
  function stageOf(no) { var ch = chapter(no), S = SD() && SD().STAGES, s = ch && S ? S[ch.id] : null; return s && (s.kind === 'debate' || s.kind === 'duel') ? s : null; }
  function preDone(no) { var cp = state(); return !stageOf(no) || !!(cp.pre && cp.pre.ch === no); }
  function preResult(no, won) { var s = stageOf(no), cp = state(); cp.pre = { ch: no, kind: s ? s.kind : '', won: !!won }; save(); return cp.pre; }
  /** 설전은 출진 셋 중 지력 1위, 일기토는 무력 1위가 나선다 · 일기토 상대 = 단계의 foe(있으면) 아니면 적 대장 */
  function preActors(no) {
    var s = stageOf(no), p = party(), st = function (id) { return OFF().stats(id) || {}; }, key = s && s.kind === 'duel' ? 'might' : 'wisdom';
    var me = p.slice().sort(function (a, b) { return (st(b)[key] || 0) - (st(a)[key] || 0); })[0], o = battleOpts(no);
    return { kind: s ? s.kind : '', me: me, foe: s && s.foe && OFF().find(s.foe) ? s.foe : (o && o.foes[0]) };
  }
  /** 카드 글의 {책사}(내 세력 지력 1위, 군주 빼고)·{이웃}(다른 세력 군주)·{맹장}(무력 1위) — scenario.js fill 과 같은 칸 */
  function fillText(t) {
    var F = R().me(), lord = OFF().lordOf(F), list = OFF().ofForce(F), st = function (id) { return OFF().stats(id) || {}; };
    var sage = list.filter(function (h) { return h.id !== lord; }).sort(function (a, b) { return (st(b.id).wisdom || 0) - (st(a.id).wisdom || 0); })[0];
    var brave = list.slice().sort(function (a, b) { return (st(b.id).might || 0) - (st(a.id).might || 0); })[0];
    var nb = (R().liveForces ? R().liveForces() : []).filter(function (x) { return x !== F; })[0], nl = nb ? OFF().lordOf(nb) : null, nmOf = function (id) { var h = id && OFF().find(id); return h ? h.name : ''; };
    return String(t || '').replace(/{책사}/g, nmOf(sage && sage.id) || '책사').replace(/{이웃}/g, nmOf(nl) || '이웃 군주').replace(/{맹장}/g, nmOf(brave && brave.id) || '맹장');
  }

  global.DG = global.DG || {};
  global.DG.campaign = { on: on, state: state, chapters: chapters, chapter: chapter, roster: roster, party: party, setParty: setParty, foesFor: foesFor,
    battleOpts: battleOpts, clsOf: clsOf, classChoices: classChoices, promote: promote, foeCls: foeCls, mercN: mercN, mercsOf: mercsOf, cycleMerc: cycleMerc, foeMercs: foeMercs, choose: choose, won: won, reward: reward, price: price, shop: shop, buy: buy, equip: equip, unequip: unequip, setStep: setStep, fillText: fillText, PREP: PREP, prepHave: prepHave, buyPrep: buyPrep, pairs: pairs, talk: talk, gearShop: gearShop, buyGear: buyGear, gearOf: gearOf, equipGear: equipGear, unequipGear: unequipGear, ended: ended, newRound: newRound, ALL: ALL, stageOf: stageOf, preDone: preDone, preResult: preResult, preActors: preActors, power: power, MAIN: MAIN, BATTLE: BATTLE };
})(typeof window !== 'undefined' ? window : this);
