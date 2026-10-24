/**
 * 1만리 종 연구 과제 — 마릿수만 아니라 "어떻게 잡았나"를 종마다 센다 (W-0420 ① · 정본 고돗 G-0371 · 레전드 아르세우스 연구 — 구조만)
 * ---------------------------------------------------------------
 *   과제 넷   급소(쉬는 적에 충전 화살 — 'weak' 막타) · 원소 반응(막타 'hit' 의 react) ·
 *             쳐낸 적(그 목숨 동안 'parry') · 던진 적(그 목숨 동안 'throwLand' — 우두머리는 못 던져 뺌)
 *   목표      과제마다 GOAL 3(우두머리 1) — 채우면 그 자리에서 덤, 종의 과제를 다 채우면 "연구 완료" 덤 하나 더
 *   덤        웹 금 단위로 줄임(고돗 냥 800/3000 → 금 80·단사 2 / 금 300·단사 8 — 무리 토벌 금 15×급과 같은 결)
 *   세이브    save.goStudy = { 종: { 과제: 횟수 } } (순수 추가 — 옛 세이브 = 빈 것)
 *
 * 사건 순서(field-combat hitFoe): react → kill → hit(react·crit) → weak(화살만). 그래서 kill 을 받으면 잠깐 들고 있다가
 * 바로 뒤 같은 uid 의 hit·weak 로 막타 표식을 채우고, 다른 사건이 오거나 그 틱이 끝나면(setTimeout 0) 셈한다.
 * field-combat handle 루프 첫 줄에서 onEv(e) 를 부른다(goRank 곁). 도감 창 칸은 view(esc). 손잡이 go.study(1, 0 = 안 셈).
 */
(function (global) {
  'use strict';

  var TASKS = [
    { id: 'weak', name: '급소로 쓰러뜨리기', s: '급소' },
    { id: 'react', name: '원소 반응으로 쓰러뜨리기', s: '반응' },
    { id: 'parried', name: '쳐낸 적 쓰러뜨리기', s: '쳐냄' },
    { id: 'thrown', name: '던진 적 쓰러뜨리기', s: '던짐' }
  ];
  var GOAL = 3, BOSS_GOAL = 1;
  var TASK_REWARD = { gold: 80, dust: 2 }, DONE_REWARD = { gold: 300, dust: 8 };

  var life = {};      // uid → { parried, thrown } — 그 목숨 동안
  var pend = null;    // 막 쓰러진 적 { uid, kind, tags{} }
  var timer = 0;

  function core() { return global.DG.core; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('go.study', 1)); }
  function FOES() { var F = global.DG.fieldFoes; return (F && F.FOES) || {}; }
  function isBoss(kind) { var d = FOES()[kind]; return !!(d && d.boss); }
  function state() { var s = core().save; if (!s.goStudy || typeof s.goStudy !== 'object') { s.goStudy = {}; } return s.goStudy; }

  function tasksOf(kind) { return TASKS.filter(function (t) { return !(t.id === 'thrown' && isBoss(kind)); }).map(function (t) { return t.id; }); }
  function goalOf(kind) { return isBoss(kind) ? BOSS_GOAL : GOAL; }
  function nameOf(id, sh) { for (var i = 0; i < TASKS.length; i++) { if (TASKS[i].id === id) { return sh ? TASKS[i].s : TASKS[i].name; } } return id; }
  function count(kind, t) { var r = state()[kind]; return (r && r[t]) || 0; }
  function doneCount(kind) { return tasksOf(kind).filter(function (t) { return count(kind, t) >= goalOf(kind); }).length; }
  function complete(kind) { return doneCount(kind) >= tasksOf(kind).length; }

  function pay(R) { var s = core().save; s.player.gold = (s.player.gold || 0) + R.gold; s.dust = (s.dust || 0) + R.dust; }
  function toast(msg) { var U = global.DG.ui; if (U && U.toast) { U.toast(msg); } }

  /** 한 마리 — 태그마다 올리고 이번에 채운 과제 id 들(연구 완료면 'done' 도)을 돌려준다(덤은 그 자리에서) */
  function record(kind, tags) {
    var fresh = [];
    if (!on() || !FOES()[kind]) { return fresh; }
    var was = complete(kind), st = state(), allowed = tasksOf(kind), g = goalOf(kind);
    if (!st[kind]) { st[kind] = {}; }
    var row = st[kind];
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (allowed.indexOf(t) < 0) { continue; }
      var b = row[t] || 0;
      row[t] = b + 1;
      if (b < g && b + 1 >= g) { fresh.push(t); pay(TASK_REWARD); }
    }
    if (!was && complete(kind)) { fresh.push('done'); pay(DONE_REWARD); }
    return fresh;
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = 0; }
    var p = pend; pend = null;
    if (!p) { return []; }
    var tags = Object.keys(p.tags), fresh = record(p.kind, tags);
    var nm = (FOES()[p.kind] || {}).name || p.kind;
    for (var i = 0; i < fresh.length; i++) {
      if (fresh[i] === 'done') { toast('🔬 ' + nm + ' 연구 완료! 금 +' + DONE_REWARD.gold + ' · 단사 +' + DONE_REWARD.dust); }
      else { toast('🔬 ' + nm + ' — ' + nameOf(fresh[i]) + ' 달성 · 금 +' + TASK_REWARD.gold); }
    }
    return fresh;
  }

  /** 사건 하나 — field-combat handle 루프 첫 줄 */
  function onEv(e) {
    if (!e || !on()) { return; }
    if (pend && !((e.t === 'hit' || e.t === 'weak') && e.uid === pend.uid)) { flush(); }
    if (e.t === 'parry') { (life[e.uid] = life[e.uid] || {}).parried = true; }
    else if (e.t === 'throwLand') { (life[e.uid] = life[e.uid] || {}).thrown = true; }
    else if (e.t === 'kill') {
      var L = life[e.uid] || {}, tags = {};
      if (L.parried) { tags.parried = 1; }
      if (L.thrown) { tags.thrown = 1; }
      delete life[e.uid];                                   // 다시 서는 목숨은 새로 센다
      pend = { uid: e.uid, kind: e.kind, tags: tags };
      if (!timer && global.setTimeout) { timer = global.setTimeout(flush, 0); }
    } else if (pend && e.t === 'hit') { if (e.react) { pend.tags.react = 1; } }
    else if (pend && e.t === 'weak') { pend.tags.weak = 1; }
  }

  /** 도감 창 칸 — 한 번이라도 센 종만(줄 끝 "연구 n/4"), 과제는 작은 글 */
  function view(esc) {
    if (!on()) { return ''; }
    var st = state(), kinds = Object.keys(st).filter(function (k) { return FOES()[k]; });
    if (!kinds.length) {
      return '<div class="sec"><h4>🔬 들판 짐승 연구</h4><small class="muted">급소·원소 반응·쳐내기·던지기로 쓰러뜨리면 종마다 연구가 쌓입니다.</small></div>';
    }
    var nDone = kinds.filter(complete).length, rows = '';
    kinds.forEach(function (k) {
      var g = goalOf(k), sub = tasksOf(k).map(function (t) { var n = Math.min(count(k, t), g); return (n >= g ? '✔' : '·') + ' ' + nameOf(t, true) + ' ' + n + '/' + g; }).join(' · ');
      rows += '<div class="stat-row study-row"><span>' + esc(FOES()[k].name) + '</span><b>' + (complete(k) ? '연구 완료' : '연구 ' + doneCount(k) + '/' + tasksOf(k).length) + '</b></div>' +
        '<small class="muted">' + sub + '</small>';
    });
    return '<div class="sec"><h4>🔬 들판 짐승 연구 <small class="muted">완료 ' + nDone + '/' + kinds.length + '</small></h4>' + rows + '</div>';
  }

  global.DG = global.DG || {};
  global.DG.speciesStudy = {
    TASKS: TASKS, GOAL: GOAL, BOSS_GOAL: BOSS_GOAL, TASK_REWARD: TASK_REWARD, DONE_REWARD: DONE_REWARD,
    onEv: onEv, flush: flush, record: record, tasksOf: tasksOf, goalOf: goalOf, count: count, doneCount: doneCount, complete: complete, view: view,
    _reset: function () { life = {}; pend = null; if (timer) { clearTimeout(timer); timer = 0; } }
  };
})(window);
