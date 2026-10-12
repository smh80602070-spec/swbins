/**
 * 사방 성좌도(四方星座圖) — PoE식 패시브 그물, 캐릭터(프로필)마다 한 장 (W-0183)
 * ===============================================================
 * 무예(SP·3택, job.js)는 그대로 두고 그 위의 패시브 층이다. 그물 정의는 js/data-passive.js
 * (생성물 — tools/passive-web/gen.mjs saga-story), 찍기 규칙은 공용 passive-web.js, 화면은 passive-web-ui.js(둘 다 shared 정본).
 *
 *   save.passive = { start, taken:[마디 id…] }
 *
 * 시작점 = 가운데 무명 + 직업 계열 넷(무사·궁수·협객·방사 — 1차 전직). 첫 점은 무명이나 지금 직업 계열(job.rootOf)에만.
 * 점수 = (레벨 − 1) + 관문 대장을 처음 이긴 마을 수(side.gateWeek 의 키 — 다섯) — 상한 st.pw.cap 56(마디 391 의 약 14%, Lv.52 쯤 닿는다).
 * 되돌리기 = 마을(또는 사냥터 밖)에서만, 한 마디 금 st.pw.dropGold.
 *
 * 걸린 자리(판 파일은 묻기만 한다 — 큰 파일 side.js·ui.js 는 기존 줄에만):
 *   side power() 공격·체력·마나 · 이동 줄 · jump() 높이·비연 · dodge() 재사용 · castSkill 재사용·근접 타수 · strike 급소·마나 흡수 ·
 *   마나 저절로 차기 · hurtMe 받는 피해·탈것 낙마 · gear.rollDrop 드롭 · party.attach 홀로서기 · core.effect(경험) · ui 무예 창 카드
 * 손잡이 st.pw.*(cap·dropGold·blinkDist·blinkMs·cheolgakJump·cheolgakTake·jilpungMove·jilpungHp·hanbangCd·hanbangAtk·
 *   yeontaAtk·manaHit·hunteyeDrop·hunteyeExp·loneAtk).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cache = null;

  function PW() { return global.DG.passiveWeb; }
  function def() { return global.DG.passiveDef; }
  function T(k, d) { return core.tuned ? core.tuned('st.pw.' + k, d) : d; }

  function store() {
    var s = core.save;
    if (!s.passive) { s.passive = { start: null, taken: [] }; }
    return s.passive;
  }
  function count(o) { var n = 0, k; for (k in (o || {})) { if (Object.prototype.hasOwnProperty.call(o, k)) { n++; } } return n; }
  /** 점수 내역 — 레벨 · 관문 대장 첫 승리 */
  function parts() {
    var s = core.save;
    return { level: Math.max(0, ((s.player && s.player.level) || 1) - 1), gate: count(s.side && s.side.gateWeek) };
  }
  function pointsTotal() { var p = parts(); return Math.min(T('cap', 56), p.level + p.gate); }

  function api() {
    if (!def() || !PW()) { return null; }
    var st = store();
    if (!cache || cache.store !== st || cache.def !== def()) {
      cache = { store: st, def: def(), sums: null, rules: null };
      var c = cache;
      c.api = PW().make(def(), st, { points: pointsTotal });
      c.api.onChange(function () { c.sums = null; c.rules = null; });
    }
    return cache.api;
  }
  /** 합·규칙 — 바뀔 때만 다시 센다(이동·점프처럼 프레임마다 묻는 자리가 있다) */
  function tally() {
    var a = api();
    if (!a) { return null; }
    if (!cache.sums) {
      var sums = {}, rules = {};
      cache.store.taken.forEach(function (id) {
        var n = a.node(id), k;
        if (!n) { return; }
        if (n.rule) { rules[n.rule] = 1; }
        for (k in (n.stats || {})) { if (typeof n.stats[k] === 'number') { sums[k] = (sums[k] || 0) + n.stats[k]; } }
      });
      cache.sums = sums; cache.rules = rules;
    }
    return cache;
  }
  function sum(key) { var c = tally(); return c ? (c.sums[key] || 0) : 0; }
  function has(rule) { var c = tally(); return !!(c && c.rules[rule]); }
  function pct(key) { return 1 + sum(key) / 100; }
  function less(key, floor) { return Math.max(floor, 1 - sum(key) / 100); }

  /* ── side.js 가 묻는 배율 ── */
  function atk() {
    return pct('atkPct') * (has('hanbang') ? T('hanbangAtk', 1.6) : 1) * (has('yeonta') ? T('yeontaAtk', 0.75) : 1) * (has('lone') ? T('loneAtk', 1.25) : 1);
  }
  function hp() { return pct('hpPct') * (has('jilpung') ? T('jilpungHp', 0.8) : 1); }
  function mp() { return pct('mpPct'); }
  function crit() { return sum('critPct') / 100; }
  function move() { return pct('movePct') * (has('jilpung') ? T('jilpungMove', 1.25) : 1); }
  function jump() { return pct('jumpPct') * (has('cheolgak') ? T('cheolgakJump', 0.7) : 1); }
  function dodgeCd() { return less('dodgePct', 0.4); }
  function cd() { return less('cdPct', 0.5) * (has('hanbang') ? T('hanbangCd', 1.4) : 1); }
  function hits() { return has('yeonta') ? 1 : 0; }
  function take() { return less('guardPct', 0.5) * (has('cheolgak') ? T('cheolgakTake', 0.8) : 1); }
  function keepMount() { return has('cheolgak'); }
  function drop() { return pct('dropPct') * (has('hunteye') ? T('hunteyeDrop', 1.4) : 1); }
  function regen() { return has('manadrink') ? 0 : 1; }
  /** 마력 흡수 — 한 타에 차는 마나(규칙이 없으면 0) */
  function mpHit(mpMax) { return has('manadrink') ? mpMax * T('manaHit', 0.05) : 0; }
  function solo() { return has('lone'); }
  /** core.effect 원천 — 경험 */
  function bonus() {
    var e = sum('expPct') - (has('hunteye') ? T('hunteyeExp', 20) : 0);
    return e ? { expPct: e } : {};
  }
  /** 비연 — 공중 점프를 보는 쪽 짧은 순간 이동으로 바꾼다. 움직였으면 true(side.jump 가 먼지·소리를 낸다) */
  function blink(p, width) {
    if (!has('biyeon') || !p || p.onGround) { return false; }
    var now = Date.now();
    if (p.blinkAt && now - p.blinkAt < T('blinkMs', 600)) { return false; }
    p.blinkAt = now;
    p.x = Math.max(0, Math.min(width - 32, p.x + (p.facing || 1) * T('blinkDist', 130)));
    p.vy = Math.min(p.vy || 0, 0);
    return true;
  }

  /* ── 시작점 · 되돌리기 ── */
  function rootKey() { var J = global.DG.job; return J && J.rootOf ? J.rootOf(core.save.job) : null; }
  function startOk(key) { return key === 'none' || key === rootKey(); }
  function inTown() { var S = global.DG.side, r = S && S.raw ? S.raw() : null; return !r || !!(r.stage && r.stage.town); }
  function dropCost(n) { return Math.round(T('dropGold', 200) * (n || 1)); }
  var pendingReset = 0;
  function guard(action, id) {
    var a = api(), nd = id ? a.node(id) : null;
    if (action === 'start' && nd && !startOk(nd.s)) { return '지금 직업 계열의 별이나 가운데 무명에서만 시작한다'; }
    if (action === 'drop' || action === 'reset') {
      if (!inTown()) { return '되돌리기는 마을에서만 된다'; }
      var cost = dropCost(action === 'reset' ? a.used() : 1);
      if ((core.save.player.gold || 0) < cost) { return '금이 모자란다 (' + cost + '금)'; }
      if (action === 'reset') { pendingReset = cost; }
    }
    return '';
  }
  function after(action) {
    if (action === 'drop') { core.save.player.gold -= dropCost(1); }
    if (action === 'reset') { core.save.player.gold -= pendingReset; pendingReset = 0; }
    if (core.persist) { core.persist(); }
    core.emit('changed');
  }

  var FMT = {
    atkPct: ['공격', '%'], hpPct: ['체력', '%'], mpPct: ['마나', '%'], critPct: ['급소', '%p'], movePct: ['이동', '%'], jumpPct: ['점프', '%'],
    dodgePct: ['회피 재사용 줄임', '%'], cdPct: ['무예 재사용 줄임', '%'], dropPct: ['드롭', '%'], expPct: ['경험', '%'], guardPct: ['받는 피해 줄임', '%'],
  };
  function fmt(stats) {
    return Object.keys(stats || {}).map(function (k) { var f = FMT[k] || [k, ''], v = stats[k]; return f[0] + ' ' + (v > 0 ? '+' : '') + v + f[1]; }).join(' · ');
  }

  /** 무예 창 카드 — ui 무예 창(viewJob) 첫 칸 밑에 붙는다 */
  function sheetHtml() {
    var a = api();
    if (!a) { return ''; }
    return '<div class="sec"><h4>✨ 사방 성좌</h4><div class="card">' +
      '<div class="stat-row"><span>' + (a.start() ? '찍은 별 ' + a.used() : '시작점 고르기 전') + '</span>' +
        '<b>남은 성좌 점수 ' + a.left() + ' / ' + a.points() + '</b></div>' +
      '<small class="muted">별 ' + def().nodes.length + '개 그물 — 찍은 별에 이웃한 곳만 찍힙니다. 레벨마다 1점, 관문 대장을 처음 이기면 1점. ' +
        '첫 점은 지금 직업 계열이나 가운데 무명에. 되돌리기는 마을에서 금을 냅니다.</small>' +
      '<button class="btn tiny primary wide" data-act="star-open">✨ 성좌도 열기</button>' +
      '</div></div>';
  }

  function open() {
    var UI = global.DG.passiveWebUI, a = api();
    if (!UI || !a) { return null; }
    return UI.open(a, def(), {
      title: '✨ 사방 성좌도',
      fmt: fmt, guard: function (action, id) { return guard(action, id); }, after: function (action) { after(action); },
      onClose: function () { core.emit('changed'); },
    });
  }

  global.DG = global.DG || {};
  global.DG.constellation = {
    store: store, api: api, sum: sum, has: has, parts: parts, pointsTotal: pointsTotal,
    atk: atk, hp: hp, mp: mp, crit: crit, move: move, jump: jump, dodgeCd: dodgeCd, cd: cd, hits: hits, take: take, keepMount: keepMount,
    drop: drop, regen: regen, mpHit: mpHit, solo: solo, bonus: bonus, blink: blink,
    startOk: startOk, inTown: inTown, dropCost: dropCost, guard: guard, fmt: fmt, sheetHtml: sheetHtml, open: open, T: T,
    _reset: function () { cache = null; },
  };
})(window);
