/**
 * 첫 10분 안내 — 사가블로 (SAGA-BACKLOG P0-1, SAGA-DESIGN 표준 A, W-0039)
 * ---------------------------------------------------------------
 * 새 세이브가 처음 켜질 때 "무엇을 할지"를 목표판 **맨 윗줄**(`ui.js renderGoals`)에 한 단계씩 띄운다.
 *
 *   마을 사람과 대화 → 던전 입장 → 스킬 쓰기 → 장비 얻기 → 레벨 2
 *
 * - 순서대로만 나아간다(앞 단계 전의 뒤 단계 이벤트는 무시). 단계마다 작은 보상, 끝나면 문구가 사라진다.
 * - **옛 세이브**(`save.tut` 가 없다)는 이미 끝난 것으로 본다 — 새로 가입한 세이브만 `freshSave()` 가 `tut` 를 둔다(`load()` 가 옛 세이브의 칸을 지운다).
 * - 판정에는 한 줄도 안 닿는다. 이벤트는 읽기만 한다(`town:npc`·`dungeon:room`·`dungeon:skill`·`gear:drop`·`levelup`).
 * - 진단은 `_feed(이벤트, 값)` 로 이벤트를 직접 먹인다(`_test.html` 은 `DG_NO_TUT` 로 평소엔 끈다).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;

  /** 단계 표. `on` = 기다리는 이벤트, `min` = 값(레벨)이 이 이상일 때만 */
  var STEPS = [
    { key: 'talk', text: '🗣️ 마을 사람과 이야기해 보세요', on: 'town:npc', gold: 30 },
    { key: 'dive', text: '🚪 던전에 들어가 보세요', on: 'dungeon:room', gold: 30 },
    { key: 'skill', text: '✨ 스킬을 써 보세요', on: 'dungeon:skill', gold: 30 },
    { key: 'gear', text: '🎁 장비를 얻어 보세요', on: 'gear:drop', gold: 50 },
    { key: 'level', text: '⬆️ 레벨 2 에 올라 보세요', on: 'levelup', min: 2, lv: 2, gold: 100 }
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
    autoLevel();
    var s = STEPS[step()];
    if (!s || s.on !== evt) { return false; }
    if (s.min && !(typeof p === 'number' && p >= s.min)) { return false; }
    return complete();
  }

  /** 레벨 단계는 앞 단계보다 먼저 레벨에 닿았어도 넘어간다(이벤트는 한 번뿐이라 상태로도 본다) */
  function autoLevel() {
    var s = STEPS[step()];
    while (s && s.lv && core.save.player.level >= s.lv && complete()) { s = STEPS[step()]; }
  }

  /** 목표판 첫 줄에 쓸 문구 — 끝났거나 안내가 없는 세이브면 '' */
  function line() {
    autoLevel();
    if (done()) { return ''; }
    var s = STEPS[step()];
    return s ? s.text + ' <small>(' + (step() + 1) + '/' + STEPS.length + ')</small>' : '';
  }

  /** 목표판용 한 줄(없으면 '') — 다른 줄과 같은 칸 모양 */
  function rowHtml() {
    if (done()) { return ''; }
    var s = STEPS[step()];
    return s ? '<div class="goal-row goal-tut"><span class="gi">🧭</span><span class="gl">' + s.text + '</span><span class="gp">' + (step() + 1) + '/' + STEPS.length + '</span></div>' : '';
  }

  function wire() {
    STEPS.forEach(function (s) { core.on(s.on, function (p) { feed(s.on, p); }); });
  }
  wire();

  global.DG.tut = { STEPS: STEPS, step: step, done: done, line: line, rowHtml: rowHtml, _feed: feed };
})(window);
