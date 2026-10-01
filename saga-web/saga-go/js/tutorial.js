/**
 * 첫 10분 안내 (SAGA-BACKLOG P0-1, SAGA-DESIGN 표준 A)
 * ---------------------------------------------------------------
 * 새 세이브가 처음 켜질 때 "무엇을 할지"를 목표판 **첫 줄**(`ui.js goalNowText`)에 한 단계씩 띄운다.
 *
 *   걷기 50m → 인물 등용 → 짐승 포획 → 보물 상자 → 사명 창 열기
 *
 * - 순서대로만 나아간다(앞 단계 전의 뒤 단계 이벤트는 무시). 단계마다 작은 보상, 끝나면 문구가 사라진다.
 * - **옛 세이브**(`save.tut` 가 없다)는 이미 끝난 것으로 본다 — 새로 가입한 세이브만 `freshSave()` 가 `tut` 를 둔다.
 * - 판정에는 한 줄도 안 닿는다. 이벤트는 읽기만 하고(`dex:new`·`treasure:open`·`sheet:open`), 걷기는 `player.distance` 를 본다.
 * - 진단은 `_feed(이벤트, 값)` 로 이벤트를 직접 먹인다(`_test.html` 은 `DG_NO_TUT` 로 평소엔 끈다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 단계 표. `on` = 기다리는 이벤트(걷기는 없음), `cat`/`name` = 그 이벤트의 조건 */
  var STEPS = [
    { key: 'walk', text: '🚶 걸어 보세요 — 50m', walk: 50, gold: 30 },
    { key: 'recruit', text: '🤝 인물을 만나 등용해 보세요', on: 'dex:new', cat: 'heroes', gold: 30 },
    { key: 'catch', text: '🐾 짐승을 포획해 보세요', on: 'dex:new', cat: 'pets', gold: 30 },
    { key: 'chest', text: '📦 보물 상자를 열어 보세요', on: 'treasure:open', gold: 30 },
    { key: 'quest', text: '🎯 사명 창을 열어 보세요', on: 'sheet:open', name: 'quest', gold: 100 }
  ];

  function tut() {
    if (global.DG_NO_TUT) { return null; }   // 자가진단은 다른 항목의 금·거리가 안내 보상에 흔들리지 않게 끈다(이 안내 자신의 진단만 켠다)
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
    if (global.DG.ui && global.DG.ui.toast && !global.DG_NO_DRAW) { global.DG.ui.toast(msg); }
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
    core.persist();
    return true;
  }

  /** 이동 단계 확인 — 처음 보는 순간의 거리를 기준으로 삼는다 */
  function walkCheck() {
    var t = tut(), s = STEPS[step()];
    if (!t || !s || !s.walk) { return; }
    var d = (core.save.player && core.save.player.distance) || 0;
    if (t.d0 === null || t.d0 === undefined) { t.d0 = d; }
    if (d - t.d0 >= s.walk) { complete(); }
  }

  /** 이벤트 하나를 먹인다(진단도 이 길로). 지금 단계가 기다리는 것과 맞을 때만 나아간다 */
  function feed(evt, p) {
    var s = STEPS[step()];
    if (!s || s.on !== evt) { return false; }
    if (s.cat && !(p && p.cat === s.cat)) { return false; }
    if (s.name && !(p && p.name === s.name)) { return false; }
    return complete();
  }

  /** 목표판 첫 줄에 쓸 문구 — 끝났거나 안내가 없는 세이브면 '' */
  function line() {
    if (done()) { return ''; }
    walkCheck();
    var s = STEPS[step()];
    return s ? s.text + ' <small>(' + (step() + 1) + '/' + STEPS.length + ')</small>' : '';
  }

  function wire() {
    core.on('dex:new', function (p) { feed('dex:new', p); });
    core.on('treasure:open', function (p) { feed('treasure:open', p); });
    core.on('sheet:open', function (p) { feed('sheet:open', p); });
  }
  wire();

  global.DG.tut = {
    STEPS: STEPS, step: step, done: done, line: line, _feed: feed, _walkCheck: walkCheck
  };
})(window);
