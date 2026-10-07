/**
 * 첫 10분 안내 — 사가마을 (SAGA-BACKLOG P0-1, SAGA-DESIGN 표준 A, W-0038)
 * ---------------------------------------------------------------
 * 새 세이브가 처음 켜질 때 "무엇을 할지"를 프로필 카드의 **맨 윗 목표 줄**(`ui.js renderTop`)에 한 단계씩 띄운다.
 *
 *   채집 → 낚시 → 벌레 잡기 → 택배 배달 → 내 집 들어가기
 *
 * - 순서대로만 나아간다(앞 단계 전의 뒤 단계 이벤트는 무시). 단계마다 작은 보상, 끝나면 문구가 사라진다.
 * - **옛 세이브**(`save.tut` 가 없다)는 이미 끝난 것으로 본다 — 새로 가입한 세이브만 `freshSave()` 가 `tut` 를 둔다(`load()` 가 옛 세이브의 칸을 지운다).
 * - 판정에는 한 줄도 안 닿는다. 이벤트는 읽기만 한다(`village:gather`·`village:fish`·`village:bug`·`village:delivered`·`village:home`).
 * - 진단은 `_feed(이벤트, 값)` 로 이벤트를 직접 먹인다(`_test.html` 은 `DG_NO_TUT` 로 평소엔 끈다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 단계 표. `on` = 기다리는 이벤트, `ok(p)` = 값 조건(없으면 아무 값) */
  var STEPS = [
    { key: 'gather', text: '🌿 풀·나무에서 채집해 보세요', on: 'village:gather', gold: 30 },
    { key: 'fish', text: '🎣 낚시로 물고기를 잡아 보세요', on: 'village:fish', ok: function (p) { return !!p && p.state === 'catch'; }, gold: 30 },
    { key: 'bug', text: '🦋 벌레를 잡아 보세요', on: 'village:bug', ok: function (p) { return !!p && p.state === 'catch'; }, gold: 30 },
    { key: 'parcel', text: '📦 택배를 배달해 보세요', on: 'village:delivered', gold: 50 },
    { key: 'home', text: '🏠 내 집에 들어가 보세요', on: 'village:home', ok: function (p) { return !!p && p.inside === true; }, gold: 100 }
  ];

  function tut() {
    if (global.DG_NO_TUT) { return null; }   // 자가진단은 다른 항목의 금이 안내 보상에 흔들리지 않게 끈다(이 안내 자신의 진단만 켠다)
    var t = core.save && core.save.tut;
    return t && Array.isArray(t.done) ? t : null;
  }

  /** 지금 몇 번째 단계인가(0 부터). 끝났거나 안내가 없는 세이브면 STEPS.length */
  function step() {
    var t = tut();
    return t ? Math.min(t.done.length, STEPS.length) : STEPS.length;
  }

  function done() { return step() >= STEPS.length; }

  function toast(msg) {
    if (!global.DG_NO_DRAW) { core.emit('toast', msg); }
  }

  /** 지금 단계를 끝낸다 — 보상·토스트·저장 */
  function complete() {
    var t = tut(), s = STEPS[step()];
    if (!t || !s) { return false; }
    t.done.push(s.key);
    core.save.player.gold = (core.save.player.gold || 0) + s.gold;
    var last = t.done.length >= STEPS.length;
    toast('✅ ' + s.text.replace(/^\S+\s/, '') + ' — 금 +' + s.gold + (last ? ' · 안내를 모두 마쳤습니다' : ''));
    core.emit('tut:step', { key: s.key, n: t.done.length });
    core.emit('changed');
    core.persist();
    return true;
  }

  /** 이벤트 하나를 먹인다(진단도 이 길로). 지금 단계가 기다리는 것과 맞을 때만 나아간다 */
  function feed(evt, p) {
    var s = STEPS[step()];
    if (!s || s.on !== evt) { return false; }
    if (s.ok && !s.ok(p)) { return false; }
    return complete();
  }

  /** 목표 줄에 쓸 문구 — 끝났거나 안내가 없는 세이브면 '' */
  function line() {
    if (done()) { return ''; }
    var s = STEPS[step()];
    return s ? s.text + ' <small>(' + (step() + 1) + '/' + STEPS.length + ')</small>' : '';
  }

  /** 프로필 카드용 한 줄(없으면 '') */
  function lineHtml() {
    var l = line();
    return l ? '<div class="p-goal tut-goal">' + l + '</div>' : '';
  }

  function wire() {
    var seen = {};
    STEPS.forEach(function (s) {
      if (seen[s.on]) { return; }
      seen[s.on] = true;
      core.on(s.on, function (p) { feed(s.on, p); });
    });
  }
  wire();

  global.DG.tut = { STEPS: STEPS, step: step, done: done, line: line, lineHtml: lineHtml, _feed: feed };
})(window);
