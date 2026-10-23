/**
 * 삼국지 — 외교(外交)와 계략(計略)
 * ---------------------------------------------------------------
 * 이 축이 없으면 판이 그냥 "센 쪽이 이긴다" 가 된다.
 * 외교는 **시간을 사는 것**이고 계략은 **싸우지 않고 깎는 것**이다.
 *
 *   우호   두 세력 사이의 0~100. 동맹·화친이 붙을 자리를 정한다
 *   동맹   맞잡은 동안 서로 칠 수 없다. 달수가 정해져 있다
 *   화친   한쪽이 청해 맺는 정전. 동맹보다 싸고 짧다
 *   조공   금을 보내 우호를 올린다 — 약자가 강자에게 시간을 사는 길
 *
 *   이간   적 무장의 충성을 깎는다 (낮으면 스스로 떠난다)
 *   유언비어 적 성의 치안을 깎는다 (치안이 낮으면 살림이 통째로 흔들린다)
 *   매수   충성이 바닥난 적 무장을 데려온다
 *   화계   적 성의 군량을 태운다 (원정 나온 군대의 발목을 잡는 수)
 *
 * 계략은 **성공률을 숨기지 않는다** — 걸기 전에 보여 준다.
 * 숨기면 사람이 배우질 못하고 "그냥 눌러 보는 것" 이 된다.
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var CD = global.DG.cityData;
  var FD = global.DG.forceData;

  var ALLY_MONTHS = 18;
  var TRUCE_MONTHS = 8;
  /* ── 혼인 동맹(W-0399 ④ — 정본 고돗 G-0332 · CK3 구조만): 우호 MARRY.rel 이상인 세력에 내 무장 하나를 맺어 보내면 금 MARRY.gold 를 내고
     오래 정전(MARRY.months, 달마다 다시 채움). 둘까지. 맺은 무장이 사라지면(죽음·떠남) 깨지고 정전도 끝난다. 상태 save.rtk.marriages = { 세력: 무장 id } ── */
  var MARRY = { rel: 70, gold: 1500, months: 36, max: 2 };
  function marriages() { var st = global.DG.rtk.state(); if (!st.marriages) { st.marriages = {}; } return st.marriages; }
  function marriedWith(toForce) { return marriages()[toForce] || null; }
  function marryWhy(toForce, offId) {
    var R = global.DG.rtk, off = global.DG.off, me = R.me(), f = R.force(me), r = offId && off.rec(offId);
    if (!f || toForce === me) { return '우리끼리는 할 것이 없습니다'; }
    if (marriedWith(toForce)) { return '이미 맺은 세력'; }
    if (Object.keys(marriages()).length >= MARRY.max) { return '혼인은 ' + MARRY.max + '세력까지'; }
    if (relation(me, toForce) < MARRY.rel) { return '우호 ' + relation(me, toForce) + '/' + MARRY.rel; }
    if (f.gold < MARRY.gold) { return '금 ' + MARRY.gold + ' 모자람'; }
    if (!r || r.force !== me || r.dead) { return '우리 무장이 아닙니다'; }
    return '';
  }
  function marry(toForce, offId) {
    var R = global.DG.rtk, why = marryWhy(toForce, offId), me = R.me();
    if (why) { return { ok: false, why: why }; }
    R.force(me).gold -= MARRY.gold;
    marriages()[toForce] = offId;
    setPact(me, toForce, 'truce', MARRY.months);
    core.log('💍 ' + R.forceName(toForce) + ' 과 혼인 동맹 — ' + global.DG.off.find(offId).name + ' 을 보내 ' + MARRY.months + '달 정전', 'good');
    return { ok: true };
  }
  /** 달마다 — 무장이 사라졌으면 깨지고, 살아 있으면 정전을 다시 채운다 */
  function marryMonthly() {
    var R = global.DG.rtk, off = global.DG.off, me = R.me(), m = marriages(), k, r, f = R.force(me);
    if (!me || !f) { return; }
    for (k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) { continue; }
      r = off.rec(m[k]);
      if (!r || r.dead || r.force !== me || !R.force(k)) {
        delete m[k]; if (f.truce) { delete f.truce[k]; } var o = R.force(k); if (o && o.truce) { delete o.truce[me]; }
        core.log('💔 ' + R.forceName(k) + ' 과의 혼인 동맹이 깨졌다 — 맺은 무장이 사라졌다', 'warn');
      } else if (!f.truce || !(f.truce[k] >= MARRY.months)) { setPact(me, k, 'truce', MARRY.months); }
    }
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-marry]') : null;
      if (!b || b.disabled) { return; }
      var r = marry(b.getAttribute('data-marry'), b.getAttribute('data-by'));
      if (!r.ok) { core.emit('toast', r.why); }
      core.emit('changed'); core.persist();
    });
  }

  /* ── 우호 ─────────────────────────────────────────────── */

  function relKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  function rels() {
    var st = global.DG.rtk.state();
    if (!st.relations) { st.relations = {}; }
    return st.relations;
  }

  function relation(a, b) {
    if (a === b) { return 100; }
    var r = rels()[relKey(a, b)];
    return r === undefined ? 40 : r;
  }

  function addRelation(a, b, n) {
    if (a === b) { return 100; }
    var k = relKey(a, b);
    var v = core.clamp(Math.round(relation(a, b) + n), 0, 100);
    rels()[k] = v;
    return v;
  }

  /* ── 맹약 ─────────────────────────────────────────────── */

  function alliedWith(a, b) {
    var f = global.DG.rtk.force(a);
    return !!(f && f.allies && f.allies[b] > 0);
  }

  function trucedWith(a, b) {
    var f = global.DG.rtk.force(a);
    return !!(f && f.truce && f.truce[b] > 0);
  }

  /** 칠 수 없는 사이인가 — war.canMarch 가 이것만 본다 */
  function blocked(a, b) {
    return a === b || alliedWith(a, b) || trucedWith(a, b);
  }

  function setPact(a, b, kind, months) {
    var R = global.DG.rtk;
    var fa = R.force(a), fb = R.force(b);
    if (!fa || !fb) { return false; }
    var slot = kind === 'ally' ? 'allies' : 'truce';
    if (!fa[slot]) { fa[slot] = {}; }
    if (!fb[slot]) { fb[slot] = {}; }
    fa[slot][b] = months; fb[slot][a] = months;
    return true;
  }

  /** 달마다 맹약이 한 달씩 닳는다 */
  function monthly() {
    var st = global.DG.rtk.state(), k, o;
    marryMonthly();   // W-0399 ④ 혼인 — 깨짐·정전 다시 채움(닳기 전에)
    for (k in st.forces) {
      if (!Object.prototype.hasOwnProperty.call(st.forces, k)) { continue; }
      var f = st.forces[k];
      ['allies', 'truce'].forEach(function (slot) {
        if (!f[slot]) { f[slot] = {}; return; }
        for (o in f[slot]) {
          if (!Object.prototype.hasOwnProperty.call(f[slot], o)) { continue; }
          f[slot][o] -= 1;
          if (f[slot][o] <= 0) {
            delete f[slot][o];
            if (k === st.me) {
              core.log('📜 ' + global.DG.rtk.forceName(o) + ' 과의 ' +
                (slot === 'allies' ? '동맹' : '화친') + '이 끝났다', 'info');
            }
          }
        }
      });
    }
  }

  /* ── 사자를 보낸다 ────────────────────────────────────── */

  /**
   * 사자의 말발 — 지력이 반, 우호가 반.
   * 국력 차도 본다: 약한 쪽이 청하면 쉽고, 강한 쪽이 청하면 상대가 겁을 낸다.
   * @param mul 설전(PLAN §5-3)이 낸 배율 — 마지막에 곱한다. 없으면 1(AI 도 안 넘긴다)
   */
  function envoyChance(kind, fromForce, toForce, envoyId, gold, mul) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var wis = envoyId ? off.stats(envoyId).wisdom : 50;
    var rel = relation(fromForce, toForce);
    var mine = R.summary(fromForce).cities, theirs = R.summary(toForce).cities;
    var edge = (theirs - mine) * 0.02;             // 내가 약하면 청하기 쉽다
    var base = kind === 'truce' ? 0.30 : 0.10;
    var p = base + wis / 320 + rel / 260 + edge + (gold || 0) / 12000;
    /* 공동의 적 — 둘 다 맞닿아 있는 큰 세력이 있으면 손을 잡는다 */
    if (kind === 'ally' && commonEnemy(fromForce, toForce)) { p += 0.15; }
    if (mul != null && mul !== 1) { p *= mul; }
    if (global.DG.statecraft) { p *= global.DG.statecraft.diplo(fromForce, neighbours(fromForce).indexOf(toForce) >= 0); }   // 경륜도 외교·원교근공
    return core.clamp(p, 0.03, 0.95);
  }

  function commonEnemy(a, b) {
    var R = global.DG.rtk;
    var ids = R.liveForces(), i;
    var top = R.ranking()[0];
    if (!top || top.id === a || top.id === b) { return false; }
    return neighbours(a).indexOf(top.id) >= 0 && neighbours(b).indexOf(top.id) >= 0;
  }

  /** 맞닿은 세력 목록 */
  function neighbours(forceId) {
    var R = global.DG.rtk;
    var cs = R.citiesOf(forceId), out = [], i, j;
    for (i = 0; i < cs.length; i++) {
      var adj = CD.find(cs[i]).adj;
      for (j = 0; j < adj.length; j++) {
        var c = R.city(adj[j]);
        if (c && c.force && c.force !== forceId && out.indexOf(c.force) < 0) { out.push(c.force); }
      }
    }
    return out;
  }

  /**
   * 외교를 건다. 사자는 그 달의 명령을 쓴다.
   * @param kind 'ally' | 'truce' | 'tribute'
   * @param mul 설전 배율(없으면 1) — 조공은 확률이 없어 무시한다
   */
  function envoy(kind, toForce, envoyId, gold, mul) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var r = off.rec(envoyId);
    var fromForce = r.force;
    var f = R.force(fromForce);
    gold = Math.max(0, Math.round(gold || 0));
    if (!f) { return { ok: false, why: '우리 무장이 아닙니다' }; }
    if (r.done) { return { ok: false, why: '이 달에 이미 명령을 썼습니다' }; }
    if (r.hurt) { return { ok: false, why: '부상 중입니다' }; }
    if (fromForce === toForce) { return { ok: false, why: '우리끼리는 할 것이 없습니다' }; }
    if (f.gold < gold + 100) { return { ok: false, why: '금이 모자랍니다' }; }

    f.gold -= gold + 100;
    r.done = true;
    var name = R.forceName(toForce);

    if (kind === 'tribute') {
      var up = core.clamp(Math.round(gold / 120), 1, 30);
      addRelation(fromForce, toForce, up);
      core.log('🎁 ' + name + ' 에 조공 — 우호 ' + relation(fromForce, toForce), 'info');
      core.emit('changed');
      return { ok: true, done: true, relation: relation(fromForce, toForce), up: up };
    }

    var p = envoyChance(kind, fromForce, toForce, envoyId, gold, mul);
    var kor = kind === 'ally' ? '동맹' : '화친';
    if (Math.random() > p) {
      addRelation(fromForce, toForce, 2);
      core.log('📜 ' + name + ' 이(가) ' + kor + ' 을 물렸다', 'info');
      core.emit('changed');
      return { ok: true, done: false, chance: p, text: name + ' 이(가) 사양했다' };
    }
    setPact(fromForce, toForce, kind, kind === 'ally' ? ALLY_MONTHS : TRUCE_MONTHS);
    addRelation(fromForce, toForce, kind === 'ally' ? 25 : 12);
    core.log('🤝 ' + name + ' 과 ' + kor + ' 을 맺었다 (' +
      (kind === 'ally' ? ALLY_MONTHS : TRUCE_MONTHS) + '개월)', 'good');
    core.emit('toast', '🤝 ' + name + ' 과 ' + kor + '!');
    core.emit('changed');
    return { ok: true, done: true, chance: p, kind: kind };
  }

  /* ── 계략 ─────────────────────────────────────────────── */

  var PLOTS = [
    { key: 'discord', name: '이간', emoji: '🕸️', gold: 200,
      desc: '적 무장을 헐뜯어 충성을 깎는다. 바닥나면 스스로 떠난다.' },
    { key: 'rumor',   name: '유언비어', emoji: '🗣️', gold: 150,
      desc: '적 성에 뜬소문을 놓아 치안을 깎는다.' },
    { key: 'bribe',   name: '매수', emoji: '💰', gold: 600,
      desc: '충성이 낮은 적 무장을 금으로 부른다.' },
    { key: 'fire',    name: '화계', emoji: '🔥', gold: 300,
      desc: '적 성의 군량에 불을 놓는다. 원정 나온 군대가 굶는다.' },
    { key: 'cutsupply', name: '보급 끊기', emoji: '✂️', gold: 250,
      desc: '이 성에서 나갔거나 이 성을 지나 보급받는 적 진의 보급을 2달 끊는다 — 그동안 사기·병력이 달마다 준다.' }   // W-0278
  ];

  function plotByKey(k) {
    for (var i = 0; i < PLOTS.length; i++) { if (PLOTS[i].key === k) { return PLOTS[i]; } }
    return null;
  }

  /**
   * 계략 성공률.
   * 거는 사람 지력 대(對) 막는 사람 지력 — 적 성의 태수가 막는다.
   * 태수가 비어 있으면 그 성은 계략에 훤히 열려 있다(태수를 앉힐 까닭 하나가 더 는다).
   */
  function plotChance(kind, byId, cityId, targetId) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var c = R.city(cityId);
    var mine = off.stats(byId).wisdom;
    var guard = c && c.gov ? off.stats(c.gov).wisdom : 30;
    var p = 0.30 + (mine - guard) / 200;
    if (kind === 'bribe') {
      var loyal = targetId ? off.loyalOf(targetId) : 50;
      p = 0.15 + (70 - loyal) / 100 - (off.find(targetId) ? (off.find(targetId).rarity - 3) * 0.06 : 0);
      p += (mine - guard) / 400;
    }
    if (kind === 'discord' && targetId) {
      p += (60 - off.loyalOf(targetId)) / 300;
    }
    /* 치안이 낮은 성일수록 무슨 짓이든 통한다 */
    if (c) { p += (60 - c.sec) / 400; }
    /* 특성(PLAN §5-1) — 거는 쪽의 교활·냉혈, 매수당하는 쪽의 탐욕·청렴 */
    p *= off.traitMul(byId, 'plot');
    if (global.DG.statecraft) { p *= global.DG.statecraft.plot(off.rec(byId).force); }   // 경륜도 계략
    if (kind === 'bribe' && targetId) { p *= off.traitMul(targetId, 'bribed'); }
    return core.clamp(p, 0.05, 0.9);
  }

  /**
   * 계략을 건다.
   * @param byId    거는 무장 (그 달의 명령을 쓴다)
   * @param cityId  적 성
   * @param targetId 이간·매수의 대상 무장 (없으면 자동으로 고른다)
   */
  function plot(kind, byId, cityId, targetId) {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var p = plotByKey(kind);
    var r = off.rec(byId);
    var c = R.city(cityId);
    if (!p || !c) { return { ok: false, why: '없는 계략' }; }
    var f = R.force(r.force);
    if (!f) { return { ok: false, why: '우리 무장이 아닙니다' }; }
    if (r.done) { return { ok: false, why: '이 달에 이미 명령을 썼습니다' }; }
    if (r.hurt) { return { ok: false, why: '부상 중입니다' }; }
    if (c.force === r.force) { return { ok: false, why: '우리 성입니다' }; }
    if (!c.force) { return { ok: false, why: '주인 없는 성입니다' }; }
    if (f.gold < p.gold) { return { ok: false, why: '금이 모자랍니다' }; }
    if (kind === 'fire' && global.DG.statecraft && global.DG.statecraft.fire(r.force, cityId) === 0) { return { ok: false, why: '비 오는 달 — 화공(경륜도)은 불을 못 놓는다' }; }
    /* 맞닿은 성에만 손이 닿는다 — 천 리 밖에 첩자를 두지는 못한다 */
    if (!touching(r.force, cityId)) { return { ok: false, why: '손이 닿지 않는 성입니다' }; }

    if ((kind === 'discord' || kind === 'bribe') && !targetId) {
      var cands = off.atCity(cityId, c.force);
      /* 충성이 가장 낮은 사람이 가장 잘 흔들린다 */
      cands.sort(function (a, b) { return off.loyalOf(a.id) - off.loyalOf(b.id); });
      var lord = off.lordOf(c.force);
      cands = cands.filter(function (h) { return h.id !== lord; });
      targetId = cands.length ? cands[0].id : null;
      if (!targetId) { return { ok: false, why: '흔들 사람이 없습니다' }; }
    }

    if (kind === 'cutsupply' && !(global.DG.supplyLine && global.DG.supplyLine.campsVia(cityId).length)) { return { ok: false, why: '끊을 보급선이 없습니다 — 이 성에서 나간 적 진이 없습니다' }; }   // W-0278
    f.gold -= p.gold;
    r.done = true;
    var chance = plotChance(kind, byId, cityId, targetId);
    addRelation(r.force, c.force, -4);

    if (Math.random() > chance) {
      core.log('🕳️ ' + p.name + ' 이(가) 들통났다 — ' + CD.find(cityId).name, 'warn');
      addRelation(r.force, c.force, -6);
      core.emit('changed');
      return { ok: true, done: false, chance: chance, text: p.name + ' 실패 — 들통났다' };
    }

    var text = '';
    if (kind === 'discord') {
      var now = off.addLoyal(targetId, -Math.round((12 + Math.floor(Math.random() * 14)) *
          off.traitMul(targetId, 'discorded') * (off.frustrated(targetId) ? 1.5 : 1)));
      text = off.find(targetId).name + ' 의 충성이 ' + now + ' 로 떨어졌다';
    } else if (kind === 'rumor') {
      var was = c.sec;
      c.sec = core.clamp(c.sec - (10 + Math.floor(Math.random() * 12)), 0, 100);
      text = CD.find(cityId).name + ' 치안 ' + was + ' → ' + c.sec;
    } else if (kind === 'fire') {
      var burned = Math.round(c.food * (0.25 + Math.random() * 0.3) * (global.DG.statecraft ? global.DG.statecraft.fire(r.force, cityId) : 1));
      c.food = Math.max(0, c.food - burned);
      text = CD.find(cityId).name + ' 의 군량 ' + core.fmt(burned) + ' 이 탔다';
    } else if (kind === 'bribe') {
      var home = R.citiesOf(r.force)[0];
      /* 사로잡는 게 아니라 **넘어오는** 것이다 — 우리 성으로 온다 */
      off.placeAt(targetId, home, r.force);
      off.rec(targetId).loyal = 40;
      off.rec(targetId).done = true;
      if (c.gov === targetId) { c.gov = null; }
      text = off.find(targetId).name + ' 이(가) 우리 쪽으로 넘어왔다';
      core.emit('toast', '💰 ' + off.find(targetId).name + ' 이(가) 넘어왔다');
    } else if (kind === 'cutsupply') {   // W-0278
      var nCut = global.DG.supplyLine.cutVia(cityId);
      text = CD.find(cityId).name + ' 을 지나는 적 진 ' + nCut + '곳의 보급선이 ' + global.DG.supplyLine.CUT_MONTHS + '달 끊겼다';
    }

    core.log(p.emoji + ' ' + p.name + ' — ' + text, 'good');
    core.emit('changed');
    return { ok: true, done: true, chance: chance, target: targetId, text: text };
  }

  /** 그 성이 우리 성과 맞닿아 있는가 */
  function touching(forceId, cityId) {
    var R = global.DG.rtk;
    var adj = CD.find(cityId) ? CD.find(cityId).adj : [];
    for (var i = 0; i < adj.length; i++) {
      var c = R.city(adj[i]);
      if (c && c.force === forceId) { return true; }
    }
    return false;
  }

  /**
   * 충성이 바닥난 무장은 스스로 떠난다.
   * rtk 의 월말 정산이 부른다 — 여기 두는 편이 "계략의 결과" 로 읽힌다.
   */
  function checkDefection() {
    var R = global.DG.rtk;
    var off = global.DG.off;
    var st = R.state(), k, gone = [];
    for (k in st.officers) {
      if (!Object.prototype.hasOwnProperty.call(st.officers, k)) { continue; }
      var r = st.officers[k];
      if (!r.force) { continue; }
      if (off.lordOf(r.force) === k) { continue; }
      var unrest = r.unrest > 0;
      if (unrest) { r.unrest -= 1; }   // 새 군주 즉위 뒤 3달(§5-8) — 이 창 안에서는 이탈 판정이 두 배. 손잡이가 꺼져 있으면 칸이 안 생긴다
      if (r.loyal > 12) { continue; }
      if (Math.random() > 0.35 * (unrest ? 2 : 1)) { continue; }
      var wasForce = r.force;
      var c = R.city(r.city);
      if (c && c.gov === k) { c.gov = null; }
      off.placeAt(k, r.city, null);
      r.loyal = 0; r.found = true;
      gone.push(k);
      core.log('🚪 ' + off.find(k).name + ' 이(가) ' + R.forceName(wasForce) + ' 을 떠났다', 'warn');
    }
    return gone;
  }

  global.DG = global.DG || {};
  global.DG.diplo = {
    ALLY_MONTHS: ALLY_MONTHS, TRUCE_MONTHS: TRUCE_MONTHS, PLOTS: PLOTS,
    relation: relation, addRelation: addRelation,
    alliedWith: alliedWith, trucedWith: trucedWith, blocked: blocked, setPact: setPact,
    neighbours: neighbours, commonEnemy: commonEnemy, touching: touching,
    envoyChance: envoyChance, envoy: envoy,
    plotByKey: plotByKey, plotChance: plotChance, plot: plot,
    checkDefection: checkDefection, monthly: monthly,
    MARRY: MARRY, marriages: marriages, marriedWith: marriedWith, marryWhy: marryWhy, marry: marry   // W-0399 ④ 혼인 동맹
  };
})(window);
