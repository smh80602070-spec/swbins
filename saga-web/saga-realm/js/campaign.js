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
    r3_navigator: ['river', false, 'rout', 0.38], r3_river: ['river', false, 'leader', 0.46], r3_duel: ['mount', false, 'leader', 0.52],
    r4_rift: ['mount', true, 'gate', 0.58], r4_plague: ['hill', true, 'hold', 0.64], r4_tomb: ['mount', false, 'leader', 0.70],
    r5_silk: ['plain', false, 'rout', 0.76], r5_west: ['plain', true, 'gate', 0.82], r5_south: ['river', false, 'rout', 0.88],
    r6_end: ['plain', true, 'leader', 1.00]
  };
  var MAIN = 16, cache = null;
  function chapters() {
    if (cache) { return cache; }
    var S = SD(), out = [];
    if (!S || !S.CARDS) { return out; }
    for (var i = 0; i < S.CARDS.length && out.length < MAIN; i++) {
      var c = S.CARDS[i], b = BATTLE[c.id] || ['plain', false, 'rout', out.length / MAIN];
      out.push({ no: out.length + 1, id: c.id, act: c.act, actName: (S.ACTS || {})[c.act] || '', title: c.title, emoji: c.emoji || '⚔️', text: c.text || '',
        choices: c.choices || [], land: b[0], siege: b[1], goal: b[2], tier: b[3], foeN: b[3] < 0.15 ? 2 : 3 });
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
    var my = Math.round((2400 + 520 * no) * (b.k === 'atk' ? 1.15 : 1)), foe = Math.round((2000 + 640 * no) * (b.k === 'def' ? 0.9 : 1));
    return { seed: 'cp|' + ch.id + '|' + (cp.tries || 0), land: ch.land, siege: ch.siege, srpg: true, goal: ch.goal,
      mine: party(), foes: foesFor(ch), foeTroops: [foe], myTroops: [my], where: ch.title, campaign: no };
  }
  /** 이야기 고름 — 이번 장 한정 보너스(atk 내 병력 +15% · def 적 병력 −10% · util 금 +200) */
  function choose(no, k) {
    var cp = state();
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
      cp.cleared[no] = (cp.cleared[no] || 0) + 1;
      if (cp.ch === no && no < MAIN) { cp.ch = no + 1; }
      res.next = cp.ch; cp.bonus = null; cp.tries = 0; cp.step = 'route';
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
    battleOpts: battleOpts, choose: choose, won: won, reward: reward, price: price, shop: shop, buy: buy, equip: equip, unequip: unequip, setStep: setStep, fillText: fillText, power: power, MAIN: MAIN, BATTLE: BATTLE };
})(typeof window !== 'undefined' ? window : this);
