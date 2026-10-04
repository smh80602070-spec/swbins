/**
 * 첫 발 장면 — 원 지시서 잔여 "스토리 연출"(2026-09-23)
 * ---------------------------------------------------------------
 * 사냥터(와 시작 마을)에 **처음** 들어설 때 한 번, 위아래 검은 띠 + 초상 + 감정 +
 * 대사 몇 줄을 띄운다. 대사는 `data-side.js` 의 `STORY`, 그리는 것은 `ui.js` 의
 * `renderStoryBox()`, 장면 동안 사냥이 멎는 것은 `game.js` 루프가 `isOpen()` 을 본다.
 * 여기는 **무엇을 언제 띄우고, 봤다고 적는 것**만 한다.
 *
 * 세이브: `core.save.side.story = { <사냥터 key>: 1 }` — 없으면 빈 것으로 본다(마이그레이션 불필요).
 * 안 띄우는 때: `DG_NO_STORY`(데모·진단), 자동 순행 중(다음에 손으로 들어올 때로 미룬다),
 *              `STORY` 에 없는 사냥터(마을 대부분·비경 임시 방).
 */
(function (global) {
  'use strict';

  var core = global.DG.core;
  var cur = null;            // { key, title, lines, i } — 떠 있는 장면

  function SD() { return global.DG.sideData; }

  function seenMap() {
    var s = core.save.side;
    if (!s) { return {}; }
    if (!s.story || typeof s.story !== 'object') { s.story = {}; }
    return s.story;
  }

  function seen(key) { return !!seenMap()[key]; }

  function blocked() {
    if (global.DG_NO_STORY) { return true; }
    var A = global.DG.auto;
    return !!(A && A.active && A.active());
  }

  /** 이 사냥터에 들어서며 띄울 장면이 있으면 띄운다 — 띄웠으면 true */
  function maybeOpen(key) {
    var beat = SD().STORY && SD().STORY[key];
    var SC = global.DG.scenario;
    if (SC && SC.owns(key)) { return false; }    // 시나리오 제1장 안 대사가 대신한다(scenario.js)
    if (!beat || cur || seen(key) || blocked()) { return false; }
    cur = { key: key, title: beat.title, lines: beat.lines, i: 0 };
    core.emit('story:change', cur);
    return true;
  }

  /** 시나리오 장면(scenario.js) — 본 기록은 안 남기고, 닫히면 `done` 을 부른다. 못 띄우면 false */
  function play(key, title, lines, done, choice) {
    if (cur || blocked() || !lines || !lines.length) { return false; }
    var SC = global.DG.scenario, ch = SC && SC.current ? SC.current() : null;
    cur = { key: key, title: title, lines: lines, i: 0, scn: true, done: done, choice: choice || null, pick: false, ch: ch ? ch.id : null };
    core.emit('story:change', cur);
    return true;
  }

  function close(picked) {
    if (!cur) { return; }
    if (cur.choice && typeof picked !== 'string') { toChoice(); return; }   // 고르기 장면은 건너뛰어도 고르기 앞까지만
    var done = cur.scn ? cur.done : null;
    if (!cur.scn) { seenMap()[cur.key] = 1; }
    cur = null;
    core.persist();
    core.emit('story:change', null);
    if (done) { done(picked); }
  }

  /** 고르기 장면(`choice: { id, prompt, options:[{key,label}] }`)의 마지막 줄 다음 — 단추를 보인다 */
  function toChoice() {
    if (!cur || cur.pick) { return; }
    cur.i = cur.lines.length - 1;
    cur.pick = true;
    core.emit('story:change', cur);
  }

  /** 고른다 — 고르기 단계에서만 먹는다 */
  function pick(key) {
    if (!cur || !cur.pick || !cur.choice) { return false; }
    var ok = cur.choice.options.some(function (o) { return o.key === key; });
    if (!ok) { return false; }
    close(key);
    return true;
  }

  /** 다음 줄 — 마지막 줄에서 부르면 닫는다(고르기 장면은 고르기로 넘어가고, 고르기 중엔 아무 일도 없다) */
  function next() {
    if (!cur || cur.pick) { return; }
    if (cur.i < cur.lines.length - 1) { cur.i += 1; core.emit('story:change', cur); }
    else if (cur.choice) { toChoice(); }
    else { close(); }
  }

  function onEnter(run) {
    if (run && run.stage && !run.stage.rift) { maybeOpen(run.stage.key); }
  }
  core.on('side:enter', onEnter);
  core.on('side:travel', onEnter);

  global.DG = global.DG || {};
  global.DG.story = {
    isOpen: function () { return !!cur; },
    current: function () { return cur; },
    maybeOpen: maybeOpen, play: play, next: next, pick: pick,
    /** 시나리오가 이 사냥터 장면을 대신했을 때 — 첫 발 장면을 본 것으로 적는다 */
    markSeen: function (key) { seenMap()[key] = 1; }, skip: function () { close(); }, seen: seen,
    /** 진단용 — 고르기 중이어도 장면을 강제로 닫는다(done 은 안 부른다) */
    abort: function () { cur = null; core.emit('story:change', null); },
    /** 어드민·진단용 — 본 기록을 지운다 */
    reset: function () { if (core.save.side) { core.save.side.story = {}; } cur = null; core.emit('story:change', null); }
  };
})(window);
