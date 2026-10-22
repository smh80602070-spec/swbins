/**
 * 4종횡 — 지도 조각·지름길 (W-0305 · 할로우 나이트 지도 조각·메이플 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 사냥터는 매번 왼쪽부터 걸었다 → 사냥터마다 이미 있는 "옛 조각" 셋(side-hand.js relics, save.relics 비트 0~2)이 그 사냥터의 지도 조각이다.
 * 셋을 다 주우면 지도가 완성되고, 쉬는 판 사냥터 단추 곁에서 지름길(가운데·끝 조각 자리에서 시작)을 고른다.
 *   잇기: side:enter 이벤트에서 고른 지름길이면 나를 그 x 로 옮김 · ui renderCamp 사냥터 단추 뒤 btnHtml(key) · data-sm 클릭
 *   세이브 새 칸 없음(조각은 save.relics 그대로, 지름길 고르기는 한 번 쓰고 사라지는 메모리 값)
 *   손잡이 story.shortcut(1, 0 = 끔)
 */
(function (global) {
  'use strict';

  var pending = null;   // { key, at } — 다음 enter 한 번만

  function core() { return global.DG.core; }
  function SD() { return global.DG.sideData; }
  function SH() { return global.DG.sideHand; }
  function on() { var C = core(); return !(C && C.tuned && !+C.tuned('story.shortcut', 1)); }
  function stg(key) { var D = SD(); return D && D.stage ? D.stage(key) : null; }
  /** { have, of, done } 또는 null(조각 없는 곳) */
  function info(key) {
    var s = stg(key), f = s && SH() && SH().stageInfo ? SH().stageInfo(s) : null;
    return f ? { have: f.relics, of: f.of, done: f.of > 0 && f.relics >= f.of } : null;
  }
  /** 지름길 시작 x — mid = 둘째 조각 자리, end = 셋째 조각 자리(순수: 사냥터 자료만) */
  function startX(key, at) {
    var s = stg(key);
    if (!s || !s.relics || s.relics.length < 3) { return null; }
    return at === 'end' ? s.relics[2] : at === 'mid' ? s.relics[1] : null;
  }
  /** 지름길로 들어가기 — { ok, why } */
  function go(key, at) {
    if (!on()) { return { ok: false, why: '지름길이 꺼져 있다' }; }
    var f = info(key);
    if (!f || !f.done) { return { ok: false, why: '이 사냥터 지도 조각을 셋 다 모아야 한다(' + (f ? f.have + '/' + f.of : '없음') + ')' }; }
    if (startX(key, at) === null) { return { ok: false, why: '그런 지름길이 없다' }; }
    pending = { key: key, at: at };
    var r = global.DG.side.enter(key);
    if (!r) { pending = null; return { ok: false, why: '들어갈 수 없다' }; }
    return { ok: true };
  }
  /** side:enter — 고른 지름길이면 그 자리 바닥에서 시작 */
  function onEnter(run) {
    var p = pending; pending = null;
    if (!p || !run || !run.stage || run.stage.key !== p.key) { return false; }
    var x = startX(p.key, p.at), P_H = (global.DG.side && global.DG.side.P_H) || 60;
    if (x === null) { return false; }
    run.player.x = Math.max(80, Math.min((run.stage.width || x + 200) - 120, x)); run.player.y = run.stage.floor - P_H; run.player.vx = 0; run.player.vy = 0; run.player.onGround = true;
    core().emit('toast', '🗺️ 지름길 — ' + (p.at === 'end' ? '끝' : '가운데') + ' 조각 자리에서 시작');
    return true;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** 쉬는 판 사냥터 단추 뒤 — 지도 칸(조각 수·지름길) */
  function btnHtml(key) {
    if (!on()) { return ''; }
    var f = info(key);
    if (!f) { return ''; }
    if (!f.done) { return '<small class="muted" style="display:block;margin:-4px 0 6px 8px">🗺️ 지도 조각 ' + f.have + '/' + f.of + ' — 다 모으면 지름길</small>'; }
    return '<div class="life-chips" style="margin:-4px 0 6px 8px"><small class="muted">🗺️ 지도 완성 · 지름길</small>' +
      '<button class="btn tiny" data-sm="mid" data-stage="' + esc(key) + '">⏩ 가운데부터</button><button class="btn tiny" data-sm="end" data-stage="' + esc(key) + '">⏭️ 끝부터</button></div>';
  }
  if (global.document) {
    global.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-sm]') : null, r;
      if (!b || b.disabled) { return; }
      r = go(b.getAttribute('data-stage'), b.getAttribute('data-sm'));
      if (!r.ok) { core().emit('toast', '🗺️ ' + r.why); }
    });
  }
  function bind() { var C = core(); if (C && C.on && !bind.done) { bind.done = true; C.on('side:enter', onEnter); } }
  if (global.DG && global.DG.core) { bind(); }

  global.DG = global.DG || {};
  global.DG.stageMap = { info: info, startX: startX, go: go, onEnter: onEnter, btnHtml: btnHtml, bind: bind, _pending: function () { return pending; } };
})(window);
