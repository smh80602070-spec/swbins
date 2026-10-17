/**
 * 4종횡 — 저스트 회피 (W-0282, 소울워커·던전앤파이터 식 — 구조만, 이름·수치·그림은 우리 것)
 * ---------------------------------------------------------------
 * 회피는 무적만 있고 "잘 피했다" 보상이 없었다 → 적 공격(몸 닿기·화살·구슬·관문 내리치기)이 **회피 무적(dodgeAnim 0.12초) 안에**
 * 닿으면 저스트: 0.8초 슬로(판정 dt ×0.35 — hitstop 과 같은 자리) + 다음 한 타 ×1.3 · 쿨 4초 · 화면 테두리 번쩍(body.side-just) + 소리.
 *
 *   side.js 는 줄 상한(2246)이라 줄 끝에만 — hurtMe 무적 가지·eshots 맞음·관문 slam 에서 evaded(p), update 의 hitstop 줄 뒤 scale(dt),
 *   strike 의 "다음 한 타" 줄에 nextMul(). 세이브엔 아무것도 안 남긴다(판 안 상태뿐).
 */
(function (global) {
  'use strict';

  var WINDOW = 0.15, SLOW_SEC = 0.8, SLOW_MUL = 0.35, NEXT_MUL = 1.3, CD_SEC = 4, FLASH_MS = 500;
  var slowT = 0, cdT = 0, bonus = 1, lastAt = 0, count = 0;

  function core() { return global.DG.core; }
  function flash() {
    var b = global.document && global.document.body;
    if (!b) { return; }
    b.classList.add('side-just');
    setTimeout(function () { b.classList.remove('side-just'); }, FLASH_MS);
  }
  /** 적 공격이 무적 중인 나에게 닿았다 — 회피 무적(dodgeAnim) 창 안이면 저스트. 맞은 쪽(side.js)이 부른다 */
  function evaded(p) {
    if (!p || !(p.dodgeAnim > 0) || cdT > 0) { return false; }
    if (p.dodgeAnim < Math.max(0, 0.12 - WINDOW)) { return false; }   // 창(0.15)이 무적(0.12)보다 길어 지금은 늘 참 — 무적이 길어져도 창은 0.15
    slowT = SLOW_SEC; cdT = CD_SEC; bonus = NEXT_MUL; count += 1; lastAt = Date.now();
    var S = global.DG.sfx; if (S && S.play) { S.play('crit'); }
    flash();
    core().emit('toast', '⚡ 저스트 회피! — 느려진다 · 다음 한 타 ×' + NEXT_MUL);
    core().emit('side:just', { count: count });
    return true;
  }
  /** update 가 매 틱 — 쿨·슬로를 실제 dt 로 줄이고, 슬로 중이면 판정 dt 를 낮춰 돌려준다 */
  function scale(dt) {
    if (cdT > 0) { cdT -= dt; }
    if (slowT > 0) { slowT -= dt; return dt * SLOW_MUL; }
    return dt;
  }
  /** strike 가 한 번 꺼내 쓰고 지운다 */
  function nextMul() { var b = bonus; bonus = 1; return b; }
  function state() { return { slow: Math.max(0, slowT), cd: Math.max(0, cdT), cdMax: CD_SEC, bonus: bonus, count: count, lastAt: lastAt }; }
  function reset() { slowT = 0; cdT = 0; bonus = 1; }

  global.DG = global.DG || {};
  global.DG.sideJust = {
    WINDOW: WINDOW, SLOW_SEC: SLOW_SEC, SLOW_MUL: SLOW_MUL, NEXT_MUL: NEXT_MUL, CD_SEC: CD_SEC,
    evaded: evaded, scale: scale, nextMul: nextMul, state: state, reset: reset
  };
})(window);
